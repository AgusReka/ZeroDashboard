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
import { COPY_NEGOCIO, registerPanelAutomatizacionesRoutes } from './panel-automatizaciones.js';

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
    const plantillaIds: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerPanelAuthRoutes(app, aislado);
      registerPanelAutomatizacionesRoutes(app, aislado, 'UTC');
      await app.ready();

      a = await montarUsuario('A');
      b = await montarUsuario('B');
    });

    after(async () => {
      if (tenantIds.length > 0) {
        await db.ejecucion.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.automatizacion.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.conexion.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.usuario.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.plantilla.deleteMany({ where: { id: { in: plantillaIds } } });
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

    // ---- CH-22b 2.14, 2.15: the automations read, one session per tenant -------------

    const INSTANTE_A = '2026-10-04T08:00:00.000Z';
    const INSTANTE_B = '2026-10-05T09:30:00.000Z';

    /** Tenant `t` runs `slug` actively, with one finished run at `instante`. */
    async function montarAutomatizacion(t: FixtureAislamiento, slug: string, instante: string, estadoEjec?: string) {
      const plantilla = await db.plantilla.create({
        data: {
          nombre: `CH-22b ${t.etiqueta} ${Date.now()}`,
          sql: 'SELECT 1',
          entidades: ['producto'],
          automatizacion: slug,
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      });
      plantillaIds.push(plantilla.id);
      const conexion = await db.conexion.create({
        data: {
          tenantId: t.tenantId,
          nombre: 'Replica',
          motor: 'postgres',
          host: 'localhost',
          puerto: 5432,
          baseDeDatos: 'x',
          usuarioDb: 'x',
          credencial: 'x',
        },
      });
      const automatizacion = await db.automatizacion.create({
        data: { tenantId: t.tenantId, plantillaId: plantilla.id, conexionId: conexion.id, cron: '0 8 * * *' },
      });
      await db.ejecucion.create({
        data: {
          tenantId: t.tenantId,
          automatizacionId: automatizacion.id,
          estado: estadoEjec ?? 'ok',
          iniciadaEn: new Date(instante),
          finalizadaEn: estadoEjec === 'en-curso' ? null : new Date(instante),
        },
      });
    }

    async function automatizacionesDe(token: string, extra: { cabecera?: string; consulta?: string } = {}) {
      return await app.inject({
        method: 'GET',
        url: '/api/panel/automatizaciones' + (extra.consulta === undefined ? '' : `?${extra.consulta}`),
        headers: {
          cookie: `${NOMBRE_COOKIE}=${token}`,
          ...(extra.cabecera === undefined ? {} : { 'x-tenant-id': extra.cabecera }),
        },
      });
    }

    const titulo = (slug: string): string => COPY_NEGOCIO.get(slug)!.titulo;

    test('2.14 two tenants each see only their own automations, and the other one never hides a template', async () => {
      await montarAutomatizacion(a, 'stock-fisico', INSTANTE_A);
      await montarAutomatizacion(b, 'stock-producible', INSTANTE_B);
      const deA = await automatizacionesDe(tokenDe(await ingresar(a)));
      const deB = await automatizacionesDe(tokenDe(await ingresar(b)));
      assert.equal(deA.statusCode, 200, deA.body);
      assert.equal(deB.statusCode, 200, deB.body);
      const cuerpoA = deA.json() as { activas: Array<{ titulo: string; ultimaEjecucion: { fecha: string } }>; disponibles: Array<{ titulo: string }> };
      const cuerpoB = deB.json() as typeof cuerpoA;

      assert.deepEqual(cuerpoA.activas.map((i) => [i.titulo, i.ultimaEjecucion.fecha]), [[titulo('stock-fisico'), INSTANTE_A]]);
      assert.deepEqual(cuerpoA.disponibles.map((i) => i.titulo), [titulo('stock-producible')]);
      assert.deepEqual(cuerpoB.activas.map((i) => [i.titulo, i.ultimaEjecucion.fecha]), [[titulo('stock-producible'), INSTANTE_B]]);
      assert.deepEqual(cuerpoB.disponibles.map((i) => i.titulo), [titulo('stock-fisico')]);

      for (const [cuerpo, ajeno, instanteAjeno] of [[deA.body, b, INSTANTE_B], [deB.body, a, INSTANTE_A]] as const) {
        assert.ok(!cuerpo.includes(ajeno.tenantId), 'no foreign tenant id');
        assert.ok(!cuerpo.includes(instanteAjeno), 'no foreign execution instant');
      }
    });

    test("2.15 a foreign X-Tenant-Id or tenant query parameter changes nothing: the body is byte-for-byte the same", async () => {
      const tokenA = tokenDe(await ingresar(a));
      const tokenB = tokenDe(await ingresar(b));
      for (const [token, propio, ajeno] of [[tokenA, a, b], [tokenB, b, a]] as const) {
        const base = await automatizacionesDe(token);
        const conCabecera = await automatizacionesDe(token, { cabecera: ajeno.tenantId });
        const conConsulta = await automatizacionesDe(token, { consulta: `tenantId=${ajeno.tenantId}&tenant=${ajeno.tenantId}` });
        assert.equal(base.statusCode, 200, base.body);
        assert.equal(conCabecera.body, base.body, 'the header is ignored');
        assert.equal(conConsulta.body, base.body, 'the query parameter is ignored');
        assert.ok(!conCabecera.body.includes(ajeno.tenantId) && !conCabecera.body.includes(propio.tenantId));
      }
    });

    test('2.16 con_falla isolation: only session tenant sees its failed automation', async () => {
      await montarAutomatizacion(a, 'stock-fisico', '2026-10-06T08:00:00.000Z', 'fallo');
      const deA = await automatizacionesDe(tokenDe(await ingresar(a)));
      const deB = await automatizacionesDe(tokenDe(await ingresar(b)));
      assert.equal(deA.statusCode, 200, deA.body);
      assert.equal(deB.statusCode, 200, deB.body);
      const cuerpoA = deA.json() as { activas: Array<{ estado: string }> };
      const cuerpoB = deB.json() as { activas: Array<{ estado: string }> };
      assert.equal(cuerpoA.activas[0]?.estado, 'con_falla');
      assert.deepEqual(cuerpoB.activas, []);
      assert.ok(!deA.body.includes('codigoError'));
      assert.ok(!deA.body.includes('error'));
    });
  },
);
