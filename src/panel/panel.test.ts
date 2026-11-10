import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { hashearClave } from '../compartido/crypto-auth.js';
import { terminosProhibidosEn } from '../compartido/glosario-panel.js';
import { registerPanelAuthRoutes } from './panel-auth.js';
import { registerPanelRoutes } from './panel.js';

/**
 * CH-22a tasks 3.1 and 3.2 (DEC-04, DEC-135, DEC-136): the servable panel page.
 * `GET /panel` without a session serves the P-01 login screen; with a session it
 * serves the panel shell naming the tenant — and only that tenant, even when the
 * request carries `X-Tenant-Id` for someone else (rule 2: the panel never resolves
 * a tenant from the request).
 *
 * Same live-database wiring as `src/panel/panel-auth.test.ts`: the fixtures are one
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
// Same fixture key `src/aislamiento/aislamiento.test.ts` supplies for suites that boot the app.
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
  "bring up the Compose db service and set TEST_DB_* (see src/panel/panel-auth.test.ts)";

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
      assert.ok(!/x-tenant-id|tenantId/i.test(script), 'the script must not send any tenant identifier');
      // CH-23: the only header is the JSON content type of the adjust request.
      assert.deepEqual(script.match(/headers:\s*\{[^}]*\}/g), ["headers: { 'Content-Type': 'application/json' }"]);
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

    test('the P-04 form carries every string, sends only the four fields and never a schedule expression (CH-23)', async (t) => {
      const { script } = await shellConScript();

      // Syntax only: `new Function` compiles the source and never runs it, so a typo in the
      // page script fails here and not in the browser.
      assert.doesNotThrow(() => new Function(script), 'the page script must compile');

      for (const texto of [
        'Ajustar',
        'Cantidad mínima',
        'Te avisamos cuando un producto llegue a esta cantidad o menos.',
        'Hora de envío',
        'Días',
        'Enviar a',
        'Guardar cambios',
        'Cancelar',
        'Guardamos tus cambios',
        'Se aplican desde la próxima revisión.',
        'Escribí un número entero, 0 o más.',
        'Elegí una hora válida.',
        'Elegí los días de envío.',
        'Revisá los correos: escribí entre 1 y 5, separados por comas.',
        'Hasta 5 correos, separados por comas.',
        'Revisá los datos e intentá de nuevo.',
        'No cambiaste ningún dato.',
        'Esta automatización ya no se puede ajustar.',
        'Todos los días',
        'De lunes a viernes',
        'De lunes a sábado',
      ]) {
        assert.ok(script.includes(texto), `falta el texto: ${texto}`);
      }
      // The request body is built from the four fields only; nothing else can be added.
      const campos = new Set([...script.matchAll(/cuerpo\.(\w+) = /g)].map((m) => m[1]));
      assert.deepEqual([...campos].sort(), ['canal', 'destinatarios', 'dias', 'hora', 'umbral']);
      assert.ok(script.includes("method: 'PUT'"));
      assert.ok(script.includes('encodeURIComponent(id)'), 'the id travels as a path segment, encoded');
      assert.ok(!/\bcron\b|\bvalores\b|\bsql\b/i.test(script), 'no schedule expression, value map or SQL on the page');
      // Only the active and failing cards get the action.
      assert.match(script, /if \(esActiva \|\| esConFalla\) \{[\s\S]*?'Ajustar'/);
    });

    test('CH-44 the channel: copy, the glossary, and what the form sends', async () => {
      const { script } = await shellConScript();
      for (const texto of [
        'Enviar por',
        'Telegram',
        'Correo',
        'Elegí por dónde querés recibir este aviso.',
        'Este aviso no te está llegando',
        'Se manda por Telegram y no hay un chat vinculado.',
      ]) {
        assert.ok(script.includes(texto), `falta el texto: ${texto}`);
        assert.deepEqual(terminosProhibidosEn(texto), [], texto);
      }
      const funcion = (nombre: string): string => {
        const desde = script.indexOf(`function ${nombre}(`);
        assert.ok(desde !== -1, nombre);
        return script.slice(desde, script.indexOf('\n}', desde) + 2);
      };
      const cuerpoDeCambios = new Function(
        `${funcion('direccionesDe')}\n${funcion('cuerpoDeCambios')}\nreturn cuerpoDeCambios;`,
      )() as (campos: unknown, ajustes: unknown) => Record<string, unknown>;
      const campos = (canal: string, correos: string) => ({
        canal: { control: { value: canal } },
        destinatarios: { control: { value: correos } },
      });
      const enCorreo = { canal: 'correo', destinatarios: ['a@b.com'] };
      const enTelegram = { canal: 'telegram', destinatarios: [] };
      // Choosing Telegram sends the channel alone, whatever the hidden field holds.
      assert.deepEqual(cuerpoDeCambios(campos('telegram', 'otro@b.com'), enCorreo), { canal: 'telegram' });
      // No change: nothing to send.
      assert.deepEqual(cuerpoDeCambios(campos('correo', 'a@b.com'), enCorreo), {});
      assert.deepEqual(cuerpoDeCambios(campos('telegram', ''), enTelegram), {});
      // Going back sends the channel and what was typed.
      assert.deepEqual(cuerpoDeCambios(campos('correo', 'c@d.com'), enTelegram), { canal: 'correo', destinatarios: ['c@d.com'] });
      // With no choice offered, the form works as before.
      assert.deepEqual(cuerpoDeCambios({ destinatarios: { control: { value: 'c@d.com' } } }, enCorreo), { destinatarios: ['c@d.com'] });
    });

    test('CH-41 the P-04 form splits the field into a list and sends it only when it differs from the stored one', async (t) => {
      const { script } = await shellConScript();

      // The regex survived the template string that serves the script: `\s` and not a bare `s`.
      assert.ok(script.includes(String.raw`split(/[,;\s]+/)`), 'the separators are commas, semicolons and any whitespace');
      // The control accepts the separators: a text input, not an email one that refuses them.
      assert.ok(script.includes("correo.type = 'text'"));
      assert.ok(!script.includes("correo.type = 'email'"));

      // The two functions run on their own, with a fake field, against the served source.
      const funcion = (nombre: string): string => {
        const inicio = script.indexOf(`function ${nombre}(`);
        assert.ok(inicio !== -1, nombre);
        return script.slice(inicio, script.indexOf('\n}', inicio) + 2);
      };
      const cuerpoDeCambios = new Function(
        `${funcion('direccionesDe')}\n${funcion('cuerpoDeCambios')}\nreturn cuerpoDeCambios;`,
      )() as (campos: unknown, ajustes: unknown) => Record<string, unknown>;
      const campo = (texto: string) => ({ destinatarios: { control: { value: texto } } });
      const ajustes = { destinatarios: ['a@b.com', 'c@d.com'] };

      // Two addresses typed with a comma, a semicolon and a line break: one list of two.
      assert.deepEqual(cuerpoDeCambios(campo('a@b.com, c@d.com;e@f.com\n'), ajustes), {
        destinatarios: ['a@b.com', 'c@d.com', 'e@f.com'],
      });
      // Only the separators changed: nothing is sent.
      assert.deepEqual(cuerpoDeCambios(campo('a@b.com;  c@d.com'), ajustes), {});
      assert.deepEqual(cuerpoDeCambios(campo(' a@b.com ,c@d.com '), ajustes), {});
      // Emptied: the empty list is sent, and the server refuses it (the panel cannot empty the list).
      assert.deepEqual(cuerpoDeCambios(campo('  , ;'), ajustes), { destinatarios: [] });
      // The server's own spelling is kept: no case folding or deduplication here.
      assert.deepEqual(cuerpoDeCambios(campo('A@b.com a@b.com'), { destinatarios: ['A@b.com'] }), {
        destinatarios: ['A@b.com', 'a@b.com'],
      });
    });

    test('the P-02 script is safe to embed and offers no activation (CH-22b, CH-23)', async (t) => {
      const { html, script } = await shellConScript();

      assert.ok(!script.includes('`'), 'no JS template literal');
      assert.ok(!script.includes('${'), 'no interpolation');
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(script), 'API values only through textContent');
      assert.ok(script.includes('.textContent = texto'));
      // CH-43: the one link built from a server value is the Telegram one, behind its prefix check.
      const enlaceTelegram = 'if (enlaceValido) { abrir.href = telegram.enlace; }';
      assert.ok(script.includes(enlaceTelegram));
      assert.ok(script.includes("var ENLACE_TELEGRAM = 'https://t.me/';"));
      assert.ok(!/\.(href|src)\s*=/.test(script.replace(enlaceTelegram, '')), 'no other href or src built from API data');
      assert.ok(!/Activar/.test(html), 'activation is not offered');
      const sinTarjeta = html.replace(/<section id="tarjeta-telegram"[\s\S]*?<\/section>/, '');
      assert.ok(!/<button/.test(sinTarjeta.replace(/<button id="boton-salir"[\s\S]*?<\/button>/, '')), 'Salir is the only static control outside the Telegram card');
    });

    /** A minimal DOM: every id resolves to one recorded element, and clicks run the handlers. */
    function domFalso() {
      const elementos = new Map<string, any>();
      const crear = (tagName = ''): any => ({
        tagName, hidden: false, textContent: '', className: '', disabled: false, href: '', children: [] as unknown[],
        querySelector() { return null; },
        insertBefore(hijo: unknown) { this.children.unshift(hijo); return hijo; },
        removeChild(hijo: unknown) { this.children = this.children.filter((h: unknown) => h !== hijo); return hijo; },
        atributos: {} as Record<string, string>, oyentes: [] as Array<() => void>,
        appendChild(hijo: unknown) { this.children.push(hijo); return hijo; },
        setAttribute(clave: string, valor: string) { this.atributos[clave] = valor; },
        removeAttribute(clave: string) { delete this.atributos[clave]; },
        addEventListener(_tipo: string, oyente: () => void) { this.oyentes.push(oyente); },
        focus() {},
        classList: { contains: () => false },
      });
      const documento = {
        getElementById(id: string) {
          if (!elementos.has(id)) elementos.set(id, crear());
          return elementos.get(id);
        },
        createElement: crear,
        createElementNS: crear,
        createTextNode: (texto: string): any => ({ tagName: '#text', textContent: texto, children: [] as unknown[] }),
      };
      return {
        documento,
        elementos: () => [...elementos.values()],
        el: (id: string) => documento.getElementById(id),
        clic: (id: string) => documento.getElementById(id).oyentes.forEach((o: () => void) => o()),
      };
    }

    /** Runs the served script against the fake DOM; `respuestas` answers by "METHOD url", `null` rejects. */
    function correrScript(script: string, respuestas: Record<string, { status: number; cuerpo?: unknown } | null>) {
      const dom = domFalso();
      const pedidos: string[] = [];
      const buscar = (url: string, init: { method?: string } = {}) => {
        const clave = `${init.method ?? 'GET'} ${url}`;
        pedidos.push(clave);
        const r = respuestas[clave];
        if (r === null || r === undefined) return Promise.reject(new Error('red'));
        return Promise.resolve({ status: r.status, ok: r.status < 300, json: () => (r.cuerpo === undefined ? Promise.reject(new Error('vacío')) : Promise.resolve(r.cuerpo)) });
      };
      const recargas: unknown[] = [];
      new Function('document', 'fetch', 'window', script)(dom.documento, buscar, { location: { reload: () => recargas.push(1) } });
      return { ...dom, pedidos, recargas };
    }
    const esperar = () => new Promise((r) => setImmediate(r));
    const LISTA = { status: 200, cuerpo: { activas: [], disponibles: [], zonaHoraria: 'UTC', truncado: false } };

    /** Every node under the page's fixed elements, depth first. */
    function nodos(corrida: { elementos: () => any[] }): any[] {
      const salida: any[] = [];
      const visitar = (nodo: any) => {
        salida.push(nodo);
        for (const hijo of nodo.children) visitar(hijo);
      };
      corrida.elementos().forEach(visitar);
      return salida;
    }
    const conTexto = (corrida: { elementos: () => any[] }, texto: string) => nodos(corrida).filter((n) => n.textContent === texto);

    describe('CH-44 the card and the form, run against the fake DOM', () => {
      const ITEM = {
        id: 'a-1', titulo: 'Aviso de stock', descripcion: 'Te avisamos.', estado: 'activa',
        ultimaEjecucion: { fecha: '2026-11-05T08:00:00.000Z', resultado: 'completada' },
        proximaEjecucion: '2026-11-06T08:00:00.000Z', frecuencia: 'Todos los días a las 08:00',
      };
      const lista = (item: object) => ({ status: 200, cuerpo: { activas: [item], disponibles: [], zonaHoraria: 'UTC', truncado: false } });
      const AJUSTES = '/api/panel/automatizaciones/a-1/ajustes';

      /** Paints the list, presses «Ajustar» and answers the read with `ajustes`. */
      async function abrirForma(script: string, ajustes: object) {
        const corrida = correrScript(script, {
          'GET /api/panel/automatizaciones': lista(ITEM),
          'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'sin-vincular', bot: 'zd_bot' } },
          [`GET ${AJUSTES}`]: { status: 200, cuerpo: ajustes },
        });
        await esperar();
        const [boton] = conTexto(corrida, 'Ajustar');
        assert.ok(boton !== undefined, 'the card offers «Ajustar»');
        boton.oyentes.forEach((oyente: () => void) => oyente());
        await esperar();
        return corrida;
      }

      const BASE = { destinatarios: ['a@b.com'], zonaHoraria: 'UTC' };

      test('a card with sinVinculo shows the warning, and one without it does not', async () => {
        const { script } = await shellConScript();
        const conAviso = correrScript(script, {
          'GET /api/panel/automatizaciones': lista({ ...ITEM, sinVinculo: true }),
          'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'sin-vincular', bot: 'zd_bot' } },
        });
        await esperar();
        assert.equal(conTexto(conAviso, 'Este aviso no te está llegando').length, 1);
        assert.equal(conTexto(conAviso, 'Se manda por Telegram y no hay un chat vinculado.').length, 1);

        const sinAviso = correrScript(script, {
          'GET /api/panel/automatizaciones': lista(ITEM),
          'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'sin-vincular', bot: 'zd_bot' } },
        });
        await esperar();
        assert.equal(conTexto(sinAviso, 'Este aviso no te está llegando').length, 0);
      });

      test('with one channel to offer there is no choice, and «Enviar a» shows', async () => {
        const { script } = await shellConScript();
        const corrida = await abrirForma(script, { ...BASE, canal: 'correo', canales: ['correo'] });
        assert.equal(conTexto(corrida, 'Enviar por').length, 0);
        assert.equal(conTexto(corrida, 'Enviar a').length, 1);
      });

      test('with both, the select follows the stored channel and toggles «Enviar a»', async () => {
        const { script } = await shellConScript();
        const corrida = await abrirForma(script, { ...BASE, canal: 'correo', canales: ['correo', 'telegram'] });
        assert.equal(conTexto(corrida, 'Enviar por').length, 1);
        const select = nodos(corrida).find((n) => n.tagName === 'select' && n.children.some((o: any) => o.textContent === 'Telegram'));
        assert.ok(select !== undefined, 'the select is on the page');
        assert.equal(select.value, 'correo');
        const cajaDeEnviarA = nodos(corrida).find((n) => n.children.some((h: any) => h.textContent === 'Enviar a'));
        assert.equal(cajaDeEnviarA.hidden, false);
        select.value = 'telegram';
        select.oyentes.forEach((oyente: () => void) => oyente());
        assert.equal(cajaDeEnviarA.hidden, true);
        select.value = 'correo';
        select.oyentes.forEach((oyente: () => void) => oyente());
        assert.equal(cajaDeEnviarA.hidden, false);
      });

      test('a Telegram automation opens with «Enviar a» hidden and can go back', async () => {
        const { script } = await shellConScript();
        const corrida = await abrirForma(script, { ...BASE, destinatarios: [], canal: 'telegram', canales: ['correo', 'telegram'] });
        const select = nodos(corrida).find((n) => n.tagName === 'select' && n.children.some((o: any) => o.textContent === 'Telegram'));
        assert.equal(select.value, 'telegram');
        assert.equal(select.children.map((o: any) => o.value).join(), 'correo,telegram');
        const cajaDeEnviarA = nodos(corrida).find((n) => n.children.some((h: any) => h.textContent === 'Enviar a'));
        assert.equal(cajaDeEnviarA.hidden, true);
      });
    });

    describe('UX review lote 1 (P-01 to P-10), run against the fake DOM', () => {
      const ITEM = {
        id: 'a-1', titulo: 'Aviso de stock', descripcion: 'Te avisamos.', estado: 'activa',
        ultimaEjecucion: { fecha: '2026-11-05T08:00:00.000Z', resultado: 'completada' },
        proximaEjecucion: '2026-11-11T12:00:00.000Z', frecuencia: 'Todos los días a las 08:00',
      };
      const AJUSTES = '/api/panel/automatizaciones/a-1/ajustes';
      const ESCRIBI_NUMERO = 'Escribí un número entero, 0 o más.';

      const scriptDe = (html: string) => html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
      const funcionDe = (script: string, nombre: string): string => {
        const inicio = script.indexOf(`function ${nombre}(`);
        assert.ok(inicio !== -1, nombre);
        return script.slice(inicio, script.indexOf('\n}', inicio) + 2);
      };

      test('P-01: a primary button drawn as a link takes the primary text color, with no underline', async () => {
        const { html } = await shellConScript();
        assert.match(html, /\.zd-root a\.zd-btn--primary,\s*\.zd-root a\.zd-btn--primary:hover\s*\{[^}]*color:\s*var\(--text-on-accent\)/);
        assert.match(html, /\.zd-root a\.zd-btn--primary[^{]*\{[^}]*text-decoration:\s*none/);
        assert.match(html, /<a id="telegram-abrir" class="zd-btn zd-btn--primary"/);
      });

      test('P-02 and P-10: the login says who to ask for a password and no longer talks about choosing a business', async () => {
        const { body: html } = await app.inject({ method: 'GET', url: '/panel' });
        assert.ok(html.includes('¿No tenés o perdiste tu contraseña? Pedísela a quien te dio acceso.'));
        assert.ok(html.includes('Con tu correo entrás a tu negocio.'));
        assert.ok(!html.includes('Entrás directo a tu negocio'));
        // Help text only: no recovery link or flow (DEC-156).
        assert.ok(!/href=/.test(html.replace(/<link[^>]*>/g, '')), 'the login adds no link');
        for (const texto of ['¿No tenés o perdiste tu contraseña? Pedísela a quien te dio acceso.', 'Con tu correo entrás a tu negocio.']) {
          assert.deepEqual(terminosProhibidosEn(texto), [], texto);
        }
      });

      describe('P-03: the login tells a refused form apart from a connection problem', () => {
        async function ingresarCon(respuesta: { status: number; cuerpo?: unknown } | null) {
          const { body: html } = await app.inject({ method: 'GET', url: '/panel' });
          const corrida = correrScript(scriptDe(html), { 'POST /api/panel/auth/ingresar': respuesta });
          const forma = corrida.el('form-ingreso');
          forma.action = '/api/panel/auth/ingresar';
          forma.elements = { correo: { value: '' }, clave: { value: '' } };
          forma.oyentes[0]({ preventDefault() {} });
          await esperar();
          return corrida;
        }
        const texto = (corrida: { el: (id: string) => any }) => corrida.el('texto-aviso').textContent;

        test('a 400 asks for both fields', async () => {
          const corrida = await ingresarCon({ status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/correo'] } });
          assert.equal(texto(corrida), 'Escribí tu correo y tu contraseña.');
          assert.equal(corrida.el('aviso-ingreso').hidden, false);
          assert.equal(corrida.el('boton-ingresar').disabled, false);
        });

        test('wrong credentials, a deactivated business, a 5xx and a network failure keep their own messages', async () => {
          assert.equal(texto(await ingresarCon({ status: 401, cuerpo: { error: 'correo-o-clave-incorrectos' } })), 'El correo o la contraseña no coinciden.');
          assert.equal(texto(await ingresarCon({ status: 409, cuerpo: { error: 'tenant-desactivado' } })), 'Tu negocio no está activo en este momento. Comunicate con quien te dio acceso.');
          const conexion = 'No pudimos conectar con el servidor. Volvé a intentar en unos minutos.';
          assert.equal(texto(await ingresarCon({ status: 500, cuerpo: { error: 'error-interno' } })), conexion);
          assert.equal(texto(await ingresarCon({ status: 502 })), conexion);
          assert.equal(texto(await ingresarCon(null)), conexion);
        });

        test('a successful login reloads and shows no notice', async () => {
          const corrida = await ingresarCon({ status: 200, cuerpo: {} });
          assert.equal(corrida.recargas.length, 1);
          assert.equal(corrida.el('aviso-ingreso').hidden, true);
        });
      });

      test('P-04 and P-08: an available card says who to ask, offers no button, and the dates read dd/mm, HH:mm', async () => {
        const { script } = await shellConScript();
        const corrida = correrScript(script, {
          'GET /api/panel/automatizaciones': {
            status: 200,
            cuerpo: {
              activas: [ITEM],
              disponibles: [{ titulo: 'Aviso de productos que ya casi no podés armar', descripcion: 'Te avisamos.' }],
              zonaHoraria: 'UTC',
              truncado: false,
            },
          },
          'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'sin-vincular', bot: 'zd_bot' } },
        });
        await esperar();

        const lineas = conTexto(corrida, 'Para activarla, pedísela a quien te dio acceso.');
        assert.equal(lineas.length, 1);
        const tarjeta = nodos(corrida).find((n) => (n.className ?? "").includes('zd-auto-card--disponible'));
        assert.ok(tarjeta !== undefined && tarjeta.children.includes(lineas[0]), 'the line sits inside the available card');
        assert.ok(!nodos(corrida).some((n) => tarjeta.children.includes(n) && n.tagName === 'button'), 'no activation button');

        assert.equal(conTexto(corrida, '11/11, 12:00').length, 1, 'Próxima revisión');
        assert.equal(conTexto(corrida, 'Se completó — 05/11, 08:00').length, 1, 'Última revisión');
        assert.ok(!/\b(lun|mar|mié|jue|vie|sáb|dom)\b/i.test(nodos(corrida).map((n) => n.textContent).join(' ')), 'no weekday in the dates');
      });

      test('P-08: formatear keeps the zone, zero-pads and never reads 24:00 at midnight', async () => {
        const { script } = await shellConScript();
        const formatear = new Function(`${funcionDe(script, 'relleno')}\n${funcionDe(script, 'formatear')}\nreturn formatear;`)() as (iso: string, zona: string) => string;
        assert.equal(formatear('2026-11-11T12:00:00.000Z', 'America/Argentina/Buenos_Aires'), '11/11, 09:00');
        assert.equal(formatear('2026-11-11T03:00:00.000Z', 'America/Argentina/Buenos_Aires'), '11/11, 00:00');
        assert.equal(formatear('2026-03-04T08:05:00.000Z', 'UTC'), '04/03, 08:05');
      });

      test('P-06: umbralValido accepts a whole number of 0 or more and an untouched stored value', async () => {
        const { script } = await shellConScript();
        const umbralValido = new Function(`${funcionDe(script, 'umbralValido')}\nreturn umbralValido;`)() as (texto: string, guardado: number) => boolean;
        for (const bueno of ['0', '5', '20', ' 7 ', '5.0', '1000']) assert.equal(umbralValido(bueno, 5), true, bueno);
        for (const malo of ['', '  ', '2.5', '-3', '-1', 'abc', '1,5', 'Infinity', 'NaN']) assert.equal(umbralValido(malo, 5), false, malo);
        // A stored value from before the rule is not judged while the person leaves it as it is.
        assert.equal(umbralValido('2.5', 2.5), true);
        assert.equal(umbralValido('3.5', 2.5), false);
      });

      describe('P-06: the form refuses a minimum that is not a whole number before sending anything', () => {
        const BASE = { umbral: 5, destinatarios: ['a@b.com'], zonaHoraria: 'UTC', canal: 'correo', canales: ['correo'] };

        async function enviarUmbral(valor: string, respuestaPut: { status: number; cuerpo?: unknown } | null = { status: 200, cuerpo: {} }) {
          const { script } = await shellConScript();
          const corrida = correrScript(script, {
            'GET /api/panel/automatizaciones': { status: 200, cuerpo: { activas: [ITEM], disponibles: [], zonaHoraria: 'UTC', truncado: false } },
            'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'sin-vincular', bot: 'zd_bot' } },
            [`GET ${AJUSTES}`]: { status: 200, cuerpo: BASE },
            [`PUT ${AJUSTES}`]: respuestaPut,
          });
          await esperar();
          conTexto(corrida, 'Ajustar')[0].oyentes.forEach((oyente: () => void) => oyente());
          await esperar();
          const entrada = nodos(corrida).find((n) => typeof n.id === 'string' && n.id.endsWith('-umbral'));
          assert.ok(entrada !== undefined, 'the form has the minimum field');
          assert.equal(entrada.min, '0');
          assert.equal(entrada.step, '1');
          entrada.value = valor;
          const forma = nodos(corrida).find((n) => n.tagName === 'form');
          forma.oyentes[0]({ preventDefault() {} });
          await esperar();
          return { corrida, entrada };
        }

        test('2.5, -3, empty and non-numeric text show the message on the field and send nothing', async () => {
          for (const malo of ['2.5', '-3', '', 'abc']) {
            const { corrida, entrada } = await enviarUmbral(malo);
            assert.equal(conTexto(corrida, ESCRIBI_NUMERO).length, 1, malo);
            assert.equal(entrada.atributos['aria-invalid'], 'true', malo);
            assert.ok(!corrida.pedidos.includes(`PUT ${AJUSTES}`), `nothing is sent for «${malo}»`);
          }
        });

        test('0 and a larger whole number are sent as numbers', async () => {
          for (const bueno of ['0', '12']) {
            const { corrida } = await enviarUmbral(bueno);
            assert.equal(conTexto(corrida, ESCRIBI_NUMERO).length, 0, bueno);
            assert.ok(corrida.pedidos.includes(`PUT ${AJUSTES}`), `«${bueno}» is sent`);
          }
        });

        test('a server 400 naming the minimum shows the same message', async () => {
          const { corrida } = await enviarUmbral('7', { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['umbral'] } });
          assert.equal(conTexto(corrida, ESCRIBI_NUMERO).length, 1);
        });
      });
    });

    test('CH-43 P-07: the «Avisos por Telegram» card sits above the list, with its fixed blocks and copy', async (t) => {
      const { html, script } = await shellConScript();

      assert.match(html, /<section id="tarjeta-telegram" class="zd-card panel-telegram" [^>]*data-change="CH-43" data-estado="existe"/);
      assert.ok(html.indexOf('id="tarjeta-telegram"') < html.indexOf('data-screen-label="Mis automatizaciones"'), 'the card goes above the list');
      for (const id of ['telegram-carga', 'telegram-error', 'telegram-no-disponible', 'telegram-sin-vincular', 'telegram-codigo', 'telegram-vinculado', 'telegram-confirmar', 'telegram-aviso', 'telegram-reintentar', 'telegram-abrir']) {
        assert.match(html, new RegExp(`id="${id}"`), id);
      }
      assert.match(html, /id="telegram-error"[^>]*role="alert"/);
      assert.match(html, /<a id="telegram-abrir"[^>]*target="_blank" rel="noopener"/);
      for (const texto of [
        'Avisos por Telegram', 'Por ahora no podés recibir avisos por Telegram.', 'Vincular Telegram', 'Abrir Telegram',
        'Vence a las', 'Generar otro código', 'Telegram vinculado', 'Vincular otro chat', 'Desvincular', 'Desvincular Telegram',
        'Cancelar', 'Reintentar', 'No pudimos cargar tus avisos por Telegram', 'No pudimos generar el código', 'No pudimos desvincular Telegram',
      ]) {
        assert.ok((html + script).includes(texto), `falta el texto: ${texto}`);
      }
      // The card's own glossary on top of the screen guard: no chat id, token or bot API in what P2 reads.
      const tarjeta = /<section id="tarjeta-telegram"[\s\S]*?<\/section>/.exec(html)![0].replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ');
      const literales = (script.match(/'[^']*'/g) ?? []).join(' ');
      for (const texto of [tarjeta, literales]) {
        assert.ok(!/chat_id|chat id|token|bot api|tenant/i.test(texto), `término técnico: ${/chat_id|chat id|token|bot api|tenant/i.exec(texto)?.[0]}`);
      }
    });

    test('CH-43 P-07: a failing card shows its own error with «Reintentar» and the list still loads', async (t) => {
      const { script } = await shellConScript();
      const corrida = correrScript(script, { 'GET /api/panel/automatizaciones': LISTA, 'GET /api/panel/telegram': null });
      await esperar();

      assert.equal(corrida.el('telegram-error').hidden, false);
      assert.equal(corrida.el('telegram-carga').hidden, true);
      assert.equal(corrida.el('estado-error').hidden, true, 'the list error stays hidden');
      assert.equal(corrida.el('estado-vacio').hidden, false, 'the list painted its own state');
      corrida.clic('telegram-reintentar');
      assert.equal(corrida.pedidos.filter((p) => p === 'GET /api/panel/telegram').length, 2);
    });

    test('CH-43 P-07: creating a code shows it through textContent, a 409 repaints as unavailable, and unlinking asks first', async (t) => {
      const { script } = await shellConScript();
      const codigo = { status: 201, cuerpo: { codigo: '<b>7KQ2M9', enlace: 'https://t.me/zd_bot?start=x', venceEn: '2026-11-05T13:10:00.000Z' } };
      const corrida = correrScript(script, {
        'GET /api/panel/automatizaciones': LISTA,
        'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'sin-vincular', bot: 'zd_bot' } },
        'POST /api/panel/telegram/codigo': codigo,
      });
      await esperar();
      assert.equal(corrida.el('telegram-sin-vincular').hidden, false);

      corrida.clic('telegram-vincular');
      await esperar();
      assert.equal(corrida.el('telegram-codigo').hidden, false);
      assert.equal(corrida.el('telegram-codigo-valor').textContent, '<b>7 KQ2M9', 'the code enters as text, split in two');
      assert.equal(corrida.el('telegram-abrir').href, 'https://t.me/zd_bot?start=x');
      assert.equal(corrida.el('telegram-vence').textContent, '13:10', 'the expiry in the zone the list brought');

      // A link that does not point to Telegram is never set, and the button hides.
      codigo.cuerpo.enlace = 'javascript:alert(1)';
      corrida.clic('telegram-otro-codigo');
      await esperar();
      assert.equal(corrida.el('telegram-abrir').hidden, true);
      assert.equal(corrida.el('telegram-abrir').href, 'https://t.me/zd_bot?start=x');

      // The bot went away between the read and the press.
      Object.assign(codigo, { status: 409, cuerpo: { error: 'telegram-no-disponible' } });
      corrida.clic('telegram-otro-codigo');
      await esperar();
      assert.equal(corrida.el('telegram-no-disponible').hidden, false);
      assert.equal(corrida.el('telegram-codigo').hidden, true);

      const vinculado = correrScript(script, {
        'GET /api/panel/automatizaciones': LISTA,
        'GET /api/panel/telegram': { status: 200, cuerpo: { estado: 'vinculado', bot: 'zd_bot', vinculadoEn: '2026-11-05T12:00:00.000Z' } },
        'DELETE /api/panel/telegram/vinculo': { status: 204 },
      });
      await esperar();
      assert.equal(vinculado.el('telegram-vinculado-en').textContent, '05/11/2026');
      vinculado.clic('telegram-desvincular');
      await esperar();
      assert.equal(vinculado.el('telegram-confirmar').hidden, false);
      assert.ok(!vinculado.pedidos.includes('DELETE /api/panel/telegram/vinculo'), 'pressing «Desvincular» alone deletes nothing');
      vinculado.clic('telegram-confirmar-desvincular');
      await esperar();
      assert.ok(vinculado.pedidos.includes('DELETE /api/panel/telegram/vinculo'));
      assert.equal(vinculado.el('telegram-sin-vincular').hidden, false);
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