/**
 * The agent protocol catalog (CH-19a). Types only, with zero imports, because the
 * outbound agent shares this file with the engine (DEC-120): nothing here may pull a
 * dependency or a runtime value into the agent.
 *
 * The catalog holds exactly what DEC-113, DEC-114, DEC-117 and DEC-118 fix. Tokens,
 * the session registry, agent states and failure categories belong to later slices,
 * and each one amends this file through its own delta.
 */

/**
 * The two kinds of channel the agent opens (DEC-113): one long-lived control channel,
 * and one data channel per database session. The data channel carries raw PostgreSQL
 * wire bytes and has no message type of its own.
 */
export type TipoCanal = 'control' | 'datos';

/**
 * Sent on the control channel to ask the agent for one data channel (DEC-113).
 *
 * It carries no database, user or credential: the login travels inside the relayed
 * startup bytes (DEC-112). It carries no tenant either (DEC-114): the agent's identity
 * already scopes it. `host` and `puerto` are the target as the agent sees it (DEC-115).
 */
export interface AperturaSesion {
  tipo: 'apertura-sesion';
  sesionId: string;
  host: string;
  puerto: number;
}

/** The control-channel heartbeat (DEC-118). Its timing is decided by a later slice. */
export interface Latido {
  tipo: 'latido';
}

/** Every message the control channel carries in this slice. */
export type MensajeControl = AperturaSesion | Latido;

/**
 * The closed set of replica-side errors the agent reports (DEC-117). They are the same
 * seven Node codes `classifyConnectionError` already classifies, so a data channel
 * destroyed with `{ code }` keeps today's failure categories and needs no new one.
 */
export type CodigoErrorAgente =
  | 'ECONNREFUSED'
  | 'EHOSTUNREACH'
  | 'ENETUNREACH'
  | 'ECONNRESET'
  | 'ENOTFOUND'
  | 'EAI_AGAIN'
  | 'ETIMEDOUT';
