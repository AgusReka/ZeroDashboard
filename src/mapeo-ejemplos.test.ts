import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CONTRATO_CANONICO } from './contrato/contrato.js';
import { EJEMPLOS_MAPEO } from './mapeo-ejemplos.js';

/** CH-34 (DEC-176): each example matches its entity in the contract. */

/** The column aliases of a select list: every `AS` between SELECT and the first line starting with FROM. */
function aliasesDe(sql: string): string[] {
  const lista = sql.slice(sql.indexOf('SELECT') + 'SELECT'.length, sql.search(/^FROM\b/m));
  return [...lista.matchAll(/\bAS\s+("[A-Za-z]+"|[a-z_]+)(?=,|\s*$)/gm)].map((m) => m[1]);
}

describe('CH-34 the mapping examples follow the contract', () => {
  test('the keys are exactly the contract entities', () => {
    assert.deepEqual(Object.keys(EJEMPLOS_MAPEO).sort(), CONTRATO_CANONICO.map((e) => e.nombre).sort());
  });

  for (const entidad of CONTRATO_CANONICO) {
    test(`${entidad.nombre}: the alias set equals its fields, camelCase quoted and the rest unquoted`, () => {
      const aliases = aliasesDe(EJEMPLOS_MAPEO[entidad.nombre]);
      const esperados = entidad.campos.map((c) => (/[A-Z]/.test(c.nombre) ? `"${c.nombre}"` : c.nombre));
      assert.deepEqual([...aliases].sort(), [...esperados].sort());
      assert.equal(new Set(aliases).size, aliases.length, 'no alias is repeated');
    });
  }

  test('no example ends with a semicolon, and each is one multi-line SELECT', () => {
    for (const [entidad, sql] of Object.entries(EJEMPLOS_MAPEO)) {
      assert.ok(!sql.trimEnd().endsWith(';'), `${entidad} must not end with ";"`);
      assert.ok(sql.startsWith('SELECT\n'), `${entidad} starts with SELECT`);
      assert.ok(sql.split('\n').length > 1, `${entidad} is stored multi-line`);
    }
  });
});
