import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { generarTokenSesion, hashearClave, verificarClave } from './crypto-auth.js';

/**
 * Unit cases for CH-22a tasks 1.1 (DEC-133, DEC-134). No database and no route: this
 * module is pure `node:crypto`, so every claim below is about the stored hash shape,
 * about what a failure is allowed to return, and about the session token — not about
 * an endpoint.
 *
 * The password itself never appears as a literal: every hash below is built in the run.
 */

/** Salt component of a well-formed `s1` hash: 16 bytes as 32 lowercase hex chars. */
const SALT_VÁLIDO = 'a'.repeat(32);
/** Key component of a well-formed `s1` hash: 64 bytes as 128 lowercase hex chars. */
const CLAVE_VÁLIDA = 'b'.repeat(128);

describe('hashearClave — scrypt with a fresh random salt (DEC-133)', () => {
  test('the hash has the s1:saltHex:keyHex shape with a 16-byte salt and a 64-byte key', async () => {
    const hash = await hashearClave('una-clave-de-prueba');
    const partes = hash.split(':');

    assert.equal(partes.length, 3, hash);
    assert.equal(partes[0], 's1');
    assert.match(partes[1] ?? '', /^[0-9a-f]{32}$/, 'a 16-byte salt, hex-encoded');
    assert.match(partes[2] ?? '', /^[0-9a-f]{128}$/, 'a 64-byte derived key, hex-encoded');
  });

  test('the plaintext never appears in the stored hash', async () => {
    const hash = await hashearClave('una-clave-de-prueba');
    assert.ok(!hash.includes('una-clave-de-prueba'));
    assert.ok(!hash.includes('prueba'), 'not even a substring of it');
  });

  test('hashing the same password twice yields a different salt and a different hash', async () => {
    // The salt is the mechanism behind this: a fixed salt would make the two hashes
    // equal, and a dictionary attack would amortize across every user sharing it.
    const primera = await hashearClave('misma-clave-en-dos-llamadas');
    const segunda = await hashearClave('misma-clave-en-dos-llamadas');

    assert.notEqual(primera.split(':')[1], segunda.split(':')[1], 'a fresh salt per call');
    assert.notEqual(primera, segunda);
    // Both still carry the same password: the difference is only in salt and key.
    assert.equal(await verificarClave('misma-clave-en-dos-llamadas', primera), true);
    assert.equal(await verificarClave('misma-clave-en-dos-llamadas', segunda), true);
  });
});

describe('verificarClave — correct and incorrect passwords (DEC-133)', () => {
  test('the correct password verifies against its hash', async () => {
    const hash = await hashearClave('clave-correcta-1');
    assert.equal(await verificarClave('clave-correcta-1', hash), true);
  });

  test('a different password does not verify', async () => {
    const hash = await hashearClave('clave-correcta-1');
    assert.equal(await verificarClave('clave-equivocada-1', hash), false);
  });

  test('a password differing only in its last character does not verify', async () => {
    // One character of distance: the comparison must be whole-key, not a prefix match.
    const hash = await hashearClave('clave-correcta-1');
    assert.equal(await verificarClave('clave-correcta-2', hash), false);
  });

  test('a non-ASCII password round-trips byte-identically and a mangled one fails', async () => {
    // The hash carries bytes, not characters: a credential with accents and emoji must
    // not be silently normalized into something a different string could verify against.
    const clave = 'contraseña-ñandú-€-😀';
    const hash = await hashearClave(clave);
    assert.equal(await verificarClave(clave, hash), true);
    assert.equal(await verificarClave('contraseña-ñandú-€-', hash), false);
  });

  test('the stored salt is load-bearing: swapping it makes the same password fail', async () => {
    // Verification is not "hash the password and look it up": the stored salt decides
    // the derived key. A tampered salt must produce a different key and a refusal.
    const hash = await hashearClave('clave-correcta-1');
    const partes = hash.split(':');
    partes[1] = 'c'.repeat(32);
    assert.equal(await verificarClave('clave-correcta-1', partes.join(':')), false);
  });
});

describe('the key comparison is constant-time (DEC-133)', () => {
  test('a stored key differing only in its final byte does not verify', async () => {
    const hash = await hashearClave('clave-correcta-1');
    const partes = hash.split(':');
    const clave = Buffer.from(partes[2] ?? '', 'hex');
    clave[clave.length - 1] ^= 0x01;
    partes[2] = clave.toString('hex');

    assert.equal(await verificarClave('clave-correcta-1', partes.join(':')), false);
  });

  /**
   * The behavioral case above cannot tell `timingSafeEqual` apart from a plain `===`:
   * both refuse a different key, and wall-clock timing is not a deterministic test.
   * The mechanism itself is therefore pinned on the source text — the same technique
   * `src/vistas-canonicas.test.ts` case 2.11 uses for DEC-31.
   */
  test('the comparison goes through node:crypto timingSafeEqual, pinned on the source', async () => {
    const fuente = await readFile(new URL('./crypto-auth.ts', import.meta.url), 'utf8');
    assert.ok(
      fuente.includes('timingSafeEqual'),
      'src/crypto-auth.ts must compare derived keys with crypto.timingSafeEqual',
    );
    // And the derivation itself: scrypt is DEC-133's chosen KDF, not a plain hash.
    assert.ok(fuente.includes('scrypt'), 'src/crypto-auth.ts must derive keys with scrypt');
    // DEC-133: no new dependency — the module is built on node:crypto only. What is
    // pinned is the absence of an *import*, not of the words in a comment.
    assert.ok(fuente.includes('node:crypto'));
    assert.ok(!fuente.includes("from 'bcrypt'") && !fuente.includes("from 'argon2'"));
  });
});

describe('verificarClave — a malformed stored value fails closed, never throws', () => {
  // Every input below is a row a previous version, a manual edit or a corruption could
  // plausibly hold. None of them may surface as an exception: the login route maps a
  // `false` to the one generic 401, and a throw would become a 500 that tells an
  // attacker the stored value was malformed rather than merely wrong.
  for (const [etiqueta, valor] of [
    ['an empty string', ''],
    ['a plaintext credential from before hashing existed', 'contrasena-en-texto-plano'],
    ['an unknown version prefix', `s2:${SALT_VÁLIDO}:${CLAVE_VÁLIDA}`],
    ['a missing key component', `s1:${SALT_VÁLIDO}`],
    ['an extra component', `s1:${SALT_VÁLIDO}:${CLAVE_VÁLIDA}:extra`],
    ['a non-hex salt', `s1:${'z'.repeat(32)}:${CLAVE_VÁLIDA}`],
    ['a short salt', `s1:${'a'.repeat(16)}:${CLAVE_VÁLIDA}`],
    ['a short key', `s1:${SALT_VÁLIDO}:${'b'.repeat(64)}`],
    ['an empty salt and key', 's1::'],
  ] as const) {
    test(`${etiqueta} returns false`, async () => {
      assert.equal(await verificarClave('clave-correcta-1', valor), false);
    });
  }
});

describe('generarTokenSesion — a 256-bit token and its SHA-256 hash (DEC-134)', () => {
  test('the token is 32 random bytes in base64url and the hash is its sha256 hex', () => {
    const { tokenPlano, tokenHash } = generarTokenSesion();

    // 32 bytes base64url-encoded: 43 characters, no padding, cookie-safe as-is.
    assert.match(tokenPlano, /^[A-Za-z0-9_-]{43}$/);
    assert.match(tokenHash, /^[0-9a-f]{64}$/);
    assert.equal(tokenHash, createHash('sha256').update(tokenPlano).digest('hex'));
    assert.notEqual(tokenHash, tokenPlano, 'only the hash may reach the database');
  });

  test('two calls give different tokens and different hashes', () => {
    const primero = generarTokenSesion();
    const segundo = generarTokenSesion();

    assert.notEqual(primero.tokenPlano, segundo.tokenPlano, '256 bits of fresh randomness');
    assert.notEqual(primero.tokenHash, segundo.tokenHash);
    // The hash is a pure function of its token: the session lookup re-deriving it must
    // always land on the same stored row.
    assert.equal(
      segundo.tokenHash,
      createHash('sha256').update(segundo.tokenPlano).digest('hex'),
    );
  });

  test('the token carries no lookup-safe form: the hash never equals the token', () => {
    const { tokenPlano, tokenHash } = generarTokenSesion();
    assert.ok(!tokenHash.includes(tokenPlano));
    assert.ok(tokenPlano.length >= 43, 'the raw token is full-entropy, not a truncated form');
  });
});
