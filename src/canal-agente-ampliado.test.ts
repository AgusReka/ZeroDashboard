import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import type { WebSocket } from 'ws';
import { LIMITE_TRAMA_DATOS } from './canal-agente.js';
import { SIN_DIAL, TECHO_MS, cerrarServidor, objetivo, par, puerto, techo } from './canal-agente-apoyo.js';
import { ejecutarConsulta } from './consulta-ejecucion.js';
import { cerrarCliente, iniciarConexion } from './db-probe.js';
import { prepararSentencia } from './parametros.js';

/**
 * CH-19c1, cases A6-A10 (unit 2): the live-PostgreSQL cases, 1 MiB slicing, far-side
 * close, `end()` while connecting, and the text-frame close. Shared fixtures are in
 * `canal-agente-apoyo.ts`; `agente` is the far side, `motor` the engine's socket.
 */
after(cerrarServidor);

/** The far side as the agent will be: a byte relay to the test PostgreSQL. */
function relevar(agente: WebSocket): void {
  const destino = net.connect({ host: objetivo.host, port: objetivo.port });
  agente.on('message', (datos) => destino.write(datos as Buffer));
  destino.on('data', (trozo) => agente.send(trozo));
  destino.on('error', () => {});
  destino.on('close', () => agente.close());
  agente.on('close', () => destino.destroy());
}

/** Answers each session request with a fresh relaying pair, as registry and agent will. */
const conRelevo = (alAdjuntar: (motor: WebSocket) => void = () => {}) =>
  puerto((canal) => void par().then(({ motor, agente }) => (relevar(agente), alAdjuntar(motor), canal.adjuntar(motor))));

describe('CanalAgente without PostgreSQL (CH-19c1, A7-A10)', () => {
  test('A7 a write over 1 MiB goes out in slices and completes only after the send callback', async () => {
    const canal = puerto().abrir();
    const { motor, agente } = await par();
    const orden: string[] = [];
    const enviar = motor.send.bind(motor);
    motor.send = ((datos: Buffer, op: { binary?: boolean }, cb?: (error?: Error) => void) =>
      enviar(datos, op, (error?: Error) => (orden.push('send'), cb?.(error)))) as WebSocket['send'];
    const tramas: number[] = [];
    agente.on('message', (datos: Buffer) => tramas.push(datos.length));
    canal.adjuntar(motor);
    await new Promise<void>((listo) => canal.write(Buffer.alloc(2 * LIMITE_TRAMA_DATOS + 1), () => (orden.push('write'), listo())));
    assert.deepEqual(orden, ['send', 'send', 'send', 'write']);
    while (tramas.length < 3) await Promise.race([new Promise((r) => setTimeout(r, 10)), techo(TECHO_MS)]);
    assert.deepEqual(tramas, [LIMITE_TRAMA_DATOS, LIMITE_TRAMA_DATOS, 1]);
    canal.destroy();
    agente.terminate();
  });

  test('A8 the far side closing reaches close, and the process survives', async () => {
    const canal = puerto().abrir();
    const { motor, agente } = await par();
    canal.adjuntar(motor);
    const cerrado = once(canal, 'close');
    agente.terminate();
    await Promise.race([cerrado, techo(TECHO_MS)]);
    assert.equal(canal.destroyed, true);
  });

  test('A9 end() while connecting reaches close and releases the session', async () => {
    const { abrir, soltados } = puerto();
    const canal = abrir();
    canal.on('data', () => {}); // flowing, as pg reads it
    canal.connect();
    const cerrado = once(canal, 'close');
    canal.end();
    await Promise.race([cerrado, techo(TECHO_MS)]);
    assert.deepEqual(soltados, [canal]);
  });

  test('A10 a text frame destroys the channel and closes the socket with 1003', async () => {
    const canal = puerto().abrir();
    const { motor, agente } = await par();
    canal.adjuntar(motor);
    const cierres = Promise.all([once(agente, 'close'), once(canal, 'close')]);
    agente.send('texto');
    const [[codigo]] = await Promise.race([cierres, techo(TECHO_MS)]);
    assert.equal(codigo, 1003);
  });
});

const alcanzable = await new Promise<boolean>((resolve) => {
  const socket = net.connect({ host: objetivo.host, port: objetivo.port });
  const cerrar = (valor: boolean): void => void (socket.destroy(), resolve(valor));
  socket.setTimeout(1000);
  socket.once('connect', () => cerrar(true));
  socket.once('timeout', () => cerrar(false));
  socket.once('error', () => cerrar(false));
});
const motivoSkip = alcanzable ? false : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;
const LECTOR = { user: 'ch19c1_lector', password: 'clave-lector-ch19c1' };

describe('CanalAgente against a live PostgreSQL (CH-19c1, A6-A7)', { skip: motivoSkip }, () => {
  let admin!: pg.Client;

  before(async () => {
    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(`DROP ROLE IF EXISTS ${LECTOR.user}`);
    await admin.query(`CREATE ROLE ${LECTOR.user} LOGIN PASSWORD '${LECTOR.password}'`);
  });

  after(async () => {
    await admin.query(`DROP ROLE IF EXISTS ${LECTOR.user}`);
    await admin.end();
  });

  test('A6 over a real ws pair SSL stays off, SELECT 1 runs, and the engine serves its page', async () => {
    const { abrir, abiertos } = conRelevo();
    const anterior = process.env.PGSSLMODE;
    process.env.PGSSLMODE = 'require';
    let conexion: ReturnType<typeof iniciarConexion>;
    try {
      conexion = iniciarConexion({ ...SIN_DIAL, ...LECTOR, database: objetivo.database, canal: abrir }, TECHO_MS);
    } finally {
      if (anterior === undefined) delete process.env.PGSSLMODE;
      else process.env.PGSSLMODE = anterior;
    }
    await conexion.conectado;
    conexion.cancelarTemporizador();
    assert.deepEqual([conexion.cliente.ssl, conexion.cliente.connection.stream === abiertos[0]], [false, true]);
    assert.deepEqual((await conexion.cliente.query('SELECT 1 AS uno')).rows, [{ uno: 1 }]);
    await cerrarCliente(conexion.cliente, true);

    const preparada = prepararSentencia("SELECT * FROM (VALUES (1, 'Café'), (2, 'Té'), (3, 'Mate')) AS t(id, nombre)", undefined, undefined);
    assert.ok(preparada.ok);
    const ejecucion = await ejecutarConsulta({
      ...SIN_DIAL, ...LECTOR, database: objetivo.database, canal: abrir, sentencia: preparada.valor, limite: 2, desplazamiento: 0,
    });
    assert.ok(ejecucion.resultado === 'ok', JSON.stringify(ejecucion));
    assert.deepEqual([ejecucion.filas, ejecucion.paginacion.hayMas, abiertos.length], [[[1, 'Café'], [2, 'Té']], true, 2]);
  });

  test('A7 a slow consumer pauses the data socket and still gets the whole result', async () => {
    let pausado = false;
    const { abrir, abiertos } = conRelevo((motor) => {
      const pausar = motor.pause.bind(motor);
      motor.pause = () => ((pausado = true), pausar());
    });
    const { cliente, conectado, cancelarTemporizador } = iniciarConexion({ ...objetivo, host: SIN_DIAL.host, port: SIN_DIAL.port, canal: abrir }, TECHO_MS);
    await conectado;
    cancelarTemporizador();
    // One stall on the first chunk: the rest of the result piles up behind it.
    abiertos[0].once('data', () => (abiertos[0].pause(), setTimeout(() => abiertos[0].resume(), 50)));
    const { rows } = await cliente.query<{ r: string }>("SELECT repeat('x', 1000000) AS r FROM generate_series(1, 8)");
    assert.deepEqual([pausado, rows.length, rows.every(({ r }) => r.length === 1_000_000)], [true, 8, true]);
    await cerrarCliente(cliente, true);
  });
});
