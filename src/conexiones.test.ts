import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { registerConexionRoutes } from './conexiones.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';

/**
 * Integration cases for CH-03 (tasks 5.1–5.4, plus two cases added after verify to
 * cover the spec scenarios "Rejecting an incomplete registration" and "Testing a
 * connection with a non-PostgreSQL engine value"). They dial a real PostgreSQL server
 * on purpose: the exact `pg` failure codes were the research gap this change had to
 * close, and a mocked driver would only prove that the mock returns what it was told.
 *
 * The target is the project's own Compose `db` service. `docker-compose.yml` does not
 * publish its port, so either publish it with a local override or point these
 * variables at the running server (defaults match `.env.example`):
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * When that server is unreachable the whole suite skips with a reason instead of
 * failing, so `npm test` stays runnable without Docker. `scripts/smoke.sh` covers the
 * same four cases end-to-end inside the Compose network, where no override is needed.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

/**
 * RFC 5737 TEST-NET-1: routable nowhere. Packets are dropped rather than refused, so
 * the attempt hangs until the budget expires — which is exactly row 1, not row 2.
 */
const HOST_INALCANZABLE = '192.0.2.1';
/** Short budget so case 5.4 does not burn the 5000 ms production default. */
const TIMEOUT_MS = 1500;
/** Slack for process scheduling and the HTTP round trip on top of the budget. */
const MARGEN_MS = 1500;

const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

// `probeConnection` reads the budget through `loadConfig()` on every call, and
// `loadConfig()` demands the same variables the server boots with.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
// CH-07: loadConfig() now refuses to run without a valid master key (DEC-17), so every
// suite that boots the app supplies a fixture key of its own. It is a literal, not a
// generated value: slice-2 fixtures write envelopes by hand and have to be able to open
// them again in the same run.
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';
process.env.CONNECTION_TEST_TIMEOUT_MS = String(TIMEOUT_MS);

interface CuerpoRegistro {
  nombre: string;
  motor: string;
  host: string;
  puerto: number;
  baseDeDatos: string;
  usuarioDb: string;
  credencial: string;
}

interface CuerpoPrueba {
  resultado: 'ok' | 'fallo';
  categoria: string | null;
  codigo: string | null;
  host: string;
  puerto: number;
  duracionMs: number;
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
  'bring up the Compose db service and set TEST_DB_* (see this file\'s header)';

describe(
  'conexion routes — integration against a live PostgreSQL target',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /**
     * The **raw** client, kept for fixtures, cleanup and the out-of-band assertions.
     * The app under test gets the extended one, so these cases exercise the real
     * CH-06 isolation extension rather than a client that behaves like the old one;
     * the raw handle is what makes a cross-tenant check meaningful at all, and it
     * exists only in this file, never in `src/`.
     */
    let prisma!: PrismaClient;
    const creadas: string[] = [];
    /**
     * Since CH-06 every request names its tenant (DEC-15) and there is no
     * "first tenant ever created" fallback, so this suite creates the one it needs
     * instead of depending on how the target database was brought up.
     */
    let tenantPruebas!: string;

    before(async () => {
      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const tenant = await prisma.tenant.create({ data: { nombre: `CH-03 pruebas ${Date.now()}` } });
      tenantPruebas = tenant.id;

      const aislado = extenderConAislamiento(prisma);
      app = Fastify({ logger: false });
      // First, before the route registration: Fastify runs same-name hooks in
      // registration order, so a route registered ahead of this would run with no
      // tenant context and every scoped query would throw.
      registrarContextoTenant(app, aislado);
      registerConexionRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      // The rows exist only to be probed; the own database goes back to how it was.
      if (creadas.length > 0) {
        await prisma.conexion.deleteMany({ where: { id: { in: creadas } } });
      }
      // The FK is RESTRICT, so anything still pointing at the fixture tenant has to go
      // before the tenant itself can.
      await prisma.conexion.deleteMany({ where: { tenantId: tenantPruebas } });
      await prisma.tenant.delete({ where: { id: tenantPruebas } });
      await prisma.$disconnect();
      await app.close();
    });

    /**
     * The one header that declares the active tenant (DEC-15). Every `inject` in this
     * suite carries it: since CH-06 a scoped route with no header is a `400
     * tenant-no-indicado` before the handler runs, so this is the only change these
     * CH-03 cases needed — their assertions are untouched.
     */
    function cabeceras(): Record<string, string> {
      return { 'x-tenant-id': tenantPruebas };
    }

    /** Registers a connection pointing at the live target, with per-case overrides. */
    async function registrar(overrides: Partial<CuerpoRegistro> = {}): Promise<string> {
      const cuerpo: CuerpoRegistro = {
        nombre: 'Replica de prueba CH-03',
        motor: 'postgres',
        host: objetivo.host,
        puerto: objetivo.port,
        baseDeDatos: objetivo.database,
        usuarioDb: objetivo.user,
        credencial: objetivo.password,
        ...overrides,
      };
      const respuesta = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: cabeceras(),
        payload: cuerpo,
      });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      assert.ok(
        !respuesta.body.includes(cuerpo.credencial),
        'the registration response must not echo the submitted credential',
      );
      const { conexion } = respuesta.json() as { conexion: { id: string } };
      creadas.push(conexion.id);
      return conexion.id;
    }

    async function probar(id: string): Promise<{ cuerpo: CuerpoPrueba; crudo: string }> {
      const respuesta = await app.inject({
        method: 'POST',
        url: `/conexiones/${id}/prueba`,
        headers: cabeceras(),
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      return { cuerpo: respuesta.json() as CuerpoPrueba, crudo: respuesta.body };
    }

    test('5.1 a reachable target reports success', async () => {
      const id = await registrar();
      const { cuerpo, crudo } = await probar(id);

      assert.equal(cuerpo.resultado, 'ok');
      assert.equal(cuerpo.categoria, null);
      assert.equal(cuerpo.codigo, null);
      assert.equal(cuerpo.host, objetivo.host);
      assert.equal(cuerpo.puerto, objetivo.port);
      assert.ok(Number.isInteger(cuerpo.duracionMs) && cuerpo.duracionMs >= 0);
      assert.ok(
        !crudo.includes(objetivo.password),
        'a successful test must not echo the credential',
      );
    });

    test('5.2 a wrong password is classified as credenciales-invalidas', async () => {
      const credencial = 'contrasena-incorrecta-ch03';
      const id = await registrar({ credencial, nombre: 'Replica CH-03 credencial invalida' });
      const { cuerpo, crudo } = await probar(id);

      assert.equal(cuerpo.resultado, 'fallo');
      assert.equal(cuerpo.categoria, 'credenciales-invalidas');
      assert.equal(cuerpo.codigo, '28P01');
      assert.ok(!crudo.includes(credencial), 'a failed test must not echo the credential');
    });

    test('5.3 a nonexistent database is classified as base-inexistente', async () => {
      const id = await registrar({
        baseDeDatos: 'base-inexistente-ch03',
        nombre: 'Replica CH-03 base inexistente',
      });
      const { cuerpo } = await probar(id);

      assert.equal(cuerpo.resultado, 'fallo');
      assert.equal(cuerpo.categoria, 'base-inexistente');
      assert.equal(cuerpo.codigo, '3D000');
    });

    test('5.4 an unroutable host fails as tiempo-agotado within the budget', async () => {
      const id = await registrar({
        host: HOST_INALCANZABLE,
        nombre: 'Replica CH-03 host inalcanzable',
      });

      const iniciado = Date.now();
      const { cuerpo } = await probar(id);
      const transcurrido = Date.now() - iniciado;

      assert.equal(cuerpo.resultado, 'fallo');
      assert.equal(cuerpo.categoria, 'tiempo-agotado');
      assert.equal(cuerpo.host, HOST_INALCANZABLE);
      assert.ok(
        transcurrido <= TIMEOUT_MS + MARGEN_MS,
        `the response took ${transcurrido} ms, past the ${TIMEOUT_MS} ms budget`,
      );
      assert.ok(
        cuerpo.duracionMs <= TIMEOUT_MS + MARGEN_MS,
        `the attempt lasted ${cuerpo.duracionMs} ms, past the ${TIMEOUT_MS} ms budget`,
      );
    });

    /**
     * Spec: "Rejecting an incomplete registration". Added after verify found this
     * scenario had no covering test anywhere. `credencial` is the omitted field
     * because it is the one no response may echo back, whatever the outcome.
     */
    test('an incomplete registration is rejected and creates no row', async () => {
      const nombre = `Replica CH-03 registro incompleto ${Date.now()}`;
      const cuerpoIncompleto = {
        nombre,
        motor: 'postgres',
        host: objetivo.host,
        puerto: objetivo.port,
        baseDeDatos: objetivo.database,
        usuarioDb: objetivo.user,
        // `credencial` omitted on purpose — the schema marks it required.
      };

      const respuesta = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: cabeceras(),
        payload: cuerpoIncompleto,
      });

      assert.equal(respuesta.statusCode, 400, respuesta.body);
      const cuerpo = respuesta.json() as { error: string; campos: string[] };
      assert.equal(cuerpo.error, 'solicitud-invalida');
      assert.ok(Array.isArray(cuerpo.campos), 'the rejection must report the offending fields');
      assert.ok(cuerpo.campos.length > 0, 'the rejection must name at least one field');

      // The row must not exist: the rejection lands before any Prisma write.
      const filas = await prisma.conexion.count({ where: { nombre } });
      assert.equal(filas, 0, 'a rejected registration must not create a Conexion row');
    });

    /**
     * Spec: "Testing a connection with a non-PostgreSQL engine value". The probe is
     * fixed and unconditional, so `motor` must not gate it: the attempt reaches the
     * socket and comes back as a completed verdict (200), never as a refusal.
     */
    test('a non-postgres motor still probes the stored host and port', async () => {
      const id = await registrar({ motor: 'mysql', nombre: 'Replica CH-03 motor mysql' });

      const respuesta = await app.inject({
        method: 'POST',
        url: `/conexiones/${id}/prueba`,
        headers: cabeceras(),
      });

      // Not a gating-shaped rejection: no 4xx/422 refusal on account of `motor`.
      assert.equal(
        respuesta.statusCode,
        200,
        `a non-postgres motor must not be refused pre-socket: ${respuesta.body}`,
      );
      const cuerpo = respuesta.json() as CuerpoPrueba;
      assert.ok(
        !('error' in cuerpo),
        `the probe must return a verdict, not an error: ${respuesta.body}`,
      );
      assert.ok(
        cuerpo.resultado === 'ok' || cuerpo.resultado === 'fallo',
        `expected a legible verdict, got ${String(cuerpo.resultado)}`,
      );
      if (cuerpo.resultado === 'fallo') {
        assert.ok(
          typeof cuerpo.categoria === 'string' && cuerpo.categoria.length > 0,
          'a failed probe must carry a real failure category',
        );
      }
      // The stored host and port were dialed, not the engine value.
      assert.equal(cuerpo.host, objetivo.host);
      assert.equal(cuerpo.puerto, objetivo.port);
      assert.ok(Number.isInteger(cuerpo.duracionMs) && cuerpo.duracionMs >= 0);
    });
  },
);
