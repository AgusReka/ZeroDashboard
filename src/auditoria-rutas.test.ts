import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { registerAuditoriaRoutes } from './auditoria.js';
import { LIMITE_LISTADO } from './listados.js';
import { alcanzable, databaseUrl, motivoSkip } from './consola-auth-apoyo.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

describe(
  'CH-20 GET /auditoria — live PostgreSQL target (DEC-163)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    let db!: PrismaClient;
    let tenantA = '';
    let tenantB = '';

    /** Writes an audit row directly; the route under test only reads. */
    async function fila(tenantId: string, creadoEn: Date, resultado: 'ok' | 'fallo', sql: string) {
      return db.registroEjecucion.create({
        data: {
          tenantId,
          tenantNombre: 'CH-20',
          operadorId: 'op-1',
          operadorNombre: 'ana',
          origen: 'consulta',
          conexionId: 'c-1',
          sql,
          resultado,
          fase: resultado === 'fallo' ? 'ejecucion' : null,
          categoria: resultado === 'fallo' ? 'no-es-lectura' : null,
          filas: resultado === 'ok' ? 1 : null,
          duracionMs: 3,
          creadoEn,
        },
      });
    }

    function listar(tenant: string, query = '') {
      return app.inject({ method: 'GET', url: `/auditoria${query}`, headers: { 'x-tenant-id': tenant } });
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const prisma = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, prisma);
      registerAuditoriaRoutes(app, prisma);
      await app.ready();
      const marca = Date.now();
      tenantA = (await db.tenant.create({ data: { nombre: `CH-20 auditoria A ${marca}` } })).id;
      tenantB = (await db.tenant.create({ data: { nombre: `CH-20 auditoria B ${marca}` } })).id;
      await fila(tenantA, new Date('2026-10-01T10:00:00Z'), 'ok', 'SELECT 1');
      await fila(tenantA, new Date('2026-10-02T10:00:00Z'), 'fallo', 'UPDATE x SET y = 1');
      await fila(tenantA, new Date('2026-10-03T10:00:00Z'), 'ok', 'SELECT 3');
      await fila(tenantB, new Date('2026-10-02T12:00:00Z'), 'fallo', 'SELECT de B');
    });

    after(async () => {
      // Audit rows cannot be deleted (DEC-162); deleting the tenants is enough and works.
      await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      await db.$disconnect();
      await app.close();
    });

    test('lists only the tenant rows, newest first, with every column but the tenant id', async () => {
      const respuesta = await listar(tenantA);
      assert.equal(respuesta.statusCode, 200);
      const { registros, truncado } = respuesta.json();
      assert.equal(truncado, false);
      assert.deepEqual(registros.map((r: { sql: string }) => r.sql), ['SELECT 3', 'UPDATE x SET y = 1', 'SELECT 1']);
      assert.ok(!respuesta.body.includes('SELECT de B'));
      assert.ok(!('tenantId' in registros[0]));
      for (const campo of ['id', 'creadoEn', 'operadorNombre', 'origen', 'conexionId', 'resultado', 'filas', 'duracionMs']) {
        assert.ok(campo in registros[0], campo);
      }
    });

    test('filters by result and by an inclusive date range', async () => {
      const fallidos = (await listar(tenantA, '?resultado=fallo')).json().registros;
      assert.deepEqual(fallidos.map((r: { sql: string }) => r.sql), ['UPDATE x SET y = 1']);
      const rango = (await listar(tenantA, '?desde=2026-10-02T10:00:00Z&hasta=2026-10-03T10:00:00Z')).json().registros;
      assert.deepEqual(rango.map((r: { sql: string }) => r.sql), ['SELECT 3', 'UPDATE x SET y = 1']);
      const nada = (await listar(tenantA, '?desde=2026-11-01')).json().registros;
      assert.deepEqual(nada, []);
    });

    test('an invalid filter is 400 solicitud-invalida naming it', async () => {
      const respuesta = await listar(tenantA, '?desde=ayer&resultado=quizas');
      assert.equal(respuesta.statusCode, 400);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['/desde', '/resultado'] });
    });

    test('the list is capped at the listing limit and says so', async () => {
      const tenantC = (await db.tenant.create({ data: { nombre: `CH-20 auditoria C ${Date.now()}` } })).id;
      try {
        await db.registroEjecucion.createMany({
          data: Array.from({ length: LIMITE_LISTADO + 1 }, (_, i) => ({
            tenantId: tenantC,
            tenantNombre: 'CH-20 C',
            operadorId: 'op-1',
            operadorNombre: 'ana',
            origen: 'consulta',
            conexionId: 'c-1',
            sql: `SELECT ${i}`,
            resultado: 'ok',
          })),
        });
        const { registros, truncado } = (await listar(tenantC)).json();
        assert.equal(registros.length, LIMITE_LISTADO);
        assert.equal(truncado, true);
      } finally {
        await db.tenant.delete({ where: { id: tenantC } });
      }
    });

    test('the route requires the tenant header', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/auditoria' });
      assert.equal(respuesta.statusCode, 400);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    });
  },
);
