import { connect, type Socket } from 'node:net';
import { WebSocket, type ClientOptions, type RawData } from 'ws';
import type { SesionFallida } from '../agente-protocolo.js';
import type { ConfigAgente } from './config.js';
import type { Destino } from './destinos.js';
import { esperaReconexion } from './espera.js';
import { LIMITES_AGENTE } from './limites.js';
import type { Log } from './log.js';
import { opcionesSocket, validarUrlServidor } from './politica-tls.js';
import type { Programar } from './puente.js';
import { crearSesiones } from './sesiones.js';

/**
 * CH-19c2 (DEC-113, DEC-122, DEC-123 A3): the agent's control loop. It dials the engine's
 * control channel, opens one bridge per `apertura-sesion`, and redials with backoff after
 * any loss, except for the engine's terminal answers: 401 or 403 on the upgrade and close
 * 4002 (credentials), close 4001 (another instance holds the token). Sessions do not
 * depend on the control socket, so a control drop leaves them running.
 */
export type MotivoFin = 'detenido' | 'credenciales-rechazadas' | 'agente-revocado' | 'reemplazado';

export interface DependenciasAgente {
  config: ConfigAgente;
  log: Log;
  /** Default: a plain `setTimeout`, not `unref`, so the agent stays alive while it waits. */
  programar?: Programar;
  /** Default: `Math.random`. */
  aleatorio?: () => number;
  /** Default: `new WebSocket(url, op)`. */
  abrirSocket?: (url: URL, op: ClientOptions) => WebSocket;
  /** Default: `net.connect` to the allowlist entry. */
  abrirReplica?: (d: Destino) => Socket;
}

export interface Agente {
  /** Resolves once with the first motive, after the sessions are closed. */
  readonly terminado: Promise<MotivoFin>;
  /** Stops for good: no redial, control and data close with 1001. Idempotent. */
  detener(): void;
}

const CIERRE_SALIDA = 1001;
const CIERRE_TIPO_INVALIDO = 1003;
const CIERRE_POLITICA = 1008;
const CIERRES_TERMINALES = new Map<number, MotivoFin>([[4001, 'reemplazado'], [4002, 'agente-revocado']]);
const CLAVES_APERTURA = 'host,puerto,sesionId,tipo';
const ignorar = (): void => {};

function programarReloj(ms: number, fn: () => void): () => void {
  const reloj = setTimeout(fn, ms);
  return () => clearTimeout(reloj);
}

/** A parsed JSON object, or null for anything else. The text itself is never logged. */
function leerObjeto(trama: RawData): Record<string, unknown> | null {
  try {
    const valor: unknown = JSON.parse(String(trama));
    return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Throws `ErrorConfig` before any socket if the origin breaks the TLS rule. */
export function iniciarAgente(d: DependenciasAgente): Agente {
  const origen = validarUrlServidor(d.config.servidor.href);
  const { log, config } = d;
  const programar = d.programar ?? programarReloj;
  const aleatorio = d.aleatorio ?? Math.random;
  const abrirSocket = d.abrirSocket ?? ((url, op) => new WebSocket(url, op));
  const abrir = (ruta: string, maxPayload: number) => abrirSocket(new URL(ruta, origen), opcionesSocket(config.token, maxPayload));

  let control: WebSocket | null = null;
  let intento = 0;
  let fin: MotivoFin | null = null;
  let cancelarEspera = ignorar;
  let resolver: (motivo: MotivoFin) => void = ignorar;
  const terminado = new Promise<MotivoFin>((listo) => (resolver = listo));

  const sesiones = crearSesiones({
    destinos: config.destinos,
    log,
    programar,
    abrirReplica: d.abrirReplica ?? ((destino) => connect({ host: destino.host, port: destino.puerto })),
    // The id passed `FORMATO_SESION` in `sesiones.abrir` before it reaches this URL.
    abrirDatos: (sesionId) => abrir(`/agente/datos/${sesionId}`, LIMITES_AGENTE.tramaDatos),
    // Best effort: dropped unless the control socket is open; no queue, no retry.
    informar: (sesionId, codigo) => {
      if (control?.readyState !== WebSocket.OPEN) return;
      control.send(JSON.stringify({ tipo: 'sesion-fallida', sesionId, codigo } satisfies SesionFallida));
    },
  });

  function terminar(motivo: MotivoFin): void {
    if (fin !== null) return;
    fin = motivo;
    cancelarEspera();
    const ordenado = motivo === 'detenido';
    if (ordenado) control?.close(CIERRE_SALIDA);
    else control?.terminate();
    void sesiones.cerrarTodas(ordenado ? 'ordenado' : 'inmediato').then(() => resolver(motivo));
  }

  /** Text JSON with the exact `apertura-sesion` keys. A closed switch on `tipo`: 19d1 adds a case. */
  function despachar(ws: WebSocket, trama: RawData, binaria: boolean): void {
    if (binaria) return ws.close(CIERRE_TIPO_INVALIDO);
    const mensaje = leerObjeto(trama);
    switch (mensaje?.tipo) {
      case 'apertura-sesion':
        if (Object.keys(mensaje).sort().join(',') !== CLAVES_APERTURA) break;
        // A malformed `sesionId` is ignored there (`mensaje-invalido`), and the socket stays open.
        return sesiones.abrir(mensaje as { sesionId: string; host: unknown; puerto: unknown });
    }
    log({ evento: 'mensaje-invalido' });
    ws.close(CIERRE_POLITICA);
  }

  function marcar(): void {
    if (fin !== null) return;
    const ws = abrir('/agente/control', LIMITES_AGENTE.tramaControl);
    control = ws;
    let estado = 0;
    let cancelarVigilancia = ignorar;
    let cancelarEstable = ignorar;
    /** Re-armed on every engine ping; a silent control socket is terminated at 50 s. */
    const vigilar = (): void => {
      cancelarVigilancia();
      cancelarVigilancia = programar(LIMITES_AGENTE.vigilanciaPingMs, () => {
        log({ evento: 'sin-ping' });
        ws.terminate();
      });
    };
    // `'close'` always follows an error, so the error itself (its message names the host) is dropped.
    ws.on('error', ignorar);
    ws.on('unexpected-response', (_peticion, respuesta) => {
      estado = respuesta.statusCode ?? 0;
      log({ evento: 'control-rechazado', estado });
      ws.terminate();
    });
    ws.on('open', () => {
      log({ evento: 'control-conectado' });
      vigilar();
      cancelarEstable = programar(LIMITES_AGENTE.controlEstableMs, () => (intento = 0));
    });
    ws.on('ping', vigilar);
    ws.on('message', (trama, binaria) => despachar(ws, trama, binaria));
    ws.on('close', (codigo) => {
      cancelarVigilancia();
      cancelarEstable();
      if (fin !== null || ws !== control) return;
      log({ evento: 'control-cerrado', codigoCierre: codigo });
      if (estado === 401 || estado === 403) return terminar('credenciales-rechazadas');
      const terminal = estado === 0 ? CIERRES_TERMINALES.get(codigo) : undefined;
      if (terminal !== undefined) return terminar(terminal);
      const esperaMs = esperaReconexion(intento++, aleatorio);
      log({ evento: 'reconexion-programada', intento, esperaMs });
      cancelarEspera = programar(esperaMs, marcar);
    });
  }

  marcar();
  return { terminado, detener: () => terminar('detenido') };
}
