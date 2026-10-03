import { leerDestinos, type ListaDestinos } from './destinos.js';
import { FORMATO_TOKEN } from './limites.js';
import { validarUrlServidor } from './politica-tls.js';

/**
 * CH-19c2 (DEC-120, DEC-123): the agent's own configuration. It reads exactly three
 * variables and never the engine's `loadConfig`, so the customer's host needs no engine
 * secret. Every limit is a constant (`limites.ts`); nothing here can disable TLS.
 */
export type VariableAgente = 'AGENT_SERVER_URL' | 'AGENT_TOKEN' | 'AGENT_ALLOWED_TARGETS';

/** Fixed text per variable. A message never carries a value, not even part of one (rule 7). */
const REGLA: Readonly<Record<VariableAgente, string>> = {
  AGENT_SERVER_URL: 'must be an origin: wss://host[:port], or ws:// only on localhost, 127.x.x.x or [::1]; no userinfo, path, query or fragment',
  AGENT_TOKEN: 'must be the zda_ token issued by POST /agentes',
  AGENT_ALLOWED_TARGETS: 'must be a comma-separated list of exact host:port entries (DNS name, IPv4 or [IPv6]; port from 1 to 65535; no wildcards, CIDR or ranges)',
};

/** A configuration error: names the variable and, for an allowlist entry, its 1-based index. */
export class ErrorConfig extends Error {
  readonly variable: VariableAgente;
  constructor(variable: VariableAgente, detalle: { ausente?: boolean; entrada?: number } = {}) {
    const donde = detalle.entrada === undefined ? variable : `${variable}: entry ${detalle.entrada}`;
    super(detalle.ausente ? `${variable} is missing or empty` : `${donde} is invalid; ${REGLA[variable]}`);
    this.name = 'ErrorConfig';
    this.variable = variable;
  }
}

export interface ConfigAgente {
  /** The validated origin (`validarUrlServidor`). */
  readonly servidor: URL;
  /** A secret: never logged, only sent in the `Authorization` header. */
  readonly token: string;
  readonly destinos: ListaDestinos;
}

/** Throws `ErrorConfig` on the first missing, empty or invalid variable. */
export function leerConfig(env: Readonly<Record<string, string | undefined>>): ConfigAgente {
  const leer = (variable: VariableAgente): string => {
    const valor = env[variable];
    if (valor === undefined || valor === '') throw new ErrorConfig(variable, { ausente: true });
    return valor;
  };
  const servidor = validarUrlServidor(leer('AGENT_SERVER_URL'));
  const token = leer('AGENT_TOKEN');
  if (!FORMATO_TOKEN.test(token)) throw new ErrorConfig('AGENT_TOKEN');
  return { servidor, token, destinos: leerDestinos(leer('AGENT_ALLOWED_TARGETS')) };
}
