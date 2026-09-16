interface AppConfig {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
  connectionTestTimeoutMs: number;
  queryTimeoutMs: number;
}

/** Used when CONNECTION_TEST_TIMEOUT_MS is not set. */
export const DEFAULT_CONNECTION_TEST_TIMEOUT_MS = 5000;

/**
 * Used when QUERY_TIMEOUT_MS is not set. Bounds the runtime of one query
 * execution attempt, which is a different budget from the connection-attempt
 * one above: a query can be slow on a target that connects instantly.
 */
export const DEFAULT_QUERY_TIMEOUT_MS = 15000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Reads an optional positive-integer millisecond budget from the environment.
 * An unset or empty variable falls back to the default; anything present but
 * not a positive integer is a configuration error, not a silent fallback.
 */
function presupuestoOpcionalMs(name: string, porDefecto: number): number {
  const valor = process.env[name];
  if (valor === undefined || valor === '') {
    return porDefecto;
  }
  const ms = Number(valor);
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${valor}`);
  }
  return ms;
}

export function loadConfig(): AppConfig {
  const portValue = required('APP_PORT');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`APP_PORT must be a positive integer, got: ${portValue}`);
  }

  const connectionTestTimeoutMs = presupuestoOpcionalMs(
    'CONNECTION_TEST_TIMEOUT_MS',
    DEFAULT_CONNECTION_TEST_TIMEOUT_MS,
  );
  const queryTimeoutMs = presupuestoOpcionalMs('QUERY_TIMEOUT_MS', DEFAULT_QUERY_TIMEOUT_MS);

  return {
    port,
    databaseUrl: required('DATABASE_URL'),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    connectionTestTimeoutMs,
    queryTimeoutMs,
  };
}
