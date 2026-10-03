import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import pg from 'pg';
import { esFalloReintentable } from './automatizaciones.js';
import { SIN_AGENTES } from './canal-agente.js';
import { SIN_DIAL, SOLICITUD, TECHO_MS, cerrarServidor, par, puerto, techo, tic } from './canal-agente-apoyo.js';
import { ejecutarConsulta } from './consulta-ejecucion.js';
import { cerrarCliente, iniciarConexion, probeConnection } from './db-probe.js';
import { prepararSentencia } from './parametros.js';

/**
 * CH-19c1, cases A1-A5: `CanalAgente` honors the 19a "Fake Duplex Contract" over a real
 * `ws` pair. A6-A10 (live PostgreSQL, slicing, close and release) are in
 * `canal-agente-ampliado.test.ts`.
 */
const PRESUPUESTO_MS = 400;

after(cerrarServidor);

describe('CanalAgente without PostgreSQL (CH-19c1, A1-A5)', () => {
  test('A1 a pg client calls the factory once and asks for no session', async () => {
    const { abrir, abiertos, pedidos } = puerto();
    new pg.Client({ stream: abrir });
    await tic();
    assert.deepEqual([abiertos.length, pedidos.length], [1, 0]);
  });

  test('A2 connect() asks asynchronously, and connect is emitted only after adjuntar', async () => {
    const { abrir, pedidos } = puerto();
    const canal = abrir();
    let conectado = false;
    canal.once('connect', () => (conectado = true));
    assert.equal(canal.connect(), canal);
    assert.equal(pedidos.length, 0);
    await tic();
    assert.deepEqual([pedidos.length, conectado], [1, false]);
    const { motor, agente } = await par();
    canal.adjuntar(motor);
    assert.equal(conectado, true);
    canal.destroy();
    agente.terminate();
  });

  test('A3 SIN_AGENTES fails asynchronously with ESINAGENTE, error-desconocido, not retried', async () => {
    const canal = SIN_AGENTES.canalPara(SOLICITUD);
    const iniciado = Date.now();
    const probe = await probeConnection({ ...SIN_DIAL, canal, timeoutMs: PRESUPUESTO_MS });
    assert.deepEqual([probe.categoria, probe.codigo], ['error-desconocido', 'ESINAGENTE']);
    const preparada = prepararSentencia('SELECT 1', undefined, undefined);
    assert.ok(preparada.ok);
    const ejecucion = await ejecutarConsulta({
      ...SIN_DIAL, canal, sentencia: preparada.valor, limite: 1, desplazamiento: 0, connectTimeoutMs: PRESUPUESTO_MS,
    });
    assert.ok(ejecucion.resultado === 'fallo', JSON.stringify(ejecucion));
    assert.deepEqual([ejecucion.fase, ejecucion.categoria, ejecucion.codigo], ['conexion', 'error-desconocido', 'ESINAGENTE']);
    assert.equal(esFalloReintentable(ejecucion), false);
    assert.ok(Date.now() - iniciado < PRESUPUESTO_MS, 'no wait: the failure is immediate');
  });

  test('A4 a session destroyed with ECONNREFUSED is host-inalcanzable', async () => {
    const { abrir } = puerto((canal) => canal.destroy(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })));
    const probe = await probeConnection({ ...SIN_DIAL, canal: abrir, timeoutMs: PRESUPUESTO_MS });
    assert.deepEqual([probe.categoria, probe.codigo], ['host-inalcanzable', 'ECONNREFUSED']);
  });

  test('A5 a silent session is tiempo-agotado, and closing it while connecting returns', async () => {
    const { abrir, abiertos } = puerto();
    const probe = await probeConnection({ ...SIN_DIAL, canal: abrir, timeoutMs: PRESUPUESTO_MS });
    assert.deepEqual([probe.categoria, probe.codigo, abiertos.length], ['tiempo-agotado', null, 1]);
    const { cliente, conectado, cancelarTemporizador } = iniciarConexion({ ...SIN_DIAL, canal: abrir }, PRESUPUESTO_MS);
    conectado.catch(() => undefined);
    cancelarTemporizador();
    await Promise.race([cerrarCliente(cliente, true), techo(TECHO_MS)]);
  });
});
