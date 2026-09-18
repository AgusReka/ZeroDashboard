import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import {
  ErrorSinTenantActivo,
  conTenantActivo,
  exigirTenantActivo,
  registrarContextoTenant,
  tenantActivoOpcional,
} from './contexto-tenant.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registerHealthRoute } from './health.js';
import { registerConsolaRoute } from './consola.js';
import { registerContratoRoutes } from './contrato-rutas.js';
import { registerTenantRoutes } from './tenants.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';

/**
 * CH-06 tasks 2.1 and 2.2 — the routing boundary the threat matrix marks **applicable**.
 * This change adds the first request-lifecycle hooks in the project, so its safe
 * behavior (scoped by default, closed exemption allowlist matched on the route
 * pattern) and its failure behavior (`400` / `404` / `409` before any handler) are
 * pinned here rather than inferred from the routes that happen to use them.
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * The context cases below the integration block need no server at all: the store is
 * `AsyncLocalStorage`, and "there is no active tenant" is observable without a
 * database. They are deliberately outside the skip so `npm test` still proves the
 * fail-closed half of DEC-13 on a machine with no Docker.
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
// CH-07: loadConfig() now refuses to run without a valid master key (DEC-17), so every
// suite that boots the app supplies a fixture key of its own. It is a literal, not a
// generated value: slice-2 fixtures write envelopes by hand and have to be able to open
// them again in the same run.
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

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

// ---- 2.2 the context primitive itself, with no database in sight ------------------

describe('contexto de tenant — the store fails closed outside a request', () => {
  test('exigirTenantActivo() outside conTenantActivo() throws ErrorSinTenantActivo', () => {
    // This is the property that makes DEC-13 a structural guarantee rather than a
    // convention: the absence of a context is an error, never an unfiltered query.
    assert.throws(() => exigirTenantActivo(), ErrorSinTenantActivo);
  });

  test('tenantActivoOpcional() reports the absence instead of throwing', () => {
    // The diagnostic half of the pair. It exists so a caller that legitimately wants
    // to ask "is there one?" never has to catch the error the enforcing call raises.
    assert.equal(tenantActivoOpcional(), null);
  });

  test('conTenantActivo() makes the tenant visible to everything it runs', async () => {
    const tenant = { id: 'tenant-de-prueba', nombre: 'Prueba' };

    const visto = await conTenantActivo(tenant, async () => {
      // Awaiting in between proves the store survives the async boundary, which is
      // the whole reason AsyncLocalStorage is the mechanism and a module-level
      // variable is not.
      await new Promise((resolve) => setTimeout(resolve, 1));
      return exigirTenantActivo();
    });

    assert.deepEqual(visto, tenant);
    // And the context closes behind it: a later call is outside again.
    assert.throws(() => exigirTenantActivo(), ErrorSinTenantActivo);
  });

  test('a nested conTenantActivo() shadows the outer tenant and then restores it', async () => {
    const externo = { id: 'tenant-externo', nombre: 'Externo' };
    const interno = { id: 'tenant-interno', nombre: 'Interno' };

    await conTenantActivo(externo, async () => {
      assert.equal(exigirTenantActivo().id, externo.id);
      await conTenantActivo(interno, async () => {
        assert.equal(exigirTenantActivo().id, interno.id);
      });
      assert.equal(exigirTenantActivo().id, externo.id);
    });
  });
});

// ---- CH-08 3.1-3.4 the /contrato exemption, still with no database in sight -------

/**
 * DEC-24 exempts `GET /contrato` because the canonical catalog is not tenant data and
 * its handler holds no Prisma client. This block asserts that premise the strong way:
 * the client handed to the hooks is a stub whose only method **throws**. If any request
 * below ever reaches `prisma.tenant.findUnique`, the test fails with that error instead
 * of passing quietly against a database that happened to be running. It is also why the
 * block sits outside the skip — proving an exemption needs no server to prove.
 */
const prismaQueNuncaDebeConsultarse = {
  tenant: {
    findUnique: async (): Promise<never> => {
      throw new Error(
        'una ruta exenta consultó prisma.tenant: el contrato no debe resolver ningún tenant',
      );
    },
  },
} as unknown as PrismaAislado;

describe('contexto de tenant — GET /contrato es exento del encabezado (CH-08, DEC-24)', () => {
  let app!: FastifyInstance;

  before(async () => {
    // Registration order mirrors `src/server.ts`: hooks first, route after, so the
    // exemption is exercised through the same chain production runs.
    app = Fastify({ logger: false });
    registrarContextoTenant(app, prismaQueNuncaDebeConsultarse);
    registerContratoRoutes(app);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('3.1 GET /contrato answers headerless', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/contrato' });

    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { contrato } = respuesta.json() as { contrato: { entidades: unknown[] } };
    assert.equal(contrato.entidades.length, 5);
  });

  test('3.1 GET /contrato answers 200 with a header naming a nonexistent tenant', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/contrato',
      headers: { 'x-tenant-id': '11111111-2222-3333-4444-555555555555' },
    });

    // A scoped route answers `404 tenant-no-encontrado` for this id. The catalog never
    // looks it up, so the id never gets the chance to be wrong — and the throwing stub
    // above is what proves the lookup did not happen rather than merely succeeded.
    assert.equal(respuesta.statusCode, 200, respuesta.body);
  });

  test('3.2 both answers are byte-for-byte the same body', async () => {
    const sinEncabezado = await app.inject({ method: 'GET', url: '/contrato' });
    const conTenantInexistente = await app.inject({
      method: 'GET',
      url: '/contrato',
      headers: { 'x-tenant-id': '11111111-2222-3333-4444-555555555555' },
    });

    // Compared as raw text, not through `json()`: key order and formatting are part of
    // "identical response", and a deep-equal would forgive a difference a client sees.
    assert.equal(sinEncabezado.body, conTenantInexistente.body);
    // The third leg of the spec's claim — the same body as a request carrying a *valid*
    // tenant — needs a real tenant row and therefore lives in the live-database block.
  });

  test('3.3 /contrato-falso with no header is refused, never let through as exempt', async () => {
    // The same discipline `/consola-falsa` and `/tenants-falsos` already prove: the
    // allowlist matches the route pattern exactly, so a name that merely starts with
    // `/contrato` is scoped like everything else and refused before the `404`.
    const respuesta = await app.inject({ method: 'GET', url: '/contrato-falso' });

    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
  });

  test('3.4 POST /contrato with no header is refused: non-GET inherits no exemption', async () => {
    // Independent of the `404` that Phase 2 pins for an unrouted `POST`: this exercises
    // the allowlist itself, which runs in `onRequest` before routing decides anything.
    const respuesta = await app.inject({ method: 'POST', url: '/contrato' });

    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
  });
});

// ---- 2.1 the two onRequest hooks, against a live database -------------------------

describe(
  'contexto de tenant — hook envelopes and exemptions against a live PostgreSQL target',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** Raw client: fixtures, cleanup, and every cross-tenant assertion. */
    let db!: PrismaClient;
    let tenantActivoId!: string;
    let tenantInactivoId!: string;
    const guardadas: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

      const activo = await db.tenant.create({ data: { nombre: `CH-06 hook activo ${Date.now()}` } });
      tenantActivoId = activo.id;
      const inactivo = await db.tenant.create({
        data: { nombre: `CH-06 hook inactivo ${Date.now()}`, activo: false },
      });
      tenantInactivoId = inactivo.id;

      // The app under test is wired exactly the way `src/server.ts` wires it: the
      // extended client is the only handle the routes get, and the context hooks are
      // registered *first*. Same-name hooks run in registration order, so this line
      // being first is what puts the store in place before anything resolves a tenant.
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerHealthRoute(app, aislado);
      registerTenantRoutes(app, aislado);
      registerConsolaRoute(app);
      registerContratoRoutes(app);
      registerConsultaGuardadaRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      if (guardadas.length > 0) {
        await db.consultaGuardada.deleteMany({ where: { id: { in: guardadas } } });
      }
      // Belt and braces: the FK is RESTRICT, so a stray row would make the tenant
      // deletes fail and leave fixtures behind for the next run.
      await db.consultaGuardada.deleteMany({
        where: { tenantId: { in: [tenantActivoId, tenantInactivoId] } },
      });
      await db.conexion.deleteMany({
        where: { tenantId: { in: [tenantActivoId, tenantInactivoId] } },
      });
      await db.tenant.deleteMany({ where: { id: { in: [tenantActivoId, tenantInactivoId] } } });
      await db.$disconnect();
      await app.close();
    });

    // ---- the three failure envelopes ---------------------------------------------

    test('2.1 a scoped route with no X-Tenant-Id answers 400 tenant-no-indicado', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/consultas-guardadas' });

      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
      // A distinct code, not `solicitud-invalida`: the console maps it to one message
      // without parsing `campos`, and there is no offending body field to name.
      assert.ok(!respuesta.body.includes('campos'), 'the envelope carries no campos list');
    });

    test('2.1 an empty or blank X-Tenant-Id is the same as none at all', async () => {
      for (const valor of ['', '   ']) {
        const respuesta = await app.inject({
          method: 'GET',
          url: '/consultas-guardadas',
          headers: { 'x-tenant-id': valor },
        });

        assert.equal(respuesta.statusCode, 400, `${JSON.stringify(valor)}: ${respuesta.body}`);
        assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
      }
    });

    test('2.1 an unknown tenant id answers 404 tenant-no-encontrado', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { 'x-tenant-id': '11111111-2222-3333-4444-555555555555' },
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-encontrado' });
    });

    test('2.1 a deactivated tenant answers 409 tenant-desactivado (DEC-14)', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { 'x-tenant-id': tenantInactivoId },
      });

      // Not `404`: that would erase the very distinction DEC-14 exists to make, since
      // the tenant and its rows are still there. Not `403` either — there is no
      // authentication subject (DEC-04) for an authorization verdict to be about.
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-desactivado' });
    });

    test('2.1 a rejected request never reaches the handler or its query', async () => {
      // The write half of "rejected before any handler logic": a create that names an
      // unknown tenant must leave nothing behind, whatever the handler would have done.
      const nombre = `CH-06 nunca creada ${Date.now()}`;
      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: { 'x-tenant-id': '11111111-2222-3333-4444-555555555555' },
        payload: { nombre, sql: 'SELECT 1' },
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.equal(await db.consultaGuardada.count({ where: { nombre } }), 0);
    });

    // ---- the closed exemption allowlist ------------------------------------------

    test('2.1 GET /health answers headerless', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/health' });

      // Liveness has no tenant and must answer before any tenant exists.
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { status: 'ready', db: 'connected' });
    });

    test('2.1 GET /consola answers headerless', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/consola' });

      // The page *is* where the operator picks a tenant, so requiring one to load it
      // would be a deadlock.
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.match(respuesta.headers['content-type'] as string, /text\/html/);
    });

    test('2.1 every /tenants route answers headerless — bootstrap', async () => {
      // Requiring a tenant to create the first tenant is unsatisfiable, so the whole
      // prefix is exempt rather than just the create.
      const listado = await app.inject({ method: 'GET', url: '/tenants' });
      assert.equal(listado.statusCode, 200, listado.body);

      const creado = await app.inject({
        method: 'POST',
        url: '/tenants',
        payload: { nombre: `CH-06 bootstrap ${Date.now()}` },
      });
      assert.equal(creado.statusCode, 201, creado.body);
      const { tenant } = creado.json() as { tenant: { id: string } };

      const baja = await app.inject({ method: 'POST', url: `/tenants/${tenant.id}/baja` });
      assert.equal(baja.statusCode, 200, baja.body);

      await db.tenant.delete({ where: { id: tenant.id } });
    });

    test('3.2 GET /contrato answers the same body with a valid tenant header as with none', async () => {
      // The leg of the spec that needs a real tenant: "the response body SHALL equal the
      // response body of the same request sent with a valid `x-tenant-id` header". Here
      // the header names a tenant that genuinely exists and is active, so a non-exempt
      // route would resolve it and scope its answer — and the two bodies would diverge.
      const conTenantValido = await app.inject({
        method: 'GET',
        url: '/contrato',
        headers: { 'x-tenant-id': tenantActivoId },
      });
      const sinEncabezado = await app.inject({ method: 'GET', url: '/contrato' });

      assert.equal(conTenantValido.statusCode, 200, conTenantValido.body);
      assert.equal(sinEncabezado.statusCode, 200, sinEncabezado.body);
      assert.equal(sinEncabezado.body, conTenantValido.body);
    });

    test('2.1 the exemption matches the route pattern, not a URL prefix', async () => {
      // `/tenants-falsos` must not pose as `/tenants`. It matches no route, so the
      // headerless request is refused before the 404 — fail-closed, and it leaks
      // nothing about whether the route exists.
      const respuesta = await app.inject({ method: 'GET', url: '/tenants-falsos' });

      assert.notEqual(
        respuesta.statusCode,
        200,
        `an unmatched URL must never pass as exempt: ${respuesta.body}`,
      );
    });

    // ---- the accepted path --------------------------------------------------------

    test('2.1 a known, active tenant reaches the handler and scopes its rows', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: { 'x-tenant-id': tenantActivoId },
        payload: { nombre: `CH-06 aceptada ${Date.now()}`, sql: 'SELECT 1' },
      });

      assert.equal(respuesta.statusCode, 201, respuesta.body);
      const { consultaGuardada } = respuesta.json() as { consultaGuardada: { id: string } };
      guardadas.push(consultaGuardada.id);

      const fila = await db.consultaGuardada.findUnique({
        where: { id: consultaGuardada.id },
        select: { tenantId: true },
      });
      assert.equal(fila?.tenantId, tenantActivoId, 'the row must bind the header\'s tenant');
    });

    test('2.1 two sequential requests with different tenants stay scoped to their own (DEC-15)', async () => {
      // The explicit-per-request model, asserted as such: no server session carries a
      // selection between the two calls, so each one has to stand on its own header.
      const otro = await db.tenant.create({ data: { nombre: `CH-06 segundo ${Date.now()}` } });
      try {
        const propia = await app.inject({
          method: 'POST',
          url: '/consultas-guardadas',
          headers: { 'x-tenant-id': tenantActivoId },
          payload: { nombre: `CH-06 del primero ${Date.now()}`, sql: 'SELECT 1' },
        });
        assert.equal(propia.statusCode, 201, propia.body);
        const { consultaGuardada } = propia.json() as { consultaGuardada: { id: string } };
        guardadas.push(consultaGuardada.id);

        const ajena = await app.inject({
          method: 'GET',
          url: `/consultas-guardadas/${consultaGuardada.id}`,
          headers: { 'x-tenant-id': otro.id },
        });

        assert.equal(ajena.statusCode, 404, ajena.body);
        assert.deepEqual(ajena.json(), { error: 'consulta-guardada-no-encontrada' });
      } finally {
        await db.consultaGuardada.deleteMany({ where: { tenantId: otro.id } });
        await db.tenant.delete({ where: { id: otro.id } });
      }
    });
  },
);
