import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { loadConfig } from './config.js';
import { registerHealthRoute } from './health.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registerConsolaRoute } from './consola.js';

const config = loadConfig();
const app = Fastify({ logger: true });
const adapter = new PrismaPg({ connectionString: config.databaseUrl });
const prisma = new PrismaClient({ adapter });

registerHealthRoute(app, prisma);
registerConexionRoutes(app, prisma);
registerConsultaRoutes(app, prisma);
registerConsultaGuardadaRoutes(app, prisma);
registerConsolaRoute(app);

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
