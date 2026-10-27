import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, test } from 'node:test';
import type { WebSocket } from 'ws';
import type { CanalAgente, SolicitudSesion } from './canal-agente.js';
import { CIERRE_REEMPLAZO, CIERRE_REVOCADO, LIMITES, crearRegistroAgentes, type RegistroAgentes } from './registro-agentes.js';

/** CH-19c1, cases R1-R6 plus attach and close rules: the in-memory registry, with fake sockets. */
class SocketFalso extends EventEmitter {
  enviados: string[] = [];
  cierres: number[] = [];
  fallarEnvio = false;
  isPaused = false;
  send(datos: string, listo?: (error?: Error) => void): void {
    this.enviados.push(datos);
    setImmediate(() => listo?.(this.fallarEnvio ? new Error('envio') : undefined));
  }
  close(codigo: number): void {
    this.cierres.push(codigo);
  }
  terminate(): void {
    this.cierres.push(1006);
  }
}
const ws = (s: SocketFalso): WebSocket => s as unknown as WebSocket;
const SOL: SolicitudSesion = { agenteId: 'agente-a', tenantId: 'tenant-a', host: 'replica', puerto: 5432 };
const AGENTE_A = { id: 'agente-a', tenantId: 'tenant-a' };
const tic = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function armar() {
  const relojes: { ms: number; fn: () => void; cancelado: boolean }[] = [];
  let n = 0;
  const registro = crearRegistroAgentes({
    programar: (ms, fn) => {
      const reloj = { ms, fn, cancelado: false };
      relojes.push(reloj);
      return () => void (reloj.cancelado = true);
    },
    generarId: () => `sesion-${++n}`,
  });
  const control = new SocketFalso();
  registro.registrarControl(AGENTE_A, ws(control));
  return { registro, relojes, control };
}

/** Opens one channel through the registry; `fallo` settles with its error, or null on a clean close. */
async function abrir(registro: RegistroAgentes, solicitud = SOL) {
  const canal = registro.canalPara(solicitud)() as CanalAgente;
  const fallo = new Promise<NodeJS.ErrnoException | null>((resolve) => {
    canal.on('error', resolve);
    canal.on('close', () => resolve(null));
  });
  canal.connect();
  await tic();
  return { canal, fallo };
}
/** Bounded, so a channel that never fails fails the case instead of hanging the run. */
const codigoDe = async (fallo: Promise<NodeJS.ErrnoException | null>) =>
  (await Promise.race([fallo, new Promise<never>((_, no) => setTimeout(no, 1000, new Error('no failure')).unref())]))?.code;

describe('RegistroAgentes (CH-19c1, R1-R6)', () => {
  test('R1 a new control socket closes the old with 4001, and the old close keeps the new entry', async () => {
    const { registro, control } = armar();
    const nuevo = new SocketFalso();
    registro.registrarControl(AGENTE_A, ws(nuevo));
    control.emit('close');
    await abrir(registro);
    assert.deepEqual([control.cierres, control.enviados.length, nuevo.enviados.length], [[CIERRE_REEMPLAZO], 0, 1]);
  });

  test('R2 a ninth session fails with ESINAGENTE', async () => {
    const { registro, control } = armar();
    for (let i = 0; i < LIMITES.sesionesPorAgente; i++) await abrir(registro);
    const { fallo } = await abrir(registro);
    assert.deepEqual([await codigoDe(fallo), control.enviados.length], ['ESINAGENTE', 8]);
  });

  test('R3 the pending TTL fails with ESINAGENTE and removes the session', async () => {
    const { registro, relojes } = armar();
    const { fallo } = await abrir(registro);
    assert.equal(relojes[0].ms, 30_000);
    relojes[0].fn();
    assert.deepEqual([await codigoDe(fallo), registro.reservarDatos('agente-a', 'sesion-1')], ['ESINAGENTE', false]);
  });

  test('R4 a failed apertura-sesion send fails with ESINAGENTE', async () => {
    const { registro, control } = armar();
    control.fallarEnvio = true;
    const { fallo } = await abrir(registro);
    assert.equal(await codigoDe(fallo), 'ESINAGENTE');
  });

  test('R5 sesion-fallida copies only the seven closed codes, from the owning agent only', async () => {
    const { registro } = armar();
    const a = await abrir(registro);
    const b = await abrir(registro);
    registro.sesionFallida('agente-b', 'sesion-1', 'ECONNREFUSED');
    assert.equal(a.canal.destroyed, false);
    registro.sesionFallida('agente-a', 'sesion-1', 'ECONNREFUSED');
    registro.sesionFallida('agente-a', 'sesion-2', 'EPROPIO');
    assert.deepEqual([await codigoDe(a.fallo), await codigoDe(b.fallo)], ['ECONNREFUSED', undefined]);
    assert.ok((await b.fallo) instanceof Error);
  });

  test('R6 tenant mismatch or no control socket fails with ESINAGENTE; nothing reaches A', async () => {
    const { registro, control } = armar();
    const ajena = await abrir(registro, { ...SOL, tenantId: 'tenant-b' });
    const sinControl = await abrir(registro, { ...SOL, agenteId: 'agente-x' });
    assert.deepEqual([await codigoDe(ajena.fallo), await codigoDe(sinControl.fallo)], ['ESINAGENTE', 'ESINAGENTE']);
    assert.equal(control.enviados.length, 0);
  });
});

describe('RegistroAgentes attach and close rules (CH-19c1)', () => {
  test('apertura-sesion carries no tenant; reservation is own, known and single; attach connects', async () => {
    const { registro, relojes, control } = armar();
    const { canal } = await abrir(registro);
    assert.deepEqual(JSON.parse(control.enviados[0]), { tipo: 'apertura-sesion', sesionId: 'sesion-1', host: 'replica', puerto: 5432 });
    const reservas = [['agente-b', 'sesion-1'], ['agente-a', 'otra'], ['agente-a', 'sesion-1'], ['agente-a', 'sesion-1']];
    assert.deepEqual(reservas.map(([a, s]) => registro.reservarDatos(a, s)), [false, false, true, false]);
    let conectado = false;
    canal.once('connect', () => (conectado = true));
    assert.equal(registro.adjuntarDatos('agente-a', 'sesion-1', ws(new SocketFalso())), true);
    assert.deepEqual([conectado, relojes[0].cancelado], [true, true]);
    canal.destroy();
  });

  test('adjuntarDatos is false once soltarSesion removed the session', async () => {
    const { registro } = armar();
    const { canal } = await abrir(registro);
    canal.destroy();
    assert.equal(registro.adjuntarDatos('agente-a', 'sesion-1', ws(new SocketFalso())), false);
  });

  test('cerrarAgente and cerrarTenant close with 4002 and fail pending sessions', async () => {
    const { registro, control } = armar();
    const unido = await abrir(registro);
    const pendiente = await abrir(registro);
    const datos = new SocketFalso();
    registro.adjuntarDatos('agente-a', 'sesion-1', ws(datos));
    registro.cerrarAgente('agente-a');
    assert.deepEqual([control.cierres, datos.cierres[0], await codigoDe(pendiente.fallo)], [[CIERRE_REVOCADO], 4002, 'ESINAGENTE']);
    assert.equal(unido.canal.destroyed, true);
    const otro = new SocketFalso();
    registro.registrarControl({ id: 'agente-b', tenantId: 'tenant-b' }, ws(otro));
    registro.cerrarTenant('tenant-b');
    assert.deepEqual(otro.cierres, [CIERRE_REVOCADO]);
  });

  test('cerrarTodo sets cerrando, terminates sockets and refuses later sessions', async () => {
    const { registro, control } = armar();
    const pendiente = await abrir(registro);
    registro.cerrarTodo();
    const tarde = await abrir(registro);
    assert.deepEqual([registro.cerrando, control.cierres], [true, [1006]]);
    assert.deepEqual([await codigoDe(pendiente.fallo), await codigoDe(tarde.fallo)], ['ESINAGENTE', 'ESINAGENTE']);
  });

  test('the default session id is randomBytes(16) in base64url', async () => {
    const registro = crearRegistroAgentes();
    const control = new SocketFalso();
    registro.registrarControl(AGENTE_A, ws(control));
    const { canal } = await abrir(registro);
    assert.match(JSON.parse(control.enviados[0]).sesionId, /^[A-Za-z0-9_-]{22}$/);
    canal.destroy();
  });
});
