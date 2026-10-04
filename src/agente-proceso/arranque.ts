import { iniciarAgente, type Agente, type MotivoFin } from './agente.js';
import { ErrorConfig, leerConfig } from './config.js';
import { LIMITES_AGENTE } from './limites.js';
import { crearLog } from './log.js';
import type { Programar } from './puente.js';

/**
 * CH-19c2 (DEC-123 A3): the agent's process shell. It reads the configuration, starts the
 * control loop and turns its end into an exit code: 0 clean stop, 1 configuration, 2
 * credentials rejected or agent revoked, 3 replaced by another instance. A crash also
 * exits 1, Node's own code for it (a known design-level choice: no code is added).
 */
export type CodigoSalida = 0 | 1 | 2 | 3;

export const CODIGO_SALIDA: Readonly<Record<MotivoFin, CodigoSalida>> = {
  detenido: 0,
  'credenciales-rechazadas': 2,
  'agente-revocado': 2,
  reemplazado: 3,
};

type Senal = 'SIGTERM' | 'SIGINT';

export interface DependenciasArranque {
  env: Readonly<Record<string, string | undefined>>;
  proceso: { on(evento: Senal | 'uncaughtException' | 'unhandledRejection', fn: (x?: unknown) => void): unknown };
  /** The JSON-lines log (default: stdout). */
  escribir?: (linea: string) => void;
  /** Configuration and crash lines (default: stderr). */
  escribirError?: (linea: string) => void;
  /** Default: flushes stdout and stderr, then `process.exit`. */
  salir?: (codigo: CodigoSalida) => void;
  programar?: Programar;
  aleatorio?: () => number;
  iniciar?: typeof iniciarAgente;
}

/** Waits for both streams to flush the lines already written: pipes can be asynchronous. */
function salirDelProceso(codigo: CodigoSalida): void {
  process.stdout.write('', () => process.stderr.write('', () => process.exit(codigo)));
}

function programarReloj(ms: number, fn: () => void): () => void {
  const reloj = setTimeout(fn, ms);
  return () => clearTimeout(reloj);
}

/** The class name only: `error.message` can carry a host and a port (rule 5). */
const nombreDe = (e: unknown): string => (typeof e === 'object' && e !== null && e.constructor?.name) || 'Error';

export function ejecutarAgente(d: DependenciasArranque): void {
  const log = crearLog(d.escribir);
  const logError = crearLog(d.escribirError ?? ((linea) => void process.stderr.write(linea)));
  const salirAhora = d.salir ?? salirDelProceso;
  const programar = d.programar ?? programarReloj;
  let saliendo = false;
  const salir = (codigo: CodigoSalida): void => {
    if (saliendo) return;
    saliendo = true;
    salirAhora(codigo);
  };
  const terminar = (motivo: MotivoFin): void => {
    if (saliendo) return;
    log({ evento: 'fin', motivo, codigoSalida: CODIGO_SALIDA[motivo] });
    salir(CODIGO_SALIDA[motivo]);
  };
  // Replaces Node's printout, which would carry `error.message` and the stack to stderr.
  const fallar = (e: unknown): void => {
    if (saliendo) return;
    logError({ evento: 'error-interno', nombreError: nombreDe(e) });
    salir(1);
  };
  d.proceso.on('uncaughtException', fallar);
  d.proceso.on('unhandledRejection', fallar);

  let agente: Agente;
  try {
    agente = (d.iniciar ?? iniciarAgente)({ config: leerConfig(d.env), log, programar, aleatorio: d.aleatorio });
  } catch (e) {
    if (!(e instanceof ErrorConfig)) return fallar(e);
    // Before any socket: names the variable, never its value.
    logError({ evento: 'configuracion-invalida', variable: e.variable });
    return salir(1);
  }
  void agente.terminado.then(terminar);

  /** First signal: no redial, control and data close with 1001, at most 5 s. Later ones are ignored. */
  let apagando = false;
  const alApagar = (senal: Senal) => (): void => {
    if (apagando) return;
    apagando = true;
    log({ evento: 'apagado', senal });
    programar(LIMITES_AGENTE.apagadoMs, () => terminar('detenido'));
    agente.detener();
  };
  d.proceso.on('SIGTERM', alApagar('SIGTERM'));
  d.proceso.on('SIGINT', alApagar('SIGINT'));
}
