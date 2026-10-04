import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, test } from 'node:test';
import type { Agente, MotivoFin } from './agente.js';
import { CODIGO_SALIDA, ejecutarAgente, type CodigoSalida } from './arranque.js';
import { LIMITES_AGENTE } from './limites.js';

/** CH-19c2, cases M1-M5: signals, exit codes and the crash handler, with `EventEmitter` as `proceso`. */
const ENV = { AGENT_SERVER_URL: 'ws://127.0.0.1:9', AGENT_TOKEN: 'zda_' + 'b'.repeat(43), AGENT_ALLOWED_TARGETS: 'db:5432' };
const tick = () => new Promise((listo) => setImmediate(listo));

function arrancar(env: Record<string, string | undefined> = ENV, motivo?: MotivoFin, falla?: Error) {
  const proceso = new EventEmitter();
  const salida: string[] = [];
  const errores: string[] = [];
  const codigos: CodigoSalida[] = [];
  const relojes: { ms: number; fn: () => void }[] = [];
  const iniciados: unknown[] = [];
  let detenciones = 0;
  let resolver: (m: MotivoFin) => void = () => {};
  const agente: Agente = {
    terminado: new Promise<MotivoFin>((listo) => (resolver = listo)),
    detener: () => void detenciones++,
  };
  ejecutarAgente({
    env,
    proceso,
    escribir: (linea) => salida.push(linea),
    escribirError: (linea) => errores.push(linea),
    salir: (codigo) => codigos.push(codigo),
    programar: (ms, fn) => (relojes.push({ ms, fn }), () => {}),
    iniciar: (d) => {
      iniciados.push(d);
      if (falla) throw falla;
      return agente;
    },
  });
  if (motivo) resolver(motivo);
  const eventos = (lineas: string[]) => lineas.map((linea) => JSON.parse(linea));
  return { proceso, salida, errores, codigos, relojes, iniciados, resolver, eventos, detenciones: () => detenciones };
}

describe('ejecutarAgente (CH-19c2, M1-M5)', () => {
  test('M1 a configuration error names only the variable on stderr, exits 1 and starts nothing', () => {
    const SECRETO = 'SENTINELA-no-debe-salir';
    for (const [env, variable] of [
      [{}, 'AGENT_SERVER_URL'],
      [{ ...ENV, AGENT_SERVER_URL: `wss://u:${SECRETO}@motor.example` }, 'AGENT_SERVER_URL'],
      [{ ...ENV, AGENT_TOKEN: SECRETO }, 'AGENT_TOKEN'],
      [{ ...ENV, AGENT_ALLOWED_TARGETS: '' }, 'AGENT_ALLOWED_TARGETS'],
    ] as const) {
      const r = arrancar(env);
      assert.deepEqual(r.codigos, [1]);
      assert.equal(r.iniciados.length, 0);
      assert.deepEqual(r.salida, []);
      assert.deepEqual(r.eventos(r.errores).map(({ evento, variable }) => ({ evento, variable })), [
        { evento: 'configuracion-invalida', variable },
      ]);
      assert.ok(!r.errores.join('').includes(SECRETO));
    }
  });

  test('M2 SIGTERM calls detener once, then exits 0 when the agent ends', async () => {
    const r = arrancar();
    r.proceso.emit('SIGTERM');
    assert.equal(r.detenciones(), 1);
    assert.deepEqual(r.codigos, []);
    r.resolver('detenido');
    await tick();
    assert.deepEqual(r.codigos, [0]);
    assert.deepEqual(r.eventos(r.salida).map(({ evento, senal, motivo, codigoSalida }) => ({ evento, senal, motivo, codigoSalida })), [
      { evento: 'apagado', senal: 'SIGTERM', motivo: undefined, codigoSalida: undefined },
      { evento: 'fin', senal: undefined, motivo: 'detenido', codigoSalida: 0 },
    ]);
  });

  test('M3 a second signal is ignored, and a hung shutdown exits 0 at 5 s', async () => {
    const r = arrancar();
    r.proceso.emit('SIGINT');
    r.proceso.emit('SIGTERM');
    r.proceso.emit('SIGINT');
    assert.equal(r.detenciones(), 1);
    assert.deepEqual(r.relojes.map((reloj) => reloj.ms), [LIMITES_AGENTE.apagadoMs]);
    assert.equal(r.eventos(r.salida).filter((e) => e.evento === 'apagado').length, 1);
    await tick();
    assert.deepEqual(r.codigos, []);
    r.relojes[0].fn();
    assert.deepEqual(r.codigos, [0]);
    r.resolver('detenido');
    await tick();
    assert.deepEqual(r.codigos, [0], 'exits only once');
  });

  test('M4 each MotivoFin maps to its exit code', async () => {
    assert.deepEqual(CODIGO_SALIDA, { detenido: 0, 'credenciales-rechazadas': 2, 'agente-revocado': 2, reemplazado: 3 });
    for (const [motivo, codigo] of Object.entries(CODIGO_SALIDA) as [MotivoFin, CodigoSalida][]) {
      const r = arrancar(ENV, motivo);
      await tick();
      assert.deepEqual(r.codigos, [codigo], motivo);
      const { ts: _ts, ...fin } = r.eventos(r.salida).at(-1);
      assert.deepEqual(fin, { nivel: 'info', evento: 'fin', motivo, codigoSalida: codigo });
    }
  });

  test('M5 a crash logs the class name only and exits 1', () => {
    const casos = [[new TypeError('connect ECONNREFUSED 10.0.0.5:5432'), 'TypeError'], ['replica.interna:5432', 'Error']] as const;
    for (const evento of ['uncaughtException', 'unhandledRejection']) {
      for (const [error, nombreError] of casos) {
        const r = arrancar();
        r.proceso.emit(evento, error);
        r.proceso.emit(evento, error);
        assert.deepEqual(r.codigos, [1], evento);
        const lineas = [...r.salida, ...r.errores].join('');
        for (const fuga of ['ECONNREFUSED', '10.0.0.5', '5432', 'replica.interna']) assert.ok(!lineas.includes(fuga), fuga);
        assert.deepEqual(r.eventos(r.errores).map((e) => ({ evento: e.evento, nombreError: e.nombreError })), [
          { evento: 'error-interno', nombreError },
        ]);
      }
    }
    const r = arrancar(ENV, undefined, new RangeError('replica.interna:5432'));
    assert.deepEqual(r.codigos, [1]);
    assert.deepEqual(r.eventos(r.errores).map((e) => [e.evento, e.nombreError]), [['error-interno', 'RangeError']]);
  });
});
