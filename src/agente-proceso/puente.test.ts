import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { connect, createServer, Socket, type AddressInfo } from 'node:net';
import { afterEach, describe, test } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import type { CodigoErrorAgente } from '../agente-protocolo.js';
import type { Destino } from './destinos.js';
import { LIMITES_AGENTE } from './limites.js';
import type { EventoLog } from './log.js';
import { abrirPuente, codigoDeError, type Programar } from './puente.js';

/** CH-19c2, cases B1-B9: one session's byte bridge, against a local replica and engine. */
const MIB = LIMITES_AGENTE.tramaDatos;
const limpiezas: (() => void)[] = [];
afterEach(() => limpiezas.splice(0).forEach((limpiar) => limpiar()));

const hasta = async (condicion: () => boolean): Promise<void> => {
  while (!condicion()) await new Promise((listo) => setTimeout(listo, 5));
};

/** A fake timer: nothing fires until the test calls `disparar`. */
function reloj() {
  const pendientes: { ms: number; fn: () => void; vivo: boolean }[] = [];
  const programar: Programar = (ms, fn) => {
    const pendiente = { ms, fn, vivo: true };
    pendientes.push(pendiente);
    return () => void (pendiente.vivo = false);
  };
  const disparar = (ms: number) => pendientes.filter((p) => p.vivo && p.ms === ms).forEach((p) => p.fn());
  return { programar, pendientes, disparar };
}

/** Spies a method by name, counting its calls. */
function contar<T extends object>(objeto: T, metodo: 'pause' | 'resume', cuenta: Record<string, number>, clave: string): T {
  const original = (objeto as Record<string, () => unknown>)[metodo].bind(objeto);
  (objeto as Record<string, () => unknown>)[metodo] = () => ((cuenta[clave] = (cuenta[clave] ?? 0) + 1), original());
  return objeto;
}

async function escenario(opciones: { rechazarDatos?: boolean; abrirReplica?: (d: Destino) => Socket } = {}) {
  const servidorReplica = createServer().listen(0, '127.0.0.1');
  const motor = new WebSocketServer({
    port: 0, host: '127.0.0.1', maxPayload: MIB, perMessageDeflate: false, verifyClient: () => !opciones.rechazarDatos,
  });
  await Promise.all([once(servidorReplica, 'listening'), once(motor, 'listening')]);
  const ladoReplica = once(servidorReplica, 'connection').then(([s]) => s as Socket);
  const ladoMotor = once(motor, 'connection').then(([w]) => w as WebSocket);
  const puertoReplica = (servidorReplica.address() as AddressInfo).port;
  const log: EventoLog[] = [];
  const informados: CodigoErrorAgente[] = [];
  const cuenta: Record<string, number> = {};
  const r = reloj();
  const puente = abrirPuente({
    destino: { host: '127.0.0.1', puerto: puertoReplica },
    sesionId: 'A'.repeat(22),
    abrirReplica: opciones.abrirReplica ?? ((d) => contar(connect({ host: d.host, port: d.puerto }), 'pause', cuenta, 'replica')),
    abrirDatos: (id) => {
      cuenta.diales = (cuenta.diales ?? 0) + 1;
      const ws = new WebSocket(`ws://127.0.0.1:${(motor.address() as AddressInfo).port}/agente/datos/${id}`, { maxPayload: MIB });
      return contar(contar(ws, 'pause', cuenta, 'datos'), 'resume', cuenta, 'datosReanudado');
    },
    programar: r.programar,
    log: (e) => log.push(e),
    informar: (codigo) => informados.push(codigo),
  });
  limpiezas.push(() => {
    puente.cerrar('inmediato');
    motor.clients.forEach((ws) => ws.terminate());
    motor.close();
    servidorReplica.close();
  });
  const conectado = async () => {
    const [replica, ws] = await Promise.all([ladoReplica, ladoMotor]);
    await hasta(() => log.some((e) => e.evento === 'sesion-abierta'));
    return { replica, motor: ws };
  };
  return { puente, ladoReplica, conectado, log, informados, cuenta, reloj: r, puertoReplica };
}

describe('abrirPuente (CH-19c2, B1-B9)', { timeout: 20_000 }, () => {
  test('B1 relays bytes both ways as binary frames', async () => {
    const e = await escenario();
    const { replica, motor } = await e.conectado();
    motor.send(Buffer.from('hacia-replica'));
    assert.equal(String((await once(replica, 'data'))[0]), 'hacia-replica');
    replica.write('hacia-motor');
    const [trama, binaria] = await once(motor, 'message');
    assert.deepEqual([String(trama), binaria], ['hacia-motor', true]);
    assert.deepEqual(e.log, [{ evento: 'sesion-abierta' }]);
  });

  test('B2 pauses each producer until its slow consumer drains; the payload is intact', async () => {
    const e = await escenario();
    const { replica, motor } = await e.conectado();
    const carga = randomBytes(4 * MIB);
    // Engine to replica, with the replica not reading.
    replica.pause();
    for (let i = 0; i < carga.length; i += MIB) motor.send(carga.subarray(i, i + MIB));
    await hasta(() => (e.cuenta.datos ?? 0) > 0);
    const partes: Buffer[] = [];
    replica.on('data', (b: Buffer) => partes.push(b));
    replica.resume();
    await hasta(() => Buffer.concat(partes).length >= carga.length);
    assert.ok(Buffer.concat(partes).equals(carga));
    assert.ok((e.cuenta.datosReanudado ?? 0) > 0);
    // Replica to engine, with the engine not reading.
    motor.pause();
    replica.write(carga);
    await hasta(() => (e.cuenta.replica ?? 0) > 0);
    const tramas: Buffer[] = [];
    motor.on('message', (trama, binaria) => {
      assert.ok(binaria && (trama as Buffer).length <= MIB);
      tramas.push(trama as Buffer);
    });
    motor.resume();
    await hasta(() => Buffer.concat(tramas).length >= carga.length);
    assert.ok(Buffer.concat(tramas).equals(carga));
  });

  test('B3 a text frame closes the data socket with 1003 and destroys the replica', async () => {
    const e = await escenario();
    const { replica, motor } = await e.conectado();
    const replicaCerrada = once(replica, 'close');
    motor.send('texto');
    assert.equal((await once(motor, 'close'))[0], 1003);
    await replicaCerrada;
    await e.puente.cerrada;
  });

  test('B4 a close on either side reaches the other', async () => {
    const a = await escenario();
    const ladoA = await a.conectado();
    ladoA.replica.destroy();
    await once(ladoA.motor, 'close');
    await a.puente.cerrada;
    assert.deepEqual(a.log, [{ evento: 'sesion-abierta' }, { evento: 'sesion-cerrada' }]);
    const b = await escenario();
    const ladoB = await b.conectado();
    ladoB.motor.close(1000);
    await once(ladoB.replica, 'close');
    await b.puente.cerrada;
  });

  test('B5 a replica that does not connect in 10 s fails with ETIMEDOUT and no data dial', async () => {
    const sinConectar = new Socket();
    const e = await escenario({ abrirReplica: () => sinConectar });
    assert.deepEqual(e.reloj.pendientes.map((p) => p.ms), [LIMITES_AGENTE.replicaMs]);
    e.reloj.disparar(LIMITES_AGENTE.replicaMs);
    await e.puente.cerrada;
    assert.ok(sinConectar.destroyed);
    assert.deepEqual(e.informados, ['ETIMEDOUT']);
    assert.deepEqual(e.log, [{ evento: 'sesion-fallida', codigo: 'ETIMEDOUT' }]);
    assert.equal(e.cuenta.diales, undefined);
  });

  test('B6 codes outside the closed seven report EHOSTUNREACH', async () => {
    const siete = ['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'];
    for (const code of siete) assert.equal(codigoDeError(Object.assign(new Error(), { code })), code);
    const ajenos = [{ code: 'EADDRNOTAVAIL' }, { code: 'EMFILE' }, { code: 'EPERM' }, { code: 'EAI_FAIL' }, { code: 7 }, new Error(), null, 'ECONNREFUSED'];
    for (const error of ajenos) assert.equal(codigoDeError(error), 'EHOSTUNREACH');
    const fallida = new Socket();
    const e = await escenario({
      abrirReplica: () => (setImmediate(() => fallida.destroy(Object.assign(new Error('connect EMFILE 10.0.0.5:5432'), { code: 'EMFILE' }))), fallida),
    });
    await e.puente.cerrada;
    assert.deepEqual(e.informados, ['EHOSTUNREACH']);
    assert.deepEqual(e.log, [{ evento: 'sesion-fallida', codigo: 'EHOSTUNREACH' }]);
  });

  test('B7 dials the data channel only after the replica connects', async () => {
    const tardia = new Socket();
    const e = await escenario({ abrirReplica: () => tardia });
    await new Promise((listo) => setTimeout(listo, 20));
    assert.equal(e.cuenta.diales, undefined);
    tardia.connect(e.puertoReplica, '127.0.0.1');
    await e.conectado();
    assert.equal(e.cuenta.diales, 1);
    assert.equal(e.reloj.pendientes[0].vivo, false);
  });

  test('B8 a failed data dial destroys the replica and reports nothing', async () => {
    const e = await escenario({ rechazarDatos: true });
    await once(await e.ladoReplica, 'close');
    await e.puente.cerrada;
    assert.deepEqual([e.cuenta.diales, e.informados, e.log], [1, [], []]);
  });

  test('B9 a data socket with no engine ping for 50 s is terminated; a ping re-arms it', async () => {
    const e = await escenario();
    const { replica, motor } = await e.conectado();
    const vigilancias = () => e.reloj.pendientes.filter((p) => p.ms === LIMITES_AGENTE.vigilanciaPingMs).map((p) => p.vivo);
    assert.deepEqual(vigilancias(), [true]);
    motor.ping();
    await once(motor, 'pong');
    assert.deepEqual(vigilancias(), [false, true]);
    const cierres = Promise.all([once(motor, 'close'), once(replica, 'close')]);
    e.reloj.disparar(LIMITES_AGENTE.vigilanciaPingMs);
    await cierres;
    await e.puente.cerrada;
  });
});
