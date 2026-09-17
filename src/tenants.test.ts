import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { registerTenantRoutes } from './tenants.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';

/**
 * CH-06 task 3.1 — T1's lifecycle: alta, listado, baja lógica, and what a frozen
 * tenant rejects (DEC-14).
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * Every tenant this suite creates is removed in `after`, so a seeded development
 * database is left exactly as it was found.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;

interface TenantPayload {
  id: string;
  nombre: string;
  activo: boolean;
  creadoEn: string;
}

/** One TCP handshake, no driver: decides whether this suite has a server to talk to. */
function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  "bring up the Compose db service and set TEST_DB_* (see this file's header)";

describe(
  'tenant routes — integration against a live PostgreSQL target',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** Raw client: fixtures, cleanup, and the assertions the API cannot express. */
    let db!: PrismaClient;
    /** Every tenant this suite creates, removed in `after` by id. */
    const creados: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      // `/tenants` is exempt from tenant resolution, but the hooks are registered
      // anyway — this app has to be the same shape as `src/server.ts`, and the
      // saved-query routes below are what prove the freeze reaches a scoped route.
      registrarContextoTenant(app, aislado);
      registerTenantRoutes(app, aislado);
      registerConsultaGuardadaRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      if (creados.length > 0) {
        // The FK is RESTRICT, so dependent rows go first whatever the outcome above.
        await db.consultaGuardada.deleteMany({ where: { tenantId: { in: creados } } });
        await db.conexion.deleteMany({ where: { tenantId: { in: creados } } });
        await db.tenant.deleteMany({ where: { id: { in: creados } } });
      }
      await db.$disconnect();
      await app.close();
    });

    /** Creates a tenant through the API and asserts the `201`, returning the payload. */
    async function alta(nombre = `CH-06 tenant ${Date.now()}`): Promise<TenantPayload> {
      const respuesta = await app.inject({ method: 'POST', url: '/tenants', payload: { nombre } });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      const { tenant } = respuesta.json() as { tenant: TenantPayload };
      creados.push(tenant.id);
      return tenant;
    }

    async function listar(incluirInactivos = false): Promise<TenantPayload[]> {
      const url = incluirInactivos ? '/tenants?incluirInactivos=true' : '/tenants';
      const respuesta = await app.inject({ method: 'GET', url });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { tenants } = respuesta.json() as { tenants: TenantPayload[] };
      return tenants;
    }

    // ---- 3.1 alta -----------------------------------------------------------------

    test('3.1 a valid alta creates an active tenant and echoes the record', async () => {
      const nombre = `CH-06 alta valida ${Date.now()}`;
      const tenant = await alta(nombre);

      assert.ok(typeof tenant.id === 'string' && tenant.id.length > 0);
      assert.equal(tenant.nombre, nombre);
      assert.equal(tenant.activo, true, 'a newly created tenant is active by default');
      assert.ok(typeof tenant.creadoEn === 'string' && tenant.creadoEn.length > 0);

      // The default lives in the schema, not in the route, so it is checked in the row.
      const fila = await db.tenant.findUnique({ where: { id: tenant.id } });
      assert.equal(fila?.activo, true);
    });

    test('3.1 an alta without nombre is rejected and creates no row', async () => {
      const respuesta = await app.inject({ method: 'POST', url: '/tenants', payload: {} });

      assert.equal(respuesta.statusCode, 400, respuesta.body);
      const cuerpo = respuesta.json() as { error: string; campos: string[] };
      assert.equal(cuerpo.error, 'solicitud-invalida');
      assert.ok(
        cuerpo.campos.includes('/nombre'),
        `the rejection must name the nombre path, got ${JSON.stringify(cuerpo.campos)}`,
      );
      // No `nombre` was submitted, so the absence of a write is proved on `nombre`
      // itself — the same device `consultas-guardadas.test.ts` uses. A before/after
      // table-wide count cannot be used: `npm test` runs the suite files in parallel
      // processes against one database, so another suite's fixture moves the total.
      assert.equal(
        await db.tenant.count({ where: { nombre: '' } }),
        0,
        'a rejected alta must not create a Tenant row',
      );
    });

    test('3.1 an alta carrying an unknown property is rejected, not silently trimmed', async () => {
      // `propertyNames`, not `additionalProperties: false` alone: Fastify's default
      // `removeAdditional: true` would delete the key and answer `201`.
      const nombre = `CH-06 alta con extra ${Date.now()}`;
      const respuesta = await app.inject({
        method: 'POST',
        url: '/tenants',
        payload: { nombre, activo: false },
      });

      assert.equal(respuesta.statusCode, 400, respuesta.body);
      const cuerpo = respuesta.json() as { error: string; campos: string[] };
      assert.ok(
        cuerpo.campos.includes('/activo'),
        `the rejection must name the offending key, got ${JSON.stringify(cuerpo.campos)}`,
      );
      assert.equal(await db.tenant.count({ where: { nombre } }), 0);
      // A request cannot decide `activo`: the only transition is the baja route.
    });

    // ---- 3.1 listado --------------------------------------------------------------

    test('3.1 the listing returns the active tenants that exist', async () => {
      const primero = await alta(`CH-06 listado A ${Date.now()}`);
      const segundo = await alta(`CH-06 listado B ${Date.now()}`);

      const ids = (await listar()).map((t) => t.id);
      assert.ok(ids.includes(primero.id), 'the first active tenant must be listed');
      assert.ok(ids.includes(segundo.id), 'the second active tenant must be listed');
    });

    test('3.1 a deactivated tenant leaves the default listing and returns with the flag', async () => {
      const tenant = await alta(`CH-06 listado baja ${Date.now()}`);

      const baja = await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });
      assert.equal(baja.statusCode, 200, baja.body);

      const activos = (await listar()).map((t) => t.id);
      assert.ok(!activos.includes(tenant.id), 'a deactivated tenant must leave the default listing');

      const todos = await listar(true);
      const encontrado = todos.find((t) => t.id === tenant.id);
      assert.ok(encontrado !== undefined, '?incluirInactivos=true must bring it back');
      assert.equal(encontrado.activo, false);
    });

    test('3.1 anything other than the exact string true keeps the active-only default', async () => {
      // Fail-closed: a typo in the query string must not widen the listing.
      const tenant = await alta(`CH-06 listado query ${Date.now()}`);
      await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });

      for (const valor of ['1', 'false', 'TRUE', '']) {
        const respuesta = await app.inject({
          method: 'GET',
          url: `/tenants?incluirInactivos=${encodeURIComponent(valor)}`,
        });
        assert.equal(respuesta.statusCode, 200, respuesta.body);
        const { tenants } = respuesta.json() as { tenants: TenantPayload[] };
        assert.ok(
          !tenants.some((t) => t.id === tenant.id),
          `${JSON.stringify(valor)} must not opt into inactive tenants`,
        );
      }
    });

    // ---- 3.1 baja lógica (DEC-14) --------------------------------------------------

    test('3.1 a baja flips activo to false and preserves the tenant rows', async () => {
      const tenant = await alta(`CH-06 baja con filas ${Date.now()}`);

      // Two rows created straight through Prisma: the point is that the baja leaves
      // them untouched, not how they got there.
      const conexion = await db.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: 'Replica CH-06',
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: objetivo.user,
          credencial: objetivo.password,
        },
      });
      const guardada = await db.consultaGuardada.create({
        data: { tenantId: tenant.id, nombre: 'CH-06 guardada', sql: 'SELECT 1' },
      });

      const respuesta = await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });

      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { tenant: TenantPayload };
      assert.equal(cuerpo.tenant.id, tenant.id);
      assert.equal(cuerpo.tenant.activo, false);

      // DEC-14's audit half: the rows are still there and still readable directly.
      assert.notEqual(await db.conexion.findUnique({ where: { id: conexion.id } }), null);
      assert.notEqual(await db.consultaGuardada.findUnique({ where: { id: guardada.id } }), null);
      assert.equal((await db.tenant.findUnique({ where: { id: tenant.id } }))?.activo, false);
    });

    test('3.1 a baja on an unknown id answers 404 tenant-no-encontrado', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/tenants/11111111-2222-3333-4444-555555555555/baja',
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-encontrado' });
    });

    test('3.1 repeating the baja answers 409 tenant-desactivado, with no second transition', async () => {
      const tenant = await alta(`CH-06 baja repetida ${Date.now()}`);
      const primera = await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });
      assert.equal(primera.statusCode, 200, primera.body);

      const segunda = await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });

      assert.equal(segunda.statusCode, 409, segunda.body);
      assert.deepEqual(segunda.json(), { error: 'tenant-desactivado' });
      // No duplicate and no contradictory state: the row is exactly as the first left it.
      assert.equal((await db.tenant.findUnique({ where: { id: tenant.id } }))?.activo, false);
    });

    test('3.1 every operation naming a deactivated tenant is rejected before its query', async () => {
      const tenant = await alta(`CH-06 congelado ${Date.now()}`);
      await db.consultaGuardada.create({
        data: { tenantId: tenant.id, nombre: 'CH-06 previa a la baja', sql: 'SELECT 1' },
      });

      const baja = await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });
      assert.equal(baja.statusCode, 200, baja.body);

      // Read and write, both refused by the hook before any handler logic runs.
      const lectura = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { 'x-tenant-id': tenant.id },
      });
      assert.equal(lectura.statusCode, 409, lectura.body);
      assert.deepEqual(lectura.json(), { error: 'tenant-desactivado' });

      const nombre = `CH-06 posterior a la baja ${Date.now()}`;
      const escritura = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: { 'x-tenant-id': tenant.id },
        payload: { nombre, sql: 'SELECT 1' },
      });
      assert.equal(escritura.statusCode, 409, escritura.body);
      assert.equal(await db.consultaGuardada.count({ where: { nombre } }), 0);

      // And the row that existed before the baja is still there, for audit.
      assert.equal(await db.consultaGuardada.count({ where: { tenantId: tenant.id } }), 1);
    });

    // ---- 3.1 no reactivation (DEC-14) ----------------------------------------------

    test('3.1 no route reactivates a tenant', async () => {
      const tenant = await alta(`CH-06 sin reactivacion ${Date.now()}`);
      await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });

      // The shapes a reactivation would plausibly take. None of them exists, and the
      // absence is asserted rather than assumed — DEC-14 has no reactivation at all.
      const intentos = [
        { method: 'POST' as const, url: `/tenants/${tenant.id}/alta` },
        { method: 'PUT' as const, url: `/tenants/${tenant.id}`, payload: { activo: true } },
        { method: 'PATCH' as const, url: `/tenants/${tenant.id}`, payload: { activo: true } },
      ];
      for (const intento of intentos) {
        const respuesta = await app.inject(intento);
        assert.ok(
          respuesta.statusCode === 404 || respuesta.statusCode === 400,
          `${intento.method} ${intento.url} must not exist: ${respuesta.statusCode} ${respuesta.body}`,
        );
      }

      assert.equal(
        (await db.tenant.findUnique({ where: { id: tenant.id } }))?.activo,
        false,
        'the tenant must still be deactivated after every attempt',
      );
    });
  },
);
