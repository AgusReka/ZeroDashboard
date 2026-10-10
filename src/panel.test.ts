import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { hashearClave } from './crypto-auth.js';
import { registerPanelAuthRoutes } from './panel-auth.js';
import { registerPanelRoutes } from './panel.js';

/**
 * CH-22a tasks 3.1 and 3.2 (DEC-04, DEC-135, DEC-136): the servable panel page.
 * `GET /panel` without a session serves the P-01 login screen; with a session it
 * serves the panel shell naming the tenant — and only that tenant, even when the
 * request carries `X-Tenant-Id` for someone else (rule 2: the panel never resolves
 * a tenant from the request).
 *
 * Same live-database wiring as `src/panel-auth.test.ts`: the fixtures are one
 * `Tenant` with one `Usuario` (tenant A) plus a decoy tenant B that only exists to
 * prove the header is ignored. The page route is registered through the real
 * registrar, after the real tenant-context hooks, exactly as `src/server.ts`
 * wires them.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
// Same fixture key `src/aislamiento.test.ts` supplies for suites that boot the app.
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** The password every fixture user shares; never stored, only submitted at login. */
const CLAVE = 'clave-segura-de-prueba-2';
/** The one cookie the design names (DEC-134). */
const NOMBRE_COOKIE = 'zd_panel_session';

/** One TCP handshake, no driver: decides whether this suite has a server to talk to. */
function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  "bring up the Compose db service and set TEST_DB_* (see src/panel-auth.test.ts)";

describe(
  'GET /panel — login screen and session shell (CH-22a PR3, P-01)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let app!: FastifyInstance;
    /** Raw client: fixtures, cleanup, and every assertion the API cannot express. */
    let db!: PrismaClient;
    let tenantAId!: string;
    /** Serves as the shell header's store name and the escaping pin: `&` and `<`
     *  would read as markup if the page did not escape them. */
    let tenantANombre!: string;
    let correoA!: string;
    /** The decoy tenant: its only job is to prove `X-Tenant-Id` has no effect. */
    let tenantBNombre!: string;
    const tenantIds: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const aislado = extenderConAislamiento(db);
      app = Fastify({ logger: false });
      registrarContextoTenant(app, aislado);
      registerPanelAuthRoutes(app, aislado);
      registerPanelRoutes(app, aislado);
      await app.ready();

      const base = `CH-22a panel ${Date.now()}`;
      const tenantA = await db.tenant.create({
        data: { nombre: `${base} Tienda & Cía <prueba>`, activo: true },
      });
      const tenantB = await db.tenant.create({
        data: { nombre: `${base} Otra Tienda`, activo: true },
      });
      tenantIds.push(tenantA.id, tenantB.id);
      tenantAId = tenantA.id;
      tenantANombre = tenantA.nombre;
      tenantBNombre = tenantB.nombre;

      correoA = `panel-a-${Date.now()}@prueba.test`;
      await db.usuario.create({
        data: { tenantId: tenantA.id, correo: correoA, claveHash: await hashearClave(CLAVE), nombre: 'Panelista A' },
      });
    });

    after(async () => {
      if (tenantIds.length > 0) {
        // `SesionPanel.usuario` cascades, so deleting the users removes every session;
        // the tenant FK on `Usuario` is RESTRICT, which is why users go first.
        await db.usuario.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.$disconnect();
      await app.close();
    });

    /** Submits one valid login for the fixture user. */
    async function ingresar() {
      return await app.inject({
        method: 'POST',
        url: '/api/panel/auth/ingresar',
        payload: { correo: correoA, clave: CLAVE },
      });
    }

    /** Extracts the raw session token from a login response's `Set-Cookie`. */
    function tokenDe(respuesta: { headers: Record<string, unknown> }): string {
      const cruda = String(respuesta.headers['set-cookie'] ?? '');
      const token = /zd_panel_session=([^;]+)/.exec(cruda)?.[1];
      assert.ok(token !== undefined, `se esperaba la cookie en set-cookie: ${cruda}`);
      return token;
    }

    test('GET /panel without a session serves the P-01 login screen with both fields, the submit action and the stylesheet link', async (t) => {
      const respuesta = await app.inject({ method: 'GET', url: '/panel' });

      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.equal(respuesta.headers['content-type'], 'text/html; charset=utf-8');
      const html = respuesta.body;

      // The stylesheet of the shared visual system (CH-21a, DEC-124).
      assert.match(html, /<link rel="stylesheet" href="\/ui\/styles\.css">/);
      // The panel surface tokens: body 16 px, controls 44 px (P2).
      assert.match(html, /data-surface="panel"/);
      // The two credentials fields of P-01 (the API body names: correo, clave).
      assert.match(html, /name="correo"/);
      assert.match(html, /type="email"/);
      assert.match(html, /name="clave"/);
      assert.match(html, /type="password"/);
      // The form submits to the PR2 endpoint, method post (the script intercepts it).
      assert.match(html, /action="\/api\/panel\/auth\/ingresar"/);
      assert.match(html, /method="post"/);
      // The screen's own heading and the muted promise below the brand.
      assert.match(html, />Ingresar</);
      // No session, no tenant name anywhere on the login screen.
      assert.ok(!html.includes(tenantANombre), 'the login screen must not leak the tenant name');
      assert.ok(!html.includes(NOMBRE_COOKIE), 'the login screen must not echo the cookie name');
    });

    test('GET /panel with an active session serves the shell with the tenant store name, ignoring X-Tenant-Id', async (t) => {
      const token = tokenDe(await ingresar());

      const respuesta = await app.inject({
        method: 'GET',
        url: '/panel',
        headers: {
          cookie: `${NOMBRE_COOKIE}=${token}`,
          // Rule 2 (DEC-135): even a header naming another tenant must not move the
          // page — the header hooks never even read it on the panel surface.
          'x-tenant-id': tenantAId,
        },
      });

      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const html = respuesta.body;
      assert.match(html, /data-surface="panel"/);
      // The shell header shows the session's tenant, HTML-escaped (the fixture name
      // carries `&` and `<` exactly to pin this: raw, they would read as markup).
      assert.ok(html.includes('Tienda &amp; Cía'), 'the & must be escaped');
      assert.ok(html.includes('&lt;prueba&gt;'), 'the < > must be escaped');
      assert.ok(!html.includes('<prueba>'), 'the raw angle brackets must not appear');
      assert.match(html, /Salir/);
      // It is the shell, not the login screen.
      assert.ok(!html.includes('action="/api/panel/auth/ingresar"'), 'the shell must not carry the login form');
      // The raw session token must never appear in the served HTML.
      assert.ok(!html.includes(token), 'the page must not leak the session token');
    });

    test('GET /panel with X-Tenant-Id of a different tenant still names the session tenant only', async (t) => {
      const token = tokenDe(await ingresar());

      const respuesta = await app.inject({
        method: 'GET',
        url: '/panel',
        headers: { cookie: `${NOMBRE_COOKIE}=${token}` },
      });

      assert.equal(respuesta.statusCode, 200, respuesta.body);
      // The session's own tenant is there, escaped; the decoy tenant is nowhere.
      assert.ok(respuesta.body.includes('Tienda &amp; Cía'));
      assert.ok(!respuesta.body.includes(tenantBNombre), 'tenant B leaked onto the page');
      assert.ok(!respuesta.body.includes('Otra Tienda'), 'tenant B leaked onto the page');
    });

    /** The authenticated shell's HTML plus its last inline script (the P-02 screen script). */
    async function shellConScript() {
      const token = tokenDe(await ingresar());
      const respuesta = await app.inject({ method: 'GET', url: '/panel', headers: { cookie: `${NOMBRE_COOKIE}=${token}` } });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const html = respuesta.body;
      const script = html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
      return { html, script };
    }

    test('GET /panel with a session serves the P-02 screen markup and a script that reads the automations route with no tenant identifier (CH-22b)', async (t) => {
      const { html, script } = await shellConScript();

      assert.match(html, /id="estado-carga"/);
      assert.match(html, /class="zd-skeleton /);
      assert.match(html, /id="estado-vacio"/);
      assert.match(html, /id="estado-error"[^>]*role="alert"/);
      assert.match(html, /id="lista-activas"/);
      assert.match(html, /id="seccion-disponibles"/);
      // The data request: same-origin cookie, no custom header, nothing tenant-shaped.
      assert.ok(script.includes("fetch('/api/panel/automatizaciones', { credentials: 'same-origin' })"));
      assert.ok(!/x-tenant-id|tenantId|headers/i.test(script), 'the script must not send any tenant identifier or header');
      // The login render is unchanged by this screen.
      assert.ok(!html.includes('action="/api/panel/auth/ingresar"'));
      const login = await app.inject({ method: 'GET', url: '/panel' });
      assert.ok(!login.body.includes('/api/panel/automatizaciones'), 'the login screen must not carry the screen script');
    });

    test('the P-02 script carries every state string and the 401 reload branch (CH-22b)', async (t) => {
      const { html, script } = await shellConScript();

      for (const texto of [
        'Todavía no activaste ninguna automatización',
        'No pudimos cargar tus automatizaciones',
        'Volvé a intentar en unos minutos.',
        'Tu negocio no está activo en este momento. Comunicate con quien te dio acceso.',
        'Todavía no hubo una revisión',
        'Activa',
        'Pausada',
        'Con falla',
        'Se completó',
        'No se pudo hacer',
        'No pudimos completar esta automatización esta vez',
        'La última revisión falló. La próxima vez que se ejecute, volvemos a intentarlo.',
      ]) {
        assert.ok((html + script).includes(texto), `falta el texto: ${texto}`);
      }
      assert.match(script, /status === 401\) \{\s*window\.location\.reload\(\)/);
      assert.ok(script.includes("new Intl.DateTimeFormat('es-AR'"));
    });

    test('the P-02 script is safe to embed and offers no actions (CH-22b)', async (t) => {
      const { html, script } = await shellConScript();

      assert.ok(!script.includes('`'), 'no JS template literal');
      assert.ok(!script.includes('${'), 'no interpolation');
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(script), 'API values only through textContent');
      assert.ok(script.includes('.textContent = texto'));
      assert.ok(!/\.(href|src)\s*=/.test(script), 'no href or src built from API data');
      assert.ok(!/Ajustar|Activar/.test(html), 'no actions are offered (write actions are CH-23)');
      assert.ok(!/<button/.test(html.replace(/<button id="boton-salir"[\s\S]*?<\/button>/, '')), 'Salir is the only control');
    });

    test('the P-02 screen has no glossary-forbidden term in visible text or script string literals (CH-22b)', async (t) => {
      const { html, script } = await shellConScript();
      const visible = html
        .replace(/<script>[\s\S]*?<\/script>/g, ' ')
        .replace(/<style>[\s\S]*?<\/style>/g, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]*>/g, ' ');
      const literales = (script.match(/'[^']*'/g) ?? []).join(' ');
      const prohibido = /tenant|cron|sql|consulta|query|ejecución|réplica|parámetro|timeout|plantilla/i;

      assert.ok(!prohibido.test(visible), `término técnico en el texto visible: ${prohibido.exec(visible)?.[0]}`);
      assert.ok(!prohibido.test(literales), `término técnico en el script: ${prohibido.exec(literales)?.[0]}`);
    });

    test('GET /panel with an unknown cookie serves the login screen, never the shell', async (t) => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/panel',
        headers: { cookie: `${NOMBRE_COOKIE}=token-que-no-existe` },
      });

      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.match(respuesta.body, /action="\/api\/panel\/auth\/ingresar"/);
      assert.ok(!respuesta.body.includes(tenantANombre), 'a dead cookie must not render the shell');
    });
  },
);