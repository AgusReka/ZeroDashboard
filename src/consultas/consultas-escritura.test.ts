import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import {
  PALABRAS_DE_ESCRITURA,
  palabraDeEscritura,
  primeraPalabraDeSentencia,
} from '../ejecucion/consulta-ejecucion.js';
import { registerConsultaRoutes } from './consultas.js';

process.env.APP_PORT ??= '3000';
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * UX review C-07 (DEC-204): `POST /consultas/ejecutar` refuses a statement whose first word is a
 * write or DDL keyword, before any parameter check and before the connection is looked up.
 * No database is needed: the stand-in client counts every read of the connection table and
 * answers "not found", so a statement that is NOT refused ends in `404 conexion-no-encontrada`
 * and a refused one never gets there. Any other access to the client throws.
 */
describe('DEC-204 first-word pre-check', () => {
  let app!: FastifyInstance;
  let busquedasDeConexion = 0;

  before(async () => {
    const prisma = new Proxy(
      { conexion: { findUnique: async () => { busquedasDeConexion += 1; return null; } } },
      {
        get(destino, propiedad) {
          if (propiedad in destino) {
            return destino[propiedad as keyof typeof destino];
          }
          throw new Error(`the client was touched: ${String(propiedad)}`);
        },
      },
    ) as unknown as PrismaAislado;
    app = Fastify({ logger: false });
    registerConsultaRoutes(app, prisma);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  async function ejecutar(sql: string, extra: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/consultas/ejecutar',
      payload: { conexionId: 'c-1', sql, ...extra },
    });
  }

  test('the closed list is the eighteen words of DEC-204', () => {
    assert.deepEqual(
      [...PALABRAS_DE_ESCRITURA],
      ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE', 'CREATE', 'ALTER', 'DROP', 'GRANT', 'REVOKE', 'COPY', 'CALL', 'DO', 'COMMENT', 'REINDEX', 'REFRESH', 'VACUUM', 'CLUSTER'],
    );
  });

  for (const palabra of PALABRAS_DE_ESCRITURA) {
    test(`${palabra} is refused as read-only, in the verdict shape of an attempt, without touching the target`, async () => {
      const antes = busquedasDeConexion;
      const respuesta = await ejecutar(`${palabra} algo que no se lee`);
      assert.equal(respuesta.statusCode, 200);
      assert.deepEqual(respuesta.json(), {
        resultado: 'fallo',
        fase: 'ejecucion',
        categoria: 'no-es-lectura',
        codigo: null,
        duracionMs: 0,
        palabra,
      });
      assert.equal(busquedasDeConexion, antes, 'the connection was not even looked up');
    });
  }

  test('lowercase and mixed case are read the same, and the word comes back upper-cased', async () => {
    for (const [sql, palabra] of [['update producto set stock = 0', 'UPDATE'], ['DeLeTe FROM producto', 'DELETE']] as const) {
      const cuerpo = (await ejecutar(sql)).json();
      assert.equal(cuerpo.categoria, 'no-es-lectura');
      assert.equal(cuerpo.palabra, palabra);
    }
  });

  test('leading whitespace, line comments and block comments are skipped', async () => {
    const casos: Array<[string, string]> = [
      ['   \n\t UPDATE producto SET stock = 0', 'UPDATE'],
      ['-- limpiar\nDELETE FROM producto', 'DELETE'],
      ['/* nota */ DROP TABLE producto', 'DROP'],
      ['/* a */ -- b\n  /* c */\ntruncate producto', 'TRUNCATE'],
      ['/* afuera /* adentro */ sigue */ INSERT INTO t VALUES (1)', 'INSERT'],
      ['--x\n--y\nCREATE TABLE t (id int)', 'CREATE'],
    ];
    for (const [sql, palabra] of casos) {
      const cuerpo = (await ejecutar(sql)).json();
      assert.equal(cuerpo.palabra, palabra, sql);
    }
  });

  test('a refused statement is refused before the parameter check, so a write with a bad declaration says read-only', async () => {
    const respuesta = await ejecutar('UPDATE producto SET stock = :n', { parametros: [], valores: {} });
    assert.equal(respuesta.statusCode, 200);
    assert.equal(respuesta.json().palabra, 'UPDATE');
  });

  test('SELECT, WITH, VALUES, TABLE and a parenthesized select pass through to the connection lookup', async () => {
    for (const sql of ['SELECT 1', 'select * from producto', 'WITH x AS (SELECT 1) SELECT * FROM x', '-- c\n/* d */ SELECT 1', '(SELECT 1)', 'VALUES (1)', 'TABLE producto', 'EXPLAIN SELECT 1']) {
      const antes = busquedasDeConexion;
      const respuesta = await ejecutar(sql);
      assert.equal(respuesta.statusCode, 404, sql);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' }, sql);
      assert.equal(busquedasDeConexion, antes + 1, `${sql} reached the connection lookup`);
    }
  });

  test('a word that merely starts like a keyword is not one (UPDATED, DOCUMENT, DELETE_ME)', async () => {
    for (const sql of ['updated_at', 'document', 'delete_me', 'copying', 'created']) {
      assert.equal(palabraDeEscritura(sql), null, sql);
    }
  });

  test('when no first word can be determined nothing is refused here: unclosed comment, no word, empty after comments', () => {
    for (const sql of ['/* sin cerrar UPDATE x', '-- solo un comentario UPDATE', '/* a */', '', '   ', '"UPDATE" x', "'UPDATE'", '123 UPDATE', ';UPDATE t']) {
      assert.equal(palabraDeEscritura(sql), null, JSON.stringify(sql));
    }
    assert.equal(primeraPalabraDeSentencia('/* sin cerrar'), null);
  });

  test('only the first word counts: a write further in is left to the engine (DEC-204, se resigna)', () => {
    for (const sql of ['WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x', 'SELECT * INTO nueva FROM t', 'SELECT 1; UPDATE t SET a = 1']) {
      assert.equal(palabraDeEscritura(sql), null, sql);
    }
  });

  test('a refused statement leaves no audit row: the client is never read for it', async () => {
    // The stand-in throws on any access but the connection table, so a write to the audit table
    // would have turned this answer into a 500.
    assert.equal((await ejecutar('DROP TABLE producto')).statusCode, 200);
  });
});
