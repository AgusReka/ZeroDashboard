import type { FastifyBaseLogger } from 'fastify';
import { conTenantInyectado, type PrismaAislado } from './aislamiento-prisma.js';
import {
  cierreDeResultado,
  estaVencida,
  type ResultadoCorrida,
} from './automatizaciones.js';
import { loadConfig } from './config.js';
import { destinoDeConexion } from './conexion-destino.js';
import { ejecutarConsulta } from './consulta-ejecucion.js';
import { conTenantActivo, type TenantActivo } from './contexto-tenant.js';
import { ErrorCredencialIlegible } from './cripto-credencial.js';
import { prepararSentencia } from './parametros.js';
import { componerSentencia, evaluarVistas } from './plantillas.js';

/**
 * CH-13: the in-process scheduler (DEC-75, X1, X2). One tick reads the active `Tenant`
 * rows, enters each tenant's context from its own row, and runs that tenant's due, active
 * automations through the CH-12 pipeline, unchanged: `evaluarVistas` → `componerSentencia`
 * → `prepararSentencia` → `destinoDeConexion` → `ejecutarConsulta`. Each run writes one
 * `Ejecucion` row holding metadata only.
 *
 * The engine executes the pattern and nothing more (rule 6): there is no new execution
 * surface, no retry, no catch-up of missed fires, and no parallelism. Those belong to
 * CH-17 and CH-18.
 */

/** Time, injected so tests control it. `programar` returns the function that cancels. */
export interface Reloj {
  ahora(): Date;
  programar(ms: number, fn: () => void): () => void;
}

const relojDelSistema: Reloj = {
  ahora: () => new Date(),
  programar: (ms, fn) => {
    const temporizador = setTimeout(fn, ms);
    return () => clearTimeout(temporizador);
  },
};

export interface DependenciasPlanificador {
  /** The extended client: every scoped read and write below is filtered by it (DEC-13). */
  prisma: PrismaAislado;
  /** The deployment zone every schedule is read in (DEC-77). */
  zonaHoraria: string;
  log: FastifyBaseLogger;
  reloj?: Reloj;
}

export interface Planificador {
  /** Evaluates the window `(previous tick, ahora]` and runs what is due in it. */
  ejecutarTick(ahora: Date): Promise<void>;
}

/** The columns one run reads off its automation. `valores` is re-checked on every run. */
interface AutomatizacionACorrer {
  id: string;
  plantillaId: string;
  conexionId: string;
  valores: unknown;
  cron: string;
  creadaEn: Date;
}

export function crearPlanificador({
  prisma,
  zonaHoraria,
  log,
  reloj = relojDelSistema,
}: DependenciasPlanificador): Planificador {
  // The first window opens when the scheduler is built, so nothing that fell due before
  // the process started is caught up (DEC-75; catch-up is CH-17).
  let anterior = reloj.ahora();

  /**
   * Everything before the row is closed. A pre-dial refusal returns before anything is
   * dialled, in the order the design's data flow gives, so nothing reaches the tenant's
   * connection until every check has passed.
   */
  async function resultadoDeCorrida(automatizacion: AutomatizacionACorrer): Promise<ResultadoCorrida> {
    // `Plantilla` is global (DEC-61), so this read is not scoped. The foreign key is
    // RESTRICT and templates are never deleted (DEC-68), so a missing row is corruption.
    const plantilla = await prisma.plantilla.findUniqueOrThrow({
      where: { id: automatizacion.plantillaId },
      select: { sql: true, parametros: true, entidades: true },
    });
    // DEC-71 applies to scheduled runs as well: only this connection's saved verdicts count.
    const filas = await prisma.vistaCanonica.findMany({
      where: { conexionId: automatizacion.conexionId },
      select: { entidad: true, sql: true, estadoValidacion: true },
    });
    const compuerta = evaluarVistas(plantilla.entidades, filas);
    if (!compuerta.ok) {
      return { resultado: 'rechazo', categoria: 'vista-canonica-no-aprobada', entidades: compuerta.entidades };
    }

    // DEC-68 replaces a template in place, so the values accepted at creation may be stale.
    const sql = componerSentencia(plantilla.sql, compuerta.vistas);
    const preparada = prepararSentencia(sql, plantilla.parametros, automatizacion.valores);
    if (!preparada.ok) {
      return { resultado: 'rechazo', categoria: 'valores-invalidos' };
    }

    let destino;
    try {
      destino = await destinoDeConexion(prisma, automatizacion.conexionId);
    } catch (error) {
      if (error instanceof ErrorCredencialIlegible) {
        return { resultado: 'rechazo', categoria: 'credencial-ilegible' };
      }
      throw error;
    }
    if (destino === null) {
      return { resultado: 'rechazo', categoria: 'conexion-no-encontrada' };
    }

    // One page of the existing row ceiling (DEC-19): no new budget. The rows are counted
    // by `cierreDeResultado` and then dropped (D-1 leaning).
    const topeFilas = loadConfig().maxFilasPorConsulta;
    return ejecutarConsulta({
      host: destino.host,
      port: destino.port,
      database: destino.database,
      user: destino.user,
      password: destino.password,
      sentencia: preparada.valor,
      limite: topeFilas,
      desplazamiento: 0,
      topeFilas,
    });
  }

  /** One run: open its row, run it, close the row with closed columns only (X2). */
  async function correr(automatizacion: AutomatizacionACorrer): Promise<void> {
    const iniciadaEn = reloj.ahora();
    // `tenantId` is never written here: the extension injects the active tenant's.
    const { id } = await prisma.ejecucion.create({
      data: conTenantInyectado({ automatizacionId: automatizacion.id, estado: 'en-curso', iniciadaEn }),
      select: { id: true },
    });
    const cierre = cierreDeResultado(await resultadoDeCorrida(automatizacion));
    const finalizadaEn = reloj.ahora();
    await prisma.ejecucion.update({
      where: { id },
      data: { ...cierre, finalizadaEn, duracionMs: finalizadaEn.getTime() - iniciadaEn.getTime() },
    });
    if (cierre.estado === 'fallo') {
      // Closed columns only: never values, SQL, or driver text (rule 5).
      log.warn(
        {
          automatizacionId: automatizacion.id,
          fase: cierre.fase,
          error: cierre.error,
          codigoError: cierre.codigoError,
        },
        'scheduled run failed',
      );
    }
  }

  /** Inside one tenant's context: its active automations, run one after another. */
  async function correrVencidas(desde: Date, hasta: Date): Promise<void> {
    const automatizaciones = await prisma.automatizacion.findMany({
      where: { activo: true },
      select: { id: true, plantillaId: true, conexionId: true, valores: true, cron: true, creadaEn: true },
      orderBy: [{ creadaEn: 'asc' }, { id: 'asc' }],
    });
    for (const automatizacion of automatizaciones) {
      // Never due for an instant before it existed.
      const inicio = automatizacion.creadaEn > desde ? automatizacion.creadaEn : desde;
      if (estaVencida(automatizacion.cron, inicio, hasta, zonaHoraria)) {
        await correr(automatizacion);
      }
    }
  }

  async function ejecutarTick(ahora: Date): Promise<void> {
    const desde = anterior;
    anterior = ahora;
    // `Tenant` is not a scoped model. Its rows are the only source of the tenant ids the
    // scheduler enters (rule 2); a deactivated tenant is skipped whole (DEC-14).
    const tenants = await prisma.tenant.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { id: 'asc' },
    });
    for (const fila of tenants) {
      const tenant: TenantActivo = { id: fila.id, nombre: fila.nombre };
      // Awaited inside the callback, so every query starts inside this context.
      await conTenantActivo(tenant, () => correrVencidas(desde, ahora));
    }
  }

  return { ejecutarTick };
}
