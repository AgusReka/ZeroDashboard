import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Credential encryption at rest (A2, DEC-16 and DEC-17).
 *
 * AES-256-GCM through Node's built-in `node:crypto`, a fresh random IV per encipher
 * call, and a versioned authenticated envelope `v1:iv:tag:ciphertext` with every
 * component base64-encoded. GCM is authenticated (AEAD): a tampered ciphertext, IV or
 * tag fails to open rather than decrypting into something the application would then
 * hand to a database as a password.
 *
 * **Nothing here ever returns, logs or embeds key material or plaintext (regla 7).**
 * The derived key Buffer lives in this module's scope, is never exported, and never
 * reaches `AppConfig`; `validarClaveMaestra()` exists precisely so the boot check can
 * assert the key is usable *without* being handed it. Every failure to open an
 * envelope collapses into one constant-message `ErrorCredencialIlegible` with no
 * `cause`, so the underlying GCM error — and any partial plaintext the driver produced
 * before authentication failed — is discarded here and never escapes.
 */

/** The one environment variable that carries the deployment's master key (DEC-17). */
export const VARIABLE_CLAVE_MAESTRA = 'CREDENTIAL_MASTER_KEY';

/** The only envelope version this build writes, and the only one it reads. */
const VERSION_SOBRE = 'v1';

/** AES-256: the key is exactly 32 bytes, no stretching and no truncation. */
const LONGITUD_CLAVE = 32;

/**
 * 96 bits, the IV length GCM is specified for. A different length is accepted by the
 * cipher but weakens the construction, so it is pinned rather than inferred.
 */
const LONGITUD_IV = 12;

/** Full-length GCM authentication tag, 128 bits. */
const LONGITUD_TAG = 16;

/**
 * Raised when a stored value cannot be opened: wrong version, malformed envelope,
 * tampered components, or a row written before CH-07 that still holds plaintext
 * (DEC-20). The message is a fixed constant and carries nothing derived from the
 * input — the routes map this to `409 credencial-ilegible`.
 */
export class ErrorCredencialIlegible extends Error {
  constructor() {
    super('the stored credential could not be deciphered');
    this.name = 'ErrorCredencialIlegible';
  }
}

/**
 * The derived key, cached for the hot path and **keyed by the raw environment value**.
 *
 * The key matters: a plain one-shot cache would keep serving a key the environment no
 * longer names, which is exactly how a rotated or corrected key gets silently ignored.
 * Comparing the raw string makes a changed variable recompute on the next call.
 */
let claveCacheada: { crudo: string; clave: Buffer } | null = null;

/**
 * Decodes and validates the master key, or throws a configuration error.
 *
 * Base64 is verified by re-encoding rather than by a character class: `Buffer.from`
 * silently *ignores* characters outside the alphabet, so `Buffer.from(x, 'base64')`
 * alone would accept `no-es-base64-***` and hand back a short buffer. Requiring the
 * decoded bytes to re-encode to the exact input is the check that actually holds.
 */
function claveMaestra(): Buffer {
  const crudo = process.env[VARIABLE_CLAVE_MAESTRA];
  if (crudo === undefined || crudo === '') {
    throw new Error(
      `Missing required environment variable: ${VARIABLE_CLAVE_MAESTRA}. ` +
        'The process refuses to start without a master key for credential encryption.',
    );
  }

  if (claveCacheada !== null && claveCacheada.crudo === crudo) {
    return claveCacheada.clave;
  }

  const clave = Buffer.from(crudo, 'base64');
  if (clave.toString('base64') !== crudo) {
    // The offending value is never quoted back: it is key material (regla 7).
    throw new Error(`${VARIABLE_CLAVE_MAESTRA} must be a valid base64 value.`);
  }
  if (clave.length !== LONGITUD_CLAVE) {
    throw new Error(
      `${VARIABLE_CLAVE_MAESTRA} must decode to exactly ${LONGITUD_CLAVE} bytes ` +
        `(AES-256), got ${clave.length}.`,
    );
  }

  claveCacheada = { crudo, clave };
  return clave;
}

/**
 * Boot check for `loadConfig()` (DEC-17, fail-closed). Throws exactly as the encipher
 * path would, and deliberately returns `void`: the caller gets a verdict, never the
 * key, so no key material can end up on `AppConfig` or in a startup log line.
 */
export function validarClaveMaestra(): void {
  claveMaestra();
}

/**
 * Enciphers one credential into a `v1:iv:tag:ciphertext` envelope.
 *
 * Called on the single write path (`POST /conexiones`) before the row reaches the
 * application's own database, so no plaintext credential is ever persisted.
 */
export function cifrarCredencial(plano: string): string {
  const clave = claveMaestra();
  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv('aes-256-gcm', clave, iv);
  const cifrado = Buffer.concat([cifrador.update(plano, 'utf8'), cifrador.final()]);

  return [
    VERSION_SOBRE,
    iv.toString('base64'),
    cifrador.getAuthTag().toString('base64'),
    cifrado.toString('base64'),
  ].join(':');
}

/**
 * Opens an envelope, in memory, for the caller that is about to dial a target.
 *
 * Every rejection path lands on the same `ErrorCredencialIlegible`: an operator cannot
 * tell a tampered tag from a legacy plaintext row from a wrong key by reading the
 * error, which is the point — the distinctions would all be statements about key
 * material. Only `descifrarCredencial`'s caller knows which row failed.
 */
export function descifrarCredencial(sobre: string): string {
  const clave = claveMaestra();

  const partes = sobre.split(':');
  if (partes.length !== 4 || partes[0] !== VERSION_SOBRE) {
    throw new ErrorCredencialIlegible();
  }

  try {
    const iv = Buffer.from(partes[1], 'base64');
    const tag = Buffer.from(partes[2], 'base64');
    const cifrado = Buffer.from(partes[3], 'base64');
    if (iv.length !== LONGITUD_IV || tag.length !== LONGITUD_TAG) {
      throw new ErrorCredencialIlegible();
    }

    const descifrador = createDecipheriv('aes-256-gcm', clave, iv);
    descifrador.setAuthTag(tag);
    // `final()` is what verifies the tag. Its output is only returned once that check
    // has passed, so an unauthenticated partial plaintext never leaves this block.
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString('utf8');
  } catch {
    // The original error is dropped rather than chained: it is the only value in scope
    // that could carry anything derived from the envelope (regla 7).
    throw new ErrorCredencialIlegible();
  }
}
