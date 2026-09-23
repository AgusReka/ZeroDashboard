import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { registerConexionRoutes } from './conexiones.js';
import { ENTIDADES_CANONICAS, registerVistaCanonicaRoutes } from './vistas-canonicas.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';

/**
 * Integration cases for CH-09 (tasks 2.1–2.11). Like CH-05's saved queries, this module
 * is routes plus Prisma with no pure classifier to isolate, so the meaningful coverage
 * is `app.inject()` against a real database — the convention `src/conexiones.test.ts`
 * established and `src/consultas-guardadas.test.ts` follows.
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * The `VistaCanonica` migration must already be applied to that database
 * (`npm run migrate`).
 *
 * Unlike CH-05, nothing here needs a login role: the registered SQL is inert text and
 * is never executed (DEC-31), so the connections this suite registers point at
 * placeholder coordinates that are never dialled. The two cases that need no server —
 * the entity catalog and the static no-execution assertion — sit outside the skip.
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

// `POST /conexiones` enciphers the credential it stores (CH-07), and the cipher reads
// its master key through `loadConfig()`, which demands the same variables the server
// boots with.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

interface ResumenVista {
  id: string;
  entidad: string;
  creadaEn: string;
  actualizadaEn: string;
}

interface CompletaVista extends ResumenVista {
  sql: string;
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

// ---- no server needed ------------------------------------------------------------------

describe('vistas canonicas — static guarantees', () => {
  test('ENTIDADES_CANONICAS is exactly the five contract entity names (DEC-32)', () => {
    assert.deepEqual(
      [...ENTIDADES_CANONICAS],
      ['producto', 'pedido', 'item_pedido', 'insumo', 'receta_componente'],
    );
  });

  /**
   * DEC-31's "nothing is executed" guarantee, pinned on the source text itself. Each
   * name below is a way into the tenant's target database: the connection resolver that
   * deciphers the stored secret, the probe, the execution entry point, and the secret
   * column. A module that never names any of them cannot reach that database, whatever
   * its routes do at runtime.
   */
  test('2.11 the route module never names a target-database entry point or the secret column', async () => {
    const fuente = await readFile(new URL('./vistas-canonicas.ts', import.meta.url), 'utf8');
    for (const prohibido of ['destinoDeConexion', 'probeConnection', 'ejecutarConsulta', 'credencial']) {
      assert.ok(
        !fuente.includes(prohibido),
        `src/vistas-canonicas.ts must not reference ${prohibido}`,
      );
    }
  });
});

// ---- live PostgreSQL -------------------------------------------------------------------

describe(
  'vista canonica routes — integration against a live PostgreSQL target',
  { skip: motivoSkip },
  () => {
    let app!: FastifyInstance;
    /**
     * The **raw** client, kept for fixtures, cleanup and the out-of-band assertions —
     * `tenantId` and `conexionId` are absent from every response projection, so reading
     * them back is only possible here. The app under test gets the extended one, so
     * these cases run against the real isolation extension.
     */
    let prisma!: PrismaClient;
    /** The tenant every call declares; case 2.1 asserts rows land on it. */
    let tenantEsperado!: string;

    before(async () => {
      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const tenant = await prisma.tenant.create({ data: { nombre: `CH-09 pruebas ${Date.now()}` } });
      tenantEsperado = tenant.id;

      // The context hooks go first: Fastify runs same-name hooks in registration order,
      // so a route registered ahead of them would run with no tenant context.
      const aislado = extenderConAislamiento(prisma);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerConexionRoutes(app, aislado);
      registerVistaCanonicaRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      // Both FKs are RESTRICT, so the definitions go before the connections they point
      // at, and the connections before the tenant.
      await prisma.vistaCanonica.deleteMany({ where: { tenantId: tenantEsperado } });
      await prisma.conexion.deleteMany({ where: { tenantId: tenantEsperado } });
      await prisma.tenant.delete({ where: { id: tenantEsperado } });
      await prisma.$disconnect();
      await app.close();
    });

    /** The one header that declares the active tenant (DEC-15). */
    function cabeceras(): Record<string, string> {
      return { 'x-tenant-id': tenantEsperado };
    }

    function ruta(conexionId: string, entidad?: string): string {
      const base = `/conexiones/${encodeURIComponent(conexionId)}/vistas-canonicas`;
      return entidad === undefined ? base : `${base}/${encodeURIComponent(entidad)}`;
    }

    /**
     * Registers a fresh connection through the API, so every case can own its pairs and
     * none depends on the order the others ran in. The coordinates are placeholders:
     * nothing in this suite ever dials them.
     */
    async function nuevaConexion(): Promise<string> {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: cabeceras(),
        payload: {
          nombre: `CH-09 conexion ${randomUUID()}`,
          motor: 'postgres',
          host: 'destino.invalido',
          puerto: 5432,
          baseDeDatos: 'replica',
          usuarioDb: 'lector',
          credencial: 'nunca-se-usa',
        },
      });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      return (respuesta.json() as { conexion: { id: string } }).conexion.id;
    }

    function registrar(conexionId: string, entidad: string, payload: unknown) {
      return app.inject({
        method: 'PUT',
        url: ruta(conexionId, entidad),
        headers: cabeceras(),
        payload: payload as Record<string, unknown>,
      });
    }

    /** Registers a definition and asserts the expected success code. */
    async function registrarOk(
      conexionId: string,
      entidad: string,
      sql: string,
      codigo: 200 | 201 = 201,
    ): Promise<CompletaVista> {
      const respuesta = await registrar(conexionId, entidad, { sql });
      assert.equal(respuesta.statusCode, codigo, respuesta.body);
      return (respuesta.json() as { vistaCanonica: CompletaVista }).vistaCanonica;
    }

    /** Submits a registration expected to be rejected, returning the `400` envelope. */
    async function rechazar(
      conexionId: string,
      entidad: string,
      payload: unknown,
    ): Promise<CuerpoRechazo> {
      const respuesta = await registrar(conexionId, entidad, payload);
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      const cuerpo = respuesta.json() as CuerpoRechazo;
      assert.equal(cuerpo.error, 'solicitud-invalida');
      assert.ok(Array.isArray(cuerpo.campos), 'the rejection must report the offending fields');
      return cuerpo;
    }

    function filasDelPar(conexionId: string, entidad: string): Promise<number> {
      return prisma.vistaCanonica.count({ where: { conexionId, entidad } });
    }

    // ---- 2.1 registering a valid definition --------------------------------------------

    test('2.1 a first registration answers 201 and persists on the declared tenant', async () => {
      const conexionId = await nuevaConexion();
      const vista = await registrarOk(conexionId, 'producto', 'SELECT 1');

      assert.ok(typeof vista.id === 'string' && vista.id.length > 0);
      assert.equal(vista.entidad, 'producto');
      assert.equal(vista.sql, 'SELECT 1');
      assert.deepEqual(Object.keys(vista).sort(), [
        'actualizadaEn',
        'creadaEn',
        'entidad',
        'id',
        'sql',
      ]);

      // Read through Prisma rather than the API: `tenantId` and `conexionId` are
      // deliberately absent from every response projection.
      const fila = await prisma.vistaCanonica.findUnique({ where: { id: vista.id } });
      assert.ok(fila !== null, 'the registered row must exist');
      assert.equal(fila.tenantId, tenantEsperado);
      assert.equal(fila.conexionId, conexionId);
      assert.equal(fila.entidad, 'producto');
      assert.equal(fila.sql, 'SELECT 1');
    });

    test('2.1 the statement is stored verbatim, untrimmed and with its semicolon', async () => {
      const conexionId = await nuevaConexion();
      const original = '  SELECT id, nombre FROM productos;  ';
      const vista = await registrarOk(conexionId, 'producto', original);

      assert.equal(vista.sql, original);
      const fila = await prisma.vistaCanonica.findUnique({ where: { id: vista.id } });
      assert.equal(fila?.sql, original);
    });

    // ---- 2.2 re-registering replaces in place (DEC-34) ---------------------------------

    test('2.2 a second registration of the same pair answers 200 and replaces in place', async () => {
      const conexionId = await nuevaConexion();
      const primera = await registrarOk(conexionId, 'producto', 'SELECT 1');
      // `actualizadaEn` is millisecond-precision; without the pause both writes can
      // share a timestamp and "advances" would be untestable.
      await new Promise((resolve) => setTimeout(resolve, 10));
      const segunda = await registrarOk(conexionId, 'producto', 'SELECT 2', 200);

      assert.equal(segunda.id, primera.id, 'a replace must keep the row id');
      assert.equal(segunda.sql, 'SELECT 2');
      assert.equal(segunda.creadaEn, primera.creadaEn, 'a replace must not reset creadaEn');
      assert.ok(
        Date.parse(segunda.actualizadaEn) > Date.parse(primera.actualizadaEn),
        'a replace must advance actualizadaEn',
      );

      const filas = await prisma.vistaCanonica.findMany({ where: { conexionId, entidad: 'producto' } });
      assert.equal(filas.length, 1, 'exactly one row may exist per connection/entity pair');
      assert.equal(filas[0]?.sql, 'SELECT 2', 'only the new statement may survive');
    });

    // ---- 2.3 entity validated against the contract only (DEC-32) ------------------------

    test('2.3 an entity outside the canonical contract is rejected and creates no row', async () => {
      const conexionId = await nuevaConexion();
      const cuerpo = await rechazar(conexionId, 'cliente', { sql: 'SELECT 1' });

      assert.deepEqual(cuerpo.campos, ['/entidad']);
      assert.equal(await filasDelPar(conexionId, 'cliente'), 0);
      assert.equal(await prisma.vistaCanonica.count({ where: { conexionId } }), 0);
    });

    // ---- 2.4 the body cannot carry a tenant --------------------------------------------

    test('2.4 a body carrying tenantId is rejected, and the tenant stays server-resolved', async () => {
      const conexionId = await nuevaConexion();
      const ajeno = '00000000-0000-0000-0000-000000000000';
      const cuerpo = await rechazar(conexionId, 'producto', { sql: 'SELECT 1', tenantId: ajeno });

      assert.ok(
        cuerpo.campos.includes('/tenantId'),
        `the rejection must name the tenantId path, got ${JSON.stringify(cuerpo.campos)}`,
      );
      assert.equal(await filasDelPar(conexionId, 'producto'), 0);

      // The accepted path never honours a submitted tenant either.
      const aceptada = await registrarOk(conexionId, 'producto', 'SELECT 1');
      const fila = await prisma.vistaCanonica.findUnique({ where: { id: aceptada.id } });
      assert.equal(fila?.tenantId, tenantEsperado);
      assert.notEqual(fila?.tenantId, ajeno);
    });

    test('2.4 an unknown body property is rejected and creates no row', async () => {
      const conexionId = await nuevaConexion();
      const cuerpo = await rechazar(conexionId, 'pedido', { sql: 'SELECT 1', desconocido: 'x' });

      assert.ok(
        cuerpo.campos.includes('/desconocido'),
        `the rejection must name the unknown property, got ${JSON.stringify(cuerpo.campos)}`,
      );
      assert.equal(await filasDelPar(conexionId, 'pedido'), 0);
    });

    // ---- 2.5 blank statements -----------------------------------------------------------

    test('2.5 a statement that is empty after trimming is rejected and creates no row', async () => {
      const conexionId = await nuevaConexion();
      // Pure whitespace, and a lone semicolon that `sanearSql` reduces to nothing.
      for (const sql of ['   ', ';', '  ;  ']) {
        const cuerpo = await rechazar(conexionId, 'insumo', { sql });
        assert.deepEqual(
          cuerpo.campos,
          ['/sql'],
          `${JSON.stringify(sql)} must be rejected on the sql path`,
        );
      }
      assert.equal(await filasDelPar(conexionId, 'insumo'), 0);
    });

    // ---- 2.6 unknown connection ---------------------------------------------------------

    test('2.6 a registration naming a nonexistent connection answers 404 and writes nothing', async () => {
      const inexistente = randomUUID();
      const respuesta = await registrar(inexistente, 'producto', { sql: 'SELECT 1' });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
      assert.equal(await prisma.vistaCanonica.count({ where: { conexionId: inexistente } }), 0);
    });

    // ---- 2.7 concurrent first registrations ---------------------------------------------

    /**
     * Two first writes to the same pair, in flight together. The unique constraint on
     * (`conexionId`, `entidad`) is the arbiter: exactly one `create` wins, and the loser
     * — whether it lost at the lookup or at the insert (`P2002`) — becomes a replace.
     * Run over every canonical entity of one connection, so five races per run rather
     * than one.
     */
    test('2.7 concurrent first registrations of one pair both succeed and leave one row', async () => {
      const conexionId = await nuevaConexion();
      for (const entidad of ENTIDADES_CANONICAS) {
        const [a, b] = await Promise.all([
          registrar(conexionId, entidad, { sql: 'SELECT 1' }),
          registrar(conexionId, entidad, { sql: 'SELECT 2' }),
        ]);

        assert.deepEqual(
          [a.statusCode, b.statusCode].sort(),
          [200, 201],
          `${entidad}: exactly one first write and one replace, got ${a.body} / ${b.body}`,
        );
        assert.equal(await filasDelPar(conexionId, entidad), 1, `${entidad}: exactly one row`);
      }
    });

    // ---- 2.8 / 2.9 listing ----------------------------------------------------------------

    test("2.8 the listing returns exactly the connection's definitions, summary only, by entidad", async () => {
      const conexionId = await nuevaConexion();
      const otraConexion = await nuevaConexion();
      const marca = `SELECT ${Date.now()} AS marca_ch09`;
      // Registered out of alphabetical order, so the order asserted below cannot be
      // insertion order by accident.
      const producto = await registrarOk(conexionId, 'producto', marca);
      const insumo = await registrarOk(conexionId, 'insumo', marca);
      await registrarOk(otraConexion, 'pedido', 'SELECT 1');

      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(conexionId),
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { vistasCanonicas } = respuesta.json() as { vistasCanonicas: ResumenVista[] };

      assert.deepEqual(
        vistasCanonicas.map((v) => v.id),
        [insumo.id, producto.id],
        'exactly the two definitions of this connection, ordered by entidad ascending',
      );
      for (const fila of vistasCanonicas) {
        assert.deepEqual(Object.keys(fila).sort(), ['actualizadaEn', 'creadaEn', 'entidad', 'id']);
      }
      assert.ok(!respuesta.body.includes(marca), 'no stored statement may appear in the list');
      assert.ok(!respuesta.body.includes(tenantEsperado), 'the list must not echo the tenant id');
    });

    test('2.8 a connection with no definitions lists an empty array', async () => {
      const conexionId = await nuevaConexion();
      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(conexionId),
        headers: cabeceras(),
      });

      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { vistasCanonicas: [] });
    });

    test('2.9 listing a nonexistent connection answers 404', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(randomUUID()),
        headers: cabeceras(),
      });

      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
    });

    // ---- 2.10 reading one definition --------------------------------------------------------

    test('2.10 reading a registered pair returns the full record, sql included', async () => {
      const conexionId = await nuevaConexion();
      const registrada = await registrarOk(conexionId, 'receta_componente', 'SELECT 3');

      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(conexionId, 'receta_componente'),
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { vistaCanonica } = respuesta.json() as { vistaCanonica: CompletaVista };
      assert.deepEqual(vistaCanonica, registrada, 'read-one must return exactly what PUT echoed');
    });

    test('2.10 reading an unregistered entity of an owned connection answers 404', async () => {
      const conexionId = await nuevaConexion();
      await registrarOk(conexionId, 'producto', 'SELECT 1');

      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(conexionId, 'pedido'),
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'vista-canonica-no-encontrada' });
    });

    test('2.10 reading on a nonexistent connection answers 404 conexion-no-encontrada', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(randomUUID(), 'producto'),
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
    });

    test('2.10 reading an entity outside the contract answers 400 on the entidad path', async () => {
      const conexionId = await nuevaConexion();
      const respuesta = await app.inject({
        method: 'GET',
        url: ruta(conexionId, 'cliente'),
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['/entidad'] });
    });
  },
);
