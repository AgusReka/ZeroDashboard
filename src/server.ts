import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { loadConfig } from './config.js';
import { registerHealthRoute } from './health.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registerConsolaRoute } from './consola.js';
import { registerTenantRoutes } from './tenants.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';

const config = loadConfig();
const app = Fastify({ logger: true });
const adapter = new PrismaPg({ connectionString: config.databaseUrl });
// The raw client is consumed on this line and never bound to a name: `prisma` is the
// extended one, so no module downstream has an un-scoped handle to reach for.
const prisma = extenderConAislamiento(new PrismaClient({ adapter }));

// FIRST, before every `register*Routes` below. Fastify runs same-name hooks in
// registration order, so this line's position is load-bearing: a route registered
// ahead of it would run its handler with no tenant context in place.
registrarContextoTenant(app, prisma);

registerHealthRoute(app, prisma);
registerTenantRoutes(app, prisma);
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
