import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import { conTenantInyectado } from './aislamiento-prisma.js';
import { exigirTenantActivo } from './contexto-tenant.js';
import type { ResultadoEjecucion, ResultadoSondeo } from './consulta-ejecucion.js';
import type { ProbeResult } from './db-probe.js';
import { LIMITE_LISTADO } from './listados.js';

/**
 * CH-20 (DEC-159 to DEC-163): the audit of what the console executes against a client's
 * database — what, when, against which tenant and by whom (A5).
 *
 * Four console paths record one row each after the execution engine answered: the ad hoc
 * query, the template test, the mapping validation and the connection probe. The row keeps
 * the statement as executed (DEC-160) and the verdict, never a parameter value nor a row.
 * The table cannot be changed: no route edits or deletes it, and a database trigger refuses
 * it too (DEC-162). Scheduled runs are not here: they stay in `Ejecucion` (DEC-159).
 */

export type OrigenEjecucion = 'consulta' | 'plantilla-prueba' | 'validacion-mapeo' | 'conexion-prueba';

/** The verdict columns of a row, whatever produced it. */
export interface VeredictoAuditado {
  resultado: 'ok' | 'fallo';
  fase: string | null;
  categoria: string | null;
  codigo: string | null;
  filas: number | null;
  duracionMs: number | null;
}

/** What the route knows about the execution besides its verdict. */
export interface ContextoAuditado {
  origen: OrigenEjecucion;
  conexionId: string;
  sql: string;
  operador: { id: string; nombre: string };
  /** A saved query verified against the executed text (DEC-161), or `null` for ad hoc. */
  consulta: { id: string; version: number; nombre: string } | null;
  plantillaId: string | null;
}

/** The engine's verdict as audit columns: rows are counted, never kept (DEC-93, DEC-160). */
export function veredictoDeEjecucion(resultado: ResultadoEjecucion): VeredictoAuditado {
  if (resultado.resultado === 'ok') {
    return {
      resultado: 'ok',
      fase: null,
      categoria: null,
      codigo: null,
      filas: resultado.filas.length,
      duracionMs: resultado.duracionMs,
    };
  }
  return {
    resultado: 'fallo',
    fase: resultado.fase,
    categoria: resultado.categoria,
    codigo: resultado.codigo,
    filas: null,
    duracionMs: resultado.duracionMs,
  };
}

/**
 * The mapping validation's verdict: a failed session is the engine's failure; otherwise
 * the run is `fallo` if any entity failed, with the first failing entity's category. No
 * row count: a structure probe returns no rows.
 */
export function veredictoDeSondeo(sondeo: ResultadoSondeo): VeredictoAuditado {
  if (sondeo.resultado === 'fallo') {
    return { ...veredictoDeEjecucion(sondeo), filas: null };
  }
  const fallida = sondeo.entidades.find((entidad) => entidad.resultado === 'fallo');
  if (fallida === undefined || fallida.resultado !== 'fallo') {
    return { resultado: 'ok', fase: null, categoria: null, codigo: null, filas: null, duracionMs: sondeo.duracionMs };
  }
  return {
    resultado: 'fallo',
    fase: 'ejecucion',
    categoria: fallida.categoria,
    codigo: fallida.codigo,
    filas: null,
    duracionMs: sondeo.duracionMs,
  };
}

/** The connection probe's verdict: a failure is always a connection-phase failure. */
export function veredictoDePrueba(prueba: ProbeResult): VeredictoAuditado {
  return {
    resultado: prueba.resultado,
    fase: prueba.resultado === 'fallo' ? 'conexion' : null,
    categoria: prueba.categoria,
    codigo: prueba.codigo,
    filas: null,
    duracionMs: prueba.duracionMs,
  };
}

/** The row data, minus the tenant columns the write adds from the active tenant. */
export function filaDeAuditoria(contexto: ContextoAuditado, veredicto: VeredictoAuditado) {
  return {
    origen: contexto.origen,
    conexionId: contexto.conexionId,
    sql: contexto.sql,
    operadorId: contexto.operador.id,
    operadorNombre: contexto.operador.nombre,
    consultaGuardadaId: contexto.consulta?.id ?? null,
    consultaVersion: contexto.consulta?.version ?? null,
    consultaNombre: contexto.consulta?.nombre ?? null,
    plantillaId: contexto.plantillaId,
    resultado: veredicto.resultado,
    fase: veredicto.fase,
    categoria: veredicto.categoria,
    codigo: veredicto.codigo,
    filas: veredicto.filas,
    duracionMs: veredicto.duracionMs,
  };
}

export interface FiltrosAuditoria {
  desde?: Date;
  hasta?: Date;
  resultado?: 'ok' | 'fallo';
}

export type AnalisisFiltros = { ok: true; filtros: FiltrosAuditoria } | { ok: false; campos: string[] };

/** An ISO-like date or date-time that `Date` reads as a real instant, else `null`. */
function fecha(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(valor)) {
    return null;
  }
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) {
    return null;
  }
  // `Date` rolls an impossible calendar date over ("2026-02-30" becomes March 2) instead
  // of failing, so the written year, month and day must survive a round trip on their own,
  // independently of any time or offset that follows them.
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  const calendario = new Date(Date.UTC(anio, mes - 1, dia));
  const existe =
    calendario.getUTCFullYear() === anio && calendario.getUTCMonth() === mes - 1 && calendario.getUTCDate() === dia;
  return existe ? instante : null;
}

/**
 * The listing's query string: `desde` and `hasta` (inclusive bounds on the row's instant)
 * and `resultado`. Unknown keys are ignored, like every GET in the project; a repeated key
 * arrives as an array and is invalid, not a silent pick.
 */
export function analizarFiltros(consulta: Record<string, unknown>): AnalisisFiltros {
  const filtros: FiltrosAuditoria = {};
  const campos: string[] = [];
  for (const clave of ['desde', 'hasta'] as const) {
    if (consulta[clave] === undefined) {
      continue;
    }
    const instante = fecha(consulta[clave]);
    if (instante === null) {
      campos.push(`/${clave}`);
    } else if (clave === 'hasta' && String(consulta[clave]).length === 10) {
      // A date-only upper bound means "up to and including that day" (UTC), not its midnight.
      filtros.hasta = new Date(instante.getTime() + 24 * 60 * 60 * 1000 - 1);
    } else {
      filtros[clave] = instante;
    }
  }
  if (consulta.resultado !== undefined) {
    if (consulta.resultado === 'ok' || consulta.resultado === 'fallo') {
      filtros.resultado = consulta.resultado;
    } else {
      campos.push('/resultado');
    }
  }
  return campos.length > 0 ? { ok: false, campos } : { ok: true, filtros };
}

/** Every column a listing answers: all but `tenantId`, which is the header's anyway. */
const RegistroPublico = {
  id: true,
  creadoEn: true,
  tenantNombre: true,
  operadorId: true,
  operadorNombre: true,
  origen: true,
  conexionId: true,
  consultaGuardadaId: true,
  consultaVersion: true,
  consultaNombre: true,
  plantillaId: true,
  sql: true,
  resultado: true,
  fase: true,
  categoria: true,
  codigo: true,
  filas: true,
  duracionMs: true,
} as const;

/**
 * `GET /auditoria` (DEC-163): the header tenant's rows (scoped model), newest first,
 * filtered by `desde`, `hasta` and `resultado`, capped like every listing. There is no
 * route that writes or deletes a row: rows are written by the audited routes themselves,
 * and the table refuses any change (DEC-162).
 */
export function registerAuditoriaRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  app.get('/auditoria', async (request, reply) => {
    const analisis = analizarFiltros(request.query as Record<string, unknown>);
    if (!analisis.ok) {
      return reply.code(400).send({ error: 'solicitud-invalida', campos: analisis.campos });
    }
    const { desde, hasta, resultado } = analisis.filtros;
    const filas = await prisma.registroEjecucion.findMany({
      where: {
        ...(resultado === undefined ? {} : { resultado }),
        ...(desde === undefined && hasta === undefined
          ? {}
          : { creadoEn: { ...(desde === undefined ? {} : { gte: desde }), ...(hasta === undefined ? {} : { lte: hasta }) } }),
      },
      select: RegistroPublico,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: LIMITE_LISTADO + 1,
    });
    const truncado = filas.length > LIMITE_LISTADO;
    return reply.code(200).send({ registros: truncado ? filas.slice(0, LIMITE_LISTADO) : filas, truncado });
  });
}

/** The context of an audited execution, without the operator: the write takes it from the request. */
export type ContextoDeRuta = Omit<ContextoAuditado, 'operador'>;

/**
 * Writes one audit row for an execution that reached the engine (DEC-159), inside the
 * request's tenant context: the tenant id is injected and its name copied, the operator
 * comes from the session the guard resolved. The write can never change the request's
 * answer (DEC-162): any failure is logged at `error` with closed fields — never the
 * statement — and swallowed.
 *
 * A request without an operator only exists in a test app built without the operator
 * guard; `src/rutas.test.ts` proves production always has one. Nothing is written then,
 * and an `error` line says so, so a future exemption of an audited route cannot go unseen.
 */
export async function registrarEjecucion(
  prisma: PrismaAislado,
  log: FastifyBaseLogger,
  request: FastifyRequest,
  contexto: ContextoDeRuta,
  veredicto: VeredictoAuditado,
): Promise<void> {
  if (request.operador === undefined) {
    log.error({ origen: contexto.origen, conexionId: contexto.conexionId }, 'audit skipped: no operator');
    return;
  }
  try {
    const tenant = exigirTenantActivo();
    const fila = filaDeAuditoria({ ...contexto, operador: request.operador }, veredicto);
    await prisma.registroEjecucion.create({
      data: conTenantInyectado({ ...fila, tenantNombre: tenant.nombre }),
    });
  } catch (error) {
    log.error(
      { origen: contexto.origen, conexionId: contexto.conexionId, error: (error as Error).name },
      'audit write failed',
    );
  }
}

/**
 * DEC-161: the saved query the console says it ran, confirmed only when the text sent is
 * byte for byte the statement stored for that version — the current row's, or the history
 * entry's for a past version. Scoped reads, so another tenant's id is `null` like an
 * unknown one. Anything that does not match is ad hoc (`null`); this never affects the
 * execution, which already answered. The name is the query's current one.
 */
export async function consultaGuardadaVerificada(
  prisma: PrismaAislado,
  id: string,
  version: number,
  sql: string,
): Promise<{ id: string; version: number; nombre: string } | null> {
  try {
    return await verificar(prisma, id, version, sql);
  } catch {
    // Awaited as an argument, outside `registrarEjecucion`'s own guard: a failed read must
    // not turn an execution that already ran into a 500 (DEC-161, DEC-162). The run is
    // recorded as ad hoc, which under-attributes and never mis-attributes.
    return null;
  }
}

async function verificar(
  prisma: PrismaAislado,
  id: string,
  version: number,
  sql: string,
): Promise<{ id: string; version: number; nombre: string } | null> {
  const consulta = await prisma.consultaGuardada.findUnique({
    where: { id },
    select: { id: true, nombre: true, sql: true, version: true },
  });
  if (consulta === null) {
    return null;
  }
  let guardado: string | null = null;
  if (version === consulta.version) {
    guardado = consulta.sql;
  } else {
    const anterior = await prisma.consultaGuardadaVersion.findUnique({
      where: { consultaGuardadaId_version: { consultaGuardadaId: id, version } },
      select: { sql: true },
    });
    guardado = anterior?.sql ?? null;
  }
  return guardado === sql ? { id: consulta.id, version, nombre: consulta.nombre } : null;
}
