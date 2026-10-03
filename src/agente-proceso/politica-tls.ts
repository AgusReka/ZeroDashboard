import { ErrorConfig } from './config.js';
import { LIMITES_AGENTE } from './limites.js';

/**
 * CH-19c2 (DEC-113, DEC-123 A6): the URL and TLS rule of the agent. `wss:` is accepted on
 * any host; `ws:` only on loopback. The URL is checked before any WebSocket exists,
 * because `ws` repeats the URL in its own errors. Nothing here reads an environment
 * variable, so `NODE_TLS_REJECT_UNAUTHORIZED` cannot weaken the explicit option.
 */
const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** `hostname` as the WHATWG parser leaves it: lowercase, IPv4 canonical, IPv6 bracketed. */
function esLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || IPV4_LOOPBACK.test(hostname);
}

/**
 * Returns the server origin, or throws `ErrorConfig('AGENT_SERVER_URL')`. Refuses any
 * scheme other than `wss:` and loopback `ws:`, userinfo (any `@`), any `#`, any `?`, and a
 * path other than `/`. The parser's own error is dropped: its message repeats the input.
 */
export function validarUrlServidor(texto: string): URL {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new ErrorConfig('AGENT_SERVER_URL');
  }
  const esquema = url.protocol === 'wss:' || (url.protocol === 'ws:' && esLoopback(url.hostname));
  const soloOrigen = !/[@#?]/.test(texto) && url.username === '' && url.password === '' && url.pathname === '/';
  if (!esquema || !soloOrigen) throw new ErrorConfig('AGENT_SERVER_URL');
  return url;
}

/** The six client options; structurally a `ws` `ClientOptions`. */
export type OpcionesSocket = {
  headers: { authorization: string };
  maxPayload: number;
  perMessageDeflate: false;
  rejectUnauthorized: true;
  followRedirects: false;
  handshakeTimeout: number;
};

/** Options for every agent socket, control (4 KiB) and data (1 MiB) alike. */
export function opcionesSocket(token: string, maxPayload: number): OpcionesSocket {
  return {
    headers: { authorization: `Bearer ${token}` },
    maxPayload,
    perMessageDeflate: false,
    rejectUnauthorized: true,
    followRedirects: false,
    handshakeTimeout: LIMITES_AGENTE.handshakeMs,
  };
}
