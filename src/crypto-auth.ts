import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Client-panel credential hashing and session tokens (CH-22a, DEC-133 and DEC-134).
 *
 * `node:crypto` all the way down: `scrypt` derives the stored key from a password and
 * a per-user random salt, and nothing here adds a native-compiled dependency to the
 * build or the container (DEC-133's stated reason for choosing the runtime's own KDF
 * over bcrypt/argon2). This module is pure — no database, no request, no clock — which
 * is what lets `src/crypto-auth.test.ts` pin every claim about it without a server.
 *
 * **Nothing here ever returns, logs or embeds the plaintext password** (regla 5's
 * minimization applied to credentials): `hashearClave` yields only the versioned
 * `s1:salt:key` envelope, and `verificarClave` yields a boolean — never the derived
 * key, never a reason more specific than `false` for a caller to act on.
 */

/** The one envelope version this build writes, and the only one it reads. */
const VERSION_HASH = 's1';

/** 128 bits of salt per user, fresh on every hash — the point of the `s1` format. */
const LONGITUD_SALT = 16;

/** scrypt's derived-key length in bytes (DEC-133: `crypto.scrypt(clave, salt, 64)`). */
const LONGITUD_CLAVE = 64;

/** 256 bits of session token entropy (DEC-134). */
const LONGITUD_TOKEN = 32;

/**
 * One async scrypt derivation, callback-wrapped rather than called synchronously:
 * the KDF's work factors keep it off the event loop's synchronous path (the
 * proposal's stated risk mitigation), and the wrapper gives the promise its `Buffer`
 * type where `promisify(scrypt)`'s overloads infer only `unknown`.
 */
function derivarClave(clavePlana: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(clavePlana, salt, LONGITUD_CLAVE, (error, clave) => {
      if (error !== null) {
        rechazar(error);
        return;
      }
      resolver(clave);
    });
  });
}

function hexInvalido(valor: string, longitud: number): boolean {
  return valor.length !== longitud || !/^[0-9a-f]+$/.test(valor);
}

/**
 * Hashes a password into `s1:<saltHex>:<keyHex>`.
 *
 * A fresh 16-byte salt is drawn per call, so two users (or two hashes of the same
 * user) never share one — the property `src/crypto-auth.test.ts` proves by hashing
 * the same password twice. The derivation runs asynchronously through `derivarClave`
 * so the KDF never blocks the event loop (the proposal's stated risk mitigation).
 */
export async function hashearClave(clavePlana: string): Promise<string> {
  const salt = randomBytes(LONGITUD_SALT);
  const clave = await derivarClave(clavePlana, salt);
  return `${VERSION_HASH}:${salt.toString('hex')}:${clave.toString('hex')}`;
}

/**
 * Verifies a password against a stored hash. **`false` is the only failure**: a
 * malformed stored value (wrong version, wrong shape, non-hex, wrong length) fails
 * closed exactly like a wrong password, so the login route can map every refusal to
 * one generic `401 correo o clave incorrectos` and an attacker learns nothing about
 * which rows are well-formed (spec: "fail closed with a generic authentication error").
 *
 * The comparison is `timingSafeEqual` on two buffers that are equal in length by
 * construction (both validated to `LONGITUD_CLAVE` bytes before the call), so it
 * cannot throw on a length mismatch and cannot short-circuit on a prefix.
 */
export async function verificarClave(clavePlana: string, hashAlmacenado: string): Promise<boolean> {
  const partes = hashAlmacenado.split(':');
  if (partes.length !== 3 || partes[0] !== VERSION_HASH) {
    return false;
  }

  const [, saltHex, claveHex] = partes;
  // Rejected by shape before any decoding: `Buffer.from(x, 'hex')` silently *drops*
  // invalid characters, so a length check on the decoded buffer alone would accept
  // `Buffer.from('zz…', 'hex')` as a shorter salt and derive from the wrong bytes.
  if (hexInvalido(saltHex, LONGITUD_SALT * 2) || hexInvalido(claveHex, LONGITUD_CLAVE * 2)) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const esperada = Buffer.from(claveHex, 'hex');
  const derivada = await derivarClave(clavePlana, salt);
  return timingSafeEqual(derivada, esperada);
}

/**
 * A fresh panel session token (DEC-134): 256 random bits for the `HttpOnly` cookie,
 * and the SHA-256 hex of them — the only form that reaches `SesionPanel.tokenHash`.
 *
 * Same construction as the agent token (`src/agente-token.ts`): a plain hash is enough
 * because the token carries 256 random bits and is not a password a dictionary could
 * guess. The raw token never touches the database, so a leaked row cannot be replayed.
 */
export function generarTokenSesion(): { tokenPlano: string; tokenHash: string } {
  const tokenPlano = randomBytes(LONGITUD_TOKEN).toString('base64url');
  const tokenHash = createHash('sha256').update(tokenPlano).digest('hex');
  return { tokenPlano, tokenHash };
}
