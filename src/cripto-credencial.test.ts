import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  cifrarCredencial,
  descifrarCredencial,
  ErrorCredencialIlegible,
  VARIABLE_CLAVE_MAESTRA,
  validarClaveMaestra,
} from './cripto-credencial.js';

/**
 * Unit cases for CH-07 task 1.1 (DEC-16, DEC-17). No database and no call site: this
 * module is pure `node:crypto`, so every claim below is about the envelope format and
 * about what a failure is allowed to say — not about a route.
 *
 * The fixture key is a literal on purpose. A key generated per run would make an
 * envelope from one run undecipherable in the next, and two of the cases below
 * (a legacy plaintext row, a hand-written envelope) need a fixed key to be writable at
 * all. It is a test fixture, never a deployment value: `.env.example` ships a
 * placeholder and the real key is generated per deployment.
 */
const CLAVE_PRUEBAS = 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';
process.env[VARIABLE_CLAVE_MAESTRA] ??= CLAVE_PRUEBAS;

/** A different, equally valid 32-byte key — used for the "wrong key" case. */
const OTRA_CLAVE = Buffer.alloc(32, 7).toString('base64');

/** Runs `accion` with the master key temporarily set to `valor` (or unset). */
function conClave<T>(valor: string | undefined, accion: () => T): T {
  const previo = process.env[VARIABLE_CLAVE_MAESTRA];
  if (valor === undefined) {
    delete process.env[VARIABLE_CLAVE_MAESTRA];
  } else {
    process.env[VARIABLE_CLAVE_MAESTRA] = valor;
  }
  try {
    return accion();
  } finally {
    if (previo === undefined) {
      delete process.env[VARIABLE_CLAVE_MAESTRA];
    } else {
      process.env[VARIABLE_CLAVE_MAESTRA] = previo;
    }
  }
}

describe('cifrarCredencial — versioned authenticated envelope', () => {
  test('an enciphered credential round-trips to the original plaintext', () => {
    const plano = 'una-credencial-de-replica';
    assert.equal(descifrarCredencial(cifrarCredencial(plano)), plano);
  });

  test('a credential with non-ASCII characters round-trips byte-identically', () => {
    // The envelope carries bytes, not characters: a credential is arbitrary text and
    // the operator does not get to find out that theirs was silently mangled.
    const plano = 'contraseña-ñandú-€-😀';
    assert.equal(descifrarCredencial(cifrarCredencial(plano)), plano);
  });

  test('the envelope has the shape v1:iv:tag:ciphertext with base64 components', () => {
    const sobre = cifrarCredencial('una-credencial-de-replica');
    const partes = sobre.split(':');

    assert.equal(partes.length, 4, sobre);
    assert.equal(partes[0], 'v1');
    // 12-byte IV and 16-byte GCM tag, both base64. Their decoded lengths are the
    // assertion; the base64 text length is an encoding detail.
    assert.equal(Buffer.from(partes[1], 'base64').length, 12);
    assert.equal(Buffer.from(partes[2], 'base64').length, 16);
    assert.ok(Buffer.from(partes[3], 'base64').length > 0);
  });

  test('the same credential enciphered twice yields two different envelopes', () => {
    const plano = 'una-credencial-de-replica';
    const primero = cifrarCredencial(plano);
    const segundo = cifrarCredencial(plano);

    assert.notEqual(primero, segundo, 'each encipher call must use a fresh random IV');
    // Not only the whole string: the IV component itself has to differ, otherwise two
    // envelopes could differ for some other reason while reusing the IV.
    assert.notEqual(primero.split(':')[1], segundo.split(':')[1]);
    assert.equal(descifrarCredencial(primero), plano);
    assert.equal(descifrarCredencial(segundo), plano);
  });

  test('the envelope never contains the plaintext', () => {
    const plano = 'una-credencial-de-replica';
    assert.ok(!cifrarCredencial(plano).includes(plano));
  });
});

describe('descifrarCredencial — every unreadable input is ErrorCredencialIlegible', () => {
  /** Replaces one component of a valid envelope with `reemplazo`. */
  function conComponente(indice: number, reemplazo: string): string {
    const partes = cifrarCredencial('una-credencial-de-replica').split(':');
    partes[indice] = reemplazo;
    return partes.join(':');
  }

  test('a tampered authentication tag is rejected', () => {
    const sobre = conComponente(2, Buffer.alloc(16, 1).toString('base64'));
    assert.throws(() => descifrarCredencial(sobre), ErrorCredencialIlegible);
  });

  test('a tampered ciphertext is rejected by the tag, not decrypted', () => {
    const partes = cifrarCredencial('una-credencial-de-replica').split(':');
    const cifrado = Buffer.from(partes[3], 'base64');
    // Flip one bit. GCM authenticates the ciphertext, so this must fail rather than
    // produce a corrupted-but-returned plaintext.
    cifrado[0] ^= 0x01;
    partes[3] = cifrado.toString('base64');

    assert.throws(() => descifrarCredencial(partes.join(':')), ErrorCredencialIlegible);
  });

  test('a tampered IV is rejected', () => {
    const sobre = conComponente(1, Buffer.alloc(12, 9).toString('base64'));
    assert.throws(() => descifrarCredencial(sobre), ErrorCredencialIlegible);
  });

  test('an unknown version prefix is rejected instead of being guessed at', () => {
    const sobre = conComponente(0, 'v2');
    assert.throws(() => descifrarCredencial(sobre), ErrorCredencialIlegible);
  });

  for (const [etiqueta, valor] of [
    ['a legacy plaintext credential', 'contrasena-en-texto-plano'],
    ['an empty string', ''],
    ['an unversioned three-part value', 'aaaa:bbbb:cccc'],
    ['a five-part value', 'v1:a:b:c:d'],
    ['a value whose components are not base64', 'v1:@@@@:####:$$$$'],
    ['a value with the right shape but a short IV', 'v1:AAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA'],
  ] as const) {
    test(`${etiqueta} is rejected`, () => {
      assert.throws(() => descifrarCredencial(valor), ErrorCredencialIlegible);
    });
  }

  test('an envelope enciphered under a different key is rejected, not returned', () => {
    const ajeno = conClave(OTRA_CLAVE, () => cifrarCredencial('una-credencial-de-replica'));
    assert.throws(() => descifrarCredencial(ajeno), ErrorCredencialIlegible);
  });
});

describe('regla 7 — no key material and no plaintext escapes a failure', () => {
  test('the failure carries neither the plaintext, the ciphertext nor the key', () => {
    const plano = 'una-credencial-de-replica';
    const partes = cifrarCredencial(plano).split(':');
    const cifrado = Buffer.from(partes[3], 'base64');
    cifrado[0] ^= 0x01;
    partes[3] = cifrado.toString('base64');

    let capturado: unknown;
    try {
      descifrarCredencial(partes.join(':'));
    } catch (error) {
      capturado = error;
    }

    assert.ok(capturado instanceof ErrorCredencialIlegible);
    const serializado = `${capturado.name}|${capturado.message}|${String(capturado.stack)}`;
    assert.ok(!serializado.includes(plano), 'the plaintext must not appear in the failure');
    assert.ok(!serializado.includes(CLAVE_PRUEBAS), 'the master key must not appear in the failure');
    assert.ok(!serializado.includes(partes[3]), 'the ciphertext must not appear in the failure');
    // `cause` is deliberately not set: the driver-level GCM error is discarded rather
    // than chained, so nothing derived from the envelope can ride out on it.
    assert.equal((capturado as { cause?: unknown }).cause, undefined);
  });

  test('a missing key is a configuration failure, not an ErrorCredencialIlegible', () => {
    // The two are different verdicts on purpose: a row that cannot be deciphered is a
    // 409 about that row (DEC-20), while a missing key is a deployment that must not
    // have started at all (DEC-17).
    conClave(undefined, () => {
      assert.throws(
        () => cifrarCredencial('una-credencial-de-replica'),
        (error: unknown) => error instanceof Error && !(error instanceof ErrorCredencialIlegible),
      );
    });
  });
});

describe('validarClaveMaestra — fail-closed, and it never returns the key', () => {
  test('a valid 32-byte base64 key passes and yields nothing', () => {
    conClave(CLAVE_PRUEBAS, () => {
      assert.equal(validarClaveMaestra(), undefined);
    });
  });

  for (const [etiqueta, valor] of [
    ['unset', undefined],
    ['empty', ''],
    ['not base64 at all', 'no-es-base64-***'],
    ['valid base64 but only 16 bytes', Buffer.alloc(16, 3).toString('base64')],
    ['valid base64 but 31 bytes', Buffer.alloc(31, 3).toString('base64')],
    ['valid base64 but 33 bytes', Buffer.alloc(33, 3).toString('base64')],
    ['32 ASCII characters that are not base64 for 32 bytes', 'zerodashboard-clave-de-pruebas!!'],
  ] as const) {
    test(`a key that is ${etiqueta} is refused`, () => {
      conClave(valor, () => {
        assert.throws(() => validarClaveMaestra(), Error);
      });
    });
  }

  test('the refusal never quotes the offending value', () => {
    const valorMalo = Buffer.alloc(16, 3).toString('base64');
    conClave(valorMalo, () => {
      assert.throws(
        () => validarClaveMaestra(),
        (error: unknown) => {
          const mensaje = error instanceof Error ? error.message : String(error);
          assert.ok(!mensaje.includes(valorMalo), 'the message must not quote the key');
          assert.ok(mensaje.includes(VARIABLE_CLAVE_MAESTRA), 'it must name the variable');
          return true;
        },
      );
    });
  });

  test('changing the key in the environment is picked up, not served from a cache', () => {
    // The module caches the derived key for the hot path. The cache is keyed by the raw
    // environment value precisely so a changed key can never be silently ignored.
    const sobre = cifrarCredencial('una-credencial-de-replica');
    conClave(OTRA_CLAVE, () => {
      assert.throws(() => descifrarCredencial(sobre), ErrorCredencialIlegible);
    });
    assert.equal(descifrarCredencial(sobre), 'una-credencial-de-replica');
  });
});
