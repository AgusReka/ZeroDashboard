import { validarClaveMaestra } from './cripto-credencial.js';

/**
 * Everything the application reads from the environment — with one deliberate
 * exception. The credential master key is **not** here and never will be: it is
 * validated at boot by `validarClaveMaestra()` below, which returns nothing, and the
 * derived key stays inside `cripto-credencial.ts`. A key on this object would be one
 * `log.info(config)` away from a log line (regla 7).
 */
interface AppConfig {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
  connectionTestTimeoutMs: number;
  queryTimeoutMs: number;
  maxFilasPorConsulta: number;
  zonaHoraria: string;
  smtpTimeoutMs: number;
  connectionRetryAttempts: number;
  connectionRetryPauseMs: number;
}

/** Used when CONNECTION_TEST_TIMEOUT_MS is not set. */
export const DEFAULT_CONNECTION_TEST_TIMEOUT_MS = 5000;

/**
 * Used when QUERY_TIMEOUT_MS is not set. Bounds the runtime of one query
 * execution attempt, which is a different budget from the connection-attempt
 * one above: a query can be slow on a target that connects instantly.
 */
export const DEFAULT_QUERY_TIMEOUT_MS = 15000;

/**
 * Used when MAX_FILAS_CONSULTA is not set. The ceiling on how many rows one execution
 * may return, applied uniformly to every `Conexion` and every tenant (DEC-19).
 *
 * 200 is not a new number: it is the `maximum: 200` that `ejecucionSchema` hard-coded
 * until CH-07. Keeping it as the default means an untouched deployment behaves exactly
 * as it did; what CH-07 changes is that the number can now be moved without editing
 * source, and that an execution the ceiling actually cut says so (DEC-18).
 */
export const DEFAULT_MAX_FILAS_CONSULTA = 200;

/**
 * Used when ZONA_HORARIA_AUTOMATIZACIONES is not set. The single, deployment-wide IANA
 * timezone in which every automation's cron schedule is interpreted (DEC-77). There is
 * no per-tenant or per-automation zone; changing it is a restart, not a source edit.
 */
export const DEFAULT_ZONA_HORARIA = 'UTC';

/**
 * Used when SMTP_TIMEOUT_MS is not set. Bounds one email send (R2 under DEC-19): the
 * scheduler's tick is sequential, so a hung SMTP server must not hold it for longer
 * than this. It is the only SMTP setting on `AppConfig`: the connection settings
 * (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, ...) are read by the notifier alone, for
 * the same reason the master key is not here.
 */
export const DEFAULT_SMTP_TIMEOUT_MS = 10000;

/**
 * Used when CONNECTION_RETRY_ATTEMPTS is not set. The total number of connection attempts
 * one scheduled run makes when the failure is transient (X5, DEC-97/DEC-98): the first
 * attempt plus up to two retries. `1` turns retry off.
 */
export const DEFAULT_CONNECTION_RETRY_ATTEMPTS = 3;

/**
 * The highest CONNECTION_RETRY_ATTEMPTS accepted (DEC-105). The scheduler's tick is
 * serial, so every attempt against a dead target holds it for a connection timeout plus a
 * pause; a larger value is refused at boot instead of silently blocking the tick. Moving
 * this ceiling is a source change on purpose.
 */
export const MAX_CONNECTION_RETRY_ATTEMPTS = 5;

/** Used when CONNECTION_RETRY_PAUSE_MS is not set. The fixed pause between attempts. */
export const DEFAULT_CONNECTION_RETRY_PAUSE_MS = 5000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Reads an optional positive integer from the environment. An unset or empty variable
 * falls back to the default; anything present but not a positive integer is a
 * configuration error, not a silent fallback.
 *
 * It was `presupuestoOpcionalMs` until CH-07 and read only millisecond budgets. The
 * row cap (DEC-19) needs exactly the same parse and exactly the same refusal, and a
 * second copy would be a second place for the "0 is not a budget" rule to drift.
 */
function enteroPositivoOpcional(name: string, porDefecto: number): number {
  const valor = process.env[name];
  if (valor === undefined || valor === '') {
    return porDefecto;
  }
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    // The variable is named, its value is not (DEC-86 addendum): an error message is a
    // log line, and the same parse now reads a budget that sits next to SMTP secrets.
    throw new Error(`${name} must be a positive integer`);
  }
  return numero;
}

/**
 * Reads an optional integer from 1 to `maximo`: the same parse and refusal as
 * `enteroPositivoOpcional`, plus an upper bound (DEC-105). Like that one, the error names
 * the variable and the allowed range, never the value.
 */
function enteroEnRangoOpcional(name: string, porDefecto: number, maximo: number): number {
  const numero = enteroPositivoOpcional(name, porDefecto);
  if (numero > maximo) {
    throw new Error(`${name} must be an integer between 1 and ${maximo}`);
  }
  return numero;
}

/**
 * Reads the automation timezone. Unset or empty falls back to the default, like the
 * budgets above; a value the runtime does not recognise as a timezone stops the boot
 * (fail closed, as DEC-17 does for the master key), because a typo here would silently
 * shift every automation's fire time. `Intl.DateTimeFormat` is the check, so this adds
 * no dependency.
 */
function zonaHorariaOpcional(name: string, porDefecto: string): string {
  const valor = process.env[name];
  if (valor === undefined || valor === '') {
    return porDefecto;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: valor });
  } catch {
    throw new Error(`${name} must be a valid IANA timezone, got: ${valor}`);
  }
  return valor;
}

export function loadConfig(): AppConfig {
  const portValue = required('APP_PORT');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`APP_PORT must be a positive integer, got: ${portValue}`);
  }

  // Fail-closed master key (DEC-17). This call is the whole boot check: `src/server.ts`
  // already invokes `loadConfig()` on its first line, before `listen`, so an absent,
  // malformed or wrong-length key stops the process before any request is accepted —
  // instead of surfacing later, in production, the first time a connection is dialled.
  // It returns nothing on purpose; the key never leaves `cripto-credencial.ts`.
  validarClaveMaestra();

  const connectionTestTimeoutMs = enteroPositivoOpcional(
    'CONNECTION_TEST_TIMEOUT_MS',
    DEFAULT_CONNECTION_TEST_TIMEOUT_MS,
  );
  const queryTimeoutMs = enteroPositivoOpcional('QUERY_TIMEOUT_MS', DEFAULT_QUERY_TIMEOUT_MS);
  const maxFilasPorConsulta = enteroPositivoOpcional(
    'MAX_FILAS_CONSULTA',
    DEFAULT_MAX_FILAS_CONSULTA,
  );
  const zonaHoraria = zonaHorariaOpcional('ZONA_HORARIA_AUTOMATIZACIONES', DEFAULT_ZONA_HORARIA);
  const smtpTimeoutMs = enteroPositivoOpcional('SMTP_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUT_MS);
  const connectionRetryAttempts = enteroEnRangoOpcional(
    'CONNECTION_RETRY_ATTEMPTS',
    DEFAULT_CONNECTION_RETRY_ATTEMPTS,
    MAX_CONNECTION_RETRY_ATTEMPTS,
  );
  const connectionRetryPauseMs = enteroPositivoOpcional(
    'CONNECTION_RETRY_PAUSE_MS',
    DEFAULT_CONNECTION_RETRY_PAUSE_MS,
  );

  return {
    port,
    databaseUrl: required('DATABASE_URL'),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    connectionTestTimeoutMs,
    queryTimeoutMs,
    maxFilasPorConsulta,
    zonaHoraria,
    smtpTimeoutMs,
    connectionRetryAttempts,
    connectionRetryPauseMs,
  };
}
