import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { AperturaSesion, CodigoCierre, CodigoErrorAgente } from './agente-protocolo.js';
import { CanalAgente, errorSinAgente, type AbridorDeCanales, type PuertoDeSesion } from './canal-agente.js';

/**
 * The in-memory session registry of the agent channel (CH-19c1; DEC-116, DEC-122): one
 * control socket per agent and one data socket per session. It lives in this process
 * only (DEC-75), logs nothing, and never reads frame contents (rule 5).
 */

/** The channel limits (DEC-122). They are constants, not environment variables. */
export const LIMITES = { tramaControl: 4096, sesionesPorAgente: 8, pendienteMs: 30_000, pingMs: 20_000 } as const;
/** A newer control socket of the same agent replaced this one. */
export const CIERRE_REEMPLAZO: CodigoCierre = 4001;
/** The agent was revoked or its tenant was deactivated. */
export const CIERRE_REVOCADO: CodigoCierre = 4002;

/** Only these agent codes are copied onto the channel error; any other value gets no `code`. */
const CODIGOS_AGENTE: ReadonlySet<unknown> = new Set<CodigoErrorAgente>([
  'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
]);

export interface RegistroAgentes extends AbridorDeCanales, PuertoDeSesion {
  /** Set by `cerrarTodo`: every later session or socket is refused. */
  readonly cerrando: boolean;
  /** `tenantId` comes from the token row, never from the agent (DEC-114). */
  registrarControl(agente: { id: string; tenantId: string }, socket: WebSocket): void;
  /** True only for a pending session of this agent that no data socket has taken yet. */
  reservarDatos(agenteId: string, sesionId: string): boolean;
  /** False when the session is gone (released, expired or failed) or is not this agent's. */
  adjuntarDatos(agenteId: string, sesionId: string, socket: WebSocket): boolean;
  /** Pending sessions only; anything else is ignored. */
  sesionFallida(agenteId: string, sesionId: string, codigo: unknown): void;
  /** Control and data sockets close with 4002; every session of the agent fails. */
  cerrarAgente(agenteId: string): void;
  cerrarTenant(tenantId: string): void;
  /** Shutdown: sets `cerrando`, terminates every socket, fails every session. */
  cerrarTodo(): void;
}

interface Sesion {
  agenteId: string;
  canal: CanalAgente;
  reservada: boolean;
  socket: WebSocket | null;
  cancelarVencimiento: () => void;
}

/** A timer that never keeps the process alive. */
function programarReloj(ms: number, fn: () => void): () => void {
  const reloj = setTimeout(fn, ms);
  reloj.unref();
  return () => clearTimeout(reloj);
}

export function crearRegistroAgentes(op: {
  programar?: (ms: number, fn: () => void) => () => void;
  generarId?: () => string;
} = {}): RegistroAgentes {
  const programar = op.programar ?? programarReloj;
  const generarId = op.generarId ?? (() => randomBytes(16).toString('base64url'));
  const controles = new Map<string, { socket: WebSocket; tenantId: string }>();
  const sesiones = new Map<string, Sesion>();
  let cerrando = false;

  const sesionesDe = (agenteId: string): Sesion[] => [...sesiones.values()].filter((s) => s.agenteId === agenteId);
  /** A session of this agent that no data socket has attached to yet. */
  const pendiente = (agenteId: string, sesionId: string): Sesion | undefined => {
    const sesion = sesiones.get(sesionId);
    return sesion?.agenteId === agenteId && sesion.socket === null && !sesion.canal.destroyed ? sesion : undefined;
  };
  /** Destroying the channel releases the session through `soltarSesion`. */
  const fallar = (sesionId: string): void => {
    const sesion = sesiones.get(sesionId);
    if (sesion?.socket === null) sesion.canal.destroy(errorSinAgente());
  };

  const registro: RegistroAgentes = {
    get cerrando() {
      return cerrando;
    },
    canalPara: (solicitud) => () => new CanalAgente(solicitud, registro),

    pedirSesion(canal) {
      const { agenteId, tenantId, host, puerto } = canal.solicitud;
      const control = controles.get(agenteId);
      // The tenant is checked at use: the request's active tenant must own the agent.
      if (cerrando || !control || control.tenantId !== tenantId || sesionesDe(agenteId).length >= LIMITES.sesionesPorAgente) {
        canal.destroy(errorSinAgente());
        return;
      }
      const sesionId = generarId();
      const cancelarVencimiento = programar(LIMITES.pendienteMs, () => fallar(sesionId));
      sesiones.set(sesionId, { agenteId, canal, reservada: false, socket: null, cancelarVencimiento });
      const apertura: AperturaSesion = { tipo: 'apertura-sesion', sesionId, host, puerto };
      control.socket.send(JSON.stringify(apertura), (error) => {
        if (error) fallar(sesionId);
      });
    },

    soltarSesion(canal) {
      for (const [sesionId, sesion] of sesiones) {
        if (sesion.canal !== canal) continue;
        sesion.cancelarVencimiento();
        sesiones.delete(sesionId);
      }
    },

    registrarControl(agente, socket) {
      if (cerrando) {
        socket.terminate();
        return;
      }
      const previo = controles.get(agente.id);
      controles.set(agente.id, { socket, tenantId: agente.tenantId });
      previo?.socket.close(CIERRE_REEMPLAZO);
      // A replaced socket closing late must never remove its successor.
      socket.on('close', () => {
        if (controles.get(agente.id)?.socket === socket) controles.delete(agente.id);
      });
    },

    reservarDatos(agenteId, sesionId) {
      const sesion = pendiente(agenteId, sesionId);
      if (!sesion || sesion.reservada) return false;
      sesion.reservada = true;
      return true;
    },

    adjuntarDatos(agenteId, sesionId, socket) {
      const sesion = pendiente(agenteId, sesionId);
      if (cerrando || !sesion) return false;
      sesion.cancelarVencimiento();
      sesion.socket = socket;
      sesion.canal.adjuntar(socket);
      return true;
    },

    sesionFallida(agenteId, sesionId, codigo) {
      const sesion = pendiente(agenteId, sesionId);
      const error = new Error('sesion-fallida');
      sesion?.canal.destroy(CODIGOS_AGENTE.has(codigo) ? Object.assign(error, { code: codigo }) : error);
    },

    cerrarAgente(agenteId) {
      controles.get(agenteId)?.socket.close(CIERRE_REVOCADO);
      controles.delete(agenteId);
      for (const sesion of sesionesDe(agenteId)) {
        sesion.socket?.close(CIERRE_REVOCADO);
        sesion.canal.destroy(errorSinAgente());
      }
    },

    cerrarTenant(tenantId) {
      const agentes = new Set<string>();
      for (const [agenteId, control] of controles) if (control.tenantId === tenantId) agentes.add(agenteId);
      for (const sesion of sesiones.values()) if (sesion.canal.solicitud.tenantId === tenantId) agentes.add(sesion.agenteId);
      for (const agenteId of agentes) registro.cerrarAgente(agenteId);
    },

    cerrarTodo() {
      cerrando = true;
      for (const { socket } of controles.values()) socket.terminate();
      controles.clear();
      for (const sesion of [...sesiones.values()]) {
        sesion.socket?.terminate();
        sesion.canal.destroy(errorSinAgente());
      }
    },
  };
  return registro;
}
