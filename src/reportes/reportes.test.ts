import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  TOPE_FILAS,
  declaracionDelPeriodo,
  faltantesEn,
  fechaDelPeriodo,
  leerReporte,
  rechazoDeColumnas,
  rechazoDelPeriodo,
  rechazoDeTitulos,
  topeEfectivo,
  type ColumnaAsignada,
  type FilaReporte,
} from './reportes.js';

/** CH-45 (DEC-198) task 2.2: the pure rules, with no Fastify and no database. */

const c = (rol: ColumnaAsignada['rol'], columna: string, titulo = 'Título'): ColumnaAsignada => ({ rol, columna, titulo });

describe('CH-45 columns by role (DEC-198)', () => {
  test('numero takes exactly one valor', () => {
    assert.deepEqual(rechazoDeColumnas('numero', [c('valor', 'total')]), []);
    assert.deepEqual(rechazoDeColumnas('numero', []), ['/columnas']);
    assert.deepEqual(rechazoDeColumnas('numero', [c('etiqueta', 'total')]), ['/columnas']);
    assert.deepEqual(rechazoDeColumnas('numero', [c('valor', 'a'), c('valor', 'b')]), ['/columnas']);
  });

  test('barras and linea take etiqueta then valor, in that order', () => {
    for (const v of ['barras', 'linea'] as const) {
      assert.deepEqual(rechazoDeColumnas(v, [c('etiqueta', 'producto'), c('valor', 'total')]), [], v);
      assert.deepEqual(rechazoDeColumnas(v, [c('valor', 'total')]), ['/columnas'], v);
      assert.deepEqual(rechazoDeColumnas(v, [c('valor', 'total'), c('etiqueta', 'producto')]), ['/columnas'], v);
      assert.deepEqual(rechazoDeColumnas(v, [c('etiqueta', 'a'), c('valor', 'b'), c('valor', 'c')]), ['/columnas'], v);
    }
  });

  test('tabla takes 1 to 10 columna entries', () => {
    const diez = Array.from({ length: 10 }, (_, i) => c('columna', `c${i}`));
    assert.deepEqual(rechazoDeColumnas('tabla', [c('columna', 'producto')]), []);
    assert.deepEqual(rechazoDeColumnas('tabla', diez), []);
    assert.deepEqual(rechazoDeColumnas('tabla', [...diez, c('columna', 'c10')]), ['/columnas']);
    assert.deepEqual(rechazoDeColumnas('tabla', []), ['/columnas']);
    assert.deepEqual(rechazoDeColumnas('tabla', [c('columna', 'a'), c('valor', 'b')]), ['/columnas']);
  });

  test('the same column twice is refused, whatever the roles', () => {
    assert.deepEqual(rechazoDeColumnas('barras', [c('etiqueta', 'total'), c('valor', 'total')]), ['/columnas']);
    assert.deepEqual(rechazoDeColumnas('tabla', [c('columna', 'a'), c('columna', 'a')]), ['/columnas']);
  });

  test('column titles: 1 to 40 after trimming, and the panel glossary', () => {
    assert.deepEqual(rechazoDeTitulos([c('valor', 'x', `  ${'a'.repeat(40)}  `)]), { campos: [], terminos: [] });
    assert.deepEqual(rechazoDeTitulos([c('etiqueta', 'x', '   '), c('valor', 'y', 'a'.repeat(41))]), {
      campos: ['/columnas/0/titulo', '/columnas/1/titulo'],
      terminos: [],
    });
    assert.deepEqual(rechazoDeTitulos([c('columna', 'x', 'Total'), c('columna', 'y', 'Filas de la consulta SQL')]), {
      campos: ['/columnas/1/titulo'],
      terminos: ['sql', 'consulta'],
    });
  });
});

describe('CH-45 declared period (DEC-198)', () => {
  test('null is valid; parametro follows the DEC-49 name rule', () => {
    assert.deepEqual(rechazoDelPeriodo(null), []);
    assert.deepEqual(rechazoDelPeriodo({ parametro: 'desde', dias: [30, 7, 90] }), []);
    for (const parametro of ['', '1desde', 'des-de', 'año']) {
      assert.deepEqual(rechazoDelPeriodo({ parametro, dias: [7] }), ['/periodo/parametro'], parametro);
    }
  });

  test('dias: 1 to 6 distinct integers from 1 to 366', () => {
    assert.deepEqual(rechazoDelPeriodo({ parametro: 'd', dias: [1, 366, 2, 3, 4, 5] }), []);
    for (const dias of [[], [7, 7], [0], [400], [1.5], [1, 2, 3, 4, 5, 6, 7]]) {
      assert.deepEqual(rechazoDelPeriodo({ parametro: 'd', dias }), ['/periodo/dias'], JSON.stringify(dias));
    }
  });

  test('the declaration is derived: empty with no period, one fecha parameter with one', () => {
    assert.deepEqual(declaracionDelPeriodo(null), []);
    assert.deepEqual(declaracionDelPeriodo({ parametro: 'desde', dias: [7] }), [{ nombre: 'desde', tipo: 'fecha' }]);
  });

  test('the date is today in the zone minus the days, when the zone is a day behind UTC', () => {
    // 2026-11-07T02:00Z is still 2026-11-06 in Buenos Aires (UTC-3): the spec scenario.
    const ahora = new Date('2026-11-07T02:00:00Z');
    assert.equal(fechaDelPeriodo(ahora, 'America/Argentina/Buenos_Aires', 7), '2026-10-30');
    assert.equal(fechaDelPeriodo(ahora, 'UTC', 7), '2026-10-31');
    assert.equal(fechaDelPeriodo(ahora, 'America/Argentina/Buenos_Aires', 0), '2026-11-06');
  });

  test('the date crosses month and year boundaries', () => {
    assert.equal(fechaDelPeriodo(new Date('2026-03-01T12:00:00Z'), 'UTC', 1), '2026-02-28');
    assert.equal(fechaDelPeriodo(new Date('2026-01-05T12:00:00Z'), 'UTC', 30), '2025-12-06');
    assert.equal(fechaDelPeriodo(new Date('2028-03-01T12:00:00Z'), 'UTC', 366), '2027-03-01');
  });
});

describe('CH-45 missing columns and the row cap (DEC-198)', () => {
  test('faltantesEn keeps assignment order and is empty when all are present', () => {
    const asignadas = [c('columna', 'total'), c('columna', 'producto'), c('columna', 'unidades')];
    assert.deepEqual(faltantesEn(asignadas, ['producto']), ['total', 'unidades']);
    assert.deepEqual(faltantesEn(asignadas, ['unidades', 'total', 'producto', 'extra']), []);
    assert.deepEqual(faltantesEn([], ['a']), []);
  });

  test('the caps by type, and a lower maxFilasPorConsulta wins', () => {
    assert.deepEqual({ ...TOPE_FILAS }, { numero: 1, barras: 20, tabla: 50, linea: 100 });
    assert.equal(topeEfectivo('linea', 200), 100);
    assert.equal(topeEfectivo('linea', 30), 30);
    assert.equal(topeEfectivo('numero', 30), 1);
  });
});

describe('CH-45 leerReporte fails closed (DEC-73)', () => {
  const FILA: FilaReporte = {
    id: 'r-1',
    nombre: 'Ventas',
    titulo: 'Lo más vendido',
    descripcion: null,
    sql: 'SELECT 1',
    entidades: ['producto'],
    visualizacion: 'barras',
    columnas: [c('etiqueta', 'producto'), c('valor', 'total')],
    periodo: { parametro: 'desde', dias: [30, 7] },
  };

  test('a valid row is read back typed', () => {
    const leido = leerReporte(FILA);
    assert.equal(leido.visualizacion, 'barras');
    assert.deepEqual(leido.periodo, { parametro: 'desde', dias: [30, 7] });
    assert.deepEqual(leerReporte({ ...FILA, periodo: null }).periodo, null);
  });

  test('any corrupt JSON throws instead of running', () => {
    const corruptas: Partial<FilaReporte>[] = [
      { entidades: [] },
      { entidades: ['cliente'] },
      { entidades: 'producto' },
      { visualizacion: 'torta' },
      { columnas: 'producto' },
      { columnas: [c('valor', 'total')] },
      { columnas: [{ rol: 'valor', columna: 1, titulo: 'x' }] },
      { periodo: { parametro: 'desde', dias: [] } },
      { periodo: { parametro: '1x', dias: [7] } },
      { periodo: 'desde' },
    ];
    for (const cambio of corruptas) {
      assert.throws(() => leerReporte({ ...FILA, ...cambio }), /leerReporte/, JSON.stringify(cambio));
    }
  });
});
