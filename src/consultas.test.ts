import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';

/**
 * Integration cases for CH-04 (tasks 6.1–6.5). They dial a real PostgreSQL server on
 * purpose: every claim this change makes — that a `READ ONLY` transaction stops a
 * data-modifying CTE, that `has_*_privilege()` resolves `INHERIT` chains, that
 * `statement_timeout` reports `57014` — is a claim about the *engine*, and a mocked
 * driver would only prove that the mock returns what it was told.
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * `TEST_DB_USER` must be a superuser: the fixture creates roles and a schema. When
 * the server is unreachable the whole suite skips with a reason instead of failing,
 * so `npm test` stays runnable without Docker.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

/** Query budget for this suite. Short enough that case 6.4 does not burn 15 s. */
const PRESUPUESTO_CONSULTA_MS = 2000;
/** Slack for the HTTP round trip, process scheduling, and the 2000 ms backstop. */
const MARGEN_MS = 4000;

const ESQUEMA = 'ch04_pruebas';
const TABLA = `${ESQUEMA}.articulo`;

/** One password per role, all distinct, so a leak assertion names the guilty one. */
const CLAVES = {
  lector: 'ch04-clave-lector',
  escritorTabla: 'ch04-clave-escritor-tabla',
  creador: 'ch04-clave-creador',
  superusuario: 'ch04-clave-super',
  miembroInherit: 'ch04-clave-inherit',
  miembroNoInherit: 'ch04-clave-noinherit',
} as const;

const ROLES = [
  'ch04_lector',
  'ch04_escritor_tabla',
  'ch04_creador',
  'ch04_super',
  'ch04_grupo_escritor',
  'ch04_miembro_inherit',
  'ch04_miembro_noinherit',
];

const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

// The engine reads both budgets through `loadConfig()` on every call, and
// `loadConfig()` demands the same variables the server boots with.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.QUERY_TIMEOUT_MS = String(PRESUPUESTO_CONSULTA_MS);

interface CuerpoOk {
  resultado: 'ok';
  fase: string;
  columnas: string[];
  filas: unknown[][];
  paginacion: {
    limite: number;
    desplazamiento: number;
    hayMas: boolean;
    siguienteDesplazamiento: number | null;
  };
  duracionMs: number;
}

interface CuerpoFallo {
  resultado: 'fallo';
  fase: string;
  categoria: string;
  codigo: string | null;
  duracionMs: number;
}

type CuerpoEjecucion = CuerpoOk | CuerpoFallo;

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

/** Drops every fixture object. Safe to run before creation and after teardown. */
const SQL_LIMPIEZA = `
DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE;
DO $limpieza$
DECLARE rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY[${ROLES.map((r) => `'${r}'`).join(',')}] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = rol) THEN
      EXECUTE format('DROP OWNED BY %I', rol);
      EXECUTE format('DROP ROLE %I', rol);
    END IF;
  END LOOP;
END
$limpieza$;`;

/**
 * Six login roles against one database, each isolating exactly one leg of DEC-08.
 * PostgreSQL 16 no longer grants `CREATE ON SCHEMA public` to `PUBLIC`, so a plain
 * new role starts with no schema-`CREATE` anywhere — which is what makes
 * `ch04_lector` a clean control rather than an accident of the server's defaults.
 */
const SQL_FIXTURE = `
CREATE SCHEMA ${ESQUEMA};
CREATE TABLE ${TABLA} (id integer PRIMARY KEY, nombre text NOT NULL);
INSERT INTO ${TABLA} (id, nombre) VALUES (1, 'Café'), (2, 'Té'), (3, 'Mate');

CREATE ROLE ch04_lector LOGIN PASSWORD '${CLAVES.lector}';
CREATE ROLE ch04_escritor_tabla LOGIN PASSWORD '${CLAVES.escritorTabla}';
CREATE ROLE ch04_creador LOGIN PASSWORD '${CLAVES.creador}';
CREATE ROLE ch04_super LOGIN SUPERUSER PASSWORD '${CLAVES.superusuario}';
CREATE ROLE ch04_grupo_escritor NOLOGIN;
CREATE ROLE ch04_miembro_inherit LOGIN INHERIT PASSWORD '${CLAVES.miembroInherit}';
CREATE ROLE ch04_miembro_noinherit LOGIN NOINHERIT PASSWORD '${CLAVES.miembroNoInherit}';

GRANT USAGE ON SCHEMA ${ESQUEMA} TO ch04_lector, ch04_escritor_tabla, ch04_creador,
  ch04_grupo_escritor, ch04_miembro_inherit, ch04_miembro_noinherit;
GRANT SELECT ON ${TABLA} TO ch04_lector, ch04_escritor_tabla, ch04_creador,
  ch04_miembro_inherit, ch04_miembro_noinherit;

-- Leg 2: table-level write, and nothing else.
GRANT INSERT ON ${TABLA} TO ch04_escritor_tabla;
-- Leg 3: schema-level CREATE, and no table grant beyond SELECT.
GRANT CREATE ON SCHEMA ${ESQUEMA} TO ch04_creador;
-- Decision 2: the write privilege is reachable only through role membership.
GRANT INSERT ON ${TABLA} TO ch04_grupo_escritor;
GRANT ch04_grupo_escritor TO ch04_miembro_inherit;
GRANT ch04_grupo_escritor TO ch04_miembro_noinherit;`;

describe(
  'consulta routes — integration against a live PostgreSQL target',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    let prisma!: PrismaClient;
    let admin!: pg.Client;
    const creadas: string[] = [];
    /** Set only when this fixture had to create the tenant, so teardown removes
     * exactly what it added and leaves a seeded development database untouched. */
    let tenantCreado: string | null = null;

    before(async () => {
      admin = new pg.Client({ ...objetivo });
      await admin.connect();
      await admin.query(SQL_LIMPIEZA);
      await admin.query(SQL_FIXTURE);

      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      // `POST /conexiones` resolves the tenant server-side and answers `503
      // tenant-no-inicializado` when no `Tenant` row exists. A freshly migrated
      // database has none — only the container entrypoint's seed step creates one —
      // so the fixture provisions it rather than depending on how the target was
      // brought up.
      const existente = await prisma.tenant.findFirst({
        orderBy: { creadoEn: 'asc' },
        select: { id: true },
      });
      if (existente === null) {
        const tenant = await prisma.tenant.create({ data: { nombre: 'CH-04 pruebas' } });
        tenantCreado = tenant.id;
      }

      app = Fastify({ logger: false });
      registerConexionRoutes(app, prisma);
      registerConsultaRoutes(app, prisma);
      await app.ready();
    });

    after(async () => {
      if (creadas.length > 0) {
        await prisma.conexion.deleteMany({ where: { id: { in: creadas } } });
      }
      if (tenantCreado !== null) {
        await prisma.tenant.delete({ where: { id: tenantCreado } });
      }
      await prisma.$disconnect();
      await app.close();
      // The fixture roles and schema exist only for this suite; the own database
      // goes back to how it was, whatever the outcome above.
      await admin.query(SQL_LIMPIEZA);
      await admin.end();
    });

    /** Registers a connection that logs in as `usuarioDb` with `credencial`. */
    async function registrar(usuarioDb: string, credencial: string): Promise<string> {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/conexiones',
        payload: {
          nombre: `CH-04 ${usuarioDb} ${Date.now()}`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb,
          credencial,
        },
      });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      const { conexion } = respuesta.json() as { conexion: { id: string } };
      creadas.push(conexion.id);
      return conexion.id;
    }

    async function ejecutar(
      conexionId: string,
      sql: string,
      paginacion: { limite?: number; desplazamiento?: number } = {},
    ): Promise<{ cuerpo: CuerpoEjecucion; crudo: string }> {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas/ejecutar',
        payload: { conexionId, sql, ...paginacion },
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      return { cuerpo: respuesta.json() as CuerpoEjecucion, crudo: respuesta.body };
    }

    async function contarArticulos(): Promise<number> {
      const { rows } = await admin.query<{ total: string }>(`SELECT count(*) AS total FROM ${TABLA}`);
      return Number(rows[0].total);
    }

    // ---- 6.1 read-only enforcement -------------------------------------------------

    test('6.1 a plain SELECT returns the requested rows', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo, crudo } = await ejecutar(id, `SELECT id, nombre FROM ${TABLA} ORDER BY id`);

      assert.equal(cuerpo.resultado, 'ok', JSON.stringify(cuerpo));
      const ok = cuerpo as CuerpoOk;
      assert.deepEqual(ok.columnas, ['id', 'nombre']);
      assert.deepEqual(ok.filas, [
        [1, 'Café'],
        [2, 'Té'],
        [3, 'Mate'],
      ]);
      assert.equal(ok.paginacion.hayMas, false);
      assert.equal(ok.paginacion.siguienteDesplazamiento, null);
      assert.ok(!crudo.includes(CLAVES.lector), 'a successful execution must not echo the credential');
    });

    test('6.1 multi-statement text is rejected and neither statement executes', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(id, 'SELECT 1; SELECT 2');

      assert.equal(cuerpo.resultado, 'fallo', JSON.stringify(cuerpo));
      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.fase, 'ejecucion');
      // Multi-statement text and an ordinary syntax error share this category by
      // design: they are distinguishable only by locale-dependent message text.
      assert.equal(fallo.categoria, 'error-sintaxis');
      assert.ok(!('filas' in cuerpo), 'a rejected submission must carry no rows');
    });

    test('6.1 a multi-statement submission carrying a DELETE changes nothing', async () => {
      const antes = await contarArticulos();
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(id, `SELECT 1; DELETE FROM ${TABLA}`);

      assert.equal(cuerpo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal(await contarArticulos(), antes, 'no row may be deleted by a rejected submission');
    });

    /**
     * The rejection arrives as SQLSTATE `0A000`, not the `25006` that `design.md`
     * claim C4 originally assumed, and the cause is decision 6, not decision 4.
     * Measured against PostgreSQL 16:
     *
     *   wrapped   + READ ONLY tx -> 0A000  "WITH clause containing a data-modifying
     *                                       statement must be at the top level"
     *   UNwrapped + READ ONLY tx -> 25006  (design's assumed path — pinned below)
     *   wrapped   + READ WRITE tx -> 0A000 (proves the wrapper, not READ ONLY, rejects)
     *
     * The pagination wrapper `SELECT * FROM (<sql>) AS _consulta_usuario LIMIT $1
     * OFFSET $2` demotes the CTE to a subquery, and PostgreSQL refuses a
     * data-modifying CTE anywhere but the top level at parse-analysis time — before
     * the executor, and therefore before `ExecCheckXactReadOnly` can ever run.
     *
     * Resolved (2026-09-16): `classifyExecutionError` now maps `0A000` to the same
     * `no-es-lectura` category as `25006`, because both mean "this statement is not a
     * read" and differ only in where the engine caught it. `design.md` claim C4 and
     * the `specs/query-execution/spec.md` scenario were amended to name both codes.
     * The raw `codigo` is still reported, so the two catch points stay distinguishable
     * here while the console shows one legible reason either way.
     */
    test('6.1 a data-modifying CTE is rejected (0A000 -> no-es-lectura) and deletes nothing', async () => {
      const antes = await contarArticulos();
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(
        id,
        `WITH x AS (DELETE FROM ${TABLA} RETURNING *) SELECT * FROM x`,
      );

      assert.equal(cuerpo.resultado, 'fallo', JSON.stringify(cuerpo));
      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.fase, 'ejecucion');
      assert.equal(fallo.codigo, '0A000');
      assert.equal(fallo.categoria, 'no-es-lectura');
      // The scenario's real guarantee, unaffected by which code rejects it.
      assert.equal(await contarArticulos(), antes, 'the CTE must not have deleted a row');
    });

    test('6.1 the READ ONLY transaction does reject an unwrapped data-modifying CTE', async () => {
      // Companion to the case above: decision 4's mechanism is real and is pinned
      // here, at the driver level, so the discrepancy stays attributable to the
      // pagination wrapper rather than becoming a doubt about `READ ONLY` itself.
      const cliente = new pg.Client({
        host: objetivo.host,
        port: objetivo.port,
        database: objetivo.database,
        user: 'ch04_lector',
        password: CLAVES.lector,
      });
      await cliente.connect();
      try {
        await cliente.query('BEGIN TRANSACTION READ ONLY');
        await assert.rejects(
          () => cliente.query(`WITH x AS (DELETE FROM ${TABLA} RETURNING *) SELECT * FROM x`),
          (error: unknown) => (error as { code?: string }).code === '25006',
          'a top-level data-modifying CTE must be refused by the READ ONLY transaction',
        );
      } finally {
        await cliente.query('ROLLBACK').catch(() => undefined);
        await cliente.end();
      }
      assert.equal(await contarArticulos(), 3, 'the unwrapped CTE must not have deleted a row');
    });

    test('6.1 a syntactically invalid statement reports a legible failure, no stack', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo, crudo } = await ejecutar(id, 'SELECT FROM WHERE');

      assert.equal(cuerpo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal((cuerpo as CuerpoFallo).categoria, 'error-sintaxis');
      assert.deepEqual(Object.keys(cuerpo).sort(), [
        'categoria',
        'codigo',
        'duracionMs',
        'fase',
        'resultado',
      ]);
      assert.ok(!crudo.includes('    at '), 'no stack frame may reach the response body');
      assert.ok(!crudo.includes(CLAVES.lector), 'a failed execution must not echo the credential');
    });

    // ---- 6.2 the four DEC-08 roles -------------------------------------------------

    test('6.2 a role with table INSERT is blocked as rol-con-escritura-en-tabla', async () => {
      const id = await registrar('ch04_escritor_tabla', CLAVES.escritorTabla);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA}`);

      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal(fallo.fase, 'permisos');
      assert.equal(fallo.categoria, 'rol-con-escritura-en-tabla');
      assert.equal(fallo.codigo, null);
    });

    test('6.2 a role with only schema CREATE is blocked as rol-con-create-en-esquema', async () => {
      const id = await registrar('ch04_creador', CLAVES.creador);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA}`);

      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal(fallo.fase, 'permisos');
      assert.equal(fallo.categoria, 'rol-con-create-en-esquema');
    });

    test('6.2 a superuser is blocked as rol-superusuario, ahead of every other leg', async () => {
      const id = await registrar('ch04_super', CLAVES.superusuario);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA}`);

      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal(fallo.fase, 'permisos');
      // Pins design decision 1: a superuser bypasses every permission check, so the
      // enumeration legs say nothing useful about one and must not be what reports it.
      assert.equal(fallo.categoria, 'rol-superusuario');
    });

    // ---- 6.3 role inheritance (design decision 2) ----------------------------------

    test('6.3 write privilege inherited through an INHERIT membership blocks', async () => {
      const id = await registrar('ch04_miembro_inherit', CLAVES.miembroInherit);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA}`);

      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal(fallo.fase, 'permisos');
      assert.equal(fallo.categoria, 'rol-con-escritura-en-tabla');
    });

    test('6.3 a NOINHERIT membership passes the check — the documented residual gap', async () => {
      const id = await registrar('ch04_miembro_noinherit', CLAVES.miembroNoInherit);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA} ORDER BY id`);

      assert.equal(cuerpo.resultado, 'ok', JSON.stringify(cuerpo));
      assert.equal((cuerpo as CuerpoOk).filas.length, 3);
    });

    test('6.3 SET ROLE still cannot write inside a READ ONLY transaction', async () => {
      // The privilege check cannot see a `NOINHERIT` membership by construction. This
      // is the layer that actually prevents the write: the transaction attribute is
      // checked at execution time regardless of which role is current.
      const cliente = new pg.Client({
        host: objetivo.host,
        port: objetivo.port,
        database: objetivo.database,
        user: 'ch04_miembro_noinherit',
        password: CLAVES.miembroNoInherit,
      });
      await cliente.connect();
      try {
        await cliente.query('BEGIN TRANSACTION READ ONLY');
        await cliente.query('SET ROLE ch04_grupo_escritor');
        await assert.rejects(
          () => cliente.query(`INSERT INTO ${TABLA} (id, nombre) VALUES (99, 'Intruso')`),
          (error: unknown) => (error as { code?: string }).code === '25006',
          'SET ROLE must not lift the READ ONLY transaction',
        );
      } finally {
        await cliente.query('ROLLBACK').catch(() => undefined);
        await cliente.end();
      }
      assert.equal(await contarArticulos(), 3, 'the SET ROLE attempt must not have written');
    });

    // ---- 6.4 bounded execution timeout ---------------------------------------------

    test('6.4 a statement past the budget is cut off as tiempo-agotado', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const segundos = (PRESUPUESTO_CONSULTA_MS * 2) / 1000;

      const iniciado = Date.now();
      const { cuerpo } = await ejecutar(id, `SELECT pg_sleep(${segundos})`);
      const transcurrido = Date.now() - iniciado;

      const fallo = cuerpo as CuerpoFallo;
      assert.equal(fallo.resultado, 'fallo', JSON.stringify(cuerpo));
      assert.equal(fallo.fase, 'ejecucion');
      assert.equal(fallo.categoria, 'tiempo-agotado');
      // `57014` is the server-side path; `null` is the race backstop. Both are facts —
      // a code, or who won the race — and never an elapsed-time comparison.
      assert.ok(
        fallo.codigo === '57014' || fallo.codigo === null,
        `expected 57014 or null, got ${String(fallo.codigo)}`,
      );
      assert.ok(
        transcurrido <= PRESUPUESTO_CONSULTA_MS + MARGEN_MS,
        `the execution took ${transcurrido} ms, past the ${PRESUPUESTO_CONSULTA_MS} ms budget`,
      );
    });

    // ---- 6.5 pagination and the trailing semicolon ---------------------------------

    test('6.5 limite 2 over three rows reports hayMas and the next offset', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA} ORDER BY id`, { limite: 2 });

      const ok = cuerpo as CuerpoOk;
      assert.equal(ok.resultado, 'ok', JSON.stringify(cuerpo));
      assert.deepEqual(ok.filas, [[1], [2]]);
      assert.equal(ok.paginacion.hayMas, true);
      assert.equal(ok.paginacion.siguienteDesplazamiento, 2);
    });

    test('6.5 the next page returns the last row and reports no further pages', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA} ORDER BY id`, {
        limite: 2,
        desplazamiento: 2,
      });

      const ok = cuerpo as CuerpoOk;
      assert.equal(ok.resultado, 'ok', JSON.stringify(cuerpo));
      assert.deepEqual(ok.filas, [[3]]);
      assert.equal(ok.paginacion.hayMas, false);
      assert.equal(ok.paginacion.siguienteDesplazamiento, null);
    });

    test('6.5 a statement with a trailing semicolon executes normally', async () => {
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(id, `SELECT id FROM ${TABLA} ORDER BY id;  `);

      const ok = cuerpo as CuerpoOk;
      assert.equal(ok.resultado, 'ok', JSON.stringify(cuerpo));
      assert.deepEqual(ok.filas, [[1], [2], [3]]);
    });

    test('6.5 duplicate output column names both survive the row encoding', async () => {
      // `rowMode: 'array'` exists for exactly this: an object row would collapse them.
      const id = await registrar('ch04_lector', CLAVES.lector);
      const { cuerpo } = await ejecutar(id, 'SELECT 1 AS a, 2 AS a');

      const ok = cuerpo as CuerpoOk;
      assert.equal(ok.resultado, 'ok', JSON.stringify(cuerpo));
      assert.deepEqual(ok.columnas, ['a', 'a']);
      assert.deepEqual(ok.filas, [[1, 2]]);
    });
  },
);
