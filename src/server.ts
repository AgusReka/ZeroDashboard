import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { loadConfig } from './config.js';
import { registerHealthRoute } from './health.js';

const config = loadConfig();
const app = Fastify({ logger: true });
const adapter = new PrismaPg({ connectionString: config.databaseUrl });
const prisma = new PrismaClient({ adapter });

registerHealthRoute(app, prisma);

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
