import type { CodigoErrorAgente } from '../agente-protocolo.js';
import type { MotivoFin } from './agente.js';
import type { CodigoSalida } from './arranque.js';
import type { VariableAgente } from './config.js';

/**
 * CH-19c2 (DEC-123, rule 5): the agent's own log, one JSON line per event. The event union
 * and each event's fields are closed: a line never carries the token, the URL, a host, a
 * port, a `sesionId`, frame bytes or any `error.message`. The union grows per PR; this one
 * holds the session events of PR 2, the control-loop events of PR 3, and the process events
 * of PR 4 (`error-interno` came early: its sanitized `nombreError` is case G3). `estado` is the HTTP status of a refused
 * upgrade and `codigoCierre` a WebSocket close code: numbers, never a text from the peer.
 */
export type EventoLog =
  | { evento: 'sesion-abierta' }
  | { evento: 'sesion-cerrada' }
  | { evento: 'sesion-fallida'; codigo: CodigoErrorAgente }
  | { evento: 'destino-no-permitido' }
  | { evento: 'tope-de-sesiones' }
  | { evento: 'mensaje-invalido' }
  | { evento: 'control-conectado' }
  | { evento: 'sin-ping' }
  | { evento: 'control-rechazado'; estado: number }
  | { evento: 'control-cerrado'; codigoCierre: number }
  | { evento: 'reconexion-programada'; intento: number; esperaMs: number }
  | { evento: 'configuracion-invalida'; variable: VariableAgente }
  | { evento: 'apagado'; senal: 'SIGTERM' | 'SIGINT' }
  | { evento: 'fin'; motivo: MotivoFin; codigoSalida: CodigoSalida }
  | { evento: 'error-interno'; nombreError: string };

export type Log = (e: EventoLog) => void;

type Nivel = 'info' | 'warn' | 'error';
type Campos<E extends EventoLog['evento']> = Exclude<keyof Extract<EventoLog, { evento: E }>, 'evento'>;

/**
 * Each event's level and the only fields copied to its line. The line is built from this
 * list, never from the object, so a spread can never add a field.
 */
const EVENTOS: { readonly [E in EventoLog['evento']]: readonly [Nivel, ...Campos<E>[]] } = {
  'sesion-abierta': ['info'],
  'sesion-cerrada': ['info'],
  'sesion-fallida': ['warn', 'codigo'],
  'destino-no-permitido': ['warn'],
  'tope-de-sesiones': ['warn'],
  'mensaje-invalido': ['warn'],
  'control-conectado': ['info'],
  'sin-ping': ['warn'],
  'control-rechazado': ['warn', 'estado'],
  'control-cerrado': ['warn', 'codigoCierre'],
  'reconexion-programada': ['info', 'intento', 'esperaMs'],
  'configuracion-invalida': ['error', 'variable'],
  apagado: ['info', 'senal'],
  fin: ['info', 'motivo', 'codigoSalida'],
  'error-interno': ['error', 'nombreError'],
};

/** A class name such as `TypeError` passes; anything else (a message, say) becomes `Error`. */
const NOMBRE_ERROR = /^[A-Za-z]{1,40}$/;
const sanear = (campo: string, valor: unknown): unknown =>
  campo !== 'nombreError' || (typeof valor === 'string' && NOMBRE_ERROR.test(valor)) ? valor : 'Error';

/** `{"ts","nivel","evento",...fields}` plus a newline, to `escribir` (default: stdout). */
export function crearLog(
  escribir: (linea: string) => void = (linea) => void process.stdout.write(linea),
  ahora: () => Date = () => new Date(),
): Log {
  return (e) => {
    if (!Object.hasOwn(EVENTOS, e.evento)) return;
    const [nivel, ...campos] = EVENTOS[e.evento];
    const linea: Record<string, unknown> = { ts: ahora().toISOString(), nivel, evento: e.evento };
    for (const campo of campos) linea[campo] = sanear(campo, (e as Record<string, unknown>)[campo]);
    escribir(JSON.stringify(linea) + '\n');
  };
}
