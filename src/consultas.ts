import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { loadConfig } from './config.js';
import { camposInvalidos } from './conexiones.js';
import { destinoDeConexion } from './conexion-destino.js';
import { ejecutarConsulta, sanearSql } from './consulta-ejecucion.js';
import { ErrorCredencialIlegible } from './cripto-credencial.js';
import { prepararSentencia, TIPOS_PARAMETRO } from './parametros.js';

interface EjecucionBody {
  conexionId: string;
  sql: string;
  limite: number;
  desplazamiento: number;
  /** The inline declaration (DEC-48). Its content is checked by `prepararSentencia`. */
  parametros: unknown[];
  valores: Record<string, unknown>;
}

/**
 * Strict execution schema: `conexionId` and `sql` are required, the two pagination
 * fields have server-side defaults, and no unknown property is accepted.
 *
 * CH-04's `maximum: 200` on `limite` is **gone** since CH-07. A schema literal cannot
 * express a runtime-configured ceiling, and leaving it would have made the ceiling
 * unreachable: a request above 200 would be answered `400` by validation before the
 * clamp had any chance to fire, so the cut verdict DEC-18 asks for could never be
 * produced. The ceiling now lives in `MAX_FILAS_CONSULTA` (DEC-19) and is applied by
 * `ejecutarConsulta`, which reports what it did. `minimum: 1` and `default: 50` stay:
 * they are statements about the request's shape, not about the deployment's limits.
 *
 * CH-11: `parametros` and `valores` are typed as containers and keys only. `nombre` and
 * every value carry no `type`, and `tipo` is an `enum` with no `type`, because Fastify's
 * AJV coerces scalars (`true` → `"true"`, `null` → `""`) wherever a `type` is declared,
 * which would defeat DEC-60. The shapes themselves are `prepararSentencia`'s job.
 */
const ejecucionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['conexionId', 'sql'],
  properties: {
    conexionId: { type: 'string', minLength: 1 },
    sql: { type: 'string', minLength: 1 },
    limite: { type: 'integer', minimum: 1, default: 50 },
    desplazamiento: { type: 'integer', minimum: 0, default: 0 },
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
    valores: { type: 'object', default: {} },
  },
} as const;

export function registerConsultaRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  app.post<{ Body: EjecucionBody }>(
    '/consultas/ejecutar',
    { schema: { body: ejecucionSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      const body = request.body;
      // Sanitized exactly once, here: `sanearSql` is not idempotent (`SELECT 1;;`), so
      // the engine no longer repeats it. A statement that is empty once trimmed is a
      // failure of the request's shape, not a verdict about the tenant's database.
      const sql = sanearSql(body.sql);
      if (sql === '') {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/sql'] });
      }

      // Parameters are checked before the connection is even looked up, like the empty
      // statement above: a request that cannot run dials nothing and executes nothing.
      // Values are never logged (rule 5) and only ever reach the driver as binds.
      const preparada = prepararSentencia(sql, body.parametros, body.valores);
      if (!preparada.ok) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: [...new Set(preparada.problemas.map((problema) => problema.campo))],
          problemas: preparada.problemas,
        });
      }

      // Since CH-07 this route does not name `credencial` at all: `destinoDeConexion()`
      // is the one read that does, and it hands back a destination whose password is
      // already deciphered, in memory, for this call only.
      //
      // Tenant scoping is unchanged: the isolation extension adds `tenantId` to that
      // unique selector (DEC-13), so a `conexionId` belonging to another tenant resolves
      // to `null` and takes the `404` below — no envelope is opened and no statement is
      // ever sent to that tenant's target.
      let conexion;
      try {
        conexion = await destinoDeConexion(prisma, body.conexionId);
      } catch (error) {
        if (error instanceof ErrorCredencialIlegible) {
          // Same verdict as the probe route: the row exists but cannot be read under the
          // current key (DEC-20). Nothing about the envelope or the key reaches the body.
          return reply.code(409).send({ error: 'credencial-ilegible' });
        }
        throw error;
      }
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      const ejecucion = await ejecutarConsulta({
        host: conexion.host,
        port: conexion.port,
        database: conexion.database,
        user: conexion.user,
        password: conexion.password,
        sentencia: preparada.valor,
        limite: body.limite,
        desplazamiento: body.desplazamiento,
        // The ceiling is global and read from the environment on every call (DEC-19),
        // the same way both timeout budgets already are. Passing it explicitly keeps
        // the route as the place where the deployment's policy enters the engine.
        topeFilas: loadConfig().maxFilasPorConsulta,
      });

      if (ejecucion.resultado === 'fallo') {
        // Sanitized summary only. The `app.log.error(error, …)` form used by
        // src/health.ts would serialize the driver error, which carries the
        // plaintext password in `connectionParameters`.
        app.log.warn(
          {
            conexionId: conexion.id,
            fase: ejecucion.fase,
            categoria: ejecucion.categoria,
            codigo: ejecucion.codigo,
            durationMs: ejecucion.duracionMs,
          },
          'query execution failed',
        );
      }

      // An attempt that completed is `200` whatever its verdict: the operation
      // succeeded and the verdict is in the body. HTTP error codes stay reserved for
      // failures of the request itself (`400` above, `404` above).
      return reply.code(200).send(ejecucion);
    },
  );
}
