import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolverAjustes, type FilaAjustes, type PlantillaAjustes } from '../panel/panel-ajustes.js';
import { prepararSentencia } from '../ejecucion/parametros.js';
import { resolverAjusteOperador } from './automatizaciones-rutas.js';
import { esUmbralValido, prepararSentenciaDeAutomatizacion } from './umbral.js';

/**
 * UX review P-06 (DEC-205): `umbral` is an integer, 0 or more, on the three routes that write
 * it, through one shared rule. Pure cases: no database. The refinement of DEC-60 is limited to
 * the parameter named `umbral`; every other `numero` keeps accepting any finite number.
 */

const SQL = 'SELECT 1 WHERE a <= :umbral AND b = :otro';
const PARAMETROS = [
  { nombre: 'umbral', tipo: 'numero' },
  { nombre: 'otro', tipo: 'numero' },
];
const PLANTILLA = { sql: SQL, parametros: PARAMETROS };
const TOPE = 200;
const ZONA = 'UTC';

const INVALIDOS = [2.5, -1, -0.5, 0.1, 1e-7, '3', '', null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY];

describe('DEC-205 the rule itself', () => {
  test('integers from 0 up are valid; decimals, negatives and everything that is not a number are not', () => {
    for (const valor of [0, 1, 5, 20, 1000, 2 ** 31]) assert.equal(esUmbralValido(valor), true, String(valor));
    for (const valor of INVALIDOS) assert.equal(esUmbralValido(valor), false, String(valor));
    assert.equal(esUmbralValido(-0), true, '-0 is the integer zero');
  });

  test('prepararSentenciaDeAutomatizacion refuses a decimal umbral as DEC-60 refuses any bad value', () => {
    const resultado = prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 2.5, otro: 1 });
    assert.deepEqual(resultado, {
      ok: false,
      problemas: [{ parametro: 'umbral', motivo: 'valor-invalido', campo: '/valores/umbral' }],
    });
  });

  test('a value DEC-60 already refuses is reported once, not twice', () => {
    for (const umbral of ['3', null, true, Number.NaN]) {
      const resultado = prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral, otro: 1 });
      assert.equal(resultado.ok, false);
      if (resultado.ok) continue;
      assert.equal(resultado.problemas.filter((p) => p.campo === '/valores/umbral').length, 1, String(umbral));
    }
  });

  test('the refinement is limited to the parameter named umbral: another numero still takes a decimal, and prepararSentencia is untouched', () => {
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 3, otro: 2.5 }).ok, true);
    assert.equal(prepararSentencia(SQL, PARAMETROS, { umbral: 2.5, otro: 2.5 }).ok, true, 'DEC-60 unchanged');
    const otraDeclaracion = [{ nombre: 'minimo', tipo: 'numero' }];
    assert.equal(prepararSentenciaDeAutomatizacion('SELECT :minimo', otraDeclaracion, { minimo: 2.5 }).ok, true);
  });

  test('an umbral that is not declared as numero is left to DEC-60 (a text umbral is a text)', () => {
    const texto = [{ nombre: 'umbral', tipo: 'texto' }];
    assert.equal(prepararSentenciaDeAutomatizacion('SELECT :umbral', texto, { umbral: 'abc' }).ok, true);
  });

  test('valid integers pass, and the other DEC-60 problems still come through with the umbral one', () => {
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 0, otro: 1 }).ok, true);
    const resultado = prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 2.5 });
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.deepEqual(
      resultado.problemas.map((p) => [p.parametro, p.motivo]),
      [['otro', 'valor-faltante'], ['umbral', 'valor-invalido']],
    );
  });

  test('a stored decimal umbral is only tolerated when it is sent back unchanged', () => {
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 2.5, otro: 1 }, { guardado: 2.5 }).ok, true);
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 3.5, otro: 1 }, { guardado: 2.5 }).ok, false);
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 2.5, otro: 1 }, { guardado: 5 }).ok, false);
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 2.5, otro: 1 }, { guardado: '2.5' }).ok, false);
    assert.equal(prepararSentenciaDeAutomatizacion(SQL, PARAMETROS, { umbral: 2.5, otro: 1 }, {}).ok, false);
  });
});

describe('DEC-205 the console routes (POST /automatizaciones and PUT /automatizaciones/:id/ajustes)', () => {
  test('the PUT answers with campos ["/valores/umbral"] and a valor-invalido problem for a decimal', () => {
    for (const umbral of [2.5, -1, '3']) {
      const resolucion = resolverAjusteOperador({ valores: { umbral, otro: 1 } }, PLANTILLA, ZONA, TOPE);
      assert.equal(resolucion.ok, false, String(umbral));
      if (resolucion.ok) continue;
      assert.deepEqual(resolucion.campos, ['/valores/umbral'], String(umbral));
      assert.deepEqual(
        resolucion.problemas,
        [{ parametro: 'umbral', motivo: 'valor-invalido', campo: '/valores/umbral' }],
        String(umbral),
      );
    }
  });

  test('the PUT accepts an integer, and a body without valores never meets the rule', () => {
    assert.deepEqual(resolverAjusteOperador({ valores: { umbral: 7, otro: 1 } }, PLANTILLA, ZONA, TOPE), {
      ok: true,
      datos: { valores: { umbral: 7, otro: 1 } },
    });
    assert.deepEqual(resolverAjusteOperador({ cron: '30 6 * * 1-5' }, PLANTILLA, ZONA, TOPE), {
      ok: true,
      datos: { cron: '30 6 * * 1-5' },
    });
  });

  test('the resend case: valores with the stored decimal umbral unchanged is accepted; changing it to another decimal is not', () => {
    const guardado = { umbral: 2.5, otro: 1 };
    assert.deepEqual(resolverAjusteOperador({ valores: { umbral: 2.5, otro: 9 } }, PLANTILLA, ZONA, TOPE, guardado), {
      ok: true,
      datos: { valores: { umbral: 2.5, otro: 9 } },
    });
    const otro = resolverAjusteOperador({ valores: { umbral: 3.5, otro: 1 } }, PLANTILLA, ZONA, TOPE, guardado);
    assert.equal(otro.ok, false);
    // Moving to an integer is always fine.
    assert.equal(resolverAjusteOperador({ valores: { umbral: 3, otro: 1 } }, PLANTILLA, ZONA, TOPE, guardado).ok, true);
  });
});

describe('DEC-205 the panel route (PUT /api/panel/automatizaciones/:id/ajustes)', () => {
  const plantilla: PlantillaAjustes = { sql: SQL, parametros: PARAMETROS };
  const fila = (valores: unknown = { umbral: 20, otro: 1 }): FilaAjustes => ({
    activo: true,
    cron: '30 8 * * 1-5',
    valores,
    destinatarios: ['ana@empresa.com'],
  });

  test('a decimal, negative or text umbral is a 400 naming the business field, with no text', () => {
    for (const umbral of INVALIDOS) {
      assert.deepEqual(
        resolverAjustes({ umbral }, fila(), plantilla, ZONA),
        { ok: false, estado: 400, campos: ['umbral'] },
        String(umbral),
      );
    }
  });

  test('0 and positive integers are written, merged into the stored map', () => {
    assert.deepEqual(resolverAjustes({ umbral: 0 }, fila(), plantilla, ZONA), { ok: true, datos: { valores: { umbral: 0, otro: 1 } } });
    assert.deepEqual(resolverAjustes({ umbral: 12 }, fila(), plantilla, ZONA), { ok: true, datos: { valores: { umbral: 12, otro: 1 } } });
  });

  test('a stored decimal does not block changing something else, and is replaced by an integer', () => {
    assert.deepEqual(resolverAjustes({ hora: '09:00' }, fila({ umbral: 2.5, otro: 1 }), plantilla, ZONA), {
      ok: true,
      datos: { cron: '0 9 * * 1-5' },
    });
    assert.deepEqual(resolverAjustes({ umbral: 5 }, fila({ umbral: 2.5, otro: 1 }), plantilla, ZONA), {
      ok: true,
      datos: { valores: { umbral: 5, otro: 1 } },
    });
  });
});
