import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AUTOMATIZACIONES, CONTRATO_CANONICO } from './contrato.js';
import { prepararSentencia } from './parametros.js';
import {
  componerSentencia,
  evaluarVistas,
  FORMATOS,
  problemasDePlantilla,
  VALORES_AUTOMATIZACION,
  type FilaVista,
} from './plantillas.js';

/**
 * Unit cases for CH-12 Phase 2: the pure half of automation templates. No database, no
 * Fastify, no connection. The gate (DEC-71), the `WITH` composition (DEC-70) and the
 * save-time parameter checks (DEC-56/57/59) are proven here; the routes that consume
 * them only add I/O around these functions.
 */

/** A persisted view row as the test route will read it: entity, stored SQL and verdict. */
function fila(entidad: string, estadoValidacion: string): FilaVista {
  return { entidad, sql: `SELECT id FROM tabla_${entidad}`, estadoValidacion };
}

// ---- 2.1 / 2.2 the validation gate (DEC-71) ---------------------------------------

describe('evaluarVistas — every composed view needs a passing saved validation', () => {
  test('2.1 every entity valida: ok, vistas in contract order, undeclared rows ignored', () => {
    const filas = [fila('insumo', 'valida'), fila('pedido', 'valida'), fila('producto', 'valida')];
    // Declared out of contract order on purpose; `pedido` has a row but is not declared.
    assert.deepEqual(evaluarVistas(['insumo', 'producto'], filas), {
      ok: true,
      vistas: [
        { entidad: 'producto', sql: 'SELECT id FROM tabla_producto' },
        { entidad: 'insumo', sql: 'SELECT id FROM tabla_insumo' },
      ],
    });
  });

  test('2.1 a missing mapping is no-mapeada, naming the entity (spec "Missing registered view")', () => {
    assert.deepEqual(evaluarVistas(['insumo'], [fila('producto', 'valida')]), {
      ok: false,
      entidades: [{ entidad: 'insumo', estado: 'no-mapeada' }],
    });
  });

  test('2.1 every failing entity is listed, in contract order, with its CH-10 state', () => {
    const filas = [
      fila('receta_componente', 'no-validado'),
      fila('pedido', 'valida'),
      fila('producto', 'invalida'),
    ];
    assert.deepEqual(evaluarVistas(['receta_componente', 'insumo', 'pedido', 'producto'], filas), {
      ok: false,
      entidades: [
        { entidad: 'producto', estado: 'invalida' },
        { entidad: 'insumo', estado: 'no-mapeada' },
        { entidad: 'receta_componente', estado: 'no-validado' },
      ],
    });
  });

  test('2.2 stored entidades outside the contract fail closed by throwing', () => {
    const filas = [fila('producto', 'valida')];
    const corruptas: unknown[] = [
      ['x) ; DROP TABLE producto; --'],
      ['producto', 'cliente'],
      ['producto', 'producto'],
      [],
      [42],
      'producto',
      null,
    ];
    for (const entidades of corruptas) {
      assert.throws(() => evaluarVistas(entidades, filas), /entidades/, JSON.stringify(entidades));
    }
  });

  test('2.2 a stored verdict outside the CH-10 vocabulary fails closed by throwing', () => {
    assert.throws(() => evaluarVistas(['producto'], [fila('producto', 'aprobada')]), /estadoValidacion/);
  });
});

// ---- 2.3 / 2.4 composition (DEC-70, rule 4) ---------------------------------------

describe('componerSentencia — views as v_<entidad> CTEs around the nested template', () => {
  const producto = { entidad: 'producto', sql: 'SELECT id, nombre FROM productos' };
  const insumo = { entidad: 'insumo', sql: 'SELECT id FROM insumos' };

  test('2.3 two entities open WITH v_producto, v_insumo before nesting the template', () => {
    const esperado =
      'WITH v_producto AS (\nSELECT id, nombre FROM productos\n), v_insumo AS (\nSELECT id FROM insumos\n)\n' +
      'SELECT * FROM (\nSELECT * FROM v_producto CROSS JOIN v_insumo\n) AS _plantilla';
    const plantilla = 'SELECT * FROM v_producto CROSS JOIN v_insumo';
    assert.equal(componerSentencia(plantilla, [producto, insumo]), esperado);
    // The CTE order is the contract's, not the caller's.
    assert.equal(componerSentencia(plantilla, [insumo, producto]), esperado);
  });

  test('2.3 a template with its own WITH is nested whole, so its CTEs stay usable', () => {
    const plantilla = 'WITH caros AS (SELECT * FROM v_producto) SELECT * FROM caros';
    assert.equal(
      componerSentencia(plantilla, [producto]),
      'WITH v_producto AS (\nSELECT id, nombre FROM productos\n)\n' +
        'SELECT * FROM (\nWITH caros AS (SELECT * FROM v_producto) SELECT * FROM caros\n) AS _plantilla',
    );
  });

  test('2.3 the alias comes from the contract: an entity outside it throws, never lands in the text', () => {
    for (const vistas of [
      [{ entidad: 'producto AS (SELECT 1)), x', sql: 'SELECT 1' }],
      [producto, producto],
      [],
    ]) {
      assert.throws(() => componerSentencia('SELECT 1', vistas), /componerSentencia/);
    }
  });

  test('2.4 each piece is sanitized exactly once and wrapped in newlines, so a -- comment ends', () => {
    const conComentario = { entidad: 'producto', sql: '  SELECT id FROM productos -- vista\n  ' };
    const dobleSeparador = { entidad: 'insumo', sql: 'SELECT id FROM insumos;;' };
    assert.equal(
      componerSentencia('SELECT * FROM v_producto -- fin;', [conComentario, dobleSeparador]),
      'WITH v_producto AS (\nSELECT id FROM productos -- vista\n), v_insumo AS (\nSELECT id FROM insumos;\n)\n' +
        'SELECT * FROM (\nSELECT * FROM v_producto -- fin\n) AS _plantilla',
    );
  });

  test('2.4 a request value never reaches the composed text: only $k after preparation', () => {
    const texto = componerSentencia('SELECT * FROM v_producto WHERE nombre = :nombre', [producto]);
    const valor = "O'Brien'; DROP TABLE productos; --";
    const preparada = prepararSentencia(texto, [{ nombre: 'nombre', tipo: 'texto' }], { nombre: valor });
    assert.ok(preparada.ok);
    assert.equal(
      preparada.valor.texto,
      'WITH v_producto AS (\nSELECT id, nombre FROM productos\n)\n' +
        'SELECT * FROM (\nSELECT * FROM v_producto WHERE nombre = $1\n) AS _plantilla',
    );
    assert.deepEqual(preparada.valor.valores, [valor]);
  });
});

// ---- 2.5 save-time checks reuse CH-11 (DEC-56, DEC-57, DEC-59) --------------------

describe('problemasDePlantilla — the saved-query parameter rules, unchanged', () => {
  test('2.5 a declared-but-unused parameter is rejected, naming it (DEC-56)', () => {
    assert.deepEqual(problemasDePlantilla('SELECT * FROM v_producto', [{ nombre: 'x', tipo: 'numero' }]), [
      { parametro: 'x', motivo: 'sin-usar', campo: '/parametros/0/nombre' },
    ]);
  });

  test('2.5 an undeclared :marker is rejected, naming it (DEC-57)', () => {
    assert.deepEqual(problemasDePlantilla('SELECT * FROM v_producto WHERE id = :y', []), [
      { parametro: 'y', motivo: 'sin-declarar', campo: '/sql' },
    ]);
  });

  test('2.5 a hand-written $n is rejected regardless of parametros (DEC-59)', () => {
    const sql = 'SELECT * FROM v_producto WHERE id = $1 AND stock < :umbral';
    assert.deepEqual(problemasDePlantilla(sql, [{ nombre: 'umbral', tipo: 'numero' }]), [
      { parametro: '$1', motivo: 'posicional-a-mano', campo: '/sql' },
    ]);
  });

  test('2.5 an invalid declaration is reported alone, before the statement is read', () => {
    assert.deepEqual(problemasDePlantilla('SELECT * FROM v_producto WHERE id = $1', [{ nombre: 'x', tipo: 'moneda' }]), [
      { parametro: 'x', motivo: 'tipo-desconocido', campo: '/parametros/0/tipo' },
    ]);
  });

  test('2.5 a declaration that fits the statement has no problems', () => {
    const sql = 'SELECT * FROM v_producto WHERE "stockDisponible" < :umbral';
    assert.deepEqual(problemasDePlantilla(sql, [{ nombre: 'umbral', tipo: 'numero' }]), []);
  });
});

// ---- constants (DEC-65, DEC-67) --------------------------------------------------

describe('plantillas — closed value sets', () => {
  test('formato accepts only correo-html (DEC-65)', () => {
    assert.deepEqual([...FORMATOS], ['correo-html']);
  });

  test('automatizacion values are exactly AUTOMATIZACIONES (DEC-67)', () => {
    assert.deepEqual(VALORES_AUTOMATIZACION, ['stock-fisico', 'stock-producible', 'reporte-diario']);
    assert.deepEqual(VALORES_AUTOMATIZACION, Object.values(AUTOMATIZACIONES));
  });

  test('every catalog label is a valid template value (closes DEC-22)', () => {
    const etiquetas = CONTRATO_CANONICO.flatMap((e) => e.campos.flatMap((c) => [...c.automatizaciones]));
    assert.ok(etiquetas.length > 0);
    for (const etiqueta of etiquetas) {
      assert.ok(VALORES_AUTOMATIZACION.includes(etiqueta), etiqueta);
    }
  });
});
