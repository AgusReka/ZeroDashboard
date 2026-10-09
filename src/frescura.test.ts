import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LIMITE_VENTANA_MINUTOS, evaluarFrescura, resolverFrescura, type EstadoFrescura } from './frescura.js';

/**
 * Unit cases for CH-24 (DEC-142 to DEC-145): the pure half of the freshness feature. No
 * database, no network, no real clock.
 */

const AHORA = new Date('2026-10-08T12:00:00.000Z');

/** The shared vectors: window, tolerance, state. The console test carries the same table. */
const VECTORES: Array<[number | null, number, EstadoFrescura]> = [
  [null, 60, 'sin-declarar'],
  [0, 0, 'al-dia'],
  [60, 60, 'al-dia'],
  [61, 60, 'desactualizada'],
  [180, 120, 'desactualizada'],
  [30, 120, 'al-dia'],
];

describe('evaluarFrescura — window against tolerance', () => {
  test('each shared vector gives its state', () => {
    for (const [ventana, tolerancia, esperado] of VECTORES) {
      assert.equal(evaluarFrescura(ventana, tolerancia), esperado, `${ventana} contra ${tolerancia}`);
    }
  });

  test('an undeclared window is never fresh or stale, whatever the tolerance', () => {
    for (const tolerancia of [0, 1, 60, 525600]) {
      assert.equal(evaluarFrescura(null, tolerancia), 'sin-declarar');
    }
  });
});

describe('resolverFrescura — what is written, and what is refused', () => {
  test('a window is stored as given, including the bounds', () => {
    for (const ventana of [0, 1, 180, LIMITE_VENTANA_MINUTOS]) {
      assert.deepEqual(resolverFrescura({ ventanaMinutos: ventana }, AHORA), {
        ok: true,
        datos: { ventanaDesactualizacionMinutos: ventana },
      });
    }
  });

  test('null clears the declaration', () => {
    assert.deepEqual(resolverFrescura({ ventanaMinutos: null }, AHORA), {
      ok: true,
      datos: { ventanaDesactualizacionMinutos: null },
    });
  });

  test('actualizadaAhora true takes the injected server clock, false writes nothing', () => {
    assert.deepEqual(resolverFrescura({ actualizadaAhora: true }, AHORA), {
      ok: true,
      datos: { replicaActualizadaEn: AHORA },
    });
    assert.deepEqual(resolverFrescura({ actualizadaAhora: false }, AHORA), { ok: true, datos: {} });
  });

  test('both keys together write both columns', () => {
    assert.deepEqual(resolverFrescura({ ventanaMinutos: 90, actualizadaAhora: true }, AHORA), {
      ok: true,
      datos: { ventanaDesactualizacionMinutos: 90, replicaActualizadaEn: AHORA },
    });
  });

  test('a window that is not an integer from 0 to the limit is refused by name', () => {
    for (const ventanaMinutos of ['5', '', -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, LIMITE_VENTANA_MINUTOS + 1, true, [], {}]) {
      assert.deepEqual(
        resolverFrescura({ ventanaMinutos }, AHORA),
        { ok: false, campos: ['ventanaMinutos'] },
        JSON.stringify(ventanaMinutos) ?? String(ventanaMinutos),
      );
    }
  });

  test('actualizadaAhora must be a strict boolean, never a coerced string or number', () => {
    for (const actualizadaAhora of ['true', 'false', 1, 0, null, [], {}]) {
      assert.deepEqual(
        resolverFrescura({ actualizadaAhora }, AHORA),
        { ok: false, campos: ['actualizadaAhora'] },
        JSON.stringify(actualizadaAhora),
      );
    }
  });

  test('every offender is named together, in body order', () => {
    assert.deepEqual(resolverFrescura({ ventanaMinutos: -5, actualizadaAhora: 'si' }, AHORA), {
      ok: false,
      campos: ['ventanaMinutos', 'actualizadaAhora'],
    });
  });

  test('a body with neither key is a failure with no field', () => {
    assert.deepEqual(resolverFrescura({}, AHORA), { ok: false, campos: [] });
  });

  test('nothing is written when any field is refused', () => {
    assert.deepEqual(resolverFrescura({ ventanaMinutos: 60, actualizadaAhora: 'x' }, AHORA), {
      ok: false,
      campos: ['actualizadaAhora'],
    });
  });
});
