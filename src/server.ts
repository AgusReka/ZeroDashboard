import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { loadConfig } from './config.js';
import { registerHealthRoute } from './health.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registerVistaCanonicaRoutes } from './vistas-canonicas.js';
import { registerValidacionMapeoRoutes } from './validacion-mapeo-rutas.js';
import { registerConsolaRoute } from './consola.js';
import { registerContratoRoutes } from './contrato-rutas.js';
import { registerTenantRoutes } from './tenants.js';
import { registerPlantillaRoutes } from './plantillas-rutas.js';
import { registerPlantillaPruebaRoute } from './plantilla-prueba.js';
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
registerVistaCanonicaRoutes(app, prisma);
registerValidacionMapeoRoutes(app, prisma);
registerConsolaRoute(app);
// No client argument, like the console above it and unlike the four registrars before:
// the catalog is static and identical for every tenant, so this route has no database to
// reach (DEC-21) — which is exactly what makes its header exemption safe (DEC-24).
registerContratoRoutes(app);
// The template catalog is global (DEC-61) and exempt by exact row, so it receives the
// `plantilla` delegate alone: no scoped model is within reach of an exempt handler.
registerPlantillaRoutes(app, prisma.plantilla);
// The template test route is NOT exempt (DEC-62): it resolves a tenant-owned connection,
// so it gets the full scoped client, like the tenant-scoped registrars above.
registerPlantillaPruebaRoute(app, prisma);

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
