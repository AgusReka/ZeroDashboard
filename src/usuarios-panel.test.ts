import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { correoValido, generarClavePanel, normalizarCorreo } from './usuarios-panel.js';

describe('CH-28 panel user rules — pure (DEC-155, DEC-157)', () => {
  test('a generated password is 24 base64url characters and two are never equal', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const clave = generarClavePanel();
      assert.match(clave, /^[A-Za-z0-9_-]{24}$/);
      vistas.add(clave);
    }
    assert.equal(vistas.size, 50);
  });

  test('an email is trimmed and lowercased', () => {
    assert.equal(normalizarCorreo('  Ana@Negocio.COM \t'), 'ana@negocio.com');
    assert.equal(normalizarCorreo('ana@negocio.com'), 'ana@negocio.com');
  });

  test('a valid email has one @ that is neither first nor last, no spaces, 3 to 254 characters', () => {
    for (const bueno of ['a@b', 'ana@negocio.com', `${'a'.repeat(240)}@negocio.com`]) {
      assert.equal(correoValido(bueno), true, bueno);
    }
    for (const malo of ['', 'ab', 'ana', '@negocio.com', 'ana@', 'a@b@c', 'ana maria@negocio.com', `${'a'.repeat(250)}@negocio.com`]) {
      assert.equal(correoValido(malo), false, malo);
    }
  });
});
