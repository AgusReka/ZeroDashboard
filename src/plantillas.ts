import { sanearSql } from './consulta-ejecucion.js';
import { AUTOMATIZACIONES, CONTRATO_CANONICO } from './contrato.js';
import { analizarSentencia, validarDeclaracion, type ProblemaParametro } from './parametros.js';
import type { EstadoValidacion } from './validacion-mapeo.js';

/**
 * CH-12: the pure half of automation templates (D1). Three things live here and nothing
 * else: the save-time parameter checks, reused unchanged from CH-11 (DEC-52); the view
 * gate that lets a template compose only views whose saved validation passed (DEC-71);
 * and the `WITH` composition itself (DEC-70). No Fastify, no Prisma, no connection:
 * `src/plantillas-rutas.ts` and `src/plantilla-prueba.ts` own every side effect.
 *
 * Rule 4 holds by construction. The composed text is built from stored operator SQL
 * (`Plantilla.sql`, `VistaCanonica.sql` — DEC-31), fixed literals, and aliases read from
 * the closed contract. No request value is ever passed to this module; values travel
 * only in `SentenciaPreparada.valores` after `prepararSentencia` scans the whole text.
 */

/** The only delivery format today (DEC-65). N3/CH-21 is what would widen it. */
export const FORMATOS = ['correo-html'] as const;

/** `Plantilla.automatizacion` values, derived from the one source in `contrato.ts` (DEC-67). */
export const VALORES_AUTOMATIZACION: readonly string[] = Object.values(AUTOMATIZACIONES);

/** One persisted `VistaCanonica` row of the target connection, as the gate reads it. */
export interface FilaVista {
  entidad: string;
  sql: string;
  estadoValidacion: string;
}

/** A view the gate approved for composition. */
export interface VistaAComponer {
  entidad: string;
  sql: string;
}

/** Why an entity cannot be composed: CH-10's vocabulary plus "no row at all". */
export type EstadoNoAprobado = 'no-mapeada' | 'no-validado' | 'invalida';

export type Compuerta =
  | { ok: true; vistas: VistaAComponer[] }
  | { ok: false; entidades: { entidad: string; estado: EstadoNoAprobado }[] };

/** The closed contract, in its own order. Every alias and every CTE order comes from here. */
const NOMBRES_CONTRATO: readonly string[] = CONTRATO_CANONICO.map((e) => e.nombre);

/**
 * CH-10's persisted verdicts other than `valida` (DEC-44). Typed against CH-10's own
 * union (a type-only import, so no runtime dependency) to keep the two from drifting.
 */
const ESTADOS_FALLIDOS: ReadonlySet<string> = new Set<Exclude<EstadoValidacion, 'valida'>>([
  'no-validado',
  'invalida',
]);

/**
 * Reads a stored `entidades` value back (DEC-73: the database does not type it). The
 * save path only ever writes a non-empty, duplicate-free list of contract names, so
 * anything else is corruption, and it fails closed with a throw (500) rather than being
 * repaired or read partially.
 */
function leerEntidades(entidades: unknown): ReadonlySet<string> {
  const valido =
    Array.isArray(entidades) &&
    entidades.length > 0 &&
    new Set(entidades).size === entidades.length &&
    entidades.every((e) => typeof e === 'string' && NOMBRES_CONTRATO.includes(e));
  if (!valido) {
    throw new Error('evaluarVistas: entidades almacenadas fuera del contrato canónico');
  }
  return new Set(entidades as string[]);
}

/**
 * The DEC-71 gate. For each declared entity, in contract order, the connection's view
 * row must exist and carry `estadoValidacion === 'valida'`. Because every `PUT` of a
 * view resets its verdict (DEC-41) and the validate action guards on the SQL it probed,
 * `valida` always covers the row's current `sql` — the same `sql` returned here.
 *
 * On failure every failing entity is listed, not just the first, so the operator sees
 * the whole set of views to register or validate at once. Rows for entities the
 * template did not declare are ignored.
 */
export function evaluarVistas(entidades: unknown, filas: readonly FilaVista[]): Compuerta {
  const declaradas = leerEntidades(entidades);
  const vistas: VistaAComponer[] = [];
  const fallidas: { entidad: string; estado: EstadoNoAprobado }[] = [];
  for (const entidad of NOMBRES_CONTRATO.filter((nombre) => declaradas.has(nombre))) {
    const fila = filas.find((f) => f.entidad === entidad);
    if (fila === undefined) {
      fallidas.push({ entidad, estado: 'no-mapeada' });
    } else if (fila.estadoValidacion === 'valida') {
      vistas.push({ entidad, sql: fila.sql });
    } else if (ESTADOS_FALLIDOS.has(fila.estadoValidacion)) {
      fallidas.push({ entidad, estado: fila.estadoValidacion as EstadoNoAprobado });
    } else {
      throw new Error('evaluarVistas: estadoValidacion almacenado fuera del vocabulario de CH-10');
    }
  }
  return fallidas.length === 0 ? { ok: true, vistas } : { ok: false, entidades: fallidas };
}

/**
 * Builds `WITH v_<entidad> AS (...), ... SELECT * FROM (<plantilla>) AS _plantilla`.
 *
 * - The views become CTEs and the template is nested as a subquery, so the template's
 *   own `WITH` keeps working: outer CTEs are visible inside it. No text is parsed or
 *   spliced into the template (DEC-09, DEC-31).
 * - The alias is `'v_' +` the contract's own name, and the CTEs follow contract order.
 *   A view whose `entidad` is not a contract name throws, so a stored string can never
 *   become part of an identifier.
 * - `sanearSql` runs exactly once per stored piece (it is not idempotent: `SELECT 1;;`
 *   keeps one `;` and stays invalid), and every body sits on its own lines, so a trailing
 *   `-- comment` ends at the newline instead of swallowing the closing parenthesis.
 *
 * The result still has its `:markers`: the caller hands it to `prepararSentencia`, which
 * scans the whole composed text (DEC-57, DEC-59) before anything can execute.
 */
export function componerSentencia(sqlPlantilla: string, vistas: readonly VistaAComponer[]): string {
  const porEntidad = new Map(vistas.map((v) => [v.entidad, v.sql]));
  const conocidas = vistas.every((v) => NOMBRES_CONTRATO.includes(v.entidad));
  if (vistas.length === 0 || porEntidad.size !== vistas.length || !conocidas) {
    throw new Error('componerSentencia: las vistas deben ser entidades distintas del contrato canónico');
  }
  const ctes = NOMBRES_CONTRATO.flatMap((nombre) => {
    const sql = porEntidad.get(nombre);
    return sql === undefined ? [] : [`v_${nombre} AS (\n${sanearSql(sql)}\n)`];
  });
  return `WITH ${ctes.join(', ')}\nSELECT * FROM (\n${sanearSql(sqlPlantilla)}\n) AS _plantilla`;
}

/**
 * The static save-time checks, exactly as saved queries run them (DEC-52): the
 * declaration's shape first (DEC-49) — reported alone when invalid, because the statement
 * can only be read against a valid declaration — then its fit with the statement: a
 * hand-written `$n` (DEC-59), an undeclared `:marker` (DEC-57), a declared name the text
 * never uses (DEC-56). `sql` is expected already sanitized by the route.
 */
export function problemasDePlantilla(sql: string, parametros: unknown): ProblemaParametro[] {
  const declaracion = validarDeclaracion(parametros);
  return declaracion.ok ? analizarSentencia(sql, declaracion.valor) : declaracion.problemas;
}
