import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from './generated/prisma/client.js';
import { camposInvalidos } from './conexiones.js';
import { ejecutarConsulta, sanearSql } from './consulta-ejecucion.js';

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

export function registerConsultaRoutes(app: FastifyInstance, prisma: PrismaClient): void {
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

      // `credencial` is selected only here, on the one path that needs it, and is
      // handed straight to the engine — it is never read back into a response.
      const conexion = await prisma.conexion.findUnique({
        where: { id: body.conexionId },
        select: {
          id: true,
          host: true,
          puerto: true,
          baseDeDatos: true,
          usuarioDb: true,
          credencial: true,
        },
      });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      const ejecucion = await ejecutarConsulta({
        host: conexion.host,
        port: conexion.puerto,
        database: conexion.baseDeDatos,
        user: conexion.usuarioDb,
        password: conexion.credencial,
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
