import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { levantarSesionPanel } from './panel-auth.js';

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
 * The page is plain HTML + CSS + JS served as a string, like `src/consola.ts`: no
 * static-file plugin, no build, no framework. Two properties of this module are
 * load-bearing and worth stating:
 *
 *  - **The tenant enters only from the session row (rule 2, DEC-135).** The header
 *    hooks exempt `GET /panel` by exact row (see `src/contexto-tenant.ts`) because
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
</style>
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
 * out of scope (R2), and a dead link in production is worse than none.
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
    </form>
    <p class="zd-meta">Entrás directo a tu negocio; no hace falta elegirlo.</p>
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
 * the P-04 inline "Ajustar" form of CH-23). The header names the session's tenant — the one store
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
<main class="panel-main">
  <section data-screen-label="Mis automatizaciones" data-change="CH-22" data-estado="parcial">
    <h1 class="zd-h1">Mis automatizaciones</h1>
    <p class="zd-muted">Lo que revisamos por vos y te mandamos por correo.</p>
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
</main>
<script>
document.getElementById('boton-salir').addEventListener('click', function () {
  fetch('/api/panel/auth/salir', { method: 'POST' }).finally(function () {
    window.location.reload();
  });
});
</script>
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
function formatear(iso, zona) {
  var opciones = { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  var formato;
  try {
    opciones.timeZone = zona;
    formato = new Intl.DateTimeFormat('es-AR', opciones);
  } catch (e) {
    delete opciones.timeZone;
    formato = new Intl.DateTimeFormat('es-AR', opciones);
  }
  return formato.format(new Date(iso));
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
  umbral: 'Ingresá un número válido.',
  hora: 'Elegí una hora válida.',
  dias: 'Elegí los días de envío.',
  destinatario: 'Ingresá un correo válido.'
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
  var correo = campos.destinatario.control.value.trim();
  if (correo !== (ajustes.destinatario || '')) { cuerpo.destinatario = correo; }
  return cuerpo;
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
    numero.step = 'any';
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
  correo.type = 'email';
  correo.value = ajustes.destinatario || '';
  correo.setAttribute('autocomplete', 'off');
  campos.destinatario = campoDeFormulario(prefijo, 'destinatario', 'Enviar a', correo, null, null);
  forma.appendChild(campos.destinatario.caja);
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
cargarLista();
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