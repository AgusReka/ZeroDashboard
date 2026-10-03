import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';
import type { CanalAgente } from './canal-agente.js';
import type { RegistroAgentes } from './registro-agentes.js';

/** Shared fixture of the revoke and baja suites (CH-19c1 U11, U12). Not a test file: it registers nothing. */
export class SocketFalso extends EventEmitter {
  enviados: string[] = [];
  cierres: number[] = [];
  isPaused = false;
  send(datos: string, listo?: (error?: Error) => void): void {
    this.enviados.push(datos);
    setImmediate(() => listo?.());
  }
  /** Like `ws`, a socket already closing ignores a later `close`: the first code is the one sent. */
  close(codigo: number): void {
    if (this.cierres.length === 0) this.cierres.push(codigo);
  }
  terminate(): void {
    this.cierres.push(1006);
  }
}

/** Registers a live control socket for the agent and attaches one data socket to a session of it. */
export async function socketsVivos(registro: RegistroAgentes, agente: { id: string; tenantId: string }) {
  const control = new SocketFalso();
  const datos = new SocketFalso();
  registro.registrarControl(agente, control as unknown as WebSocket);
  const solicitud = { agenteId: agente.id, tenantId: agente.tenantId, host: 'replica', puerto: 5432 };
  const canal = registro.canalPara(solicitud)() as CanalAgente;
  canal.on('error', () => {});
  canal.connect();
  await new Promise((resolve) => setImmediate(resolve));
  const { sesionId } = JSON.parse(control.enviados[0]) as { sesionId: string };
  if (!registro.adjuntarDatos(agente.id, sesionId, datos as unknown as WebSocket)) throw new Error('no session to attach');
  return { control, datos };
}
