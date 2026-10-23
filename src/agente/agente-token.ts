import { createHash, randomBytes } from 'node:crypto';

/**
 * CH-19b (DEC-115, DEC-121): the agent token and its stored form.
 *
 * The token is shown to the operator once and never stored or logged; only its SHA-256
 * hex digest is written to `Agente.tokenHash`, and the lookup takes that digest, never
 * the token. A plain hash is enough here because the token carries 256 random bits: it
 * is not a password a dictionary could guess. The runtime values live in this module,
 * not in `agente-protocolo.ts`, which stays types-only (DEC-120); 19c1 imports
 * `hashTokenAgente` from here.
 */
const PREFIJO_TOKEN = 'zda_';

/** `zda_` followed by 32 random bytes encoded base64url (43 characters, no padding). */
export function generarTokenAgente(): string {
  return PREFIJO_TOKEN + randomBytes(32).toString('base64url');
}

/** The SHA-256 hex digest of a token: the only form of it the database ever holds. */
export function hashTokenAgente(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
