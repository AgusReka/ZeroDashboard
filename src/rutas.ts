import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { registerHealthRoute } from './health.js';
import { registerConexionRoutes } from './conexiones.js';
import { registerConsultaRoutes } from './consultas.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registerVistaCanonicaRoutes } from './vistas-canonicas.js';
import { registerValidacionMapeoRoutes } from './validacion-mapeo-rutas.js';
import { registerConsolaRoute } from './consola.js';
import { registerConsolaAuthRoutes, registrarGuardOperador } from './consola-auth.js';
import { registerContratoRoutes } from './contrato-rutas.js';
import { registerEstilosRoutes, type EstilosCargados } from './estilos-rutas.js';
import { registerTenantRoutes } from './tenants.js';
import { registerPlantillaRoutes } from './plantillas-rutas.js';
import { registerPlantillaPruebaRoute } from './plantilla-prueba.js';
import { registerAutomatizacionRoutes } from './automatizaciones-rutas.js';
import { registerPanelAuthRoutes } from './panel-auth.js';
import { registerPanelAjustesRoutes } from './panel-ajustes.js';
import { registerPanelAutomatizacionesRoutes } from './panel-automatizaciones.js';
import { registerPanelRoutes } from './panel.js';
import { registerAgenteRoutes } from './agentes-rutas.js';
import { registrarServidorAgentes } from './agente-servidor.js';
import type { RegistroAgentes } from './registro-agentes.js';
import { registrarContextoTenant } from './contexto-tenant.js';

/** What the route table needs from the entry point: clients and loaded assets, no I/O. */
export interface DependenciasRutas {
  prisma: PrismaAislado;
  registro: RegistroAgentes;
  estilos: EstilosCargados;
  zonaHoraria: string;
}

/**
 * CH-29 (DEC-152): the whole route table of the application, moved out of
 * `src/server.ts` unchanged in order so a test can build the real app and prove every
 * registered route is either guarded by the operator guard or in its closed exemption
 * list (`src/rutas.test.ts`). `src/server.ts` keeps configuration, clients, the
 * scheduler, shutdown and `listen`; nothing here opens a connection or a port.
 */
export function registrarRutas(app: FastifyInstance, deps: DependenciasRutas): void {
  const { prisma, registro, estilos, zonaHoraria } = deps;

  // CH-29 (DEC-152): the operator guard comes FIRST, ahead even of the tenant hooks below,
  // so a request without a console session is a 401 before the tenant header is read. It
  // cannot be turned off; the only ways past it are a valid session or an exact row of
  // `EXENCIONES_OPERADOR` in `src/consola-auth.ts`.
  registrarGuardOperador(app, prisma);

  // FIRST, before every `register*Routes` below. Fastify runs same-name hooks in
  // registration order, so this line's position is load-bearing: a route registered
  // ahead of it would run its handler with no tenant context in place.
  registrarContextoTenant(app, prisma);

  registerHealthRoute(app, prisma);
  registerTenantRoutes(app, prisma, registro);
  registerConexionRoutes(app, prisma, registro);
  registerConsultaRoutes(app, prisma, registro);
  registerConsultaGuardadaRoutes(app, prisma);
  registerVistaCanonicaRoutes(app, prisma);
  registerValidacionMapeoRoutes(app, prisma, registro);
  registerConsolaRoute(app);
  // CH-21a (DEC-124): the loaded sheets and the app, no client, like the console and the
  // contract around it: the assets are identical for every tenant, exempt by exact GET row.
  registerEstilosRoutes(app, estilos);
  // No client argument, like the console above it and unlike the four registrars before:
  // the catalog is static and identical for every tenant, so this route has no database to
  // reach (DEC-21) — which is exactly what makes its header exemption safe (DEC-24).
  registerContratoRoutes(app);
  // The template catalog is global (DEC-61) and exempt by exact row, so it receives the
  // `plantilla` delegate alone: no scoped model is within reach of an exempt handler.
  registerPlantillaRoutes(app, prisma.plantilla);
  // The template test route is NOT exempt (DEC-62): it resolves a tenant-owned connection,
  // so it gets the full scoped client, like the tenant-scoped registrars above.
  registerPlantillaPruebaRoute(app, prisma, registro);
  // CH-13: automations are tenant-owned, so the full scoped client, like the test route.
  // The deployment zone (DEC-77) comes from this file's one `loadConfig()`, so a schedule
  // is accepted only in the zone the scheduler will read it in.
  registerAutomatizacionRoutes(app, prisma, zonaHoraria);
  // CH-19b (DEC-121): the tenant's agent and its token, scoped by the header like the routes
  // above and not exempt; the `/agente/` prefix stays reserved for the agent itself (DEC-116).
  registerAgenteRoutes(app, prisma, registro);
  // CH-19c1 (DEC-122): the agent's own WebSocket upgrade, outside Fastify's routing, so the
  // tenant-context hooks and their exemption list above never see it. Its `preClose` hook
  // closes every agent socket before Fastify's `server.close()` waits on them.
  registrarServidorAgentes({ app, prisma, registro });
  // CH-22a (DEC-136): the client panel's own authentication surface, exempt from the
  // `X-Tenant-Id` header hooks by `RUTAS_PANEL_PUBLICAS` — the panel derives the tenant
  // exclusively from the session cookie (DEC-135), with the audited unscoped lookups in
  // `src/aislamiento-prisma.ts`.
  registerPanelAuthRoutes(app, prisma);
  // CH-22b (DEC-137): the panel's read-only "mis automatizaciones", session-guarded and exempt
  // by one exact row in `RUTAS_PANEL_PUBLICAS`. The clock stays at its default.
  registerPanelAutomatizacionesRoutes(app, prisma, zonaHoraria);
  registerPanelAjustesRoutes(app, prisma, zonaHoraria);
  // CH-22a PR3: `GET /panel` serves the P-01 login screen without a session or the panel
  // shell with the tenant name once `levantarSesionPanel` resolves one (DEC-135). The page
  // route is exempt from the `X-Tenant-Id` header hooks by exact GET row in
  // `src/contexto-tenant.ts`, not by `RUTAS_PANEL_PUBLICAS`.
  registerPanelRoutes(app, prisma);
  // CH-29 (DEC-151): the console's login and logout; the login is exempt from the guard,
  // the logout is not.
  registerConsolaAuthRoutes(app, prisma);
}
