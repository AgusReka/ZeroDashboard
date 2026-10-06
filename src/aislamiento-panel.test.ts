import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { conTenantActivo, registrarContextoTenant } from './contexto-tenant.js';
import { hashearClave } from './crypto-auth.js';
import { registerPanelAuthRoutes } from './panel-auth.js';

/**
 * CH-22a task 2.2 (DEC-135, T2): the two-tenant panel isolation proof. User A logs in
 * and every panel answer must come from Tenant A — including when the request carries
 * `X-Tenant-Id: <tenant-b>`, which the panel surface ignores by construction (the
 * routes are exempt from the header hooks and the tenant enters through the session).
 *
 * The same target and fixture key as `src/aislamiento.test.ts`: the Compose `db`
 * service (see that file's header for the TEST_DB_* variables).
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

const CLAVE = 'clave-segura-de-prueba-1';
const NOMBRE_COOKIE = 'zd_panel_session';

interface FixtureAislamiento {
  etiqueta: string;
  tenantId: string;
  tenantNombre: string;
  usuarioId: string;
  correo: string;
  nombre: string;
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

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  "bring up the Compose db service and set TEST_DB_* (see this file's header)";

describe(
  'panel two-tenant isolation — T2 over the session-locked tenant (CH-22a PR2)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** Raw client: fixtures and cleanup. */
    let db!: PrismaClient;
    let a!: FixtureAislamiento;
    let b!: FixtureAislamiento;
    const tenantIds: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerPanelAuthRoutes(app, aislado);
      await app.ready();

      a = await montarUsuario('A');
      b = await montarUsuario('B');
    });

    after(async () => {
      if (tenantIds.length > 0) {
        await db.usuario.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.$disconnect();
      await app.close();
    });

    async function montarUsuario(etiqueta: string): Promise<FixtureAislamiento> {
      const tenant = await db.tenant.create({
        data: { nombre: `CH-22a aislamiento ${etiqueta} ${Date.now()}`, activo: true },
      });
      tenantIds.push(tenant.id);
      const claveHash = await hashearClave(CLAVE);
      const correo = `aislado-${etiqueta.toLowerCase()}-${Date.now()}@prueba.test`;
      const usuario = await db.usuario.create({
        data: {
          tenantId: tenant.id,
          correo,
          claveHash,
          nombre: `Aislado ${etiqueta}`,
          activo: true,
        },
      });
      return {
        etiqueta,
        tenantId: tenant.id,
        tenantNombre: tenant.nombre,
        usuarioId: usuario.id,
        correo,
        // `Usuario.nombre` is nullable in the schema, but this fixture just wrote one.
        nombre: usuario.nombre!,
      };
    }

    function hashDelToken(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    }

    async function ingresar(usuario: FixtureAislamiento) {
      return await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: usuario.correo, clave: CLAVE },
      });
    }

    function tokenDe(respuesta: { headers: Record<string, unknown> }): string {
      const cruda = String(respuesta.headers['set-cookie'] ?? '');
      const token = /zd_panel_session=([^;]+)/.exec(cruda)?.[1];
      assert.ok(token !== undefined, `se esperaba la cookie en set-cookie: ${cruda}`);
      return token;
    }

    /** The active-session answer: `{ usuario, tenant }`, or the raw body on failure. */
    async function sesionDe(token: string, tenantCabecera: string | undefined) {
      const headers = tenantCabecera === undefined
        ? { cookie: `${NOMBRE_COOKIE}=${token}` }
        : { cookie: `${NOMBRE_COOKIE}=${token}`, 'x-tenant-id': tenantCabecera };
      return await app.inject({ method: 'GET', url: '/api/panel/auth/sesion', headers });
    }

    test("User A's session answers Tenant A even when X-Tenant-Id names Tenant B — the header is ignored", async () => {
      const tokenA = tokenDe(await ingresar(a));
      const respuesta = await sesionDe(tokenA, b.tenantId);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { usuario: { correo: string }; tenant: { id: string; nombre: string } };
      assert.equal(cuerpo.tenant.id, a.tenantId, 'the tenant comes from the session, not the header');
      assert.equal(cuerpo.tenant.nombre, a.tenantNombre);
      assert.equal(cuerpo.usuario.correo, a.correo, 'no row of Tenant B leaks into the answer');
    });

    test("User B's cookie answers Tenant B, never A: a cross-tenant token cannot enter Tenant A", async () => {
      const tokenB = tokenDe(await ingresar(b));
      const respuesta = await sesionDe(tokenB, a.tenantId);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const cuerpo = respuesta.json() as { usuario: { correo: string }; tenant: { id: string } };
      assert.equal(cuerpo.tenant.id, b.tenantId, 'the token is bound to the tenant that minted it');
      assert.notEqual(cuerpo.tenant.id, a.tenantId);
      assert.equal(cuerpo.usuario.correo, b.correo);
    });

    test('each session token hash resolves to the tenant that minted it', async () => {
      const aislado = extenderConAislamiento(db);
      const tokenA = tokenDe(await ingresar(a));
      const tokenB = tokenDe(await ingresar(b));
      const sesionA = await aislado.sesionPanel.buscarPorTokenHash(hashDelToken(tokenA));
      const sesionB = await aislado.sesionPanel.buscarPorTokenHash(hashDelToken(tokenB));
      assert.equal(sesionA?.tenantId, a.tenantId);
      assert.equal(sesionB?.tenantId, b.tenantId);
    });

    test("scoped reads inside A's session tenant see only A's rows — Tenant B's rows are unreachable", async () => {
      const aislado = extenderConAislamiento(db);
      const tokenA = tokenDe(await ingresar(a));
      const sesionA = await aislado.sesionPanel.buscarPorTokenHash(hashDelToken(tokenA));
      assert.equal(sesionA?.tenantId, a.tenantId);

      // The exact mechanism the panel handlers run under (DEC-135): the session's
      // tenantId enters the AsyncLocalStorage context, and the extension's closed
      // filter keeps every scoped read inside it (DEC-13).
      const filas = await conTenantActivo({ id: a.tenantId, nombre: a.tenantNombre }, async () => {
        return await aislado.usuario.findMany({ select: { id: true, correo: true }, orderBy: { correo: 'asc' } });
      });
      assert.deepEqual(
        filas.map((f) => f.correo),
        [a.correo],
        'the scoped read returns exactly A\'s own user, never B\'s',
      );
    });

    test("B's logout deletes only B's session row; A's session keeps working", async () => {
      const tokenA = tokenDe(await ingresar(a));
      const tokenB = tokenDe(await ingresar(b));

      const salida = await app.inject({
        method: 'POST',
        url: '/api/panel/auth/salir',
        headers: { cookie: `${NOMBRE_COOKIE}=${tokenB}` },
      });
      assert.equal(salida.statusCode, 200, salida.body);
      assert.equal(
        await db.sesionPanel.findUnique({ where: { tokenHash: hashDelToken(tokenB) } }),
        null,
        "B's row is gone",
      );
      assert.ok(
        await db.sesionPanel.findUnique({ where: { tokenHash: hashDelToken(tokenA) } }),
        "A's row was not touched by B's logout",
      );
      const deA = await sesionDe(tokenA, undefined);
      assert.equal(deA.statusCode, 200, deA.body);
      const cuerpo = deA.json() as { tenant: { id: string } };
      assert.equal(cuerpo.tenant.id, a.tenantId);
    });
  },
);