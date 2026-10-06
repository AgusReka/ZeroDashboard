import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { generarTokenSesion, hashearClave } from './crypto-auth.js';
import { registerPanelAuthRoutes } from './panel-auth.js';

/**
 * CH-22a tasks 2.1 and 2.3 (DEC-133, DEC-134, DEC-135): the panel authentication
 * surface — login, logout, session state — exercised through the real route module
 * and the real tenant-context hooks, exactly as `src/server.ts` wires them.
 *
 * The target is the project's own Compose `db` service, like `src/aislamiento.test.ts`
 * (see that file's header for the variables). Each fixture is one `Tenant` and one
 * `Usuario` with a scrypt hash built by the PR1 module, so a case can pick how many of
 * the two rows are active.
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
// Same fixture key `src/aislamiento.test.ts` supplies for suites that boot the app.
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** The password every fixture user shares; never stored, only submitted at login. */
const CLAVE = 'clave-segura-de-prueba-1';
/** The one cookie the design names (DEC-134). */
const NOMBRE_COOKIE = 'zd_panel_session';

interface FixturePanel {
  etiqueta: string;
  tenantId: string;
  tenantNombre: string;
  tenantActivo: boolean;
  usuarioId: string;
  correo: string;
  nombre: string;
  usuarioActivo: boolean;
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
  'panel auth routes — integration against a live PostgreSQL target (CH-22a PR2)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** Raw client: fixtures, cleanup, and every assertion the API cannot express. */
    let db!: PrismaClient;
    /** Both rows active: the happy-path fixture. */
    let a!: FixturePanel;
    /** User deactivated (spec: deactivated user rejected). */
    let usuarioInactivo!: FixturePanel;
    /** Tenant deactivated (spec: deactivated tenant rejected). */
    let tenantInactivo!: FixturePanel;
    const tenantIds: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerPanelAuthRoutes(app, aislado);
      await app.ready();

      a = await montarUsuario('A', { tenantActivo: true, usuarioActivo: true });
      usuarioInactivo = await montarUsuario('INACTIVO', { tenantActivo: true, usuarioActivo: false });
      tenantInactivo = await montarUsuario('MUERTO', { tenantActivo: false, usuarioActivo: true });
    });

    after(async () => {
      if (tenantIds.length > 0) {
        // `SesionPanel.usuario` cascades, so deleting the users removes every session;
        // the tenant FK on `Usuario` is RESTRICT, which is why users go first.
        await db.usuario.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.$disconnect();
      await app.close();
    });

    async function montarUsuario(
      etiqueta: string,
      estado: { tenantActivo: boolean; usuarioActivo: boolean },
    ): Promise<FixturePanel> {
      const tenant = await db.tenant.create({
        data: {
          nombre: `CH-22a panel ${etiqueta} ${Date.now()}`,
          activo: estado.tenantActivo,
        },
      });
      tenantIds.push(tenant.id);
      const claveHash = await hashearClave(CLAVE);
      const correo = `panel-${etiqueta.toLowerCase()}-${Date.now()}@prueba.test`;
      const usuario = await db.usuario.create({
        data: {
          tenantId: tenant.id,
          correo,
          claveHash,
          nombre: `Panelista ${etiqueta}`,
          activo: estado.usuarioActivo,
        },
      });
      return {
        etiqueta,
        tenantId: tenant.id,
        tenantNombre: tenant.nombre,
        tenantActivo: estado.tenantActivo,
        usuarioId: usuario.id,
        correo,
        // `Usuario.nombre` is nullable in the schema, but this fixture just wrote one.
        nombre: usuario.nombre!,
        usuarioActivo: estado.usuarioActivo,
      };
    }

    /** The SHA-256 hex oracle: asserts what the database stores, independently. */
    function hashDelToken(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    }

    /** Submits one valid login for a fixture user. */
    async function ingresar(usuario: FixturePanel) {
      return await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: usuario.correo, clave: CLAVE },
      });
    }

    /** Extracts the raw session token from a login response's `Set-Cookie`. */
    function tokenDe(respuesta: { headers: Record<string, unknown> }): string {
      const cruda = String(respuesta.headers['set-cookie'] ?? '');
      const token = /zd_panel_session=([^;]+)/.exec(cruda)?.[1];
      assert.ok(token !== undefined, `se esperaba la cookie en set-cookie: ${cruda}`);
      return token;
    }

    function conCookie(token: string): Record<string, string> {
      return { cookie: `${NOMBRE_COOKIE}=${token}` };
    }

    test('ingresar with valid credentials answers 200 with the user and tenant, and sets the HttpOnly cookie', async (t) => {
      const respuesta = await ingresar(a);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as {
        usuario: { id: string; correo: string; nombre: string };
        tenant: { id: string; nombre: string };
      };
      assert.deepEqual(cuerpo.usuario, { id: a.usuarioId, correo: a.correo, nombre: a.nombre });
      assert.deepEqual(cuerpo.tenant, { id: a.tenantId, nombre: a.tenantNombre });

      const cruda = String(respuesta.headers['set-cookie'] ?? '');
      assert.match(cruda, /^zd_panel_session=[^;]+;/, 'the session token opens the cookie');
      assert.match(cruda, /HttpOnly/, 'DEC-134: scripts must not read it');
      assert.match(cruda, /Path=\//, 'sent on every path of the surface');
      assert.match(cruda, /SameSite=Lax/, 'DEC-134');
      assert.match(cruda, /Max-Age=2592000/, 'the 30-day TTL the design fixes');
      assert.match(cruda, /Secure/, 'DEC-134');

      // The cookie's token is what the database holds a SHA-256 hash of, never the raw
      // token (DEC-134): the row must exist and must not contain the token itself.
      const fila = await db.sesionPanel.findUnique({
        where: { tokenHash: hashDelToken(tokenDe(respuesta)) },
      });
      assert.ok(fila !== null, 'a SesionPanel row was created');
      assert.equal(fila.usuarioId, a.usuarioId);
      assert.equal(fila.tenantId, a.tenantId);
      assert.ok(fila.expiraEn.getTime() > Date.now(), 'expiration lies in the future');
      assert.ok(!fila.tokenHash.includes(tokenDe(respuesta)), 'only the hash is stored');
    });

    test('ingresar with a wrong password answers 401 with the generic error and sets no cookie', async (t) => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: a.correo, clave: 'clave-equivocada' },
      });
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'correo-o-clave-incorrectos' });
      assert.equal(respuesta.headers['set-cookie'], undefined, 'no session cookie');
    });

    test("ingresar with an unknown email answers 401 with the same generic error — no account oracle", async (t) => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: 'nadie@prueba.test', clave: CLAVE },
      });
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'correo-o-clave-incorrectos' });
      assert.equal(respuesta.headers['set-cookie'], undefined);
    });

    test('ingresar of a deactivated user answers 401 and creates no session', async (t) => {
      const respuesta = await ingresar(usuarioInactivo);
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'correo-o-clave-incorrectos' });
      assert.equal(respuesta.headers['set-cookie'], undefined);
    });

    test('ingresar of a user of a deactivated tenant answers 409 tenant-desactivado and creates no session', async (t) => {
      const respuesta = await ingresar(tenantInactivo);
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-desactivado' });
      assert.equal(respuesta.headers['set-cookie'], undefined);
    });

    test('ingresar with an extra body property answers 400 solicitud-invalida, naming the field', async (t) => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: a.correo, clave: CLAVE, tenantId: a.tenantId },
      });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      const cuerpo = respuesta.json() as { error: string; campos: string[] };
      assert.equal(cuerpo.error, 'solicitud-invalida');
      assert.ok(cuerpo.campos.includes('/tenantId'), JSON.stringify(cuerpo.campos));
    });

    test('logout revokes the SesionPanel row, clears the cookie, and the token stops working', async (t) => {
      const token = tokenDe(await ingresar(a));
      const fila = await db.sesionPanel.findUnique({ where: { tokenHash: hashDelToken(token) } });
      assert.ok(fila !== null, 'the login above left a session');

      const salida = await app.inject({
        method: 'POST',
        url: '/api/panel/auth/salir',
        headers: conCookie(token),
      });
      assert.equal(salida.statusCode, 200, salida.body);
      assert.equal(
        await db.sesionPanel.findUnique({ where: { id: fila.id } }),
        null,
        'the session row is deleted, not just marked',
      );
      const cruda = String(salida.headers['set-cookie'] ?? '');
      assert.match(cruda, /zd_panel_session=;/, 'the cookie is emptied');
      assert.match(cruda, /Max-Age=0/, 'and expired immediately');

      const despues = await app.inject({
        method: 'GET',
        url: '/api/panel/auth/sesion',
        headers: conCookie(token),
      });
      assert.equal(despues.statusCode, 401, despues.body);
    });

    test('GET /api/panel/auth/sesion with an active cookie answers 200 with the user and its tenant', async (t) => {
      const token = tokenDe(await ingresar(a));
      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/panel/auth/sesion',
        headers: conCookie(token),
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as {
        usuario: { id: string; correo: string; nombre: string };
        tenant: { id: string; nombre: string };
      };
      assert.deepEqual(cuerpo, {
        usuario: { id: a.usuarioId, correo: a.correo, nombre: a.nombre },
        tenant: { id: a.tenantId, nombre: a.tenantNombre },
      });
    });

    test('GET /api/panel/auth/sesion without a cookie answers 401', async (t) => {
      const respuesta = await app.inject({ method: 'GET', url: '/api/panel/auth/sesion' });
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'sesion-invalida' });
    });

    test('an expired token answers 401 and the expired row is cleaned up', async (t) => {
      const { tokenPlano, tokenHash } = generarTokenSesion();
      await db.sesionPanel.create({
        data: {
          tokenHash,
          usuarioId: a.usuarioId,
          tenantId: a.tenantId,
          expiraEn: new Date(Date.now() - 60_000),
        },
      });
      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/panel/auth/sesion',
        headers: conCookie(tokenPlano),
      });
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'sesion-expirada' });
      assert.equal(
        await db.sesionPanel.findUnique({ where: { tokenHash } }),
        null,
        'the expired row was cleaned up on use',
      );
    });

    /** The repo's canonical Prisma error-code matcher (see `src/aislamiento.test.ts`). */
    const conCodigo = (codigo: string) => (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === codigo;

    // domain-data-model spec, scenario "Unique email constraint": GIVEN an existing
    // Usuario with email X, WHEN another Usuario is created with the same email, THEN
    // the database SHALL reject the duplicate. `a` above is the existing row; the
    // duplicate would live in the same tenant, so the global `@unique` index on
    // Usuario.correo (`prisma/schema.prisma`) is the only thing that can refuse it.
    test('the database rejects a second Usuario with the same correo (P2002, unique email)', async (t) => {
      const claveHash = await hashearClave(CLAVE);
      await assert.rejects(
        () =>
          db.usuario.create({
            data: {
              tenantId: a.tenantId,
              correo: a.correo,
              claveHash,
              nombre: 'Duplicado',
              activo: true,
            },
          }),
        conCodigo('P2002'),
      );
      // The duplicate never landed: exactly one row carries that email.
      assert.equal(await db.usuario.count({ where: { correo: a.correo } }), 1);
    });
  },
);