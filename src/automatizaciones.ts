import { CronExpressionParser } from 'cron-parser';

/**
 * CH-13: the pure half of the scheduler (X1, X2). Three things live here and nothing
 * else: whether a stored schedule is standard cron (DEC-76), whether an automation is due
 * inside a tick's window in the deployment's timezone (DEC-77), and how a run's outcome
 * becomes the closed columns of its `Ejecucion` row. No Fastify, no Prisma, no
 * connection: `src/planificador.ts` owns every side effect.
 *
 * `cron-parser` is used for next-fire calculation only (DEC-76). Nothing here, or
 * anywhere else, asks it to run a task.
 */

// ---- cron validity (DEC-76) ---------------------------------------------------------

/**
 * Standard cron has exactly five fields: minute, hour, day of month, month, day of
 * week. The library also accepts a leading seconds field and `@daily`-style aliases;
 * both are refused here, before parsing, so the parsed surface stays closed.
 */
const CAMPOS_CRON = 5;

/** Month names, accepted only in the month field (index 3). */
const MESES = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
/** Day names, accepted only in the day-of-week field (index 4). */
const DIAS = 'sun|mon|tue|wed|thu|fri|sat';

/**
 * Per-field character allowlist: digits, `*`, `,`, `-`, `/`, and the three-letter names
 * standard cron defines for its own field. Everything else the library would accept as an
 * extension — hashed `H`, last `L`, nth weekday `#`, the `?` placeholder — is refused,
 * because "standard cron" (DEC-76) is the only shape the operator is promised.
 */
const NUMERICO = /^[0-9*,/-]+$/;
const CON_MESES = new RegExp(`^(?:[0-9*,/-]|${MESES})+$`, 'i');
const CON_DIAS = new RegExp(`^(?:[0-9*,/-]|${DIAS})+$`, 'i');
const PATRON_POR_CAMPO: readonly RegExp[] = [NUMERICO, NUMERICO, NUMERICO, CON_MESES, CON_DIAS];

/** Splits a stored schedule into its fields; `null` when it is not five of them. */
function camposCron(cron: string): string[] | null {
  const campos = cron.trim().split(/\s+/);
  if (campos.length !== CAMPOS_CRON) {
    return null;
  }
  return campos.every((campo, i) => PATRON_POR_CAMPO[i].test(campo)) ? campos : null;
}

/**
 * Whether `cron` is a standard five-field expression the library can resolve in `zona`.
 * The shape is checked first; the library then rejects out-of-range values, empty steps,
 * inverted ranges, and impossible dates (`0 0 30 2 *`). An unknown `zona` makes every
 * expression invalid, since no fire time could be computed in it.
 */
export function cronValido(cron: string, zona: string): boolean {
  const campos = camposCron(cron);
  if (campos === null) {
    return false;
  }
  try {
    CronExpressionParser.parse(campos.join(' '), { tz: zona }).next();
    return true;
  } catch {
    return false;
  }
}

// ---- the due window (DEC-75, DEC-77) ------------------------------------------------

/**
 * Whether the automation's schedule fires inside the window `(desde, hasta]`, resolved in
 * the deployment's configured timezone `zona` (DEC-77), never UTC or host time.
 *
 * The lower edge is exclusive because the library returns the first fire strictly after
 * `desde`; the upper edge is inclusive so a fire exactly at the tick is due. The caller
 * passes `desde = max(window start, creadaEn)`, so an automation never fires for an
 * instant before it existed. At most one verdict comes out per window, however many
 * fires it spans: catch-up and overlap handling belong to CH-17.
 *
 * A stored expression that is not standard cron is corruption — creation refuses it —
 * so it fails closed with a throw, which the scheduler records as `error-interno`, rather
 * than being read partially or treated as never due.
 */
export function estaVencida(cron: string, desde: Date, hasta: Date, zona: string): boolean {
  const campos = camposCron(cron);
  if (campos === null) {
    throw new Error('estaVencida: horario almacenado fuera de cron estándar');
  }
  if (hasta.getTime() <= desde.getTime()) {
    return false;
  }
  const siguiente = CronExpressionParser.parse(campos.join(' '), { currentDate: desde, tz: zona })
    .next()
    .toDate();
  return siguiente.getTime() <= hasta.getTime();
}
