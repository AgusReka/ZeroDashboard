import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { faltantesEn, marcadoresDe, sustituir, textoSinMarcadores } from './marcadores-mensaje.js';

/** CH-39 task 2.2: the placeholder reading shared by the save-time check and the renderer. */

describe('marcadoresDe', () => {
  test('names in order of first appearance, each once', () => {
    assert.deepEqual(marcadoresDe('{b}: {a} ({b})'), ['b', 'a']);
  });

  test('names are exact: case and spaces are kept', () => {
    assert.deepEqual(marcadoresDe('{Producto} {Stock disponible} { x }'), ['Producto', 'Stock disponible', ' x ']);
  });

  test('empty, nested and unmatched braces are literal', () => {
    assert.deepEqual(marcadoresDe('{} {a {b'), []);
    assert.deepEqual(marcadoresDe('a} {{c}}'), ['c']);
  });
});

describe('textoSinMarcadores and faltantesEn', () => {
  test('removes only the placeholders', () => {
    assert.equal(textoSinMarcadores('{consulta}: revisar {}'), ': revisar {}');
  });

  test('missing names, each once, in order', () => {
    assert.deepEqual(faltantesEn('{producto}: {stock} ({stock}) {x}', ['producto']), ['stock', 'x']);
    assert.deepEqual(faltantesEn('{producto}', ['producto', 'cantidad']), []);
  });
});

describe('sustituir', () => {
  test('applies literal and valorDe separately', () => {
    const linea = sustituir(
      '{p} & más',
      () => '[A<B]',
      (texto) => texto.toUpperCase(),
    );
    assert.equal(linea, '[A<B] & MÁS');
  });

  test('a line made only of placeholders', () => {
    assert.equal(sustituir('{a}{b}', (n) => n.toUpperCase(), (t) => t), 'AB');
  });
});
