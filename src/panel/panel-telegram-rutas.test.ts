import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { generarTokenSesion } from '../compartido/crypto-auth.js';
import { hashCodigo } from '../telegram/codigo-vinculo.js';
import { registerPanelTelegramRoutes, type PuertoTelegram } from './panel-telegram.js';

/**
 * CH-43 (DEC-185, DEC-196): `GET /api/panel/telegram`, `POST /api/panel/telegram/codigo` and
 * `DELETE /api/panel/telegram/vinculo` against a live PostgreSQL target, with a fake port
 * for the bot. Same target and variables as `src/panel/panel-ajustes-rutas.test.ts` (see
 * `src/aislamiento/aislamiento.test.ts`).
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
  'bring up the Compose db service and set TEST_DB_* (see src/aislamiento/aislamiento.test.ts)';

/** The fixed clock both apps read and write a code's expiry with. */
const RELOJ = new Date('2026-11-05T12:00:00.000Z');
const BOT = 'zd_prueba_bot';

describe(
  'GET/POST/DELETE /api/panel/telegram — live PostgreSQL target (CH-43)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    const marca = `CH-43 ${Date.now()}`;
    let db!: PrismaClient;
    /** Bot available through a mutable fake port. */
    let app!: FastifyInstance;
    /** No port at all: `TELEGRAM_BOT_TOKEN` unset. */
    let sinToken!: FastifyInstance;
    let botActual: string | null = BOT;
    const puerto: PuertoTelegram = { bot: () => botActual };
    const tenantIds: string[] = [];

    interface Negocio {
      tenantId: string;
      cookie: { cookie: string };
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerPanelTelegramRoutes(app, { prisma: aislado, telegram: puerto, ahora: () => RELOJ });
      await app.ready();
      sinToken = Fastify({ logger: false });
      registrarContextoTenant(sinToken, aislado);
      registerPanelTelegramRoutes(sinToken, { prisma: aislado, telegram: null, ahora: () => RELOJ });
      await sinToken.ready();
    });

    after(async () => {
      if (tenantIds.length > 0) {
        const donde = { tenantId: { in: tenantIds } };
        await db.vinculoTelegram.deleteMany({ where: donde });
        await db.codigoVinculoTelegram.deleteMany({ where: donde });
        await db.usuario.deleteMany({ where: donde });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.$disconnect();
      await app.close();
      await sinToken.close();
    });

    /** One tenant, one user and one live session cookie. */
    async function negocio(etiqueta: string): Promise<Negocio> {
      const tenant = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}`, activo: true } });
      tenantIds.push(tenant.id);
      const usuario = await db.usuario.create({
        data: { tenantId: tenant.id, correo: `${tenant.id}@prueba.test`, claveHash: 'x', activo: true },
      });
      const { tokenPlano, tokenHash } = generarTokenSesion();
      await db.sesionPanel.create({
        data: { tokenHash, usuarioId: usuario.id, tenantId: tenant.id, expiraEn: new Date(Date.now() + 3_600_000) },
      });
      return { tenantId: tenant.id, cookie: { cookie: `zd_panel_session=${tokenPlano}` } };
    }

    async function leer(n: Negocio, en: FastifyInstance = app) {
      return await en.inject({ method: 'GET', url: '/api/panel/telegram', headers: n.cookie });
    }

    async function crear(n: Negocio, en: FastifyInstance = app) {
      return await en.inject({ method: 'POST', url: '/api/panel/telegram/codigo', headers: n.cookie });
    }

    async function desvincular(n: Negocio) {
      return await app.inject({ method: 'DELETE', url: '/api/panel/telegram/vinculo', headers: n.cookie });
    }

    async function codigoGuardado(n: Negocio, venceEn: Date) {
      await db.codigoVinculoTelegram.create({
        data: { tenantId: n.tenantId, codigoHash: hashCodigo(`${n.tenantId}-${venceEn.getTime()}`), venceEn },
      });
    }

    // ---- the four states ---------------------------------------------------------------

    test('no-disponible when the token is unset or the bot is not known yet', async () => {
      const n = await negocio('sin-bot');
      assert.deepEqual((await leer(n, sinToken)).json(), { estado: 'no-disponible' });
      botActual = null;
      try {
        assert.deepEqual((await leer(n)).json(), { estado: 'no-disponible' });
      } finally {
        botActual = BOT;
      }
    });

    test('sin-vincular with no link and no code, and with only an expired code', async () => {
      const n = await negocio('sin-vincular');
      assert.deepEqual((await leer(n)).json(), { estado: 'sin-vincular', bot: BOT });
      await codigoGuardado(n, new Date(RELOJ.getTime() - 1));
      const respuesta = await leer(n);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { estado: 'sin-vincular', bot: BOT });
      // Ignored, not deleted.
      assert.equal(await db.codigoVinculoTelegram.count({ where: { tenantId: n.tenantId } }), 1);
    });

    test('codigo-pendiente with no link and a live code', async () => {
      const n = await negocio('pendiente');
      const venceEn = new Date(RELOJ.getTime() + 60_000);
      await codigoGuardado(n, venceEn);
      assert.deepEqual((await leer(n)).json(), { estado: 'codigo-pendiente', bot: BOT, venceEn: venceEn.toISOString() });
    });

    test('vinculado with the date and no chat id; venceEn only while a replacement code is live', async () => {
      const n = await negocio('vinculado');
      const vinculadoEn = new Date('2026-11-05T10:00:00.000Z');
      await db.vinculoTelegram.create({ data: { tenantId: n.tenantId, chatId: -1001234567890123n, vinculadoEn } });
      const respuesta = await leer(n);
      assert.deepEqual(respuesta.json(), { estado: 'vinculado', bot: BOT, vinculadoEn: vinculadoEn.toISOString() });
      for (const texto of ['1001234567890123', 'chatId', 'tenantId', n.tenantId, 'codigoHash']) {
        assert.ok(!respuesta.body.includes(texto), texto);
      }
      const venceEn = new Date(RELOJ.getTime() + 60_000);
      await codigoGuardado(n, venceEn);
      assert.deepEqual((await leer(n)).json(), {
        estado: 'vinculado',
        bot: BOT,
        vinculadoEn: vinculadoEn.toISOString(),
        venceEn: venceEn.toISOString(),
      });
      const fila = await db.vinculoTelegram.findUniqueOrThrow({ where: { tenantId: n.tenantId } });
      assert.equal(fila.chatId, -1001234567890123n);
    });

    // ---- create ------------------------------------------------------------------------

    test('POST returns the code once, stores only its hash, and replaces a previous code', async () => {
      const n = await negocio('crea');
      const primero = await crear(n);
      assert.equal(primero.statusCode, 201, primero.body);
      const cuerpo = primero.json() as { codigo: string; enlace: string; venceEn: string; bot: string };
      // P-05 (UX review): the bot's public name rides along, so the card can say which bot to send the code to.
      assert.deepEqual(Object.keys(cuerpo).sort(), ['bot', 'codigo', 'enlace', 'venceEn']);
      assert.equal(cuerpo.bot, BOT);
      assert.match(cuerpo.codigo, /^[0-9A-HJKMNP-TV-Z]{8}$/);
      assert.equal(cuerpo.enlace, `https://t.me/${BOT}?start=${cuerpo.codigo}`);
      assert.equal(cuerpo.venceEn, new Date(RELOJ.getTime() + 600_000).toISOString());
      const fila = await db.codigoVinculoTelegram.findUniqueOrThrow({ where: { tenantId: n.tenantId } });
      assert.equal(fila.codigoHash, hashCodigo(cuerpo.codigo));
      assert.ok(!JSON.stringify(fila).includes(cuerpo.codigo));

      // The plain code is not readable again.
      const leido = await leer(n);
      assert.deepEqual(leido.json(), { estado: 'codigo-pendiente', bot: BOT, venceEn: cuerpo.venceEn });
      assert.ok(!leido.body.includes(cuerpo.codigo));

      const segundo = (await crear(n)).json() as { codigo: string };
      const filas = await db.codigoVinculoTelegram.findMany({ where: { tenantId: n.tenantId } });
      assert.equal(filas.length, 1);
      assert.equal(filas[0]?.codigoHash, hashCodigo(segundo.codigo));
      assert.equal(await db.codigoVinculoTelegram.count({ where: { codigoHash: hashCodigo(cuerpo.codigo) } }), 0);
    });

    test('POST answers 409 telegram-no-disponible and stores nothing when the bot is not available', async () => {
      const n = await negocio('no-disponible');
      const sinPuerto = await crear(n, sinToken);
      assert.equal(sinPuerto.statusCode, 409, sinPuerto.body);
      assert.deepEqual(sinPuerto.json(), { error: 'telegram-no-disponible' });
      botActual = null;
      try {
        assert.equal((await crear(n)).statusCode, 409);
      } finally {
        botActual = BOT;
      }
      assert.equal(await db.codigoVinculoTelegram.count({ where: { tenantId: n.tenantId } }), 0);
    });

    // ---- unlink ------------------------------------------------------------------------

    test('DELETE removes the link, keeps a live code, and is idempotent', async () => {
      const n = await negocio('desvincula');
      await db.vinculoTelegram.create({ data: { tenantId: n.tenantId, chatId: 42n } });
      const venceEn = new Date(RELOJ.getTime() + 60_000);
      await codigoGuardado(n, venceEn);
      const primero = await desvincular(n);
      assert.equal(primero.statusCode, 204, primero.body);
      assert.equal(primero.body, '');
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: n.tenantId } }), 0);
      assert.equal(await db.codigoVinculoTelegram.count({ where: { tenantId: n.tenantId } }), 1);
      assert.equal((await desvincular(n)).statusCode, 204);
    });

    // ---- session and strict input ------------------------------------------------------

    test('401 sesion-invalida with no cookie, and nothing is written', async () => {
      const n = await negocio('sin-cookie');
      await db.vinculoTelegram.create({ data: { tenantId: n.tenantId, chatId: 42n } });
      for (const [method, url] of [
        ['GET', '/api/panel/telegram'],
        ['POST', '/api/panel/telegram/codigo'],
        ['DELETE', '/api/panel/telegram/vinculo'],
      ] as const) {
        const respuesta = await app.inject({ method, url });
        assert.equal(respuesta.statusCode, 401, `${method} ${url}`);
        assert.equal((respuesta.json() as { error: string }).error, 'sesion-invalida');
      }
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: n.tenantId } }), 1);
      assert.equal(await db.codigoVinculoTelegram.count({ where: { tenantId: n.tenantId } }), 0);
    });

    test('a body or query key is 400 solicitud-invalida, and nothing is written', async () => {
      const n = await negocio('estricto');
      await db.vinculoTelegram.create({ data: { tenantId: n.tenantId, chatId: 42n } });
      const ajeno = await negocio('ajeno');
      for (const [method, url] of [
        ['POST', '/api/panel/telegram/codigo'],
        ['DELETE', '/api/panel/telegram/vinculo'],
      ] as const) {
        const conCuerpo = await app.inject({ method, url, headers: n.cookie, payload: { tenantId: ajeno.tenantId } });
        assert.equal(conCuerpo.statusCode, 400, `${method} ${url} ${conCuerpo.body}`);
        assert.deepEqual(conCuerpo.json(), { error: 'solicitud-invalida', campos: ['tenantId'] });
        const conLista = await app.inject({ method, url, headers: n.cookie, payload: [1] });
        assert.equal(conLista.statusCode, 400, `${method} ${url} ${conLista.body}`);
      }
      for (const [method, url] of [
        ['GET', '/api/panel/telegram'],
        ['POST', '/api/panel/telegram/codigo'],
        ['DELETE', '/api/panel/telegram/vinculo'],
      ] as const) {
        const conConsulta = await app.inject({ method, url: `${url}?tenantId=${ajeno.tenantId}`, headers: n.cookie });
        assert.equal(conConsulta.statusCode, 400, `${method} ${url} ${conConsulta.body}`);
      }
      // An empty object body is no key at all.
      assert.equal(
        (await app.inject({ method: 'POST', url: '/api/panel/telegram/codigo', headers: n.cookie, payload: {} })).statusCode,
        201,
      );
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: n.tenantId } }), 1);
      assert.equal(await db.codigoVinculoTelegram.count({ where: { tenantId: ajeno.tenantId } }), 0);
    });
  },
);
