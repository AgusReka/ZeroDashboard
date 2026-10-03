import { Duplex } from 'node:stream';
import type { RawData, WebSocket } from 'ws';
import type { AbrirCanal, CanalDuplex } from './db-probe.js';

/**
 * The engine side of one agent data channel (CH-19c1; DEC-112, DEC-113, DEC-122). It
 * honors the 19a "Fake Duplex Contract": the factory is inert, the session is asked for
 * lazily on `connect()`, every failure is asynchronous, and `'close'` is always reached.
 * The bytes are relayed and never read, logged or buffered beyond the stream (rule 5).
 */

/**
 * The internal code of a session that has no control channel to ride (DEC-122 Q5). It
 * has Node's code shape, so `classifyConnectionError` publishes it, but it sits outside
 * every classified set: the result is `error-desconocido`, and it is not retried.
 */
export const CODIGO_SIN_AGENTE = 'ESINAGENTE';

/** The largest data frame the engine sends or accepts (DEC-122): 1 MiB. */
export const LIMITE_TRAMA_DATOS = 1 << 20;

/** Builds the error a channel is destroyed with when no agent can carry it. */
export function errorSinAgente(): Error {
  return Object.assign(new Error('sin-agente'), { code: CODIGO_SIN_AGENTE });
}

/**
 * What one session needs. `tenantId` comes from the active tenant at use, never from
 * the agent; `host` and `puerto` come from the stored `Conexion` row (DEC-115).
 */
export interface SolicitudSesion {
  agenteId: string;
  tenantId: string;
  host: string;
  puerto: number;
}

/** The registry as a channel sees it. */
export interface PuertoDeSesion {
  /** Never throws: a session that cannot be opened is `canal.destroy(...)`. */
  pedirSesion(canal: CanalAgente): void;
  /** Idempotent; called from `_destroy`. */
  soltarSesion(canal: CanalAgente): void;
}

/** Turns one session request into the fresh-per-call factory pg takes. */
export interface AbridorDeCanales {
  canalPara(solicitud: SolicitudSesion): AbrirCanal;
}

export class CanalAgente extends Duplex implements CanalDuplex {
  private socket: WebSocket | null = null;
  /** Set once the channel ends or is destroyed: a late frame is dropped, never pushed. */
  private terminado = false;

  /** Stores its fields only: pg builds the channel long before it connects. */
  constructor(
    readonly solicitud: SolicitudSesion,
    private readonly puerto: PuertoDeSesion,
  ) {
    super();
  }

  setNoDelay(): this {
    return this;
  }

  /** pg's `connect(port, host)`. The target was bound when the factory was built. */
  connect(): this {
    setImmediate(() => {
      if (!this.destroyed) this.puerto.pedirSesion(this);
    });
    return this;
  }

  /** Called by the registry once the agent's data socket for this session is up. */
  adjuntar(socket: WebSocket): void {
    this.socket = socket;
    // Data frames are binary only: a text frame closes with 1003 (wrong data type).
    // Backpressure: a full readable buffer pauses the socket until `_read` asks again.
    socket.on('message', (datos: RawData, binario: boolean) => {
      if (!binario) {
        socket.close(1003);
        this.destroy();
      } else if (!this.terminado && !this.push(datos as Buffer)) {
        socket.pause();
      }
    });
    // No half-open: the far side closing always reaches `'close'` here.
    socket.on('close', () => this.destroy());
    socket.on('error', () => {});
    this.emit('connect');
  }

  override _read(): void {
    if (this.socket?.isPaused) this.socket.resume();
  }

  /**
   * Sends in frames of at most `LIMITE_TRAMA_DATOS` and completes on the last frame's
   * send callback, so pg's writes feel the socket's backpressure. Detached (pg's `end()`
   * while connecting), the write completes without a far side.
   */
  override _write(trozo: Buffer, _codificacion: BufferEncoding, listo: (error?: Error | null) => void): void {
    const socket = this.socket;
    if (socket === null) {
      listo();
      return;
    }
    let resto = trozo;
    while (resto.length > LIMITE_TRAMA_DATOS) {
      socket.send(resto.subarray(0, LIMITE_TRAMA_DATOS), { binary: true });
      resto = resto.subarray(LIMITE_TRAMA_DATOS);
    }
    socket.send(resto, { binary: true }, (error) => listo(error));
  }

  /** Ending the readable side lets `autoDestroy` reach `'close'`. */
  override _final(listo: (error?: Error | null) => void): void {
    this.terminado = true;
    this.push(null);
    this.socket?.close(1000);
    listo();
  }

  /** Releases the session in the registry and closes the data socket, on every path. */
  override _destroy(error: Error | null, listo: (error?: Error | null) => void): void {
    this.terminado = true;
    this.puerto.soltarSesion(this);
    this.socket?.close(1000);
    listo(error);
  }
}

/** A port with no agents behind it: every session request fails at once. */
const SIN_PUERTO: PuertoDeSesion = {
  pedirSesion: (canal) => canal.destroy(errorSinAgente()),
  soltarSesion: () => {},
};

/**
 * The fail-closed default opener (DEC-122): every `connect()` ends in an asynchronous
 * `destroy(errorSinAgente())`. It never dials, waits or queues.
 */
export const SIN_AGENTES: AbridorDeCanales = {
  canalPara: (solicitud) => () => new CanalAgente(solicitud, SIN_PUERTO),
};
