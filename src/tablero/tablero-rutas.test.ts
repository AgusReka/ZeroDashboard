import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { alcanzable, databaseUrl, motivoSkip } from '../consola/consola-auth-apoyo.js';
import { registerTableroRoutes, type RespuestaTablero } from './tablero-rutas.js';

/**
 * CH-46 (DEC-199) task 3.5: `GET /tablero` and `PUT /tablero` against a live database, with the
 * tenant hooks in front, as `src/app/rutas.ts` mounts them. The operator guard is left out on
 * purpose: `src/app/rutas.test.ts` proves it covers both routes.
 *
 * The app gets no agent registry and the connections carry a credential that is not an
 * envelope, so any attempt to dial a replica would fail the request: a `200` here is also proof
 * that nothing was run.
 */

describe('CH-46 tenant dashboard — live PostgreSQL target (DEC-199)', { skip: alcanzable ? false : motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let db!: PrismaClient;
  const marca = `CH-46 tablero ${Date.now()}-${randomBytes(3).toString('hex')}`;
  const tenantIds: string[] = [];
  /** Per tenant key: its connections, by name. */
  const conexiones: Record<string, Record<string, string>> = {};
  const reportes: Record<string, string> = {};

  async function tenant(clave: string, nombresConexion: string[]): Promise<string> {
    const fila = await db.tenant.create({ data: { nombre: `${marca} ${clave}` } });
    tenantIds.push(fila.id);
    conexiones[clave] = {};
    for (const nombre of nombresConexion) {
      const conexion = await db.conexion.create({
        data: {
          tenantId: fila.id,
          nombre,
          motor: 'postgres',
          host: '127.0.0.1',
          puerto: 1,
          baseDeDatos: 'ninguna',
          usuarioDb: 'nadie',
          credencial: 'no-es-un-sobre',
        },
      });
      conexiones[clave][nombre] = conexion.id;
    }
    return fila.id;
  }

  async function reporte(clave: string, entidades: string[], visualizacion = 'numero'): Promise<void> {
    const fila = await db.reporte.create({
      data: {
        nombre: `${marca} ${clave}`,
        titulo: `Título ${clave}`,
        sql: 'SELECT 1 AS total',
        entidades,
        visualizacion,
        columnas: [{ rol: 'valor', columna: 'total', titulo: 'Total' }],
      },
    });
    reportes[clave] = fila.id;
  }

  let A = '';
  let B = '';

  before(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const aislado = extenderConAislamiento(db);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, aislado);
    registerTableroRoutes(app, aislado);
    await app.ready();
    A = await tenant('A', ['food-store', 'otra']);
    B = await tenant('B', ['de-b']);
    await reporte('r-1', ['producto']);
    await reporte('r-2', ['producto', 'pedido'], 'barras');
    await reporte('r-3', ['insumo']);
    // On A's "food-store", only `producto` is approved; `pedido` exists but is not validated.
    for (const [entidad, estadoValidacion] of [
      ['producto', 'valida'],
      ['pedido', 'no-validado'],
    ] as const) {
      await db.vistaCanonica.create({
        data: { tenantId: A, conexionId: conexiones.A['food-store'], entidad, sql: `SELECT * FROM ${entidad}`, estadoValidacion },
      });
    }
    // On A's "otra", everything is approved.
    for (const entidad of ['producto', 'pedido', 'insumo']) {
      await db.vistaCanonica.create({
        data: { tenantId: A, conexionId: conexiones.A.otra, entidad, sql: `SELECT * FROM ${entidad}`, estadoValidacion: 'valida' },
      });
    }
  });

  after(async () => {
    // RESTRICT everywhere: dashboards and views, then connections, tenants and reports.
    await db.tablero.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.vistaCanonica.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.conexion.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.reporte.deleteMany({ where: { nombre: { startsWith: marca } } });
    await db.$disconnect();
    await app.close();
  });

  function leer(tenantId: string) {
    return app.inject({ method: 'GET', url: '/tablero', headers: { 'x-tenant-id': tenantId } });
  }

  function guardar(tenantId: string, cuerpo: unknown) {
    return app.inject({ method: 'PUT', url: '/tablero', headers: { 'x-tenant-id': tenantId }, payload: cuerpo as object });
  }

  /** The stored row, read on the raw client: what a refusal must leave untouched. */
  function fila(tenantId: string) {
    return db.tablero.findUnique({ where: { tenantId }, select: { conexionId: true, reportes: true } });
  }

  test('a tenant with no dashboard reads as no connection and no reports', async () => {
    const respuesta = await leer(B);
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual(respuesta.json(), { conexionId: null, reportes: [] });
  });

  test('a save answers what GET answers, in the saved order, with pending views that do not block', async () => {
    const guardado = await guardar(A, { conexionId: conexiones.A['food-store'], reportes: [reportes['r-2'], reportes['r-1']] });
    assert.equal(guardado.statusCode, 200, guardado.body);
    const esperado: RespuestaTablero = {
      conexionId: conexiones.A['food-store'],
      reportes: [
        { id: reportes['r-2'], nombre: `${marca} r-2`, titulo: 'Título r-2', visualizacion: 'barras', pendientes: ['pedido'] },
        { id: reportes['r-1'], nombre: `${marca} r-1`, titulo: 'Título r-1', visualizacion: 'numero', pendientes: [] },
      ],
    };
    assert.deepEqual(guardado.json(), esperado);
    const leido = await leer(A);
    assert.equal(leido.statusCode, 200, leido.body);
    assert.deepEqual(leido.json(), esperado);
    assert.ok(!leido.body.includes('SELECT'), 'no stored SQL may reach the body');
  });

  test('a second save replaces the dashboard in the same row, and the order is the new one', async () => {
    await guardar(A, { conexionId: conexiones.A['food-store'], reportes: [reportes['r-1']] });
    const guardado = await guardar(A, { conexionId: conexiones.A.otra, reportes: [reportes['r-1'], reportes['r-3'], reportes['r-2']] });
    assert.equal(guardado.statusCode, 200, guardado.body);
    const { conexionId, reportes: entradas } = (await leer(A)).json() as RespuestaTablero;
    assert.equal(conexionId, conexiones.A.otra);
    assert.deepEqual(entradas.map((e) => e.id), [reportes['r-1'], reportes['r-3'], reportes['r-2']]);
    // Every view is approved on "otra": the pending list follows the connection.
    assert.deepEqual(entradas.map((e) => e.pendientes), [[], [], []]);
    assert.equal(await db.tablero.count({ where: { tenantId: A } }), 1);
  });

  test('a missing view is pending too, by contract order', async () => {
    const guardado = await guardar(A, { conexionId: conexiones.A['food-store'], reportes: [reportes['r-3'], reportes['r-2']] });
    assert.deepEqual(
      (guardado.json() as RespuestaTablero).reportes.map((e) => e.pendientes),
      [['insumo'], ['pedido']],
    );
  });

  test('an empty dashboard is kept with its connection', async () => {
    const guardado = await guardar(A, { conexionId: conexiones.A.otra, reportes: [] });
    assert.equal(guardado.statusCode, 200, guardado.body);
    assert.deepEqual(guardado.json(), { conexionId: conexiones.A.otra, reportes: [] });
    assert.deepEqual((await leer(A)).json(), { conexionId: conexiones.A.otra, reportes: [] });
  });

  test("another tenant's connection is 404 conexion-no-encontrada, and nothing is written", async () => {
    await guardar(A, { conexionId: conexiones.A.otra, reportes: [reportes['r-1']] });
    const antes = await fila(A);
    for (const conexionId of [conexiones.B['de-b'], '11111111-2222-3333-4444-555555555555']) {
      const respuesta = await guardar(A, { conexionId, reportes: [reportes['r-2']] });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
    }
    assert.deepEqual(await fila(A), antes);
    assert.equal(await fila(B), null, "B's connection did not give B a dashboard either");
  });

  test('unknown reports are 400 with desconocidos in body order, and nothing is written', async () => {
    await guardar(A, { conexionId: conexiones.A.otra, reportes: [reportes['r-1']] });
    const antes = await fila(A);
    const respuesta = await guardar(A, {
      conexionId: conexiones.A['food-store'],
      reportes: ['no-existe', reportes['r-2'], 'tampoco'],
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json(), {
      error: 'solicitud-invalida',
      campos: ['/reportes'],
      desconocidos: ['no-existe', 'tampoco'],
    });
    assert.deepEqual(await fila(A), antes);
  });

  test('the checks run in order: the shape before the connection, the connection before the reports', async () => {
    const forma = await guardar(A, { conexionId: conexiones.B['de-b'], reportes: ['no-existe', 'no-existe'] });
    assert.equal(forma.statusCode, 400, forma.body);
    assert.deepEqual((forma.json() as { campos: string[] }).campos, ['/reportes']);
    const conexion = await guardar(A, { conexionId: conexiones.B['de-b'], reportes: ['no-existe'] });
    assert.equal(conexion.statusCode, 404, conexion.body);
  });

  test('two tenants never see each other, and a save of A leaves B unchanged', async () => {
    assert.equal((await guardar(B, { conexionId: conexiones.B['de-b'], reportes: [reportes['r-3']] })).statusCode, 200);
    const deB = await fila(B);
    assert.equal((await guardar(A, { conexionId: conexiones.A.otra, reportes: [reportes['r-1']] })).statusCode, 200);
    const leidoA = await leer(A);
    assert.deepEqual(leidoA.json(), {
      conexionId: conexiones.A.otra,
      reportes: [{ id: reportes['r-1'], nombre: `${marca} r-1`, titulo: 'Título r-1', visualizacion: 'numero', pendientes: [] }],
    });
    assert.ok(!leidoA.body.includes(conexiones.B['de-b']));
    assert.ok(!leidoA.body.includes(B), 'no tenant id may reach the body');
    assert.deepEqual(await fila(B), deB);
    const leidoB = (await leer(B)).json() as RespuestaTablero;
    assert.equal(leidoB.conexionId, conexiones.B['de-b']);
    // B's connection has no view rows: the pending list is per tenant and per connection.
    assert.deepEqual(leidoB.reportes.map((e) => [e.id, e.pendientes]), [[reportes['r-3'], ['insumo']]]);
  });

  test('a body tenantId is refused, never used', async () => {
    const antes = await fila(B);
    const respuesta = await guardar(A, { conexionId: conexiones.A.otra, reportes: [], tenantId: B });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(await fila(B), antes);
  });

  test('reading and saving write no audit row and dial nothing', async () => {
    const antes = await db.registroEjecucion.count({ where: { tenantId: { in: tenantIds } } });
    assert.equal((await guardar(A, { conexionId: conexiones.A['food-store'], reportes: [reportes['r-2']] })).statusCode, 200);
    assert.equal((await leer(A)).statusCode, 200);
    assert.equal(await db.registroEjecucion.count({ where: { tenantId: { in: tenantIds } } }), antes);
  });

  test('two first saves of the same tenant at once both succeed, on one row', async () => {
    const C = await tenant('C', ['de-c']);
    const cuerpos = [
      { conexionId: conexiones.C['de-c'], reportes: [reportes['r-1']] },
      { conexionId: conexiones.C['de-c'], reportes: [reportes['r-2']] },
    ];
    const respuestas = await Promise.all(cuerpos.map((cuerpo) => guardar(C, cuerpo)));
    assert.deepEqual(respuestas.map((r) => r.statusCode), [200, 200], respuestas.map((r) => r.body).join(' | '));
    assert.equal(await db.tablero.count({ where: { tenantId: C } }), 1);
    const guardado = await fila(C);
    assert.ok(cuerpos.some((cuerpo) => JSON.stringify(cuerpo.reportes) === JSON.stringify(guardado?.reportes)));
  });

  test('without x-tenant-id both routes answer 400 tenant-no-indicado', async () => {
    for (const [method, payload] of [
      ['GET', undefined],
      ['PUT', { conexionId: conexiones.A.otra, reportes: [] }],
    ] as const) {
      const respuesta = await app.inject({ method, url: '/tablero', payload });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    }
  });
});
