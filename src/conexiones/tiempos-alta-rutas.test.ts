import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { registerTiemposAltaRoutes } from './tiempos-alta.js';
import { alcanzable, databaseUrl, motivoSkip, objetivo } from '../consola-auth-apoyo.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** The script's columns and the route's field for each, in the script's order. */
const CAMPOS: [string, string][] = [
  ['conexion_id', 'conexionId'],
  ['alta_inicio', 'altaInicio'],
  ['conexion_registrada', 'conexionRegistrada'],
  ['mapeo_inicio', 'mapeoInicio'],
  ['mapeo_fin', 'mapeoFin'],
  ['validacion_ultima', 'validacionUltima'],
  ['validacion_estado', 'validacionEstado'],
  ['automatizacion_creada', 'automatizacionCreada'],
  ['primera_ejecucion', 'primeraEjecucion'],
  ['primera_ejecucion_estado', 'primeraEjecucionEstado'],
  ['primera_ejecucion_fase', 'primeraEjecucionFase'],
  ['primera_ejecucion_ok', 'primeraEjecucionOk'],
];

/** A fixed 2020 UTC instant, e.g. `t('01-03T10:00')`. */
function t(momento: string): Date {
  return new Date(`2020-${momento}:00.000Z`);
}

/**
 * CH-30e2 (DEC-178): `GET /tiempos-alta` is a second implementation of
 * `scripts/marcas-alta.sql` for the header tenant. This suite runs the checked-in script
 * unchanged and the route on one fixture and requires the same marks, nulls included.
 */
describe('CH-30e2 GET /tiempos-alta — live PostgreSQL target (DEC-178)', { skip: alcanzable ? false : motivoSkip }, () => {
  const MARCA = `CH-30e2 tiempos ${Date.now()}`;
  let app!: FastifyInstance;
  let db!: PrismaClient;
  const tenants: string[] = [];
  const ids = { tenantA: '', tenantB: '', a1: '', a2: '', b1: '' };

  before(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const prisma = extenderConAislamiento(db);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, prisma);
    registerTiemposAltaRoutes(app, prisma);
    await app.ready();

    const plantilla = await db.plantilla.create({
      data: {
        nombre: `${MARCA} plantilla`, sql: 'SELECT * FROM v_producto', entidades: ['producto'],
        automatizacion: 'stock-fisico', formato: 'correo-html', toleranciaFrescuraMinutos: 30,
      },
    });
    const conexion = (tenantId: string, nombre: string, creadaEn: Date) =>
      db.conexion.create({
        data: {
          tenantId, nombre, motor: 'postgresql', host: 'no-se-marca', puerto: 5432, baseDeDatos: 'no-se-marca',
          usuarioDb: 'no-se-marca', credencial: 'no-se-marca', creadaEn, actualizadaEn: creadaEn,
        },
      });
    const automatizacion = (tenantId: string, conexionId: string, creadaEn: Date) =>
      db.automatizacion.create({ data: { tenantId, conexionId, plantillaId: plantilla.id, cron: '0 * * * *', creadaEn } });

    // Tenant A: A1 goes through every stage, A2 is only registered.
    const tenantA = await db.tenant.create({ data: { nombre: `${MARCA} A`, creadoEn: t('01-01T09:00') } });
    tenants.push(tenantA.id);
    const a1 = await conexion(tenantA.id, 'A1 <b>', t('01-01T10:00'));
    const a2 = await conexion(tenantA.id, 'A2', t('01-02T10:00'));
    const producto = await db.vistaCanonica.create({
      data: {
        tenantId: tenantA.id, conexionId: a1.id, entidad: 'producto', sql: 'SELECT 1',
        creadaEn: t('01-03T10:00'), actualizadaEn: t('01-04T10:00'), estadoValidacion: 'valida', validadaEn: t('01-05T10:00'),
      },
    });
    await db.vistaCanonica.updateMany({
      where: { id: producto.id },
      data: { estadoValidacion: 'invalida', validadaEn: t('01-07T10:00'), actualizadaEn: t('01-04T10:00') },
    });
    await db.vistaCanonica.create({
      data: {
        tenantId: tenantA.id, conexionId: a1.id, entidad: 'insumo', sql: 'SELECT 1',
        creadaEn: t('01-03T12:00'), actualizadaEn: t('01-08T10:00'), estadoValidacion: 'valida', validadaEn: t('01-07T10:00'),
      },
    });
    const auto1 = await automatizacion(tenantA.id, a1.id, t('01-09T10:00'));
    const auto2 = await automatizacion(tenantA.id, a1.id, t('01-10T10:00'));
    // Two runs start at the same instant: the tie-break by id decides which is first.
    const corridas: [string, string, string | null, Date][] = [
      [auto1.id, 'fallo', 'preparacion', t('01-09T11:00')],
      [auto2.id, 'fallo', 'ejecucion', t('01-09T11:00')],
      [auto1.id, 'ok', 'ejecucion', t('01-09T13:00')],
      [auto2.id, 'ok', 'ejecucion', t('01-10T12:00')],
    ];
    for (const [automatizacionId, estado, fase, iniciadaEn] of corridas) {
      await db.ejecucion.create({
        data: { tenantId: tenantA.id, automatizacionId, estado, fase, iniciadaEn, finalizadaEn: iniciadaEn },
      });
    }

    // Tenant B: one connection, which A must never see.
    const tenantB = await db.tenant.create({ data: { nombre: `${MARCA} B`, creadoEn: t('02-01T09:00') } });
    tenants.push(tenantB.id);
    const b1 = await conexion(tenantB.id, 'B1', t('02-01T10:00'));
    Object.assign(ids, { tenantA: tenantA.id, tenantB: tenantB.id, a1: a1.id, a2: a2.id, b1: b1.id });
  });

  after(async () => {
    // Every foreign key is RESTRICT, so dependents go first, per fixture tenant.
    if (db !== undefined) {
      const where = { tenantId: { in: tenants } };
      await db.ejecucion.deleteMany({ where });
      await db.automatizacion.deleteMany({ where });
      await db.vistaCanonica.deleteMany({ where });
      await db.conexion.deleteMany({ where });
      await db.tenant.deleteMany({ where: { id: { in: tenants } } });
      await db.plantilla.deleteMany({ where: { nombre: { startsWith: MARCA } } });
      await db.$disconnect();
    }
    await app?.close();
  });

  function listar(tenant: string) {
    return app.inject({ method: 'GET', url: '/tiempos-alta', headers: { 'x-tenant-id': tenant } });
  }

  /** The script's rows for tenant A, as the route would answer them (dates as ISO strings). */
  async function marcasDelScript(): Promise<Record<string, unknown>[]> {
    const sql = await readFile(new URL('../../scripts/marcas-alta.sql', import.meta.url), 'utf8');
    const cliente = new pg.Client({ ...objetivo });
    await cliente.connect();
    // `timestamp(3)` has no zone and holds UTC; node-pg would read it as local time.
    cliente.setTypeParser(1114, (valor: string) => new Date(`${valor.replace(' ', 'T')}Z`));
    try {
      await cliente.query('BEGIN READ ONLY');
      const { rows } = await cliente.query({ name: 'marcas-alta', text: sql });
      await cliente.query('ROLLBACK');
      return rows
        .filter((fila) => fila.tenant_id === ids.tenantA)
        .map((fila) =>
          Object.fromEntries(
            CAMPOS.map(([columna, campo]) => [campo, fila[columna] instanceof Date ? fila[columna].toISOString() : fila[columna]]),
          ),
        );
    } finally {
      await cliente.end();
    }
  }

  test('the route and the script give the same marks for every connection, nulls included', async () => {
    const respuesta = await listar(ids.tenantA);
    assert.equal(respuesta.statusCode, 200);
    const { conexiones, truncado } = respuesta.json();
    assert.equal(truncado, false);
    const deLaRuta = conexiones.map((c: Record<string, unknown>) => Object.fromEntries(CAMPOS.map(([, campo]) => [campo, c[campo]])));
    assert.deepEqual(deLaRuta, await marcasDelScript());
    assert.deepEqual(conexiones.map((c: { conexionId: string }) => c.conexionId), [ids.a1, ids.a2]);
  });

  test('the fixture reaches the cases it is for', async () => {
    const [a1, a2] = (await listar(ids.tenantA)).json().conexiones;
    assert.equal(a1.conexionNombre, 'A1 <b>');
    assert.equal(a1.validacionEstado, 'valida', 'tie on validadaEn: insumo sorts before producto');
    assert.equal(a1.primeraEjecucion, '2020-01-09T11:00:00.000Z');
    assert.equal(a1.primeraEjecucionOk, '2020-01-09T13:00:00.000Z');
    assert.equal(a2.mapeoInicio, null);
    assert.equal(a2.primeraEjecucion, null);
  });

  test('only the header tenant is listed, without credential, host or tenant id', async () => {
    const respuesta = await listar(ids.tenantB);
    const { conexiones } = respuesta.json();
    assert.deepEqual(conexiones.map((c: { conexionId: string }) => c.conexionId), [ids.b1]);
    assert.equal(conexiones[0].altaInicio, '2020-02-01T09:00:00.000Z');
    for (const prohibido of ['credencial', 'no-se-marca', 'tenantId']) {
      assert.ok(!respuesta.body.includes(prohibido), prohibido);
    }
  });

  test('the route requires the tenant header', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/tiempos-alta' });
    assert.equal(respuesta.statusCode, 400);
    assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
  });
});
