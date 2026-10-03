import type { Socket } from 'node:net';
import type { WebSocket } from 'ws';
import type { CodigoErrorAgente } from '../agente-protocolo.js';
import type { Destino } from './destinos.js';
import { LIMITES_AGENTE } from './limites.js';
import type { Log } from './log.js';

/**
 * CH-19c2 (DEC-112, DEC-122, DEC-123): one session's byte bridge. The replica is dialed
 * FIRST, with a 10 s timer; only once it is up does the bridge dial the engine's data
 * channel. Bytes cross as binary frames of at most 1 MiB, with backpressure both ways, and
 * are never read, parsed or logged (rule 1): the bridge is a relay, not a client.
 */

/** A one-shot timer that returns its cancel. */
export type Programar = (ms: number, fn: () => void) => () => void;

const CODIGOS = new Set<string>([
  'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
] satisfies CodigoErrorAgente[]);

/** One of the seven closed codes (DEC-117); anything else, `EMFILE` say, is `EHOSTUNREACH` (DEC-123 A5). */
export function codigoDeError(e: unknown): CodigoErrorAgente {
  const codigo: unknown = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof codigo === 'string' && CODIGOS.has(codigo) ? (codigo as CodigoErrorAgente) : 'EHOSTUNREACH';
}

export interface DependenciasPuente {
  /** The allowlist entry, so the socket dials its normalized host, never the engine's string. */
  destino: Destino;
  sesionId: string;
  abrirReplica: (d: Destino) => Socket;
  abrirDatos: (sesionId: string) => WebSocket;
  programar: Programar;
  log: Log;
  /** Sends `sesion-fallida` for a replica that could not be reached. */
  informar: (codigo: CodigoErrorAgente) => void;
}

export interface Puente {
  /** `ordenado` closes the data socket with 1001; `inmediato` terminates it. The replica is destroyed. */
  cerrar(modo: 'ordenado' | 'inmediato'): void;
  /** Resolves once the replica and the data socket (if any) are both closed. */
  readonly cerrada: Promise<void>;
}

const CIERRE_NORMAL = 1000;
const CIERRE_SALIDA = 1001;
const CIERRE_TIPO_INVALIDO = 1003;
const ignorar = (): void => {};

export function abrirPuente(d: DependenciasPuente): Puente {
  const informarFallo = (codigo: CodigoErrorAgente): void => {
    d.informar(codigo);
    d.log({ evento: 'sesion-fallida', codigo });
  };
  let replica: Socket;
  try {
    replica = d.abrirReplica(d.destino);
  } catch (error) {
    informarFallo(codigoDeError(error));
    return { cerrar: ignorar, cerrada: Promise.resolve() };
  }

  let datos: WebSocket | null = null;
  let conectada = false;
  let fallida = false;
  let abierta = false;
  let replicaViva = true;
  let datosVivo = false;
  let cancelarVigilancia = ignorar;
  let resolver = ignorar;
  const cerrada = new Promise<void>((listo) => (resolver = listo));
  const cancelarReplica = d.programar(LIMITES_AGENTE.replicaMs, () => fallar('ETIMEDOUT'));

  function fallar(codigo: CodigoErrorAgente): void {
    if (conectada || fallida) return;
    fallida = true;
    cancelarReplica();
    informarFallo(codigo);
    replica.destroy();
  }

  function terminarSiCerrada(): void {
    if (replicaViva || datosVivo) return;
    cancelarReplica();
    cancelarVigilancia();
    if (abierta) d.log({ evento: 'sesion-cerrada' });
    resolver();
  }

  /** Re-armed on every engine ping; a silent data socket is terminated at 50 s. */
  function vigilar(): void {
    cancelarVigilancia();
    cancelarVigilancia = d.programar(LIMITES_AGENTE.vigilanciaPingMs, () => datos?.terminate());
  }

  /** Replica to engine: the replica stays paused until the last slice is written out. */
  function haciaMotor(bytes: Buffer): void {
    const ws = datos!;
    replica.pause();
    for (let i = 0; i < bytes.length; i += LIMITES_AGENTE.tramaDatos) {
      const ultima = i + LIMITES_AGENTE.tramaDatos >= bytes.length;
      ws.send(bytes.subarray(i, i + LIMITES_AGENTE.tramaDatos), { binary: true }, ultima ? () => replica.resume() : undefined);
    }
  }

  function marcarDatos(): void {
    try {
      datos = d.abrirDatos(d.sesionId);
    } catch {
      replica.destroy();
      return;
    }
    const ws = datos;
    datosVivo = true;
    ws.binaryType = 'nodebuffer';
    ws.on('error', ignorar);
    ws.once('open', () => {
      abierta = true;
      d.log({ evento: 'sesion-abierta' });
      vigilar();
      replica.on('data', haciaMotor);
    });
    ws.on('ping', vigilar);
    // Engine to replica: a full replica buffer pauses the data socket until `'drain'`.
    ws.on('message', (trama, binaria) => {
      if (!binaria) {
        ws.close(CIERRE_TIPO_INVALIDO);
        replica.destroy();
      } else if (!replica.destroyed && !replica.write(trama as Buffer)) {
        ws.pause();
      }
    });
    replica.on('drain', () => ws.resume());
    // A failed dial (refused, 404, handshake timeout) also ends here: the replica goes.
    ws.on('close', () => {
      datosVivo = false;
      cancelarVigilancia();
      if (abierta) replica.destroySoon();
      else replica.destroy();
      terminarSiCerrada();
    });
  }

  replica.on('error', (error) => fallar(codigoDeError(error)));
  replica.once('connect', () => {
    conectada = true;
    cancelarReplica();
    marcarDatos();
  });
  replica.on('close', () => {
    replicaViva = false;
    datos?.close(CIERRE_NORMAL);
    terminarSiCerrada();
  });

  return {
    cerrar(modo) {
      if (modo === 'ordenado') datos?.close(CIERRE_SALIDA);
      else datos?.terminate();
      replica.destroy();
    },
    cerrada,
  };
}
