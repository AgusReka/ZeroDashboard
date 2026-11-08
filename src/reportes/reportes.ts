import { CONTRATO_CANONICO } from '../contrato/contrato.js';
import { terminosProhibidosEn } from '../compartido/glosario-panel.js';
import { validarDeclaracion, type DeclaracionParametro } from '../ejecucion/parametros.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * CH-45 (DEC-183, DEC-198): the pure half of reports. The closed lists, the row cap by
 * visualization, the shape of the columns by role and of the declared period, the period's
 * date and the stored row read back fail-closed. No Fastify, no Prisma, no connection:
 * `reportes-rutas.ts` and `reporte-prueba.ts` own every side effect.
 *
 * The period is the only variable part of a report. Its parameter declaration is derived
 * from `periodo`, never stored, so there is one source of truth and the CH-11 checks
 * (DEC-56, DEC-57, DEC-59) and the bind path run on it unchanged.
 */

/**
 * The list projection: a list renders names, the whole report is a second, explicit get.
 *
 * CH-46: the two selects live here, not in `reportes-rutas.ts`, so the isolation extension can
 * import them without a cycle (`reportes-rutas.ts` reaches `aislamiento-prisma.ts` through
 * `plantillas-rutas.ts`), as `PlantillaCompleta` does. `reportes-rutas.ts` re-exports them.
 */
export const ReporteResumen = {
  id: true,
  nombre: true,
  titulo: true,
  visualizacion: true,
} as const;

/** Every column: create, get-by-id and replace. */
export const ReporteCompleto = {
  ...ReporteResumen,
  descripcion: true,
  sql: true,
  entidades: true,
  columnas: true,
  periodo: true,
} as const;

/** The row `ReporteCompleto` selects (type only: this module still imports no Prisma at runtime). */
export type ReporteCompletoFila = Prisma.ReporteGetPayload<{ select: typeof ReporteCompleto }>;

export const VISUALIZACIONES = ['numero', 'tabla', 'barras', 'linea'] as const;
export type Visualizacion = (typeof VISUALIZACIONES)[number];

/** DEC-198. The effective ceiling is `topeEfectivo`, never this value alone. */
export const TOPE_FILAS: Readonly<Record<Visualizacion, number>> = Object.freeze({
  numero: 1,
  barras: 20,
  tabla: 50,
  linea: 100,
});

export const ROLES = ['valor', 'etiqueta', 'columna'] as const;
export type Rol = (typeof ROLES)[number];

export interface ColumnaAsignada {
  rol: Rol;
  columna: string;
  titulo: string;
}

export interface Periodo {
  parametro: string;
  dias: number[];
}

/** Character caps, measured after trimming (design §0). */
export const LARGO_MAXIMO_REPORTE = { nombre: 80, titulo: 80, descripcion: 200, tituloColumna: 40 } as const;

/** The PostgreSQL identifier limit: a result column name is never longer. */
export const LARGO_MAXIMO_COLUMNA = 63;

/** A table shows at most this many columns. */
export const MAXIMO_COLUMNAS_TABLA = 10;

/** The declared days: how many values and their range (DEC-198, design §0). */
export const LIMITES_DIAS = { cantidadMaxima: 6, minimo: 1, maximo: 366 } as const;

/** DEC-198: the smaller of the visualization's cap and the deployment's `maxFilasPorConsulta`. */
export function topeEfectivo(visualizacion: Visualizacion, maxFilasPorConsulta: number): number {
  return Math.min(TOPE_FILAS[visualizacion], maxFilasPorConsulta);
}

/**
 * The roles each visualization takes, in order. `numero` is one `valor`; `barras` and
 * `linea` are `etiqueta` then `valor`; `tabla` is 1 to 10 entries of `columna`. No two
 * entries may name the same column. Returns `['/columnas']` for any other shape, else `[]`.
 */
export function rechazoDeColumnas(visualizacion: Visualizacion, columnas: readonly ColumnaAsignada[]): string[] {
  const roles = columnas.map((c) => c.rol);
  let forma: boolean;
  switch (visualizacion) {
    case 'numero':
      forma = roles.length === 1 && roles[0] === 'valor';
      break;
    case 'barras':
    case 'linea':
      forma = roles.length === 2 && roles[0] === 'etiqueta' && roles[1] === 'valor';
      break;
    case 'tabla':
      forma = roles.length >= 1 && roles.length <= MAXIMO_COLUMNAS_TABLA && roles.every((r) => r === 'columna');
      break;
  }
  const distintas = new Set(columnas.map((c) => c.columna)).size === columnas.length;
  return forma && distintas ? [] : ['/columnas'];
}

/**
 * The column titles that break their cap (1 to 40 after trimming) or the panel glossary, as
 * `/columnas/<i>/titulo` pointers, plus the forbidden terms found (deduplicated).
 */
export function rechazoDeTitulos(columnas: readonly ColumnaAsignada[]): { campos: string[]; terminos: string[] } {
  const campos: string[] = [];
  const terminos = new Set<string>();
  columnas.forEach((columna, i) => {
    const titulo = columna.titulo.trim();
    const prohibidos = terminosProhibidosEn(titulo);
    if (titulo === '' || titulo.length > LARGO_MAXIMO_REPORTE.tituloColumna || prohibidos.length > 0) {
      campos.push(`/columnas/${i}/titulo`);
    }
    prohibidos.forEach((termino) => terminos.add(termino));
  });
  return { campos, terminos: [...terminos] };
}

/** Whether `dias` is 1 to 6 distinct integers, each from 1 to 366. */
function diasValidos(dias: unknown): dias is number[] {
  return (
    Array.isArray(dias) &&
    dias.length >= 1 &&
    dias.length <= LIMITES_DIAS.cantidadMaxima &&
    new Set(dias).size === dias.length &&
    dias.every((d) => Number.isInteger(d) && d >= LIMITES_DIAS.minimo && d <= LIMITES_DIAS.maximo)
  );
}

/** Whether `parametro` passes the parameter name rule of saved queries (DEC-49). */
function parametroValido(parametro: unknown): parametro is string {
  return typeof parametro === 'string' && validarDeclaracion([{ nombre: parametro, tipo: 'fecha' }]).ok;
}

/** The period's refusal as JSON pointers: `/periodo/parametro` and `/periodo/dias`. `[]` when null. */
export function rechazoDelPeriodo(periodo: Periodo | null): string[] {
  if (periodo === null) return [];
  return [
    ...(parametroValido(periodo.parametro) ? [] : ['/periodo/parametro']),
    ...(diasValidos(periodo.dias) ? [] : ['/periodo/dias']),
  ];
}

/**
 * The declaration derived from the period: `[]` with no period, else one parameter named
 * `parametro`, of type `fecha`. It feeds `problemasDePlantilla` and `prepararSentencia`.
 */
export function declaracionDelPeriodo(periodo: Periodo | null): DeclaracionParametro[] {
  return periodo === null ? [] : [{ nombre: periodo.parametro, tipo: 'fecha' }];
}

/**
 * `YYYY-MM-DD`: today in `zona`, minus `dias` calendar days. The zone only says which day
 * "today" is; the subtraction is calendar arithmetic in UTC, which has no daylight-saving gaps.
 */
export function fechaDelPeriodo(ahora: Date, zona: string, dias: number): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: 'year' | 'month' | 'day') => Number(partes.find((p) => p.type === tipo)?.value);
  const fecha = new Date(Date.UTC(parte('year'), parte('month') - 1, parte('day') - dias));
  return fecha.toISOString().slice(0, 10);
}

/** Assigned columns absent from `columnas`, in assignment order. */
export function faltantesEn(asignadas: readonly ColumnaAsignada[], columnas: readonly string[]): string[] {
  const presentes = new Set(columnas);
  return asignadas.map((c) => c.columna).filter((columna) => !presentes.has(columna));
}

/** A stored `Reporte` row, as the database returns it: the JSON columns are untyped. */
export interface FilaReporte {
  id: string;
  nombre: string;
  titulo: string;
  descripcion: string | null;
  sql: string;
  entidades: unknown;
  visualizacion: string;
  columnas: unknown;
  periodo: unknown;
}

export interface ReporteLeido {
  id: string;
  nombre: string;
  titulo: string;
  descripcion: string | null;
  sql: string;
  entidades: string[];
  visualizacion: Visualizacion;
  columnas: ColumnaAsignada[];
  periodo: Periodo | null;
}

const NOMBRES_CONTRATO: readonly string[] = CONTRATO_CANONICO.map((e) => e.nombre);

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esVisualizacion(valor: unknown): valor is Visualizacion {
  return (VISUALIZACIONES as readonly unknown[]).includes(valor);
}

function leerColumnas(valor: unknown): ColumnaAsignada[] | null {
  if (!Array.isArray(valor)) return null;
  const columnas: ColumnaAsignada[] = [];
  for (const item of valor) {
    if (
      !esObjeto(item) ||
      !(ROLES as readonly unknown[]).includes(item.rol) ||
      typeof item.columna !== 'string' ||
      typeof item.titulo !== 'string'
    ) {
      return null;
    }
    columnas.push({ rol: item.rol as Rol, columna: item.columna, titulo: item.titulo });
  }
  return columnas;
}

function leerPeriodo(valor: unknown): Periodo | null | undefined {
  if (valor === null) return null;
  if (!esObjeto(valor) || !parametroValido(valor.parametro) || !diasValidos(valor.dias)) return undefined;
  return { parametro: valor.parametro, dias: [...valor.dias] };
}

/**
 * Reads a stored report back (DEC-73: the database does not type its JSON). The save path
 * only ever writes a value that passed every check, so anything else is corruption, and it
 * fails closed with a throw (500), like `leerEntidades`: a corrupt row never runs.
 */
export function leerReporte(fila: FilaReporte): ReporteLeido {
  const entidades = fila.entidades;
  const entidadesValidas =
    Array.isArray(entidades) &&
    entidades.length > 0 &&
    new Set(entidades).size === entidades.length &&
    entidades.every((e) => typeof e === 'string' && NOMBRES_CONTRATO.includes(e));
  const visualizacion = fila.visualizacion;
  const columnas = leerColumnas(fila.columnas);
  const periodo = leerPeriodo(fila.periodo);
  if (
    !entidadesValidas ||
    !esVisualizacion(visualizacion) ||
    columnas === null ||
    rechazoDeColumnas(visualizacion, columnas).length > 0 ||
    periodo === undefined
  ) {
    throw new Error('leerReporte: reporte almacenado fuera de las reglas de DEC-198');
  }
  return {
    id: fila.id,
    nombre: fila.nombre,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    sql: fila.sql,
    entidades: entidades as string[],
    visualizacion,
    columnas,
    periodo,
  };
}
