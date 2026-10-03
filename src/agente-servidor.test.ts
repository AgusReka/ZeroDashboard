import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify from 'fastify';
import { WebSocket } from 'ws';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { registrarServidorAgentes } from './agente-servidor.js';
import { generarTokenAgente, hashTokenAgente } from './agente-token.js';
import type { CanalAgente } from './canal-agente.js';
import { registrarContextoTenant, tenantActivoOpcional } from './contexto-tenant.js';
import { crearRegistroAgentes } from './registro-agentes.js';

/**
 * CH-19c1 unit 3a, cases U1-U9: the agent upgrade listener on a real ephemeral port
 * (`app.inject` cannot upgrade), with a `ws` client as the agent. The token lookup is a
 * fake keyed by hash; like the real one it returns `null` for an unknown or a revoked
 * token (its `revocadoEn` filter is proven live in `aislamiento.test.ts`). Every token is
 * generated per run (rule 7).
 */
const token = {
  a: generarTokenAgente(),
  b: generarTokenAgente(),
  baja: generarTokenAgente(),
  revocado: generarTokenAgente(),
  roto: generarTokenAgente(),
};
const HOST_REPLICA = 'replica-oculta';

async function montar() {
  const lineas: string[] = [];
  const app = Fastify({ logger: { level: 'trace', stream: { write: (linea: string) => void lineas.push(linea) } } });
  const filas = new Map([
    [hashTokenAgente(token.a), { id: 'agente-a', tenantId: 'tenant-a', tenantActivo: true }],
    [hashTokenAgente(token.b), { id: 'agente-b', tenantId: 'tenant-b', tenantActivo: true }],
    [hashTokenAgente(token.baja), { id: 'agente-c', tenantId: 'tenant-c', tenantActivo: false }],
  ]);
  const consulta = { espera: Promise.resolve(), llamadas: 0, conTenant: false };
  const prisma = {
    agente: {
      async buscarPorTokenHash(hash: string) {
        consulta.llamadas++;
        consulta.conTenant ||= tenantActivoOpcional() !== null;
        await consulta.espera;
        if (hash === hashTokenAgente(token.roto)) throw new Error('base caida');
        return filas.get(hash) ?? null;
      },
    },
  };
  const estado = { detenido: false, sesiones: [] as string[] };
  // Stands in for the scheduler's `detener`, registered first as in `server.ts`.
  app.addHook('onClose', async () => {
    estado.detenido = true;
  });
  // A request with no `X-Tenant-Id` is refused before any read, so the fake is enough here.
  registrarContextoTenant(app, prisma as unknown as PrismaAislado);
  const registro = crearRegistroAgentes();
  registrarServidorAgentes({ app, prisma, registro });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const puerto = (app.server.address() as net.AddressInfo).port;
  return { app, registro, lineas, consulta, estado, puerto };
}
type Banco = Awaited<ReturnType<typeof montar>>;

const espera = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const cierre = (ws: WebSocket): Promise<number> => new Promise((resolve) => ws.once('close', resolve));

function abrir(b: Banco, ruta: string, tk: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${b.puerto}${ruta}`, { headers: { authorization: `Bearer ${tk}` } });
  ws.on('error', () => {});
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('unexpected-response', () => reject(new Error(`upgrade refused: ${ruta}`)));
  });
}

/** Asks agent A for one session through the registry; resolves once the control socket hears it. */
async function sesion(b: Banco, control: WebSocket) {
  const canal = b.registro.canalPara({ agenteId: 'agente-a', tenantId: 'tenant-a', host: HOST_REPLICA, puerto: 5432 })() as CanalAgente;
  canal.on('error', () => {});
  const apertura = new Promise<{ sesionId: string }>((resolve) => control.once('message', (d) => resolve(JSON.parse(String(d)))));
  canal.connect();
  const { sesionId } = await apertura;
  b.estado.sesiones.push(sesionId);
  return { canal, sesionId };
}

const peticion = (ruta: string, cabeceras: Record<string, string>): string =>
  `GET ${ruta} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n` +
  'Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
  Object.entries(cabeceras).map(([nombre, valor]) => `${nombre}: ${valor}\r\n`).join('') + '\r\n';

/** A raw upgrade request; resolves with every byte the server answered before closing. */
function crudo(b: Banco, ruta: string, cabeceras: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let respuesta = '';
    const socket = net.connect(b.puerto, '127.0.0.1', () => socket.write(peticion(ruta, cabeceras)));
    socket.setEncoding('utf8');
    socket.on('data', (trozo: string) => (respuesta += trozo));
    socket.once('close', () => resolve(respuesta));
    socket.once('error', reject);
  });
}
const portador = (tk: string): Record<string, string> => ({ authorization: `Bearer ${tk}` });

describe('agent upgrade listener — auth, refusals, framing (CH-19c1 U1-U8)', () => {
  let b!: Banco;
  before(async () => {
    b = await montar();
  });
  after(() => b.app.close());

  test('U1 missing, malformed, unknown or revoked tokens get one identical 401; query and subprotocol are never read', async () => {
    const antes = b.consulta.llamadas;
    const respuestas = await Promise.all([
      crudo(b, '/agente/control'),
      crudo(b, '/agente/control', { authorization: `Basic ${token.a}` }),
      crudo(b, '/agente/control', portador(`${token.a}x`)),
      crudo(b, '/agente/control', portador(generarTokenAgente())),
      crudo(b, '/agente/control', portador(token.revocado)),
      crudo(b, `/agente/control?token=${token.a}`),
      crudo(b, '/agente/control', { 'sec-websocket-protocol': token.a }),
      crudo(b, `/agente/datos/${'x'.repeat(22)}`),
    ]);
    assert.match(respuestas[0], /^HTTP\/1\.1 401 Unauthorized\r\n/);
    for (const respuesta of respuestas) assert.equal(respuesta, respuestas[0]);
    assert.equal(b.consulta.llamadas - antes, 2, 'only the two well-formed tokens reach the lookup');
  });

  test('U2 a deactivated tenant gets 403 and a failing lookup 500, both before 101', async () => {
    assert.match(await crudo(b, '/agente/control', portador(token.baja)), /^HTTP\/1\.1 403 Forbidden\r\n/);
    assert.match(await crudo(b, '/agente/datos/x', portador(token.roto)), /^HTTP\/1\.1 500 Internal Server Error\r\n/);
  });

  test('U3 unknown path, foreign, unknown, malformed and taken sessions get one identical 404; text on data closes 1003', async () => {
    const control = await abrir(b, '/agente/control', token.a);
    const { sesionId } = await sesion(b, control);
    const ajena = await crudo(b, `/agente/datos/${sesionId}`, portador(token.b));
    const datos = await abrir(b, `/agente/datos/${sesionId}`, token.a);
    const respuestas = [
      await crudo(b, `/agente/datos/${sesionId}`, portador(token.a)),
      await crudo(b, `/agente/datos/${'A'.repeat(22)}`, portador(token.a)),
      await crudo(b, '/agente/datos/corto', portador(token.a)),
      await crudo(b, '/agente/otra', portador(token.a)),
      await crudo(b, '/otra'),
    ];
    assert.match(ajena, /^HTTP\/1\.1 404 Not Found\r\n/);
    for (const respuesta of respuestas) assert.equal(respuesta, ajena);
    const cerrado = cierre(datos);
    datos.send('texto');
    assert.equal(await cerrado, 1003);
    control.close();
  });

  test('U4 a socket reset during a slow lookup does not crash the server', async () => {
    let soltar!: () => void;
    b.consulta.espera = new Promise((resolve) => (soltar = resolve));
    const antes = b.consulta.llamadas;
    const socket = net.connect(b.puerto, '127.0.0.1', () => socket.write(peticion('/agente/control', portador(token.a))));
    socket.on('error', () => {});
    while (b.consulta.llamadas === antes) await espera(5);
    socket.resetAndDestroy();
    await espera(50);
    soltar();
    b.consulta.espera = Promise.resolve();
    await espera(50);
    assert.match(await crudo(b, '/agente/control'), /^HTTP\/1\.1 401 /);
  });

  test('U5 on control: binary closes 1003; bad JSON, extra keys or unknown messages close 1008; oversize closes 1009', async () => {
    const casos: [string | Buffer, number][] = [
      [Buffer.from('{"tipo":"latido"}'), 1003],
      ['{no-json', 1008],
      ['{"tipo":"latido","extra":1}', 1008],
      ['{"tipo":"apertura-sesion","sesionId":"x","host":"h","puerto":1}', 1008],
      ['{"tipo":"sesion-fallida","sesionId":1,"codigo":"ECONNREFUSED"}', 1008],
      ['x'.repeat(4097), 1009],
    ];
    for (const [trama, codigo] of casos) {
      const ws = await abrir(b, '/agente/control', token.a);
      const cerrado = cierre(ws);
      ws.send(trama, { binary: Buffer.isBuffer(trama) });
      assert.equal(await cerrado, codigo, String(trama).slice(0, 40));
    }
  });

  test('U6 latido keeps control open; sesion-fallida destroys the pending channel with its code before connect', async () => {
    const control = await abrir(b, '/agente/control', token.a);
    const { canal, sesionId } = await sesion(b, control);
    const fallo = new Promise<NodeJS.ErrnoException>((resolve) => canal.once('error', resolve));
    let conectado = false;
    canal.once('connect', () => (conectado = true));
    control.send('{"tipo":"latido"}');
    control.send(JSON.stringify({ tipo: 'sesion-fallida', sesionId, codigo: 'ECONNREFUSED' }));
    assert.equal((await fallo).code, 'ECONNREFUSED');
    assert.equal(conectado, false);
    assert.equal(control.readyState, WebSocket.OPEN);
    control.close();
  });

  test('U7 a non-upgrade GET /agente/control falls to Fastify: 400 tenant-no-indicado', async () => {
    const respuesta = await fetch(`http://127.0.0.1:${b.puerto}/agente/control`);
    assert.equal(respuesta.status, 400);
    assert.deepEqual(await respuesta.json(), { error: 'tenant-no-indicado' });
  });

  test('U8 the lookup runs outside any tenant context and no log line carries a secret or an identifier', () => {
    assert.equal(b.consulta.conTenant, false);
    const log = b.lineas.join('');
    assert.match(log, /agent upgrade refused/);
    const tokens = Object.values(token);
    const prohibidos = [...tokens, ...tokens.map(hashTokenAgente), 'tenant-a', 'tenant-b', 'tenant-c', HOST_REPLICA, ...b.estado.sesiones];
    for (const prohibido of prohibidos) assert.equal(log.includes(prohibido), false, `log leaks ${prohibido.slice(0, 6)}…`);
  });
});

describe('agent upgrade listener — shutdown (CH-19c1 U9)', () => {
  test('U9 app.close() with live control and data sockets resolves under 2500 ms and detener still runs', { timeout: 8000 }, async () => {
    const b = await montar();
    const control = await abrir(b, '/agente/control', token.a);
    const { canal, sesionId } = await sesion(b, control);
    const conectado = new Promise((resolve) => canal.once('connect', resolve));
    const datos = await abrir(b, `/agente/datos/${sesionId}`, token.a);
    await conectado;
    const inicio = Date.now();
    try {
      await Promise.race([
        b.app.close(),
        espera(2500).then(() => Promise.reject(new Error('app.close() did not resolve within 2500 ms'))),
      ]);
    } finally {
      control.terminate();
      datos.terminate();
    }
    assert.ok(Date.now() - inicio < 2500);
    assert.equal(b.estado.detenido, true);
    assert.equal(b.registro.cerrando, true);
  });
});
