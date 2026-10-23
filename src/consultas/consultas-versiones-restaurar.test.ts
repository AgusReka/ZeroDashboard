import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { alcanzable, contenido, montarEntorno, motivoSkip, type Consulta, type Entorno } from './consultas-versiones-apoyo.js';

/**
 * CH-25 (DEC-147, DEC-150): `POST /consultas-guardadas/:id/versiones/:version/restaurar`
 * against a live PostgreSQL target, with its two-tenant proof (rule 2). Restoring creates a
 * new version, copies the content exactly as stored, and deletes nothing. The setup is
 * shared (`consultas-versiones-apoyo.ts`).
 */
describe(
  'saved-query restore — live PostgreSQL target (CH-25 PR3)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let e!: Entorno;
    before(async () => {
      e = await montarEntorno();
    });
    after(async () => {
      await e.cerrar();
    });

    /** A query taken to version `n` by `n - 1` edits, each with its own statement and note. */
    async function hastaVersion(tenantId: string, n: number): Promise<Consulta> {
      const consulta = await e.crear(tenantId);
      for (let v = 2; v <= n; v++) {
        const respuesta = await e.editar(tenantId, consulta.id, { ...contenido, nombre: `Stock v${v}`, sql: `SELECT ${v}`, parametros: [], nota: `edición ${v}` });
        assert.equal(respuesta.statusCode, 200, respuesta.body);
      }
      return consulta;
    }

    test('restoring version 2 at version 5 creates version 6 with the content of version 2, and the history only grows', async () => {
      const consulta = await hastaVersion(e.a, 5);
      const antes = await e.historial(consulta.id);
      assert.equal(antes.length, 4);

      const respuesta = await e.restaurar(e.a, consulta.id, '2', { nota: 'volvemos a la 2' });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { consultaGuardada } = respuesta.json() as { consultaGuardada: Consulta };
      assert.equal(consultaGuardada.version, 6);
      assert.equal(consultaGuardada.nombre, 'Stock v2');
      assert.equal(consultaGuardada.sql, 'SELECT 2');
      assert.equal(consultaGuardada.nota, 'volvemos a la 2');

      const despues = await e.historial(consulta.id);
      assert.deepEqual(despues.map((g) => g.version), [1, 2, 3, 4, 5], 'version 5 was archived, nothing was deleted');
      assert.deepEqual(despues.slice(0, 4), antes, 'the earlier entries are untouched, field by field');
      assert.equal(despues[4].sql, 'SELECT 5');
      assert.equal(despues[4].nota, 'edición 5');

      const lista = (await e.versiones(e.a, consulta.id)).json() as { versiones: Array<{ version: number; esActual: boolean }> };
      assert.deepEqual(lista.versiones.map((v) => v.version), [6, 5, 4, 3, 2, 1]);
      assert.equal(lista.versiones.filter((v) => v.esActual).length, 1);
    });

    test('the statement and the parameters are copied exactly as stored', async () => {
      const consulta = await e.crear(e.a);
      const sql = '  SELECT :a\r\n\tFROM v_producto  WHERE x = :a;  ';
      assert.equal((await e.editar(e.a, consulta.id, { ...contenido, sql, descripcion: 'con descripción' })).statusCode, 200);
      assert.equal((await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 3', parametros: [] })).statusCode, 200);
      const guardada = (await e.historial(consulta.id)).find((g) => g.version === 2);
      assert.ok(guardada !== undefined);

      const respuesta = await e.restaurar(e.a, consulta.id, '2');
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const actual = await e.fila(consulta.id);
      assert.equal(actual.sql, sql, 'byte for byte, trailing spaces, CRLF, tabs and the final semicolon included');
      assert.equal(actual.sql, guardada.sql);
      assert.deepEqual(actual.parametros, guardada.parametros);
      assert.equal(actual.descripcion, 'con descripción');
      assert.equal(actual.nombre, 'Stock');
    });

    test('the note is optional: absent, an empty body and blank all store null; long or non-text is refused', async () => {
      const consulta = await hastaVersion(e.a, 3);
      assert.equal((await e.restaurar(e.a, consulta.id, '1')).statusCode, 200, 'no body at all');
      assert.equal((await e.fila(consulta.id)).nota, null);
      assert.equal((await e.restaurar(e.a, consulta.id, '1', {})).statusCode, 200);
      assert.equal((await e.restaurar(e.a, consulta.id, '2', { nota: '   ' })).statusCode, 200);
      assert.equal((await e.fila(consulta.id)).nota, null);
      const version = (await e.fila(consulta.id)).version;
      for (const nota of ['a'.repeat(501), 5, true, []]) {
        const respuesta = await e.restaurar(e.a, consulta.id, '1', { nota });
        assert.equal(respuesta.statusCode, 400, JSON.stringify(nota).slice(0, 20) + respuesta.body);
        assert.deepEqual((respuesta.json() as { campos: string[] }).campos, ['/nota']);
      }
      assert.equal((await e.fila(consulta.id)).version, version, 'the refused ones changed nothing');
    });

    test('an unknown key in the body is refused and nothing changes', async () => {
      const consulta = await hastaVersion(e.a, 2);
      for (const cuerpo of [{ sql: 'SELECT 666' }, { tenantId: e.b }, { version: 9 }]) {
        const respuesta = await e.restaurar(e.a, consulta.id, '1', cuerpo);
        assert.equal(respuesta.statusCode, 400, JSON.stringify(cuerpo) + respuesta.body);
      }
      assert.equal((await e.fila(consulta.id)).version, 2);
    });

    test('restoring the current version is 409 version-vigente and changes nothing', async () => {
      const consulta = await hastaVersion(e.a, 3);
      const respuesta = await e.restaurar(e.a, consulta.id, '3');
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'version-vigente' });
      assert.equal((await e.fila(consulta.id)).version, 3);
      assert.equal((await e.historial(consulta.id)).length, 2);
    });

    test('a version that does not exist is version-no-encontrada, an unknown query is consulta-guardada-no-encontrada', async () => {
      const consulta = await hastaVersion(e.a, 2);
      for (const numero of ['0', '-1', '1.5', 'abc', '007', '1e3', '999']) {
        const respuesta = await e.restaurar(e.a, consulta.id, numero);
        assert.equal(respuesta.statusCode, 404, numero + respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'version-no-encontrada' }, numero);
      }
      const sinConsulta = await e.restaurar(e.a, 'no-existe', '1');
      assert.equal(sinConsulta.statusCode, 404, sinConsulta.body);
      assert.deepEqual(sinConsulta.json(), { error: 'consulta-guardada-no-encontrada' });
      assert.equal((await e.fila(consulta.id)).version, 2);
    });

    test('a conflicting archive is 409 conflicto-de-edicion and the row does not move', async () => {
      const consulta = await hastaVersion(e.a, 2);
      // The entry for the current version (2) already exists: what a concurrent restore leaves.
      await e.db.consultaGuardadaVersion.create({
        data: { tenantId: e.a, consultaGuardadaId: consulta.id, version: 2, nombre: 'x', sql: 'SELECT 0', parametros: [], desde: new Date() },
      });
      const respuesta = await e.restaurar(e.a, consulta.id, '1');
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conflicto-de-edicion' });
      const actual = await e.fila(consulta.id);
      assert.deepEqual([actual.version, actual.sql], [2, 'SELECT 2']);
      assert.equal((await e.historial(consulta.id)).length, 2, 'and no third entry appeared');
    });

    // ---- rule 2: two tenants --------------------------------------------------------------

    test("tenant A cannot restore a version of tenant B's query, and the answer equals an unknown id's", async () => {
      const ajena = await hastaVersion(e.b, 3);
      const antes = { fila: await e.fila(ajena.id), historial: await e.historial(ajena.id) };

      for (const numero of ['1', '2', '3']) {
        const ajeno = await e.restaurar(e.a, ajena.id, numero);
        const inexistente = await e.restaurar(e.a, 'no-existe', numero);
        assert.equal(ajeno.statusCode, 404, numero + ajeno.body);
        assert.equal(ajeno.body, inexistente.body, 'a foreign id is indistinguishable from an unknown one');
      }
      assert.deepEqual(await e.fila(ajena.id), antes.fila, "tenant B's query is untouched");
      assert.deepEqual(await e.historial(ajena.id), antes.historial, 'and so is its history');
    });

    test("restoring in tenant A never touches tenant B's queries", async () => {
      const deB = await hastaVersion(e.b, 2);
      const antesB = await e.fila(deB.id);
      const deA = await hastaVersion(e.a, 3);
      assert.equal((await e.restaurar(e.a, deA.id, '1')).statusCode, 200);
      assert.deepEqual(await e.fila(deB.id), antesB);
    });

    test('the restore route requires the tenant header', async () => {
      const consulta = await hastaVersion(e.a, 2);
      const respuesta = await e.app.inject({ method: 'POST', url: `/consultas-guardadas/${consulta.id}/versiones/1/restaurar` });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    });
  },
);
