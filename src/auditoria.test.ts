import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { analizarFiltros, filaDeAuditoria, veredictoDeEjecucion } from './auditoria.js';

const OPERADOR = { id: 'op-1', nombre: 'ana' };

describe('CH-20 audit row — pure (DEC-160)', () => {
  test('a successful execution records its row count and duration, and no failure fields', () => {
    const veredicto = veredictoDeEjecucion({
      resultado: 'ok',
      fase: 'ejecucion',
      columnas: ['a'],
      filas: [[1], [2], [3]],
      corte: null,
      paginacion: { limite: 50, desplazamiento: 0, hayMas: false } as never,
      duracionMs: 12,
    });
    assert.deepEqual(veredicto, { resultado: 'ok', fase: null, categoria: null, codigo: null, filas: 3, duracionMs: 12 });
  });

  test('a failed execution records phase, category, code and duration, and no row count', () => {
    const veredicto = veredictoDeEjecucion({
      resultado: 'fallo',
      fase: 'ejecucion',
      categoria: 'no-es-lectura',
      codigo: '25006',
      duracionMs: 4,
    });
    assert.deepEqual(veredicto, {
      resultado: 'fallo',
      fase: 'ejecucion',
      categoria: 'no-es-lectura',
      codigo: '25006',
      filas: null,
      duracionMs: 4,
    });
  });

  test('the row carries the context as given, the operator copied, and no saved query when there is none', () => {
    const fila = filaDeAuditoria(
      { origen: 'consulta', conexionId: 'c-1', sql: 'SELECT :x', operador: OPERADOR, consulta: null, plantillaId: null },
      { resultado: 'ok', fase: null, categoria: null, codigo: null, filas: 1, duracionMs: 5 },
    );
    assert.deepEqual(fila, {
      origen: 'consulta',
      conexionId: 'c-1',
      sql: 'SELECT :x',
      operadorId: 'op-1',
      operadorNombre: 'ana',
      consultaGuardadaId: null,
      consultaVersion: null,
      consultaNombre: null,
      plantillaId: null,
      resultado: 'ok',
      fase: null,
      categoria: null,
      codigo: null,
      filas: 1,
      duracionMs: 5,
    });
  });

  test('a verified saved query and a template id reach the row', () => {
    const fila = filaDeAuditoria(
      {
        origen: 'consulta',
        conexionId: 'c-1',
        sql: 'SELECT 1',
        operador: OPERADOR,
        consulta: { id: 'q-1', version: 3, nombre: 'Stock bajo' },
        plantillaId: null,
      },
      { resultado: 'ok', fase: null, categoria: null, codigo: null, filas: 0, duracionMs: 1 },
    );
    assert.equal(fila.consultaGuardadaId, 'q-1');
    assert.equal(fila.consultaVersion, 3);
    assert.equal(fila.consultaNombre, 'Stock bajo');
    const prueba = filaDeAuditoria(
      { origen: 'plantilla-prueba', conexionId: 'c-1', sql: 'SELECT 2', operador: OPERADOR, consulta: null, plantillaId: 'p-1' },
      { resultado: 'ok', fase: null, categoria: null, codigo: null, filas: 0, duracionMs: 1 },
    );
    assert.equal(prueba.plantillaId, 'p-1');
  });
});

describe('CH-20 audit listing filters — pure', () => {
  test('no filter is valid and empty', () => {
    assert.deepEqual(analizarFiltros({}), { ok: true, filtros: {} });
  });

  test('desde, hasta and resultado are parsed', () => {
    const r = analizarFiltros({ desde: '2026-10-01T00:00:00Z', hasta: '2026-10-11', resultado: 'fallo', otra: 'x' });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.filtros.desde?.toISOString(), '2026-10-01T00:00:00.000Z');
      // A date-only `hasta` covers that whole day (UTC): the bound is inclusive.
      assert.equal(r.filtros.hasta?.toISOString(), '2026-10-11T23:59:59.999Z');
      assert.equal(r.filtros.resultado, 'fallo');
    }
  });

  test('a date-time with an offset that is another day in UTC is still valid', () => {
    const r = analizarFiltros({ desde: '2026-10-01T23:00:00-03:00' });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.filtros.desde?.toISOString(), '2026-10-02T02:00:00.000Z');
    }
  });

  test('an invalid date or result names the filter, and a repeated value is invalid', () => {
    assert.deepEqual(analizarFiltros({ desde: 'ayer', resultado: 'quizas' }), { ok: false, campos: ['/desde', '/resultado'] });
    assert.deepEqual(analizarFiltros({ hasta: '2026-13-45' }), { ok: false, campos: ['/hasta'] });
    // `Date` would roll this over to March 2 instead of failing.
    assert.deepEqual(analizarFiltros({ hasta: '2026-02-30' }), { ok: false, campos: ['/hasta'] });
    assert.deepEqual(analizarFiltros({ resultado: ['ok', 'fallo'] }), { ok: false, campos: ['/resultado'] });
  });
});
