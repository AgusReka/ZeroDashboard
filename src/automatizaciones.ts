import { CronExpressionParser } from 'cron-parser';
import type {
  CorteEjecucion,
  EjecucionFallida,
  FaseEjecucion,
  ResultadoEjecucion,
} from './consulta-ejecucion.js';
import { CONTRATO_CANONICO } from './contrato.js';
import { codigoPublicable } from './pg-error.js';
import type { EstadoNoAprobado } from './plantillas.js';

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

// ---- closing a run (X2) -------------------------------------------------------------

/** Why a run stopped before anything was dialed. Nothing reached the tenant connection. */
export type CategoriaPreparacion =
  | 'vista-canonica-no-aprobada'
  | 'valores-invalidos'
  | 'conexion-no-encontrada'
  | 'credencial-ilegible';

/**
 * A pre-dial refusal. The DEC-71 gate refusal carries the entities it did not approve,
 * in the shape `evaluarVistas` returns them; every other refusal carries nothing.
 */
export type RechazoPreparacion =
  | {
      resultado: 'rechazo';
      categoria: 'vista-canonica-no-aprobada';
      entidades: readonly { entidad: string; estado: EstadoNoAprobado }[];
    }
  | {
      resultado: 'rechazo';
      categoria: Exclude<CategoriaPreparacion, 'vista-canonica-no-aprobada'>;
    };

/**
 * A throw nobody classified. The thrown value is carried only so the caller has one
 * shape to hand in; this module never reads it — not its message, stack, or code.
 */
export interface FalloInesperado {
  resultado: 'excepcion';
  error: unknown;
}

/** Every way a scheduled run can end: the execution verdict, or a stop before it. */
export type ResultadoCorrida = ResultadoEjecucion | RechazoPreparacion | FalloInesperado;

/** `Ejecucion.fase`: a pre-dial stop, or the phase `ejecutarConsulta` reports. */
export type FaseCierre = 'preparacion' | FaseEjecucion;

/** `Ejecucion.error`: a closed category, never driver or thrown text. */
export type CategoriaCierre =
  | CategoriaPreparacion
  | EjecucionFallida['categoria']
  | 'error-interno';

/**
 * The outcome columns of one `Ejecucion` row. Timestamps and duration are not here: the
 * scheduler takes them from its injected clock, so tests control time.
 *
 * `codigoError` is the publishable detail of `error`: the SQLSTATE or Node code for an
 * execution failure (re-gated by `codigoPublicable`), or the comma-joined names of the
 * ungated entities for a DEC-71 refusal, taken only from the closed canonical contract.
 * Neither can carry free text.
 */
export type CierreEjecucion =
  | {
      estado: 'ok';
      filas: number;
      corte: CorteEjecucion | null;
      fase: 'ejecucion';
      error: null;
      codigoError: null;
    }
  | {
      estado: 'fallo';
      filas: null;
      corte: null;
      fase: FaseCierre | null;
      error: CategoriaCierre;
      codigoError: string | null;
    };

/** The closed contract's entity names: the only text a gate refusal can record. */
const NOMBRES_CONTRATO: ReadonlySet<string> = new Set(CONTRATO_CANONICO.map((e) => e.nombre));

/**
 * Maps a run's outcome to its `Ejecucion` columns (X2). Every branch builds a fresh value
 * from named fields and never spreads its input, so a stray `message`, `stack`, or any
 * other property on the value handed in cannot reach the row. The rows a successful run
 * read are reduced to their count (minimization, D-1 leaning) and then dropped.
 */
export function cierreDeResultado(r: ResultadoCorrida): CierreEjecucion {
  switch (r.resultado) {
    case 'ok':
      return {
        estado: 'ok',
        filas: r.filas.length,
        corte: r.corte,
        fase: 'ejecucion',
        error: null,
        codigoError: null,
      };
    case 'fallo':
      return {
        estado: 'fallo',
        filas: null,
        corte: null,
        fase: r.fase,
        error: r.categoria,
        codigoError: codigoPublicable(r.codigo),
      };
    case 'rechazo': {
      const nombres =
        r.categoria === 'vista-canonica-no-aprobada'
          ? r.entidades.map((e) => e.entidad).filter((nombre) => NOMBRES_CONTRATO.has(nombre))
          : [];
      return {
        estado: 'fallo',
        filas: null,
        corte: null,
        fase: 'preparacion',
        error: r.categoria,
        codigoError: nombres.length > 0 ? nombres.join(',') : null,
      };
    }
    case 'excepcion':
      // The phase is unknown: the throw may come from any step, including the row writes.
      return {
        estado: 'fallo',
        filas: null,
        corte: null,
        fase: null,
        error: 'error-interno',
        codigoError: null,
      };
  }
}

// ---- notifying a run (CH-14: X3, N1; DEC-83, DEC-84, DEC-86) --------------------------

/** `Ejecucion.notificacion`: the outcome only, never a body, recipient, or row content. */
export type EstadoNotificacion =
  | 'enviada'
  | 'omitida-sin-filas'
  | 'fallo-envio'
  | 'sin-destinatario'
  | 'no-configurada';

/** The outcomes that end the notify step before any send is attempted. */
export type OmisionNotificacion = Extract<
  EstadoNotificacion,
  'omitida-sin-filas' | 'sin-destinatario' | 'no-configurada'
>;

/**
 * Whether the notify step sends, and to whom. `notificacion: null` means the query did
 * not succeed, so no notification applies (precedence row 1).
 */
export type DecisionNotificacion =
  | { enviar: false; notificacion: OmisionNotificacion | null }
  | { enviar: true; para: string };

/**
 * Evaluates the outcome precedence in order; the first condition that holds wins
 * (design "Outcome precedence"). `configurado` is whether a `Notificador` exists, which
 * is exactly whether `SMTP_HOST` is set. A missing recipient wins over unset SMTP because
 * it is the more specific reason the operator can fix. Zero rows never send (DEC-84).
 */
export function decidirNotificacion(
  r: ResultadoCorrida,
  destinatario: string | null,
  configurado: boolean,
): DecisionNotificacion {
  if (r.resultado !== 'ok') {
    return { enviar: false, notificacion: null };
  }
  if (r.filas.length === 0) {
    return { enviar: false, notificacion: 'omitida-sin-filas' };
  }
  if (destinatario === null) {
    return { enviar: false, notificacion: 'sin-destinatario' };
  }
  if (!configurado) {
    return { enviar: false, notificacion: 'no-configurada' };
  }
  return { enviar: true, para: destinatario };
}
