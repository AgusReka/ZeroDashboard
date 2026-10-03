import { STATUS_CODES, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { hashTokenAgente } from './agente-token.js';
import { LIMITE_TRAMA_DATOS } from './canal-agente.js';
import { LIMITES, type RegistroAgentes } from './registro-agentes.js';

/**
 * The engine side of the agent's WebSocket upgrade (CH-19c1; DEC-113, DEC-114, DEC-122).
 *
 * Raw `ws` in `noServer` mode behind this module's own `'upgrade'` listener (DEC-122 Q1):
 * Fastify never sees an upgrade request, so the closed `X-Tenant-Id` exemption list is
 * unchanged, and a plain `GET /agente/...` still falls to Fastify and fails closed. The
 * token is read from the `Authorization: Bearer` header only, never from the query or a
 * subprotocol, and every refusal is answered before the 101 (Q3). The path enters no
 * tenant context and holds no scoped model: its only database access is the token lookup
 * (Q2, amending DEC-116), and the tenant comes from the token row alone (rule 2).
 *
 * Logged fields are closed: `canal`, `estado`, `agenteId`, `codigoCierre`, `nombreError`.
 * Never the token, its hash, the header, `tenantId`, `sesionId`, host, port, the URL or
 * any frame content (rule 5).
 */

const RUTA_CONTROL = '/agente/control';
const PREFIJO_DATOS = '/agente/datos/';
const CABECERA_PORTADOR = /^Bearer (zda_[A-Za-z0-9_-]{43})$/;
/** `randomBytes(16)` in base64url: 22 characters. */
const ID_SESION = /^[A-Za-z0-9_-]{22}$/;
/** The exact, sorted key set of each message the agent may send on its control channel. */
const CLAVES_CONTROL = new Map([
  ['latido', 'tipo'],
  ['sesion-fallida', 'codigo,sesionId,tipo'],
]);
const CIERRE_TIPO_INVALIDO = 1003;
const CIERRE_POLITICA = 1008;
const ignorar = (): void => {};

export interface DependenciasServidorAgentes {
  app: FastifyInstance;
  /** The token lookup alone: no other model is within reach of the upgrade path. */
  prisma: { agente: Pick<PrismaAislado['agente'], 'buscarPorTokenHash'> };
  registro: RegistroAgentes;
  /** A repeating timer that returns its cancel; the default is an unref'd `setInterval`. */
  programarPing?: (ms: number, fn: () => void) => () => void;
}

function repetirReloj(ms: number, fn: () => void): () => void {
  const reloj = setInterval(fn, ms);
  reloj.unref();
  return () => clearInterval(reloj);
}

export function registrarServidorAgentes({ app, prisma, registro, programarPing = repetirReloj }: DependenciasServidorAgentes): void {
  const comunes = { noServer: true, perMessageDeflate: false, clientTracking: false } as const;
  const servidores = {
    control: new WebSocketServer({ ...comunes, maxPayload: LIMITES.tramaControl }),
    datos: new WebSocketServer({ ...comunes, maxPayload: LIMITE_TRAMA_DATOS }),
  };

  // Every upgraded socket, control or data, and whether it answered the last ping. A
  // socket that missed one is terminated at the next tick. There is no idle timeout: a
  // data socket that carries nothing but answers pings stays open (DEC-122).
  const vivos = new Map<WebSocket, boolean>();
  const cancelarPing = programarPing(LIMITES.pingMs, () => {
    for (const [ws, respondio] of vivos) {
      if (!respondio) {
        ws.terminate();
        continue;
      }
      vivos.set(ws, false);
      ws.ping();
    }
  });

  /** Mirrors `ws`'s own `abortHandshake`: a bare status line, no body, then the socket goes. */
  function rechazar(socket: Duplex, canal: string | null, estado: number): void {
    app.log.info({ canal, estado }, 'agent upgrade refused');
    socket.once('finish', () => socket.destroy());
    socket.end(`HTTP/1.1 ${estado} ${STATUS_CODES[estado]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }

  /** Control frames are text JSON with an exact key set; `latido` is a no-op until 19d1. */
  function leerControl(agenteId: string, ws: WebSocket, trama: RawData, binaria: boolean): void {
    if (binaria) return ws.close(CIERRE_TIPO_INVALIDO);
    let mensaje: Record<string, unknown> | null;
    try {
      mensaje = JSON.parse(String(trama));
    } catch {
      return ws.close(CIERRE_POLITICA);
    }
    const valido =
      typeof mensaje === 'object' && mensaje !== null && !Array.isArray(mensaje) &&
      Object.keys(mensaje).sort().join(',') === CLAVES_CONTROL.get(String(mensaje.tipo));
    if (!valido || (mensaje!.tipo === 'sesion-fallida' && typeof mensaje!.sesionId !== 'string')) {
      return ws.close(CIERRE_POLITICA);
    }
    if (mensaje!.tipo === 'sesion-fallida') registro.sesionFallida(agenteId, mensaje!.sesionId as string, mensaje!.codigo);
  }

  async function atender(peticion: IncomingMessage, socket: Duplex, cabeza: Buffer): Promise<void> {
    // 1. Method and path. The query string is cut off and never read.
    const ruta = (peticion.url ?? '').split('?')[0];
    const canal = ruta === RUTA_CONTROL ? 'control' : ruta.startsWith(PREFIJO_DATOS) ? 'datos' : null;
    if (peticion.method !== 'GET' || canal === null) return rechazar(socket, null, 404);
    // 2. The header, before any lookup.
    const token = CABECERA_PORTADOR.exec(peticion.headers.authorization ?? '')?.[1];
    if (token === undefined) return rechazar(socket, canal, 401);
    // 3. The lookup: unknown and revoked are the same `null`, so the same 401.
    let agente: Awaited<ReturnType<typeof prisma.agente.buscarPorTokenHash>>;
    try {
      agente = await prisma.agente.buscarPorTokenHash(hashTokenAgente(token));
    } catch (error) {
      app.log.error({ canal, nombreError: error instanceof Error ? error.name : typeof error }, 'agent token lookup failed');
      return rechazar(socket, canal, 500);
    }
    if (agente === null) return rechazar(socket, canal, 401);
    if (!agente.tenantActivo) return rechazar(socket, canal, 403);
    // 4. The peer left, or the app began closing, while the lookup ran.
    if (socket.destroyed || registro.cerrando) {
      socket.destroy();
      return;
    }
    // 5. Data only: a pending session of this same agent. Foreign, unknown, taken and
    // malformed ids are one 404, so nothing tells them apart.
    const sesionId = ruta.slice(PREFIJO_DATOS.length);
    if (canal === 'datos' && !(ID_SESION.test(sesionId) && registro.reservarDatos(agente.id, sesionId))) {
      return rechazar(socket, canal, 404);
    }
    // 6. The 101.
    const { id: agenteId, tenantId } = agente;
    servidores[canal].handleUpgrade(peticion, socket, cabeza, (ws) => {
      ws.on('error', ignorar);
      vivos.set(ws, true);
      ws.on('pong', () => vivos.has(ws) && vivos.set(ws, true));
      ws.on('close', (codigoCierre) => {
        vivos.delete(ws);
        app.log.info({ canal, agenteId, codigoCierre }, 'agent socket closed');
      });
      if (canal === 'control') {
        registro.registrarControl({ id: agenteId, tenantId }, ws);
        ws.on('message', (trama, binaria) => leerControl(agenteId, ws, trama, binaria));
      } else if (!registro.adjuntarDatos(agenteId, sesionId, ws)) {
        ws.terminate();
      }
    });
  }

  app.server.on('upgrade', (peticion: IncomingMessage, socket: Duplex, cabeza: Buffer) => {
    // Synchronously, before the lookup's `await`: a peer reset in that window would
    // otherwise be an unhandled `'error'` and take the process down (DEC-111's lesson).
    socket.on('error', ignorar);
    atender(peticion, socket, cabeza).catch(() => socket.destroy());
  });

  // `preClose`, never `onClose`: Fastify's own `server.close()` runs before every
  // `onClose` hook and waits for the upgraded sockets, so closing them there would hang
  // `app.close()`. `preClose` runs first, inside that same close step (DEC-122).
  app.addHook('preClose', async () => {
    cancelarPing();
    registro.cerrarTodo();
  });
}
