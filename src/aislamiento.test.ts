import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import {
  ErrorAislamientoNoSoportado,
  aplicarAlcance,
  extenderConAislamiento,
} from './aislamiento-prisma.js';
import { ErrorSinTenantActivo, registrarContextoTenant } from './contexto-tenant.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';

/**
 * CH-06 tasks 3.2–3.6 — **T2**: "ninguna operación devuelve filas del otro", proven by
 * an automated test rather than by inspection.
 *
 * Two tenants are loaded, each with its own `Conexion` and `ConsultaGuardada`, and
 * every tenant-scoped route is exercised from both sides. The sweep is written as a
 * table over route × tenant on purpose: a route added later that is missing from it is
 * an obvious omission in review, which a hand-written case per route is not.
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * The `aplicarAlcance` cases at the bottom need no server at all and sit outside the
 * skip: the closed operation map is a pure function, and it is the mechanism the whole
 * matrix above depends on.
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

/** Everything one tenant owns in this fixture. */
interface Fixture {
  tenantId: string;
  nombre: string;
  conexionId: string;
  guardadaId: string;
  sqlGuardado: string;
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
  'aislamiento entre tenants — integration against a live PostgreSQL target',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** Raw client: fixtures, cleanup, and every assertion the API cannot express. */
    let db!: PrismaClient;
    let a!: Fixture;
    let b!: Fixture;

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerConexionRoutes(app, aislado);
      registerConsultaRoutes(app, aislado);
      registerConsultaGuardadaRoutes(app, aislado);
      await app.ready();

      a = await montarTenant('A');
      b = await montarTenant('B');
    });

    after(async () => {
      const ids = [a?.tenantId, b?.tenantId].filter((id): id is string => typeof id === 'string');
      if (ids.length > 0) {
        // The FK is RESTRICT, so dependent rows go first.
        await db.consultaGuardada.deleteMany({ where: { tenantId: { in: ids } } });
        await db.conexion.deleteMany({ where: { tenantId: { in: ids } } });
        await db.tenant.deleteMany({ where: { id: { in: ids } } });
      }
      await db.$disconnect();
      await app.close();
    });

    function cabeceras(fixture: Fixture): Record<string, string> {
      return { 'x-tenant-id': fixture.tenantId };
    }

    /**
     * Builds one tenant and its two rows **through the API**, so the fixture itself is
     * evidence that a create binds the header's tenant rather than "the first tenant
     * ever created" — which is what these routes used to do.
     */
    async function montarTenant(etiqueta: string): Promise<Fixture> {
      const nombre = `CH-06 aislamiento ${etiqueta} ${Date.now()}`;
      const tenant = await db.tenant.create({ data: { nombre } });
      const headers = { 'x-tenant-id': tenant.id };

      const registro = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers,
        payload: {
          nombre: `Replica ${etiqueta}`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: objetivo.user,
          credencial: objetivo.password,
        },
      });
      assert.equal(registro.statusCode, 201, registro.body);
      const { conexion } = registro.json() as { conexion: { id: string } };

      const sqlGuardado = `SELECT '${etiqueta}' AS duenio_ch06`;
      const guardado = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers,
        payload: { nombre: `Consulta de ${etiqueta}`, sql: sqlGuardado },
      });
      assert.equal(guardado.statusCode, 201, guardado.body);
      const { consultaGuardada } = guardado.json() as { consultaGuardada: { id: string } };

      return {
        tenantId: tenant.id,
        nombre,
        conexionId: conexion.id,
        guardadaId: consultaGuardada.id,
        sqlGuardado,
      };
    }

    // ---- 3.4 a create binds the header's tenant ------------------------------------

    test('3.4 every created row belongs to the tenant its request declared', async () => {
      // The fixture above went through the API, so this reads back what the isolation
      // extension injected. Before CH-06 both rows would have landed on whichever
      // tenant was created first in the database.
      for (const fixture of [a, b]) {
        const conexion = await db.conexion.findUnique({
          where: { id: fixture.conexionId },
          select: { tenantId: true },
        });
        const guardada = await db.consultaGuardada.findUnique({
          where: { id: fixture.guardadaId },
          select: { tenantId: true },
        });

        assert.equal(conexion?.tenantId, fixture.tenantId, `${fixture.nombre}: conexion`);
        assert.equal(guardada?.tenantId, fixture.tenantId, `${fixture.nombre}: consulta guardada`);
      }
      assert.notEqual(a.tenantId, b.tenantId, 'the two fixtures must be different tenants');
    });

    // ---- 3.3 the sweep: every scoped route, from both sides -------------------------

    /**
     * One row per tenant-scoped route. `propio` is the control — the same route,
     * against the caller's own id, must keep working — and `ajeno` is the isolation
     * claim. Both directions are run for every row, so neither tenant is privileged.
     */
    const rutas = [
      {
        nombre: 'GET /consultas-guardadas/:id',
        errorEsperado: 'consulta-guardada-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'GET',
            url: `/consultas-guardadas/${duenio.guardadaId}`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      },
      {
        nombre: 'POST /conexiones/:id/prueba',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'POST',
            url: `/conexiones/${duenio.conexionId}/prueba`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      },
      {
        nombre: 'POST /consultas/ejecutar',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'POST',
            url: '/consultas/ejecutar',
            headers: cabeceras(llamante),
            payload: { conexionId: duenio.conexionId, sql: 'SELECT 1' },
          }),
        exitoso: 200,
      },
    ];

    for (const ruta of rutas) {
      test(`3.3 ${ruta.nombre} answers 404 for the other tenant's id, both ways`, async () => {
        for (const [llamante, duenio] of [
          [a, b],
          [b, a],
        ] as const) {
          const respuesta = await ruta.pedir(llamante, duenio);

          assert.equal(
            respuesta.statusCode,
            404,
            `${ruta.nombre}: ${llamante.nombre} reached ${duenio.nombre}: ${respuesta.body}`,
          );
          assert.deepEqual(respuesta.json(), { error: ruta.errorEsperado });
          // Nothing of the owner's may leak through the refusal — not the stored
          // statement, not the credential, not the tenant id.
          assert.ok(!respuesta.body.includes(duenio.sqlGuardado));
          assert.ok(!respuesta.body.includes(objetivo.password));
          assert.ok(!respuesta.body.includes(duenio.tenantId));
        }
      });

      test(`3.3 ${ruta.nombre} still works against the caller's own id`, async () => {
        // Without this control the isolation assertion above would also pass if the
        // route were simply broken for everyone.
        for (const fixture of [a, b]) {
          const respuesta = await ruta.pedir(fixture, fixture);
          assert.equal(
            respuesta.statusCode,
            ruta.exitoso,
            `${ruta.nombre} must keep working for its owner: ${respuesta.body}`,
          );
        }
      });
    }

    test("3.3 the listing never shows the other tenant's saved queries", async () => {
      for (const [llamante, duenio] of [
        [a, b],
        [b, a],
      ] as const) {
        const respuesta = await app.inject({
          method: 'GET',
          url: '/consultas-guardadas',
          headers: cabeceras(llamante),
        });

        assert.equal(respuesta.statusCode, 200, respuesta.body);
        const { consultasGuardadas } = respuesta.json() as {
          consultasGuardadas: { id: string }[];
        };
        const ids = consultasGuardadas.map((f) => f.id);

        assert.ok(ids.includes(llamante.guardadaId), 'the caller must see its own row');
        assert.ok(
          !ids.includes(duenio.guardadaId),
          `${llamante.nombre} must not see ${duenio.nombre}'s saved query`,
        );
        assert.ok(!respuesta.body.includes(duenio.tenantId));
      }
    });

    test('3.3 executing against the other tenant sends no statement to its target', async () => {
      // The `404` above is the response-level claim; this is the effect-level one.
      // A statement that would have written is submitted against the other tenant's
      // connection: if the lookup were not scoped, the row count would move.
      const antes = await db.consultaGuardada.count({ where: { tenantId: b.tenantId } });

      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas/ejecutar',
        headers: cabeceras(a),
        payload: {
          conexionId: b.conexionId,
          sql: `DELETE FROM "ConsultaGuardada" WHERE "tenantId" = '${b.tenantId}'`,
        },
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.equal(
        await db.consultaGuardada.count({ where: { tenantId: b.tenantId } }),
        antes,
        "no statement may have reached the other tenant's target",
      );
    });

    // ---- 3.5 rule 2 is unchanged ----------------------------------------------------

    test('3.5 a body carrying tenantId is still 400 on both create routes', async () => {
      // Rule 2's body-level prohibition survives CH-06 untouched: the header is the
      // only channel, so a `tenantId` in a body is as invalid as it ever was.
      const ajeno = b.tenantId;

      const guardada = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: cabeceras(a),
        payload: { nombre: `CH-06 regla 2 ${Date.now()}`, sql: 'SELECT 1', tenantId: ajeno },
      });
      assert.equal(guardada.statusCode, 400, guardada.body);
      assert.ok((guardada.json() as { campos: string[] }).campos.includes('/tenantId'));

      const conexion = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: cabeceras(a),
        payload: {
          nombre: `CH-06 regla 2 conexion ${Date.now()}`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: objetivo.user,
          credencial: objetivo.password,
          tenantId: ajeno,
        },
      });
      assert.equal(conexion.statusCode, 400, conexion.body);

      // And nothing landed on the named tenant either way.
      assert.equal(
        await db.consultaGuardada.count({ where: { tenantId: ajeno } }),
        1,
        "the other tenant must still own exactly its fixture row",
      );
    });

    // ---- 3.6 the extension itself, against the live client --------------------------

    test('3.6 a scoped query outside any tenant context rejects and runs nothing', async () => {
      const aislado = extenderConAislamiento(db);
      const marca = `CH-06 sin contexto ${Date.now()}`;

      // No `conTenantActivo` and no request: `exigirTenantActivo()` throws before the
      // query is ever handed to Prisma. A silent unfiltered read here is exactly the
      // leak this whole change exists to prevent.
      await assert.rejects(() => aislado.consultaGuardada.findMany({}), ErrorSinTenantActivo);
      await assert.rejects(
        () =>
          aislado.consultaGuardada.create({ data: { nombre: marca, sql: 'SELECT 1' } } as never),
        ErrorSinTenantActivo,
      );

      // The absence of a write is proved on the marker, not on a before/after total:
      // `npm test` runs the suite files in parallel processes against one database,
      // so a table-wide count moves under this test for reasons that are not its own.
      assert.equal(
        await db.consultaGuardada.count({ where: { nombre: marca } }),
        0,
        'a rejected scoped query must not have written anything',
      );
    });

    test('3.6 Tenant is not a scoped model, so the resolution hook has no escape hatch', async () => {
      // The other half of the same claim: `Tenant` is deliberately absent from
      // MODELOS_AISLADOS, which is what lets the hook and `src/tenants.ts` share this
      // one client. If it were scoped, resolving a tenant would need an unscoped
      // handle and the guarantee would have a hole in it by construction.
      const aislado = extenderConAislamiento(db);
      const tenant = await aislado.tenant.findUnique({ where: { id: a.tenantId } });
      assert.equal(tenant?.id, a.tenantId);
    });
  },
);

// ---- 3.6 the closed operation map, as a pure function ------------------------------

describe('aplicarAlcance — the closed operation map', () => {
  const TENANT = 'tenant-activo';

  test('create receives tenantId, overwriting anything supplied', () => {
    const alcanzado = aplicarAlcance('create', { data: { nombre: 'x' } }, TENANT);
    assert.deepEqual(alcanzado, { data: { nombre: 'x', tenantId: TENANT } });

    const forzado = aplicarAlcance('create', { data: { nombre: 'x', tenantId: 'ajeno' } }, TENANT);
    assert.deepEqual(forzado, { data: { nombre: 'x', tenantId: TENANT } });
  });

  test('createMany receives tenantId on every entry, preserving the shape', () => {
    const arreglo = aplicarAlcance('createMany', { data: [{ n: 1 }, { n: 2 }] }, TENANT);
    assert.deepEqual(arreglo, {
      data: [
        { n: 1, tenantId: TENANT },
        { n: 2, tenantId: TENANT },
      ],
    });

    // Prisma accepts a single entry too, and the injection must not turn it into an
    // array behind the caller's back.
    const unico = aplicarAlcance('createManyAndReturn', { data: { n: 1 } }, TENANT);
    assert.deepEqual(unico, { data: { n: 1, tenantId: TENANT } });
  });

  test('a filter operation is AND-wrapped, never spread', () => {
    const alcanzado = aplicarAlcance('findMany', { where: { nombre: 'x' }, take: 5 }, TENANT);
    assert.deepEqual(alcanzado, {
      where: { AND: [{ nombre: 'x' }, { tenantId: TENANT }] },
      take: 5,
    });

    // An absent `where` still gets one.
    assert.deepEqual(aplicarAlcance('count', {}, TENANT), {
      where: { AND: [{}, { tenantId: TENANT }] },
    });
  });

  test("a caller's tenantId or OR cannot displace the injected predicate", () => {
    // This is why the injection is a conjunction rather than a spread: whatever the
    // caller's object says, the injected predicate applies at the top level.
    const forzado = aplicarAlcance('findMany', { where: { tenantId: 'ajeno' } }, TENANT);
    assert.deepEqual(forzado, {
      where: { AND: [{ tenantId: 'ajeno' }, { tenantId: TENANT }] },
    });

    const ensanchado = aplicarAlcance(
      'findMany',
      { where: { OR: [{ tenantId: 'ajeno' }, { tenantId: TENANT }] } },
      TENANT,
    );
    assert.deepEqual(ensanchado, {
      where: {
        AND: [{ OR: [{ tenantId: 'ajeno' }, { tenantId: TENANT }] }, { tenantId: TENANT }],
      },
    });
  });

  test('a unique selector gains tenantId, overwriting a supplied one', () => {
    // Legal since Prisma 5 widened `WhereUniqueInput`; this project is on 7.10. There
    // is no combinator inside a unique selector to hide behind, so overwriting is safe.
    assert.deepEqual(aplicarAlcance('findUnique', { where: { id: 'fila' } }, TENANT), {
      where: { id: 'fila', tenantId: TENANT },
    });
    assert.deepEqual(
      aplicarAlcance('delete', { where: { id: 'fila', tenantId: 'ajeno' } }, TENANT),
      { where: { id: 'fila', tenantId: TENANT } },
    );
  });

  test('an unlisted operation throws instead of passing through', () => {
    // The allowlist inverts the default: a future contributor's `upsert` fails in
    // their first test run rather than quietly crossing tenants in production.
    for (const operacion of ['upsert', 'aggregateRaw', 'updateManyAndReturn', 'findRaw']) {
      assert.throws(
        () => aplicarAlcance(operacion, {}, TENANT),
        ErrorAislamientoNoSoportado,
        `${operacion} must not be silently allowed`,
      );
    }
  });

  test('the caller’s args object is never mutated', () => {
    const original = { where: { nombre: 'x' } };
    aplicarAlcance('findMany', original, TENANT);
    assert.deepEqual(original, { where: { nombre: 'x' } });
  });
});
