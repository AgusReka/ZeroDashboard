import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { alcanzable, contenido, montarEntorno, motivoSkip, type Consulta, type Entorno } from './consultas-versiones-apoyo.js';

/**
 * CH-25 (DEC-146 to DEC-150): `PUT /consultas-guardadas/:id` against a live PostgreSQL
 * target, with its two-tenant proof (rule 2). The history reads have their own file
 * (`consultas-versiones-historial.test.ts`); the setup is shared (`consultas-versiones-apoyo.ts`).
 */
describe(
  'saved-query edit — live PostgreSQL target (CH-25 PR2a)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let e!: Entorno;
    before(async () => {
      e = await montarEntorno();
    });
    after(async () => {
      await e.cerrar();
    });

    test('a valid edit archives the previous state, updates the row and bumps the version', async () => {
      const consulta = await e.crear(e.a);
      assert.equal((await e.fila(consulta.id)).version, 1);
      const anteriorActualizadaEn = (await e.fila(consulta.id)).actualizadaEn;

      const respuesta = await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT :a + 1', nota: '  Suma uno  ' });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { consultaGuardada } = respuesta.json() as { consultaGuardada: Consulta };
      assert.equal(consultaGuardada.version, 2);
      assert.equal(consultaGuardada.sql, 'SELECT :a + 1');
      assert.equal(consultaGuardada.nota, 'Suma uno');

      const guardadas = await e.historial(consulta.id);
      assert.equal(guardadas.length, 1);
      assert.equal(guardadas[0].version, 1);
      assert.equal(guardadas[0].sql, 'SELECT :a');
      assert.equal(guardadas[0].nota, null, 'version 1 was reached with no note');
      assert.equal(guardadas[0].desde.getTime(), anteriorActualizadaEn.getTime(), 'desde is when that state became current');
      assert.equal(guardadas[0].tenantId, e.a, 'the archive row is stamped with the active tenant');
    });

    test('each edit keeps the note of the version it archives', async () => {
      const consulta = await e.crear(e.a);
      await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 2', parametros: [], nota: 'primera' });
      await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 3', parametros: [], nota: 'segunda' });
      const guardadas = await e.historial(consulta.id);
      assert.deepEqual(guardadas.map((g) => [g.version, g.sql, g.nota]), [
        [1, 'SELECT :a', null],
        [2, 'SELECT 2', 'primera'],
      ]);
      const actual = await e.fila(consulta.id);
      assert.deepEqual([actual.version, actual.sql, actual.nota], [3, 'SELECT 3', 'segunda']);
    });

    test('an identical edit is 409 sin-cambios and creates nothing, even with a note', async () => {
      const consulta = await e.crear(e.a);
      for (const extra of [{}, { nota: 'solo una nota' }]) {
        const respuesta = await e.editar(e.a, consulta.id, { ...contenido, ...extra });
        assert.equal(respuesta.statusCode, 409, respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'sin-cambios' });
      }
      assert.equal((await e.fila(consulta.id)).version, 1);
      assert.equal((await e.fila(consulta.id)).nota, null);
      assert.equal((await e.historial(consulta.id)).length, 0);
    });

    test('invalid content gives the same 400 body the create gives, and stores nothing', async () => {
      const consulta = await e.crear(e.a);
      const casos = [
        { ...contenido, sql: '   ' },
        { ...contenido, sql: ';' },
        { ...contenido, sql: 'SELECT :otro' },
        { ...contenido, parametros: [{ nombre: 'a', tipo: 'inventado' }] },
        { nombre: '', sql: 'SELECT 1' },
      ];
      for (const caso of casos) {
        const alta = await e.app.inject({ method: 'POST', url: '/consultas-guardadas', headers: e.cabecera(e.a), payload: caso });
        const edicion = await e.editar(e.a, consulta.id, caso);
        assert.equal(edicion.statusCode, 400, JSON.stringify(caso) + edicion.body);
        assert.equal(edicion.statusCode, alta.statusCode);
        assert.equal(edicion.body, alta.body, 'same campos and problemas as the create: ' + JSON.stringify(caso));
      }
      assert.equal((await e.fila(consulta.id)).version, 1);
      assert.equal((await e.historial(consulta.id)).length, 0);
    });

    test('forbidden and unknown keys are refused', async () => {
      const consulta = await e.crear(e.a);
      for (const extra of [{ tenantId: e.b }, { version: 9 }, { id: 'x' }, { creadaEn: '2020-01-01' }, { desconocida: 1 }]) {
        const respuesta = await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 9', ...extra });
        assert.equal(respuesta.statusCode, 400, JSON.stringify(extra) + respuesta.body);
      }
      assert.equal((await e.fila(consulta.id)).sql, 'SELECT :a');
      assert.equal((await e.historial(consulta.id)).length, 0);
    });

    test('the note is optional, blank is null, and a long or non-text note is refused', async () => {
      const consulta = await e.crear(e.a);
      assert.equal((await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 2', parametros: [], nota: '   ' })).statusCode, 200);
      assert.equal((await e.fila(consulta.id)).nota, null);
      for (const nota of ['a'.repeat(501), 5, true, []]) {
        const respuesta = await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 3', parametros: [], nota });
        assert.equal(respuesta.statusCode, 400, JSON.stringify(nota).slice(0, 20) + respuesta.body);
        assert.deepEqual((respuesta.json() as { campos: string[] }).campos, ['/nota']);
      }
      assert.equal((await e.fila(consulta.id)).version, 2, 'only the first edit was applied');
    });

    test('the statement is stored verbatim: spaces, tabs, CRLF and the final semicolon', async () => {
      const consulta = await e.crear(e.a);
      const sql = '  SELECT 1\r\n\tFROM v_producto;  ';
      const respuesta = await e.editar(e.a, consulta.id, { ...contenido, sql, parametros: [] });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.equal((await e.fila(consulta.id)).sql, sql);
    });

    test('an unknown id is 404', async () => {
      const respuesta = await e.editar(e.a, 'no-existe', contenido);
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'consulta-guardada-no-encontrada' });
    });

    test('a conflicting archive is 409 conflicto-de-edicion and the whole edit is rolled back', async () => {
      const consulta = await e.crear(e.a);
      // A history entry for the current version already exists: what a concurrent edit leaves.
      await e.db.consultaGuardadaVersion.create({
        data: { tenantId: e.a, consultaGuardadaId: consulta.id, version: 1, nombre: 'x', sql: 'SELECT 0', parametros: [], desde: new Date() },
      });
      const respuesta = await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 5', parametros: [] });
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conflicto-de-edicion' });
      const actual = await e.fila(consulta.id);
      assert.deepEqual([actual.version, actual.sql], [1, 'SELECT :a'], 'the row did not move');
      assert.equal((await e.historial(consulta.id)).length, 1, 'and no second entry appeared');
    });

    // ---- rule 2: two tenants --------------------------------------------------------------

    test("tenant A cannot edit tenant B's query, and the answer equals an unknown id's", async () => {
      const ajena = await e.crear(e.b);
      await e.editar(e.b, ajena.id, { ...contenido, sql: 'SELECT 2', parametros: [], nota: 'de B' });
      const antes = { fila: await e.fila(ajena.id), historial: await e.historial(ajena.id) };

      const ajeno = await e.editar(e.a, ajena.id, { ...contenido, sql: 'SELECT 666', parametros: [] });
      const inexistente = await e.editar(e.a, 'no-existe', { ...contenido, sql: 'SELECT 666', parametros: [] });
      assert.equal(ajeno.statusCode, 404, ajeno.body);
      assert.equal(ajeno.body, inexistente.body, 'a foreign id is indistinguishable from an unknown one');

      assert.deepEqual(await e.fila(ajena.id), antes.fila, "tenant B's query is untouched");
      assert.deepEqual(await e.historial(ajena.id), antes.historial, 'and so is its history');
    });

    test('the edit route requires the tenant header', async () => {
      const consulta = await e.crear(e.a);
      const respuesta = await e.app.inject({ method: 'PUT', url: `/consultas-guardadas/${consulta.id}`, payload: contenido });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    });
  },
);
