import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  analizarSentencia,
  escanearSentencia,
  reescribirMarcadores,
  validarDeclaracion,
  type DeclaracionParametro,
  type Resultado,
} from './parametros.js';

/**
 * Unit cases for CH-11 Phase 1 (DEC-47, DEC-59): the scanner and the `:nombre` → `$k`
 * rewrite. Pure functions, no database. Each case names the scanner state it pins
 * (design "Scanner"), because the rewrite is only as safe as the states that keep a
 * `:` or a `$` from being read where it does not mean a parameter.
 */

/** The marker names the scanner reports, in order of appearance. */
function nombresMarcados(sql: string): string[] {
  return escanearSentencia(sql).marcadores.map((m) => m.nombre);
}

/** The hand-written `$n` tokens the scanner reports, in order of appearance. */
function posicionalesAMano(sql: string): string[] {
  return escanearSentencia(sql).posicionales.map((p) => p.texto);
}

describe('escanearSentencia — normal state', () => {
  test('a :nombre marker is recognized with its exact span', () => {
    const sql = 'SELECT * FROM t WHERE creado >= :desde';
    const { marcadores } = escanearSentencia(sql);
    assert.deepEqual(marcadores, [{ nombre: 'desde', inicio: sql.indexOf(':'), fin: sql.length }]);
  });

  test('a ::cast is not a marker, and the rewrite leaves it unchanged', () => {
    const sql = 'SELECT campo::text, :x::date FROM t';
    assert.deepEqual(nombresMarcados(sql), ['x']);
    assert.equal(reescribirMarcadores(sql, ['x']).texto, 'SELECT campo::text, $1::date FROM t');
  });

  test('a := or a lone colon is literal, not a marker', () => {
    assert.deepEqual(nombresMarcados('SELECT f(a := 1), 2 : 3'), []);
  });

  test('marker names are case-sensitive and stop at the first non-name character', () => {
    assert.deepEqual(nombresMarcados('WHERE a = :Desde AND b = :desde_2) OR c = :x-1'), [
      'Desde',
      'desde_2',
      'x',
    ]);
  });
});

describe('escanearSentencia — a colon inside a protected construct is never a marker', () => {
  const casos: Array<[string, string]> = [
    ['single-quoted string', "SELECT 'hora: 10:30 :x' AS h"],
    ['doubled quote inside a string', "SELECT 'it''s :x' AS h"],
    ['escape string with \\\'', "SELECT E'\\':x' AS h"],
    ['lower-case escape string', "SELECT e'a\\\\' || ':x' AS h"],
    ['double-quoted identifier', 'SELECT "col:x", "a"":y" FROM t'],
    ['-- line comment', 'SELECT 1 -- nota: pendiente :x\n'],
    ['block comment', 'SELECT 1 /* nota: :x */'],
    ['nested block comment', 'SELECT 1 /* a /* b */ :x */'],
    ['$$ dollar quote', 'SELECT $$texto :x$$'],
    ['tagged dollar quote', 'SELECT $t$ :x $$ :y $t$'],
    ['bit and hex strings', "SELECT B'1:x', X'1F:y', U&':z'"],
  ];
  for (const [estado, sql] of casos) {
    test(estado, () => {
      assert.deepEqual(escanearSentencia(sql), { marcadores: [], posicionales: [] });
      assert.equal(reescribirMarcadores(sql, []).texto, sql);
    });
  }

  test('the normal state resumes after each construct closes', () => {
    const sql = "SELECT 'a:b', \"c:d\", $$:e$$ /* :f */ FROM t WHERE x = :g -- :h\nAND y = :i";
    assert.deepEqual(nombresMarcados(sql), ['g', 'i']);
  });

  test('a line comment also ends at a carriage return', () => {
    assert.deepEqual(nombresMarcados('SELECT 1 -- :a\rWHERE b = :b'), ['b']);
  });

  test('without the E prefix a backslash is literal, so the string closes at the next quote', () => {
    assert.deepEqual(nombresMarcados("SELECT 'a\\' = :x"), ['x']);
    // A longer word ending in e is not the prefix: `nombre` is a word, then a plain string.
    assert.deepEqual(nombresMarcados("SELECT nombre'a\\' = :x"), ['x']);
  });
});

describe('escanearSentencia — hand-written $n and words (DEC-59)', () => {
  test('a $n outside any protected construct is reported', () => {
    assert.deepEqual(posicionalesAMano('SELECT * FROM t WHERE id = $1 OR id = $23'), ['$1', '$23']);
  });

  test('a$1 is one identifier, not a hand-written bind', () => {
    assert.deepEqual(posicionalesAMano('SELECT a$1, x$2y FROM t'), []);
  });

  test('a $n inside a literal, comment, identifier or dollar quote is not reported', () => {
    assert.deepEqual(posicionalesAMano("SELECT 'precio: $1', \"$2\", $$ $3 $$ -- $4\n/* $5 */"), []);
  });

  test('a lone $ is literal', () => {
    assert.deepEqual(escanearSentencia('SELECT 1 $ 2'), { marcadores: [], posicionales: [] });
  });

  test('a numeric array slice arr[1:2] has no marker', () => {
    assert.deepEqual(nombresMarcados('SELECT arr[1:2] FROM t'), []);
  });

  test('documented limit: in arr[lo:hi], :hi reads as a marker; arr[lo : hi] does not', () => {
    assert.deepEqual(nombresMarcados('SELECT arr[lo:hi] FROM t'), ['hi']);
    assert.deepEqual(nombresMarcados('SELECT arr[lo : hi] FROM t'), []);
  });

  test('non-ASCII letters are word characters, so no marker hides inside a word', () => {
    assert.deepEqual(escanearSentencia('SELECT año$1, ñandú FROM t'), { marcadores: [], posicionales: [] });
  });
});

describe('escanearSentencia — unterminated constructs run to the end of the text', () => {
  const casos: Array<[string, string]> = [
    ['string', "SELECT 'abierta :x $1"],
    ['escape string', "SELECT E'abierta \\' :x"],
    ['quoted identifier', 'SELECT "abierto :x'],
    ['block comment', 'SELECT 1 /* a /* b */ :x'],
    ['dollar quote', 'SELECT $t$ :x $1'],
    ['line comment without a line break', 'SELECT 1 -- :x'],
  ];
  for (const [estado, sql] of casos) {
    test(estado, () => {
      assert.deepEqual(escanearSentencia(sql), { marcadores: [], posicionales: [] });
    });
  }

  test('a trailing escape backslash at end of text does not throw', () => {
    assert.deepEqual(escanearSentencia("SELECT E'\\"), { marcadores: [], posicionales: [] });
  });
});

describe('reescribirMarcadores — :nombre to $k (DEC-47)', () => {
  test('a repeated name becomes the same $1 at every occurrence', () => {
    const r = reescribirMarcadores('WHERE a = :x OR b = :x', ['x']);
    assert.deepEqual(r, { texto: 'WHERE a = $1 OR b = $1', n: 1 });
  });

  test('$k follows declaration order, not order of appearance', () => {
    const r = reescribirMarcadores('WHERE b = :hasta AND a = :desde AND c = :hasta', ['desde', 'hasta']);
    assert.deepEqual(r, { texto: 'WHERE b = $2 AND a = $1 AND c = $2', n: 2 });
  });

  test('only marker spans change; protected text around them survives', () => {
    const sql = "SELECT ':x', \"y:x\" FROM t WHERE a = :x /* :x */ AND b::int = :x";
    assert.equal(
      reescribirMarcadores(sql, ['x']).texto,
      "SELECT ':x', \"y:x\" FROM t WHERE a = $1 /* :x */ AND b::int = $1",
    );
  });

  test('a marker that is not declared is left as written for the caller to reject', () => {
    assert.equal(reescribirMarcadores('WHERE a = :x AND b = :y', ['x']).texto, 'WHERE a = $1 AND b = :y');
  });

  test('zero markers and zero declared parameters leave the text byte-identical, n = 0', () => {
    const sql = "SELECT id, nombre::text FROM clientes WHERE nota <> 'a:b' -- :c\n";
    const r = reescribirMarcadores(sql, []);
    assert.equal(r.texto, sql);
    assert.equal(r.n, 0);
  });

  test('duplicate declared names are a programming error, not a silent misbinding', () => {
    assert.throws(() => reescribirMarcadores('WHERE a = :x', ['x', 'x']));
  });
});

/**
 * Unit cases for CH-11 Phase 2 (DEC-49, DEC-56, DEC-57, DEC-59): declaration validation
 * and statement analysis. Each problem is pinned by its `motivo`, its `parametro` and its
 * `campo`, because the route renders exactly these three fields.
 */

/** The `motivo`/`parametro` pairs of a result's problems, in order; `[]` when it succeeded. */
function motivos(r: Resultado<unknown>): Array<[string, string | null]> {
  return r.ok ? [] : r.problemas.map((p) => [p.motivo, p.parametro]);
}

describe('validarDeclaracion', () => {
  test('a valid declaration is accepted as a copy of its {nombre, tipo} entries', () => {
    const r = validarDeclaracion([{ nombre: 'desde', tipo: 'fecha', extra: 1 }]);
    assert.deepEqual(r, { ok: true, valor: [{ nombre: 'desde', tipo: 'fecha' }] });
    assert.deepEqual(validarDeclaracion(undefined), { ok: true, valor: [] });
  });

  test('an unknown tipo is rejected naming the entry (DEC-49)', () => {
    const r = validarDeclaracion([
      { nombre: 'x', tipo: 'numero' },
      { nombre: 'y', tipo: 'identificador' },
    ]);
    assert.deepEqual(r, {
      ok: false,
      problemas: [{ parametro: 'y', motivo: 'tipo-desconocido', campo: '/parametros/1/tipo' }],
    });
  });

  test('a malformed nombre and a duplicate nombre are each rejected naming the entry', () => {
    const r = validarDeclaracion([
      { nombre: '1x', tipo: 'texto' },
      { nombre: 'x', tipo: 'texto' },
      { tipo: 'texto' },
      { nombre: 'x', tipo: 'numero' },
    ]);
    assert.ok(!r.ok);
    assert.deepEqual(r.problemas, [
      { parametro: '1x', motivo: 'nombre-invalido', campo: '/parametros/0/nombre' },
      { parametro: null, motivo: 'nombre-invalido', campo: '/parametros/2/nombre' },
      { parametro: 'x', motivo: 'nombre-duplicado', campo: '/parametros/3/nombre' },
    ]);
  });

  test('names are case-sensitive, so x and X are distinct', () => {
    const r = validarDeclaracion([
      { nombre: 'x', tipo: 'texto' },
      { nombre: 'X', tipo: 'texto' },
    ]);
    assert.ok(r.ok);
  });

  test('a container that is not a list is rejected rather than read', () => {
    assert.deepEqual(motivos(validarDeclaracion({ nombre: 'x', tipo: 'texto' })), [['nombre-invalido', null]]);
  });
});

describe('analizarSentencia', () => {
  const x: DeclaracionParametro[] = [{ nombre: 'x', tipo: 'numero' }];

  test('a declared name with no marker is sin-usar (DEC-56)', () => {
    assert.deepEqual(analizarSentencia("SELECT ':x' -- :x\n", x), [
      { parametro: 'x', motivo: 'sin-usar', campo: '/parametros/0/nombre' },
    ]);
  });

  test('a marker absent from the declaration is sin-declarar, reported once (DEC-57)', () => {
    assert.deepEqual(analizarSentencia('WHERE a = :x AND b = :y AND c = :y', x), [
      { parametro: 'y', motivo: 'sin-declarar', campo: '/sql' },
    ]);
  });

  test('a hand-written $n is rejected with or without declared parameters (DEC-59)', () => {
    assert.deepEqual(analizarSentencia('WHERE id = $1', []), [
      { parametro: '$1', motivo: 'posicional-a-mano', campo: '/sql' },
    ]);
    assert.deepEqual(analizarSentencia('WHERE a = :x AND b = $2', x), [
      { parametro: '$2', motivo: 'posicional-a-mano', campo: '/sql' },
    ]);
  });

  test('a $1 inside a literal, a comment or a dollar quote is not rejected', () => {
    assert.deepEqual(analizarSentencia("SELECT 'precio: $1', $$ $2 $$ /* $3 */", []), []);
  });
});
