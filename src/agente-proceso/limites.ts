/**
 * CH-19c2 (DEC-122, DEC-123): the agent's limits, timings and formats. They are constants,
 * never environment variables. The agent cannot import engine code (DEC-123 A2), so the
 * values the engine also fixes are duplicated here, and `paridad.test.ts` compares them
 * with the engine's own constants.
 */
export const LIMITES_AGENTE = {
  /** Largest data frame, both ways (engine: `LIMITE_TRAMA_DATOS`). */
  tramaDatos: 1 << 20,
  /** Largest control message (engine: `LIMITES.tramaControl`). */
  tramaControl: 4096,
  /** Concurrent sessions; above the engine's 8 per agent, so the engine's cap binds first. */
  sesiones: 16,
  /** Reconnect delay bounds, equal jitter. */
  esperaMinMs: 1_000,
  esperaMaxMs: 60_000,
  /** A control socket open this long resets the reconnect attempt counter. */
  controlEstableMs: 30_000,
  /** A socket with no engine ping for this long is terminated (engine pings every 20 s). */
  vigilanciaPingMs: 50_000,
  /** Replica TCP connect timeout (`ETIMEDOUT`). */
  replicaMs: 10_000,
  /** WebSocket opening handshake timeout. */
  handshakeMs: 10_000,
  /** Upper bound of the orderly shutdown. */
  apagadoMs: 5_000,
} as const;

/** The token issued by the engine: `zda_` plus 32 random bytes in base64url (DEC-121). */
export const FORMATO_TOKEN = /^zda_[A-Za-z0-9_-]{43}$/;

/** A session id: 16 random bytes in base64url (DEC-122). Checked before it enters any URL. */
export const FORMATO_SESION = /^[A-Za-z0-9_-]{22}$/;
