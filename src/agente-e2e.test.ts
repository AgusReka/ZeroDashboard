import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { WebSocket } from 'ws';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarServidorAgentes } from './agente-servidor.js';
import { generarTokenAgente, hashTokenAgente } from './agente-token.js';
import { registerConexionRoutes } from './conexiones.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { cifrarCredencial } from './cripto-credencial.js';
import { crearPlanificador } from './planificador.js';
import { crearRegistroAgentes } from './registro-agentes.js';

/**
 * CH-19c1 unit 4, cases E1-E5: an agent-bound connection end to end, on a real ephemeral
 * port and the live test PostgreSQL; skipped when none is reachable. The agent (19c2) is
 * not built here: a `ws` client stands in for it, dialling back on `apertura-sesion` and
 * relaying bytes. Every row points at the test server the engine could also dial directly,
 * so a fallback to a direct dial would turn a failure into an `ok`.
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

const alcanzable = await new Promise<boolean>((resolve) => {
  const socket = net.connect({ host: objetivo.host, port: objetivo.port });
  socket.setTimeout(1000);
  socket.once('connect', () => (socket.destroy(), resolve(true)));
  socket.once('timeout', () => (socket.destroy(), resolve(false)));
  socket.once('error', () => resolve(false));
});
const motivoSkip = alcanzable ? false : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

describe('agent channel end to end (CH-19c1 E1-E5)', { skip: motivoSkip }, () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const aislado = extenderConAislamiento(prisma);
  const registro = crearRegistroAgentes();
  const app = Fastify({ logger: false });
  const token = generarTokenAgente();
  const marca = `CH-19c1 e2e ${Date.now()}`;
  let tenantA!: string;
  let tenantB!: string;
  let agenteA!: string;
  let plantillaId!: string;
  let puerto!: number;
  /** What A's fake agent was asked to dial, one entry per `apertura-sesion`. */
  const aperturas: { host: string; puerto: number }[] = [];
  let modo: 'relevar' | 'fallar' = 'relevar';
  let control: WebSocket | undefined;

  before(async () => {
    tenantA = (await prisma.tenant.create({ data: { nombre: `${marca} A` } })).id;
    tenantB = (await prisma.tenant.create({ data: { nombre: `${marca} B` } })).id;
    agenteA = (await prisma.agente.create({ data: { tenantId: tenantA, tokenHash: hashTokenAgente(token) } })).id;
    plantillaId = (await prisma.plantilla.create({
      data: {
        nombre: marca, sql: 'SELECT * FROM v_producto', parametros: [], entidades: ['producto'],
        automatizacion: 'stock-fisico', formato: 'correo-html', toleranciaFrescuraMinutos: 30,
      },
    })).id;
    registrarContextoTenant(app, aislado);
    registerConexionRoutes(app, aislado, registro);
    registrarServidorAgentes({ app, prisma: aislado, registro });
    await app.listen({ port: 0, host: '127.0.0.1' });
    puerto = (app.server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await app.close();
    // FK order across both tenants: B's forced row points at A's agent.
    const where = { tenantId: { in: [tenantA, tenantB] } };
    await prisma.ejecucion.deleteMany({ where });
    await prisma.automatizacion.deleteMany({ where });
    await prisma.vistaCanonica.deleteMany({ where });
    await prisma.conexion.deleteMany({ where });
    await prisma.agente.deleteMany({ where });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.plantilla.delete({ where: { id: plantillaId } });
    await prisma.$disconnect();
  });

  /** A row of `tenantId` written on the raw client, as admin SQL would, at the test server. */
  async function conexion(tenantId: string, agenteId: string | null): Promise<string> {
    const fila = await prisma.conexion.create({
      data: {
        tenantId, agenteId, nombre: marca, motor: 'postgres', host: objetivo.host, puerto: objetivo.port,
        baseDeDatos: objetivo.database, usuarioDb: objetivo.user, credencial: cifrarCredencial(objetivo.password),
      },
    });
    return fila.id;
  }

  async function probar(id: string, tenantId: string) {
    const respuesta = await app.inject({ method: 'POST', url: `/conexiones/${id}/prueba`, headers: { 'x-tenant-id': tenantId } });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { resultado, categoria, codigo } = respuesta.json();
    return [resultado, categoria, codigo];
  }

  /** A's fake agent, connected once: it relays each session to the host and port it is given. */
  async function agenteVivo(): Promise<void> {
    if (control !== undefined) return;
    const url = (ruta: string): string => `ws://127.0.0.1:${puerto}${ruta}`;
    const headers = { authorization: `Bearer ${token}` };
    control = new WebSocket(url('/agente/control'), { headers });
    control.on('message', (texto) => {
      const { sesionId, host, puerto: destino } = JSON.parse(String(texto));
      aperturas.push({ host, puerto: destino });
      if (modo === 'fallar') {
        control?.send(JSON.stringify({ tipo: 'sesion-fallida', sesionId, codigo: 'ECONNREFUSED' }));
        return;
      }
      const replica = net.connect({ host, port: destino }, () => {
        const datos = new WebSocket(url(`/agente/datos/${sesionId}`), { headers });
        datos.on('message', (trozo) => replica.write(trozo as Buffer));
        replica.on('data', (trozo) => datos.send(trozo));
        datos.on('close', () => replica.destroy());
        replica.on('close', () => datos.close());
        datos.on('error', () => {});
      });
      replica.on('error', () => {});
    });
    await once(control, 'open');
  }

  test('E2 with no control socket a row the engine could reach directly fails with ESINAGENTE', async () => {
    assert.deepEqual(await probar(await conexion(tenantA, null), tenantA), ['ok', null, null]);
    assert.deepEqual(await probar(await conexion(tenantA, agenteA), tenantA), ['fallo', 'error-desconocido', 'ESINAGENTE']);
  });

  test('E3 a scheduled run with three attempts allowed makes one: ESINAGENTE is not retried', async () => {
    const conexionId = await conexion(tenantA, agenteA);
    await prisma.vistaCanonica.create({
      data: { tenantId: tenantA, conexionId, entidad: 'producto', sql: 'SELECT 1 AS id', estadoValidacion: 'valida' },
    });
    const { id } = await prisma.automatizacion.create({
      data: { tenantId: tenantA, plantillaId, conexionId, cron: '* * * * *', creadaEn: new Date('2020-01-01T00:00:00Z') },
    });
    // Tenant A only, so the due automations of other files never run here.
    const soloA = new Proxy(aislado, {
      get: (destino, prop) =>
        prop === 'tenant'
          ? { findMany: (args: Parameters<typeof aislado.tenant.findMany>[0] = {}) =>
              aislado.tenant.findMany({ ...args, where: { AND: [args.where ?? {}, { id: tenantA }] } }) }
          : Reflect.get(destino, prop),
    });
    const reloj = {
      ahora: () => new Date('2021-03-01T10:00:30Z'),
      programar: (): never => {
        throw new Error('a retry pause was asked for');
      },
    };
    await crearPlanificador({
      prisma: soloA, zonaHoraria: 'UTC', log: app.log, reloj, reintentos: { intentos: 3, pausaMs: 5_000 }, canales: registro,
    }).ejecutarTick(new Date('2021-03-01T10:01:30Z'));
    const filas = await prisma.ejecucion.findMany({
      where: { automatizacionId: id },
      select: { estado: true, fase: true, error: true, codigoError: true, intentos: true },
    });
    assert.deepEqual(filas, [{ estado: 'fallo', fase: 'conexion', error: 'error-desconocido', codigoError: 'ESINAGENTE', intentos: 1 }]);
  });

  test("E1 an agent-bound probe runs through the fake agent, which dials the row's host and port", async () => {
    await agenteVivo();
    assert.deepEqual(await probar(await conexion(tenantA, agenteA), tenantA), ['ok', null, null]);
    assert.deepEqual(aperturas, [{ host: objetivo.host, puerto: objetivo.port }]);
  });

  test("E4 tenant B's row forced onto A's agent fails with ESINAGENTE and A's agent hears nothing", async () => {
    await agenteVivo();
    // `POST /conexiones` refuses another tenant's agent (DEC-121): only admin SQL writes this row.
    const ajena = await conexion(tenantB, agenteA);
    const antes = aperturas.length;
    assert.deepEqual(await probar(ajena, tenantB), ['fallo', 'error-desconocido', 'ESINAGENTE']);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(aperturas.length, antes, 'no apertura-sesion reached A');
  });

  test('E5 sesion-fallida ECONNREFUSED from the agent gives host-inalcanzable', async () => {
    await agenteVivo();
    modo = 'fallar';
    assert.deepEqual(await probar(await conexion(tenantA, agenteA), tenantA), ['fallo', 'host-inalcanzable', 'ECONNREFUSED']);
  });
});
