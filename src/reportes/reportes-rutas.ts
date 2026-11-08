import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { camposInvalidos } from '../compartido/campos-invalidos.js';
import { terminosProhibidosEn } from '../compartido/glosario-panel.js';
import { LIMITE_LISTADO } from '../compartido/listados.js';
import { sanearSql } from '../ejecucion/consulta-ejecucion.js';
import { ENTIDADES_CANONICAS } from '../mapeo/vistas-canonicas.js';
import { problemasDePlantilla } from '../plantillas/plantillas.js';
import { textoCliente } from '../plantillas/plantillas-rutas.js';
import {
  LARGO_MAXIMO_COLUMNA,
  LARGO_MAXIMO_REPORTE,
  MAXIMO_COLUMNAS_TABLA,
  ROLES,
  ReporteCompleto,
  ReporteResumen,
  VISUALIZACIONES,
  declaracionDelPeriodo,
  faltantesEn,
  rechazoDeColumnas,
  rechazoDelPeriodo,
  rechazoDeTitulos,
  type ColumnaAsignada,
  type Periodo,
  type ReporteCompletoFila,
  type Visualizacion,
} from './reportes.js';

/**
 * CH-45 (DEC-183, DEC-198): the global report catalog. `Reporte` is global like `Plantilla`
 * (DEC-61), so these four routes are exempt from `x-tenant-id` by exact row
 * (`REPORTES_EXENTOS`), and the registrar receives the `reporte` delegate alone: an exempt
 * handler has no scoped model within reach (DEC-24's structural argument). The test routes,
 * which need a tenant, live in `reporte-prueba.ts`.
 *
 * There is no delete: a report is replaced in place by id (DEC-68).
 *
 * CH-46 (DEC-199): a report on any tenant's dashboard is in use and is not replaced. The
 * registrar gets that fact as a port (`UsoDeReportes`), never a client or a scoped model.
 */

export interface RegistroReporteBody {
  nombre: string;
  titulo: string;
  descripcion?: string | null;
  sql: string;
  entidades: string[];
  visualizacion: Visualizacion;
  /** Required on save; optional on the unsaved test, which is what produces the columns. */
  columnas?: ColumnaAsignada[];
  periodo: Periodo | null;
  /**
   * The column names of the test that preceded the save (CH-39, DEC-198). Only read to check
   * the assigned columns: never stored and never returned.
   */
  columnasPrueba?: string[];
}

interface ReporteParams {
  id: string;
}

/** The two selects live in `reportes.ts` (CH-46), so the isolation extension can import them. */
export { ReporteCompleto, ReporteResumen };

/**
 * Strict body, `propertyNames` included at every level for the reason
 * `registroConsultaGuardadaSchema` documents: under Fastify's `removeAdditional` an unknown
 * key would otherwise be stripped and the body accepted. Every key is in `properties` too, or
 * `removeAdditional` would drop it in silence. Lengths after trimming, the period's values
 * and the roles are checked in code by `rechazoDeReporte`, so each refusal names one field.
 * A JSON `null` text is coerced to `''` by Fastify's AJV, which the code then refuses or
 * stores as `null`.
 */
export const registroReporteSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: {
    enum: [
      'nombre',
      'titulo',
      'descripcion',
      'sql',
      'entidades',
      'visualizacion',
      'columnas',
      'periodo',
      'columnasPrueba',
    ],
  },
  required: ['nombre', 'titulo', 'sql', 'entidades', 'visualizacion', 'columnas'],
  properties: {
    nombre: { type: 'string' },
    titulo: { type: 'string' },
    descripcion: { type: 'string' },
    sql: { type: 'string', minLength: 1 },
    entidades: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { enum: ENTIDADES_CANONICAS },
    },
    visualizacion: { enum: VISUALIZACIONES },
    columnas: {
      type: 'array',
      maxItems: MAXIMO_COLUMNAS_TABLA,
      items: {
        type: 'object',
        additionalProperties: false,
        propertyNames: { enum: ['rol', 'columna', 'titulo'] },
        required: ['rol', 'columna', 'titulo'],
        properties: {
          rol: { enum: ROLES },
          columna: { type: 'string', minLength: 1, maxLength: LARGO_MAXIMO_COLUMNA },
          titulo: { type: 'string' },
        },
      },
    },
    periodo: {
      type: ['object', 'null'],
      default: null,
      additionalProperties: false,
      propertyNames: { enum: ['parametro', 'dias'] },
      required: ['parametro', 'dias'],
      properties: {
        parametro: { type: 'string' },
        dias: { type: 'array', items: { type: 'integer' } },
      },
    },
    columnasPrueba: { type: 'array', maxItems: 200, items: { type: 'string' } },
  },
} as const;

/** The `400` envelope. */
function rechazo(campos: string[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { error: 'solicitud-invalida', campos, ...extra };
}

/**
 * The texts' refusal: `nombre` 1 to 80 (for the operator only), `titulo` 1 to 80 and
 * `descripcion` up to 200, all after trimming; the client texts also pass the panel glossary.
 */
function rechazoDeTextos(cuerpo: RegistroReporteBody): { campos: string[]; terminos: string[] } {
  const campos: string[] = [];
  const terminos = new Set<string>();
  const nombre = textoCliente(cuerpo.nombre);
  if (nombre === null || nombre.length > LARGO_MAXIMO_REPORTE.nombre) campos.push('/nombre');
  for (const campo of ['titulo', 'descripcion'] as const) {
    const texto = textoCliente(cuerpo[campo]);
    if (texto === null) {
      if (campo === 'titulo') campos.push('/titulo');
      continue;
    }
    const prohibidos = terminosProhibidosEn(texto);
    if (texto.length > LARGO_MAXIMO_REPORTE[campo] || prohibidos.length > 0) campos.push(`/${campo}`);
    prohibidos.forEach((termino) => terminos.add(termino));
  }
  return { campos, terminos: [...terminos] };
}

/**
 * The derived declaration's one parameter is the period: a `sin-usar` problem on it points
 * at `/periodo/parametro`, the field the body has, not at the template's `/parametros/0/nombre`.
 */
function campoDelReporte(campo: string): string {
  return campo.startsWith('/parametros/') ? '/periodo/parametro' : campo;
}

/**
 * The save-time checks shared by create, replace and the unsaved test, in the order of
 * design §4; the first that refuses wins, so one answer names one reason:
 * 1. AJV; 2. the texts (caps and glossary, with `terminos`); 3. the period; 4. the columns by
 * role, then their titles; 5. with `exigirColumnas`, `columnasPrueba` is present and covers
 * every assigned column (`faltantes`); 6. a statement blank once sanitized; 7. the CH-11
 * parameter rules against the declaration derived from the period. Returns the `400`
 * envelope, or `null` when the body may be written or run. `exigirColumnas` is false only for
 * the unsaved test, which also skips step 4 when it assigns no column.
 */
export function rechazoDeReporte(
  validationError: { validation?: unknown } | undefined,
  cuerpo: RegistroReporteBody,
  opciones: { exigirColumnas: boolean } = { exigirColumnas: true },
): Record<string, unknown> | null {
  if (validationError) {
    return rechazo(camposInvalidos(validationError));
  }
  const textos = rechazoDeTextos(cuerpo);
  if (textos.campos.length > 0) {
    return rechazo(textos.campos, textos.terminos.length > 0 ? { terminos: textos.terminos } : {});
  }
  const periodo = rechazoDelPeriodo(cuerpo.periodo);
  if (periodo.length > 0) return rechazo(periodo);

  const columnas = cuerpo.columnas ?? [];
  if (opciones.exigirColumnas || columnas.length > 0) {
    const forma = rechazoDeColumnas(cuerpo.visualizacion, columnas);
    if (forma.length > 0) return rechazo(forma);
    const titulos = rechazoDeTitulos(columnas);
    if (titulos.campos.length > 0) {
      return rechazo(titulos.campos, titulos.terminos.length > 0 ? { terminos: titulos.terminos } : {});
    }
  }
  if (opciones.exigirColumnas) {
    if (cuerpo.columnasPrueba === undefined) return rechazo(['/columnasPrueba']);
    const faltantes = faltantesEn(columnas, cuerpo.columnasPrueba);
    if (faltantes.length > 0) return rechazo(['/columnas'], { faltantes });
  }
  // `sanearSql` as a predicate only, as for templates: the statement is stored verbatim,
  // because `componerSentencia` sanitizes each stored piece exactly once.
  const sql = sanearSql(cuerpo.sql);
  if (sql === '') return rechazo(['/sql']);
  const problemas = problemasDePlantilla(sql, declaracionDelPeriodo(cuerpo.periodo)).map((problema) => ({
    ...problema,
    campo: campoDelReporte(problema.campo),
  }));
  if (problemas.length > 0) {
    return rechazo([...new Set(problemas.map((problema) => problema.campo))], { problemas });
  }
  return null;
}

/** The columns a valid body writes. The texts are trimmed; `columnasPrueba` is not stored. */
export function datosDeReporte(cuerpo: RegistroReporteBody) {
  const { periodo } = cuerpo;
  return {
    nombre: cuerpo.nombre.trim(),
    titulo: cuerpo.titulo.trim(),
    descripcion: textoCliente(cuerpo.descripcion),
    sql: cuerpo.sql,
    entidades: cuerpo.entidades,
    visualizacion: cuerpo.visualizacion,
    columnas: (cuerpo.columnas ?? []).map(({ rol, columna, titulo }) => ({ rol, columna, titulo: titulo.trim() })),
    // SQL NULL, not the JSON `null` value: "no period" is the absence of one.
    periodo: periodo === null ? Prisma.DbNull : { parametro: periodo.parametro, dias: [...periodo.dias] },
  };
}

/**
 * CH-46 (DEC-199): the only cross-tenant facts the catalog routes may know, as `UsoDePlantillas`
 * is for templates (DEC-191). Whether a report is in use is a property of every tenant's
 * dashboard; the two answers come from the isolation extension's audited unscoped operations
 * (`tablero.reporteEnUso`, `tablero.reemplazarReporteLibre`), wired in `src/app/rutas.ts`.
 */
export interface UsoDeReportes {
  /** Whether any tenant's dashboard holds the report. A boolean, nothing else. */
  enUso(reporteId: string): Promise<boolean>;
  /** Replaces the report only if no dashboard holds it; the check and write are atomic. */
  reemplazarSiLibre(
    id: string,
    datos: ReturnType<typeof datosDeReporte>,
  ): Promise<'no-encontrado' | 'en-uso' | ReporteCompletoFila>;
}

export function registerReporteRoutes(
  app: FastifyInstance,
  reportes: PrismaAislado['reporte'],
  uso: UsoDeReportes,
): void {
  app.post<{ Body: RegistroReporteBody }>(
    '/reportes',
    { schema: { body: registroReporteSchema }, attachValidation: true },
    async (request, reply) => {
      const motivo = rechazoDeReporte(request.validationError, request.body);
      if (motivo !== null) {
        return reply.code(400).send(motivo);
      }
      const reporte = await reportes.create({ data: datosDeReporte(request.body), select: ReporteCompleto });
      // A report that was just created is on no dashboard (CH-46, DEC-199).
      return reply.code(201).send({ reporte: { ...reporte, enUso: false } });
    },
  );

  app.get('/reportes', async (_request, reply) => {
    // `LIMITE_LISTADO + 1` decides the page and `truncado` in one query, as for templates.
    // `Reporte` has no timestamp, so the order is by name with `id` as the tiebreaker.
    const filas = await reportes.findMany({
      select: ReporteResumen,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      take: LIMITE_LISTADO + 1,
    });
    const truncado = filas.length > LIMITE_LISTADO;
    return reply.code(200).send({ reportes: truncado ? filas.slice(0, LIMITE_LISTADO) : filas, truncado });
  });

  // `Reporte.id` is `text`, so a malformed id cannot throw: it is simply not found.
  app.get<{ Params: ReporteParams }>('/reportes/:id', async (request, reply) => {
    const reporte = await reportes.findUnique({ where: { id: request.params.id }, select: ReporteCompleto });
    if (reporte === null) {
      return reply.code(404).send({ error: 'reporte-no-encontrado' });
    }
    // CH-46 (DEC-199): a boolean computed at request time, never a tenant, dashboard or count.
    return reply.code(200).send({ reporte: { ...reporte, enUso: await uso.enUso(request.params.id) } });
  });

  /**
   * Replace in place by id (DEC-68): the same body and checks as create, then one write of
   * every column. CH-46 (DEC-199): the write goes through `uso.reemplazarSiLibre`, which locks
   * the row, checks that no dashboard holds the report and writes in one transaction. The body
   * checks run first, so an invalid body is `400` whatever the report's use.
   */
  app.put<{ Params: ReporteParams; Body: RegistroReporteBody }>(
    '/reportes/:id',
    { schema: { body: registroReporteSchema }, attachValidation: true },
    async (request, reply) => {
      const motivo = rechazoDeReporte(request.validationError, request.body);
      if (motivo !== null) {
        return reply.code(400).send(motivo);
      }
      const resultado = await uso.reemplazarSiLibre(request.params.id, datosDeReporte(request.body));
      if (resultado === 'no-encontrado') {
        return reply.code(404).send({ error: 'reporte-no-encontrado' });
      }
      if (resultado === 'en-uso') {
        return reply.code(409).send({ error: 'reporte-en-uso' });
      }
      return reply.code(200).send({ reporte: { ...resultado, enUso: false } });
    },
  );
}
