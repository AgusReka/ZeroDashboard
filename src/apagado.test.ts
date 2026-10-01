import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, test } from 'node:test';
import Fastify from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { registrarApagado } from './apagado.js';
import { crearPlanificador, type Reloj } from './planificador.js';

/**
 * CH-17a task 1.5 (DEC-100, DEC-102): SIGTERM and SIGINT close the app once, then exit.
 * An `EventEmitter` stands in for `process`, and `salir` is recorded instead of exiting,
 * so no signal ever reaches the test process.
 */

function arnes(cerrar: () => Promise<void>) {
  const proceso = new EventEmitter();
  const lineas: string[] = [];
  const salidas: number[] = [];
  let alSalir!: (codigo: number) => void;
  const salio = new Promise<number>((resolve) => {
    alSalir = resolve;
  });
  const log = Fastify({ logger: { stream: { write: (linea: string) => void lineas.push(linea) } } }).log;
  registrarApagado({
    proceso,
    cerrar,
    log,
    salir: (codigo) => {
      salidas.push(codigo);
      alSalir(codigo);
    },
  });
  return { proceso, lineas, salidas, salio };
}

const vuelta = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('graceful shutdown on SIGTERM and SIGINT (CH-17a 1.5)', () => {
  for (const senal of ['SIGTERM', 'SIGINT'] as const) {
    test(`${senal} closes the app once and exits with 0`, async () => {
      let cierres = 0;
      const { proceso, salidas, salio } = arnes(async () => {
        cierres += 1;
      });

      proceso.emit(senal);

      assert.equal(await salio, 0);
      assert.equal(cierres, 1);
      assert.deepEqual(salidas, [0]);
    });
  }

  test('a second signal during the close is logged and ignored: one close, one exit', async () => {
    let cierres = 0;
    let terminar!: () => void;
    const { proceso, lineas, salidas, salio } = arnes(() => {
      cierres += 1;
      return new Promise<void>((resolve) => {
        terminar = resolve;
      });
    });

    proceso.emit('SIGTERM');
    proceso.emit('SIGINT');
    await vuelta();
    assert.deepEqual(salidas, [], 'nothing exits before the close finishes');
    terminar();

    assert.equal(await salio, 0);
    proceso.emit('SIGTERM');
    await vuelta();
    assert.equal(cierres, 1);
    assert.deepEqual(salidas, [0]);
    const ignoradas = lineas.map((l) => JSON.parse(l)).filter((l) => l.msg === 'shutdown already in progress');
    assert.deepEqual(ignoradas.map((l) => l.senal), ['SIGINT', 'SIGTERM']);
  });

  test('a close that rejects is logged by name only and exits with 1', async () => {
    const { proceso, lineas, salidas, salio } = arnes(async () => {
      throw new TypeError('texto secreto del cierre');
    });

    proceso.emit('SIGINT');

    assert.equal(await salio, 1);
    assert.deepEqual(salidas, [1]);
    const fallos = lineas.map((l) => JSON.parse(l)).filter((l) => l.msg === 'shutdown failed');
    assert.deepEqual(fallos.map((l) => [l.error, l.nombreError]), [['error-interno', 'TypeError']]);
    assert.ok(!lineas.join('\n').includes('texto secreto'));
  });

  test("a real Fastify app whose onClose stops the planner cancels the planner's timer", async () => {
    const temporizadores: { cancelado: boolean }[] = [];
    const reloj: Reloj = {
      ahora: () => new Date('2021-03-01T10:00:30.250Z'),
      programar: () => {
        const temporizador = { cancelado: false };
        temporizadores.push(temporizador);
        return () => {
          temporizador.cancelado = true;
        };
      },
    };
    const app = Fastify({ logger: false });
    // Arming a timer reads nothing: no client call is ever made in this test.
    const planificador = crearPlanificador({ prisma: {} as PrismaAislado, zonaHoraria: 'UTC', log: app.log, reloj });
    app.addHook('onClose', async () => {
      await planificador.detener();
    });
    await app.ready();
    planificador.iniciar();
    const { proceso, salio } = arnes(() => app.close());

    proceso.emit('SIGTERM');

    assert.equal(await salio, 0);
    assert.deepEqual(temporizadores, [{ cancelado: true }]);
  });
});
