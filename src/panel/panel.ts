import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { levantarSesionPanel } from './panel-auth.js';
import { ESTILOS_TABLERO, MARCADO_NAV, MARCADO_TABLERO, SCRIPT_TABLERO } from './panel-tablero-pagina.js';

/**
 * The servable client panel: one page, two renders (CH-22a PR3, DEC-04, DEC-136).
 *
 * `GET /panel` runs through the same session hook the API routes use, in its
 * *optional* mode: the page must load whether or not a session exists. With a
 * session it renders the panel shell naming the session's tenant; without one it
 * renders the P-01 login screen, whose form submits to `POST /api/panel/auth/ingresar`
 * (built in PR2). Both renders share the head below: the CH-21a stylesheet
 * (`/ui/styles.css`) and page-local layout rules that use tokens only — nothing
 * console-specific lives in `public/ui/`, per the DEC-124 contract.
 *
 * The page is plain HTML + CSS + JS served as a string, like `src/consola/consola.ts`: no
 * static-file plugin, no build, no framework. Two properties of this module are
 * load-bearing and worth stating:
 *
 *  - **The tenant enters only from the session row (rule 2, DEC-135).** The header
 *    hooks exempt `GET /panel` by exact row (see `src/aislamiento/contexto-tenant.ts`) because
 *    the panel client never sends `X-Tenant-Id`; the handler resolves the tenant via
 *    `levantarSesionPanel(prisma, { opcional: true })`, which attaches
 *    `request.sesionPanel` (with `tenantNombre`) or serves the login screen. The page
 *    cannot leak a foreign tenant because it never asks for one.
 *  - **Stored values are escaped, never interpolated raw.** The tenant name is a
 *    stored, replayed string (operator-created), so the shell interpolates it through
 *    `escaparHtml` — the same discipline `consola.ts` applies with `textContent`. The
 *    login screen carries no dynamic data at all.
 *
 * The inline scripts use string concatenation rather than JS template literals so
 * the documents can live inside this TypeScript template literal without escaping.
 * The `Secure` cookie attribute (DEC-134) stays on: over plain `http://localhost` a
 * browser will not store the cookie, a known limitation checked in the human visual
 * review (task 3.4), not silently weakened here.
 */

/** Escapes the five characters that would read as markup in an HTML text node. */
const RE_HTML = /[&<>"']/g;
const MAPA_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

function escaparHtml(texto: string): string {
  return texto.replace(RE_HTML, (caracter) => MAPA_ESCAPES[caracter]);
}

/**
 * The shared head and layout rules. `[hidden]` is the toggle the login script relies
 * on (the shared sheet does not force `display:none` for it). The layout follows the
 * panel mockup's shapes with tokens only: the login card is one centered column on a
 * full viewport; the shell is a sticky 60 px header plus one `--panel-max` column.
 */
const CABEZA_PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroDashboard — Panel</title>
<!-- UX review C-19: an empty icon, so the browser does not ask the server for /favicon.ico on every load. -->
<link rel="icon" href="data:,">
<!-- CH-21a (DEC-124): the shared stylesheet, served by the exact exempt GET routes. -->
<link rel="stylesheet" href="/ui/styles.css">
<style>
  [hidden] { display: none !important; }
  .panel-marca { font-weight: var(--weight-bold); letter-spacing: -.02em; }
  /* P-01 login: one centered card column, padded for the smallest screen. */
  .panel-ingreso { min-height: 100vh; display: grid; place-items: center; padding: var(--space-6); }
  .panel-ingreso__caja { width: min(420px, 100%); display: grid; gap: var(--space-8); }
  .panel-ingreso__marca { display: grid; gap: var(--space-3); text-align: center; }
  .panel-ingreso__marca .panel-marca { font-size: var(--text-2xl); }
  .panel-ingreso__caja .zd-meta { text-align: center; margin: 0; }
  /* Panel shell: sticky 60 px header (DEC panel layout) + one centered column. */
  .panel-header { position: sticky; top: 0; z-index: 20; background: var(--surface-card);
    border-bottom: var(--border-width) solid var(--border-1); }
  .panel-header__in { max-width: var(--panel-max); margin: 0 auto; padding: 0 var(--space-6);
    min-height: 60px; display: flex; align-items: center; gap: var(--space-5); }
  .panel-header .panel-marca { font-size: var(--text-lg); }
  .panel-header__sep { flex: none; width: 1px; height: 20px; background: var(--border-2); }
  .panel-negocio { display: inline-flex; align-items: center; gap: var(--space-3);
    font-weight: var(--weight-semibold); color: var(--text-2); font-size: var(--text-sm); min-width: 0; }
  .panel-flexor { flex: 1; }
  .panel-main { max-width: var(--panel-max); margin: 0 auto; padding: var(--space-9) var(--space-6) var(--space-12);
    display: grid; gap: var(--gap-section); }
  .panel-main .zd-muted { margin: var(--space-3) 0 0; }
  /* P-02 Mis automatizaciones (CH-22b): one column of cards, tokens only, 360 px first. */
  .panel-lista, .panel-seccion { display: grid; gap: var(--space-5); }
  .panel-main .zd-auto-card__title { overflow-wrap: anywhere; }
  .panel-main .zd-card__head > div { min-width: 0; }
  .panel-esqueleto { display: grid; gap: var(--space-4); }
  .panel-esqueleto__titulo { height: 18px; width: 45%; }
  .panel-esqueleto__linea { width: 85%; }
  .panel-esqueleto__corta { width: 60%; }
  /* P-04 Ajustar (CH-23): the inline form, its notices and the action row inside a card. */
  .panel-acciones { display: flex; gap: var(--space-4); flex-wrap: wrap; margin-top: var(--space-5); }
  .panel-aviso { margin-top: var(--space-5); }
  .panel-ajuste { margin-top: var(--space-5); padding-top: var(--space-5);
    border-top: var(--border-width) solid var(--border-1); }
  /* P-07 Avisos por Telegram (CH-43): one card, one block visible at a time. */
  .panel-telegram { display: grid; gap: var(--space-4); }
  .panel-telegram .zd-muted, .panel-telegram .zd-meta, .panel-telegram .panel-acciones { margin: 0; }
  .panel-telegram__codigo { margin: var(--space-3) 0; font-size: var(--text-2xl); letter-spacing: .08em; }
  /* P-01 (UX review): the shared link rule (.zd-root a, specificity 0,1,1) beats .zd-btn--primary (0,1,0),
     so a primary button drawn as a link kept the link color on the accent fill. */
  .zd-root a.zd-btn--primary, .zd-root a.zd-btn--primary:hover { color: var(--text-on-accent); text-decoration: none; }
${ESTILOS_TABLERO}</style>
</head>
<body class="zd-root" data-surface="panel">
`;

const PIE_PAGINA = `</body>
</html>
`;

/**
 * P-01 (CH-22): the login screen. The form declares its submit destination in HTML
 * (`action`/`method`) and the script below intercepts it: the POST goes to the PR2
 * endpoint as JSON, the button turns into its loading state while it flies, and a
 * non-2xx shows the credential banner in the panel's own wording (P-01: "El correo o
 * la contraseña no coinciden"). A `2xx` reloads — the server now sees the cookie and
 * serves the shell. No tenant is ever named or chosen here (rule 2; DEC-135).
 *
 * The "Olvidé mi contraseña" link of the mockup is deliberately absent: recovery is
 * out of scope (R2, DEC-156: only the operator resets a password), and a dead link in
 * production is worse than none. A plain help line under the button tells the person
 * who to ask instead (UX review P-02); it adds no flow.
 */
const DOCUMENTO_INGRESO = CABEZA_PAGINA + `<!-- P-01 Ingreso (CH-22): unauthenticated /panel. -->
<section class="panel-ingreso" data-screen-label="Ingreso" data-change="CH-22" data-estado="parcial">
  <div class="panel-ingreso__caja">
    <div class="panel-ingreso__marca">
      <span class="panel-marca">ZeroDashboard</span>
      <p class="zd-muted">Tus avisos y reportes automáticos, en un solo lugar.</p>
    </div>
    <form id="form-ingreso" class="zd-card zd-form" action="/api/panel/auth/ingresar" method="post" novalidate>
      <h1 class="zd-h2">Ingresar</h1>
      <div class="zd-field">
        <label class="zd-label" for="correo">Correo</label>
        <input class="zd-input" id="correo" name="correo" type="email" autocomplete="email" required>
      </div>
      <div class="zd-field">
        <label class="zd-label" for="clave">Contraseña</label>
        <input class="zd-input" id="clave" name="clave" type="password" autocomplete="current-password" required>
      </div>
      <div id="aviso-ingreso" class="zd-banner zd-banner--error" role="alert" hidden>
        <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>
        <div>
          <p class="zd-banner__title">No pudimos ingresarte</p>
          <p class="zd-banner__body" id="texto-aviso">El correo o la contraseña no coinciden.</p>
        </div>
      </div>
      <button id="boton-ingresar" class="zd-btn zd-btn--primary zd-btn--block" type="submit">
        <svg id="icono-cargando" class="zd-icon zd-icon--spin" aria-hidden="true" viewBox="0 0 24 24" hidden><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
        <span id="etiqueta-ingresar">Ingresar</span>
      </button>
      <p id="ayuda-clave" class="zd-help">¿No tenés o perdiste tu contraseña? Pedísela a quien te dio acceso.</p>
    </form>
    <p class="zd-meta">Con tu correo entrás a tu negocio.</p>
  </div>
</section>
<script>
var formulario = document.getElementById('form-ingreso');
var aviso = document.getElementById('aviso-ingreso');
var textoAviso = document.getElementById('texto-aviso');
var boton = document.getElementById('boton-ingresar');
var etiqueta = document.getElementById('etiqueta-ingresar');
var iconoCargando = document.getElementById('icono-cargando');
var MENSAJE_CREDENCIALES = 'El correo o la contraseña no coinciden.';
var MENSAJE_TENANT_INACTIVO = 'Tu negocio no está activo en este momento. Comunicate con quien te dio acceso.';
var MENSAJE_RED = 'No pudimos conectar con el servidor. Volvé a intentar en unos minutos.';
var MENSAJE_CAMPOS = 'Escribí tu correo y tu contraseña.';
function fallar(texto) {
  textoAviso.textContent = texto;
  aviso.hidden = false;
  boton.disabled = false;
  etiqueta.textContent = 'Ingresar';
  iconoCargando.hidden = true;
}
formulario.addEventListener('submit', function (evento) {
  evento.preventDefault();
  aviso.hidden = true;
  boton.disabled = true;
  etiqueta.textContent = 'Ingresando\u2026';
  iconoCargando.hidden = false;
  fetch(formulario.action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: formulario.elements.correo.value, clave: formulario.elements.clave.value })
  }).then(function (respuesta) {
    if (respuesta.ok) {
      window.location.reload();
      return null;
    }
    // A 400 means the server answered and refused an empty or malformed form: that is not a connection problem.
    if (respuesta.status === 400) {
      fallar(MENSAJE_CAMPOS);
      return null;
    }
    return respuesta.json();
  }).then(function (cuerpo) {
    if (cuerpo === null) { return; }
    if (cuerpo.error === 'tenant-desactivado') { fallar(MENSAJE_TENANT_INACTIVO); return; }
    if (cuerpo.error === 'correo-o-clave-incorrectos') { fallar(MENSAJE_CREDENCIALES); return; }
    fallar(MENSAJE_RED);
  }).catch(function () {
    fallar(MENSAJE_RED);
  });
});
</script>
` + PIE_PAGINA;

/**
 * The authenticated shell (CH-22, "parcial": the header, plus the P-02 list of CH-22b and
 * the P-04 inline "Ajustar" form of CH-23, then the P-07 Telegram card of CH-43, all inside
 * «Avisos»; and the P-08 dashboard of CH-48 with its nav, shown only when the tenant has
 * reports). The header names the session's tenant — the one store
 * this administrator sees — and its Salir button revokes the session through the PR2
 * endpoint and reloads, so the server renders the login screen again. `nombreTenant`
 * is escaped before interpolation: it is stored data, so it is never trusted as
 * markup.
 */
function documentoShell(nombreTenant: string): string {
  return CABEZA_PAGINA + `<!-- Panel shell (CH-22, parcial): authenticated /panel. -->
<header class="panel-header">
  <div class="panel-header__in">
    <span class="panel-marca">ZeroDashboard</span>
    <span class="panel-header__sep" aria-hidden="true"></span>
    <span class="panel-negocio">
      <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path><path d="M2 7h20"></path><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"></path></svg>
      ${escaparHtml(nombreTenant)}
    </span>
    <span class="panel-flexor"></span>
    <button id="boton-salir" class="zd-btn zd-btn--ghost" type="button">
      <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>
      Salir
    </button>
  </div>
</header>
${MARCADO_NAV}<main class="panel-main">
${MARCADO_TABLERO}  <!-- «Avisos» (CH-48): the automations list and, after it, the Telegram card. Visible on its own when there is no dashboard. -->
  <div id="seccion-avisos" class="panel-avisos">
  <section data-screen-label="Mis automatizaciones" data-change="CH-22" data-estado="parcial">
    <h1 class="zd-h1">Mis automatizaciones</h1>
    <p class="zd-muted">Lo que revisamos por vos y te avisamos.</p>
  </section>
  <!-- P-02 states: loading skeleton, error, empty, active cards, available section. -->
  <div id="estado-carga" class="panel-lista" aria-busy="true" aria-label="Cargando tus automatizaciones">
    <div class="zd-card panel-esqueleto"><span class="zd-skeleton panel-esqueleto__titulo"></span><span class="zd-skeleton panel-esqueleto__linea"></span><span class="zd-skeleton panel-esqueleto__corta"></span></div>
    <div class="zd-card panel-esqueleto"><span class="zd-skeleton panel-esqueleto__titulo"></span><span class="zd-skeleton panel-esqueleto__linea"></span><span class="zd-skeleton panel-esqueleto__corta"></span></div>
  </div>
  <div id="estado-error" class="zd-card zd-state zd-state--error" role="alert" hidden>
    <span class="zd-state__icon"><svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg></span>
    <p class="zd-state__title">No pudimos cargar tus automatizaciones</p>
    <p class="zd-state__body" id="texto-error">Volvé a intentar en unos minutos.</p>
  </div>
  <div id="estado-vacio" class="zd-card zd-state" hidden>
    <span class="zd-state__icon"><svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg></span>
    <p class="zd-state__title">Todavía no activaste ninguna automatización</p>
    <p class="zd-state__body">Cuando haya una activa, la vas a ver acá con su última revisión y la próxima.</p>
  </div>
  <div id="lista-activas" class="panel-lista" hidden></div>
  <section id="seccion-disponibles" class="panel-seccion" hidden>
    <h2 class="zd-h2">Otras automatizaciones disponibles</h2>
    <div id="lista-disponibles" class="panel-lista"></div>
  </section>
  <p id="nota-truncado" class="zd-meta" hidden>Mostramos solo una parte de tus automatizaciones.</p>
  <!-- P-07 Avisos por Telegram (CH-43; below the list since CH-48, UX review P-07): fixed blocks toggled with hidden; values enter through textContent. -->
  <section id="tarjeta-telegram" class="zd-card panel-telegram" data-screen-label="Avisos por Telegram" data-change="CH-43" data-estado="existe" aria-labelledby="titulo-telegram">
    <h2 id="titulo-telegram" class="zd-h2">Avisos por Telegram</h2>
    <div id="telegram-carga" class="panel-esqueleto" aria-busy="true" aria-label="Cargando tus avisos por Telegram"><span class="zd-skeleton panel-esqueleto__linea"></span><span class="zd-skeleton panel-esqueleto__corta"></span></div>
    <div id="telegram-error" class="zd-state zd-state--error" role="alert" hidden>
      <span class="zd-state__icon"><svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg></span>
      <p class="zd-state__title">No pudimos cargar tus avisos por Telegram</p>
      <p class="zd-state__body" id="telegram-texto-error">Volvé a intentar en unos minutos.</p>
      <div class="zd-state__actions"><button id="telegram-reintentar" class="zd-btn zd-btn--secondary" type="button">Reintentar</button></div>
    </div>
    <p id="telegram-no-disponible" class="zd-muted" hidden>Por ahora no podés recibir avisos por Telegram.</p>
    <div id="telegram-sin-vincular" class="panel-telegram" hidden>
      <p class="zd-muted">Vinculá un chat de Telegram para recibir ahí los avisos de tu negocio.</p>
      <div class="panel-acciones"><button id="telegram-vincular" class="zd-btn zd-btn--primary" type="button">Vincular Telegram</button></div>
    </div>
    <div id="telegram-vinculado" class="panel-telegram" hidden>
      <p class="zd-muted"><span class="zd-badge zd-badge--ok"><svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>Telegram vinculado</span> desde el <span id="telegram-vinculado-en"></span>.</p>
      <div class="panel-acciones">
        <button id="telegram-otro-chat" class="zd-btn zd-btn--secondary" type="button">Vincular otro chat</button>
        <button id="telegram-desvincular" class="zd-btn zd-btn--ghost" type="button" aria-expanded="false" aria-controls="telegram-confirmar">Desvincular</button>
      </div>
      <div id="telegram-confirmar" class="zd-banner zd-banner--warn" role="alert" hidden>
        <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
        <div>
          <p class="zd-banner__title">¿Desvinculamos Telegram?</p>
          <p class="zd-banner__body">Los avisos dejan de llegar a ese chat. Podés volver a vincularlo cuando quieras.</p>
          <div class="zd-banner__actions">
            <button id="telegram-confirmar-desvincular" class="zd-btn zd-btn--danger" type="button">Desvincular Telegram</button>
            <button id="telegram-cancelar" class="zd-btn zd-btn--secondary" type="button">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
    <div id="telegram-codigo" class="panel-telegram" hidden>
      <div id="telegram-codigo-nuevo" hidden>
        <p class="zd-muted">Tocá «Abrir Telegram» y después «Iniciar». También podés mandarle este código a <span id="telegram-bot">nuestro bot</span>:</p>
        <p id="telegram-codigo-valor" class="zd-mono panel-telegram__codigo"></p>
        <a id="telegram-abrir" class="zd-btn zd-btn--primary" target="_blank" rel="noopener">Abrir Telegram</a>
      </div>
      <p id="telegram-codigo-previo" class="zd-muted" hidden>Ya generaste un código. Si no lo tenés a mano, generá otro.</p>
      <p class="zd-meta">Vence a las <span id="telegram-vence"></span>.</p>
      <div class="panel-acciones"><button id="telegram-otro-codigo" class="zd-btn zd-btn--secondary" type="button">Generar otro código</button></div>
    </div>
    <div id="telegram-aviso" class="zd-banner zd-banner--error" role="alert" hidden>
      <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
      <div>
        <p class="zd-banner__title" id="telegram-aviso-titulo"></p>
        <p class="zd-banner__body" id="telegram-aviso-texto"></p>
      </div>
    </div>
  </section>
  </div>
</main>
<script>
document.getElementById('boton-salir').addEventListener('click', function () {
  fetch('/api/panel/auth/salir', { method: 'POST' }).finally(function () {
    window.location.reload();
  });
});
</script>
<!-- P-08 Tablero (CH-48): the vendored Chart.js (DEC-184, DEC-200) first, then the dashboard script, both before the automations script, which stays the last one on the page. -->
<script src="/ui/vendor/chart.umd.js"></script>
<script>
${SCRIPT_TABLERO}</script>
<script>
var MENSAJE_TENANT_INACTIVO = 'Tu negocio no está activo en este momento. Comunicate con quien te dio acceso.';
var MENSAJE_ERROR = 'Volvé a intentar en unos minutos.';
function nodo(etiqueta, clase, texto) {
  var n = document.createElement(etiqueta);
  if (clase) { n.className = clase; }
  if (texto !== undefined) { n.textContent = texto; }
  return n;
}
function mostrar(id, visible) {
  document.getElementById(id).hidden = !visible;
}
// The third argument narrows what is shown (CH-43: only the time, or only the date); the default is the P-02 one,
// «dd/mm, HH:mm» (lenguaje.md), assembled from the parts so the padding and separators do not depend on locale data.
function relleno(valor) {
  return ('0' + valor).slice(-2);
}
function formatear(iso, zona, campos) {
  var opciones = Object.assign({}, campos || { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  var formato;
  try {
    opciones.timeZone = zona;
    formato = new Intl.DateTimeFormat('es-AR', opciones);
  } catch (e) {
    delete opciones.timeZone;
    formato = new Intl.DateTimeFormat('es-AR', opciones);
  }
  if (campos) { return formato.format(new Date(iso)); }
  var partes = {};
  formato.formatToParts(new Date(iso)).forEach(function (parte) { partes[parte.type] = parte.value; });
  return relleno(partes.day) + '/' + relleno(partes.month) + ', ' + relleno(partes.hour) + ':' + relleno(partes.minute);
}
function dato(lista, etiqueta, valor) {
  var fila = nodo('div');
  fila.appendChild(nodo('dt', '', etiqueta));
  fila.appendChild(nodo('dd', '', valor));
  lista.appendChild(fila);
}
function cabeza(titulo, descripcion, insignia) {
  var cab = nodo('div', 'zd-card__head');
  var texto = nodo('div');
  texto.appendChild(nodo('h3', 'zd-auto-card__title', titulo));
  texto.appendChild(nodo('p', 'zd-auto-card__desc', descripcion));
  cab.appendChild(texto);
  if (insignia) { cab.appendChild(insignia); }
  return cab;
}
// ---- P-04 Ajustar (CH-23): the inline form of one automation ----------------------------
var NS_SVG = 'http://www.w3.org/2000/svg';
var avisoGuardado = null;
var contadorFormularios = 0;
var MENSAJE_AJUSTE_NO_DISPONIBLE = 'Esta automatización ya no se puede ajustar.';
var MENSAJE_REVISAR = 'Revisá los datos e intentá de nuevo.';
var MENSAJE_SIN_CAMBIOS = 'No cambiaste ningún dato.';
var ERRORES_CAMPO = {
  umbral: 'Escribí un número entero, 0 o más.',
  hora: 'Elegí una hora válida.',
  dias: 'Elegí los días de envío.',
  canal: 'Elegí por dónde querés recibir este aviso.',
  destinatarios: 'Revisá los correos: escribí entre 1 y 5, separados por comas.'
};
var OPCIONES_DIAS = [['todos', 'Todos los días'], ['lun-vie', 'De lunes a viernes'], ['lun-sab', 'De lunes a sábado']];
var ICONO_OK = [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'm9 12 2 2 4-4' }]];
var ICONO_ALERTA = [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]];
function icono(formas) {
  var svg = document.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('class', 'zd-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  for (var i = 0; i < formas.length; i++) {
    var forma = document.createElementNS(NS_SVG, formas[i][0]);
    for (var clave in formas[i][1]) {
      if (Object.prototype.hasOwnProperty.call(formas[i][1], clave)) { forma.setAttribute(clave, formas[i][1][clave]); }
    }
    svg.appendChild(forma);
  }
  return svg;
}
function aviso(tono, titulo, cuerpo, rol) {
  var banner = nodo('div', 'zd-banner zd-banner--' + tono + ' panel-aviso');
  banner.setAttribute('role', rol);
  banner.appendChild(icono(tono === 'ok' ? ICONO_OK : ICONO_ALERTA));
  var texto = nodo('div');
  texto.appendChild(nodo('p', 'zd-banner__title', titulo));
  if (cuerpo) { texto.appendChild(nodo('p', 'zd-banner__body', cuerpo)); }
  banner.appendChild(texto);
  return banner;
}
function quitarAviso(contenedor) {
  for (var i = contenedor.children.length - 1; i >= 0; i--) {
    if (contenedor.children[i].classList.contains('panel-aviso')) { contenedor.removeChild(contenedor.children[i]); }
  }
}
function rutaAjustes(id) {
  return '/api/panel/automatizaciones/' + encodeURIComponent(id) + '/ajustes';
}
function campoDeFormulario(prefijo, nombre, etiqueta, control, ayuda, sufijo) {
  var id = prefijo + '-' + nombre;
  control.id = id;
  var caja = nodo('div', 'zd-field');
  var rotulo = nodo('label', 'zd-label', etiqueta);
  rotulo.setAttribute('for', id);
  caja.appendChild(rotulo);
  if (sufijo) {
    var grupo = nodo('div', 'zd-input-group');
    grupo.appendChild(control);
    grupo.appendChild(nodo('span', 'zd-input-suffix', sufijo));
    caja.appendChild(grupo);
  } else {
    caja.appendChild(control);
  }
  var campo = { caja: caja, control: control, ayudaId: null, error: nodo('span', 'zd-field-error') };
  if (ayuda) {
    campo.ayudaId = id + '-ayuda';
    var textoAyuda = nodo('span', 'zd-help', ayuda);
    textoAyuda.id = campo.ayudaId;
    control.setAttribute('aria-describedby', campo.ayudaId);
    caja.appendChild(textoAyuda);
  }
  campo.error.id = id + '-error';
  campo.error.hidden = true;
  caja.appendChild(campo.error);
  return campo;
}
function marcarCampo(campo, texto) {
  campo.error.textContent = '';
  var ayuda = campo.ayudaId ? campo.ayudaId : '';
  if (texto) {
    campo.error.appendChild(icono(ICONO_ALERTA));
    campo.error.appendChild(document.createTextNode(texto));
    campo.control.setAttribute('aria-invalid', 'true');
    campo.control.setAttribute('aria-describedby', (ayuda + ' ' + campo.error.id).trim());
  } else {
    campo.control.removeAttribute('aria-invalid');
    if (ayuda) { campo.control.setAttribute('aria-describedby', ayuda); } else { campo.control.removeAttribute('aria-describedby'); }
  }
  campo.error.hidden = !texto;
}
// P-06: an unchanged stored value passes; anything typed must be a whole number, 0 or more.
function umbralValido(texto, guardado) {
  var escrito = String(texto).trim();
  if (escrito === '') { return false; }
  var numero = Number(escrito);
  if (numero === guardado) { return true; }
  return Number.isInteger(numero) && numero >= 0;
}
// Only what the person changed is sent: the server rebuilds the schedule and the values.
function cuerpoDeCambios(campos, ajustes) {
  var cuerpo = {};
  if (campos.umbral) {
    var escrito = campos.umbral.control.value.trim();
    var numero = Number(escrito);
    var valor = escrito === '' || isNaN(numero) ? escrito : numero;
    if (valor !== ajustes.umbral) { cuerpo.umbral = valor; }
  }
  if (campos.hora && campos.hora.control.value !== ajustes.hora) { cuerpo.hora = campos.hora.control.value; }
  if (campos.dias && campos.dias.control.value !== ajustes.dias) { cuerpo.dias = campos.dias.control.value; }
  // CH-44 (DEC-197): the channel only when it changed, and on Telegram the stored list stays as it is.
  var canal = campos.canal ? campos.canal.control.value : ajustes.canal;
  if (canal !== ajustes.canal) { cuerpo.canal = canal; }
  if (canal === 'telegram') { return cuerpo; }
  // CH-41 (DEC-187): the whole list is sent, and only when it differs from the stored one (compared as JSON).
  var correos = direccionesDe(campos.destinatarios.control.value);
  if (JSON.stringify(correos) !== JSON.stringify(ajustes.destinatarios)) { cuerpo.destinatarios = correos; }
  return cuerpo;
}
// CH-41 (DEC-194 1(a)): the text of the field as a list: its pieces between commas, semicolons and any whitespace.
// No validation here: the server decides, and the screen names the field.
function direccionesDe(texto) {
  return String(texto).split(/[,;\\s]+/).filter(function (pieza) { return pieza !== ''; });
}
function respuestaDeGuardado(resultado, item, forma, campos) {
  var estado = resultado.estado;
  var datos = resultado.datos;
  if (estado === 200) {
    avisoGuardado = item.id;
    cargarLista();
    return;
  }
  if (estado === 401) {
    window.location.reload();
    return;
  }
  var texto = MENSAJE_ERROR;
  if (estado === 400) {
    var lista = Array.isArray(datos.campos) ? datos.campos : [];
    var primero = null;
    for (var i = 0; i < lista.length; i++) {
      if (Object.prototype.hasOwnProperty.call(campos, lista[i])) {
        marcarCampo(campos[lista[i]], ERRORES_CAMPO[lista[i]]);
        if (primero === null) { primero = campos[lista[i]]; }
      }
    }
    if (primero !== null) {
      primero.control.focus();
      return;
    }
    texto = MENSAJE_REVISAR;
  } else if (estado === 404 || (estado === 409 && (datos.error === 'automatizacion-pausada' || datos.error === 'horario-no-editable'))) {
    texto = MENSAJE_AJUSTE_NO_DISPONIBLE;
  } else if (estado === 409) {
    texto = MENSAJE_TENANT_INACTIVO;
  }
  forma.insertBefore(aviso('error', texto, '', 'alert'), forma.firstChild);
}
function formularioDeAjustes(item, ajustes, tarjeta, boton) {
  contadorFormularios += 1;
  var prefijo = 'ajuste-' + contadorFormularios;
  var forma = nodo('form', 'zd-form panel-ajuste');
  forma.noValidate = true;
  forma.setAttribute('aria-label', 'Ajustar ' + item.titulo);
  var campos = {};
  if (typeof ajustes.umbral === 'number') {
    var numero = nodo('input', 'zd-input');
    numero.type = 'number';
    numero.step = '1';
    numero.min = '0';
    numero.value = String(ajustes.umbral);
    campos.umbral = campoDeFormulario(prefijo, 'umbral', 'Cantidad mínima', numero, 'Te avisamos cuando un producto llegue a esta cantidad o menos.', 'unidades');
    forma.appendChild(campos.umbral.caja);
  }
  if (typeof ajustes.hora === 'string' && typeof ajustes.dias === 'string') {
    var fila = nodo('div', 'zd-form-row');
    var hora = nodo('input', 'zd-input');
    hora.type = 'time';
    hora.value = ajustes.hora;
    var dias = nodo('select', 'zd-select');
    for (var i = 0; i < OPCIONES_DIAS.length; i++) {
      var opcion = nodo('option', '', OPCIONES_DIAS[i][1]);
      opcion.value = OPCIONES_DIAS[i][0];
      dias.appendChild(opcion);
    }
    dias.value = ajustes.dias;
    campos.hora = campoDeFormulario(prefijo, 'hora', 'Hora de envío', hora, null, null);
    campos.dias = campoDeFormulario(prefijo, 'dias', 'Días', dias, null, null);
    fila.appendChild(campos.hora.caja);
    fila.appendChild(campos.dias.caja);
    forma.appendChild(fila);
  }
  var correo = nodo('input', 'zd-input');
  // A text input, not an email one: that kind can refuse the separators before the script reads them.
  correo.type = 'text';
  correo.setAttribute('inputmode', 'email');
  correo.value = ajustes.destinatarios.join(', ');
  correo.setAttribute('autocomplete', 'off');
  campos.destinatarios = campoDeFormulario(prefijo, 'destinatarios', 'Enviar a', correo, 'Hasta 5 correos, separados por comas.', null);
  // CH-44 (DEC-197): the choice appears only when there is one. On Telegram, «Enviar a» has no use.
  if (Array.isArray(ajustes.canales) && ajustes.canales.length > 1) {
    var canal = nodo('select', 'zd-select');
    for (var c = 0; c < ajustes.canales.length; c++) {
      var opcionCanal = nodo('option', '', ajustes.canales[c] === 'telegram' ? 'Telegram' : 'Correo');
      opcionCanal.value = ajustes.canales[c];
      canal.appendChild(opcionCanal);
    }
    canal.value = ajustes.canal;
    campos.canal = campoDeFormulario(prefijo, 'canal', 'Enviar por', canal, null, null);
    forma.appendChild(campos.canal.caja);
    campos.destinatarios.caja.hidden = canal.value === 'telegram';
    canal.addEventListener('change', function () {
      campos.destinatarios.caja.hidden = canal.value === 'telegram';
    });
  }
  forma.appendChild(campos.destinatarios.caja);
  var acciones = nodo('div', 'zd-form-actions');
  var guardar = nodo('button', 'zd-btn zd-btn--primary', 'Guardar cambios');
  guardar.type = 'submit';
  var cancelar = nodo('button', 'zd-btn zd-btn--secondary', 'Cancelar');
  cancelar.type = 'button';
  cancelar.addEventListener('click', function () {
    tarjeta.removeChild(forma);
    boton.setAttribute('aria-expanded', 'false');
    boton.focus();
  });
  acciones.appendChild(guardar);
  acciones.appendChild(cancelar);
  forma.appendChild(acciones);
  forma.addEventListener('submit', function (evento) {
    evento.preventDefault();
    quitarAviso(forma);
    for (var nombre in campos) {
      if (Object.prototype.hasOwnProperty.call(campos, nombre)) { marcarCampo(campos[nombre], null); }
    }
    // P-06: the minimum is a count of units, so only a whole number of 0 or more is sent. A stored value the
    // person did not touch is never judged here.
    if (campos.umbral && !umbralValido(campos.umbral.control.value, ajustes.umbral)) {
      marcarCampo(campos.umbral, ERRORES_CAMPO.umbral);
      campos.umbral.control.focus();
      return;
    }
    var cuerpo = cuerpoDeCambios(campos, ajustes);
    if (Object.keys(cuerpo).length === 0) {
      forma.insertBefore(aviso('error', MENSAJE_SIN_CAMBIOS, '', 'alert'), forma.firstChild);
      return;
    }
    guardar.disabled = true;
    guardar.setAttribute('aria-busy', 'true');
    fetch(rutaAjustes(item.id), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (respuesta) {
      return respuesta.json().catch(function () { return {}; }).then(function (datos) {
        return { estado: respuesta.status, datos: datos };
      });
    }).then(function (resultado) {
      respuestaDeGuardado(resultado, item, forma, campos);
    }).catch(function () {
      forma.insertBefore(aviso('error', MENSAJE_ERROR, '', 'alert'), forma.firstChild);
    }).finally(function () {
      guardar.disabled = false;
      guardar.removeAttribute('aria-busy');
    });
  });
  return forma;
}
function alternarAjustes(item, tarjeta, boton) {
  var abierto = tarjeta.querySelector('.panel-ajuste');
  quitarAviso(tarjeta);
  if (abierto) {
    tarjeta.removeChild(abierto);
    boton.setAttribute('aria-expanded', 'false');
    return;
  }
  boton.disabled = true;
  fetch(rutaAjustes(item.id), { credentials: 'same-origin' }).then(function (respuesta) {
    if (respuesta.status === 401) {
      window.location.reload();
      return null;
    }
    if (!respuesta.ok) {
      var motivo = respuesta.status === 404 ? MENSAJE_AJUSTE_NO_DISPONIBLE : MENSAJE_ERROR;
      tarjeta.appendChild(aviso('error', 'No pudimos abrir los ajustes', motivo, 'alert'));
      return null;
    }
    return respuesta.json();
  }).then(function (ajustes) {
    if (ajustes === null) { return; }
    var forma = formularioDeAjustes(item, ajustes, tarjeta, boton);
    tarjeta.appendChild(forma);
    boton.setAttribute('aria-expanded', 'true');
    var primero = forma.querySelector('input, select');
    if (primero) { primero.focus(); }
  }).catch(function () {
    tarjeta.appendChild(aviso('error', 'No pudimos abrir los ajustes', MENSAJE_ERROR, 'alert'));
  }).finally(function () {
    boton.disabled = false;
  });
}
// P-09: «un producto llegue a 5 unidades o menos», the same sentence the help of the «Ajustar» form uses.
function textoDeRegla(umbral) {
  return 'un producto llegue a ' + umbral.toLocaleString('es-AR') + (umbral === 1 ? ' unidad' : ' unidades') + ' o menos';
}
// P-09: the addresses, or «Telegram» (the linked chat itself is never sent to the page); '' when there is nothing to say.
function textoDeDestino(item) {
  if (item.porTelegram === true) { return 'Telegram'; }
  return Array.isArray(item.destinatarios) ? item.destinatarios.join(', ') : '';
}
function tarjetaActiva(item, zona) {
  var esActiva = item.estado === 'activa';
  var esConFalla = item.estado === 'con_falla';
  var esPausada = item.estado === 'pausada';
  var tarjeta = nodo('article', 'zd-card zd-auto-card');
  var badgeTexto;
  var badgeClase;
  if (esActiva) {
    badgeClase = 'zd-badge zd-badge--ok';
    badgeTexto = 'Activa';
  } else if (esConFalla) {
    badgeClase = 'zd-badge';
    badgeTexto = 'Con falla';
  } else {
    badgeClase = 'zd-badge';
    badgeTexto = 'Pausada';
  }
  tarjeta.appendChild(cabeza(item.titulo, item.descripcion, nodo('span', badgeClase, badgeTexto)));
  if (esConFalla) {
    var banner = nodo('div', 'zd-banner zd-banner--error');
    banner.setAttribute('role', 'alert');
    banner.appendChild(nodo('p', 'zd-banner__title', 'No pudimos completar esta automatización esta vez'));
    banner.appendChild(nodo('p', 'zd-banner__body', 'La última revisión falló. La próxima vez que se ejecute, volvemos a intentarlo.'));
    tarjeta.appendChild(banner);
  }
  // CH-44 (DEC-197): the last result can read fine while nobody gets the notice.
  if (item.sinVinculo === true) {
    tarjeta.appendChild(aviso('warn', 'Este aviso no te está llegando', 'Se manda por Telegram y no hay un chat vinculado.', 'status'));
  }
  if (avisoGuardado === item.id) {
    tarjeta.appendChild(aviso('ok', 'Guardamos tus cambios', 'Se aplican desde la próxima revisión.', 'status'));
  }
  var tiempos = nodo('dl', 'zd-auto-card__times');
  var ultima = item.ultimaEjecucion;
  if (ultima === null) {
    dato(tiempos, 'Última revisión', 'Todavía no hubo una revisión');
  } else {
    var resultado = ultima.resultado === 'completada' ? 'Se completó' : 'No se pudo hacer';
    dato(tiempos, 'Última revisión', resultado + ' — ' + formatear(ultima.fecha, zona));
  }
  if (item.proximaEjecucion) { dato(tiempos, 'Próxima revisión', formatear(item.proximaEjecucion, zona)); }
  if (item.frecuencia) { dato(tiempos, 'Frecuencia', item.frecuencia); }
  // P-09: the rule in force and where the notice goes, so the person does not have to open «Ajustar» to know.
  if (typeof item.umbral === 'number') { dato(tiempos, 'Te avisamos cuando', textoDeRegla(item.umbral)); }
  var destino = textoDeDestino(item);
  if (destino !== '') { dato(tiempos, 'Te lo enviamos a', destino); }
  tarjeta.appendChild(tiempos);
  if (esActiva || esConFalla) {
    var acciones = nodo('div', 'panel-acciones');
    var ajustar = nodo('button', 'zd-btn zd-btn--secondary', 'Ajustar');
    ajustar.type = 'button';
    ajustar.setAttribute('aria-expanded', 'false');
    ajustar.setAttribute('aria-label', 'Ajustar ' + item.titulo);
    ajustar.addEventListener('click', function () { alternarAjustes(item, tarjeta, ajustar); });
    acciones.appendChild(ajustar);
    tarjeta.appendChild(acciones);
  }
  return tarjeta;
}
function tarjetaDisponible(item) {
  var tarjeta = nodo('article', 'zd-card zd-auto-card zd-auto-card--disponible');
  tarjeta.appendChild(cabeza(item.titulo, item.descripcion, null));
  // Activation from the panel is out of scope: the card says who to ask instead of offering a button (UX review P-04).
  tarjeta.appendChild(nodo('p', 'zd-meta', 'Para activarla, pedísela a quien te dio acceso.'));
  return tarjeta;
}
function pintar(cuerpo) {
  var activas = document.getElementById('lista-activas');
  var disponibles = document.getElementById('lista-disponibles');
  activas.textContent = '';
  disponibles.textContent = '';
  mostrar('estado-carga', false);
  mostrar('estado-error', false);
  for (var i = 0; i < cuerpo.activas.length; i++) {
    activas.appendChild(tarjetaActiva(cuerpo.activas[i], cuerpo.zonaHoraria));
  }
  for (var j = 0; j < cuerpo.disponibles.length; j++) {
    disponibles.appendChild(tarjetaDisponible(cuerpo.disponibles[j]));
  }
  mostrar('estado-vacio', cuerpo.activas.length === 0);
  mostrar('lista-activas', cuerpo.activas.length > 0);
  mostrar('seccion-disponibles', cuerpo.disponibles.length > 0);
  mostrar('nota-truncado', cuerpo.truncado === true);
  avisoGuardado = null;
  // CH-43: the times of the Telegram card read in this same zone, which arrives with the list.
  if (zonaPanel !== cuerpo.zonaHoraria) {
    zonaPanel = cuerpo.zonaHoraria;
    if (telegram !== null) { pintarTelegram(); }
  }
}
function fallar(texto) {
  mostrar('estado-carga', false);
  document.getElementById('texto-error').textContent = texto;
  mostrar('estado-error', true);
}
function cargarLista() {
  return fetch('/api/panel/automatizaciones', { credentials: 'same-origin' }).then(function (respuesta) {
    if (respuesta.status === 401) {
      window.location.reload();
      return null;
    }
    if (respuesta.status === 409) {
      fallar(MENSAJE_TENANT_INACTIVO);
      return null;
    }
    if (!respuesta.ok) {
      fallar(MENSAJE_ERROR);
      return null;
    }
    return respuesta.json();
  }).then(function (cuerpo) {
    if (cuerpo === null) { return; }
    pintar(cuerpo);
  }).catch(function () {
    fallar(MENSAJE_ERROR);
  });
}
// ---- P-07 Avisos por Telegram (CH-43): fixed blocks, one state at a time ----------------
// The card loads on its own: a failure here never touches the automations list, nor the reverse.
var zonaPanel;
var telegram = null;
var ESTADOS_TELEGRAM = ['no-disponible', 'sin-vincular', 'codigo-pendiente', 'vinculado'];
var BLOQUES_TELEGRAM = ['telegram-carga', 'telegram-error', 'telegram-no-disponible', 'telegram-sin-vincular', 'telegram-vinculado', 'telegram-codigo'];
var SOLO_HORA = { hour: '2-digit', minute: '2-digit', hour12: false };
var SOLO_FECHA = { day: '2-digit', month: '2-digit', year: 'numeric' };
var ENLACE_TELEGRAM = 'https://t.me/';
function verTelegram(visibles) {
  for (var i = 0; i < BLOQUES_TELEGRAM.length; i++) { mostrar(BLOQUES_TELEGRAM[i], visibles.indexOf(BLOQUES_TELEGRAM[i]) !== -1); }
}
function avisoTelegram(titulo, texto) {
  document.getElementById('telegram-aviso-titulo').textContent = titulo;
  document.getElementById('telegram-aviso-texto').textContent = texto;
  mostrar('telegram-aviso', titulo !== '');
}
function confirmarTelegram(visible) {
  mostrar('telegram-confirmar', visible);
  document.getElementById('telegram-desvincular').setAttribute('aria-expanded', visible ? 'true' : 'false');
}
function pintarTelegram() {
  confirmarTelegram(false);
  if (telegram.estado === 'no-disponible' || telegram.estado === 'sin-vincular') {
    verTelegram(['telegram-' + telegram.estado]);
    return;
  }
  var visibles = [];
  if (telegram.estado === 'vinculado') {
    visibles.push('telegram-vinculado');
    document.getElementById('telegram-vinculado-en').textContent = formatear(telegram.vinculadoEn, zonaPanel, SOLO_FECHA);
  }
  if (typeof telegram.venceEn === 'string') {
    visibles.push('telegram-codigo');
    document.getElementById('telegram-vence').textContent = formatear(telegram.venceEn, zonaPanel, SOLO_HORA);
    // The plain code exists only in the answer that created it: a code from an earlier visit shows only its expiry.
    var conCodigo = typeof telegram.codigo === 'string';
    mostrar('telegram-codigo-nuevo', conCodigo);
    mostrar('telegram-codigo-previo', !conCodigo);
    if (conCodigo) {
      document.getElementById('telegram-codigo-valor').textContent = telegram.codigo.slice(0, 4) + ' ' + telegram.codigo.slice(4);
      // P-05: which bot «nuestro bot» is, so the code can be sent by hand when «Abrir Telegram» does not work.
      document.getElementById('telegram-bot').textContent = typeof telegram.bot === 'string' && telegram.bot !== '' ? '@' + telegram.bot : 'nuestro bot';
      var abrir = document.getElementById('telegram-abrir');
      var enlaceValido = typeof telegram.enlace === 'string' && telegram.enlace.indexOf(ENLACE_TELEGRAM) === 0;
      // The only link built from a server value, and only toward Telegram.
      if (enlaceValido) { abrir.href = telegram.enlace; }
      abrir.hidden = !enlaceValido;
    }
  }
  verTelegram(visibles);
}
function fallarTelegram(texto) {
  document.getElementById('telegram-texto-error').textContent = texto;
  verTelegram(['telegram-error']);
}
function pedirTelegram(metodo, ruta) {
  return fetch(ruta, { method: metodo, credentials: 'same-origin' }).then(function (respuesta) {
    return respuesta.json().catch(function () { return {}; }).then(function (datos) {
      return { estado: respuesta.status, datos: datos || {} };
    });
  });
}
function cargarTelegram() {
  avisoTelegram('', '');
  verTelegram(['telegram-carga']);
  return pedirTelegram('GET', '/api/panel/telegram').then(function (resultado) {
    if (resultado.estado === 401) {
      window.location.reload();
      return;
    }
    if (resultado.estado === 409) {
      fallarTelegram(MENSAJE_TENANT_INACTIVO);
      return;
    }
    var datos = resultado.datos;
    if (resultado.estado !== 200 || ESTADOS_TELEGRAM.indexOf(datos.estado) === -1) {
      fallarTelegram(MENSAJE_ERROR);
      return;
    }
    telegram = { estado: datos.estado, bot: datos.bot, vinculadoEn: datos.vinculadoEn, venceEn: datos.venceEn };
    pintarTelegram();
  }).catch(function () {
    fallarTelegram(MENSAJE_ERROR);
  });
}
function crearCodigoTelegram(boton) {
  avisoTelegram('', '');
  boton.disabled = true;
  pedirTelegram('POST', '/api/panel/telegram/codigo').then(function (resultado) {
    var datos = resultado.datos;
    if (resultado.estado === 401) {
      window.location.reload();
      return;
    }
    if (resultado.estado === 409 && datos.error === 'telegram-no-disponible') {
      telegram = { estado: 'no-disponible' };
      pintarTelegram();
      return;
    }
    if (resultado.estado !== 201 || typeof datos.codigo !== 'string' || typeof datos.venceEn !== 'string') {
      avisoTelegram('No pudimos generar el código', resultado.estado === 409 ? MENSAJE_TENANT_INACTIVO : MENSAJE_ERROR);
      return;
    }
    if (telegram.estado !== 'vinculado') { telegram.estado = 'codigo-pendiente'; }
    telegram.codigo = datos.codigo;
    if (typeof datos.bot === 'string') { telegram.bot = datos.bot; }
    telegram.enlace = datos.enlace;
    telegram.venceEn = datos.venceEn;
    pintarTelegram();
    var abrir = document.getElementById('telegram-abrir');
    (abrir.hidden ? document.getElementById('telegram-otro-codigo') : abrir).focus();
  }).catch(function () {
    avisoTelegram('No pudimos generar el código', MENSAJE_ERROR);
  }).finally(function () {
    boton.disabled = false;
  });
}
function desvincularTelegram(boton) {
  avisoTelegram('', '');
  boton.disabled = true;
  pedirTelegram('DELETE', '/api/panel/telegram/vinculo').then(function (resultado) {
    if (resultado.estado === 401) {
      window.location.reload();
      return;
    }
    if (resultado.estado !== 204) {
      confirmarTelegram(false);
      avisoTelegram('No pudimos desvincular Telegram', resultado.estado === 409 ? MENSAJE_TENANT_INACTIVO : MENSAJE_ERROR);
      return;
    }
    // A live code survives the unlink (the server leaves it), so the card keeps showing it.
    telegram.estado = typeof telegram.venceEn === 'string' ? 'codigo-pendiente' : 'sin-vincular';
    telegram.vinculadoEn = undefined;
    pintarTelegram();
  }).catch(function () {
    confirmarTelegram(false);
    avisoTelegram('No pudimos desvincular Telegram', MENSAJE_ERROR);
  }).finally(function () {
    boton.disabled = false;
  });
}
function alClic(id, accion) {
  var boton = document.getElementById(id);
  boton.addEventListener('click', function () { accion(boton); });
}
alClic('telegram-reintentar', function () { cargarTelegram(); });
alClic('telegram-vincular', crearCodigoTelegram);
alClic('telegram-otro-chat', crearCodigoTelegram);
alClic('telegram-otro-codigo', crearCodigoTelegram);
alClic('telegram-desvincular', function () {
  confirmarTelegram(true);
  document.getElementById('telegram-confirmar-desvincular').focus();
});
alClic('telegram-cancelar', function () {
  confirmarTelegram(false);
  document.getElementById('telegram-desvincular').focus();
});
alClic('telegram-confirmar-desvincular', desvincularTelegram);
cargarLista();
cargarTelegram();
</script>
` + PIE_PAGINA;
}

/**
 * `GET /panel` (DEC-136). The route is NOT exempt like the auth endpoints are: its
 * tenant comes from the session hook below, and the hook runs in optional mode so
 * this handler decides between the two renders. No `PrismaClient` handle is kept
 * beyond the hook's: the shell's tenant name arrives in `request.sesionPanel` (the
 * same row the API routes trust), so the page never performs its own read.
 */
export function registerPanelRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  app.get(
    '/panel',
    { preHandler: [levantarSesionPanel(prisma, { opcional: true })] },
    async (request: FastifyRequest, reply) => {
      const sesion = request.sesionPanel;
      const documento =
        sesion === undefined ? DOCUMENTO_INGRESO : documentoShell(sesion.tenantNombre);
      return reply.code(200).type('text/html; charset=utf-8').send(documento);
    },
  );
}