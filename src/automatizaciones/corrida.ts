import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import type { AbridorDeCanales } from '../agente/canal-agente.js';
import type { RechazoPreparacion } from './automatizaciones.js';
import { camposDeDestino, destinoDeConexion } from '../conexiones/conexion-destino.js';
import type { EjecucionExitosa, PeticionEjecucion } from '../ejecucion/consulta-ejecucion.js';
import type { DestinoPostgres } from '../ejecucion/db-probe.js';
import { ErrorCredencialIlegible } from '../compartido/cripto-credencial.js';
import type { EntradaCorreo } from './correo.js';
import { prepararSentencia, type ProblemaParametro, type SentenciaPreparada } from '../ejecucion/parametros.js';
import { componerSentencia, evaluarVistas } from '../plantillas/plantillas.js';

/**
 * CH-42 (DEC-195): the steps of a run that the message preview shares with the scheduler,
 * moved out of `crearPlanificador` unchanged: everything before the dial, the run's page and
 * the renderer input. The scheduler keeps the dial with its retries, the `enviando` marker,
 * the notifier and the `Ejecucion` writes; this module imports none of them, so the preview
 * can reuse it without reaching a sender or a run row.
 */

/** The automation columns the steps read (a subset of the scheduler's own). */
export interface AutomatizacionDeCorrida {
  conexionId: string;
  valores: unknown;
}

/** The template columns a run reads: its statement, and the name and label its email shows. */
export interface PlantillaDeCorrida {
  sql: string;
  parametros: unknown;
  entidades: unknown;
  nombre: string;
  automatizacion: string;
  /** The message texts (CH-39): both set, or the email shows the table. */
  encabezadoMensaje: string | null;
  lineaMensaje: string | null;
}

/**
 * Every check before the dial passed, or the refusal a run records. `problemas` is non-empty
 * only for `valores-invalidos`: the run drops it, the preview answers with it.
 */
export type PreparacionCorrida =
  | { ok: true; sql: string; destino: DestinoPostgres & { id: string }; sentencia: SentenciaPreparada }
  | { ok: false; rechazo: RechazoPreparacion; problemas: ProblemaParametro[] };

/**
 * DEC-71 gate → `componerSentencia` → `prepararSentencia` → `destinoDeConexion`, in this order
 * and through the scoped client, so nothing reaches the tenant's connection until every check
 * has passed. `ErrorCredencialIlegible` becomes the `credencial-ilegible` refusal; any other
 * throw propagates, as it did inside the scheduler.
 */
export async function prepararCorrida(
  prisma: PrismaAislado,
  automatizacion: AutomatizacionDeCorrida,
  plantilla: Pick<PlantillaDeCorrida, 'sql' | 'parametros' | 'entidades'>,
  canales: AbridorDeCanales,
): Promise<PreparacionCorrida> {
  // DEC-71 applies to scheduled runs as well: only this connection's saved verdicts count.
  const filas = await prisma.vistaCanonica.findMany({
    where: { conexionId: automatizacion.conexionId },
    select: { entidad: true, sql: true, estadoValidacion: true },
  });
  const compuerta = evaluarVistas(plantilla.entidades, filas);
  if (!compuerta.ok) {
    return {
      ok: false,
      rechazo: { resultado: 'rechazo', categoria: 'vista-canonica-no-aprobada', entidades: compuerta.entidades },
      problemas: [],
    };
  }

  // DEC-68 replaces a template in place, so the values accepted at creation may be stale.
  const sql = componerSentencia(plantilla.sql, compuerta.vistas);
  const preparada = prepararSentencia(sql, plantilla.parametros, automatizacion.valores);
  if (!preparada.ok) {
    return { ok: false, rechazo: { resultado: 'rechazo', categoria: 'valores-invalidos' }, problemas: preparada.problemas };
  }

  let destino;
  try {
    destino = await destinoDeConexion(prisma, automatizacion.conexionId, canales);
  } catch (error) {
    if (error instanceof ErrorCredencialIlegible) {
      return { ok: false, rechazo: { resultado: 'rechazo', categoria: 'credencial-ilegible' }, problemas: [] };
    }
    throw error;
  }
  if (destino === null) {
    return { ok: false, rechazo: { resultado: 'rechazo', categoria: 'conexion-no-encontrada' }, problemas: [] };
  }
  return { ok: true, sql, destino, sentencia: preparada.valor };
}

/**
 * One page of the existing row ceiling (DEC-19), from row 0: no new budget. The run and the
 * preview read the same rows, so `hayMas` and the minimum check agree.
 */
export function peticionDeCorrida(
  preparada: Extract<PreparacionCorrida, { ok: true }>,
  topeFilas: number,
): PeticionEjecucion {
  return {
    ...camposDeDestino(preparada.destino),
    sentencia: preparada.sentencia,
    limite: topeFilas,
    desplazamiento: 0,
    topeFilas,
  };
}

/**
 * The renderer input of a successful result (CH-39, DEC-188): the template's texts only when
 * both are set, else `mensaje` null and the table. `fecha` is the run's start, or the
 * preview's own instant; `zona` is the deployment zone.
 */
export function entradaDeCorreo(
  plantilla: PlantillaDeCorrida,
  resultado: EjecucionExitosa,
  fecha: Date,
  zona: string,
): EntradaCorreo {
  const mensaje =
    plantilla.encabezadoMensaje !== null && plantilla.lineaMensaje !== null
      ? { encabezado: plantilla.encabezadoMensaje, linea: plantilla.lineaMensaje }
      : null;
  return {
    nombre: plantilla.nombre,
    automatizacion: plantilla.automatizacion,
    columnas: resultado.columnas,
    filas: resultado.filas,
    hayMas: resultado.paginacion.hayMas,
    fecha,
    zona,
    mensaje,
  };
}
