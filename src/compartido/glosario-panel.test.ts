import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TERMINOS_PROHIBIDOS_PANEL, terminosProhibidosEn } from './glosario-panel.js';

/** CH-37 task 2.2: the panel glossary check shared by the template save and the panel tests. */
describe('terminosProhibidosEn', () => {
  test('matches case-insensitively', () => {
    assert.deepEqual(terminosProhibidosEn('Revisión de la CONSULTA'), ['consulta']);
    assert.deepEqual(terminosProhibidosEn('Una Plantilla nueva'), ['plantilla']);
  });

  test('returns every term found, in list order', () => {
    assert.deepEqual(terminosProhibidosEn('Cada timeout de la consulta SQL'), ['sql', 'consulta', 'timeout']);
  });

  test('a clean text gives an empty list', () => {
    assert.deepEqual(terminosProhibidosEn('Aviso de stock bajo'), []);
    assert.deepEqual(terminosProhibidosEn(''), []);
  });

  test('the list is lower case and frozen', () => {
    assert.ok(TERMINOS_PROHIBIDOS_PANEL.every((termino) => termino === termino.toLocaleLowerCase('es')));
    assert.ok(Object.isFrozen(TERMINOS_PROHIBIDOS_PANEL));
  });
});
