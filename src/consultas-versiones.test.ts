import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  LIMITE_NOTA,
  analizarVersion,
  mismoContenido,
  resolverNota,
  validarCuerpoConsulta,
  type ContenidoConsulta,
} from './consultas-versiones.js';

/**
 * Unit cases for CH-25 (DEC-146 to DEC-150): the pure half of saved-query versioning. No
 * database, no network, no clock. The create route's own tests (`consultas-guardadas`) stay
 * green unchanged and are the parity proof for `validarCuerpoConsulta`.
 */

describe('validarCuerpoConsulta — the checks the create and the edit share', () => {
  test('a valid body keeps the statement verbatim and copies only nombre and tipo', () => {
    const resultado = validarCuerpoConsulta({
      nombre: 'Stock',
      descripcion: 'Productos con poco stock',
      sql: '  SELECT * FROM v_producto WHERE stock <= :umbral;  ',
      parametros: [{ nombre: 'umbral', tipo: 'numero' }],
    });
    assert.deepEqual(resultado, {
      ok: true,
      datos: {
        nombre: 'Stock',
        descripcion: 'Productos con poco stock',
        sql: '  SELECT * FROM v_producto WHERE stock <= :umbral;  ',
        parametros: [{ nombre: 'umbral', tipo: 'numero' }],
      },
    });
  });

  test('an omitted, null or blank description is stored as null', () => {
    for (const descripcion of [undefined, null, '', '   ', '\t\n']) {
      const resultado = validarCuerpoConsulta({ nombre: 'x', descripcion, sql: 'SELECT 1', parametros: [] });
      assert.equal(resultado.ok && resultado.datos.descripcion, null, JSON.stringify(descripcion));
    }
  });

  test('a statement empty once sanitized is refused and never stored', () => {
    for (const sql of ['', '   ', ';', ' ; ', '\n']) {
      assert.deepEqual(
        validarCuerpoConsulta({ nombre: 'x', sql, parametros: [] }),
        { ok: false, cuerpo: { error: 'solicitud-invalida', campos: ['/sql'] } },
        JSON.stringify(sql),
      );
    }
  });

  test('a declaration that does not fit the statement is refused with its problems', () => {
    const sinDeclarar = validarCuerpoConsulta({ nombre: 'x', sql: 'SELECT :umbral', parametros: [] });
    assert.equal(sinDeclarar.ok, false);
    if (!sinDeclarar.ok) {
      assert.equal(sinDeclarar.cuerpo.error, 'solicitud-invalida');
      assert.ok((sinDeclarar.cuerpo.campos ?? []).length > 0);
      assert.ok(Array.isArray(sinDeclarar.cuerpo.problemas) && sinDeclarar.cuerpo.problemas.length > 0);
    }

    const tipoDesconocido = validarCuerpoConsulta({
      nombre: 'x',
      sql: 'SELECT :a',
      parametros: [{ nombre: 'a', tipo: 'inventado' }],
    });
    assert.equal(tipoDesconocido.ok, false);
  });
});

describe('resolverNota — the optional note of an edit or a restore (DEC-148)', () => {
  test('absent, null and blank give null', () => {
    for (const nota of [undefined, null, '', '   ', '\n\t']) {
      assert.deepEqual(resolverNota(nota), { ok: true, nota: null }, JSON.stringify(nota));
    }
  });

  test('a text is trimmed and kept, up to the limit', () => {
    assert.deepEqual(resolverNota('  Agrega filtro por depósito  '), { ok: true, nota: 'Agrega filtro por depósito' });
    const justa = 'a'.repeat(LIMITE_NOTA);
    assert.deepEqual(resolverNota(justa), { ok: true, nota: justa });
  });

  test('a longer text or a value that is not a string is refused by name', () => {
    for (const nota of ['a'.repeat(LIMITE_NOTA + 1), 5, true, [], {}]) {
      assert.deepEqual(resolverNota(nota), { ok: false, campos: ['/nota'] }, JSON.stringify(nota));
    }
  });

  test('the limit is 500 characters', () => {
    assert.equal(LIMITE_NOTA, 500);
  });
});

describe('mismoContenido — an identical edit creates no version (DEC-150)', () => {
  const base: ContenidoConsulta = {
    nombre: 'Stock',
    descripcion: null,
    sql: 'SELECT :a',
    parametros: [{ nombre: 'a', tipo: 'numero' }],
  };

  test('the same content, including the stored parameters as read back, is the same', () => {
    assert.equal(mismoContenido({ ...base, parametros: [{ nombre: 'a', tipo: 'numero' }] }, base), true);
  });

  test('any change in name, description, statement or parameters is a change', () => {
    assert.equal(mismoContenido(base, { ...base, nombre: 'Stock 2' }), false);
    assert.equal(mismoContenido(base, { ...base, descripcion: 'x' }), false);
    assert.equal(mismoContenido(base, { ...base, sql: 'SELECT :a ' }), false, 'a trailing space is stored, so it is a change');
    assert.equal(mismoContenido(base, { ...base, sql: 'SELECT :a;' }), false, 'the final semicolon is stored too');
    assert.equal(mismoContenido(base, { ...base, parametros: [{ nombre: 'a', tipo: 'texto' }] }), false);
    assert.equal(mismoContenido(base, { ...base, parametros: [] }), false);
  });

  test('the order of the parameters counts, because the server binds $k by it', () => {
    const dos = [{ nombre: 'a', tipo: 'numero' as const }, { nombre: 'b', tipo: 'texto' as const }];
    assert.equal(mismoContenido({ ...base, parametros: dos }, { ...base, parametros: [...dos] }), true);
    assert.equal(mismoContenido({ ...base, parametros: dos }, { ...base, parametros: [...dos].reverse() }), false);
  });

  test('stored parameters that are not a list never match', () => {
    for (const guardado of [null, 'x', {}, 5, [null], ['a']]) {
      assert.equal(mismoContenido({ ...base, parametros: guardado }, base), false, JSON.stringify(guardado));
    }
  });
});

describe('analizarVersion — the :version path segment', () => {
  test('digits only, from 1 to 999999999', () => {
    assert.equal(analizarVersion('1'), 1);
    assert.equal(analizarVersion('42'), 42);
    assert.equal(analizarVersion('999999999'), 999999999);
  });

  test('anything else is not a version', () => {
    for (const texto of ['', '0', '00', '007', '-1', '+1', '1.5', '1e3', 'abc', '1 ', ' 1', '0x1', '١٢', '1000000000', '12a']) {
      assert.equal(analizarVersion(texto), null, JSON.stringify(texto));
    }
  });
});
