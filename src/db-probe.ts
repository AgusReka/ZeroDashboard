import pg from 'pg';
import { loadConfig } from './config.js';
import { codigoPublicable, leerCodigoCrudo } from './pg-error.js';

/**
 * Connectivity failure categories returned by a connection test.
 * Mirrors the classification table in the CH-03 design.
 */
export type CategoriaFallo =
  | 'tiempo-agotado'
  | 'host-inalcanzable'
  | 'dns-no-resuelve'
  | 'credenciales-invalidas'
  | 'base-inexistente'
  | 'error-desconocido';

/** Sanitized classification of a raw driver/network error. */
export interface ClasificacionFallo {
  categoria: CategoriaFallo;
  codigo: string | null;
}

/**
 * Discrete connection fields for one attempt against a target. A connection string
 * is never composed: a composed URL surfaces the credential in a parse error when
 * the password contains `:`, `?` or `#`.
 */
export interface DestinoPostgres {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** Discrete connection fields for one probe attempt. */
export interface ProbeTarget extends DestinoPostgres {
  /** Defaults to `loadConfig().connectionTestTimeoutMs`. */
  timeoutMs?: number;
}

/** The only value that crosses the probe boundary. The raw error never does. */
export interface ProbeResult {
  resultado: 'ok' | 'fallo';
  categoria: CategoriaFallo | null;
  codigo: string | null;
  duracionMs: number;
}

/** Any SQLSTATE class 08 (connection exception). */
const SQLSTATE_CLASS_08_PATTERN = /^08[0-9A-Z]{3}$/;

const CODIGOS_HOST_INALCANZABLE = new Set([
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ECONNRESET',
]);
const CODIGOS_DNS = new Set(['ENOTFOUND', 'EAI_AGAIN']);
const CODIGOS_CREDENCIALES = new Set(['28P01', '28000']);

/**
 * Rejection value of a caller's own budget timer. It is shared with the execution
 * engine but never crosses either module's public boundary: it is the authoritative,
 * unambiguous answer to "did the attempt exhaust its budget?", which the driver's
 * error object cannot give (a `connectionTimeoutMillis` expiry carries no
 * machine-readable code).
 */
export const PRESUPUESTO_AGOTADO = Symbol('presupuesto-agotado');

/**
 * How far above the connect budget the driver's own `connectionTimeoutMillis` is set.
 * That timer is a backstop, not the mechanism: the caller's timer is the one that
 * decides, and the margin keeps the two from ever racing each other.
 */
const MARGEN_RESPALDO_MS = 500;

/** One connect attempt in flight, with the budget timer that guards it. */
export interface ConexionEnCurso {
  cliente: pg.Client;
  /**
   * Settles when the race is decided: resolves once connected, rejects with
   * `PRESUPUESTO_AGOTADO` when the budget timer won, or with the raw driver error.
   */
  conectado: Promise<unknown>;
  /** Clears the budget timer. Idempotent; call it once the race is decided. */
  cancelarTemporizador: () => void;
}

/**
 * Opens a client against the target and races `connect()` against the caller's own
 * timer. Whoever wins the race *is* the verdict — a won timer means the attempt
 * exhausted its budget, as a fact rather than as an inference drawn from comparing a
 * measured duration against the budget it was supposed to fit inside.
 *
 * Shared by `probeConnection` and the CH-04 execution engine. It is extracted rather
 * than copied on purpose: the CH-03 bitácora records two real defects in exactly this
 * logic (a clock-inferred timeout, and an `await client.end()` that never settles on a
 * still-connecting socket), and a second copy would need both fixes applied twice.
 */
export function iniciarConexion(destino: DestinoPostgres, timeoutMs: number): ConexionEnCurso {
  // `connectionTimeoutMillis` stays mandatory and explicit (the driver default is `0`,
  // i.e. wait forever) but sits a margin above the budget: it is the backstop that
  // tears the socket down, never the timer that classifies the attempt.
  const cliente = new pg.Client({
    host: destino.host,
    port: destino.port,
    database: destino.database,
    user: destino.user,
    password: destino.password,
    connectionTimeoutMillis: timeoutMs + MARGEN_RESPALDO_MS,
  });

  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencimiento = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(PRESUPUESTO_AGOTADO), timeoutMs);
  });

  return {
    cliente,
    conectado: Promise.race([cliente.connect(), vencimiento]),
    cancelarTemporizador: () => clearTimeout(temporizador),
  };
}

/**
 * Closes a client on every path and discards `end()`'s outcome unread, rather than
 * letting it escape as a raw driver error.
 *
 * It is *awaited* only when the driver had already settled (`esperar`). On a socket
 * that is still connecting, pg's graceful goodbye waits for a FIN that can never
 * arrive, so awaiting it would outlive the budget the caller exists to enforce; that
 * socket is reclaimed by the `connectionTimeoutMillis` backstop instead.
 */
export async function cerrarCliente(cliente: pg.Client, esperar: boolean): Promise<void> {
  const cierre = cliente.end().then(
    () => undefined,
    () => undefined,
  );
  if (esperar) {
    await cierre;
  }
}

/**
 * Classifies a connection failure into a sanitized `{ categoria, codigo }` summary.
 *
 * A pure function of the error alone: it reads no clock. Exhausting the probe budget
 * is not an error the driver reports, it is an outcome `probeConnection` observes by
 * winning a race, so that case is decided there and never inferred here. This function
 * only sees errors the driver actually produced.
 *
 * Node codes are checked before SQLSTATE because both live on `error.code` and the
 * pre-TCP set is a closed, known list.
 */
export function classifyConnectionError(error: unknown): ClasificacionFallo {
  const codigoCrudo = leerCodigoCrudo(error);
  const codigo = codigoPublicable(codigoCrudo);

  // 1. An explicit Node timeout reported by the socket layer. The budget-exhausted
  //    case does not reach here — see `probeConnection`.
  if (codigoCrudo === 'ETIMEDOUT') {
    return { categoria: 'tiempo-agotado', codigo };
  }

  // 2 and 4. Refused, unreachable, or reset before a session existed.
  if (codigoCrudo !== null && CODIGOS_HOST_INALCANZABLE.has(codigoCrudo)) {
    return { categoria: 'host-inalcanzable', codigo };
  }

  // 3. Name resolution failed. `EAI_AGAIN` carries an underscore, so it is classified
  //    here but published as `codigo: null` by the allowlist above.
  if (codigoCrudo !== null && CODIGOS_DNS.has(codigoCrudo)) {
    return { categoria: 'dns-no-resuelve', codigo };
  }

  // 5. SQLSTATE authentication failures.
  if (codigoCrudo !== null && CODIGOS_CREDENCIALES.has(codigoCrudo)) {
    return { categoria: 'credenciales-invalidas', codigo };
  }

  // 6. SQLSTATE invalid catalog name.
  if (codigoCrudo === '3D000') {
    return { categoria: 'base-inexistente', codigo };
  }

  // 7. Any SQLSTATE class 08 connection exception, and 8. everything else,
  //    including a non-`Error` throw.
  return { categoria: 'error-desconocido', codigo };
}

/**
 * Opens a short-lived PostgreSQL client against the target, runs one literal
 * parameterless probe statement, and returns a sanitized result. Never throws: the
 * raw driver error is contained here and never reaches the caller.
 *
 * The budget is enforced by racing the probe's own timer against `connect()`. Whoever
 * wins the race *is* the verdict — a won timer means the attempt exhausted its budget,
 * as a fact rather than as an inference drawn from comparing a measured duration
 * against the budget it was supposed to fit inside. `duracionMs` is reported, never
 * consulted.
 */
export async function probeConnection(target: ProbeTarget): Promise<ProbeResult> {
  const timeoutMs = target.timeoutMs ?? loadConfig().connectionTestTimeoutMs;
  const { cliente, conectado, cancelarTemporizador } = iniciarConexion(target, timeoutMs);

  let presupuestoAgotado = false;
  const iniciadoEn = Date.now();
  try {
    await conectado;
    // `connect()` won: the budget it guarded is spent, so the timer must not survive
    // into the query phase and fire behind an already-decided race.
    cancelarTemporizador();
    await cliente.query('SELECT 1');
    return {
      resultado: 'ok',
      categoria: null,
      codigo: null,
      duracionMs: Date.now() - iniciadoEn,
    };
  } catch (error) {
    const duracionMs = Date.now() - iniciadoEn;
    if (error === PRESUPUESTO_AGOTADO) {
      presupuestoAgotado = true;
      return { resultado: 'fallo', categoria: 'tiempo-agotado', codigo: null, duracionMs };
    }
    const { categoria, codigo } = classifyConnectionError(error);
    return { resultado: 'fallo', categoria, codigo, duracionMs };
  } finally {
    // Cleared on every path, so it can neither fire spuriously nor hold the process open.
    cancelarTemporizador();
    await cerrarCliente(cliente, !presupuestoAgotado);
  }
}
