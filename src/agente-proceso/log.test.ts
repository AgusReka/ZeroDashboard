import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearLog, type EventoLog } from './log.js';

/** CH-19c2, cases G1-G3: the agent's JSON-lines log with closed events and fields (DEC-123). */
const AHORA = new Date('2026-10-03T12:00:00.000Z');

function capturar() {
  const lineas: string[] = [];
  return { lineas, log: crearLog((linea) => lineas.push(linea), () => AHORA) };
}

describe('crearLog (CH-19c2, G1-G3)', () => {
  test('G1 writes exactly one JSON line per event', () => {
    const { lineas, log } = capturar();
    log({ evento: 'sesion-abierta' });
    log({ evento: 'sesion-fallida', codigo: 'ETIMEDOUT' });
    assert.equal(lineas.length, 2);
    for (const linea of lineas) assert.equal(linea.indexOf('\n'), linea.length - 1);
    assert.deepEqual(lineas.map((linea) => JSON.parse(linea)), [
      { ts: AHORA.toISOString(), nivel: 'info', evento: 'sesion-abierta' },
      { ts: AHORA.toISOString(), nivel: 'warn', evento: 'sesion-fallida', codigo: 'ETIMEDOUT' },
    ]);
  });

  test('G2 a spread extra key never reaches the line', () => {
    const fuga = {
      host: 'replica.interna', puerto: 5432, sesionId: 'Qx7Zk9WvJ3Qx7Zk9WvJ3ab',
      token: 'zda_secreto', message: 'connect ECONNREFUSED 10.0.0.5:5432',
    };
    const { lineas, log } = capturar();
    log({ ...fuga, evento: 'destino-no-permitido' });
    log({ ...fuga, evento: 'sesion-fallida', codigo: 'ECONNREFUSED' });
    assert.deepEqual(Object.keys(JSON.parse(lineas[0])), ['ts', 'nivel', 'evento']);
    assert.deepEqual(Object.keys(JSON.parse(lineas[1])), ['ts', 'nivel', 'evento', 'codigo']);
    for (const valor of ['replica.interna', '5432', 'Qx7Zk9', 'zda_', '10.0.0.5']) {
      assert.ok(lineas.every((linea) => !linea.includes(valor)), valor);
    }
  });

  test('G3 nombreError passes only as a plain class name, else Error', () => {
    const { lineas, log } = capturar();
    const nombres: unknown[] = ['TypeError', 'connect ECONNREFUSED 10.0.0.5:5432', '', 'A'.repeat(41), 'Error\n{"x":1}', 42, undefined];
    for (const nombreError of nombres) log({ evento: 'error-interno', nombreError } as EventoLog);
    assert.deepEqual(
      lineas.map((linea) => [JSON.parse(linea).nivel, JSON.parse(linea).nombreError]),
      ['TypeError', 'Error', 'Error', 'Error', 'Error', 'Error', 'Error'].map((nombre) => ['error', nombre]),
    );
  });
});
