import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DURACION_CODIGO_MS, generarCodigo, hashCodigo, normalizarCodigo } from './codigo-vinculo.js';

/** CH-43 (DEC-185, DEC-196): the one-time code, with no database. */
describe('codigo-vinculo (CH-43)', () => {
  test('a code lasts 10 minutes', () => {
    assert.equal(DURACION_CODIGO_MS, 600_000);
  });

  test('a generated code is 8 Crockford base32 characters and its hash is the SHA-256 hex', () => {
    for (let i = 0; i < 200; i += 1) {
      const { codigo, codigoHash } = generarCodigo();
      assert.match(codigo, /^[0-9A-HJKMNP-TV-Z]{8}$/);
      assert.equal(codigoHash, hashCodigo(codigo));
      assert.match(codigoHash, /^[0-9a-f]{64}$/);
      assert.equal(normalizarCodigo(codigo), codigo);
    }
  });

  test('generated codes differ', () => {
    const codigos = new Set(Array.from({ length: 100 }, () => generarCodigo().codigo));
    assert.equal(codigos.size, 100);
  });

  test('a code typed loosely normalizes to the same code', () => {
    assert.equal(normalizarCodigo('7kq2-m9xa'), '7KQ2M9XA');
    assert.equal(normalizarCodigo(' 7KQ2 M9XA '), '7KQ2M9XA');
    assert.equal(normalizarCodigo('o1il-abcd'), '0111ABCD');
    assert.equal(hashCodigo(normalizarCodigo('7kq2-m9xa')!), hashCodigo('7KQ2M9XA'));
  });

  test('bad input is refused', () => {
    for (const texto of ['', '7KQ2M9X', '7KQ2M9XAB', '7KQ2M9XU', '7KQ2M9X!', '7KQ2_M9XA', 'ÁKQ2M9XA']) {
      assert.equal(normalizarCodigo(texto), null, texto);
    }
  });
});
