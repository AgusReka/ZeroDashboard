import type { Socket } from 'node:net';
import type { WebSocket } from 'ws';
import type { CodigoErrorAgente } from '../agente-protocolo.js';
import { buscarDestino, type Destino, type ListaDestinos } from './destinos.js';
import { FORMATO_SESION, LIMITES_AGENTE } from './limites.js';
import type { Log } from './log.js';
import { abrirPuente, type Programar, type Puente } from './puente.js';

/**
 * CH-19c2 (DEC-115, DEC-123 A4-A5): the agent's session table. A malformed `sesionId` is
 * ignored before it can reach a URL, and nothing is reported (it cannot belong to a
 * pending session, and an untrusted id is never echoed back). The cap and the allowlist
 * refuse with `ECONNREFUSED`, the code a closed port gives, so a compromised engine cannot
 * tell a refusal from a down host or enumerate the list. Sessions do not depend on the
 * control socket.
 */
export interface Sesiones {
  /** Never throws. */
  abrir(a: { sesionId: string; host: unknown; puerto: unknown }): void;
  cantidad(): number;
  cerrarTodas(modo: 'ordenado' | 'inmediato'): Promise<void>;
}

export interface DependenciasSesiones {
  destinos: ListaDestinos;
  log: Log;
  programar: Programar;
  abrirReplica: (d: Destino) => Socket;
  abrirDatos: (sesionId: string) => WebSocket;
  informar: (sesionId: string, codigo: CodigoErrorAgente) => void;
}

export function crearSesiones(d: DependenciasSesiones): Sesiones {
  const activas = new Map<string, Puente>();

  /** The spec's local event for every refusal is `destino-no-permitido`, never with host or port. */
  function rechazar(sesionId: string, tope: boolean): void {
    if (tope) d.log({ evento: 'tope-de-sesiones' });
    d.log({ evento: 'destino-no-permitido' });
    d.informar(sesionId, 'ECONNREFUSED');
  }

  return {
    abrir({ sesionId, host, puerto }) {
      if (typeof sesionId !== 'string' || !FORMATO_SESION.test(sesionId)) return d.log({ evento: 'mensaje-invalido' });
      if (activas.has(sesionId)) return;
      // The cap first: a full table refuses without consulting the allowlist.
      if (activas.size >= LIMITES_AGENTE.sesiones) return rechazar(sesionId, true);
      const destino = buscarDestino(d.destinos, host, puerto);
      if (destino === null) return rechazar(sesionId, false);
      const puente = abrirPuente({
        destino,
        sesionId,
        abrirReplica: d.abrirReplica,
        abrirDatos: d.abrirDatos,
        programar: d.programar,
        log: d.log,
        informar: (codigo) => d.informar(sesionId, codigo),
      });
      activas.set(sesionId, puente);
      void puente.cerrada.then(() => activas.delete(sesionId));
    },
    cantidad: () => activas.size,
    async cerrarTodas(modo) {
      const cerradas = [...activas.values()].map((puente) => (puente.cerrar(modo), puente.cerrada));
      await Promise.all(cerradas);
    },
  };
}
