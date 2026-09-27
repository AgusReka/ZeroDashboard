import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerVistaCanonicaRoutes } from './vistas-canonicas.js';
import { registerValidacionMapeoRoutes } from './validacion-mapeo-rutas.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';

/**
 * Integration cases for CH-10 (tasks 4.1–4.9, spec `mapping-validation`). Every claim
 * the validate action makes — that `LIMIT 0` reads no row, that one broken entity does
 * not abort its siblings, that a data-modifying CTE is refused inside `READ ONLY`, that
 * a superuser is refused before any probe — is a claim about the *engine*, so the
 * target is a real PostgreSQL server, as in `consultas.test.ts`.
 *
 * The target is the project's own Compose `db` service, or any server these variables
 * point at (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * `TEST_DB_USER` must be a superuser (the fixture creates roles and a schema), and the
 * CH-10 migration must be applied (`npm run migrate`). The same server plays both
 * parts: the application's own database, and — through a separate schema and two login
 * roles — the tenant's replica the probe dials.
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
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';
// Long enough for the stale-write case, whose probe waits on a lock this suite holds.
process.env.QUERY_TIMEOUT_MS = '5000';

const ESQUEMA = 'ch10_pruebas';
const CLAVES = { lector: 'ch10-clave-lector', superusuario: 'ch10-clave-super' } as const;
const ROLES = ['ch10_lector', 'ch10_super'];

/** A `producto` view mapping every contract field exactly. */
const PRODUCTO_OK = `SELECT id, nombre, stock AS "stockDisponible", sku, activo FROM ${ESQUEMA}.producto`;
/** An `insumo` view, keyed by `uuid`, with the trailing semicolon an operator would type. */
const INSUMO_OK =
  `SELECT id, nombre, stock AS "stockDisponible", unidad AS "unidadMedida", codigo ` +
  `FROM ${ESQUEMA}.insumo;`;

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

/** Populated tables: the `1/(id-id)` case needs rows that would fail if read. */
const SQL_FIXTURE = `
CREATE SCHEMA ${ESQUEMA};
CREATE TABLE ${ESQUEMA}.producto (
  id integer PRIMARY KEY, nombre text NOT NULL, stock numeric NOT NULL,
  sku varchar(20), activo boolean NOT NULL);
INSERT INTO ${ESQUEMA}.producto VALUES
  (1, 'Café', 10, 'CAF-1', true), (2, 'Té', 0, NULL, true), (3, 'Mate', 4, 'MAT-3', false);
CREATE TABLE ${ESQUEMA}.insumo (
  id uuid PRIMARY KEY, nombre text NOT NULL, stock numeric NOT NULL, unidad text, codigo text);
INSERT INTO ${ESQUEMA}.insumo VALUES ('6f1c2a44-3a1b-4d7e-9a55-1f0c7b9e2d10', 'Yerba', 5, 'kg', 'Y1');

CREATE ROLE ch10_lector LOGIN PASSWORD '${CLAVES.lector}';
CREATE ROLE ch10_super LOGIN SUPERUSER PASSWORD '${CLAVES.superusuario}';
GRANT USAGE ON SCHEMA ${ESQUEMA} TO ch10_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA ${ESQUEMA} TO ch10_lector;`;

interface CampoDiagnostico {
  campo: string;
  columna: string | null;
  veredicto: string;
  tipoEsperado: string;
  tipoObservado: string | null;
  tipoPostgres: string | null;
}

interface Diagnostico {
  version: number;
  sondeo: { resultado: string; categoria?: string; codigo?: string | null };
  campos: CampoDiagnostico[];
  columnasSobrantes: { columna: string; oid: number }[];
}

interface Informe {
  entidades: {
    entidad: string;
    estado: string;
    validadaEn: string | null;
    diagnostico: Diagnostico | null;
  }[];
  automatizaciones: { automatizacion: string; estado: string; motivos: unknown[] }[];
}

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

/** A port nothing listens on: bound, read, released. */
function puertoCerrado(): Promise<number> {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address() as net.AddressInfo;
      servidor.close(() => resolve(port));
    });
  });
}

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip: string | false = alcanzable
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
    "bring up the Compose db service and set TEST_DB_* (see this file's header)";

// ---- no server needed ------------------------------------------------------------------

describe('validacion de mapeo — static guarantees', () => {
  /**
   * `tenant-schema-mapping`: only the explicit validate action executes registered SQL.
   * The probe entry point is named by exactly one route module, so no other route can
   * reach it — whatever its handler does at runtime.
   */
  test('only src/validacion-mapeo-rutas.ts calls sondearEstructura', async () => {
    const directorio = new URL('./', import.meta.url);
    const llamadores: string[] = [];
    for (const nombre of await readdir(directorio)) {
      if (!nombre.endsWith('.ts') || nombre.endsWith('.test.ts')) {
        continue;
      }
      const fuente = await readFile(new URL(nombre, directorio), 'utf8');
      if (fuente.includes('sondearEstructura(')) {
        llamadores.push(nombre);
      }
    }
    assert.deepEqual(llamadores.sort(), ['consulta-ejecucion.ts', 'validacion-mapeo-rutas.ts']);
  });
});

// ---- live PostgreSQL -------------------------------------------------------------------

describe(
  'validacion de mapeo routes — integration against a live PostgreSQL target',
  { skip: motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** The raw client, for fixtures and the out-of-band reads of persisted state. */
    let prisma!: PrismaClient;
    let admin!: pg.Client;
    let tenantA!: string;
    let tenantB!: string;

    before(async () => {
      admin = new pg.Client({ ...objetivo });
      await admin.connect();
      await admin.query(SQL_LIMPIEZA);
      await admin.query(SQL_FIXTURE);

      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      tenantA = (await prisma.tenant.create({ data: { nombre: `CH-10 A ${Date.now()}` } })).id;
      tenantB = (await prisma.tenant.create({ data: { nombre: `CH-10 B ${Date.now()}` } })).id;

      const aislado = extenderConAislamiento(prisma);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerConexionRoutes(app, aislado);
      registerVistaCanonicaRoutes(app, aislado);
      registerValidacionMapeoRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      for (const tenantId of [tenantA, tenantB]) {
        if (tenantId === undefined) {
          continue;
        }
        await prisma.vistaCanonica.deleteMany({ where: { tenantId } });
        await prisma.conexion.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } });
      }
      await prisma.$disconnect();
      await app.close();
      await admin.query(SQL_LIMPIEZA);
      await admin.end();
    });

    function cabeceras(tenantId = tenantA): Record<string, string> {
      return { 'x-tenant-id': tenantId };
    }

    function ruta(conexionId: string): string {
      return `/conexiones/${encodeURIComponent(conexionId)}/validacion-mapeo`;
    }

    interface Coordenadas {
      host: string;
      puerto: number;
      usuarioDb: string;
      credencial: string;
    }

    const LECTOR: Coordenadas = {
      host: objetivo.host,
      puerto: objetivo.port,
      usuarioDb: 'ch10_lector',
      credencial: CLAVES.lector,
    };
    /** Placeholder coordinates that nothing in a passing run ever dials. */
    const INALCANZABLE: Coordenadas = {
      host: 'destino.invalido',
      puerto: 5432,
      usuarioDb: 'nadie',
      credencial: 'nunca-se-usa',
    };

    async function nuevaConexion(coordenadas: Coordenadas, tenantId = tenantA): Promise<string> {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: cabeceras(tenantId),
        payload: {
          nombre: `CH-10 conexion ${randomUUID()}`,
          motor: 'postgres',
          baseDeDatos: objetivo.database,
          ...coordenadas,
        },
      });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      return (respuesta.json() as { conexion: { id: string } }).conexion.id;
    }

    async function registrar(
      conexionId: string,
      entidad: string,
      sql: string,
      tenantId = tenantA,
    ): Promise<string> {
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/conexiones/${conexionId}/vistas-canonicas/${entidad}`,
        headers: cabeceras(tenantId),
        payload: { sql },
      });
      assert.ok([200, 201].includes(respuesta.statusCode), respuesta.body);
      return (respuesta.json() as { vistaCanonica: { id: string } }).vistaCanonica.id;
    }

    function validar(conexionId: string, payload?: unknown, tenantId = tenantA) {
      return app.inject({
        method: 'POST',
        url: ruta(conexionId),
        headers: cabeceras(tenantId),
        ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
      });
    }

    function leer(conexionId: string, tenantId = tenantA) {
      return app.inject({ method: 'GET', url: ruta(conexionId), headers: cabeceras(tenantId) });
    }

    /** Validates and returns the report, asserting the session itself succeeded. */
    async function validarOk(conexionId: string): Promise<Informe> {
      const respuesta = await validar(conexionId);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { resultado: string; validacionMapeo: Informe };
      assert.equal(cuerpo.resultado, 'ok', respuesta.body);
      return cuerpo.validacionMapeo;
    }

    function entidadDe(informe: Informe, nombre: string) {
      const encontrada = informe.entidades.find((e) => e.entidad === nombre);
      assert.ok(encontrada !== undefined, `the report must list ${nombre}`);
      return encontrada;
    }

    function campoDe(informe: Informe, entidad: string, campo: string): CampoDiagnostico {
      const encontrado = entidadDe(informe, entidad).diagnostico?.campos.find(
        (c) => c.campo === campo,
      );
      assert.ok(encontrado !== undefined, `${entidad}.${campo} must carry a verdict`);
      return encontrado;
    }

    /** The three persisted columns, plus the SQL, read around the API. */
    function estadoPersistido(id: string) {
      return prisma.vistaCanonica.findUniqueOrThrow({
        where: { id },
        select: {
          sql: true,
          estadoValidacion: true,
          diagnosticoValidacion: true,
          validadaEn: true,
          actualizadaEn: true,
        },
      });
    }

    /** Writes a known validated state out of band, so "nothing persisted" is observable. */
    async function sembrarValidada(id: string): Promise<void> {
      await prisma.vistaCanonica.update({
        where: { id },
        data: {
          estadoValidacion: 'valida',
          diagnosticoValidacion: { version: 1, marca: 'sembrada' },
          validadaEn: new Date('2026-01-01T00:00:00Z'),
        },
      });
    }

    // ---- 4.1 the zero-row probe, persisted per entity -----------------------------------

    test('4.1 POST probes every mapped entity, persists valida and reports applicability', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);
      const insumo = await registrar(conexionId, 'insumo', INSUMO_OK);
      const antes = await estadoPersistido(producto);

      const informe = await validarOk(conexionId);

      assert.deepEqual(
        informe.entidades.map((e) => [e.entidad, e.estado]),
        [
          ['producto', 'valida'],
          ['pedido', 'no-mapeada'],
          ['item_pedido', 'no-mapeada'],
          ['insumo', 'valida'],
          ['receta_componente', 'no-mapeada'],
        ],
      );
      // uuid ids classify as identificador; the numeric stock as numero.
      assert.equal(campoDe(informe, 'insumo', 'id').tipoPostgres, 'uuid');
      assert.deepEqual(
        informe.automatizaciones.map((a) => [a.automatizacion, a.estado]),
        [
          ['stock-fisico', 'aplicable'],
          ['stock-producible', 'inaplicable'],
          ['reporte-diario', 'bloqueada'],
        ],
      );

      for (const id of [producto, insumo]) {
        const fila = await estadoPersistido(id);
        assert.equal(fila.estadoValidacion, 'valida');
        assert.equal((fila.diagnosticoValidacion as { version?: number }).version, 1);
        assert.ok(fila.validadaEn instanceof Date, 'the timestamp must be persisted');
      }
      // Validating a mapping does not touch its registration timestamp.
      const despues = await estadoPersistido(producto);
      assert.equal(despues.actualizadaEn.getTime(), antes.actualizadaEn.getTime());
      assert.equal(despues.sql, PRODUCTO_OK);
    });

    test('4.1 a second validation overwrites the first; one row per entity, no history', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);

      await validarOk(conexionId);
      const primera = await estadoPersistido(producto);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await validarOk(conexionId);
      const segunda = await estadoPersistido(producto);

      assert.ok((segunda.validadaEn as Date) > (primera.validadaEn as Date));
      assert.equal(await prisma.vistaCanonica.count({ where: { conexionId } }), 1);
    });

    // ---- 4.2 the diagnosed verdicts, against a live view ---------------------------------

    test('4.2 missing, wrong-type, extra and case-folded columns each get their verdict', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      const desde = `FROM ${ESQUEMA}.producto`;

      await registrar(conexionId, 'producto', `SELECT id, nombre, stock AS "stockDisponible", sku ${desde}`);
      let informe = await validarOk(conexionId);
      assert.equal(entidadDe(informe, 'producto').estado, 'invalida');
      assert.equal(campoDe(informe, 'producto', 'activo').veredicto, 'ausente');

      await registrar(
        conexionId,
        'producto',
        `SELECT id, nombre, stock::text AS "stockDisponible", sku, activo ${desde}`,
      );
      informe = await validarOk(conexionId);
      assert.deepEqual(
        (({ veredicto, tipoEsperado, tipoObservado, tipoPostgres }) => ({
          veredicto,
          tipoEsperado,
          tipoObservado,
          tipoPostgres,
        }))(campoDe(informe, 'producto', 'stockDisponible')),
        { veredicto: 'tipo-incorrecto', tipoEsperado: 'numero', tipoObservado: 'texto', tipoPostgres: 'text' },
      );

      await registrar(conexionId, 'producto', `SELECT id, nombre, stock AS "stockDisponible", sku, activo, nombre AS "notasInternas" ${desde}`);
      informe = await validarOk(conexionId);
      assert.equal(entidadDe(informe, 'producto').estado, 'invalida');
      assert.deepEqual(entidadDe(informe, 'producto').diagnostico?.columnasSobrantes, [
        { columna: 'notasInternas', oid: pg.types.builtins.TEXT },
      ]);

      // Unquoted: Postgres folds the alias to `stockdisponible`.
      await registrar(conexionId, 'producto', `SELECT id, nombre, stock AS stockDisponible, sku, activo ${desde}`);
      informe = await validarOk(conexionId);
      const alias = campoDe(informe, 'producto', 'stockDisponible');
      assert.equal(alias.veredicto, 'alias-sin-comillas');
      assert.equal(alias.columna, 'stockdisponible');
      assert.deepEqual(entidadDe(informe, 'producto').diagnostico?.columnasSobrantes, []);
    });

    // ---- 4.8 the body carries nothing, and never a tenant ---------------------------------

    test('4.8 a POST body carrying tenantId or any other property is 400, nothing probed or written', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);

      for (const [payload, campo] of [
        [{ tenantId: tenantB }, '/tenantId'],
        [{ entidades: ['producto'] }, '/entidades'],
      ] as const) {
        const respuesta = await validar(conexionId, payload);
        assert.equal(respuesta.statusCode, 400, respuesta.body);
        const cuerpo = respuesta.json() as { error: string; campos: string[] };
        assert.equal(cuerpo.error, 'solicitud-invalida');
        assert.ok(cuerpo.campos.includes(campo), `campos must name ${campo}: ${respuesta.body}`);
      }
      assert.equal((await estadoPersistido(producto)).estadoValidacion, 'no-validado');

      // A missing body and an empty object are both accepted.
      await validarOk(conexionId);
      const conVacio = await validar(conexionId, {});
      assert.equal(conVacio.statusCode, 200, conVacio.body);
    });

    // ---- 4.7 reading never dials; nothing mapped means nothing dialled ---------------------

    test('4.7 GET serves the persisted result with the host unreachable', async () => {
      const conexionId = await nuevaConexion(INALCANZABLE);
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);
      await sembrarValidada(producto);

      const respuesta = await leer(conexionId);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { validacionMapeo } = respuesta.json() as { validacionMapeo: Informe };
      const entidad = entidadDe(validacionMapeo, 'producto');
      assert.equal(entidad.estado, 'valida');
      assert.equal(entidad.validadaEn, '2026-01-01T00:00:00.000Z');
      assert.ok(!respuesta.body.includes(PRODUCTO_OK), 'the report must not echo the SQL');
      assert.ok(!respuesta.body.includes(tenantA), 'the report must not echo the tenant id');
    });

    test('4.7 a POST on a connection with nothing mapped answers the report without dialling', async () => {
      const conexionId = await nuevaConexion(INALCANZABLE);
      const informe = await validarOk(conexionId);
      assert.ok(informe.entidades.every((e) => e.estado === 'no-mapeada'));
    });

    // ---- 4.9 another tenant's connection ----------------------------------------------------

    test("4.9 POST and GET naming another tenant's connection are 404; nothing probed or written", async () => {
      const ajena = await nuevaConexion(LECTOR, tenantB);
      const vistaAjena = await registrar(ajena, 'producto', PRODUCTO_OK, tenantB);

      const post = await validar(ajena);
      assert.equal(post.statusCode, 404, post.body);
      assert.deepEqual(post.json(), { error: 'conexion-no-encontrada' });
      const get = await leer(ajena);
      assert.equal(get.statusCode, 404, get.body);
      assert.deepEqual(get.json(), { error: 'conexion-no-encontrada' });

      const fila = await estadoPersistido(vistaAjena);
      assert.equal(fila.estadoValidacion, 'no-validado');
      assert.equal(fila.validadaEn, null);

      // Control: the owner reaches the same connection.
      const propia = await validar(ajena, undefined, tenantB);
      assert.equal(propia.statusCode, 200, propia.body);
    });

    test('4.9 a nonexistent connection is 404 on both routes', async () => {
      for (const respuesta of [await validar(randomUUID()), await leer(randomUUID())]) {
        assert.equal(respuesta.statusCode, 404, respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
      }
    });

    // ---- 4.3 – 4.6 the engine-level edge cases -------------------------------------------

    test('4.3 a 42P01 on one entity leaves its sibling valida (per-entity savepoint)', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      await registrar(conexionId, 'producto', PRODUCTO_OK);
      await registrar(conexionId, 'insumo', `SELECT * FROM ${ESQUEMA}.no_existe`);

      const informe = await validarOk(conexionId);
      assert.equal(entidadDe(informe, 'producto').estado, 'valida');
      const insumo = entidadDe(informe, 'insumo');
      assert.equal(insumo.estado, 'invalida');
      assert.deepEqual(insumo.diagnostico?.sondeo, {
        resultado: 'fallo',
        categoria: 'error-sintaxis',
        codigo: '42P01',
      });
    });

    test('4.4 a view dividing by zero on every row still resolves valida: zero rows are read', async () => {
      const sql =
        `SELECT id, nombre, (1 / (id - id))::numeric AS "stockDisponible", sku, activo ` +
        `FROM ${ESQUEMA}.producto`;
      // Control: reading a single row of this view fails with a division by zero.
      await assert.rejects(admin.query(`${sql} LIMIT 1`), { code: '22012' });

      const conexionId = await nuevaConexion(LECTOR);
      await registrar(conexionId, 'producto', sql);
      const informe = await validarOk(conexionId);
      assert.equal(entidadDe(informe, 'producto').estado, 'valida');
    });

    test('4.5 a data-modifying CTE is no-es-lectura, and the target table is unchanged', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      await registrar(
        conexionId,
        'producto',
        `WITH borrado AS (DELETE FROM ${ESQUEMA}.producto RETURNING *) ` +
          `SELECT id, nombre, stock AS "stockDisponible", sku, activo FROM borrado`,
      );

      const informe = await validarOk(conexionId);
      const producto = entidadDe(informe, 'producto');
      assert.equal(producto.estado, 'invalida');
      assert.equal(producto.diagnostico?.sondeo.categoria, 'no-es-lectura');
      const { rows } = await admin.query(`SELECT count(*)::int AS n FROM ${ESQUEMA}.producto`);
      assert.equal(rows[0].n, 3);
    });

    test('4.6 a superuser role is refused before any probe; nothing is persisted', async () => {
      const conexionId = await nuevaConexion({
        ...LECTOR,
        usuarioDb: 'ch10_super',
        credencial: CLAVES.superusuario,
      });
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);
      await sembrarValidada(producto);
      const antes = await estadoPersistido(producto);

      const respuesta = await validar(conexionId);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { resultado: string; fase: string; categoria: string };
      assert.deepEqual(
        { resultado: cuerpo.resultado, fase: cuerpo.fase, categoria: cuerpo.categoria },
        { resultado: 'fallo', fase: 'permisos', categoria: 'rol-superusuario' },
      );
      assert.deepEqual(await estadoPersistido(producto), antes, 'the prior verdict must stand');
    });

    test('4.6 a closed port answers fase conexion; nothing is persisted', async () => {
      const conexionId = await nuevaConexion({
        ...LECTOR,
        host: '127.0.0.1',
        puerto: await puertoCerrado(),
      });
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);
      await sembrarValidada(producto);
      const antes = await estadoPersistido(producto);

      const respuesta = await validar(conexionId);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { resultado: string; fase: string };
      assert.deepEqual({ resultado: cuerpo.resultado, fase: cuerpo.fase }, { resultado: 'fallo', fase: 'conexion' });
      assert.deepEqual(await estadoPersistido(producto), antes, 'the prior verdict must stand');
    });

    // ---- 4.7 the stale-write guard --------------------------------------------------------

    /**
     * The race DEC-41 guards against, forced deterministically: the probe is held on a
     * lock this suite owns, the SQL is re-registered while it waits, and only then is the
     * lock released. The verdict about the old statement must land nowhere.
     */
    test('4.7 a re-registration during the probe wins: the stale verdict is not written', async () => {
      const conexionId = await nuevaConexion(LECTOR);
      const producto = await registrar(conexionId, 'producto', PRODUCTO_OK);
      const nuevaSql = `${PRODUCTO_OK} WHERE activo`;

      const bloqueo = new pg.Client({ ...objetivo });
      await bloqueo.connect();
      try {
        await bloqueo.query('BEGIN');
        await bloqueo.query(`LOCK TABLE ${ESQUEMA}.producto IN ACCESS EXCLUSIVE MODE`);

        const enCurso = validar(conexionId);
        const limite = Date.now() + 4000;
        for (;;) {
          const { rows } = await admin.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = 'ch10_lector' AND wait_event_type = 'Lock'",
          );
          if (rows[0].n > 0) {
            break;
          }
          assert.ok(Date.now() < limite, 'the probe never reached the lock');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        await registrar(conexionId, 'producto', nuevaSql);
        await bloqueo.query('ROLLBACK');

        const respuesta = await enCurso;
        assert.equal(respuesta.statusCode, 200, respuesta.body);
        const informe = (respuesta.json() as { validacionMapeo: Informe }).validacionMapeo;
        assert.equal(entidadDe(informe, 'producto').estado, 'no-validado');
      } finally {
        await bloqueo.end();
      }

      const fila = await estadoPersistido(producto);
      assert.equal(fila.sql, nuevaSql);
      assert.equal(fila.estadoValidacion, 'no-validado');
      assert.equal(fila.diagnosticoValidacion, null);
      assert.equal(fila.validadaEn, null);
    });
  },
);
