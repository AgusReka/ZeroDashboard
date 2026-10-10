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
import { cargarEstilos, registerEstilosRoutes } from './estilos-rutas.js';
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
import { crearRegistroAgentes } from './registro-agentes.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { crearPlanificador } from './planificador.js';
import { crearNotificadorSmtp } from './notificador.js';
import { registrarApagado } from './apagado.js';

const config = loadConfig();
// CH-21a (DEC-124): the five shared stylesheet files are read once, here, before any
// database client, scheduler or listener exists. A missing or unreadable file throws
// naming it (`public/ui/<file>`), so the process stops the same way `loadConfig()` does.
const estilos = cargarEstilos();
const app = Fastify({ logger: true });
const adapter = new PrismaPg({ connectionString: config.databaseUrl });
// The raw client is consumed on this line and never bound to a name: `prisma` is the
// extended one, so no module downstream has an un-scoped handle to reach for.
const prisma = extenderConAislamiento(new PrismaClient({ adapter }));
// CH-13 (DEC-75): the one in-process scheduler, on the same scoped client and the same
// zone the create route checks schedules in. It is armed only once the server listens,
// and closing the app clears its timer and waits for a tick already running.
// CH-14 (DEC-86 and its addendum): the notifier is built here, before `listen`, from the
// `SMTP_*` variables. `SMTP_HOST` absent or empty gives `null` and every run records
// `no-configurada`; `SMTP_HOST` present with anything else invalid throws here, naming
// the variable and never its value, so the process stops before accepting a request.
// Only the configured/not-configured state is logged: no host, port, sender or user.
const notificador = crearNotificadorSmtp({ timeoutMs: config.smtpTimeoutMs });
app.log.info({ correo: notificador === null ? 'no-configurado' : 'configurado' }, 'email notifications');
// CH-17b (DEC-98, DEC-105, DEC-106): the connection retry policy from
// `CONNECTION_RETRY_ATTEMPTS` and `CONNECTION_RETRY_PAUSE_MS`, already validated by
// `loadConfig()` above. Only scheduled runs retry; the console paths never do.
// CH-19c1 (DEC-122): the in-memory agent session registry, built before the scheduler and
// the routes: the five paths that dial a connection open an agent-bound one through it,
// and the revoke and baja routes close an agent's live sockets with 4002.
const registro = crearRegistroAgentes();
const planificador = crearPlanificador({
  prisma,
  zonaHoraria: config.zonaHoraria,
  log: app.log,
  notificador,
  reintentos: { intentos: config.connectionRetryAttempts, pausaMs: config.connectionRetryPauseMs },
  canales: registro,
});
app.addHook('onClose', async () => {
  await planificador.detener();
});

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
registerAutomatizacionRoutes(app, prisma, config.zonaHoraria);
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
registerPanelAutomatizacionesRoutes(app, prisma, config.zonaHoraria);
registerPanelAjustesRoutes(app, prisma, config.zonaHoraria);
// CH-22a PR3: `GET /panel` serves the P-01 login screen without a session or the panel
// shell with the tenant name once `levantarSesionPanel` resolves one (DEC-135). The page
// route is exempt from the `X-Tenant-Id` header hooks by exact GET row in
// `src/contexto-tenant.ts`, not by `RUTAS_PANEL_PUBLICAS`.
registerPanelRoutes(app, prisma);

// CH-17a (DEC-100): SIGTERM and SIGINT close the app, so the `onClose` hook above stops
// the scheduler before the process exits.
registrarApagado({ proceso: process, cerrar: () => app.close(), log: app.log });

// CH-17a (DEC-99, DEC-102): `arrancar` sweeps the rows a stopped process left `en-curso`,
// then arms the first tick. HTTP never writes `Ejecucion`, so serving during the sweep is
// safe; the sweep never rejects, so a failed one does not reach the `.catch` below.
app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then(() => planificador.arrancar())
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
