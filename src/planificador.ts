import type { FastifyBaseLogger } from 'fastify';
import { conTenantInyectado, type PrismaAislado } from './aislamiento-prisma.js';
import {
  cierreConNotificacion,
  cierreDeResultado,
  decidirNotificacion,
  esFalloReintentable,
  estaVencida,
  type FalloInesperado,
  type ResultadoCorrida,
  type SalidaNotificacion,
} from './automatizaciones.js';
import { loadConfig } from './config.js';
import { destinoDeConexion } from './conexion-destino.js';
import { ejecutarConsulta, type PeticionEjecucion, type ResultadoEjecucion } from './consulta-ejecucion.js';
import { conTenantActivo, type TenantActivo } from './contexto-tenant.js';
import { componerCorreo } from './correo.js';
import { ErrorCredencialIlegible } from './cripto-credencial.js';
import type { Notificador } from './notificador.js';
import { prepararSentencia } from './parametros.js';
import { componerSentencia, evaluarVistas } from './plantillas.js';

/**
 * CH-13: the in-process scheduler (DEC-75, X1, X2). One tick reads the active `Tenant`
 * rows, enters each tenant's context from its own row, and runs that tenant's due, active
 * automations through the CH-12 pipeline, unchanged: `evaluarVistas` → `componerSentencia`
 * → `prepararSentencia` → `destinoDeConexion` → `ejecutarConsulta`. Each run writes one
 * `Ejecucion` row holding metadata only.
 *
 * CH-14 adds one step after the query (X3, N1): while the rows are in memory, the run
 * decides whether to notify, renders the message, sends it once, and closes its row with
 * the outcome in the same single write. The rows are dropped after the render.
 *
 * CH-17a adds the boot sweep (DEC-99): before the first tick, rows a stopped process left
 * `en-curso` are closed as `fallo`/`interrumpida` and never re-executed. It also adds the
 * overlap check (DEC-96): an automation with a run still `en-curso` is skipped as `omitida`.
 *
 * CH-17b adds a bounded retry of the dial alone (X5, DEC-97, DEC-98): a transient
 * connection failure is dialled again after a fixed pause on the injected clock, up to the
 * injected policy's cap, inside the same run and its one row. `intentos` records the dials
 * made (DEC-103), and `detener()` cancels a pending pause (DEC-104).
 *
 * The engine executes the pattern and nothing more (rule 6): there is no new execution
 * surface and no parallelism (CH-18). Missed fires are never caught up and coalesced fires
 * leave no mark: that is a limit of the artifact (DEC-95), not pending work.
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
  /**
   * CH-14: the email transport (DEC-81). Absent or `null` exactly when SMTP is unset, and
   * a run with rows and a recipient then records `no-configurada`.
   */
  notificador?: Notificador | null;
  /** CH-17b: the connection retry policy (DEC-98). Absent means `SIN_REINTENTOS`. */
  reintentos?: PoliticaReintentos;
}

/**
 * CH-17b (DEC-98, DEC-106): how many connection attempts one run makes in total, and the
 * fixed pause between two of them. `intentos: 1` is no retry.
 */
export interface PoliticaReintentos {
  intentos: number;
  pausaMs: number;
}

/** The default: one attempt and no pause, so a planner built without a policy never retries. */
export const SIN_REINTENTOS: PoliticaReintentos = { intentos: 1, pausaMs: 0 };

/**
 * The dials one run has made, raised before each one (DEC-103). `null` until the first,
 * so a run refused or broken before dialling records no count.
 */
interface ConteoIntentos {
  intentos: number | null;
}

export interface Planificador {
  /** CH-17a (DEC-102): the boot sweep, then `iniciar()`. Never rejects. */
  arrancar(): Promise<void>;
  /**
   * CH-17a (DEC-99): closes every `en-curso` row of every tenant, deactivated ones
   * included, as `fallo`/`interrumpida`. Fail-open: it logs and never rejects.
   */
  barrerInterrumpidas(): Promise<void>;
  /** Arms the first tick, one second past the next whole minute. A no-op once stopped. */
  iniciar(): void;
  /**
   * Clears the pending timer and waits for an in-flight tick; nothing is armed after it.
   * CH-17b (DEC-104): a pending retry pause is cancelled, not waited for.
   */
  detener(): Promise<void>;
  /** Evaluates the window `(previous tick, ahora]` and runs what is due in it. */
  ejecutarTick(ahora: Date): Promise<void>;
}

const MINUTO_MS = 60_000;
/** Ticks land one second past the minute, so a fire at `hh:mm:00` is inside the window. */
const DESFASE_MS = 1_000;

/** Milliseconds from `ahora` to the next instant at `hh:mm:01`, always in the future. */
function hastaElProximoTick(ahora: Date): number {
  const resto = (((ahora.getTime() - DESFASE_MS) % MINUTO_MS) + MINUTO_MS) % MINUTO_MS;
  return MINUTO_MS - resto;
}

/** Only the thrown value's class name reaches a log: never its message or stack. */
function nombreDeError(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/** A throw recorded as a value, whether it came from the pipeline or the notify step. */
function esExcepcion(valor: ResultadoCorrida | SalidaNotificacion): valor is FalloInesperado {
  return typeof valor === 'object' && valor !== null && valor.resultado === 'excepcion';
}

/**
 * DEC-99: how the boot sweep closes a row a stopped process left `en-curso`. Nothing ran
 * to completion, so every outcome column is null; `finalizadaEn` is set by the sweep.
 * CH-17b (DEC-103): `intentos` is null too, stated like the other outcome columns.
 */
const CIERRE_INTERRUMPIDA = {
  estado: 'fallo',
  error: 'interrumpida',
  duracionMs: null,
  filas: null,
  corte: null,
  fase: null,
  codigoError: null,
  notificacion: null,
  intentos: null,
} as const;

/**
 * DEC-96, DEC-102: the row a run skipped by an overlap writes. Nothing ran, so every
 * outcome column is null and the row starts and ends at the same instant. CH-17b
 * (DEC-103): nothing was dialled, so `intentos` is null.
 */
const CIERRE_OMITIDA = {
  estado: 'omitida',
  error: 'solapamiento',
  duracionMs: null,
  filas: null,
  corte: null,
  fase: null,
  codigoError: null,
  notificacion: null,
  intentos: null,
} as const;

/** The columns one run reads off its automation. `valores` is re-checked on every run. */
interface AutomatizacionACorrer {
  id: string;
  plantillaId: string;
  conexionId: string;
  valores: unknown;
  cron: string;
  creadaEn: Date;
  /** Read from the run's own scoped row: never a global fallback (rule 2, DEC-82). */
  destinatario: string | null;
}

/** The template columns a run reads: its statement, and the name and label its email shows. */
interface PlantillaACorrer {
  sql: string;
  parametros: unknown;
  entidades: unknown;
  nombre: string;
  automatizacion: string;
}

export function crearPlanificador({
  prisma,
  zonaHoraria,
  log,
  reloj = relojDelSistema,
  notificador = null,
  reintentos = SIN_REINTENTOS,
}: DependenciasPlanificador): Planificador {
  // The first window opens when the scheduler is built, so nothing that fell due before
  // the process started is caught up (DEC-75; no catch-up is an artifact limit, DEC-95).
  let anterior = reloj.ahora();

  /**
   * Everything before the row is closed. A pre-dial refusal returns before anything is
   * dialled, in the order the design's data flow gives, so nothing reaches the tenant's
   * connection until every check has passed.
   */
  async function resultadoDeCorrida(
    automatizacion: AutomatizacionACorrer,
    plantilla: PlantillaACorrer,
    conteo: ConteoIntentos,
  ): Promise<ResultadoCorrida> {
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
    // by `cierreDeResultado`, rendered by the notify step, and then dropped (D-1 leaning).
    const topeFilas = loadConfig().maxFilasPorConsulta;
    return conectarConReintentos(
      automatizacion.id,
      {
        host: destino.host,
        port: destino.port,
        database: destino.database,
        user: destino.user,
        password: destino.password,
        sentencia: preparada.valor,
        limite: topeFilas,
        desplazamiento: 0,
        topeFilas,
      },
      conteo,
    );
  }

  /**
   * CH-17b (DEC-97, DEC-98, DEC-104): the dial, dialled again after the policy's pause
   * while it fails with a transient connection category. Only this call repeats: the
   * checks above ran once and are not re-run. `conteo` is raised before each dial, so a
   * throw mid-loop still leaves the attempts reached. The loop ends at the cap, on any
   * other outcome, or once the planner is stopping; the last attempt's result is returned.
   */
  async function conectarConReintentos(
    automatizacionId: string,
    peticion: PeticionEjecucion,
    conteo: ConteoIntentos,
  ): Promise<ResultadoEjecucion> {
    for (;;) {
      const intentos = (conteo.intentos ?? 0) + 1;
      conteo.intentos = intentos;
      const resultado = await ejecutarConsulta(peticion);
      // Success, or a failure DEC-97 does not retry: this attempt is the last.
      if (resultado.resultado === 'ok' || !esFalloReintentable(resultado)) {
        return resultado;
      }
      // The cap is reached, or `detener()` was called while this attempt was dialling.
      if (intentos >= reintentos.intentos || detenido) {
        return resultado;
      }
      // Closed fields only (rule 5): the attempt number and the category.
      log.info({ automatizacionId, intentos, error: resultado.categoria }, 'scheduled run connection retry');
      if (!(await pausar(reintentos.pausaMs))) {
        // `detener()` cancelled the pause: no further attempt (DEC-104).
        return resultado;
      }
    }
  }

  /**
   * CH-17b (DEC-98, DEC-104): the pause between two dials, on the injected clock. Resolves
   * `true` when the timer fires, and `false` at once when `detener()` cancels it or the
   * planner is already stopped. The tick is serial, so at most one pause is pending.
   */
  function pausar(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (detenido) {
        resolve(false);
        return;
      }
      const cancelarTemporizador = reloj.programar(ms, () => {
        cancelarPausa = null;
        resolve(true);
      });
      cancelarPausa = () => {
        cancelarTemporizador();
        cancelarPausa = null;
        resolve(false);
      };
    });
  }

  /**
   * CH-14: the notify step, between the query and the close (DEC-83 precedence). A message
   * is rendered and sent only when `decidirNotificacion` says so; otherwise the omission
   * is the outcome. A throw here, even a synchronous one from `enviar`, becomes a value, so
   * the row still closes (`error-interno`) instead of staying `en-curso`.
   */
  async function notificar(
    automatizacion: AutomatizacionACorrer,
    plantilla: PlantillaACorrer | null,
    resultado: ResultadoCorrida,
    iniciadaEn: Date,
  ): Promise<SalidaNotificacion> {
    const decision = decidirNotificacion(resultado, automatizacion.destinatario, notificador !== null);
    if (!decision.enviar) {
      return decision.notificacion;
    }
    try {
      if (resultado.resultado !== 'ok' || plantilla === null || notificador === null) {
        // Unreachable: a send is only decided for a successful query with a notifier.
        throw new Error('notificar: envío decidido sin resultado, plantilla o notificador');
      }
      const correo = componerCorreo({
        nombre: plantilla.nombre,
        automatizacion: plantilla.automatizacion,
        columnas: resultado.columnas,
        filas: resultado.filas,
        hayMas: resultado.paginacion.hayMas,
        fecha: iniciadaEn,
        zona: zonaHoraria,
      });
      return await notificador.enviar({ para: decision.para, ...correo });
    } catch (error) {
      return { resultado: 'excepcion', error };
    }
  }

  /**
   * One run: open its row, run it, notify, and close the row once with closed columns only
   * (X2). A throw from the pipeline closes the row as `error-interno`; `previo` is a throw
   * that happened before the run could start (an unreadable stored schedule), recorded the
   * same way.
   *
   * CH-17a (DEC-96): first, the overlap check. While a previous run of this automation is
   * still `en-curso`, nothing is composed, dialled or sent; one `omitida` row records the
   * skip. The lookup goes through the scoped client, so another tenant's row is never seen.
   * A throw here reaches the per-run catch in `correrVencidas`, and the run does not start.
   */
  async function correr(automatizacion: AutomatizacionACorrer, previo?: FalloInesperado): Promise<void> {
    const iniciadaEn = reloj.ahora();
    const anteriorEnCurso = await prisma.ejecucion.findFirst({
      where: { automatizacionId: automatizacion.id, estado: 'en-curso' },
      select: { id: true },
    });
    if (anteriorEnCurso !== null) {
      await prisma.ejecucion.create({
        data: conTenantInyectado({
          automatizacionId: automatizacion.id,
          ...CIERRE_OMITIDA,
          iniciadaEn,
          finalizadaEn: iniciadaEn,
        }),
        select: { id: true },
      });
      // Closed columns only (rule 5).
      log.warn(
        { automatizacionId: automatizacion.id, error: CIERRE_OMITIDA.error },
        'scheduled run skipped: previous run still en-curso',
      );
      return;
    }
    // `tenantId` is never written here: the extension injects the active tenant's.
    const { id } = await prisma.ejecucion.create({
      data: conTenantInyectado({ automatizacionId: automatizacion.id, estado: 'en-curso', iniciadaEn }),
      select: { id: true },
    });
    let resultado: ResultadoCorrida;
    let plantilla: PlantillaACorrer | null = null;
    const conteo: ConteoIntentos = { intentos: null };
    if (previo !== undefined) {
      resultado = previo;
    } else {
      try {
        // `Plantilla` is global (DEC-61), so this read is not scoped. The foreign key is
        // RESTRICT and templates are never deleted (DEC-68), so a missing row is corruption.
        plantilla = await prisma.plantilla.findUniqueOrThrow({
          where: { id: automatizacion.plantillaId },
          select: { sql: true, parametros: true, entidades: true, nombre: true, automatizacion: true },
        });
        resultado = await resultadoDeCorrida(automatizacion, plantilla, conteo);
      } catch (error) {
        resultado = { resultado: 'excepcion', error };
      }
    }
    const salida = await notificar(automatizacion, plantilla, resultado, iniciadaEn);
    const cierre = cierreConNotificacion(cierreDeResultado(resultado), salida);
    // Read after the send, so the duration includes it; then the row's only close.
    const finalizadaEn = reloj.ahora();
    await prisma.ejecucion.update({
      where: { id },
      data: {
        ...cierre,
        intentos: conteo.intentos,
        finalizadaEn,
        duracionMs: finalizadaEn.getTime() - iniciadaEn.getTime(),
      },
    });
    if (cierre.estado === 'fallo') {
      // The throw, if any, from the pipeline or from the notify step: only its name is logged.
      const excepcion = [resultado, salida].find(esExcepcion);
      // Closed columns only: never values, SQL, driver or SMTP text, or the recipient (rule 5).
      log.warn(
        {
          automatizacionId: automatizacion.id,
          fase: cierre.fase,
          error: cierre.error,
          codigoError: cierre.codigoError,
          intentos: conteo.intentos,
          ...(excepcion ? { nombreError: nombreDeError(excepcion.error) } : {}),
        },
        'scheduled run failed',
      );
    }
  }

  /**
   * Inside one tenant's context: its active automations, run one after another. Each run
   * has its own catch, so one failure never stops a sibling (a per-run catch only, not the
   * CH-18 isolation guarantee).
   */
  async function correrVencidas(desde: Date, hasta: Date): Promise<void> {
    const automatizaciones = await prisma.automatizacion.findMany({
      where: { activo: true },
      select: {
        id: true,
        plantillaId: true,
        conexionId: true,
        valores: true,
        cron: true,
        creadaEn: true,
        destinatario: true,
      },
      orderBy: [{ creadaEn: 'asc' }, { id: 'asc' }],
    });
    for (const automatizacion of automatizaciones) {
      // Never due for an instant before it existed.
      const inicio = automatizacion.creadaEn > desde ? automatizacion.creadaEn : desde;
      let vencida: boolean;
      let previo: FalloInesperado | undefined;
      try {
        vencida = estaVencida(automatizacion.cron, inicio, hasta, zonaHoraria);
      } catch (error) {
        // A stored schedule that is not standard cron is corruption: recorded, not skipped.
        vencida = true;
        previo = { resultado: 'excepcion', error };
      }
      if (!vencida) {
        continue;
      }
      try {
        await correr(automatizacion, previo);
      } catch (error) {
        // Only the overlap lookup and the row writes reach here; the run could not be
        // recorded. A failed lookup starts nothing (DEC-96). A row whose close failed stays
        // `en-curso` until the next boot sweep (DEC-99) and is skipped as `omitida` meanwhile.
        log.error(
          { automatizacionId: automatizacion.id, error: 'error-interno', nombreError: nombreDeError(error) },
          'scheduled run could not be recorded',
        );
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

  // The timer: a self-rescheduling `setTimeout`, so ticks never overlap and a slow tick
  // loses no fire (the next window covers the gap).
  let cancelar: (() => void) | null = null;
  let enCurso: Promise<void> | null = null;
  let detenido = false;
  // CH-17b: cancels the pending retry pause, if any; separate from the tick's `cancelar`.
  let cancelarPausa: (() => void) | null = null;

  function programarSiguiente(): void {
    if (!detenido) {
      cancelar = reloj.programar(hastaElProximoTick(reloj.ahora()), disparar);
    }
  }

  function disparar(): void {
    cancelar = null;
    enCurso = ejecutarTick(reloj.ahora())
      .catch((error: unknown) => {
        // A tick that could not even list the tenants; the next minute tries again.
        log.error({ error: 'error-interno', nombreError: nombreDeError(error) }, 'scheduler tick failed');
      })
      .finally(() => {
        enCurso = null;
        programarSiguiente();
      });
  }

  function iniciar(): void {
    if (!detenido && cancelar === null && enCurso === null) {
      programarSiguiente();
    }
  }

  /**
   * DEC-99: before the first tick, close the rows a stopped process left `en-curso`. They
   * are never re-executed. Every tenant is entered, deactivated ones included: the one
   * bounded exception to DEC-14, which closes rows and runs nothing. One failing tenant is
   * logged and the others are still swept (DEC-102); nothing here rejects.
   */
  async function barrerInterrumpidas(): Promise<void> {
    // One boot time for every tenant's rows.
    const finalizadaEn = reloj.ahora();
    let cerradas = 0;
    try {
      // `Tenant` is not a scoped model: its rows are the only source of tenant ids (rule 2).
      const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true }, orderBy: { id: 'asc' } });
      for (const fila of tenants) {
        const tenant: TenantActivo = { id: fila.id, nombre: fila.nombre };
        try {
          // Awaited inside the callback, so the write starts inside this tenant's context.
          const { count } = await conTenantActivo(tenant, async () =>
            await prisma.ejecucion.updateMany({
              where: { estado: 'en-curso' },
              data: { ...CIERRE_INTERRUMPIDA, finalizadaEn },
            }),
          );
          cerradas += count;
        } catch (error) {
          log.warn(
            { tenantId: tenant.id, error: 'error-interno', nombreError: nombreDeError(error) },
            'boot sweep failed for a tenant',
          );
        }
      }
    } catch (error) {
      // The tenant list itself could not be read: the service starts anyway (fail-open).
      log.error({ error: 'error-interno', nombreError: nombreDeError(error) }, 'boot sweep failed');
      return;
    }
    log.info({ cerradas }, 'boot sweep closed interrupted runs');
  }

  async function arrancar(): Promise<void> {
    await barrerInterrumpidas();
    iniciar();
  }

  /**
   * CH-17b (DEC-104, DEC-106): a pending retry pause is cancelled too, so its run closes
   * at once with the last attempt's category. The rest of the in-flight tick still runs,
   * one attempt per remaining due automation and no retry, and is awaited.
   */
  async function detener(): Promise<void> {
    detenido = true;
    cancelar?.();
    cancelar = null;
    cancelarPausa?.();
    await enCurso;
  }

  return { arrancar, barrerInterrumpidas, iniciar, detener, ejecutarTick };
}
