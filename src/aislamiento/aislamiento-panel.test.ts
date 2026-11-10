import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import net from 'node:net';
import { Writable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { conTenantActivo, registrarContextoTenant } from './contexto-tenant.js';
import { hashearClave } from '../compartido/crypto-auth.js';
import { registerPanelAuthRoutes } from '../panel/panel-auth.js';
import { registerPanelAutomatizacionesRoutes } from '../panel/panel-automatizaciones.js';
import { registerPanelTelegramRoutes } from '../panel/panel-telegram.js';
import { generarTokenSesion } from '../compartido/crypto-auth.js';
import { cifrarCredencial } from '../compartido/cripto-credencial.js';
import { SIN_AGENTES } from '../agente/canal-agente.js';
import { registerPanelTableroRoutes } from '../panel/panel-tablero-rutas.js';

/**
 * CH-22a task 2.2 (DEC-135, T2): the two-tenant panel isolation proof. User A logs in
 * and every panel answer must come from Tenant A — including when the request carries
 * `X-Tenant-Id: <tenant-b>`, which the panel surface ignores by construction (the
 * routes are exempt from the header hooks and the tenant enters through the session).
 *
 * The same target and fixture key as `src/aislamiento/aislamiento.test.ts`: the Compose `db`
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
    // Per-file tag in the titles: `Plantilla` is global and `test:db` runs every file at once,
    // so `disponibles` is compared on the items of this file alone. No glossary term in it.
    const marcaTitulos = `ch37-aisl-${randomBytes(3).toString('hex')}`;

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerPanelAuthRoutes(app, aislado);
      registerPanelAutomatizacionesRoutes(app, aislado, 'UTC');
      // CH-43: a fake port whose bot is always available, so every Telegram state is reachable.
      registerPanelTelegramRoutes(app, { prisma: aislado, telegram: { bot: () => 'zd_prueba_bot' } });
      await app.ready();

      a = await montarUsuario('A');
      b = await montarUsuario('B');
    });

    after(async () => {
      if (tenantIds.length > 0) {
        await db.vinculoTelegram.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.codigoVinculoTelegram.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

    const titulo = (slug: string): string => `Aviso de prueba ${slug} ${marcaTitulos}`;

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
          titulo: titulo(slug),
          descripcion: 'Descripción de prueba.',
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

    /** The `disponibles` items of this file's own templates (the ones that carry its tag). */
    const propios = <T extends { titulo: string }>(items: T[]): T[] => items.filter((i) => i.titulo.includes(marcaTitulos));

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
      assert.deepEqual(propios(cuerpoA.disponibles).map((i) => i.titulo), [titulo('stock-producible')]);
      assert.deepEqual(cuerpoB.activas.map((i) => [i.titulo, i.ultimaEjecucion.fecha]), [[titulo('stock-producible'), INSTANTE_B]]);
      assert.deepEqual(propios(cuerpoB.disponibles).map((i) => i.titulo), [titulo('stock-fisico')]);

      for (const [cuerpo, ajeno, instanteAjeno] of [[deA.body, b, INSTANTE_B], [deB.body, a, INSTANTE_A]] as const) {
        assert.ok(!cuerpo.includes(ajeno.tenantId), 'no foreign tenant id');
        assert.ok(!cuerpo.includes(instanteAjeno), 'no foreign execution instant');
      }
    });

    /** The body with `disponibles` cut to this file's own templates, so parallel files cannot move it. */
    const normalizado = (cuerpo: string): string => {
      const leido = JSON.parse(cuerpo) as { disponibles: Array<{ titulo: string }> };
      return JSON.stringify({ ...leido, disponibles: propios(leido.disponibles) });
    };

    test("2.15 a foreign X-Tenant-Id or tenant query parameter changes nothing: the body is the same", async () => {
      const tokenA = tokenDe(await ingresar(a));
      const tokenB = tokenDe(await ingresar(b));
      for (const [token, propio, ajeno] of [[tokenA, a, b], [tokenB, b, a]] as const) {
        const base = await automatizacionesDe(token);
        const conCabecera = await automatizacionesDe(token, { cabecera: ajeno.tenantId });
        const conConsulta = await automatizacionesDe(token, { consulta: `tenantId=${ajeno.tenantId}&tenant=${ajeno.tenantId}` });
        assert.equal(base.statusCode, 200, base.body);
        assert.equal(normalizado(conCabecera.body), normalizado(base.body), 'the header is ignored');
        assert.equal(normalizado(conConsulta.body), normalizado(base.body), 'the query parameter is ignored');
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
      // B may own automations from earlier cases (2.14 creates one), so the proof is that
      // none of A's failure reaches B, not that B's list is empty.
      assert.ok(cuerpoB.activas.every((item) => item.estado !== 'con_falla'), 'B never sees a failed automation');
      assert.ok(!deB.body.includes('2026-10-06T08:00:00.000Z'), "A's failed run instant must not reach B");
      assert.ok(!deA.body.includes('codigoError'));
      assert.ok(!deA.body.includes('error'));
    });

    // ---- CH-43 4.4: the Telegram card's API, one session per tenant -------------------

    async function telegramDe(
      token: string,
      metodo: 'GET' | 'POST' | 'DELETE',
      url: string,
      cabecera?: string,
    ) {
      return await app.inject({
        method: metodo,
        url,
        headers: {
          cookie: `${NOMBRE_COOKIE}=${token}`,
          ...(cabecera === undefined ? {} : { 'x-tenant-id': cabecera }),
        },
      });
    }

    test('CH-43 two tenants, two cards: each reads its own state and dates, whatever X-Tenant-Id says', async () => {
      const vinculadoEnA = new Date('2026-11-05T10:00:00.000Z');
      const venceEnB = new Date(Date.now() + 600_000);
      await db.vinculoTelegram.create({ data: { tenantId: a.tenantId, chatId: 42n, vinculadoEn: vinculadoEnA } });
      await db.codigoVinculoTelegram.create({
        data: { tenantId: b.tenantId, codigoHash: randomBytes(32).toString('hex'), venceEn: venceEnB },
      });
      const tokenA = tokenDe(await ingresar(a));
      const tokenB = tokenDe(await ingresar(b));
      for (const cabecera of [undefined, b.tenantId]) {
        const deA = await telegramDe(tokenA, 'GET', '/api/panel/telegram', cabecera);
        assert.equal(deA.statusCode, 200, deA.body);
        assert.deepEqual(deA.json(), { estado: 'vinculado', bot: 'zd_prueba_bot', vinculadoEn: vinculadoEnA.toISOString() });
        assert.ok(!deA.body.includes(venceEnB.toISOString()));
      }
      for (const cabecera of [undefined, a.tenantId]) {
        const deB = await telegramDe(tokenB, 'GET', '/api/panel/telegram', cabecera);
        assert.equal(deB.statusCode, 200, deB.body);
        assert.deepEqual(deB.json(), { estado: 'codigo-pendiente', bot: 'zd_prueba_bot', venceEn: venceEnB.toISOString() });
        assert.ok(!deB.body.includes(vinculadoEnA.toISOString()));
      }
    });

    test("CH-43 A's new code leaves B's code unchanged, and A's unlink leaves B's link unchanged", async () => {
      const tokenA = tokenDe(await ingresar(a));
      const codigoB = await db.codigoVinculoTelegram.findUniqueOrThrow({ where: { tenantId: b.tenantId } });
      const creado = await telegramDe(tokenA, 'POST', '/api/panel/telegram/codigo', b.tenantId);
      assert.equal(creado.statusCode, 201, creado.body);
      assert.deepEqual(await db.codigoVinculoTelegram.findUniqueOrThrow({ where: { tenantId: b.tenantId } }), codigoB);
      assert.equal(await db.codigoVinculoTelegram.count({ where: { tenantId: a.tenantId } }), 1);

      await db.vinculoTelegram.upsert({
        where: { tenantId: b.tenantId },
        create: { tenantId: b.tenantId, chatId: 42n },
        update: {},
      });
      const vinculoB = await db.vinculoTelegram.findUniqueOrThrow({ where: { tenantId: b.tenantId } });
      const desvinculado = await telegramDe(tokenA, 'DELETE', '/api/panel/telegram/vinculo', b.tenantId);
      assert.equal(desvinculado.statusCode, 204, desvinculado.body);
      assert.equal(await db.vinculoTelegram.findUnique({ where: { tenantId: a.tenantId } }), null);
      assert.deepEqual(await db.vinculoTelegram.findUniqueOrThrow({ where: { tenantId: b.tenantId } }), vinculoB);
    });
  },
);

// ---- CH-48 3.4: the dashboard API, one session per tenant (rule 2, DEC-201) ------------

const ROL_TABLERO = 'ch48_aislamiento';
const CLAVE_ROL_TABLERO = 'ch48-clave-aislamiento';
const SQL_LIMPIEZA_TABLERO = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL_TABLERO}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL_TABLERO}');
    EXECUTE format('DROP ROLE %I', '${ROL_TABLERO}');
  END IF;
END
$limpieza$;`;

describe(
  'panel two-tenant isolation — the dashboard API (CH-48, rule 2, DEC-201)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    const marca = `CH-48 aislamiento ${Date.now()}`;
    const ACTUALIZADA_A = new Date('2026-11-01T10:00:00.000Z');
    const ACTUALIZADA_B = new Date('2026-11-02T11:00:00.000Z');
    const SOLO_B = `Solo de B ${randomBytes(3).toString('hex')}`;
    let db!: PrismaClient;
    let admin!: pg.Client;
    let app!: FastifyInstance;
    const partes: string[] = [];
    const tenantIds: string[] = [];
    let a = { tenantId: '', cookie: '' };
    let b = { tenantId: '', cookie: '' };
    let rComun = '';
    let rB = '';
    let rLento = '';

    async function negocio(etiqueta: string, replicaActualizadaEn: Date) {
      const tenant = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}`, activo: true, replicaActualizadaEn } });
      tenantIds.push(tenant.id);
      const usuario = await db.usuario.create({
        data: { tenantId: tenant.id, correo: `${tenant.id}@prueba.test`, claveHash: 'x', activo: true },
      });
      const { tokenPlano, tokenHash } = generarTokenSesion();
      await db.sesionPanel.create({
        data: { tokenHash, usuarioId: usuario.id, tenantId: tenant.id, expiraEn: new Date(Date.now() + 3_600_000) },
      });
      return { tenantId: tenant.id, cookie: `${NOMBRE_COOKIE}=${tokenPlano}` };
    }

    /** A connection to the test database and one approved view of literal rows. */
    async function conexionConVista(tenantId: string, valores: string): Promise<string> {
      const conexion = await db.conexion.create({
        data: {
          tenantId,
          nombre: `${marca} conexion`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: ROL_TABLERO,
          credencial: cifrarCredencial(CLAVE_ROL_TABLERO),
        },
      });
      await db.vistaCanonica.create({
        data: {
          tenantId,
          conexionId: conexion.id,
          entidad: 'producto',
          sql: `SELECT * FROM (VALUES ${valores}) AS t(nombre, cantidad)`,
          estadoValidacion: 'valida',
        },
      });
      return conexion.id;
    }

    async function reporte(titulo: string, sql: string, periodo?: { parametro: string; dias: number[] }): Promise<string> {
      return (
        await db.reporte.create({
          data: {
            nombre: `${marca} ${titulo}`,
            titulo,
            sql,
            entidades: ['producto'],
            visualizacion: 'tabla',
            columnas: [
              { rol: 'columna', columna: 'nombre', titulo: 'Producto' },
              { rol: 'columna', columna: 'cantidad', titulo: 'Cantidad' },
            ],
            periodo,
          },
        })
      ).id;
    }

    before(async () => {
      admin = new pg.Client({ ...objetivo });
      await admin.connect();
      await admin.query(SQL_LIMPIEZA_TABLERO);
      await admin.query(`CREATE ROLE ${ROL_TABLERO} LOGIN PASSWORD '${CLAVE_ROL_TABLERO}'`);
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);

      a = await negocio('A', ACTUALIZADA_A);
      b = await negocio('B', ACTUALIZADA_B);
      const conexionA = await conexionConVista(a.tenantId, "('a-uno', 1), ('a-dos', 2)");
      const conexionB = await conexionConVista(b.tenantId, "('b-uno', 7)");
      rComun = await reporte('Común', 'SELECT nombre, cantidad FROM v_producto ORDER BY cantidad');
      rB = await reporte(SOLO_B, 'SELECT nombre, cantidad FROM v_producto');
      // Up to four distinct runs of A (one per declared day), each held for two seconds.
      rLento = await reporte(
        'Lento',
        'SELECT nombre, cantidad FROM v_producto, pg_sleep(2) WHERE :desde::date IS NOT NULL',
        { parametro: 'desde', dias: [1, 2, 3, 4] },
      );
      await db.tablero.create({ data: { tenantId: a.tenantId, conexionId: conexionA, reportes: [rComun, rLento] } });
      await db.tablero.create({ data: { tenantId: b.tenantId, conexionId: conexionB, reportes: [rComun, rB] } });

      const stream = new Writable({
        write(trozo, _codificacion, listo) {
          partes.push(String(trozo));
          listo();
        },
      });
      app = Fastify({ logger: { level: 'info', stream } });
      registrarContextoTenant(app, aislado);
      registerPanelTableroRoutes(app, { prisma: aislado, zonaHoraria: 'UTC', topeFilas: 200, canales: SIN_AGENTES });
      await app.ready();
    });

    after(async () => {
      if (tenantIds.length > 0) {
        const donde = { tenantId: { in: tenantIds } };
        await db.tablero.deleteMany({ where: donde });
        await db.vistaCanonica.deleteMany({ where: donde });
        await db.conexion.deleteMany({ where: donde });
        await db.usuario.deleteMany({ where: donde });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.reporte.deleteMany({ where: { nombre: { startsWith: marca } } });
      await db.$disconnect();
      await app.close();
      await admin.query(SQL_LIMPIEZA_TABLERO);
      await admin.end();
    });

    function pedir(url: string, cookie: string, cabecera?: string) {
      return app.inject({
        method: 'GET',
        url,
        headers: { cookie, ...(cabecera === undefined ? {} : { 'x-tenant-id': cabecera }) },
      });
    }

    const corridas = (desde: number): string[] =>
      partes
        .slice(desde)
        .join('')
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l) as { msg: string; reporteId?: string })
        .filter((l) => l.msg === 'panel report run')
        .map((l) => l.reporteId ?? '');

    test('CH-48 each configuration lists only its own reports and freshness, whatever X-Tenant-Id says', async () => {
      for (const [propio, ajeno, titulos, fecha, fechaAjena] of [
        [a, b, ['Común', 'Lento'], ACTUALIZADA_A, ACTUALIZADA_B],
        [b, a, ['Común', SOLO_B], ACTUALIZADA_B, ACTUALIZADA_A],
      ] as const) {
        const base = await pedir('/api/panel/tablero', propio.cookie);
        const conCabecera = await pedir('/api/panel/tablero', propio.cookie, ajeno.tenantId);
        assert.equal(base.statusCode, 200, base.body);
        assert.equal(conCabecera.body, base.body, 'the header is ignored');
        const cuerpo = base.json() as { reportes: { titulo: string }[]; datos: { actualizadosEn: string } };
        assert.deepEqual(cuerpo.reportes.map((r) => r.titulo), [...titulos]);
        assert.equal(cuerpo.datos.actualizadosEn, fecha.toISOString());
        for (const prohibido of [ajeno.tenantId, propio.tenantId, fechaAjena.toISOString()]) {
          assert.ok(!base.body.includes(prohibido), `${prohibido} in the configuration`);
        }
      }
      assert.ok(!(await pedir('/api/panel/tablero', a.cookie)).body.includes(SOLO_B), "B's own report title never reaches A");
    });

    test("CH-48 the shared report returns each tenant's own rows, whatever X-Tenant-Id says", async () => {
      const url = `/api/panel/tablero/${rComun}/resultado`;
      for (const [propio, ajeno, filas, ajenas] of [
        [a, b, [['a-uno', 1], ['a-dos', 2]], ['b-uno']],
        [b, a, [['b-uno', 7]], ['a-uno', 'a-dos']],
      ] as const) {
        const base = await pedir(url, propio.cookie);
        assert.equal(base.statusCode, 200, base.body);
        const cuerpo = base.json() as { estado: string; filas: unknown };
        assert.equal(cuerpo.estado, 'ok', base.body);
        assert.deepEqual(cuerpo.filas, filas);
        const conCabecera = await pedir(url, propio.cookie, ajeno.tenantId);
        assert.equal(conCabecera.body, base.body, 'the header is ignored');
        for (const prohibido of [...ajenas, ajeno.tenantId, propio.tenantId]) {
          assert.ok(!base.body.includes(prohibido), `${prohibido} in the answer`);
        }
      }
    });

    test("CH-48 B's own report requested from A's session is 404 and dials nothing", async () => {
      const desde = partes.length;
      for (const cabecera of [undefined, b.tenantId]) {
        const respuesta = await pedir(`/api/panel/tablero/${rB}/resultado`, a.cookie, cabecera);
        assert.equal(respuesta.statusCode, 404, respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'reporte-no-encontrado' });
      }
      assert.deepEqual(corridas(desde), [], 'no run reached the engine');
    });

    test('CH-48 the run gate counts each tenant apart: three runs of A in flight do not delay B', async () => {
      const orden: string[] = [];
      const deA = [1, 2, 3].map((dias) =>
        pedir(`/api/panel/tablero/${rLento}/resultado?dias=${dias}`, a.cookie).then((r) => {
          orden.push(`A${dias}`);
          return r;
        }),
      );
      // Let A's three runs take their slots first.
      await new Promise((resolve) => setTimeout(resolve, 300));
      // A fourth distinct run of A waits for a slot: the gate is in force for A...
      const inicioCuarta = Date.now();
      const cuartaDeA = pedir(`/api/panel/tablero/${rLento}/resultado?dias=4`, a.cookie).then((r) => {
        orden.push('A4');
        return { r, ms: Date.now() - inicioCuarta };
      });
      // ...and B, arriving at the same time, is not delayed by it.
      const inicioB = Date.now();
      const deB = await pedir(`/api/panel/tablero/${rComun}/resultado`, b.cookie);
      const msB = Date.now() - inicioB;
      orden.push('B');
      assert.equal(deB.statusCode, 200, deB.body);
      assert.deepEqual((deB.json() as { filas: unknown }).filas, [['b-uno', 7]]);
      const respuestasA = await Promise.all(deA);
      const cuarta = await cuartaDeA;
      assert.equal(orden[0], 'B', `B finished first: ${orden.join(', ')}`);
      assert.equal(orden.at(-1), 'A4', `A's fourth run finished last: ${orden.join(', ')}`);
      assert.ok(msB < 1500, `B took ${msB} ms`);
      assert.ok(cuarta.ms >= 3000, `A's fourth run waited for a slot: ${cuarta.ms} ms`);
      for (const respuesta of [...respuestasA, cuarta.r]) {
        assert.equal((respuesta.json() as { estado: string }).estado, 'ok', respuesta.body);
      }
    });
  },
);
