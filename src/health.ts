import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';

/**
 * Retyped to the extended client in CH-06 for one reason only: `src/server.ts` no
 * longer holds a raw client to hand out. The `$queryRaw` below is unaffected — raw
 * queries bypass model-level extensions, and this one touches no scoped model, which
 * is why liveness can still answer on the tenant-exempt `GET /health`.
 */
export function registerHealthRoute(app: FastifyInstance, prisma: PrismaAislado): void {
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send({ status: 'ready', db: 'connected' });
    } catch (error) {
      app.log.error(error, 'health check: database unreachable');
      return reply.code(503).send({ status: 'not-ready', db: 'unreachable' });
    }
  });
}
