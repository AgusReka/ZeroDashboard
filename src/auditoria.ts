import type { ResultadoEjecucion } from './consulta-ejecucion.js';

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
