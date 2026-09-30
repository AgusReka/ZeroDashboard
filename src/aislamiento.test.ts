import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import {
  ErrorAislamientoNoSoportado,
  aplicarAlcance,
  extenderConAislamiento,
} from './aislamiento-prisma.js';
import {
  ErrorSinTenantActivo,
  conTenantActivo,
  registrarContextoTenant,
} from './contexto-tenant.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registerVistaCanonicaRoutes } from './vistas-canonicas.js';
import { registerValidacionMapeoRoutes } from './validacion-mapeo-rutas.js';
import { registerPlantillaPruebaRoute } from './plantilla-prueba.js';
import { registerAutomatizacionRoutes } from './automatizaciones-rutas.js';
import { crearPlanificador } from './planificador.js';
import { cifrarCredencial } from './cripto-credencial.js';
import type { Correo } from './correo.js';
import type { Notificador } from './notificador.js';

/**
 * CH-06 tasks 3.2–3.6 — **T2**: "ninguna operación devuelve filas del otro", proven by
 * an automated test rather than by inspection.
 *
 * Two tenants are loaded, each with its own `Conexion`, `ConsultaGuardada` and (CH-09)
 * `VistaCanonica`, whose mapping each validates (CH-10), plus (CH-13) an `Automatizacion`
 * and one `Ejecucion`, and every tenant-scoped route is exercised from both sides. The
 * sweep is written as a table over route × tenant on purpose: a route added later that
 * is missing from it is an obvious omission in review, which a hand-written case per
 * route is not.
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

/** CH-14 T2: a plain login role (no grant, no CREATE), so DEC-08 lets a run read with it. */
const ROL_T2 = 'ch14_t2_lector';
const CLAVE_T2 = 'ch14-t2-clave-lector';
/** Drops the T2 role. Safe before creation and after teardown. */
const SQL_LIMPIEZA_T2 = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL_T2}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL_T2}');
    EXECUTE format('DROP ROLE %I', '${ROL_T2}');
  END IF;
END
$limpieza$;`;
/** Names an operator might expect a global recipient under; the scheduler reads none. */
const VARIABLES_DESTINATARIO = ['SMTP_TO', 'SMTP_DESTINATARIO', 'DESTINATARIO', 'NOTIFICACION_DESTINATARIO'];

/** Everything one tenant owns in this fixture. */
interface Fixture {
  tenantId: string;
  nombre: string;
  conexionId: string;
  guardadaId: string;
  sqlGuardado: string;
  /** CH-09: the canonical entity this tenant's connection has a definition for. */
  entidadVista: string;
  sqlVista: string;
  /**
   * CH-10: the verdict of this tenant's own validate action. The fixture dials as the
   * superuser, so it is the DEC-08 refusal (`fase: 'permisos'`) — which is exactly the
   * owner control the sweep needs: the route was reached and ran its session.
   */
  validacion: { resultado: string; fase: string };
  /** CH-13: this tenant's automation, created through the API, and one run of it. */
  automatizacionId: string;
  ejecucionId: string;
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
    /** CH-13: the global template both fixture automations name (DEC-61). */
    let plantillaId!: string;
    /** CH-14: the `producto` template the T2 delivery tick runs, created by that test. */
    let plantillaT2: string | undefined;

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      // `pedido` has no view on either fixture connection, so the DEC-71 gate refuses
      // every scheduled run of it before any dial.
      plantillaId = (
        await db.plantilla.create({
          data: {
            nombre: `CH-13 T2 ${Date.now()}`,
            sql: 'SELECT * FROM v_pedido',
            entidades: ['pedido'],
            automatizacion: 'stock-fisico',
            formato: 'correo-html',
            toleranciaFrescuraMinutos: 30,
          },
        })
      ).id;

      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerConexionRoutes(app, aislado);
      registerConsultaRoutes(app, aislado);
      registerConsultaGuardadaRoutes(app, aislado);
      registerVistaCanonicaRoutes(app, aislado);
      registerValidacionMapeoRoutes(app, aislado);
      registerPlantillaPruebaRoute(app, aislado);
      registerAutomatizacionRoutes(app, aislado, 'UTC');
      await app.ready();

      a = await montarTenant('A');
      b = await montarTenant('B');
    });

    after(async () => {
      const ids = [a?.tenantId, b?.tenantId].filter((id): id is string => typeof id === 'string');
      if (ids.length > 0) {
        // The FK is RESTRICT, so dependent rows go first.
        await db.consultaGuardada.deleteMany({ where: { tenantId: { in: ids } } });
        // CH-09: `VistaCanonica` references `Conexion` through a RESTRICT FK as well.
        await db.vistaCanonica.deleteMany({ where: { tenantId: { in: ids } } });
        // CH-13: runs reference automations, which reference connections.
        await db.ejecucion.deleteMany({ where: { tenantId: { in: ids } } });
        await db.automatizacion.deleteMany({ where: { tenantId: { in: ids } } });
        await db.conexion.deleteMany({ where: { tenantId: { in: ids } } });
        await db.tenant.deleteMany({ where: { id: { in: ids } } });
      }
      if (plantillaId !== undefined) await db.plantilla.delete({ where: { id: plantillaId } });
      if (plantillaT2 !== undefined) await db.plantilla.delete({ where: { id: plantillaT2 } });
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

      // CH-09: one registered canonical view per tenant, on its own connection.
      const entidadVista = 'producto';
      const sqlVista = `SELECT '${etiqueta}' AS duenio_vista_ch09`;
      const vista = await app.inject({
        method: 'PUT',
        url: `/conexiones/${conexion.id}/vistas-canonicas/${entidadVista}`,
        headers,
        payload: { sql: sqlVista },
      });
      assert.equal(vista.statusCode, 201, vista.body);

      // CH-10: each tenant validates its own mapping.
      const validacion = await app.inject({
        method: 'POST',
        url: `/conexiones/${conexion.id}/validacion-mapeo`,
        headers,
      });
      assert.equal(validacion.statusCode, 200, validacion.body);
      const { resultado, fase } = validacion.json() as { resultado: string; fase: string };

      // CH-13: an automation through the API, and one run of it as the scheduler files it.
      const alta = await app.inject({
        method: 'POST',
        url: '/automatizaciones',
        headers,
        payload: { plantillaId, conexionId: conexion.id, cron: '0 8 * * *' },
      });
      assert.equal(alta.statusCode, 201, alta.body);
      const { automatizacion } = alta.json() as { automatizacion: { id: string } };
      const ejecucion = await db.ejecucion.create({
        data: { tenantId: tenant.id, automatizacionId: automatizacion.id, estado: 'ok', iniciadaEn: new Date() },
      });

      return {
        tenantId: tenant.id,
        nombre,
        conexionId: conexion.id,
        guardadaId: consultaGuardada.id,
        sqlGuardado,
        entidadVista,
        sqlVista,
        validacion: { resultado, fase },
        automatizacionId: automatizacion.id,
        ejecucionId: ejecucion.id,
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
        const automatizacion = await db.automatizacion.findUnique({
          where: { id: fixture.automatizacionId },
          select: { tenantId: true },
        });
        assert.equal(automatizacion?.tenantId, fixture.tenantId, `${fixture.nombre}: automatizacion`);

        const vistas = await db.vistaCanonica.findMany({
          where: { conexionId: fixture.conexionId },
          select: { tenantId: true, entidad: true },
        });
        assert.deepEqual(
          vistas,
          [{ tenantId: fixture.tenantId, entidad: fixture.entidadVista }],
          `${fixture.nombre}: vista canonica`,
        );
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
      // CH-09: the three canonical-view routes. The owner control of the `PUT`
      // re-registers the fixture's own statement verbatim, so it is a DEC-34 replace
      // (`200`, not `201`) that leaves the fixture as the tests below expect it.
      {
        nombre: 'PUT /conexiones/:id/vistas-canonicas/:entidad',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'PUT',
            url: `/conexiones/${duenio.conexionId}/vistas-canonicas/${duenio.entidadVista}`,
            headers: cabeceras(llamante),
            payload: { sql: llamante.sqlVista },
          }),
        exitoso: 200,
      },
      {
        nombre: 'GET /conexiones/:id/vistas-canonicas',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'GET',
            url: `/conexiones/${duenio.conexionId}/vistas-canonicas`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      },
      {
        nombre: 'GET /conexiones/:id/vistas-canonicas/:entidad',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'GET',
            url: `/conexiones/${duenio.conexionId}/vistas-canonicas/${duenio.entidadVista}`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      },
      // CH-10: the validate action and the validation read. One `GET` serves both the
      // per-entity validation state and the applicability report, so it is one row.
      // The owner control of the `POST` is the superuser fixture's `200 fase permisos`.
      {
        nombre: 'POST /conexiones/:id/validacion-mapeo',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'POST',
            url: `/conexiones/${duenio.conexionId}/validacion-mapeo`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      },
      {
        nombre: 'GET /conexiones/:id/validacion-mapeo',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'GET',
            url: `/conexiones/${duenio.conexionId}/validacion-mapeo`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      },
      // CH-13: the automation routes and the runs listing. The create names the other
      // tenant's connection; its owner control files a second automation for the caller.
      // The `desactivar` row comes last: its owner control deactivates the fixture's
      // automation, which a second call would answer with 409.
      {
        nombre: 'POST /automatizaciones',
        errorEsperado: 'conexion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: 'POST',
            url: '/automatizaciones',
            headers: cabeceras(llamante),
            payload: { plantillaId, conexionId: duenio.conexionId, cron: '0 8 * * *' },
          }),
        exitoso: 201,
      },
      ...(['', '/ejecuciones', '/desactivar'] as const).map((sufijo) => ({
        nombre: `${sufijo === '/desactivar' ? 'POST' : 'GET'} /automatizaciones/:id${sufijo}`,
        errorEsperado: 'automatizacion-no-encontrada',
        pedir: (llamante: Fixture, duenio: Fixture) =>
          app.inject({
            method: sufijo === '/desactivar' ? 'POST' : 'GET',
            url: `/automatizaciones/${duenio.automatizacionId}${sufijo}`,
            headers: cabeceras(llamante),
          }),
        exitoso: 200,
      })),
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
          assert.ok(!respuesta.body.includes(duenio.sqlVista));
          assert.ok(!respuesta.body.includes(objetivo.password));
          assert.ok(!respuesta.body.includes(duenio.tenantId));
          assert.ok(!respuesta.body.includes(duenio.automatizacionId));
          assert.ok(!respuesta.body.includes(duenio.ejecucionId));
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

    test("CH-13 5.3 the automation listing never shows the other tenant's rows", async () => {
      for (const [llamante, duenio] of [
        [a, b],
        [b, a],
      ] as const) {
        const respuesta = await app.inject({
          method: 'GET',
          url: '/automatizaciones',
          headers: cabeceras(llamante),
        });
        assert.equal(respuesta.statusCode, 200, respuesta.body);
        const ids = (respuesta.json() as { automatizaciones: { id: string }[] }).automatizaciones.map((f) => f.id);
        assert.ok(ids.includes(llamante.automatizacionId), 'the caller must see its own automation');
        assert.ok(!ids.includes(duenio.automatizacionId), `${llamante.nombre} saw ${duenio.nombre}'s automation`);
        assert.ok(!respuesta.body.includes(duenio.conexionId));
        // The sweep's refused create filed nothing: no caller row names the owner's connection.
        assert.equal(
          await db.automatizacion.count({ where: { tenantId: llamante.tenantId, conexionId: duenio.conexionId } }),
          0,
        );
      }
    });

    test('CH-13 5.3 a tick over A and B files every run under the tenant that owns it', async () => {
      // Created in 2019 and ticked over a 2019 window: every other suite's scheduler
      // fixtures are dated 2020 and every real row later, so this tick runs only these two.
      // Another suite's 2021 tick may run them too while they are active; such a run is
      // still filed under its owner, and it is told apart below by its start time.
      const propias: { id: string; duenio: Fixture }[] = [];
      for (const duenio of [a, b]) {
        const { id } = await db.automatizacion.create({
          data: {
            tenantId: duenio.tenantId,
            plantillaId,
            conexionId: duenio.conexionId,
            cron: '* * * * *',
            creadaEn: new Date('2019-01-01T00:00:00Z'),
          },
        });
        propias.push({ id, duenio });
      }
      const desde = new Date('2019-06-01T08:00:30Z');
      try {
        const planificador = crearPlanificador({
          prisma: extenderConAislamiento(db),
          zonaHoraria: 'UTC',
          log: Fastify({ logger: false }).log,
          reloj: {
            ahora: () => desde,
            programar: () => {
              throw new Error('ejecutarTick no programa temporizadores');
            },
          },
        });
        await planificador.ejecutarTick(new Date('2019-06-01T08:01:30Z'));
      } finally {
        await db.automatizacion.updateMany({
          where: { id: { in: propias.map((p) => p.id) } },
          data: { activo: false },
        });
      }
      for (const { id, duenio } of propias) {
        const filas = await db.ejecucion.findMany({
          where: { automatizacionId: id },
          select: { tenantId: true, iniciadaEn: true, error: true },
        });
        const deEsteTick = filas.filter((f) => f.iniciadaEn.getTime() === desde.getTime());
        assert.equal(deEsteTick.length, 1, `${duenio.nombre}: one run from this tick`);
        // Refused by the gate, so no target was dialled on either side.
        assert.equal(deEsteTick[0]?.error, 'vista-canonica-no-aprobada');
        for (const fila of filas) {
          assert.equal(fila.tenantId, duenio.tenantId, `${duenio.nombre}: a run filed under another tenant`);
        }
      }
    });

    test("CH-14 5.11 a tick over A and B mails each tenant's rows only to its own recipient", async () => {
      // The fixture connections dial as the superuser, which DEC-08 refuses, so each tenant
      // gets one more connection as a plain login role and a `producto` view whose one row
      // is that tenant's marker. The role name is not `planificador.test.ts`'s: that file
      // creates and drops its own role while this one may be running.
      await db.$executeRawUnsafe(SQL_LIMPIEZA_T2);
      await db.$executeRawUnsafe(`CREATE ROLE ${ROL_T2} LOGIN PASSWORD '${CLAVE_T2}'`);
      const sello = Date.now();
      plantillaT2 = (
        await db.plantilla.create({
          data: {
            nombre: `CH-14 T2 ${sello}`,
            sql: 'SELECT * FROM v_producto',
            entidades: ['producto'],
            automatizacion: 'stock-fisico',
            formato: 'correo-html',
            toleranciaFrescuraMinutos: 30,
          },
        })
      ).id;
      // Same 2019 dating as the CH-13 tick above: only this test's automations are due.
      const creadaEn = new Date('2019-01-01T00:00:00Z');
      const propias: { id: string; duenio: Fixture; para: string | null; marcador: string }[] = [];
      const conexionesT2: string[] = [];
      for (const [duenio, etiqueta] of [
        [a, 'a'],
        [b, 'b'],
      ] as const) {
        const marcador = `marcador-t2-${etiqueta}-${sello}`;
        const conexion = await db.conexion.create({
          data: {
            tenantId: duenio.tenantId,
            nombre: `CH-14 T2 ${etiqueta}`,
            motor: 'postgres',
            host: objetivo.host,
            puerto: objetivo.port,
            baseDeDatos: objetivo.database,
            usuarioDb: ROL_T2,
            credencial: cifrarCredencial(CLAVE_T2),
          },
        });
        conexionesT2.push(conexion.id);
        await db.vistaCanonica.create({
          data: {
            tenantId: duenio.tenantId,
            conexionId: conexion.id,
            entidad: 'producto',
            sql: `SELECT '${marcador}' AS id`,
            estadoValidacion: 'valida',
          },
        });
        // A also owns an automation with no recipient: it must never borrow one.
        const propio = `ch14-t2-${etiqueta}-${sello}@example.com`;
        const destinatarios = duenio === a ? [propio, null] : [propio];
        for (const para of destinatarios) {
          const { id } = await db.automatizacion.create({
            data: {
              tenantId: duenio.tenantId,
              plantillaId: plantillaT2,
              conexionId: conexion.id,
              cron: '* * * * *',
              creadaEn,
              destinatario: para,
            },
          });
          propias.push({ id, duenio, para, marcador });
        }
      }

      const enviados: Correo[] = [];
      const notificador: Notificador = {
        enviar: async (correo) => {
          enviados.push(correo);
          return { resultado: 'enviada' };
        },
      };
      // Variables that look like a recipient: none of them may become a fallback.
      const GLOBAL = `global-${sello}@example.com`;
      const previas = VARIABLES_DESTINATARIO.map((nombre) => [nombre, process.env[nombre]] as const);
      for (const nombre of VARIABLES_DESTINATARIO) process.env[nombre] = GLOBAL;
      const desde = new Date('2019-07-01T08:00:30Z');
      try {
        const planificador = crearPlanificador({
          prisma: extenderConAislamiento(db),
          zonaHoraria: 'UTC',
          log: Fastify({ logger: false }).log,
          notificador,
          reloj: {
            ahora: () => desde,
            programar: () => {
              throw new Error('ejecutarTick no programa temporizadores');
            },
          },
        });
        await planificador.ejecutarTick(new Date('2019-07-01T08:01:30Z'));
      } finally {
        for (const [nombre, valor] of previas) {
          if (valor === undefined) delete process.env[nombre];
          else process.env[nombre] = valor;
        }
        await db.automatizacion.updateMany({
          where: { id: { in: propias.map((p) => p.id) } },
          data: { activo: false },
        });
        // Later cases count each tenant's views and expect only the fixture's own.
        await db.vistaCanonica.deleteMany({ where: { conexionId: { in: conexionesT2 } } });
        await db.$executeRawUnsafe(SQL_LIMPIEZA_T2);
      }

      // Exactly two messages: one per recipient; the automation without one sent nothing.
      const conDestinatario = propias.filter((p) => p.para !== null);
      assert.deepEqual(
        enviados.map((c) => c.para).sort(),
        conDestinatario.map((p) => p.para).sort(),
      );
      for (const { para, duenio, marcador } of conDestinatario) {
        const otro = propias.find((p) => p.duenio !== duenio)!.marcador;
        const [correo] = enviados.filter((c) => c.para === para);
        for (const cuerpo of [correo.texto, correo.html]) {
          assert.ok(cuerpo.includes(marcador), `${duenio.nombre}: its own row is missing`);
          assert.ok(!cuerpo.includes(otro), `${duenio.nombre}: the other tenant's row reached it`);
        }
      }
      for (const { id, duenio, para } of propias) {
        const filas = await db.ejecucion.findMany({
          where: { automatizacionId: id, iniciadaEn: desde },
          select: { tenantId: true, estado: true, filas: true, notificacion: true },
        });
        assert.deepEqual(filas, [
          {
            tenantId: duenio.tenantId,
            estado: 'ok',
            filas: 1,
            notificacion: para === null ? 'sin-destinatario' : 'enviada',
          },
        ]);
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

    test("3.3 registering against the other tenant's connection leaves its definition untouched", async () => {
      // The sweep's `404` is the response-level claim; this is the effect-level one. A
      // names B's connection and B's already-registered entity: an unscoped ownership
      // check would turn this into a replace of B's statement, or a row filed under A.
      const seleccion = { id: true, tenantId: true, sql: true, actualizadaEn: true } as const;
      const antes = await db.vistaCanonica.findMany({
        where: { conexionId: b.conexionId },
        select: seleccion,
      });
      assert.equal(antes.length, 1, "B's fixture definition must exist before the attempt");
      assert.equal(antes[0]?.sql, b.sqlVista);

      const intruso = `SELECT 'A' AS intruso_ch09_${Date.now()}`;
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/conexiones/${b.conexionId}/vistas-canonicas/${b.entidadVista}`,
        headers: cabeceras(a),
        payload: { sql: intruso },
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
      assert.deepEqual(
        await db.vistaCanonica.findMany({ where: { conexionId: b.conexionId }, select: seleccion }),
        antes,
        "B's definition must be unchanged: same row, same statement, same timestamp",
      );
      assert.equal(
        await db.vistaCanonica.count({ where: { sql: intruso } }),
        0,
        'the rejected statement must not have been stored anywhere',
      );
      assert.equal(
        await db.vistaCanonica.count({ where: { tenantId: a.tenantId } }),
        1,
        'A must still own exactly its fixture definition',
      );
    });

    // ---- CH-10 5.1 / 5.3 the validate action ----------------------------------------

    test('CH-10 5.1 each tenant validated its own mapping: the session ran and was refused by DEC-08', () => {
      for (const fixture of [a, b]) {
        assert.deepEqual(
          fixture.validacion,
          { resultado: 'fallo', fase: 'permisos' },
          `${fixture.nombre}: the owner's validate action must reach its own target`,
        );
      }
    });

    test("CH-10 5.3 validating the other tenant's connection leaves its validation state untouched", async () => {
      // B's row is given a persisted verdict first, so "unchanged" cannot be vacuous. An
      // unscoped lookup would dial B's target and overwrite it, or file a row under A.
      await db.vistaCanonica.updateMany({
        where: { conexionId: b.conexionId },
        data: {
          estadoValidacion: 'valida',
          diagnosticoValidacion: { version: 1, marca: 'ch10-t2' },
          validadaEn: new Date('2026-01-01T00:00:00Z'),
        },
      });
      const seleccion = {
        id: true,
        tenantId: true,
        sql: true,
        estadoValidacion: true,
        diagnosticoValidacion: true,
        validadaEn: true,
        actualizadaEn: true,
      } as const;
      const antesB = await db.vistaCanonica.findMany({
        where: { conexionId: b.conexionId },
        select: seleccion,
      });
      const antesA = await db.vistaCanonica.findMany({
        where: { tenantId: a.tenantId },
        select: seleccion,
      });

      const respuesta = await app.inject({
        method: 'POST',
        url: `/conexiones/${b.conexionId}/validacion-mapeo`,
        headers: cabeceras(a),
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
      assert.deepEqual(
        await db.vistaCanonica.findMany({ where: { conexionId: b.conexionId }, select: seleccion }),
        antesB,
        "B's validation columns must be unchanged",
      );
      assert.deepEqual(
        await db.vistaCanonica.findMany({ where: { tenantId: a.tenantId }, select: seleccion }),
        antesA,
        'nothing may have been written for A either',
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

    test('3.5 a body carrying tenantId is 400 on the canonical-view registration too', async () => {
      // CH-09's `PUT` is a create route as well: the header stays the only channel.
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/conexiones/${a.conexionId}/vistas-canonicas/pedido`,
        headers: cabeceras(a),
        payload: { sql: 'SELECT 1', tenantId: b.tenantId },
      });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.ok((respuesta.json() as { campos: string[] }).campos.includes('/tenantId'));

      assert.equal(
        await db.vistaCanonica.count({ where: { conexionId: a.conexionId, entidad: 'pedido' } }),
        0,
        'a rejected registration must not have written anything',
      );
      assert.equal(
        await db.vistaCanonica.count({ where: { tenantId: b.tenantId } }),
        1,
        'the other tenant must still own exactly its fixture definition',
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

    // ---- CH-12 1.3 Plantilla is a global catalog, outside the filter (DEC-61) --------

    test('CH-12 1.3 Plantilla reads and writes pass through with no active tenant', async () => {
      // The same claim 3.6 makes for `Tenant`, now for the first global model with data
      // of its own: it is absent from MODELOS_AISLADOS, so the extension hands every
      // operation straight to Prisma. Outside any context a scoped model throws
      // ErrorSinTenantActivo (see above); this one must not.
      const aislado = extenderConAislamiento(db);
      const marca = `CH-12 plantilla global ${Date.now()}`;

      const creada = await aislado.plantilla.create({
        data: {
          nombre: marca,
          sql: 'SELECT * FROM v_producto',
          entidades: ['producto'],
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      });
      try {
        // DEC-73: `parametros` is a JSON column whose `[]` default declares nothing,
        // exactly like `ConsultaGuardada.parametros`.
        assert.deepEqual(creada.parametros, []);
        assert.deepEqual(creada.entidades, ['producto']);
        // No `tenantId` was injected, because the model has no such column at all.
        assert.ok(!('tenantId' in creada), 'Plantilla must carry no tenantId column');

        const leida = await aislado.plantilla.findUnique({ where: { id: creada.id } });
        assert.equal(leida?.nombre, marca);

        const reemplazada = await aislado.plantilla.update({
          where: { id: creada.id },
          data: { sql: 'SELECT * FROM v_insumo', entidades: ['insumo'] },
        });
        assert.equal(reemplazada.id, creada.id);
        assert.equal(reemplazada.sql, 'SELECT * FROM v_insumo');

        const listadas = await aislado.plantilla.findMany({ where: { nombre: marca } });
        assert.equal(listadas.length, 1);
      } finally {
        await db.plantilla.delete({ where: { id: creada.id } });
      }
    });

    test('CH-12 1.3 Plantilla is not filtered by an active tenant either', async () => {
      // The other side of "no filter applied": inside a tenant's context the row is
      // still visible, and visible identically to both tenants. A scoped model would
      // show it to neither (the injected `tenantId` would match no row) — so seeing it
      // from A and from B is what proves nothing was conjoined.
      const aislado = extenderConAislamiento(db);
      const marca = `CH-12 plantilla sin filtro ${Date.now()}`;
      const fila = await db.plantilla.create({
        data: {
          nombre: marca,
          sql: 'SELECT * FROM v_producto',
          entidades: ['producto'],
          automatizacion: 'stock-producible',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 0,
        },
      });
      try {
        for (const fixture of [a, b]) {
          const vistas = await conTenantActivo(
            { id: fixture.tenantId, nombre: fixture.nombre },
            () => aislado.plantilla.findMany({ where: { nombre: marca } }),
          );
          assert.deepEqual(
            vistas.map((p) => p.id),
            [fila.id],
            `tenant ${fixture.nombre} must see the global template unfiltered`,
          );
        }
      } finally {
        await db.plantilla.delete({ where: { id: fila.id } });
      }
    });

    // ---- CH-12 5.8 T2 through the template test route ---------------------------------

    test("CH-12 5.8 composing the other tenant's views through the test route is 404, nothing read", async () => {
      // Every fixture view is given a passing verdict first, so the DEC-71 gate would let
      // a leaked connection through to execution: a 404 can then only come from the
      // scoped ownership check, which runs before any view row is read or any dial.
      await db.vistaCanonica.updateMany({
        where: { tenantId: { in: [a.tenantId, b.tenantId] } },
        data: { estadoValidacion: 'valida' },
      });
      const plantilla = await db.plantilla.create({
        data: {
          nombre: `CH-12 T2 ${Date.now()}`,
          sql: 'SELECT * FROM v_producto',
          entidades: ['producto'],
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      });
      const probar = (llamante: Fixture, duenio: Fixture) =>
        app.inject({
          method: 'POST',
          url: `/plantillas/${plantilla.id}/prueba`,
          headers: cabeceras(llamante),
          payload: { conexionId: duenio.conexionId },
        });
      try {
        for (const [llamante, duenio] of [
          [a, b],
          [b, a],
        ] as const) {
          const respuesta = await probar(llamante, duenio);
          assert.equal(respuesta.statusCode, 404, `${llamante.nombre} reached ${duenio.nombre}: ${respuesta.body}`);
          assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
          assert.ok(!respuesta.body.includes(duenio.sqlVista));
          assert.ok(!respuesta.body.includes(duenio.tenantId));
        }
        // Owner control: the same request against the caller's own connection passes the
        // gate, composes and reaches its target, where the superuser fixture is refused
        // by DEC-08. Without it, the 404s above would also pass on a broken route.
        for (const fixture of [a, b]) {
          const respuesta = await probar(fixture, fixture);
          assert.equal(respuesta.statusCode, 200, respuesta.body);
          const { resultado, fase } = respuesta.json() as { resultado: string; fase: string };
          assert.deepEqual({ resultado, fase }, { resultado: 'fallo', fase: 'permisos' });
        }
      } finally {
        await db.plantilla.delete({ where: { id: plantilla.id } });
      }
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

// ---- CH-12 1.3 the schema itself, read from the generated client -------------------

describe('domain data model — Plantilla joins as a global model (CH-12, DEC-61)', () => {
  test('the model list is exactly the tenant models, Plantilla, and the CH-13 pair', () => {
    // Read from the generated client rather than by grepping `schema.prisma`: this is
    // the model list the extension actually sees at runtime. CH-13 (DEC-74, X2) adds
    // `Automatizacion` and `Ejecucion`; the list still pins `Usuario` out.
    assert.deepEqual(Object.values(Prisma.ModelName).sort(), [
      'Automatizacion',
      'Conexion',
      'ConsultaGuardada',
      'Ejecucion',
      'Plantilla',
      'Tenant',
      'VistaCanonica',
    ]);
  });

  test('Plantilla carries no tenantId column, unlike every scoped model', () => {
    const columnas = Object.values(Prisma.PlantillaScalarFieldEnum);
    assert.deepEqual(columnas.sort(), [
      'automatizacion',
      'entidades',
      'formato',
      'id',
      'nombre',
      'parametros',
      'sql',
      'toleranciaFrescuraMinutos',
    ]);
    // The control: a scoped model does carry it, so the absence above is meaningful.
    assert.ok(Object.values(Prisma.ConsultaGuardadaScalarFieldEnum).includes('tenantId'));
  });
});

// ---- CH-13 1.4 Automatizacion and Ejecucion are scoped models (DEC-13, DEC-74) ------

describe('aislamiento — Automatizacion and Ejecucion fail closed outside a tenant context (CH-13)', () => {
  // No live server is needed. For a scoped model the extension throws before the query
  // is handed to Prisma, so nothing is ever dialled. The URL below points at a closed
  // local port on purpose: an unscoped model would pass through and fail with a
  // connection error instead, which is what makes the assertions below discriminating.
  const URL_CERRADA = 'postgresql://nadie:nada@127.0.0.1:1/ninguna';
  const aislado = extenderConAislamiento(
    new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_CERRADA }) }),
  );

  test('Automatizacion reads and writes with no active tenant throw ErrorSinTenantActivo', async () => {
    await assert.rejects(() => aislado.automatizacion.findMany({}), ErrorSinTenantActivo);
    await assert.rejects(
      () => aislado.automatizacion.findUnique({ where: { id: 'cualquiera' } }),
      ErrorSinTenantActivo,
    );
    await assert.rejects(
      () =>
        aislado.automatizacion.create({
          data: { plantillaId: 'p', conexionId: 'c', cron: '0 9 * * *' },
        } as never),
      ErrorSinTenantActivo,
    );
    await assert.rejects(
      () => aislado.automatizacion.update({ where: { id: 'x' }, data: { activo: false } }),
      ErrorSinTenantActivo,
    );
  });

  test('Ejecucion reads and writes with no active tenant throw ErrorSinTenantActivo', async () => {
    await assert.rejects(() => aislado.ejecucion.findMany({}), ErrorSinTenantActivo);
    await assert.rejects(
      () =>
        aislado.ejecucion.create({
          data: { automatizacionId: 'a', estado: 'en-curso', iniciadaEn: new Date() },
        } as never),
      ErrorSinTenantActivo,
    );
    await assert.rejects(
      () => aislado.ejecucion.update({ where: { id: 'x' }, data: { estado: 'ok' } }),
      ErrorSinTenantActivo,
    );
  });

  test('inside a tenant context the same query is scoped and handed on, not refused', async () => {
    // The control: with a context entered the extension lets the query through, so it
    // reaches the closed port and fails there. Without it, the rejections above would
    // also pass on a client that refused every query for an unrelated reason.
    //
    // The `await` inside the callback is load-bearing: a Prisma query is a lazy thenable
    // that only runs when `then` is called. Returned un-awaited, it would run after
    // `conTenantActivo` has already left the context, and fail closed exactly as above.
    const error = await conTenantActivo({ id: 't', nombre: 'T' }, async () => {
      return await aislado.automatizacion.findMany({});
    }).then(
      () => null,
      (causa: unknown) => causa,
    );
    assert.ok(error !== null, 'the closed port must refuse the scoped query');
    assert.ok(!(error instanceof ErrorSinTenantActivo), 'a context was entered');
  });
});
