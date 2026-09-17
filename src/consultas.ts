import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { destinoDeConexion } from './conexion-destino.js';
import { ejecutarConsulta, sanearSql } from './consulta-ejecucion.js';
import { ErrorCredencialIlegible } from './cripto-credencial.js';

interface EjecucionBody {
  conexionId: string;
  sql: string;
  limite: number;
  desplazamiento: number;
}

/**
 * Strict execution schema: `conexionId` and `sql` are required, the two pagination
 * fields have server-side defaults, and no unknown property is accepted. The upper
 * bound on `limite` is the app's own guard against a page large enough to hurt the
 * tenant's replica; A4's tenant-configurable limits are CH-07.
 */
const ejecucionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['conexionId', 'sql'],
  properties: {
    conexionId: { type: 'string', minLength: 1 },
    sql: { type: 'string', minLength: 1 },
    limite: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    desplazamiento: { type: 'integer', minimum: 0, default: 0 },
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
      // A statement that is empty once trimmed is a failure of the request's shape,
      // not a verdict about the tenant's database, so it never reaches the engine.
      if (sanearSql(body.sql) === '') {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/sql'] });
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
        sql: body.sql,
        limite: body.limite,
        desplazamiento: body.desplazamiento,
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
