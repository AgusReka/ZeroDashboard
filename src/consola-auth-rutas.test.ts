import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { hashearClave } from './crypto-auth.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registerPanelAuthRoutes } from './panel-auth.js';
import {
  NOMBRE_COOKIE_CONSOLA,
  registerConsolaAuthRoutes,
  registrarGuardOperador,
} from './consola-auth.js';
import {
  alcanzable,
  borrarOperadores,
  crearOperador,
  crearSesion,
  databaseUrl,
  motivoSkip,
  nombreUnico,
} from './consola-auth-apoyo.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

const CLAVE = 'clave-de-operador-larga';
const CLAVE_PANEL = 'clave-segura-de-prueba-1';

/** The SHA-256 hex oracle: what the database must hold for a given cookie value. */
function sha256(texto: string): string {
  return createHash('sha256').update(texto).digest('hex');
}

/** The cookie value out of a `Set-Cookie` header, or null when there is none. */
function valorCookie(setCookie: string | string[] | undefined, nombre: string): string | null {
  const lista = setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const linea of lista) {
    if (linea.startsWith(`${nombre}=`)) {
      return linea.slice(nombre.length + 1).split(';')[0];
    }
  }
  return null;
}

describe(
  'CH-29 console login, logout and operator guard — live PostgreSQL target (DEC-151, DEC-152)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    let db!: PrismaClient;
    let prisma!: PrismaAislado;
    const nombre = nombreUnico('op-rutas');
    let operadorId = '';
    let tenantId = '';
    let correoPanel = '';

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      prisma = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      // The production order (design §4): guard, then the tenant hooks, then the routes.
      registrarGuardOperador(app, prisma);
      registrarContextoTenant(app, prisma);
      registerConsolaAuthRoutes(app, prisma);
      registerConsultaGuardadaRoutes(app, prisma);
      registerPanelAuthRoutes(app, prisma);
      // A test-only console route that echoes what the guard attached to the request.
      app.get('/prueba-operador', async (request) => ({ operador: request.operador ?? null }));
      await app.ready();

      operadorId = (await crearOperador(prisma, nombre, CLAVE)).id;
      const tenant = await db.tenant.create({ data: { nombre: `CH-29 rutas ${Date.now()}` } });
      tenantId = tenant.id;
      correoPanel = `ch29-${Date.now()}@prueba.test`;
      await db.usuario.create({
        data: { tenantId, correo: correoPanel, claveHash: await hashearClave(CLAVE_PANEL) },
      });
    });

    after(async () => {
      await borrarOperadores(prisma, [nombre]);
      await db.usuario.deleteMany({ where: { tenantId } });
      await db.tenant.deleteMany({ where: { id: tenantId } });
      await db.$disconnect();
      await app.close();
    });

    async function ingresar(cuerpo: unknown) {
      return app.inject({ method: 'POST', url: '/consola/ingresar', payload: cuerpo as object });
    }

    async function cookieValida(): Promise<string> {
      const respuesta = await ingresar({ nombre, clave: CLAVE });
      const valor = valorCookie(respuesta.headers['set-cookie'], NOMBRE_COOKIE_CONSOLA);
      assert.ok(valor, 'the login must set the console cookie');
      return `${NOMBRE_COOKIE_CONSOLA}=${valor}`;
    }

    async function sesionesDelOperador(): Promise<number> {
      return db.sesionConsola.count({ where: { operadorId } });
    }

    test('a successful login answers the operator, sets the cookie and stores only its hash', async () => {
      const antes = await sesionesDelOperador();
      const respuesta = await ingresar({ nombre, clave: CLAVE });
      assert.equal(respuesta.statusCode, 200);
      assert.deepEqual(respuesta.json(), { operador: { id: operadorId, nombre } });
      const setCookie = String(respuesta.headers['set-cookie']);
      for (const atributo of ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Secure', 'Max-Age=43200']) {
        assert.ok(setCookie.split('; ').includes(atributo), `missing ${atributo}`);
      }
      const valor = valorCookie(respuesta.headers['set-cookie'], NOMBRE_COOKIE_CONSOLA)!;
      const fila = await db.sesionConsola.findUnique({ where: { tokenHash: sha256(valor) } });
      assert.ok(fila, 'the row is found by the SHA-256 of the cookie value');
      assert.notEqual(fila.tokenHash, valor);
      assert.equal(fila.operadorId, operadorId);
      const vida = fila.expiraEn.getTime() - fila.creadaEn.getTime();
      assert.ok(Math.abs(vida - 12 * 60 * 60 * 1000) < 5000, `lifetime ${vida} ms`);
      assert.equal(await sesionesDelOperador(), antes + 1);
    });

    test('an unknown name and a wrong password look the same and create nothing', async () => {
      const antes = await sesionesDelOperador();
      for (const cuerpo of [{ nombre: nombreUnico('nadie'), clave: CLAVE }, { nombre, clave: 'otra-clave-larga' }]) {
        const respuesta = await ingresar(cuerpo);
        assert.equal(respuesta.statusCode, 401);
        assert.deepEqual(respuesta.json(), { error: 'nombre-o-clave-incorrectos' });
        assert.equal(respuesta.headers['set-cookie'], undefined);
      }
      assert.equal(await sesionesDelOperador(), antes);
    });

    test('the login body is strict: a tenantId or a missing clave is a 400', async () => {
      const antes = await sesionesDelOperador();
      for (const cuerpo of [{ nombre, clave: CLAVE, tenantId }, { nombre }, { nombre: '', clave: CLAVE }]) {
        const respuesta = await ingresar(cuerpo);
        assert.equal(respuesta.statusCode, 400, JSON.stringify(cuerpo));
        assert.equal(respuesta.json().error, 'solicitud-invalida');
        assert.ok(Array.isArray(respuesta.json().campos));
      }
      assert.equal(await sesionesDelOperador(), antes);
    });

    test('without a cookie a console route is 401 before the tenant check, with or without the header', async () => {
      for (const headers of [{ 'x-tenant-id': tenantId }, {}]) {
        const respuesta = await app.inject({ method: 'GET', url: '/consultas-guardadas', headers });
        assert.equal(respuesta.statusCode, 401);
        assert.deepEqual(respuesta.json(), { error: 'sesion-invalida' });
      }
    });

    test('with a session the tenant check still applies: 200 with the header, 400 without it', async () => {
      const cookie = await cookieValida();
      const conHeader = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { cookie, 'x-tenant-id': tenantId },
      });
      assert.equal(conHeader.statusCode, 200);
      const sinHeader = await app.inject({ method: 'GET', url: '/consultas-guardadas', headers: { cookie } });
      assert.equal(sinHeader.statusCode, 400);
      assert.deepEqual(sinHeader.json(), { error: 'tenant-no-indicado' });
    });

    test('a valid session attaches the operator to the request', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/prueba-operador',
        headers: { cookie: await cookieValida(), 'x-tenant-id': tenantId },
      });
      assert.equal(respuesta.statusCode, 200);
      assert.deepEqual(respuesta.json(), { operador: { id: operadorId, nombre } });
    });

    test('an unknown token and an unmatched URL are 401', async () => {
      const desconocido = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { cookie: `${NOMBRE_COOKIE_CONSOLA}=no-existe`, 'x-tenant-id': tenantId },
      });
      assert.deepEqual([desconocido.statusCode, desconocido.json()], [401, { error: 'sesion-invalida' }]);
      const sinRuta = await app.inject({ method: 'GET', url: '/no-existe' });
      assert.equal(sinRuta.statusCode, 401);
    });

    test('an expired session is 401 sesion-expirada and its row is gone, at the exact boundary too', async () => {
      const { sesion, tokenPlano } = await crearSesion(prisma, operadorId, new Date());
      const respuesta = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { cookie: `${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}`, 'x-tenant-id': tenantId },
      });
      assert.deepEqual([respuesta.statusCode, respuesta.json()], [401, { error: 'sesion-expirada' }]);
      assert.equal(await db.sesionConsola.findUnique({ where: { id: sesion.id } }), null);
    });

    test('logout deletes the session, clears the cookie, and the same token is refused afterwards', async () => {
      const cookie = await cookieValida();
      const salir = await app.inject({ method: 'POST', url: '/consola/salir', headers: { cookie } });
      assert.equal(salir.statusCode, 200);
      assert.deepEqual(salir.json(), { ok: true });
      assert.ok(String(salir.headers['set-cookie']).startsWith(`${NOMBRE_COOKIE_CONSOLA}=; `));
      assert.ok(String(salir.headers['set-cookie']).split('; ').includes('Max-Age=0'));
      const token = cookie.slice(NOMBRE_COOKIE_CONSOLA.length + 1);
      assert.equal(await db.sesionConsola.findUnique({ where: { tokenHash: sha256(token) } }), null);
      const despues = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { cookie, 'x-tenant-id': tenantId },
      });
      assert.equal(despues.statusCode, 401);
    });

    test('logout itself needs a session', async () => {
      const respuesta = await app.inject({ method: 'POST', url: '/consola/salir' });
      assert.deepEqual([respuesta.statusCode, respuesta.json()], [401, { error: 'sesion-invalida' }]);
    });

    test('a panel cookie is not a console session, and a console cookie is not a panel session', async () => {
      const ingresoPanel = await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: correoPanel, clave: CLAVE_PANEL },
      });
      assert.equal(ingresoPanel.statusCode, 200, 'the panel login is exempt from the operator guard');
      const valorPanel = valorCookie(ingresoPanel.headers['set-cookie'], 'zd_panel_session')!;
      const consolaConPanel = await app.inject({
        method: 'GET',
        url: '/consultas-guardadas',
        headers: { cookie: `zd_panel_session=${valorPanel}`, 'x-tenant-id': tenantId },
      });
      assert.equal(consolaConPanel.statusCode, 401);

      const panelConConsola = await app.inject({
        method: 'GET',
        url: '/api/panel/auth/sesion',
        headers: { cookie: await cookieValida() },
      });
      assert.deepEqual([panelConConsola.statusCode, panelConConsola.json()], [401, { error: 'sesion-invalida' }]);
    });
  },
);
