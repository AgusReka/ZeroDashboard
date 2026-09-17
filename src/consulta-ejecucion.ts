import type { ClientBase } from 'pg';
import { loadConfig } from './config.js';
import {
  cerrarCliente,
  classifyConnectionError,
  iniciarConexion,
  PRESUPUESTO_AGOTADO,
  type CategoriaFallo,
  type DestinoPostgres,
} from './db-probe.js';
import { codigoPublicable, leerCodigoCrudo } from './pg-error.js';

/**
 * Which phase of one execution attempt produced the verdict. It travels with every
 * response because the three category sets below are closed but disjoint, and
 * telling them apart by guessing at the category name would be a latent bug.
 */
export type FaseEjecucion = 'conexion' | 'permisos' | 'ejecucion';

/** Why the connected role was refused before its statement was ever sent (DEC-08). */
export type CategoriaPermiso =
  | 'rol-superusuario'
  | 'rol-con-escritura-en-tabla'
  | 'rol-con-create-en-esquema';

/** How a statement that *was* sent failed. Sibling of CH-03's `CategoriaFallo`. */
export type CategoriaEjecucion =
  | 'tiempo-agotado'
  | 'no-es-lectura'
  | 'permiso-denegado'
  | 'error-sintaxis'
  | 'error-datos'
  | 'error-desconocido';

/** Sanitized classification of a raw driver error raised during execution. */
export interface ClasificacionEjecucion {
  categoria: CategoriaEjecucion;
  codigo: string | null;
}

/** Limit/offset pagination state, and how to ask for the next page. */
export interface Paginacion {
  /**
   * The page size actually served, which is the requested one clamped by `topeFilas`.
   * The effective value rather than the requested one, because the offsets below are
   * computed from it and a caller paging with the requested number would skip rows.
   */
  limite: number;
  desplazamiento: number;
  hayMas: boolean;
  /** `null` when this was the last page — there is no next offset to request. */
  siguienteDesplazamiento: number | null;
  /** The configured ceiling in force for this execution, so a caller can name it. */
  topeFilas: number;
}

/**
 * Why an execution stopped short of the caller's request, when it did (DEC-18).
 *
 * A closed set with one member today. It is its own type rather than a boolean so a
 * second reason — a byte ceiling, a per-tenant quota — can be added without turning a
 * flag into a flag-plus-an-enum later.
 */
export type CorteEjecucion = 'tope-de-filas';

/** The three legs of the role-privilege check, as the target database reports them. */
export interface PermisosRol {
  esSuperusuario: boolean;
  escribeEnTabla: boolean;
  creaEnEsquema: boolean;
}

/** One execution request: where to run, what to run, and which page to return. */
export interface PeticionEjecucion extends DestinoPostgres {
  sql: string;
  limite: number;
  desplazamiento: number;
  /** Query-runtime budget. Defaults to `loadConfig().queryTimeoutMs`. */
  timeoutMs?: number;
  /** Connect-attempt budget. Defaults to `loadConfig().connectionTestTimeoutMs`. */
  connectTimeoutMs?: number;
  /** Row ceiling (DEC-19). Defaults to `loadConfig().maxFilasPorConsulta`. */
  topeFilas?: number;
}

export interface EjecucionExitosa {
  resultado: 'ok';
  fase: 'ejecucion';
  columnas: string[];
  filas: unknown[][];
  /**
   * `null` unless the row ceiling is what ended this page (DEC-18).
   *
   * Deliberately a top-level field and **not** part of `Paginacion`: putting it there
   * is exactly what DEC-18 forbids, because everything inside `Paginacion` describes
   * how to ask for more, and this field says the opposite.
   */
  corte: CorteEjecucion | null;
  paginacion: Paginacion;
  duracionMs: number;
}

export interface EjecucionFallida {
  resultado: 'fallo';
  fase: FaseEjecucion;
  categoria: CategoriaFallo | CategoriaPermiso | CategoriaEjecucion;
  codigo: string | null;
  duracionMs: number;
}

/** The only value that crosses this module's boundary. The raw error never does. */
export type ResultadoEjecucion = EjecucionExitosa | EjecucionFallida;

/** SQLSTATE class 42 — syntax error or access rule violation. */
const SQLSTATE_CLASE_42 = /^42[0-9A-Z]{3}$/;
/** SQLSTATE class 22 — data exception, e.g. division by zero. */
const SQLSTATE_CLASE_22 = /^22[0-9A-Z]{3}$/;

/**
 * How far above the query budget this module's own backstop timer is set. It is four
 * times the connect phase's 500 ms margin because, after `statement_timeout` fires,
 * the server must still abort the statement, unwind it, and deliver the error across
 * the network — none of which the connect-phase backstop ever had to cover.
 */
const MARGEN_RESPALDO_EJECUCION_MS = 2000;

/**
 * The privilege check (DEC-08): three `EXISTS` legs in one round trip, over the
 * catalogs rather than `information_schema`.
 *
 * Fixed literal SQL with no interpolation and no user input — it is submitted with
 * `values: []`, so rule 4 is satisfied trivially. `has_*_privilege()` is used rather
 * than ACL introspection because those functions run the *executor's* own access-mask
 * evaluation: they resolve ownership and `INHERIT` role-membership chains, which raw
 * grant tables do not show. System schemas are excluded because only a superuser holds
 * write privilege there, and the first leg already catches that case.
 */
const CONSULTA_PERMISOS = `SELECT
  EXISTS (SELECT 1 FROM pg_catalog.pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls))        AS es_superusuario,
  EXISTS (SELECT 1 FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r','p','v','m','f')
            AND n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\\_%'
            AND has_table_privilege(c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))   AS escribe_en_tabla,
  EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
          WHERE n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\\_%'
            AND has_schema_privilege(n.oid, 'CREATE'))                         AS crea_en_esquema`;

/**
 * Classifies an execution failure into a sanitized `{ categoria, codigo }` summary.
 *
 * A pure function of the error alone: it reads no clock. Row 1 of the design's table —
 * "the engine's own timer won the race" — is deliberately *not* handled here, exactly
 * as CH-03 kept the budget verdict out of `classifyConnectionError`: a won race is a
 * fact `ejecutarConsulta` observes, not an error the driver ever produced.
 *
 * `42501` is tested before the class-42 fallback because it is itself in class 42.
 */
export function classifyExecutionError(error: unknown): ClasificacionEjecucion {
  const codigoCrudo = leerCodigoCrudo(error);
  const codigo = codigoPublicable(codigoCrudo);

  // 2. The server's own `statement_timeout` aborted the statement.
  if (codigoCrudo === '57014') {
    return { categoria: 'tiempo-agotado', codigo };
  }
  // 3. The statement is not a read. Two engine rejection points produce this, and both
  //    mean the same thing to the operator, so both carry the same category:
  //
  //      `25006` (read_only_sql_transaction) — `PreventCommandIfReadOnly` refused a
  //              write or DDL inside `BEGIN TRANSACTION READ ONLY`, at execution time.
  //      `0A000` (feature_not_supported)     — parse analysis refused a data-modifying
  //              CTE that is not the top-level statement. The pagination wrapper of
  //              decision 6 (`SELECT * FROM (<sql>) AS _consulta_usuario LIMIT $1
  //              OFFSET $2`) demotes such a CTE to a subquery, so this fires *before*
  //              the executor and therefore before the `READ ONLY` check can.
  //
  //    Which one fires is an engine-internal detail of where the statement was caught;
  //    the verdict the operator needs — "this is not a read, and nothing was written" —
  //    is identical. Measured against PostgreSQL 16: wrapped + READ ONLY -> `0A000`,
  //    unwrapped + READ ONLY -> `25006`, wrapped + READ WRITE -> `0A000`. The raw
  //    `codigo` is still reported, so the two remain distinguishable downstream.
  if (codigoCrudo === '25006' || codigoCrudo === '0A000') {
    return { categoria: 'no-es-lectura', codigo };
  }
  // 4. The role lacks privilege on something the statement touched.
  if (codigoCrudo === '42501') {
    return { categoria: 'permiso-denegado', codigo };
  }
  // 5. Any other class 42. Multi-statement text also lands here as `42601`: the two
  //    are distinguishable only by the server's locale-dependent message text, which
  //    rule 7 forbids reading, so the console names both causes in one message.
  if (codigoCrudo !== null && SQLSTATE_CLASE_42.test(codigoCrudo)) {
    return { categoria: 'error-sintaxis', codigo };
  }
  // 6. Any class 22 data exception.
  if (codigoCrudo !== null && SQLSTATE_CLASE_22.test(codigoCrudo)) {
    return { categoria: 'error-datos', codigo };
  }
  // 7. Everything else, including a non-`Error` throw.
  return { categoria: 'error-desconocido', codigo };
}

/**
 * The clamp: how many rows this execution may actually return (DEC-19).
 *
 * There is no second ceiling above the page size. One `LIMIT` serves both the caller's
 * page and the deployment's ceiling, so there is only ever one number computing one
 * truth from one row set.
 */
export function limiteEfectivoDe(limiteSolicitado: number, topeFilas: number): number {
  return Math.min(limiteSolicitado, topeFilas);
}

/**
 * The cap verdict (DEC-18), which is **not** derivable from `hayMas` and must never be
 * conflated with it.
 *
 * Both conditions are required. The clamp having fired says the caller asked for more
 * than the deployment allows; `hayMas` says the result set really had more. Without the
 * clamp it is ordinary pagination — the caller chose a small page and can ask for the
 * next one. Without further rows the caller saw the whole answer, and reporting a cut
 * would be a lie about a complete result.
 */
export function corteDeEjecucion(
  limiteSolicitado: number,
  topeFilas: number,
  hayMas: boolean,
): CorteEjecucion | null {
  return limiteSolicitado > topeFilas && hayMas ? 'tope-de-filas' : null;
}

/**
 * Prepares the submitted statement for the pagination wrapper: `trim()`, strip
 * **exactly one** trailing `;`, `trim()` again.
 *
 * Plain string trimming, never parsing — DEC-09 forbids an SQL parser by design. Only
 * one semicolon is stripped, so `SELECT 1;;` stays invalid rather than being silently
 * repaired into something the operator did not write.
 */
export function sanearSql(sql: string): string {
  const recortado = sql.trim();
  const sinPuntoYComa = recortado.endsWith(';') ? recortado.slice(0, -1) : recortado;
  return sinPuntoYComa.trim();
}

/**
 * Runs the three-leg privilege check on an open client inside the read-only
 * transaction. An absent row (which the engine cannot produce for an `EXISTS`-only
 * projection) fails closed: every leg reads as `true`, so the attempt is refused.
 */
export async function verificarPermisosRol(cliente: ClientBase): Promise<PermisosRol> {
  const { rows } = await cliente.query<Record<string, boolean>>({
    text: CONSULTA_PERMISOS,
    values: [],
  });
  const fila = rows[0];
  if (fila === undefined) {
    return { esSuperusuario: true, escribeEnTabla: true, creaEnEsquema: true };
  }
  return {
    esSuperusuario: fila.es_superusuario === true,
    escribeEnTabla: fila.escribe_en_tabla === true,
    creaEnEsquema: fila.crea_en_esquema === true,
  };
}

/**
 * Blocking precedence: superuser, then table write, then schema `CREATE`. The first
 * true leg blocks, and each has its own category because the spec requires the
 * table-write and schema-`CREATE` blocks to be separately legible.
 */
function categoriaBloqueo(permisos: PermisosRol): CategoriaPermiso | null {
  if (permisos.esSuperusuario) {
    return 'rol-superusuario';
  }
  if (permisos.escribeEnTabla) {
    return 'rol-con-escritura-en-tabla';
  }
  if (permisos.creaEnEsquema) {
    return 'rol-con-create-en-esquema';
  }
  return null;
}

interface ContextoTransaccion {
  sqlSaneado: string;
  /** What the caller asked for. Kept only to decide whether the ceiling cut them. */
  limiteSolicitado: number;
  /** What is actually served: the requested page clamped by `topeFilas`. */
  limiteEfectivo: number;
  topeFilas: number;
  desplazamiento: number;
  presupuestoConsultaMs: number;
  iniciadoEn: number;
}

/**
 * The read-only transaction: `BEGIN TRANSACTION READ ONLY` → server-side timeout →
 * privilege check → the wrapped user statement → `ROLLBACK`, always.
 *
 * Every statement, including the user's, is submitted with a `values` array. Passing
 * any array forces the Parse/Bind/Execute path, where PostgreSQL's own wire protocol
 * rejects text containing more than one statement — documented protocol behavior, not
 * a driver accident. `ROLLBACK` rather than `COMMIT` because a read-only transaction
 * has nothing to commit, so one close serves both the success and the failure path.
 */
async function correrTransaccion(
  cliente: ClientBase,
  ctx: ContextoTransaccion,
): Promise<ResultadoEjecucion> {
  try {
    await cliente.query({ text: 'BEGIN TRANSACTION READ ONLY', values: [] });

    // `set_config` rather than `SET LOCAL statement_timeout = …`: `SET` takes no bind
    // parameters, so it would require splicing the configured number into SQL text.
    // `is_local = true` scopes the setting to this transaction.
    await cliente.query({
      text: "SELECT set_config('statement_timeout', $1, true)",
      values: [String(ctx.presupuestoConsultaMs)],
    });

    const bloqueo = categoriaBloqueo(await verificarPermisosRol(cliente));
    if (bloqueo !== null) {
      // The user statement is never sent when any leg blocks.
      return {
        resultado: 'fallo',
        fase: 'permisos',
        categoria: bloqueo,
        codigo: null,
        duracionMs: Date.now() - ctx.iniciadoEn,
      };
    }

    // `limiteEfectivo + 1` is bound so the extra row answers "is there a next page?"
    // without a second `count(*)` pass over the tenant's live replica. The same single
    // `LIMIT` carries both the caller's page and the deployment's ceiling (DEC-19):
    // there is no second ceiling layer, so no two mechanisms can disagree about one row
    // set. Both values are **bound as driver parameters** and never spliced into the
    // statement text (regla 4). `rowMode: 'array'` keeps duplicate output column names
    // (`SELECT 1 AS a, 2 AS a`) from collapsing.
    const resultado = await cliente.query({
      text: `SELECT * FROM (${ctx.sqlSaneado}) AS _consulta_usuario LIMIT $1 OFFSET $2`,
      values: [ctx.limiteEfectivo + 1, ctx.desplazamiento],
      rowMode: 'array',
    });

    const filasCrudas = resultado.rows as unknown[][];
    // Unchanged CH-04 meaning: the probe row says the result set had more than this
    // page. What the ceiling did about it is a separate verdict, computed below.
    const hayMas = filasCrudas.length > ctx.limiteEfectivo;
    return {
      resultado: 'ok',
      fase: 'ejecucion',
      columnas: resultado.fields.map((campo) => campo.name),
      filas: hayMas ? filasCrudas.slice(0, ctx.limiteEfectivo) : filasCrudas,
      corte: corteDeEjecucion(ctx.limiteSolicitado, ctx.topeFilas, hayMas),
      paginacion: {
        limite: ctx.limiteEfectivo,
        desplazamiento: ctx.desplazamiento,
        hayMas,
        siguienteDesplazamiento: hayMas ? ctx.desplazamiento + ctx.limiteEfectivo : null,
        topeFilas: ctx.topeFilas,
      },
      duracionMs: Date.now() - ctx.iniciadoEn,
    };
  } finally {
    // Issued on every path, including the failing ones. Its own outcome is discarded
    // unread so a failed `ROLLBACK` can never mask the error that caused it.
    await cliente.query({ text: 'ROLLBACK', values: [] }).then(
      () => undefined,
      () => undefined,
    );
  }
}

/**
 * Executes one user-authored statement against a target and returns a sanitized
 * verdict. Never throws: the raw driver error is contained in this module and never
 * reaches the caller, so no credential can ride out on it.
 *
 * Two budgets apply, and neither is ever inferred from a measured duration. The
 * connect phase reuses CH-03's race. The execution phase is bounded twice over: the
 * server aborts the statement itself at `statement_timeout` and reports `57014`, and
 * this module's own timer is a backstop for the case the server-side timer cannot
 * cover — a connection that stops answering at all, where `57014` would never arrive.
 * `duracionMs` is reported to the caller and consulted by nothing.
 */
export async function ejecutarConsulta(peticion: PeticionEjecucion): Promise<ResultadoEjecucion> {
  const config = loadConfig();
  const presupuestoConsultaMs = peticion.timeoutMs ?? config.queryTimeoutMs;
  const presupuestoConexionMs = peticion.connectTimeoutMs ?? config.connectionTestTimeoutMs;
  const topeFilas = peticion.topeFilas ?? config.maxFilasPorConsulta;

  const { cliente, conectado, cancelarTemporizador } = iniciarConexion(
    peticion,
    presupuestoConexionMs,
  );
  const iniciadoEn = Date.now();

  try {
    await conectado;
    cancelarTemporizador();
  } catch (error) {
    const duracionMs = Date.now() - iniciadoEn;
    cancelarTemporizador();
    const presupuestoAgotado = error === PRESUPUESTO_AGOTADO;
    await cerrarCliente(cliente, !presupuestoAgotado);
    if (presupuestoAgotado) {
      return {
        resultado: 'fallo',
        fase: 'conexion',
        categoria: 'tiempo-agotado',
        codigo: null,
        duracionMs,
      };
    }
    const { categoria, codigo } = classifyConnectionError(error);
    return { resultado: 'fallo', fase: 'conexion', categoria, codigo, duracionMs };
  }

  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencimiento = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(PRESUPUESTO_AGOTADO),
      presupuestoConsultaMs + MARGEN_RESPALDO_EJECUCION_MS,
    );
  });

  let presupuestoAgotado = false;
  try {
    return await Promise.race([
      correrTransaccion(cliente, {
        sqlSaneado: sanearSql(peticion.sql),
        limiteSolicitado: peticion.limite,
        limiteEfectivo: limiteEfectivoDe(peticion.limite, topeFilas),
        topeFilas,
        desplazamiento: peticion.desplazamiento,
        presupuestoConsultaMs,
        iniciadoEn,
      }),
      vencimiento,
    ]);
  } catch (error) {
    const duracionMs = Date.now() - iniciadoEn;
    if (error === PRESUPUESTO_AGOTADO) {
      // The backstop won: the attempt exhausted its budget as a fact of who won the
      // race, not as an inference drawn from reading a clock. Design table row 1.
      presupuestoAgotado = true;
      return {
        resultado: 'fallo',
        fase: 'ejecucion',
        categoria: 'tiempo-agotado',
        codigo: null,
        duracionMs,
      };
    }
    const { categoria, codigo } = classifyExecutionError(error);
    return { resultado: 'fallo', fase: 'ejecucion', categoria, codigo, duracionMs };
  } finally {
    clearTimeout(temporizador);
    // A client whose backstop won may still be waiting on a server that stopped
    // answering, so `end()` is issued but not awaited on that path.
    await cerrarCliente(cliente, !presupuestoAgotado);
  }
}
