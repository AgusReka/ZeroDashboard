import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from './generated/prisma/client.js';

export function registerHealthRoute(app: FastifyInstance, prisma: PrismaClient): void {
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
