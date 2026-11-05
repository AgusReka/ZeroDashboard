import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { generarTokenSesion } from '../compartido/crypto-auth.js';
import { registerPanelAjustesRoutes } from './panel-ajustes.js';

/**
 * CH-23 (DEC-138 to DEC-141): `GET` and `PUT /api/panel/automatizaciones/:id/ajustes`
 * against a live PostgreSQL target, with the two-tenant proof of rule 2: another tenant's
 * id answers exactly what an unknown id answers, and its row is never written. Same target
 * and variables as `src/panel/panel-automatizaciones.test.ts` (see `src/aislamiento/aislamiento.test.ts`).
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

/** Wednesday 2026-10-07 10:00 UTC: the clock `proximaEjecucion` is computed from. */
const RELOJ = new Date('2026-10-07T10:00:00Z');

describe(
  'GET/PUT /api/panel/automatizaciones/:id/ajustes — live PostgreSQL target (CH-23 PR2)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    const marca = `CH-23 ${Date.now()}`;
    let db!: PrismaClient;
    let app!: FastifyInstance;
    let plantillaId!: string;
    const tenantIds: string[] = [];

    interface Negocio {
      tenantId: string;
      conexionId: string;
      cookie: { cookie: string };
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      app = Fastify({ logger: false });
      const aislado = extenderConAislamiento(db);
      registrarContextoTenant(app, aislado);
      registerPanelAjustesRoutes(app, aislado, 'UTC', () => RELOJ, true);
      await app.ready();
      const plantilla = await db.plantilla.create({
        data: {
          nombre: `${marca} plantilla`,
          sql: 'SELECT nombre FROM v_producto WHERE stock <= :umbral',
          parametros: [{ nombre: 'umbral', tipo: 'numero' }],
          entidades: ['producto'],
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      });
      plantillaId = plantilla.id;
    });

    after(async () => {
      if (tenantIds.length > 0) {
        const donde = { tenantId: { in: tenantIds } };
        await db.vinculoTelegram.deleteMany({ where: donde });
        await db.automatizacion.deleteMany({ where: donde });
        await db.conexion.deleteMany({ where: donde });
        await db.usuario.deleteMany({ where: donde });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.plantilla.deleteMany({ where: { id: plantillaId } });
      await db.$disconnect();
      await app.close();
    });

    /** One tenant, one user, one connection and one live session cookie. */
    async function negocio(etiqueta: string): Promise<Negocio> {
      const tenant = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}`, activo: true } });
      tenantIds.push(tenant.id);
      const usuario = await db.usuario.create({
        data: { tenantId: tenant.id, correo: `${tenant.id}@prueba.test`, claveHash: 'x', activo: true },
      });
      const conexion = await db.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: 'Replica',
          motor: 'postgres',
          host: 'localhost',
          puerto: 5432,
          baseDeDatos: 'x',
          usuarioDb: 'x',
          credencial: 'x',
        },
      });
      const { tokenPlano, tokenHash } = generarTokenSesion();
      await db.sesionPanel.create({
        data: { tokenHash, usuarioId: usuario.id, tenantId: tenant.id, expiraEn: new Date(Date.now() + 3_600_000) },
      });
      return { tenantId: tenant.id, conexionId: conexion.id, cookie: { cookie: `zd_panel_session=${tokenPlano}` } };
    }

    async function automatizacion(
      n: Negocio,
      extra: { cron?: string; activo?: boolean; destinatarios?: string[] } = {},
    ): Promise<string> {
      const fila = await db.automatizacion.create({
        data: {
          tenantId: n.tenantId,
          plantillaId,
          conexionId: n.conexionId,
          cron: extra.cron ?? '30 8 * * 1-5',
          valores: { umbral: 20 },
          activo: extra.activo ?? true,
          destinatarios: extra.destinatarios ?? ['ana@empresa.com'],
        },
      });
      return fila.id;
    }

    const url = (id: string): string => `/api/panel/automatizaciones/${encodeURIComponent(id)}/ajustes`;

    async function leer(n: Negocio, id: string, cabeceras: Record<string, string> = {}) {
      return await app.inject({ method: 'GET', url: url(id), headers: { ...n.cookie, ...cabeceras } });
    }

    async function guardar(n: Negocio, id: string, payload: unknown, cabeceras: Record<string, string> = {}) {
      return await app.inject({ method: 'PUT', url: url(id), headers: { ...n.cookie, ...cabeceras }, payload: payload as object });
    }

    async function fila(id: string) {
      return await db.automatizacion.findUniqueOrThrow({
        where: { id },
        select: { cron: true, valores: true, destinatarios: true, activo: true, minimoFilas: true },
      });
    }

    // ---- read ------------------------------------------------------------------------

    test('GET returns the preset schedule, the umbral and the recipients, with nothing technical', async () => {
      const n = await negocio('lee');
      const id = await automatizacion(n);
      const respuesta = await leer(n, id);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), {
        umbral: 20,
        hora: '08:30',
        dias: 'lun-vie',
        destinatarios: ['ana@empresa.com'],
        canal: 'correo',
        canales: ['correo'],
        zonaHoraria: 'UTC',
      });
      for (const texto of ['cron', 'valores', 'sql', 'tenantId', 'conexionId', n.tenantId, n.conexionId]) {
        assert.ok(!respuesta.body.includes(texto), texto);
      }
    });

    // ---- channel (CH-44, DEC-197) -----------------------------------------------------

    const vincular = (n: Negocio, chatId = 987654321n) =>
      db.vinculoTelegram.create({ data: { tenantId: n.tenantId, chatId } });

    const canalDe = async (id: string) => {
      const guardada = await db.automatizacion.findUniqueOrThrow({ where: { id }, select: { canal: true, destinatarios: true } });
      return guardada;
    };

    test('CH-44 a linked tenant may choose Telegram, the recipients stay, and the chat id never leaves', async () => {
      const n = await negocio('canal-vinculado');
      await vincular(n);
      const id = await automatizacion(n);
      const leida = await leer(n, id);
      assert.deepEqual(leida.json().canales, ['correo', 'telegram']);
      assert.ok(!leida.body.includes('987654321'));
      const guardada = await guardar(n, id, { canal: 'telegram' });
      assert.equal(guardada.statusCode, 200, guardada.body);
      assert.equal(guardada.json().canal, 'telegram');
      assert.ok(!guardada.body.includes('987654321'));
      assert.deepEqual(await canalDe(id), { canal: 'telegram', destinatarios: ['ana@empresa.com'] });
    });

    test('CH-44 an unlinked tenant is refused Telegram, and another tenant\'s link does not count', async () => {
      const n = await negocio('canal-sin-vinculo');
      const otro = await negocio('canal-otro');
      await vincular(otro);
      const id = await automatizacion(n);
      assert.deepEqual((await leer(n, id)).json().canales, ['correo']);
      const respuesta = await guardar(n, id, { canal: 'telegram' });
      assert.equal(respuesta.statusCode, 400);
      assert.deepEqual(respuesta.json().campos, ['canal']);
      assert.equal((await canalDe(id)).canal, 'correo');
    });

    test('CH-44 an unknown channel and a chat id in the body are refused', async () => {
      const n = await negocio('canal-raro');
      const id = await automatizacion(n);
      assert.equal((await guardar(n, id, { canal: 'sms' })).statusCode, 400);
      assert.equal((await guardar(n, id, { chatId: '42' })).statusCode, 400);
      assert.equal((await canalDe(id)).canal, 'correo');
    });

    test('CH-44 a Telegram automation can go back, and needs an address to do it', async () => {
      const n = await negocio('canal-vuelve');
      const id = await automatizacion(n, { destinatarios: [] });
      await db.automatizacion.update({ where: { id }, data: { canal: 'telegram' } });
      assert.deepEqual((await leer(n, id)).json().canales, ['correo', 'telegram'], 'with no link, it can still go back');
      const sinCorreo = await guardar(n, id, { canal: 'correo' });
      assert.equal(sinCorreo.statusCode, 400);
      assert.deepEqual(sinCorreo.json().campos, ['destinatarios']);
      assert.equal((await canalDe(id)).canal, 'telegram');
      const conCorreo = await guardar(n, id, { canal: 'correo', destinatarios: ['a@b.com'] });
      assert.equal(conCorreo.statusCode, 200, conCorreo.body);
      assert.deepEqual(await canalDe(id), { canal: 'correo', destinatarios: ['a@b.com'] });
    });

    test('CH-44 a foreign id answers 404 and leaves the other tenant\'s channel alone', async () => {
      const a = await negocio('canal-a');
      const b = await negocio('canal-b');
      await vincular(a);
      const idB = await automatizacion(b);
      assert.equal((await guardar(a, idB, { canal: 'telegram' })).statusCode, 404);
      assert.equal((await canalDe(idB)).canal, 'correo');
    });

    test('GET with a custom cron has no hora, no dias and no cron text', async () => {
      const n = await negocio('personalizado');
      const id = await automatizacion(n, { cron: '0 */6 * * *' });
      const cuerpo = (await leer(n, id)).json() as Record<string, unknown>;
      assert.deepEqual(Object.keys(cuerpo).sort(), ['canal', 'canales', 'destinatarios', 'umbral', 'zonaHoraria']);
    });

    test('CH-41 GET returns the stored list in order, and [] when none is stored', async () => {
      const n = await negocio('lista');
      const dos = await automatizacion(n, { destinatarios: ['b@empresa.com', 'a@empresa.com'] });
      assert.deepEqual(((await leer(n, dos)).json() as { destinatarios: string[] }).destinatarios, ['b@empresa.com', 'a@empresa.com']);
      const ninguno = await automatizacion(n, { destinatarios: [] });
      assert.deepEqual(((await leer(n, ninguno)).json() as { destinatarios: string[] }).destinatarios, []);
    });

    // ---- write -----------------------------------------------------------------------

    test('PUT stores the cron built on the server, the merged valores and the recipients', async () => {
      const n = await negocio('guarda');
      const id = await automatizacion(n);
      const respuesta = await guardar(n, id, {
        umbral: 5,
        hora: '09:15',
        dias: 'lun-sab',
        destinatarios: ['  nuevo@empresa.com ', 'otro@empresa.com'],
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), {
        umbral: 5,
        hora: '09:15',
        dias: 'lun-sab',
        destinatarios: ['nuevo@empresa.com', 'otro@empresa.com'],
        canal: 'correo',
        canales: ['correo'],
        zonaHoraria: 'UTC',
        proximaEjecucion: '2026-10-08T09:15:00.000Z',
      });
      assert.deepEqual(await fila(id), {
        cron: '15 9 * * 1-6',
        valores: { umbral: 5 },
        destinatarios: ['nuevo@empresa.com', 'otro@empresa.com'],
        activo: true,
        // CH-40: the panel adjust never touches the minimum (DEC-186).
        minimoFilas: 1,
      });
    });

    test('PUT with only hora keeps the days, the umbral and the recipients', async () => {
      const n = await negocio('parcial');
      const id = await automatizacion(n);
      const respuesta = await guardar(n, id, { hora: '10:00' });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(await fila(id), {
        cron: '0 10 * * 1-5',
        valores: { umbral: 20 },
        destinatarios: ['ana@empresa.com'],
        activo: true,
        minimoFilas: 1,
      });
    });

    test('CH-41 PUT with only the list replaces it and leaves the schedule and the umbral alone', async () => {
      const n = await negocio('solo-lista');
      const id = await automatizacion(n);
      const respuesta = await guardar(n, id, { destinatarios: ['Uno@empresa.com', 'dos@empresa.com', 'uno@empresa.com'] });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual((respuesta.json() as { destinatarios: string[] }).destinatarios, ['Uno@empresa.com', 'dos@empresa.com']);
      assert.deepEqual(await fila(id), {
        cron: '30 8 * * 1-5',
        valores: { umbral: 20 },
        destinatarios: ['Uno@empresa.com', 'dos@empresa.com'],
        activo: true,
        minimoFilas: 1,
      });
    });

    test('CH-41 PUT refuses [] and a list of blanks, and more than five addresses; the stored list stays', async () => {
      const n = await negocio('no-vacia');
      const id = await automatizacion(n);
      const antes = await fila(id);
      for (const destinatarios of [[], ['', '  '], ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com']]) {
        const respuesta = await guardar(n, id, { destinatarios });
        assert.equal(respuesta.statusCode, 400, JSON.stringify(destinatarios) + respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['destinatarios'] });
      }
      assert.deepEqual(await fila(id), antes);
    });

    test('PUT with an invalid value is a 400 that names the business fields and stores nothing', async () => {
      const n = await negocio('invalido');
      const id = await automatizacion(n);
      const antes = await fila(id);
      const respuesta = await guardar(n, id, { umbral: 'x', hora: '25:00', destinatarios: ['a@b.com', 'no-es-un-correo'] });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['umbral', 'hora', 'destinatarios'] });
      assert.deepEqual(await fila(id), antes);
    });

    test('PUT refuses tenantId, cron, sql, valores, activo, unknown keys and an empty body', async () => {
      const n = await negocio('prohibidas');
      const id = await automatizacion(n);
      const antes = await fila(id);
      for (const cuerpo of [
        { tenantId: 'otro' },
        { cron: '* * * * *' },
        { sql: 'DROP TABLE x' },
        { valores: { umbral: 1 } },
        { activo: false },
        { desconocida: 1 },
        // CH-41 (DEC-194): the former single key is no longer a key, never silently dropped.
        { destinatario: 'ana@empresa.com' },
        { hora: '08:00', destinatario: 'ana@empresa.com' },
        // CH-40 (DEC-186): the minimum rows is the operator's to set, never the panel's.
        { minimoFilas: 5 },
        { umbral: 1, minimoFilas: 5 },
        { hora: '08:00', cron: '* * * * *' },
        {},
      ]) {
        const respuesta = await guardar(n, id, cuerpo);
        assert.equal(respuesta.statusCode, 400, JSON.stringify(cuerpo) + respuesta.body);
        assert.equal((respuesta.json() as { error: string }).error, 'solicitud-invalida');
      }
      assert.deepEqual(await fila(id), antes);
    });

    test('PUT on a paused automation is 409, and a schedule over a custom cron is 409; nothing changes', async () => {
      const n = await negocio('estados');
      const pausada = await automatizacion(n, { activo: false });
      const personalizada = await automatizacion(n, { cron: '0 */6 * * *' });
      const antesPausada = await fila(pausada);
      const antesPersonalizada = await fila(personalizada);
      const a = await guardar(n, pausada, { umbral: 1 });
      assert.equal(a.statusCode, 409, a.body);
      assert.deepEqual(a.json(), { error: 'automatizacion-pausada' });
      const b = await guardar(n, personalizada, { hora: '10:00' });
      assert.equal(b.statusCode, 409, b.body);
      assert.deepEqual(b.json(), { error: 'horario-no-editable' });
      assert.deepEqual(await fila(pausada), antesPausada);
      assert.deepEqual(await fila(personalizada), antesPersonalizada);
      // The umbral of a custom-cron automation is still adjustable.
      const c = await guardar(n, personalizada, { umbral: 3 });
      assert.equal(c.statusCode, 200, c.body);
      assert.equal((await fila(personalizada)).cron, '0 */6 * * *');
    });

    test('both routes answer 401 without a cookie and 404 for an unknown id', async () => {
      const n = await negocio('guardia');
      for (const method of ['GET', 'PUT'] as const) {
        const sin = await app.inject({ method, url: url('x'), payload: method === 'PUT' ? { hora: '08:00' } : undefined });
        assert.equal(sin.statusCode, 401, sin.body);
        assert.deepEqual(sin.json(), { error: 'sesion-invalida' });
      }
      assert.equal((await leer(n, 'no-existe')).statusCode, 404);
      const put = await guardar(n, 'no-existe', { hora: '08:00' });
      assert.equal(put.statusCode, 404, put.body);
      assert.deepEqual(put.json(), { error: 'automatizacion-no-encontrada' });
    });

    // ---- rule 2: two tenants ---------------------------------------------------------

    test("Tenant A's session reads and writes nothing of Tenant B, and the answer equals an unknown id's", async () => {
      const a = await negocio('A');
      const b = await negocio('B');
      const idB = await automatizacion(b);
      const antes = await fila(idB);

      const desconocida = await guardar(a, 'no-existe', { hora: '11:00', umbral: 1 });
      const ajena = await guardar(a, idB, { hora: '11:00', umbral: 1 });
      assert.equal(ajena.statusCode, 404, ajena.body);
      assert.equal(ajena.body, desconocida.body, 'a foreign id is indistinguishable from an unknown one');

      const lecturaAjena = await leer(a, idB);
      assert.equal(lecturaAjena.statusCode, 404, lecturaAjena.body);
      assert.equal(lecturaAjena.body, (await leer(a, 'no-existe')).body);

      assert.deepEqual(await fila(idB), antes, "Tenant B's row is untouched");
    });

    test('X-Tenant-Id is ignored: it neither opens Tenant B to A nor hides A from itself', async () => {
      const a = await negocio('A2');
      const b = await negocio('B2');
      const idA = await automatizacion(a);
      const idB = await automatizacion(b);
      const antesB = await fila(idB);

      const conCabeceraDeB = await guardar(a, idB, { hora: '11:00' }, { 'x-tenant-id': b.tenantId });
      assert.equal(conCabeceraDeB.statusCode, 404, conCabeceraDeB.body);
      assert.deepEqual(await fila(idB), antesB);

      const propia = await guardar(a, idA, { hora: '11:00' }, { 'x-tenant-id': b.tenantId });
      assert.equal(propia.statusCode, 200, propia.body);
      assert.equal((await fila(idA)).cron, '0 11 * * 1-5');
      assert.deepEqual(await fila(idB), antesB);
    });
  },
);
