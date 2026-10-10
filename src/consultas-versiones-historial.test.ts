import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { LIMITE_LISTADO } from './listados.js';
import { alcanzable, contenido, montarEntorno, motivoSkip, type Entorno } from './consultas-versiones-apoyo.js';

/**
 * CH-25 (DEC-146, DEC-149, DEC-150): `GET /consultas-guardadas/:id/versiones` and
 * `GET /consultas-guardadas/:id/versiones/:version` against a live PostgreSQL target, each
 * with its two-tenant proof (rule 2). The edit has its own file
 * (`consultas-versiones-rutas.test.ts`); the setup is shared (`consultas-versiones-apoyo.ts`).
 */
describe(
  'saved-query history reads — live PostgreSQL target (CH-25 PR2b)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let e!: Entorno;
    before(async () => {
      e = await montarEntorno();
    });
    after(async () => {
      await e.cerrar();
    });

    test('a query never edited lists one current version, with no statement', async () => {
      const consulta = await e.crear(e.a);
      const respuesta = await e.versiones(e.a, consulta.id);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { versiones: Array<Record<string, unknown>>; truncado: boolean };
      assert.equal(cuerpo.truncado, false);
      assert.equal(cuerpo.versiones.length, 1);
      assert.deepEqual(Object.keys(cuerpo.versiones[0]).sort(), ['esActual', 'fecha', 'nota', 'version']);
      assert.equal(cuerpo.versiones[0].version, 1);
      assert.equal(cuerpo.versiones[0].esActual, true);
      assert.ok(!respuesta.body.includes('SELECT'), 'no statement travels in a list');
    });

    test('after two edits the list is newest first and only the newest is current', async () => {
      const consulta = await e.crear(e.a);
      await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 2', parametros: [], nota: 'dos' });
      await e.editar(e.a, consulta.id, { ...contenido, sql: 'SELECT 3', parametros: [], nota: 'tres' });
      const cuerpo = (await e.versiones(e.a, consulta.id)).json() as {
        versiones: Array<{ version: number; nota: string | null; esActual: boolean; fecha: string }>;
      };
      assert.deepEqual(cuerpo.versiones.map((v) => [v.version, v.nota, v.esActual]), [
        [3, 'tres', true],
        [2, 'dos', false],
        [1, null, false],
      ]);
      const fechas = cuerpo.versiones.map((v) => Date.parse(v.fecha));
      assert.ok(fechas[0] >= fechas[1] && fechas[1] >= fechas[2], 'dates never go back');
    });

    test('the list keeps the current version and caps the past ones at the listing limit', async () => {
      const consulta = await e.crear(e.a);
      const exceso = LIMITE_LISTADO + 5;
      await e.db.consultaGuardadaVersion.createMany({
        data: Array.from({ length: exceso }, (_, i) => ({
          tenantId: e.a,
          consultaGuardadaId: consulta.id,
          version: i + 1,
          nombre: 'x',
          sql: 'SELECT 0',
          parametros: [],
          desde: new Date('2026-01-01T00:00:00Z'),
        })),
      });
      await e.db.consultaGuardada.update({ where: { id: consulta.id }, data: { version: exceso + 1 } });
      const cuerpo = (await e.versiones(e.a, consulta.id)).json() as {
        versiones: Array<{ version: number; esActual: boolean }>;
        truncado: boolean;
      };
      assert.equal(cuerpo.versiones.length, LIMITE_LISTADO);
      assert.equal(cuerpo.truncado, true);
      assert.deepEqual([cuerpo.versiones[0].version, cuerpo.versiones[0].esActual], [exceso + 1, true]);
      assert.equal(cuerpo.versiones[1].version, exceso, 'then the most recent past one');
    });

    test('one version returns its full content, the current one included', async () => {
      const consulta = await e.crear(e.a);
      await e.editar(e.a, consulta.id, { ...contenido, nombre: 'Stock v2', sql: 'SELECT 2', parametros: [], nota: 'dos' });
      const pasada = (await e.version(e.a, consulta.id, '1')).json() as { version: Record<string, unknown> };
      assert.deepEqual(
        { ...pasada.version, fecha: undefined },
        { version: 1, fecha: undefined, nota: null, esActual: false, nombre: 'Stock', descripcion: 'Productos', sql: 'SELECT :a', parametros: [{ nombre: 'a', tipo: 'numero' }] },
      );
      const vigente = (await e.version(e.a, consulta.id, '2')).json() as { version: Record<string, unknown> };
      assert.deepEqual(
        { ...vigente.version, fecha: undefined },
        { version: 2, fecha: undefined, nota: 'dos', esActual: true, nombre: 'Stock v2', descripcion: 'Productos', sql: 'SELECT 2', parametros: [] },
      );
    });

    test('a version that is not a positive integer or has no entry is version-no-encontrada', async () => {
      const consulta = await e.crear(e.a);
      for (const numero of ['0', '-1', '1.5', 'abc', '007', '1e3', '999', '2']) {
        const respuesta = await e.version(e.a, consulta.id, numero);
        assert.equal(respuesta.statusCode, 404, numero + respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'version-no-encontrada' }, numero);
      }
    });

    test('an unknown query id is consulta-guardada-no-encontrada on both reads', async () => {
      for (const respuesta of [await e.versiones(e.a, 'no-existe'), await e.version(e.a, 'no-existe', '1')]) {
        assert.equal(respuesta.statusCode, 404, respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'consulta-guardada-no-encontrada' });
      }
    });

    // ---- rule 2: two tenants --------------------------------------------------------------

    test("tenant A cannot read tenant B's history, and the answer equals an unknown id's", async () => {
      const ajena = await e.crear(e.b);
      await e.editar(e.b, ajena.id, { ...contenido, sql: 'SELECT 2', parametros: [], nota: 'de B' });

      const pares = [
        [await e.versiones(e.a, ajena.id), await e.versiones(e.a, 'no-existe')],
        [await e.version(e.a, ajena.id, '1'), await e.version(e.a, 'no-existe', '1')],
        [await e.version(e.a, ajena.id, '2'), await e.version(e.a, 'no-existe', '2')],
      ];
      for (const [ajeno, inexistente] of pares) {
        assert.equal(ajeno.statusCode, 404, ajeno.body);
        assert.equal(ajeno.body, inexistente.body, 'a foreign id is indistinguishable from an unknown one');
        assert.ok(!ajeno.body.includes('de B') && !ajeno.body.includes('SELECT'), "nothing of B's history leaks");
      }
    });

    test('both read routes require the tenant header', async () => {
      const consulta = await e.crear(e.a);
      for (const url of [`/consultas-guardadas/${consulta.id}/versiones`, `/consultas-guardadas/${consulta.id}/versiones/1`]) {
        const respuesta = await e.app.inject({ method: 'GET', url });
        assert.equal(respuesta.statusCode, 400, respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
      }
    });
  },
);
