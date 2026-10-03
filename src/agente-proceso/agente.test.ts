import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, Socket, type AddressInfo } from 'node:net';
import { afterEach, describe, test } from 'node:test';
import { WebSocket, WebSocketServer, type ClientOptions } from 'ws';
import { iniciarAgente, type DependenciasAgente, type MotivoFin } from './agente.js';
import { ErrorConfig } from './config.js';
import { leerDestinos } from './destinos.js';
import { LIMITES_AGENTE } from './limites.js';
import type { EventoLog } from './log.js';
import { opcionesSocket } from './politica-tls.js';
import type { Programar } from './puente.js';

/** CH-19c2, cases K1-K10: the control loop against a fake engine, with real sockets and fake timers. */
const TOKEN = 'zda_' + 'a'.repeat(43);
const apertura = (sesionId: string, host = '127.0.0.1') => JSON.stringify({ tipo: 'apertura-sesion', sesionId, host, puerto: 5432 });
const limpiezas: (() => void)[] = [];
afterEach(() => limpiezas.splice(0).forEach((limpiar) => limpiar()));

/** Polls `condicion`; bounded, so a regression fails here instead of hanging the suite. */
const hasta = async (condicion: () => boolean): Promise<void> => {
  for (const limite = Date.now() + 5_000; !condicion(); await new Promise((listo) => setTimeout(listo, 5))) {
    if (Date.now() > limite) throw new Error('condition not reached within 5 s');
  }
};

/** A fake engine: `estado` refuses the control upgrade with a status; data upgrades get 404. */
async function motor(conducta: { estado?: number; alConectar?: (ws: WebSocket, n: number) => void } = {}) {
  let intentos = 0;
  let conexiones = 0;
  const cierres: number[] = [];
  const recibidos: string[] = [];
  const servidor = new WebSocketServer({
    port: 0,
    host: '127.0.0.1',
    verifyClient: (info, listo) => {
      if (info.req.url !== '/agente/control') return listo(false, 404);
      intentos++;
      return conducta.estado ? listo(false, conducta.estado) : listo(true);
    },
  });
  servidor.on('connection', (ws) => {
    ws.on('close', (codigo) => cierres.push(codigo));
    ws.on('message', (trama) => recibidos.push(String(trama)));
    conducta.alConectar?.(ws, conexiones++);
  });
  await once(servidor, 'listening');
  limpiezas.push(() => (servidor.clients.forEach((ws) => ws.terminate()), servidor.close()));
  return { puerto: (servidor.address() as AddressInfo).port, intentos: () => intentos, cierres, recibidos };
}

function agente(puerto: number, extra: Partial<DependenciasAgente> = {}) {
  const log: EventoLog[] = [];
  const pendientes: { ms: number; fn: () => void; vivo: boolean }[] = [];
  const programar: Programar = (ms, fn) => {
    const pendiente = { ms, fn, vivo: true };
    pendientes.push(pendiente);
    return () => void (pendiente.vivo = false);
  };
  /** Fires each live timer of `ms` once. */
  const disparar = (ms: number) => pendientes.filter((p) => p.vivo && p.ms === ms).forEach((p) => ((p.vivo = false), p.fn()));
  const a = iniciarAgente({
    config: { servidor: new URL(`ws://127.0.0.1:${puerto}`), token: TOKEN, destinos: leerDestinos('127.0.0.1:5432') },
    log: (e) => log.push(e),
    programar,
    aleatorio: () => 0,
    ...extra,
  });
  limpiezas.unshift(() => a.detener());
  const eventos = <E extends EventoLog['evento']>(evento: E) =>
    log.filter((e): e is Extract<EventoLog, { evento: E }> => e.evento === evento);
  /** Waits for the n-th scheduled reconnect, then fires it. */
  const reconectar = async (n: number) => {
    await hasta(() => eventos('reconexion-programada').length >= n);
    disparar(eventos('reconexion-programada')[n - 1].esperaMs);
  };
  const vivos = () => pendientes.filter((p) => p.vivo);
  return { terminado: a.terminado, detener: a.detener, log, pendientes, vivos, disparar, eventos, reconectar };
}

// Also bounds a `terminado` that never resolves.
describe('iniciarAgente (CH-19c2, K1-K10)', { timeout: 30_000 }, () => {
  test('K1 401 and 403 on the upgrade end with credenciales-rechazadas and never redial', async () => {
    for (const estado of [401, 403]) {
      const m = await motor({ estado });
      const a = agente(m.puerto);
      assert.equal(await a.terminado, 'credenciales-rechazadas');
      assert.deepEqual(a.log, [{ evento: 'control-rechazado', estado }, { evento: 'control-cerrado', codigoCierre: 1006 }]);
      assert.deepEqual([m.intentos(), a.vivos().length], [1, 0]);
    }
  });

  test('K2 404, 500 and a refused port retry; detener cancels the pending redial', async () => {
    for (const estado of [404, 500]) {
      const m = await motor({ estado });
      const a = agente(m.puerto);
      await a.reconectar(1);
      await hasta(() => m.intentos() === 2);
      assert.deepEqual(a.eventos('control-rechazado')[0], { evento: 'control-rechazado', estado });
    }
    const cerrado = createServer().listen(0, '127.0.0.1');
    await once(cerrado, 'listening');
    const puerto = (cerrado.address() as AddressInfo).port;
    await new Promise((listo) => cerrado.close(listo));
    const a = agente(puerto);
    await hasta(() => a.eventos('reconexion-programada').length === 1);
    assert.deepEqual(a.log, [
      { evento: 'control-cerrado', codigoCierre: 1006 },
      { evento: 'reconexion-programada', intento: 1, esperaMs: 1_000 },
    ]);
    a.detener();
    assert.deepEqual([await a.terminado, a.vivos().length], ['detenido', 0]);
  });

  test('K3 close 4002 and 4001 are terminal and the first motive wins; 1006 and 1000 retry', async () => {
    const casos: [(ws: WebSocket) => void, MotivoFin | null][] = [
      [(ws) => ws.close(4002), 'agente-revocado'],
      [(ws) => ws.close(4001), 'reemplazado'],
      [(ws) => ws.terminate(), null],
      [(ws) => ws.close(1000), null],
    ];
    for (const [cerrar, motivo] of casos) {
      const m = await motor({ alConectar: (ws, n) => n === 0 && setTimeout(() => cerrar(ws), 20) });
      const a = agente(m.puerto);
      if (motivo === null) {
        await a.reconectar(1);
        await hasta(() => a.eventos('control-conectado').length === 2);
        continue;
      }
      assert.equal(await a.terminado, motivo);
      a.detener();
      assert.equal(await a.terminado, motivo);
      assert.deepEqual([m.intentos(), a.eventos('reconexion-programada').length], [1, 0]);
    }
  });

  test('K5 the loop waits 1, 2, 4, 8 s with aleatorio at 0', async () => {
    const m = await motor({ estado: 500 });
    const a = agente(m.puerto);
    for (let n = 1; n <= 3; n++) await a.reconectar(n);
    await hasta(() => a.eventos('reconexion-programada').length === 4);
    assert.deepEqual(a.eventos('reconexion-programada').map((e) => [e.intento, e.esperaMs]), [[1, 1_000], [2, 2_000], [3, 4_000], [4, 8_000]]);
    assert.equal(m.intentos(), 4);
  });

  test('K6 the counter resets after 30 s open, and not after a shorter stay', async () => {
    const sockets: WebSocket[] = [];
    const m = await motor({ alConectar: (ws) => sockets.push(ws) });
    const a = agente(m.puerto);
    const caer = async (n: number, estable: boolean) => {
      await hasta(() => a.eventos('control-conectado').length === n);
      if (estable) a.disparar(LIMITES_AGENTE.controlEstableMs);
      sockets[n - 1].terminate();
      await hasta(() => a.eventos('reconexion-programada').length === n);
    };
    await caer(1, false);
    await a.reconectar(1);
    await caer(2, false);
    await a.reconectar(2);
    await caer(3, true);
    assert.deepEqual(a.eventos('reconexion-programada').map((e) => e.esperaMs), [1_000, 2_000, 1_000]);
    assert.equal(m.intentos(), 3);
  });

  test('K7 a ping re-arms the 50 s watchdog; silence gives sin-ping and a redial', async () => {
    const sockets: WebSocket[] = [];
    const m = await motor({ alConectar: (ws) => sockets.push(ws) });
    const a = agente(m.puerto);
    const vigilancias = () => a.pendientes.filter((p) => p.ms === LIMITES_AGENTE.vigilanciaPingMs);
    await hasta(() => vigilancias().length === 1);
    sockets[0].ping();
    await hasta(() => vigilancias().length === 2);
    assert.deepEqual(vigilancias().map((p) => p.vivo), [false, true]);
    a.disparar(LIMITES_AGENTE.vigilanciaPingMs);
    await hasta(() => a.eventos('reconexion-programada').length === 1);
    const eventos = a.log.map((e) => e.evento);
    assert.deepEqual(eventos, ['control-conectado', 'sin-ping', 'control-cerrado', 'reconexion-programada']);
    await a.reconectar(1);
    await hasta(() => m.intentos() === 2);
  });

  test('K8 binary closes with 1003; non-JSON, extra keys, unknown tipo and null close with 1008', async () => {
    const id = 'A'.repeat(22);
    const tramas = [Buffer.from(apertura(id)), 'no json', apertura(id).replace('{', '{"extra":1,'), '{"tipo":"latido"}', 'null'];
    const m = await motor({ alConectar: (ws, n) => ws.send(tramas[n]) });
    const a = agente(m.puerto);
    for (let n = 1; n < tramas.length; n++) await a.reconectar(n);
    await hasta(() => m.cierres.length === tramas.length);
    assert.deepEqual(m.cierres, [1003, 1008, 1008, 1008, 1008]);
    assert.equal(a.eventos('mensaje-invalido').length, 4);
  });

  test('K9 a malformed sesionId is ignored: mensaje-invalido, nothing reported, the socket stays open', async () => {
    const m = await motor({
      alConectar: (ws) => (ws.send(apertura('A'.repeat(21))), ws.send(apertura('B'.repeat(22), '10.9.9.9'))),
    });
    const a = agente(m.puerto);
    await hasta(() => m.recibidos.length === 1);
    assert.deepEqual(JSON.parse(m.recibidos[0]), { tipo: 'sesion-fallida', sesionId: 'B'.repeat(22), codigo: 'ECONNREFUSED' });
    assert.deepEqual(a.log.map((e) => e.evento), ['control-conectado', 'mensaje-invalido', 'destino-no-permitido']);
    assert.deepEqual(m.cierres, []);
  });

  test('K10 abrirSocket gets the control and data options, and the URL is checked before any socket', async () => {
    const m = await motor({ alConectar: (ws) => ws.send(apertura('C'.repeat(22))) });
    const llamadas: [string, ClientOptions][] = [];
    const replica = new Socket();
    agente(m.puerto, {
      abrirSocket: (url, op) => (llamadas.push([url.pathname, op]), new WebSocket(url, op)),
      abrirReplica: () => (process.nextTick(() => replica.emit('connect')), replica),
    });
    await hasta(() => llamadas.length === 2 && replica.destroyed);
    assert.deepEqual(llamadas, [
      ['/agente/control', opcionesSocket(TOKEN, 4096)],
      [`/agente/datos/${'C'.repeat(22)}`, opcionesSocket(TOKEN, 1 << 20)],
    ]);
    assert.deepEqual(llamadas.map(([, op]) => [op.perMessageDeflate, op.rejectUnauthorized]), [[false, true], [false, true]]);
    const servidor = new URL('ws://10.0.0.1');
    assert.throws(() => agente(1, { config: { servidor, token: TOKEN, destinos: leerDestinos('a.b:1') }, abrirSocket: () => assert.fail('dialed') }), ErrorConfig);
  });

  test('K10 detener closes control with 1001, never redials, and is idempotent', async () => {
    const m = await motor();
    const a = agente(m.puerto);
    await hasta(() => a.eventos('control-conectado').length === 1);
    a.detener();
    a.detener();
    assert.equal(await a.terminado, 'detenido');
    await hasta(() => m.cierres.length === 1 && a.vivos().length === 0);
    assert.deepEqual([m.cierres, m.intentos(), a.eventos('reconexion-programada').length], [[1001], 1, 0]);
  });
});
