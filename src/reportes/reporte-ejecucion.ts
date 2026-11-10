import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import type { AbridorDeCanales } from '../agente/canal-agente.js';
import {
  ejecutarSobreVistas,
  type PedidoSobreVistas,
  type RespuestaSobreVistas,
} from '../ejecucion/ejecucion-sobre-vistas.js';
import { declaracionDelPeriodo, fechaDelPeriodo, topeEfectivo, type Periodo, type Visualizacion } from './reportes.js';

/**
 * CH-48 (DEC-198, DEC-201): the one report run, shared by the console test
 * (`reporte-prueba.ts`) and the client panel (`src/panel/panel-tablero-rutas.ts`). Moved out
 * of `reporte-prueba.ts` with no change of behavior: choose the days, compute the date in the
 * deployment zone (DEC-77) and bind it as a driver parameter (rule 4), ask for the
 * visualization's ceiling plus one and the first page only, and run through the engine path
 * with the DEC-71 gate. Each caller keeps its own answer shape and its own audit choice.
 */

/**
 * CH-48 (DEC-198): the requested days when declared, the first declared when none is
 * requested. A value on a report with no period, or one it did not declare, is a refusal.
 * `null` means the report has no period and none was asked for.
 */
export function diasDelPedido(periodo: Periodo | null, dias: number | undefined): number | null | 'rechazo' {
  if (periodo === null) return dias === undefined ? null : 'rechazo';
  if (dias === undefined) return periodo.dias[0];
  return periodo.dias.includes(dias) ? dias : 'rechazo';
}

/** What a run needs from a report: a stored one read back fail-closed, or a validated form body. */
export interface ReporteAEjecutar {
  id: string | null;
  sql: string;
  entidades: unknown;
  visualizacion: Visualizacion;
  periodo: Periodo | null;
}

/** The deployment's zone and row cap, the agent channels, and an optional clock for tests. */
export interface ContextoReporte {
  zonaHoraria: string;
  topeFilas: number;
  canales: AbridorDeCanales;
  ahora?: () => Date;
}

export type ResultadoReporte =
  | { tipo: 'dias-rechazados' }
  | { tipo: 'respuesta'; respuesta: RespuestaSobreVistas; periodo: { dias: number; desde: string } | null };

/** The one report run: days, then the date, then `valores`, `topeEfectivo`, `limite = tope + 1`, first page. */
export async function ejecutarReporte(
  app: FastifyInstance,
  prisma: PrismaAislado,
  request: FastifyRequest,
  reporte: ReporteAEjecutar,
  pedido: { conexionId: string; dias?: number },
  contexto: ContextoReporte,
  auditoria: PedidoSobreVistas['auditoria'],
  mensajeFallo: string,
): Promise<ResultadoReporte> {
  const dias = diasDelPedido(reporte.periodo, pedido.dias);
  if (dias === 'rechazo') {
    return { tipo: 'dias-rechazados' };
  }
  const ahora = contexto.ahora?.() ?? new Date();
  const periodo = dias === null ? null : { dias, desde: fechaDelPeriodo(ahora, contexto.zonaHoraria, dias) };
  const valores: Record<string, unknown> =
    reporte.periodo === null || periodo === null ? {} : { [reporte.periodo.parametro]: periodo.desde };
  const tope = topeEfectivo(reporte.visualizacion, contexto.topeFilas);

  const respuesta = await ejecutarSobreVistas(app, prisma, request, {
    conexionId: pedido.conexionId,
    sql: reporte.sql,
    parametros: declaracionDelPeriodo(reporte.periodo),
    entidades: reporte.entidades,
    valores,
    // One more than the cap is asked for, so the engine reports `corte` when the cap is what
    // ended the result (DEC-18): the page served and the ceiling are both `tope`.
    limite: tope + 1,
    desplazamiento: 0,
    topeFilas: tope,
    auditoria,
    mensajeFallo,
  }, contexto.canales);
  return { tipo: 'respuesta', respuesta, periodo };
}
