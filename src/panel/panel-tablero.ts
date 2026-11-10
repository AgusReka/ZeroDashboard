import type { RespuestaSobreVistas } from '../ejecucion/ejecucion-sobre-vistas.js';
import {
  leerReporte,
  VISUALIZACIONES,
  type FilaReporte,
  type ReporteLeido,
  type Rol,
  type Visualizacion,
} from '../reportes/reportes.js';

/**
 * CH-48 (DEC-201, DEC-202): the pure half of the client panel's dashboard. The query shape of
 * a run, the configuration entry of a report, the closed answer of a run with its projection
 * to the assigned columns (rule 5), and the per-tenant run gate. No Fastify, no Prisma:
 * `panel-tablero-rutas.ts` owns every side effect.
 */

/** DEC-201: at most this many runs in flight per tenant. The agent keeps the rest of its sessions. */
export const EN_CURSO_POR_TENANT = 3;
/** DEC-201: at most this many runs waiting per tenant, beyond which a request is a `429`. */
export const EN_COLA_POR_TENANT = 8;

export type EstadoReporte = 'ok' | 'sin-datos' | 'no-disponible' | 'tiempo-agotado' | 'sin-conexion' | 'error';

/** One report of the configuration: no `nombre`, SQL, entities, column names nor connection. */
export interface EntradaTablero {
  id: string;
  titulo: string;
  descripcion: string | null;
  visualizacion: Visualizacion;
  periodo: { dias: number[]; predeterminado: number } | null;
}

export type ValorNormalizado = string | number | boolean | null;

export type RespuestaReporte =
  | {
      estado: 'ok';
      columnas: { rol: Rol; titulo: string }[];
      filas: ValorNormalizado[][];
      corte: boolean;
      periodo: { dias: number; desde: string } | null;
    }
  | { estado: Exclude<EstadoReporte, 'ok'> };

/** A run's `dias`, three digits at most: the declared range is 1 to 366 (DEC-198). */
const DIAS_EN_CONSULTA = /^\d{1,3}$/;

/**
 * `dias` from the raw query: absent, or a digits-only string. Any other key or shape is a
 * refusal. The route declares no querystring schema, so AJV coerces nothing: "7.0", "-7",
 * "1e1" and a repeated key (an array) are refused here, not rounded. Whether the value is one
 * of the declared days is `diasDelPedido`'s check.
 */
export function leerDiasDeConsulta(query: unknown): number | undefined | 'rechazo' {
  if (query === undefined || query === null) return undefined;
  if (typeof query !== 'object' || Array.isArray(query)) return 'rechazo';
  const claves = Object.keys(query);
  if (claves.length === 0) return undefined;
  if (claves.length > 1 || claves[0] !== 'dias') return 'rechazo';
  const dias = (query as Record<string, unknown>).dias;
  if (typeof dias !== 'string' || !DIAS_EN_CONSULTA.test(dias)) return 'rechazo';
  return Number(dias);
}

function esVisualizacion(valor: unknown): valor is Visualizacion {
  return (VISUALIZACIONES as readonly unknown[]).includes(valor);
}

/**
 * The configuration entry of one stored report. A row out of the rules is still listed, with
 * a null period and its stored visualization when it is one of the four (else `tabla`): its
 * run answers `no-disponible`, and the configuration never fails because of one report.
 */
export function entradaDeConfiguracion(fila: FilaReporte): EntradaTablero {
  let reporte: ReporteLeido;
  try {
    reporte = leerReporte(fila);
  } catch {
    return {
      id: fila.id,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      visualizacion: esVisualizacion(fila.visualizacion) ? fila.visualizacion : 'tabla',
      periodo: null,
    };
  }
  return {
    id: reporte.id,
    titulo: reporte.titulo,
    descripcion: reporte.descripcion,
    visualizacion: reporte.visualizacion,
    periodo: reporte.periodo === null ? null : { dias: [...reporte.periodo.dias], predeterminado: reporte.periodo.dias[0] },
  };
}

/**
 * A value as the answer carries it: a date at midnight UTC as `YYYY-MM-DD`, any other instant
 * as its ISO string, a `bigint` as a string, a string, number, boolean or null as returned,
 * and anything else as its string.
 */
export function normalizarValor(valor: unknown): ValorNormalizado {
  if (valor instanceof Date) {
    const iso = valor.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (typeof valor === 'bigint') return valor.toString();
  if (valor === null || typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return valor;
  }
  return String(valor);
}

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** A finite number, or a string of a finite decimal number converted to one; else `null`. */
export function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && DECIMAL.test(valor)) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

/**
 * The answer of one run (spec "Closed Result States", "Projection to the Assigned Columns").
 * The full rows stay local to this function: only the projected array is returned, so no
 * unassigned value can be serialized, logged or stored (rule 5, DEC-93). No state carries a
 * category, a code, a phase, a column name, an entity or SQL text.
 */
export function respuestaDeEjecucion(
  reporte: ReporteLeido,
  resultado: RespuestaSobreVistas,
  periodo: { dias: number; desde: string } | null,
): RespuestaReporte {
  // 400, 404 and 409: the DEC-71 gate, the credential, a connection gone, values out of the declaration.
  if (resultado.codigo !== 200) return { estado: 'no-disponible' };
  const ejecucion = resultado.cuerpo;
  if (ejecucion.resultado === 'fallo') {
    if (ejecucion.categoria === 'tiempo-agotado') return { estado: 'tiempo-agotado' };
    if (ejecucion.fase === 'conexion') return { estado: 'sin-conexion' };
    return { estado: 'error' };
  }
  const indices = reporte.columnas.map((c) => ejecucion.columnas.indexOf(c.columna));
  if (indices.some((indice) => indice === -1)) return { estado: 'no-disponible' };
  // `numero`, `barras` and `linea` have one `valor`; a `tabla` has none (-1).
  const indiceValor = reporte.columnas.findIndex((c) => c.rol === 'valor');
  const filas: ValorNormalizado[][] = [];
  for (const fila of ejecucion.filas) {
    const proyectada: ValorNormalizado[] = [];
    for (let i = 0; i < indices.length; i++) {
      const crudo = fila[indices[i]];
      if (i === indiceValor) {
        const numero = aNumero(crudo);
        if (numero === null) return { estado: 'no-disponible' };
        proyectada.push(numero);
      } else {
        proyectada.push(normalizarValor(crudo));
      }
    }
    filas.push(proyectada);
  }
  if (filas.length === 0) return { estado: 'sin-datos' };
  return {
    estado: 'ok',
    columnas: reporte.columnas.map(({ rol, titulo }) => ({ rol, titulo })),
    filas,
    corte: ejecucion.corte !== null,
    periodo,
  };
}

/** What a queued run resolves to when every request waiting for it closed before it started. */
export const DESCARTADO = 'descartado' as const;

export interface Compuerta {
  /**
   * `'lleno'` when the tenant's queue is full; otherwise the shared run's answer, or
   * `'descartado'` when every request waiting for it closed before it started.
   */
  pedir<T>(
    tenantId: string,
    clave: string,
    sigueAbierto: () => boolean,
    tarea: () => Promise<T>,
  ): Promise<T | typeof DESCARTADO> | 'lleno';
  /** Tests only: how many tenants and shared entries the gate holds right now. */
  ocupacion(): { tenants: number; entradas: number };
}

interface Entrada {
  clave: string;
  tarea: () => Promise<unknown>;
  esperas: Array<() => boolean>;
  promesa: Promise<unknown>;
  resolver: (valor: unknown) => void;
  rechazar: (error: unknown) => void;
}

interface EstadoTenant {
  enCurso: number;
  cola: Entrada[];
}

/**
 * DEC-201: the per-tenant run gate with single-flight. One process, one gate (DEC-201 "Se
 * resigna"). `clave` is `tenantId|reporteId|dias`, so the shared entries of two tenants never
 * meet. A shared entry lives only while its run is queued or in flight: nothing outlives a
 * run (DEC-93, "sin caché"), and a tenant with nothing in flight and nothing queued has no
 * record.
 */
export function crearCompuerta(
  limites: { enCurso: number; enCola: number } = { enCurso: EN_CURSO_POR_TENANT, enCola: EN_COLA_POR_TENANT },
): Compuerta {
  const tenants = new Map<string, EstadoTenant>();
  const entradas = new Map<string, Entrada>();

  function iniciar(tenantId: string, estado: EstadoTenant, entrada: Entrada): void {
    estado.enCurso++;
    void (async () => {
      try {
        entrada.resolver(await entrada.tarea());
      } catch (error) {
        entrada.rechazar(error);
      } finally {
        estado.enCurso--;
        entradas.delete(entrada.clave);
        siguiente(tenantId, estado);
      }
    })();
  }

  function siguiente(tenantId: string, estado: EstadoTenant): void {
    while (estado.enCurso < limites.enCurso && estado.cola.length > 0) {
      const proxima = estado.cola.shift()!;
      if (!proxima.esperas.some((sigueAbierto) => sigueAbierto())) {
        // Every request for it closed while it waited: it never reaches the engine.
        entradas.delete(proxima.clave);
        proxima.resolver(DESCARTADO);
        continue;
      }
      iniciar(tenantId, estado, proxima);
    }
    if (estado.enCurso === 0 && estado.cola.length === 0) {
      tenants.delete(tenantId);
    }
  }

  return {
    pedir<T>(tenantId: string, clave: string, sigueAbierto: () => boolean, tarea: () => Promise<T>) {
      const existente = entradas.get(clave);
      if (existente !== undefined) {
        // Join: the same run's answer, and no place taken.
        existente.esperas.push(sigueAbierto);
        return existente.promesa as Promise<T | typeof DESCARTADO>;
      }
      const estado = tenants.get(tenantId) ?? { enCurso: 0, cola: [] };
      const libre = estado.enCurso < limites.enCurso;
      if (!libre && estado.cola.length >= limites.enCola) {
        return 'lleno';
      }
      tenants.set(tenantId, estado);
      let resolver!: (valor: unknown) => void;
      let rechazar!: (error: unknown) => void;
      const promesa = new Promise<unknown>((res, rej) => {
        resolver = res;
        rechazar = rej;
      });
      const entrada: Entrada = { clave, tarea, esperas: [sigueAbierto], promesa, resolver, rechazar };
      entradas.set(clave, entrada);
      if (libre) {
        iniciar(tenantId, estado, entrada);
      } else {
        estado.cola.push(entrada);
      }
      return promesa as Promise<T | typeof DESCARTADO>;
    },
    ocupacion() {
      return { tenants: tenants.size, entradas: entradas.size };
    },
  };
}
