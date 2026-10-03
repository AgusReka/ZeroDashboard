import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { WebSocket } from 'ws';
import { generarTokenAgente } from '../agente-token.js';
import { LIMITE_TRAMA_DATOS, type CanalAgente } from '../canal-agente.js';
import { LIMITES, crearRegistroAgentes } from '../registro-agentes.js';
import { FORMATO_SESION, FORMATO_TOKEN, LIMITES_AGENTE } from './limites.js';

/**
 * CH-19c2, case P1 (DEC-123 A2): the agent duplicates the engine's limits and formats
 * because it cannot import engine code. Only this test may import both sides.
 */
class ControlFalso extends EventEmitter {
  enviados: string[] = [];
  send(datos: string, listo?: (error?: Error) => void): void {
    this.enviados.push(datos);
    setImmediate(() => listo?.());
  }
  close(): void {}
  terminate(): void {}
}

test('P1 the agent limits and formats agree with the engine', async () => {
  assert.equal(LIMITES_AGENTE.tramaDatos, LIMITE_TRAMA_DATOS);
  assert.equal(LIMITES_AGENTE.tramaControl, LIMITES.tramaControl);
  assert.ok(LIMITES_AGENTE.sesiones > LIMITES.sesionesPorAgente, 'the engine cap must bind first');
  assert.ok(LIMITES_AGENTE.vigilanciaPingMs > 2 * LIMITES.pingMs, 'one lost engine ping must not trip the watchdog');
  for (let i = 0; i < 50; i++) assert.match(generarTokenAgente(), FORMATO_TOKEN);

  const registro = crearRegistroAgentes();
  const control = new ControlFalso();
  registro.registrarControl({ id: 'agente-a', tenantId: 'tenant-a' }, control as unknown as WebSocket);
  const canal = registro.canalPara({ agenteId: 'agente-a', tenantId: 'tenant-a', host: 'replica', puerto: 5432 })() as CanalAgente;
  canal.connect();
  await new Promise((listo) => setImmediate(listo));
  canal.destroy();
  assert.equal(control.enviados.length, 1);
  assert.match(JSON.parse(control.enviados[0]).sesionId, FORMATO_SESION);
});
