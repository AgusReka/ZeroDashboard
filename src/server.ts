import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { loadConfig } from './compartido/config.js';
import { cargarEstilos } from './compartido/estilos-rutas.js';
import { crearRegistroAgentes } from './agente/registro-agentes.js';
import { registrarRutas } from './app/rutas.js';
import { extenderConAislamiento } from './aislamiento/aislamiento-prisma.js';
import { crearPlanificador, relojDelSistema } from './automatizaciones/planificador.js';
import { crearNotificadorSmtp } from './automatizaciones/notificador.js';
import { registrarApagado } from './app/apagado.js';
import { leerTelegram } from './telegram/telegram-config.js';
import { crearClienteTelegram } from './telegram/cliente-telegram.js';
import { crearSondeoTelegram } from './telegram/sondeo-telegram.js';
import { crearVincular } from './telegram/vincular.js';
import { crearNotificadorTelegram } from './telegram/notificador-telegram.js';

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
// CH-43 (DEC-185, DEC-196): `TELEGRAM_BOT_TOKEN` is optional and read only by
// `leerTelegram`, never copied onto `AppConfig`. Only the configured/not-configured state is
// logged, never the token. With no token there is no poller and no request to Telegram;
// with one, the poller is built here and starts only once the server listens.
const configTelegram = leerTelegram(process.env);
app.log.info({ telegram: configTelegram === null ? 'no-configurado' : 'configurado' }, 'telegram link');
// CH-44 (DEC-185, DEC-197): one client, for the poller and for the channel's notices.
const clienteTelegram = configTelegram === null ? null : crearClienteTelegram(configTelegram.token);
const notificadorTelegram = clienteTelegram === null ? null : crearNotificadorTelegram(clienteTelegram);
const sondeo =
  clienteTelegram === null
    ? null
    : crearSondeoTelegram({
        cliente: clienteTelegram,
        vincular: crearVincular(prisma, relojDelSistema),
        reloj: relojDelSistema,
        aleatorio: Math.random,
        log: app.log,
      });
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
  notificadorTelegram,
  reintentos: { intentos: config.connectionRetryAttempts, pausaMs: config.connectionRetryPauseMs },
  canales: registro,
});
app.addHook('onClose', async () => {
  await planificador.detener();
});
// CH-43 (DEC-185, DEC-196): closing aborts the poller's open long poll instead of waiting it out.
app.addHook('onClose', async () => {
  await sondeo?.detener();
});

// CH-29 (DEC-152): the operator guard, the tenant hooks and every route, in their
// load-bearing order, live in `src/app/rutas.ts` so a test can build the same route table.
registrarRutas(app, {
  prisma,
  registro,
  estilos,
  zonaHoraria: config.zonaHoraria,
  topeFilas: config.maxFilasPorConsulta,
  // CH-42 (DEC-195): the message preview decides with the scheduler's own signal.
  correoConfigurado: notificador !== null,
  // CH-43 (DEC-185, DEC-196): the poller is the panel's bot port; `null` with no token.
  telegram: sondeo,
});

// CH-17a (DEC-100): SIGTERM and SIGINT close the app, so the `onClose` hook above stops
// the scheduler before the process exits.
registrarApagado({ proceso: process, cerrar: () => app.close(), log: app.log });

// CH-17a (DEC-99, DEC-102): `arrancar` sweeps the rows a stopped process left `en-curso`,
// then arms the first tick. HTTP never writes `Ejecucion`, so serving during the sweep is
// safe; the sweep never rejects, so a failed one does not reach the `.catch` below.
app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then(() => {
    // CH-43 (DEC-185, DEC-196): the poller starts beside the scheduler, never before `listen`.
    sondeo?.iniciar();
    return planificador.arrancar();
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
