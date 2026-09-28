import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { sanearSql } from './consulta-ejecucion.js';
import { TIPOS_PARAMETRO } from './parametros.js';
import { FORMATOS, VALORES_AUTOMATIZACION, problemasDePlantilla } from './plantillas.js';
import { ENTIDADES_CANONICAS } from './vistas-canonicas.js';

/**
 * CH-12: the template catalog (D1, DEC-61). `Plantilla` is global, so these routes are
 * exempt from `x-tenant-id` by exact row in `esExenta`, and the registrar receives the
 * `plantilla` delegate alone: an exempt handler has no scoped model within reach (DEC-24's
 * structural argument). The test route, which does need a tenant, lives in its own file.
 */

/** Every column: what create echoes back. */
export const PlantillaCompleta = {
  id: true,
  nombre: true,
  automatizacion: true,
  formato: true,
  toleranciaFrescuraMinutos: true,
  sql: true,
  parametros: true,
  entidades: true,
} as const;

export interface RegistroPlantillaBody {
  nombre: string;
  sql: string;
  /** Checked by `problemasDePlantilla`; AJV only guarantees containers and keys. */
  parametros: { nombre: string; tipo: string }[];
  entidades: string[];
  automatizacion: string;
  formato: string;
  toleranciaFrescuraMinutos: number;
}

/**
 * Strict body, `propertyNames` included for the reason `registroConsultaGuardadaSchema`
 * documents: under Fastify's `removeAdditional` an unknown key would otherwise be
 * stripped and the body accepted. `parametros` has the CH-11 shape unchanged. The value
 * lists come from code (DEC-63, DEC-65, DEC-67), never from a database enum.
 */
export const registroPlantillaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: {
    enum: [
      'nombre',
      'sql',
      'parametros',
      'entidades',
      'automatizacion',
      'formato',
      'toleranciaFrescuraMinutos',
    ],
  },
  required: ['nombre', 'sql', 'entidades', 'automatizacion', 'formato', 'toleranciaFrescuraMinutos'],
  properties: {
    nombre: { type: 'string', minLength: 1 },
    sql: { type: 'string', minLength: 1 },
    parametros: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'tipo'],
        properties: { nombre: {}, tipo: { enum: TIPOS_PARAMETRO } },
      },
    },
    entidades: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { enum: ENTIDADES_CANONICAS },
    },
    automatizacion: { enum: VALORES_AUTOMATIZACION },
    formato: { enum: FORMATOS },
    // Stored, never enforced (DEC-66). Fastify's AJV coerces a numeric string like
    // `'30'`; `-1`, `1.5` and `'treinta'` are still rejected.
    toleranciaFrescuraMinutos: { type: 'integer', minimum: 0 },
  },
} as const;

/**
 * The submitted values an `enum` refused, read back from the body at each error's
 * `instancePath`, so a rejection names `cliente` and not only `/entidades/1`. Safe here,
 * unlike on `/conexiones`: a template body carries no secret.
 */
function valoresRechazados(validation: unknown, cuerpo: unknown): unknown[] {
  if (!Array.isArray(validation)) return [];
  return validation.flatMap((detalle: { keyword?: unknown; instancePath?: unknown }) => {
    if (detalle.keyword !== 'enum' || typeof detalle.instancePath !== 'string') return [];
    const valor = detalle.instancePath
      .split('/')
      .slice(1)
      .map((tramo) => tramo.replaceAll('~1', '/').replaceAll('~0', '~'))
      .reduce<unknown>((nodo, clave) => (nodo as Record<string, unknown> | undefined)?.[clave], cuerpo);
    return [valor];
  });
}

/**
 * The save-time checks shared by create and (in unit 4) replace: AJV, then a statement
 * that is blank once trimmed, then the CH-11 parameter rules (DEC-56/57/59). Returns the
 * `400` envelope, or `null` when the body may be written.
 */
export function rechazoDePlantilla(
  validationError: { validation?: unknown } | undefined,
  cuerpo: RegistroPlantillaBody,
): Record<string, unknown> | null {
  if (validationError) {
    const rechazados = valoresRechazados(validationError.validation, cuerpo);
    return {
      error: 'solicitud-invalida',
      campos: camposInvalidos(validationError),
      ...(rechazados.length > 0 ? { rechazados } : {}),
    };
  }
  // `sanearSql` as a predicate only, as `/consultas-guardadas` uses it: the statement is
  // stored verbatim, because `componerSentencia` sanitizes each stored piece exactly once.
  const sql = sanearSql(cuerpo.sql);
  if (sql === '') {
    return { error: 'solicitud-invalida', campos: ['/sql'] };
  }
  const problemas = problemasDePlantilla(sql, cuerpo.parametros);
  if (problemas.length > 0) {
    return {
      error: 'solicitud-invalida',
      campos: [...new Set(problemas.map((problema) => problema.campo))],
      problemas,
    };
  }
  return null;
}

/** The columns a valid body writes; `parametros` keeps only `nombre` and `tipo`. */
export function datosDePlantilla(cuerpo: RegistroPlantillaBody) {
  return {
    nombre: cuerpo.nombre,
    sql: cuerpo.sql,
    parametros: cuerpo.parametros.map(({ nombre, tipo }) => ({ nombre, tipo })),
    entidades: cuerpo.entidades,
    automatizacion: cuerpo.automatizacion,
    formato: cuerpo.formato,
    toleranciaFrescuraMinutos: cuerpo.toleranciaFrescuraMinutos,
  };
}

export function registerPlantillaRoutes(
  app: FastifyInstance,
  plantillas: PrismaAislado['plantilla'],
): void {
  app.post<{ Body: RegistroPlantillaBody }>(
    '/plantillas',
    { schema: { body: registroPlantillaSchema }, attachValidation: true },
    async (request, reply) => {
      const rechazo = rechazoDePlantilla(request.validationError, request.body);
      if (rechazo !== null) {
        return reply.code(400).send(rechazo);
      }
      const plantilla = await plantillas.create({
        data: datosDePlantilla(request.body),
        select: PlantillaCompleta,
      });
      return reply.code(201).send({ plantilla });
    },
  );
}
