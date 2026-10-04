import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import net from 'node:net';
import { after, afterEach, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { WebSocket } from 'ws';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento-prisma.js';
import { registrarServidorAgentes } from '../agente-servidor.js';
import { generarTokenAgente, hashTokenAgente } from '../agente-token.js';
import { LIMITE_TRAMA_DATOS } from '../canal-agente.js';
import { registerConexionRoutes } from '../conexiones.js';
import { registrarContextoTenant } from '../contexto-tenant.js';
import { cifrarCredencial } from '../cripto-credencial.js';
import { crearRegistroAgentes } from '../registro-agentes.js';
import { ejecutarAgente } from './arranque.js';
import type { EventoLog } from './log.js';

/**
 * CH-19c2, cases A1-A9 and S1-S3: the real agent against a real engine (Fastify, registry,
 * upgrade listener) and the live test PostgreSQL; skipped when none is reachable. The agent
 * runs in process through `ejecutarAgente`, with an `EventEmitter` as `proceso`, so a
 * shutdown is a real SIGTERM path (`child.kill()` is a hard kill on Windows). It dials a
 * TCP forwarder in front of the engine, so a test can cut the network. S1-S3 spawn
 * `main.ts`. Tokens are generated; no secret is committed (rule 7).
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

/** Each event's own fields (A9). `Record` makes `tsc` reject a missing or unknown event. */
const CAMPOS: Record<EventoLog['evento'], readonly string[]> = {
  'sesion-abierta': [], 'sesion-cerrada': [], 'sesion-fallida': ['codigo'], 'destino-no-permitido': [],
  'tope-de-sesiones': [], 'mensaje-invalido': [], 'control-conectado': [], 'sin-ping': [],
  'control-rechazado': ['estado'], 'control-cerrado': ['codigoCierre'], 'reconexion-programada': ['esperaMs', 'intento'],
  'configuracion-invalida': ['variable'], apagado: ['senal'], fin: ['codigoSalida', 'motivo'], 'error-interno': ['nombreError'],
};
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const pausa = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
/** Bounded, so a regression fails here instead of hanging the suite. */
async function hasta(condicion: () => boolean, ms = 10_000): Promise<void> {
  for (const limite = Date.now() + ms; !condicion(); await pausa(10)) {
    if (Date.now() > limite) throw new Error(`condition not reached within ${ms} ms`);
  }
}

/** `main.ts` in a child with an env of only `PATH`, `SystemRoot` and the `AGENT_*` values. */
function lanzar(env: Record<string, string>) {
  const base = { PATH: process.env.PATH ?? '', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) };
  const hijo = spawn(process.execPath, ['--import', 'tsx', 'src/agente-proceso/main.ts'], { cwd: RAIZ, env: { ...base, ...env } });
  const r = { hijo, stdout: '', stderr: '', codigo: undefined as number | null | undefined };
  hijo.stdout.on('data', (b) => (r.stdout += b));
  hijo.stderr.on('data', (b) => (r.stderr += b));
  hijo.on('close', (codigo) => (r.codigo = codigo));
  return r;
}

test('S1 a spawned agent with a userinfo URL exits 1 and prints neither the secret nor the token', async () => {
  const sentinela = `SENTINELA${randomBytes(8).toString('hex')}`;
  const token = generarTokenAgente();
  const r = lanzar({ AGENT_SERVER_URL: `wss://u:${sentinela}@motor.example`, AGENT_TOKEN: token, AGENT_ALLOWED_TARGETS: 'db:5432' });
  await hasta(() => r.codigo !== undefined, 30_000);
  assert.equal(r.codigo, 1);
  for (const fuga of [sentinela, token, 'motor.example']) assert.ok(!(r.stdout + r.stderr).includes(fuga), fuga);
  assert.deepEqual(r.stderr.trim().split('\n').map((l) => [JSON.parse(l).evento, JSON.parse(l).variable]), [
    ['configuracion-invalida', 'AGENT_SERVER_URL'],
  ]);
});

describe('the agent process end to end (CH-19c2 A1-A9, S2-S3)', { skip: motivoSkip }, () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const aislado = extenderConAislamiento(prisma);
  const ids: string[] = [];
  const registro = crearRegistroAgentes({ generarId: () => (ids.push(randomBytes(16).toString('base64url')), ids.at(-1)!) });
  const app = Fastify({ logger: false });
  const token = generarTokenAgente();
  const marca = `CH-19c2 e2e ${Date.now()}`;
  /** Every agent log line of the file, in process or spawned (A9). */
  const lineas: string[] = [];
  const rutas: string[] = [];
  const limpiezas: (() => Promise<unknown>)[] = [];
  const pares = new Set<net.Socket>();
  const reenvio = net.createServer();
  let tenantId!: string;
  let agenteId!: string;
  let puertoMotor!: number;
  let cerrado!: number;
  let url!: string;
  let permitidos!: string;

  before(async () => {
    tenantId = (await prisma.tenant.create({ data: { nombre: marca } })).id;
    agenteId = (await prisma.agente.create({ data: { tenantId, tokenHash: hashTokenAgente(token) } })).id;
    registrarContextoTenant(app, aislado);
    registerConexionRoutes(app, aislado, registro);
    registrarServidorAgentes({ app, prisma: aislado, registro });
    app.server.prependListener('upgrade', (peticion) => rutas.push(peticion.url ?? ''));
    await app.listen({ port: 0, host: '127.0.0.1' });
    puertoMotor = (app.server.address() as net.AddressInfo).port;
    // A TCP forwarder in front of the engine: `cortar()` destroys every live pair.
    reenvio.on('connection', (cliente) => {
      const motor = net.connect(puertoMotor, '127.0.0.1');
      for (const s of [cliente, motor]) {
        pares.add(s);
        s.on('error', () => {}).on('close', () => (pares.delete(s), cliente.destroy(), motor.destroy()));
      }
      cliente.pipe(motor).pipe(cliente);
    });
    reenvio.listen(0, '127.0.0.1');
    await once(reenvio, 'listening');
    url = `ws://127.0.0.1:${(reenvio.address() as net.AddressInfo).port}`;
    const libre = net.createServer().listen(0, '127.0.0.1');
    await once(libre, 'listening');
    cerrado = (libre.address() as net.AddressInfo).port;
    await new Promise((listo) => libre.close(listo));
    permitidos = `${objetivo.host}:${objetivo.port},127.0.0.1:${cerrado}`;
  });

  afterEach(async () => {
    for (const limpiar of limpiezas.splice(0)) await limpiar();
  });

  after(async () => {
    pares.forEach((s) => s.destroy());
    reenvio.close();
    await app.close();
    await prisma.conexion.deleteMany({ where: { tenantId } });
    await prisma.agente.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  /** The real agent; cleanup is a SIGTERM and a wait for its exit code. */
  function arrancar(op: { token?: string } = {}) {
    const proceso = new EventEmitter();
    const propias: string[] = [];
    const codigos: number[] = [];
    const escribir = (linea: string) => void (lineas.push(linea), propias.push(linea));
    ejecutarAgente({
      env: { AGENT_SERVER_URL: url, AGENT_TOKEN: op.token ?? token, AGENT_ALLOWED_TARGETS: permitidos },
      proceso, escribir, escribirError: escribir, salir: (codigo) => void codigos.push(codigo), aleatorio: () => 0,
      // Real timers, unref'd so the 5 s shutdown cap never holds the test process open.
      programar: (ms, fn) => {
        const reloj = setTimeout(fn, ms).unref();
        return () => clearTimeout(reloj);
      },
    });
    limpiezas.push(async () => (proceso.emit('SIGTERM'), hasta(() => codigos.length > 0)));
    const eventos = () => propias.map((l) => JSON.parse(l));
    const cuenta = (evento: string) => eventos().filter((e) => e.evento === evento).length;
    const conectado = (n = 1) => hasta(() => cuenta('control-conectado') >= n);
    return { proceso, codigos, eventos, cuenta, conectado };
  }

  async function probar(host: string, puerto: number) {
    const fila = await prisma.conexion.create({
      data: {
        tenantId, agenteId, nombre: marca, motor: 'postgres', host, puerto,
        baseDeDatos: objetivo.database, usuarioDb: objetivo.user, credencial: cifrarCredencial(objetivo.password),
      },
    });
    const respuesta = await app.inject({ method: 'POST', url: `/conexiones/${fila.id}/prueba`, headers: { 'x-tenant-id': tenantId } });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { resultado, categoria, codigo } = respuesta.json();
    return [resultado, categoria, codigo];
  }
  const datos = () => rutas.filter((r) => r.startsWith('/agente/datos/')).length;
  const fin = (a: { eventos: () => { evento: string; motivo?: string }[] }) => a.eventos().find((e) => e.evento === 'fin')?.motivo;

  test("A1 a probe through the agent dials the row's host and port, and SIGTERM exits 0", async () => {
    const a = arrancar();
    await a.conectado();
    assert.deepEqual(await probar(objetivo.host, objetivo.port), ['ok', null, null]);
    assert.equal(datos(), 1);
    a.proceso.emit('SIGTERM');
    await hasta(() => a.codigos.length > 0, 6_000);
    assert.deepEqual([a.codigos, fin(a)], [[0], 'detenido']);
  });

  test('A2 an unlisted target fails with ECONNREFUSED and nothing dials it', async () => {
    let aceptadas = 0;
    const trampa = net.createServer((s) => (aceptadas++, s.destroy())).listen(0, '127.0.0.1');
    await once(trampa, 'listening');
    limpiezas.push(() => new Promise((listo) => trampa.close(listo)));
    const a = arrancar();
    await a.conectado();
    const antes = datos();
    assert.deepEqual(await probar('127.0.0.1', (trampa.address() as net.AddressInfo).port), ['fallo', 'host-inalcanzable', 'ECONNREFUSED']);
    assert.deepEqual([aceptadas, datos() - antes, a.cuenta('destino-no-permitido')], [0, 0, 1]);
  });

  test('A3 after a network cut the agent reconnects and serves again', async () => {
    const a = arrancar();
    await a.conectado();
    pares.forEach((s) => s.destroy());
    await a.conectado(2);
    assert.equal(a.cuenta('reconexion-programada'), 1);
    assert.deepEqual(await probar(objetivo.host, objetivo.port), ['ok', null, null]);
  });

  test('A4 an unknown token is terminal: credenciales-rechazadas, exit 2', async () => {
    const a = arrancar({ token: generarTokenAgente() });
    await hasta(() => a.codigos.length > 0);
    assert.deepEqual([a.codigos, fin(a), a.cuenta('control-conectado')], [[2], 'credenciales-rechazadas', 0]);
  });

  test('A5 registro.cerrarAgente is terminal: agente-revocado, exit 2', async () => {
    const a = arrancar();
    await a.conectado();
    registro.cerrarAgente(agenteId);
    await hasta(() => a.codigos.length > 0);
    assert.deepEqual([a.codigos, fin(a)], [[2], 'agente-revocado']);
  });

  test('A6 a second control socket with the same token replaces the agent: reemplazado, exit 3', async () => {
    const a = arrancar();
    await a.conectado();
    const otro = new WebSocket(`ws://127.0.0.1:${puertoMotor}/agente/control`, { headers: { authorization: `Bearer ${token}` } });
    otro.on('error', () => {});
    limpiezas.push(async () => otro.terminate());
    await hasta(() => a.codigos.length > 0);
    assert.deepEqual([a.codigos, fin(a), a.cuenta('reconexion-programada')], [[3], 'reemplazado', 0]);
  });

  test('A7 a listed but closed port fails with ECONNREFUSED and no data upgrade', async () => {
    const a = arrancar();
    await a.conectado();
    const antes = datos();
    assert.deepEqual(await probar('127.0.0.1', cerrado), ['fallo', 'host-inalcanzable', 'ECONNREFUSED']);
    assert.equal(datos() - antes, 0);
    assert.deepEqual(a.eventos().filter((e) => e.evento === 'sesion-fallida').map((e) => e.codigo), ['ECONNREFUSED']);
  });

  test('A8 a 1.5 MiB value crosses both ways intact, and SIGTERM closes the live session', async () => {
    const a = arrancar();
    await a.conectado();
    const canal = registro.canalPara({ agenteId, tenantId, host: objetivo.host, puerto: objetivo.port });
    const cliente = new pg.Client({ ...objetivo, stream: canal, ssl: false });
    let terminado = false;
    cliente.on('error', () => {}).on('end', () => (terminado = true));
    await cliente.connect();
    // Both ends set `maxPayload` to 1 MiB, so a larger value can only cross in several frames.
    const grande = 'x'.repeat(1.5 * LIMITE_TRAMA_DATOS);
    const { rows } = await cliente.query<{ v: string }>('SELECT $1::text AS v', [grande]);
    assert.ok(rows[0].v === grande, `got ${rows[0].v.length} characters`);
    a.proceso.emit('SIGTERM');
    await hasta(() => a.codigos.length > 0 && terminado, 6_000);
    assert.deepEqual(a.codigos, [0]);
  });

  test('S2 a probe through the spawned agent is ok', async () => {
    const r = lanzar({ AGENT_SERVER_URL: url, AGENT_TOKEN: token, AGENT_ALLOWED_TARGETS: permitidos });
    limpiezas.push(async () => (r.hijo.kill(), hasta(() => r.codigo !== undefined), lineas.push(...r.stdout.split('\n').filter(Boolean))));
    await hasta(() => r.stdout.includes('"control-conectado"'), 30_000);
    assert.deepEqual(await probar(objetivo.host, objetivo.port), ['ok', null, null]);
  });

  test('S3 a spawned agent with an unknown token exits 2', async () => {
    const r = lanzar({ AGENT_SERVER_URL: url, AGENT_TOKEN: generarTokenAgente(), AGENT_ALLOWED_TARGETS: permitidos });
    await hasta(() => r.codigo !== undefined, 30_000);
    lineas.push(...r.stdout.split('\n').filter(Boolean), ...r.stderr.split('\n').filter(Boolean));
    assert.equal(r.codigo, 2);
    assert.ok(r.stdout.includes('"evento":"fin","motivo":"credenciales-rechazadas","codigoSalida":2'), r.stdout);
  });

  test('A9 no agent line carries the token, the URL, a host:port or a sesionId, and every key is closed', () => {
    const texto = lineas.join('\n');
    assert.ok(ids.length >= 5 && ['sesion-abierta', 'destino-no-permitido', 'sesion-fallida'].every((e) => texto.includes(`"${e}"`)));
    const fugas = [token, url, url.slice('ws://'.length), `${objetivo.host}:${objetivo.port}`, `127.0.0.1:${cerrado}`, ...ids];
    for (const fuga of fugas) assert.ok(!texto.includes(fuga), 'a log line leaks a secret or an address');
    for (const linea of lineas) {
      const { ts, nivel, evento, ...resto } = JSON.parse(linea);
      assert.ok(typeof ts === 'string' && ['info', 'warn', 'error'].includes(nivel) && Object.hasOwn(CAMPOS, evento), linea);
      assert.deepEqual(Object.keys(resto).sort(), CAMPOS[evento as EventoLog['evento']], linea);
    }
  });
});
