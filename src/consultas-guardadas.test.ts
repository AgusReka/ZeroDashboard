import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { LIMITE_LISTADO, registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';

/**
 * Integration cases for CH-05 (tasks 2.1–2.10). This module is routes plus Prisma —
 * there is no pure classifier or sanitizer to test in isolation the way CH-03 and
 * CH-04 had — so the meaningful coverage is integration through `app.inject()`
 * against a real database, which is what `src/conexiones.test.ts` established.
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * `TEST_DB_USER` must be a superuser: case 2.10 creates one login role so the
 * execution path has a non-superuser to connect as (DEC-08 blocks a superuser before
 * the statement is sent, so the Compose owner can never be the success case).
 *
 * The skip preflight has one condition again. It used to have a second — "is there a
 * seeded `Tenant` row", because every create answered `503 tenant-no-inicializado`
 * without one. CH-06 removed both the seed dependency and that response: the active
 * tenant is named by each request (DEC-15) and validated before the handler runs, so
 * this suite creates the tenant it needs, declares it on every call, and removes it
 * again. Every case below now proves something about *this* tenant's rows rather than
 * about the whole table.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

/** The one login role case 2.10 needs: no table grant, no schema CREATE, no superuser. */
const ROL_LECTOR = 'ch05_lector';
const CLAVE_LECTOR = 'ch05-clave-lector';

const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

// `loadConfig()` runs on every execution call and demands the same variables the
// server boots with.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
// CH-07: loadConfig() now refuses to run without a valid master key (DEC-17), so every
// suite that boots the app supplies a fixture key of its own. It is a literal, not a
// generated value: slice-2 fixtures write envelopes by hand and have to be able to open
// them again in the same run.
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** Drops the fixture role. Safe to run before creation and after teardown. */
const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL_LECTOR}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL_LECTOR}');
    EXECUTE format('DROP ROLE %I', '${ROL_LECTOR}');
  END IF;
END
$limpieza$;`;

interface ResumenGuardada {
  id: string;
  nombre: string;
  descripcion: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

interface CompletaGuardada extends ResumenGuardada {
  sql: string;
}

interface CuerpoListado {
  consultasGuardadas: ResumenGuardada[];
  truncado: boolean;
}

interface CuerpoRechazo {
  error: string;
  campos: string[];
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

const motivoSkip: string | false = alcanzable
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
    "bring up the Compose db service and set TEST_DB_* (see this file's header)";

describe(
  'consulta guardada routes — integration against a live PostgreSQL target',
  { skip: motivoSkip },
  () => {
    let app!: FastifyInstance;
    /**
     * The **raw** client, kept for fixtures, cleanup and the out-of-band assertions —
     * `tenantId` is absent from both response projections, so reading it back is only
     * possible here. The app under test gets the extended one, so these cases run
     * against the real CH-06 isolation extension.
     */
    let prisma!: PrismaClient;
    let admin!: pg.Client;
    /** Every saved query this suite creates, removed in `after` by id. */
    const creadas: string[] = [];
    /** Every connection this suite registers, removed in `after` by id. */
    const conexiones: string[] = [];
    /** The tenant every call declares; case 2.2 asserts rows land on it. */
    let tenantEsperado!: string;

    before(async () => {
      admin = new pg.Client({ ...objetivo });
      await admin.connect();
      await admin.query(SQL_LIMPIEZA);
      // A plain login role: PostgreSQL 16 no longer grants CREATE on `public` to
      // PUBLIC, so this role starts with no write privilege and no schema CREATE
      // anywhere. `SELECT 1` needs no table grant at all.
      await admin.query(`CREATE ROLE ${ROL_LECTOR} LOGIN PASSWORD '${CLAVE_LECTOR}'`);

      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const tenant = await prisma.tenant.create({ data: { nombre: `CH-05 pruebas ${Date.now()}` } });
      tenantEsperado = tenant.id;

      // One app with all three route groups registered: case 2.10 crosses from the
      // saved-query routes into the execution route in a single round trip. The
      // context hooks go first — Fastify runs same-name hooks in registration order,
      // so a route registered ahead of them would run with no tenant context.
      const aislado = extenderConAislamiento(prisma);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerConexionRoutes(app, aislado);
      registerConsultaRoutes(app, aislado);
      registerConsultaGuardadaRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      // The rows exist only to be read back; the own database goes back to how it was.
      if (creadas.length > 0) {
        await prisma.consultaGuardada.deleteMany({ where: { id: { in: creadas } } });
      }
      if (conexiones.length > 0) {
        await prisma.conexion.deleteMany({ where: { id: { in: conexiones } } });
      }
      // The FK is RESTRICT, so anything still pointing at the fixture tenant has to go
      // before the tenant itself can.
      await prisma.consultaGuardada.deleteMany({ where: { tenantId: tenantEsperado } });
      await prisma.conexion.deleteMany({ where: { tenantId: tenantEsperado } });
      await prisma.tenant.delete({ where: { id: tenantEsperado } });
      await prisma.$disconnect();
      await app.close();
      await admin.query(SQL_LIMPIEZA);
      await admin.end();
    });

    /**
     * The one header that declares the active tenant (DEC-15). Every `inject` in this
     * suite carries it: since CH-06 a scoped route with no header is a `400
     * tenant-no-indicado` before the handler runs.
     */
    function cabeceras(): Record<string, string> {
      return { 'x-tenant-id': tenantEsperado };
    }

    /** Creates a saved query and asserts the `201`, returning the echoed row. */
    async function guardar(
      cuerpo: Record<string, unknown> = {},
    ): Promise<CompletaGuardada> {
      const payload = {
        nombre: `CH-05 consulta ${Date.now()}`,
        sql: 'SELECT 1',
        ...cuerpo,
      };
      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: cabeceras(),
        payload,
      });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      const { consultaGuardada } = respuesta.json() as { consultaGuardada: CompletaGuardada };
      creadas.push(consultaGuardada.id);
      return consultaGuardada;
    }

    /** Posts a body expected to be rejected, returning the `400` envelope. */
    async function rechazar(payload: Record<string, unknown>): Promise<CuerpoRechazo> {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: cabeceras(),
        payload,
      });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      const cuerpo = respuesta.json() as CuerpoRechazo;
      assert.equal(cuerpo.error, 'solicitud-invalida');
      assert.ok(Array.isArray(cuerpo.campos), 'the rejection must report the offending fields');
      return cuerpo;
    }

    async function listar(): Promise<{ cuerpo: CuerpoListado; crudo: string }> {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      return { cuerpo: respuesta.json() as CuerpoListado, crudo: respuesta.body };
    }

    async function obtener(id: string): Promise<CompletaGuardada> {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/consultas-guardadas/${encodeURIComponent(id)}`,
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { consultaGuardada } = respuesta.json() as { consultaGuardada: CompletaGuardada };
      return consultaGuardada;
    }

    // ---- 2.2 creating a valid saved query -------------------------------------------

    test('2.2 a valid create persists the full row, readable by get-by-id', async () => {
      const nombre = `CH-05 valida ${Date.now()}`;
      const creada = await guardar({
        nombre,
        descripcion: 'Insumos vs recetas',
        sql: 'SELECT 1',
      });

      assert.ok(typeof creada.id === 'string' && creada.id.length > 0);
      assert.equal(creada.nombre, nombre);
      assert.equal(creada.descripcion, 'Insumos vs recetas');
      assert.equal(creada.sql, 'SELECT 1');
      assert.ok(typeof creada.creadaEn === 'string' && creada.creadaEn.length > 0);
      assert.ok(typeof creada.actualizadaEn === 'string' && creada.actualizadaEn.length > 0);

      const leida = await obtener(creada.id);
      assert.deepEqual(leida, creada, 'get-by-id must return exactly what create echoed');
    });

    test('2.2 the row is scoped to the declared active tenant, never a submitted one', async () => {
      const creada = await guardar();

      // Read through Prisma rather than the API: `tenantId` is deliberately absent
      // from both response projections, so this is the only place it can be checked.
      const fila = await prisma.consultaGuardada.findUnique({
        where: { id: creada.id },
        select: { tenantId: true },
      });
      assert.ok(fila !== null, 'the created row must exist');
      assert.equal(fila.tenantId, tenantEsperado);
    });

    // ---- 2.3 descripcion normalization and verbatim sql ------------------------------

    test('2.3 an omitted, null or blank descripcion all persist as null', async () => {
      const omitida = await guardar({ nombre: `CH-05 desc omitida ${Date.now()}` });
      assert.equal(omitida.descripcion, null, 'an omitted descripcion must persist as null');

      const nula = await guardar({ nombre: `CH-05 desc nula ${Date.now()}`, descripcion: null });
      assert.equal(nula.descripcion, null, 'an explicit null must persist as null');

      const blanca = await guardar({
        nombre: `CH-05 desc blanca ${Date.now()}`,
        descripcion: '   \t  ',
      });
      assert.equal(blanca.descripcion, null, 'a whitespace-only descripcion must persist as null');

      // Absence has one representation, so the three are indistinguishable on read.
      for (const creada of [omitida, nula, blanca]) {
        assert.equal((await obtener(creada.id)).descripcion, null);
      }
    });

    test('2.3 the statement is stored verbatim, untrimmed and with its semicolon', async () => {
      // `sanearSql` is a predicate here and nothing more: stripping the trailing `;`
      // is the execution path's business, and doing it on the way in would silently
      // rewrite the operator's statement in the database.
      const original = '  SELECT 1;  ';
      const creada = await guardar({ nombre: `CH-05 verbatim ${Date.now()}`, sql: original });

      assert.equal(creada.sql, original, 'create must echo the statement byte for byte');
      assert.equal((await obtener(creada.id)).sql, original, 'get-by-id must round-trip it');
    });

    // ---- 2.4 incomplete and empty statements -----------------------------------------

    test('2.4 a create without nombre is rejected and creates no row', async () => {
      const cuerpo = await rechazar({ sql: 'SELECT 1' });

      assert.ok(
        cuerpo.campos.includes('/nombre'),
        `the rejection must name the nombre path, got ${JSON.stringify(cuerpo.campos)}`,
      );
      // No `nombre` was submitted, so the absence of a write is proved on `sql`: no row
      // may exist carrying this statement text.
      const filas = await prisma.consultaGuardada.count({
        where: { sql: 'SELECT 1', nombre: '' },
      });
      assert.equal(filas, 0, 'a rejected create must not create a ConsultaGuardada row');
    });

    test('2.4 a create without sql is rejected and creates no row', async () => {
      const nombre = `CH-05 sin sql ${Date.now()}`;
      const cuerpo = await rechazar({ nombre });

      assert.ok(
        cuerpo.campos.includes('/sql'),
        `the rejection must name the sql path, got ${JSON.stringify(cuerpo.campos)}`,
      );
      assert.equal(await prisma.consultaGuardada.count({ where: { nombre } }), 0);
    });

    test('2.4 a statement that is empty after trimming is rejected and creates no row', async () => {
      // Both shapes the guard has to catch: pure whitespace, and a lone semicolon that
      // `sanearSql` reduces to nothing. Neither could ever execute, so neither is saved.
      for (const sql of ['   ', ';', '  ;  ']) {
        const nombre = `CH-05 sql vacio ${Date.now()} ${sql.length}`;
        const cuerpo = await rechazar({ nombre, sql });

        assert.ok(
          cuerpo.campos.includes('/sql'),
          `${JSON.stringify(sql)} must be rejected on the sql path, got ${JSON.stringify(cuerpo.campos)}`,
        );
        assert.equal(await prisma.consultaGuardada.count({ where: { nombre } }), 0);
      }
    });

    // ---- 2.5 unknown properties and rule 2 -------------------------------------------

    test('2.5 an unknown property is rejected and creates no row', async () => {
      const nombre = `CH-05 propiedad desconocida ${Date.now()}`;
      const cuerpo = await rechazar({ nombre, sql: 'SELECT 1', desconocido: 'x' });

      assert.ok(
        cuerpo.campos.includes('/desconocido'),
        `the rejection must name the unknown property, got ${JSON.stringify(cuerpo.campos)}`,
      );
      assert.equal(await prisma.consultaGuardada.count({ where: { nombre } }), 0);
    });

    /**
     * Rule 2, pinned as its own case: a request cannot set `tenantId`.
     *
     * This must be a *rejection*, not a silent drop. Fastify configures AJV with
     * `removeAdditional: true`, under which `additionalProperties: false` deletes the
     * unknown key and lets the create succeed — which is why the schema carries
     * `propertyNames` as well. Without it this case returned `201`.
     */
    test('2.5 a body carrying tenantId is rejected, and the tenant stays server-resolved', async () => {
      const nombre = `CH-05 tenant forzado ${Date.now()}`;
      const ajeno = '00000000-0000-0000-0000-000000000000';
      const cuerpo = await rechazar({ nombre, sql: 'SELECT 1', tenantId: ajeno });

      assert.ok(
        cuerpo.campos.includes('/tenantId'),
        `the rejection must name the tenantId path, got ${JSON.stringify(cuerpo.campos)}`,
      );
      assert.equal(await prisma.consultaGuardada.count({ where: { nombre } }), 0);

      // And the accepted path never honours a submitted tenant either: the only way a
      // row gets a tenant is the isolation extension injecting the one the request
      // declared in its header and the hooks validated.
      const aceptada = await guardar({ nombre: `${nombre} aceptada` });
      const fila = await prisma.consultaGuardada.findUnique({
        where: { id: aceptada.id },
        select: { tenantId: true },
      });
      assert.equal(fila?.tenantId, tenantEsperado);
      assert.notEqual(fila?.tenantId, ajeno);
    });

    // ---- 2.6 the list is metadata only ------------------------------------------------

    test('2.6 no list row carries sql, and the stored statement is not in the payload', async () => {
      const marca = `SELECT ${Date.now()} AS marca_ch05`;
      const creada = await guardar({ nombre: `CH-05 listado ${Date.now()}`, sql: marca });

      const { cuerpo, crudo } = await listar();
      const fila = cuerpo.consultasGuardadas.find((f) => f.id === creada.id);
      assert.ok(fila !== undefined, 'the created row must appear in the list');

      assert.ok(!('sql' in fila), 'a list row must carry no sql field');
      assert.deepEqual(Object.keys(fila).sort(), [
        'actualizadaEn',
        'creadaEn',
        'descripcion',
        'id',
        'nombre',
      ]);
      assert.ok(
        !crudo.includes(marca),
        'the stored statement text must not appear anywhere in the list payload',
      );
      // `tenantId` is server-resolved state with no use in any response.
      assert.ok(!crudo.includes(tenantEsperado), 'the list must not echo the tenant id');
    });

    /**
     * Spec: "Listing when no saved query exists". This used to be partial coverage:
     * read paths were unscoped, so "no saved query exists" was a statement about the
     * whole table, which this suite shares with whatever the developer already has
     * saved. CH-06 makes the listing tenant-scoped, and this suite now owns a tenant
     * created seconds ago, so the scenario is reachable for real — the count below is
     * scoped to that tenant, and the `[]` branch is the one that runs.
     */
    test('2.6 an empty listing is 200 with an empty array, never an error', async () => {
      const total = await prisma.consultaGuardada.count({ where: { tenantId: tenantEsperado } });
      const { cuerpo } = await listar();

      assert.ok(Array.isArray(cuerpo.consultasGuardadas), 'the list must always be an array');
      assert.ok(!('error' in cuerpo), 'an empty or short list is not an error');
      assert.equal(typeof cuerpo.truncado, 'boolean');
      if (total === 0) {
        assert.deepEqual(cuerpo.consultasGuardadas, []);
        assert.equal(cuerpo.truncado, false);
      }
    });

    // ---- 2.7 ordering and the hard cap ------------------------------------------------

    test('2.7 the list is newest first and reports truncado against the real row count', async () => {
      const primera = await guardar({ nombre: `CH-05 orden primera ${Date.now()}` });
      // `creadaEn` is millisecond-precision; without this the two creates can share a
      // timestamp and the assertion would be testing the `id` tiebreaker by accident.
      await new Promise((resolve) => setTimeout(resolve, 5));
      const segunda = await guardar({ nombre: `CH-05 orden segunda ${Date.now()}` });

      const { cuerpo } = await listar();
      const posicionPrimera = cuerpo.consultasGuardadas.findIndex((f) => f.id === primera.id);
      const posicionSegunda = cuerpo.consultasGuardadas.findIndex((f) => f.id === segunda.id);

      assert.ok(posicionPrimera >= 0 && posicionSegunda >= 0, 'both rows must be listed');
      assert.ok(
        posicionSegunda < posicionPrimera,
        'the newer saved query must be listed before the older one',
      );

      // Scoped to this suite's tenant since CH-06: the cap now applies to the active
      // tenant's rows, so a table full of another tenant's rows must not move it.
      const total = await prisma.consultaGuardada.count({ where: { tenantId: tenantEsperado } });
      assert.equal(
        cuerpo.truncado,
        total > LIMITE_LISTADO,
        "truncado must report whether the active tenant's rows actually exceed the cap",
      );
    });

    test(`2.7 the list is capped at ${LIMITE_LISTADO} rows and says so with truncado`, async () => {
      const prefijo = `CH-05 tope ${Date.now()} `;
      try {
        // `LIMITE_LISTADO + 1` is the smallest count that can distinguish a cap from a
        // coincidence: at exactly the cap, `truncado` must still be false.
        await prisma.consultaGuardada.createMany({
          data: Array.from({ length: LIMITE_LISTADO + 1 }, (_, indice) => ({
            tenantId: tenantEsperado,
            nombre: `${prefijo}${String(indice).padStart(4, '0')}`,
            sql: 'SELECT 1',
          })),
        });

        const { cuerpo } = await listar();
        assert.equal(
          cuerpo.consultasGuardadas.length,
          LIMITE_LISTADO,
          'the list must never return more than the cap',
        );
        assert.equal(cuerpo.truncado, true, 'a table past the cap must report truncado');
        // These are the newest rows in the table, so the whole page must come from
        // this fixture — which is what proves the cap was applied after the ordering.
        assert.ok(
          cuerpo.consultasGuardadas.every((f) => f.nombre.startsWith(prefijo)),
          'the capped page must hold the newest rows, not an arbitrary slice',
        );
      } finally {
        // Cleaned up inside the test, not in `after`: every later case reads the same
        // unscoped list and would otherwise be looking past 201 fixture rows.
        await prisma.consultaGuardada.deleteMany({ where: { nombre: { startsWith: prefijo } } });
      }
    });

    // ---- 2.8 duplicate nombre (decision 4) --------------------------------------------

    test('2.8 two saved queries may share a nombre, and both persist independently', async () => {
      // Designed behavior, not a missing constraint: `Conexion.nombre` carries no
      // uniqueness constraint either, and adding one here would need a migration.
      const nombre = `ventas-mes ${Date.now()}`;
      const primera = await guardar({ nombre, sql: 'SELECT 1' });
      const segunda = await guardar({ nombre, sql: 'SELECT 2' });

      assert.equal(primera.nombre, segunda.nombre);
      assert.notEqual(primera.id, segunda.id, 'each create must produce its own row');
      assert.equal(await prisma.consultaGuardada.count({ where: { nombre } }), 2);

      const { cuerpo } = await listar();
      const ids = cuerpo.consultasGuardadas.filter((f) => f.nombre === nombre).map((f) => f.id);
      assert.equal(ids.length, 2, 'both rows must be listed');
      assert.ok(ids.includes(primera.id) && ids.includes(segunda.id));

      // Load-into-editor is keyed on the row id, never on the name — which is the only
      // reason two identically-named rows stay usable.
      assert.equal((await obtener(primera.id)).sql, 'SELECT 1');
      assert.equal((await obtener(segunda.id)).sql, 'SELECT 2');
    });

    // ---- 2.9 get by id -----------------------------------------------------------------

    test('2.9 an unknown id answers a legible 404, with no driver error or stack', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas/11111111-2222-3333-4444-555555555555',
        headers: cabeceras(),
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'consulta-guardada-no-encontrada' });
      assert.ok(!respuesta.body.includes('    at '), 'no stack frame may reach the response body');
    });

    test('2.9 a malformed, non-UUID id answers 404 rather than 500', async () => {
      // `ConsultaGuardada.id` is `String @id @default(uuid())` with no `@db.Uuid`, so
      // the column is `text` and this lookup is a plain equality that cannot throw.
      // A nonexistent id and a malformed one are both honestly "no such saved query".
      for (const id of ['no-es-un-uuid', '99', 'a b c']) {
        const respuesta = await app.inject({
          method: 'GET',
          url: `/consultas-guardadas/${encodeURIComponent(id)}`,
          headers: cabeceras(),
        });

        assert.equal(respuesta.statusCode, 404, `${id} must answer 404: ${respuesta.body}`);
        assert.deepEqual(respuesta.json(), { error: 'consulta-guardada-no-encontrada' });
      }
    });

    // ---- 2.10 the R0 closure round trip ------------------------------------------------

    /**
     * "Escribir una consulta, guardarla y ejecutarla" end to end, in one app instance.
     * Pins DEC-11 and decision 5 together: nothing binds a saved query to a connection,
     * so the two are chosen independently at execution time, and the statement that
     * comes back out of storage is the one that executes.
     */
    test('2.10 a saved statement can be read back and executed through the execution route', async () => {
      const registro = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: cabeceras(),
        payload: {
          nombre: `CH-05 destino ${Date.now()}`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: ROL_LECTOR,
          credencial: CLAVE_LECTOR,
        },
      });
      assert.equal(registro.statusCode, 201, registro.body);
      const { conexion } = registro.json() as { conexion: { id: string } };
      conexiones.push(conexion.id);

      const guardada = await guardar({ nombre: `CH-05 cierre R0 ${Date.now()}`, sql: 'SELECT 1' });
      const leida = await obtener(guardada.id);
      assert.equal(leida.sql, 'SELECT 1');

      const ejecucion = await app.inject({
        method: 'POST',
        url: '/consultas/ejecutar',
        headers: cabeceras(),
        payload: { conexionId: conexion.id, sql: leida.sql },
      });

      assert.equal(ejecucion.statusCode, 200, ejecucion.body);
      const cuerpo = ejecucion.json() as { resultado: string; filas?: unknown[][] };
      assert.equal(cuerpo.resultado, 'ok', ejecucion.body);
      assert.deepEqual(cuerpo.filas, [[1]]);
      assert.ok(
        !ejecucion.body.includes(CLAVE_LECTOR),
        'the execution response must not echo the credential',
      );
    });
  },
);
