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
    throw new Error(`${name} must be a positive integer, got: ${valor}`);
  }
  return numero;
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

  return {
    port,
    databaseUrl: required('DATABASE_URL'),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    connectionTestTimeoutMs,
    queryTimeoutMs,
    maxFilasPorConsulta,
  };
}
