import type { FastifyInstance } from 'fastify';

/**
 * The whole console: one self-contained HTML document held as a constant.
 *
 * No static-file plugin and no template engine is used on purpose. `@fastify/static`
 * would add a runtime dependency *and* a build step (`tsc` does not copy non-TS
 * files) for a single document, and a frontend framework would add a toolchain and a
 * third-party script origin for a textarea and a table.
 *
 * **Every value coming from the API is assigned through `textContent`, never
 * `innerHTML`.** The rows are arbitrary third-party data read from a tenant's
 * replica, and this is the project's first browser surface: `innerHTML` would make a
 * stored `<script>` in the tenant's data execute in the operator's session. That is a
 * mechanism, not a convention — it is the one reviewable boundary that makes this
 * page safe to point at untrusted data.
 *
 * The saved-queries list is the second data source under that same rule. Its `nombre`
 * and `descripcion` are operator-authored rather than third-party, but they are
 * *persisted and replayed later*, which is a stored-input surface whichever hand typed
 * them — so they are rendered through `textContent` too, and a loaded statement
 * reaches the editor as `textarea.value`, never as markup. A loaded parameter
 * declaration (CH-11) follows the same rule: each `nombre` reaches its row as an input
 * `value` and its label as `textContent`.
 *
 * The inline script uses string concatenation rather than JS template literals so the
 * document can live inside this TypeScript template literal without escaping.
 */
const DOCUMENTO_CONSOLA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroDashboard — Consola de consultas</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 62rem; padding: 1.5rem; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  /* Sticky so T4's "permanent and unambiguous" survives scrolling. The z-index is
     above the sticky table headers below, which share the same top edge. */
  #barra-tenant { position: sticky; top: 0; z-index: 2; display: flex; align-items: center;
    flex-wrap: wrap; gap: .6rem; margin: -1.5rem -1.5rem 1rem; padding: .6rem 1.5rem;
    background: Canvas; border-bottom: 1px solid rgba(128,128,128,.4); }
  #barra-tenant label { margin: 0; }
  #barra-tenant select { font: inherit; padding: .25rem .4rem; max-width: 18rem; }
  #tenant-activo { margin-left: auto; text-align: right; }
  #tenant-activo.sin-tenant { color: #b3261e; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .25rem; }
  .ayuda { margin: 0 0 1.25rem; opacity: .75; font-size: .9rem; }
  label { display: block; font-size: .85rem; font-weight: 600; margin: .75rem 0 .25rem; }
  input, textarea { width: 100%; box-sizing: border-box; font: inherit; padding: .4rem .5rem; }
  textarea { font-family: ui-monospace, monospace; resize: vertical; }
  .controles { display: flex; align-items: flex-end; gap: .75rem; margin-top: .75rem; }
  .controles label { margin: 0 0 .25rem; }
  .controles > div { width: 10rem; }
  button { font: inherit; padding: .45rem 1rem; cursor: pointer; }
  button[disabled] { cursor: not-allowed; opacity: .5; }
  .banner { margin: 1rem 0 0; padding: .7rem .9rem; border-left: .3rem solid #b3261e; background: rgba(179,38,30,.12); white-space: pre-wrap; }
  .banner.exito { border-left-color: #1a7f37; background: rgba(26,127,55,.12); }
  .estado { margin: 1rem 0 .25rem; font-size: .85rem; opacity: .8; }
  /* The row-cap cut, styled so it cannot be mistaken for the pagination line it sits
     next to: its own block, its own colour, and full opacity against the dimmed
     status text. DEC-18 separates the two verdicts in the API; this separates them
     on screen. */
  .estado .corte { display: block; margin-top: .35rem; color: #b3261e; opacity: 1; }
  .tabla-contenedor { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { border: 1px solid rgba(128,128,128,.4); padding: .3rem .5rem; text-align: left; vertical-align: top; white-space: pre-wrap; }
  th { position: sticky; top: 0; background: rgba(128,128,128,.15); }
  td.nulo { opacity: .5; font-style: italic; }
  .paginacion { display: flex; gap: .75rem; margin-top: .75rem; }
  #guardadas { list-style: none; padding: 0; margin: .75rem 0 0; }
  #guardadas li { display: flex; align-items: baseline; gap: .6rem; padding: .4rem 0; border-bottom: 1px solid rgba(128,128,128,.25); }
  #guardadas li .ayuda { margin: 0; }
  .parametro { display: flex; align-items: flex-end; gap: .6rem; }
  .parametro label { flex: 1; }
  select { font: inherit; padding: .4rem .5rem; }
</style>
</head>
<body>
<!--
  T4: the active tenant is named here at all times, above everything else and sticky,
  so no action is ever performed against a tenant the operator cannot see. The name is
  written with textContent — a tenant nombre is operator-authored but persisted and
  replayed later, which makes it a stored-input surface (regla 7).
-->
<header id="barra-tenant">
  <label for="tenant">Tenant activo</label>
  <select id="tenant"></select>
  <strong id="tenant-activo" class="sin-tenant">Ningún tenant seleccionado</strong>
</header>

<h1>Consola de consultas</h1>
<p class="ayuda">Solo lectura. La sentencia se ejecuta dentro de una transacción de solo lectura y se rechaza si el rol conectado puede escribir.</p>

<form id="formulario">
  <label for="conexion">Identificador de la conexión registrada</label>
  <input id="conexion" type="text" autocomplete="off" spellcheck="false" placeholder="por ejemplo: 0f1c…" required>

  <label for="sql">Sentencia SQL</label>
  <textarea id="sql" rows="8" spellcheck="false" required>SELECT 1</textarea>

  <!--
    CH-11: one row per :nombre the statement uses (DEC-48). The page does no scanning:
    the server names an undeclared or unused parameter, and this page shows that answer.
    Every button here is type="button" so none of them submits the form.
  -->
  <p class="ayuda">Parámetros: declare cada :nombre que use la sentencia. Un valor vacío no se envía.</p>
  <div id="parametros"></div>
  <button id="agregar-parametro" type="button">Agregar parámetro</button>

  <div class="controles">
    <div>
      <!--
        No max attribute since CH-07, for the same reason the request schema dropped
        its maximum: 200. The ceiling is now MAX_FILAS_CONSULTA (DEC-19) and the server
        applies it and says so; a literal here would clamp the request below the ceiling
        so the cut could never happen, leaving the operator unable to observe from the
        only surface they have that a limit exists at all.
      -->
      <label for="limite">Filas por página</label>
      <input id="limite" type="number" min="1" value="50">
    </div>
    <button id="ejecutar" type="submit">Ejecutar</button>
  </div>
</form>

<!--
  Saved queries live OUTSIDE #formulario on purpose. #conexion and #sql are required,
  so a name field inside the same form would let browser validation block *execution*
  until a name was typed. #guardar is type="button" for the mirror-image reason: the
  default type="submit" would run the form's submit handler and execute the query
  instead of saving it.
-->
<section id="guardado">
  <h2>Consultas guardadas</h2>
  <p class="ayuda">Guarda la sentencia que está ahora en el editor. No se puede editar ni borrar una consulta guardada: para corregirla, se guarda otra.</p>

  <label for="nombre">Nombre</label>
  <input id="nombre" type="text" autocomplete="off" placeholder="por ejemplo: Stock producible">

  <label for="descripcion">Descripción (opcional)</label>
  <input id="descripcion" type="text" autocomplete="off">

  <div class="controles">
    <button id="guardar" type="button">Guardar consulta</button>
  </div>

  <ul id="guardadas"></ul>
</section>

<!--
  CH-13 (DEC-78, DEC-79, DEC-80): outside #formulario for the reason saved queries are,
  and every button is type="button". There is no edit, delete or reactivate control on
  purpose: a mistaken automation is deactivated and created again.
-->
<section id="automatizaciones">
  <h2>Automatizaciones</h2>
  <p class="ayuda">Ejecuta una plantilla del catálogo contra una conexión del tenant activo según un horario cron de cinco campos, en la zona horaria configurada del despliegue. No se puede editar ni reactivar una automatización: para corregirla, se desactiva y se crea otra.</p>

  <div class="tabla-contenedor"><table id="auto-lista"></table></div>
  <h2>Ejecuciones</h2>
  <div class="tabla-contenedor"><table id="auto-ejecuciones"></table></div>
</section>

<p id="banner" class="banner" role="alert" hidden></p>
<p id="estado" class="estado" hidden></p>

<div class="tabla-contenedor">
  <table id="resultados"><thead></thead><tbody></tbody></table>
</div>

<div class="paginacion">
  <button id="anterior" type="button" disabled>Página anterior</button>
  <button id="siguiente" type="button" disabled>Página siguiente</button>
</div>

<script>
'use strict';

// One legible message per closed {fase, categoria} pair the API can return. The
// console renders only these fields, so no raw driver error can reach the page.
var MENSAJES = {
  'conexion:tiempo-agotado': 'No se pudo conectar con el destino dentro del tiempo permitido.',
  'conexion:host-inalcanzable': 'El destino rechazó la conexión o no es alcanzable desde la aplicación.',
  'conexion:dns-no-resuelve': 'El nombre del host guardado no se pudo resolver.',
  'conexion:credenciales-invalidas': 'El destino rechazó las credenciales guardadas para esta conexión.',
  'conexion:base-inexistente': 'La base de datos indicada en la conexión no existe en el destino.',
  'conexion:error-desconocido': 'La conexión con el destino falló por un motivo no reconocido.',
  'permisos:rol-superusuario': 'El rol conectado es superusuario: evita toda verificación de permisos, así que la ejecución se rechaza sin enviar la sentencia.',
  'permisos:rol-con-escritura-en-tabla': 'El rol conectado tiene permiso de escritura (INSERT, UPDATE, DELETE o TRUNCATE) sobre al menos una tabla. Use un rol de solo lectura.',
  'permisos:rol-con-create-en-esquema': 'El rol conectado tiene permiso CREATE a nivel de esquema. Use un rol de solo lectura.',
  'ejecucion:tiempo-agotado': 'La consulta superó el tiempo máximo de ejecución y fue cancelada.',
  'ejecucion:no-es-lectura': 'La sentencia intenta escribir o modificar la estructura de la base, y la transacción es de solo lectura. Nada se ejecutó.',
  'ejecucion:permiso-denegado': 'El rol conectado no tiene permiso sobre alguno de los objetos que la consulta necesita.',
  'ejecucion:error-sintaxis': 'La sentencia es inválida, o contiene más de una sentencia en un mismo envío. Solo se admite una por ejecución.',
  'ejecucion:error-datos': 'La consulta es válida pero falló al procesar los datos (por ejemplo, una división por cero).',
  'ejecucion:error-desconocido': 'La ejecución falló por un motivo no reconocido.'
};
var MENSAJE_GENERICO = 'La ejecución falló y la consola no pudo identificar el motivo.';

// Refusals that are about the stored row rather than about the target database or the
// active tenant, so they are neither a {fase, categoria} pair nor a tenant message.
// They arrive as an HTTP status with an error code in the body.
var MENSAJES_ERROR = {
  'credencial-ilegible': 'La credencial guardada para esta conexión no se pudo descifrar. ' +
    'Si la conexión se registró antes de que el cifrado entrara en vigencia, hay que volver a registrarla.'
};

// The tenant-level refusals the API can answer on any scoped route. They are not in
// MENSAJES above because those are {fase, categoria} pairs about the *target* database;
// these are about which tenant the console is operating as. The 503 message this
// ladder used to carry is gone with the response it described: CH-06 removed that
// status entirely, because the tenant is now named by the request instead of being
// looked up server-side. The smoke test greps the served document for that removed
// error code, so it must not appear here even in a comment.
// (No backtick may appear anywhere in this document either: the whole page is one
// TypeScript template literal, and one backtick in a comment ends it. Same trap CH-05
// recorded as friction 4.)
var MENSAJES_TENANT = {
  'tenant-no-indicado': 'La consola no envió un tenant activo. Elegí uno en la barra superior.',
  'tenant-no-encontrado': 'El tenant seleccionado ya no existe. Se actualizó la lista; elegí otro.',
  'tenant-desactivado': 'El tenant seleccionado está dado de baja y no admite ninguna operación. Elegí otro.'
};

// One legible sentence per motivo a parameter problem can carry (CH-11). The line
// names the parameter; the motivo code itself never reaches the page.
var MENSAJES_PARAMETRO = {
  'nombre-invalido': 'el nombre no es válido: debe empezar con una letra o un guion bajo y seguir con letras, dígitos o guiones bajos',
  'nombre-duplicado': 'está declarado más de una vez',
  'tipo-desconocido': 'el tipo debe ser texto, numero, booleano o fecha',
  'posicional-a-mano': 'es un parámetro posicional escrito a mano; use :nombre y declárelo',
  'sin-declarar': 'aparece en la sentencia pero no está declarado',
  'sin-usar': 'está declarado pero la sentencia no lo usa',
  'valor-faltante': 'no tiene valor',
  'valor-no-declarado': 'recibió un valor pero no está declarado',
  'valor-invalido': 'el valor no tiene la forma que exige su tipo (numero: un número; fecha: AAAA-MM-DD, opcionalmente con hora)'
};
var TIPOS_PARAMETRO = ['texto', 'numero', 'booleano', 'fecha'];

// CH-13: the error codes the automation routes answer with, one sentence each.
var MENSAJES_AUTOMATIZACION = {
  'automatizacion-no-encontrada': 'Esa automatización ya no existe para el tenant activo. Se actualizó la lista.',
  'automatizacion-desactivada': 'Esa automatización ya estaba desactivada. Se actualizó la lista.'
};

// A run closed before dialing carries one of these closed categories instead of a
// {fase, categoria} pair from MENSAJES. The row never holds driver text (X2).
var MENSAJES_CORRIDA = {
  'vista-canonica-no-aprobada': 'La corrida se frenó antes de conectar. Entidades sin una validación de vista canónica aprobada:',
  'valores-invalidos': 'Los valores guardados ya no cumplen la declaración actual de la plantilla. No se conectó con el destino.',
  'conexion-no-encontrada': 'La conexión de la automatización ya no existe. No se conectó con el destino.',
  'credencial-ilegible': 'La credencial guardada de la conexión no se pudo descifrar. No se conectó con el destino.',
  'error-interno': 'La corrida falló por un error interno de la aplicación.'
};

var CLAVE_TENANT = 'zerodashboard.tenantActivo';

var selectorTenant = document.getElementById('tenant');
var indicadorTenant = document.getElementById('tenant-activo');
var formulario = document.getElementById('formulario');
var entradaConexion = document.getElementById('conexion');
var entradaSql = document.getElementById('sql');
var contenedorParametros = document.getElementById('parametros');
var botonAgregarParametro = document.getElementById('agregar-parametro');
var entradaLimite = document.getElementById('limite');
var botonEjecutar = document.getElementById('ejecutar');
var botonAnterior = document.getElementById('anterior');
var botonSiguiente = document.getElementById('siguiente');
var entradaNombre = document.getElementById('nombre');
var entradaDescripcion = document.getElementById('descripcion');
var botonGuardar = document.getElementById('guardar');
var listaGuardadas = document.getElementById('guardadas');
var banner = document.getElementById('banner');
var estado = document.getElementById('estado');
var encabezado = document.querySelector('#resultados thead');
var cuerpoTabla = document.querySelector('#resultados tbody');
var tablaAutomatizaciones = document.getElementById('auto-lista');
var tablaEjecuciones = document.getElementById('auto-ejecuciones');

var pagina = { desplazamiento: 0, limite: 50, hayMas: false, siguiente: null, corte: null };

// The selected tenant lives here and nowhere else (DEC-15: explicit per request, no
// server session). Every call reads it through pedir() below.
var tenantActivo = null;

// The declaration rows, in the order they are sent: the server binds $k by that order.
var filasParametros = [];

// One alert region for the whole page, deliberately not one per section: a save
// failure and an execution failure overwrite each other, which is simpler than two
// competing alert regions and keeps a single place where the operator looks.
function mostrarBanner(texto) {
  banner.className = 'banner';
  banner.textContent = texto;
  banner.hidden = false;
}

// Same region, success wording. The save flow has to say out loud that the statement
// was stored; reusing the failure styling for that would be a lie in red.
function mostrarConfirmacion(texto) {
  banner.className = 'banner exito';
  banner.textContent = texto;
  banner.hidden = false;
}

function ocultarBanner() {
  banner.className = 'banner';
  banner.textContent = '';
  banner.hidden = true;
}

function vaciar(nodo) {
  while (nodo.firstChild) { nodo.removeChild(nodo.firstChild); }
}

function limpiarResultados() {
  vaciar(encabezado);
  vaciar(cuerpoTabla);
  // Emptied, not just hidden: since CH-07 the status line holds child nodes (the cap
  // sentence), and a hidden node that still carries "cortado en el tope" would reappear
  // over the next, uncut result.
  vaciar(estado);
  estado.hidden = true;
  botonAnterior.disabled = true;
  botonSiguiente.disabled = true;
}

function textoDeCelda(valor) {
  if (valor === null || valor === undefined) { return 'NULL'; }
  if (typeof valor === 'object') { return JSON.stringify(valor); }
  return String(valor);
}

function renderizar(cuerpo) {
  vaciar(encabezado);
  vaciar(cuerpoTabla);

  var filaEncabezado = document.createElement('tr');
  cuerpo.columnas.forEach(function (nombre) {
    var celda = document.createElement('th');
    celda.textContent = String(nombre);
    filaEncabezado.appendChild(celda);
  });
  encabezado.appendChild(filaEncabezado);

  cuerpo.filas.forEach(function (fila) {
    var tr = document.createElement('tr');
    fila.forEach(function (valor) {
      var celda = document.createElement('td');
      if (valor === null || valor === undefined) { celda.className = 'nulo'; }
      celda.textContent = textoDeCelda(valor);
      tr.appendChild(celda);
    });
    cuerpoTabla.appendChild(tr);
  });
}

// The status line, and the one place the row-cap cut is announced. It is announced HERE
// and not in the failure banner on purpose: a capped execution succeeded, and putting it
// in the red banner would tell the operator that something went wrong when the only
// thing that happened is that they were given less than they asked for. That separation
// is DEC-18 expressed in the interface.
function describirPagina(cuerpo) {
  vaciar(estado);

  var desde = cuerpo.paginacion.desplazamiento;
  var cantidad = cuerpo.filas.length;
  var texto = cantidad === 0
    ? 'Sin filas en esta página.'
    : 'Filas ' + (desde + 1) + ' a ' + (desde + cantidad) + '.';
  // Deliberately mutually exclusive with the cut sentence below. "Hay más resultados."
  // invites asking for the next page, which is exactly what the cap denies, so showing
  // both would put two contradictory instructions on the same line.
  if (cuerpo.paginacion.hayMas && cuerpo.corte === null) { texto += ' Hay más resultados.'; }

  var base = document.createElement('span');
  base.textContent = texto + ' ' + cuerpo.duracionMs + ' ms.';
  estado.appendChild(base);

  if (cuerpo.corte === 'tope-de-filas') {
    var aviso = document.createElement('strong');
    aviso.className = 'corte';
    aviso.textContent = 'Resultado cortado en el tope configurado de ' +
      cuerpo.paginacion.topeFilas + ' filas. No hay página siguiente: ' +
      'acote la consulta o cambie el tope del despliegue.';
    estado.appendChild(aviso);
  }

  estado.hidden = false;
}

function mensajeDeFallo(cuerpo) {
  var clave = String(cuerpo.fase) + ':' + String(cuerpo.categoria);
  var base = Object.prototype.hasOwnProperty.call(MENSAJES, clave) ? MENSAJES[clave] : MENSAJE_GENERICO;
  return cuerpo.codigo ? base + ' (SQLSTATE ' + cuerpo.codigo + ')' : base;
}

// --- Active tenant -------------------------------------------------------------
// One wrapper, one place where the header is attached. A single point is what makes
// "the console never forgets the tenant" reviewable, and it mirrors the server-side
// single-point argument of DEC-13. Nothing below calls fetch() on a scoped route.

// localStorage can throw outright (private modes, disabled storage), and a console
// that will not load because of a preference is worse than one that forgets.
function leerTenantGuardado() {
  try { return window.localStorage.getItem(CLAVE_TENANT); } catch (sinAlmacenamiento) { return null; }
}

function escribirTenantGuardado(id) {
  try {
    if (id === null) { window.localStorage.removeItem(CLAVE_TENANT); }
    else { window.localStorage.setItem(CLAVE_TENANT, id); }
  } catch (sinAlmacenamiento) { /* the selection simply does not survive a reload */ }
}

function fijarTenant(id) {
  tenantActivo = (id === null || id === '') ? null : String(id);
  selectorTenant.value = tenantActivo === null ? '' : tenantActivo;

  if (tenantActivo === null) {
    indicadorTenant.className = 'sin-tenant';
    indicadorTenant.textContent = 'Ningún tenant seleccionado';
  } else {
    var opcion = selectorTenant.options[selectorTenant.selectedIndex];
    var nombre = opcion ? opcion.textContent : '';
    indicadorTenant.className = '';
    // The id fragment is not decoration: two tenants may share a nombre by design, so
    // the name alone would not satisfy T4's "without ambiguity".
    indicadorTenant.textContent = (nombre === '' ? 'Tenant' : nombre) +
      ' (' + tenantActivo.slice(0, 8) + '…)';
  }
  escribirTenantGuardado(tenantActivo);
}

function renderizarSelector(tenants) {
  vaciar(selectorTenant);

  var vacio = document.createElement('option');
  vacio.value = '';
  vacio.textContent = tenants.length === 0 ? 'No hay tenants activos' : 'Elegí un tenant';
  selectorTenant.appendChild(vacio);

  tenants.forEach(function (fila) {
    var opcion = document.createElement('option');
    opcion.value = String(fila.id);
    // textContent, never markup: a stored nombre that spells out a script tag has to
    // render as visible text (regla 7). The smoke test greps the served document for
    // the markup-assigning property name, so it must not appear even in a comment.
    opcion.textContent = String(fila.nombre);
    selectorTenant.appendChild(opcion);
  });

  // A stored selection is re-validated against what the API just returned rather than
  // trusted: a tenant that was deleted or dado de baja must not silently stay active
  // in the bar while every call answers 404 or 409.
  var guardado = leerTenantGuardado();
  var sigueVigente = guardado !== null && tenants.some(function (fila) {
    return String(fila.id) === guardado;
  });
  fijarTenant(sigueVigente ? guardado : null);
  if (guardado !== null && !sigueVigente) {
    mostrarBanner('El tenant que estaba seleccionado ya no está activo. Elegí otro en la barra superior.');
  }
}

// GET /tenants is exempt from the tenant header, so it is the one call that does not
// go through pedir() — it is what makes a first selection possible at all.
async function cargarTenants() {
  var respuesta;
  try {
    respuesta = await fetch('/tenants');
  } catch (fallaDeRed) {
    mostrarBanner('No se pudo contactar con la aplicación para leer la lista de tenants.');
    return;
  }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (cuerpo === null || respuesta.status !== 200) {
    mostrarBanner('No se pudo leer la lista de tenants (HTTP ' + respuesta.status + ').');
    return;
  }

  renderizarSelector(Array.isArray(cuerpo.tenants) ? cuerpo.tenants : []);
}

/**
 * Every call to a tenant-scoped route goes through here. Returns null — and makes no
 * request at all — when no tenant is selected, so the operator sees "elegí un tenant"
 * instead of a 400 the API had to be bothered for.
 */
function pedir(url, opciones) {
  if (tenantActivo === null) {
    mostrarBanner('Elegí un tenant en la barra superior antes de operar. No se envió ninguna solicitud.');
    return Promise.resolve(null);
  }

  var config = opciones || {};
  var cabeceras = {};
  if (config.headers) {
    Object.keys(config.headers).forEach(function (clave) { cabeceras[clave] = config.headers[clave]; });
  }
  cabeceras['X-Tenant-Id'] = tenantActivo;

  return fetch(url, { method: config.method, headers: cabeceras, body: config.body });
}

/**
 * True when the response was a tenant-level refusal and the page has already said so.
 * The list is reloaded on the two cases where the stored selection is provably stale,
 * so the bar stops naming something the API no longer accepts.
 */
function manejarFalloDeTenant(cuerpo) {
  if (cuerpo === null || typeof cuerpo !== 'object') { return false; }
  if (!Object.prototype.hasOwnProperty.call(MENSAJES_TENANT, cuerpo.error)) { return false; }

  mostrarBanner(MENSAJES_TENANT[cuerpo.error]);
  if (cuerpo.error === 'tenant-no-encontrado' || cuerpo.error === 'tenant-desactivado') {
    limpiarResultados();
    vaciar(listaGuardadas);
    limpiarAutomatizaciones();
    cargarTenants();
  }
  return true;
}

// --- Parameters (CH-11) --------------------------------------------------------
// The declaration is edited as rows and sent as data. Values leave the page with the
// JSON type their tipo requires (DEC-60), because the server coerces nothing: a numero
// typed into a text box has to be sent as a number.

function rotular(texto, control) {
  var rotulo = document.createElement('label');
  var leyenda = document.createElement('span');
  leyenda.textContent = texto;
  rotulo.appendChild(leyenda);
  rotulo.appendChild(control);
  return rotulo;
}

function controlDeValor(tipo) {
  var control;
  if (tipo === 'booleano') {
    control = document.createElement('select');
    ['', 'true', 'false'].forEach(function (valor) {
      var opcion = document.createElement('option');
      opcion.value = valor;
      opcion.textContent = valor === '' ? '(sin valor)' : valor;
      control.appendChild(opcion);
    });
  } else {
    // A text input for numero too: a number input would hand back '' for anything it
    // cannot parse, and the server could no longer name what was wrong.
    control = document.createElement('input');
    control.type = 'text';
    control.autocomplete = 'off';
    if (tipo === 'fecha') { control.placeholder = 'AAAA-MM-DD o AAAA-MM-DDTHH:MM:SS'; }
  }
  control.className = 'parametro-valor';
  return control;
}

function agregarFilaParametro(nombre, tipo) {
  var fila = {
    nodo: document.createElement('div'),
    nombre: document.createElement('input'),
    tipo: document.createElement('select'),
    valor: controlDeValor(tipo)
  };
  fila.nodo.className = 'parametro';
  fila.nombre.type = 'text';
  fila.nombre.autocomplete = 'off';
  fila.nombre.className = 'parametro-nombre';
  fila.nombre.value = nombre;
  TIPOS_PARAMETRO.forEach(function (opcionTipo) {
    var opcion = document.createElement('option');
    opcion.value = opcionTipo;
    opcion.textContent = opcionTipo;
    fila.tipo.appendChild(opcion);
  });
  fila.tipo.className = 'parametro-tipo';
  fila.tipo.value = tipo;

  // The value control is labeled with the nombre it fills, and follows it as typed.
  var rotuloValor = rotular(nombre === '' ? 'Valor' : nombre, fila.valor);
  var leyenda = rotuloValor.firstChild;
  leyenda.className = 'parametro-leyenda';
  fila.nombre.addEventListener('input', function () {
    var escrito = fila.nombre.value.trim();
    leyenda.textContent = escrito === '' ? 'Valor' : escrito;
  });
  // A new tipo brings its own control; a value typed for the old one is dropped.
  fila.tipo.addEventListener('change', function () {
    rotuloValor.removeChild(fila.valor);
    fila.valor = controlDeValor(fila.tipo.value);
    rotuloValor.appendChild(fila.valor);
  });

  var quitar = document.createElement('button');
  quitar.type = 'button';
  quitar.textContent = 'Quitar';
  quitar.addEventListener('click', function () {
    contenedorParametros.removeChild(fila.nodo);
    filasParametros.splice(filasParametros.indexOf(fila), 1);
  });

  fila.nodo.appendChild(rotular('Nombre', fila.nombre));
  fila.nodo.appendChild(rotular('Tipo', fila.tipo));
  fila.nodo.appendChild(rotuloValor);
  fila.nodo.appendChild(quitar);
  contenedorParametros.appendChild(fila.nodo);
  filasParametros.push(fila);
}

function limpiarParametros() {
  vaciar(contenedorParametros);
  filasParametros = [];
}

function declaracionActual() {
  return filasParametros.map(function (fila) {
    return { nombre: fila.nombre.value.trim(), tipo: fila.tipo.value };
  });
}

// A blank control sends no key at all, so the server answers valor-faltante naming the
// parameter instead of receiving an empty string it would have to interpret.
function valoresActuales() {
  // No prototype: a parameter may legally be called __proto__, and it must stay a key.
  var valores = Object.create(null);
  filasParametros.forEach(function (fila) {
    var tipo = fila.tipo.value;
    var crudo = tipo === 'texto' ? fila.valor.value : fila.valor.value.trim();
    if (crudo === '') { return; }
    var valor = crudo;
    if (tipo === 'booleano') { valor = crudo === 'true'; }
    // Not a finite number: the raw text is sent, and the server names the problem.
    if (tipo === 'numero' && Number.isFinite(Number(crudo))) { valor = Number(crudo); }
    valores[fila.nombre.value.trim()] = valor;
  });
  return valores;
}

// A 400 on execute or save. A parameter problem becomes one line naming the parameter;
// a schema refusal carries only campos (an unknown tipo, for instance), and a
// /parametros/i/... path is mapped back to the row that was sent at index i. Only
// known fields of the body are read: nothing else it carries reaches the page.
function mensajeDeSolicitudInvalida(cuerpo, declaracion) {
  if (Array.isArray(cuerpo.problemas) && cuerpo.problemas.length > 0) {
    return 'La solicitud es inválida.\\n' + cuerpo.problemas.map(function (problema) {
      var motivo = Object.prototype.hasOwnProperty.call(MENSAJES_PARAMETRO, problema.motivo)
        ? MENSAJES_PARAMETRO[problema.motivo] : 'no es válido';
      var sujeto = typeof problema.parametro === 'string'
        ? 'Parámetro «' + problema.parametro + '»' : 'Declaración de parámetros';
      return sujeto + ': ' + motivo + '.';
    }).join('\\n');
  }
  var campos = Array.isArray(cuerpo.campos) ? cuerpo.campos.map(function (campo) {
    var partes = String(campo).split('/');
    var fila = partes[1] === 'parametros' ? declaracion[Number(partes[2])] : undefined;
    return fila && partes[3] ? 'el ' + partes[3] + ' del parámetro «' + fila.nombre + '»' : String(campo);
  }).join(', ') : '';
  return 'La solicitud es inválida. Revise estos campos: ' + (campos === '' ? 'el cuerpo enviado' : campos) + '.';
}

async function ejecutar(desplazamiento) {
  ocultarBanner();
  botonEjecutar.disabled = true;

  // Only the lower bound is checked here. There is no upper one to check any more: the
  // ceiling belongs to the deployment (MAX_FILAS_CONSULTA), the server applies it, and
  // the response says whether it cut. A copy of the number in this file would be a
  // second place for it to drift out of step.
  var limite = parseInt(entradaLimite.value, 10);
  if (!(limite >= 1)) { limite = 50; }
  var declaracion = declaracionActual();

  var respuesta;
  try {
    respuesta = await pedir('/consultas/ejecutar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conexionId: entradaConexion.value.trim(),
        sql: entradaSql.value,
        parametros: declaracion,
        valores: valoresActuales(),
        limite: limite,
        desplazamiento: desplazamiento
      })
    });
  } catch (fallaDeRed) {
    // A rejected fetch must not be silent either: the page says so instead.
    botonEjecutar.disabled = false;
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return;
  }
  botonEjecutar.disabled = false;
  // No tenant selected: pedir() made no request and already showed the banner.
  if (respuesta === null) { return; }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (manejarFalloDeTenant(cuerpo)) {
    limpiarResultados();
    return;
  }
  if (cuerpo === null) {
    limpiarResultados();
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return;
  }
  if (respuesta.status === 404) {
    limpiarResultados();
    mostrarBanner('No existe una conexión registrada con ese identificador.');
    return;
  }
  // Row-level refusals, before the generic status ladder: the connection exists but the
  // application cannot read its stored credential, which is a different thing from the
  // target rejecting one.
  if (Object.prototype.hasOwnProperty.call(MENSAJES_ERROR, cuerpo.error)) {
    limpiarResultados();
    mostrarBanner(MENSAJES_ERROR[cuerpo.error]);
    return;
  }
  if (respuesta.status === 400) {
    limpiarResultados();
    mostrarBanner(mensajeDeSolicitudInvalida(cuerpo, declaracion));
    return;
  }
  if (respuesta.status !== 200) {
    limpiarResultados();
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }
  if (cuerpo.resultado !== 'ok') {
    limpiarResultados();
    mostrarBanner(mensajeDeFallo(cuerpo));
    return;
  }

  renderizar(cuerpo);
  pagina = {
    desplazamiento: cuerpo.paginacion.desplazamiento,
    limite: cuerpo.paginacion.limite,
    hayMas: cuerpo.paginacion.hayMas,
    siguiente: cuerpo.paginacion.siguienteDesplazamiento,
    corte: cuerpo.corte === undefined ? null : cuerpo.corte
  };
  describirPagina(cuerpo);
  botonAnterior.disabled = pagina.desplazamiento <= 0;
  // A capped response leaves hayMas true — the result set really did have more rows —
  // but there is no next page to serve, so the control stays off. This is the reason
  // the cut cannot be signalled through hayMas: the two answers point opposite ways.
  botonSiguiente.disabled = !pagina.hayMas || pagina.corte !== null;
}

// --- Saved queries -------------------------------------------------------------
// Every field below reaches the page through textContent, and the loaded statement
// reaches the editor through textarea.value. Both are stored text written earlier and
// replayed now, which makes them a stored-input surface regardless of who typed them:
// a saved nombre that spells out a script tag has to render as visible text.
//
// Note for whoever edits this block: no closing script tag may appear anywhere in this
// inline script, not even inside a comment. The HTML parser ends the script element at
// the first such sequence it sees and hands the rest of the file to the page as markup.

function renderizarGuardadas(cuerpo) {
  vaciar(listaGuardadas);

  var filas = Array.isArray(cuerpo.consultasGuardadas) ? cuerpo.consultasGuardadas : [];

  if (filas.length === 0) {
    var vacia = document.createElement('li');
    vacia.className = 'ayuda';
    vacia.textContent = 'Todavía no hay consultas guardadas.';
    listaGuardadas.appendChild(vacia);
    return;
  }

  filas.forEach(function (fila) {
    var item = document.createElement('li');

    var nombre = document.createElement('span');
    nombre.textContent = String(fila.nombre);
    item.appendChild(nombre);

    // The list shows creadaEn because duplicate names are allowed by design: two rows
    // called "Stock producible" are otherwise indistinguishable in a list.
    var fecha = document.createElement('span');
    fecha.className = 'ayuda';
    fecha.textContent = String(fila.creadaEn);
    item.appendChild(fecha);

    if (fila.descripcion !== null && fila.descripcion !== undefined) {
      var descripcion = document.createElement('span');
      descripcion.className = 'ayuda';
      descripcion.textContent = String(fila.descripcion);
      item.appendChild(descripcion);
    }

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Cargar';
    // The closure captures fila.id, never fila.nombre: the id is the only thing that
    // identifies a row when names can repeat.
    boton.addEventListener('click', function () { cargarGuardada(fila.id); });
    item.appendChild(boton);

    listaGuardadas.appendChild(item);
  });

  // The list is hard-capped server-side and there is no pagination parameter to see
  // past it, so the cut is announced instead of leaving the operator to guess.
  if (cuerpo.truncado) {
    var aviso = document.createElement('li');
    aviso.className = 'ayuda';
    aviso.textContent = 'Se muestran solo las ' + filas.length +
      ' consultas más recientes. Hay más guardadas que esta lista no alcanza a mostrar.';
    listaGuardadas.appendChild(aviso);
  }
}

async function listarGuardadas() {
  var respuesta;
  try {
    respuesta = await pedir('/consultas-guardadas');
  } catch (fallaDeRed) {
    // A failed listing must never break the execute path: it reports and returns.
    mostrarBanner('No se pudo contactar con la aplicación para leer las consultas guardadas.');
    return;
  }
  if (respuesta === null) { return; }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (cuerpo === null || respuesta.status !== 200) {
    mostrarBanner('No se pudieron leer las consultas guardadas (HTTP ' + respuesta.status + ').');
    return;
  }

  renderizarGuardadas(cuerpo);
}

async function guardar() {
  ocultarBanner();
  botonGuardar.disabled = true;

  var nombre = entradaNombre.value.trim();
  var declaracion = declaracionActual();

  var respuesta;
  try {
    respuesta = await pedir('/consultas-guardadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre,
        descripcion: entradaDescripcion.value,
        // Sent verbatim: the API stores the operator's statement as written.
        sql: entradaSql.value,
        // The declaration only: values belong to one execution, never to the saved
        // query (DEC-48).
        parametros: declaracion
      })
    });
  } catch (fallaDeRed) {
    botonGuardar.disabled = false;
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return;
  }
  botonGuardar.disabled = false;
  if (respuesta === null) { return; }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (cuerpo === null) {
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return;
  }
  if (respuesta.status === 400) {
    mostrarBanner(mensajeDeSolicitudInvalida(cuerpo, declaracion));
    return;
  }
  if (respuesta.status !== 201) {
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }

  entradaNombre.value = '';
  entradaDescripcion.value = '';
  mostrarConfirmacion('Se guardó la consulta y ya aparece en la lista.');
  await listarGuardadas();
}

async function cargarGuardada(id) {
  ocultarBanner();

  var respuesta;
  try {
    respuesta = await pedir('/consultas-guardadas/' + encodeURIComponent(id));
  } catch (fallaDeRed) {
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return;
  }
  if (respuesta === null) { return; }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (cuerpo === null) {
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return;
  }
  if (respuesta.status === 404) {
    // The row is gone from under the list; refresh so the stale entry disappears.
    mostrarBanner('Esa consulta guardada ya no existe. Se actualizó la lista.');
    await listarGuardadas();
    return;
  }
  if (respuesta.status !== 200) {
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }

  // A plain value assignment on the textarea: the statement is data, not markup.
  entradaSql.value = cuerpo.consultaGuardada.sql;
  // The saved declaration replaces the rows, with empty values: values are never saved.
  limpiarParametros();
  var parametros = cuerpo.consultaGuardada.parametros;
  (Array.isArray(parametros) ? parametros : []).forEach(function (parametro) {
    agregarFilaParametro(String(parametro.nombre), String(parametro.tipo));
  });
  entradaSql.focus();
  // #conexion is deliberately left as it is: nothing binds a saved query to a
  // connection, so the operator chooses which target to run it against.
}

// --- Automations (CH-13) -------------------------------------------------------
// Every call goes through pedir(), and every value below reaches the page through
// textContent, as everywhere else. The list names each plantilla by its id.

// One header row, one row per entry. A cell is a string, set as text, or a node (the
// action buttons). An aviso, when given, is one last row announcing the list cut.
function renderizarTabla(tabla, columnas, filas, claseFila, aviso) {
  vaciar(tabla);
  var cabeza = document.createElement('thead');
  var filaCabeza = document.createElement('tr');
  columnas.forEach(function (nombre) {
    var th = document.createElement('th');
    th.textContent = nombre;
    filaCabeza.appendChild(th);
  });
  cabeza.appendChild(filaCabeza);
  tabla.appendChild(cabeza);
  var cuerpo = document.createElement('tbody');
  filas.forEach(function (celdas) {
    var tr = document.createElement('tr');
    tr.className = claseFila;
    celdas.forEach(function (celda) {
      var td = document.createElement('td');
      if (typeof celda === 'string') { td.textContent = celda; } else { td.appendChild(celda); }
      tr.appendChild(td);
    });
    cuerpo.appendChild(tr);
  });
  if (aviso) {
    var trAviso = document.createElement('tr');
    var tdAviso = document.createElement('td');
    tdAviso.className = 'ayuda';
    tdAviso.textContent = aviso;
    trAviso.appendChild(tdAviso);
    cuerpo.appendChild(trAviso);
  }
  tabla.appendChild(cuerpo);
}

function limpiarAutomatizaciones() {
  vaciar(tablaAutomatizaciones);
  vaciar(tablaEjecuciones);
}

// The shared head of every automations call: null when the page has already said why,
// otherwise the status and the parsed body for the caller to judge.
async function pedirAutomatizacion(url, opciones) {
  var respuesta;
  try {
    respuesta = await pedir(url, opciones);
  } catch (fallaDeRed) {
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return null;
  }
  if (respuesta === null) { return null; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return null; }
  if (cuerpo === null) {
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return null;
  }
  return { status: respuesta.status, cuerpo: cuerpo };
}

function mostrarRechazo(resultado) {
  var error = resultado.cuerpo.error;
  mostrarBanner(Object.prototype.hasOwnProperty.call(MENSAJES_AUTOMATIZACION, error)
    ? MENSAJES_AUTOMATIZACION[error] : 'La aplicación respondió HTTP ' + resultado.status + '.');
}

function boton(texto, clase, accion) {
  var nodo = document.createElement('button');
  nodo.type = 'button';
  nodo.className = clase;
  nodo.textContent = texto;
  nodo.addEventListener('click', accion);
  return nodo;
}

function textoOpcional(valor) {
  return valor === null || valor === undefined ? '—' : String(valor);
}

async function listarAutomatizaciones() {
  var resultado = await pedirAutomatizacion('/automatizaciones');
  if (resultado === null) { return; }
  if (resultado.status !== 200) { mostrarRechazo(resultado); return; }
  var filas = Array.isArray(resultado.cuerpo.automatizaciones) ? resultado.cuerpo.automatizaciones : [];
  renderizarTabla(
    tablaAutomatizaciones,
    ['Plantilla', 'Conexión', 'Horario', 'Estado', 'Creada', 'Acciones'],
    filas.map(function (fila) {
      var acciones = document.createElement('span');
      acciones.appendChild(boton('Ver ejecuciones', 'ver-ejecuciones', function () { verEjecuciones(fila.id); }));
      // The only state change offered, and only while it can still happen (DEC-79).
      if (fila.activo === true) {
        acciones.appendChild(boton('Desactivar', 'desactivar', function () { desactivar(fila.id); }));
      }
      return [String(fila.plantillaId), String(fila.conexionId),
        String(fila.cron), fila.activo === true ? 'activa' : 'desactivada', String(fila.creadaEn), acciones];
    }),
    'automatizacion',
    resultado.cuerpo.truncado ? 'Se muestran solo las ' + filas.length + ' automatizaciones más recientes.' : null
  );
}

async function desactivar(id) {
  ocultarBanner();
  var resultado = await pedirAutomatizacion('/automatizaciones/' + encodeURIComponent(id) + '/desactivar', { method: 'POST' });
  if (resultado === null) { return; }
  if (resultado.status === 200) {
    mostrarConfirmacion('Se desactivó la automatización. Sus ejecuciones pasadas siguen disponibles.');
  } else {
    mostrarRechazo(resultado);
  }
  await listarAutomatizaciones();
}

// One legible sentence per closed category; a SQLSTATE only when the row carries one.
function errorDeCorrida(fila) {
  if (fila.error === null || fila.error === undefined) { return ''; }
  var error = String(fila.error);
  var clave = String(fila.fase) + ':' + error;
  // A gate refusal names the ungated entities in codigoError (closed contract names).
  if (error === 'vista-canonica-no-aprobada') {
    return MENSAJES_CORRIDA[error] + ' ' + textoOpcional(fila.codigoError) + '.';
  }
  var texto = Object.prototype.hasOwnProperty.call(MENSAJES, clave) ? MENSAJES[clave]
    : Object.prototype.hasOwnProperty.call(MENSAJES_CORRIDA, error) ? MENSAJES_CORRIDA[error] : MENSAJE_GENERICO;
  return fila.codigoError ? texto + ' (SQLSTATE ' + fila.codigoError + ')' : texto;
}

async function verEjecuciones(id) {
  ocultarBanner();
  var resultado = await pedirAutomatizacion('/automatizaciones/' + encodeURIComponent(id) + '/ejecuciones');
  if (resultado === null) { return; }
  if (resultado.status !== 200) { mostrarRechazo(resultado); await listarAutomatizaciones(); return; }
  var filas = Array.isArray(resultado.cuerpo.ejecuciones) ? resultado.cuerpo.ejecuciones : [];
  renderizarTabla(
    tablaEjecuciones,
    ['Inicio', 'Fin', 'Duración (ms)', 'Filas', 'Estado', 'Error'],
    filas.map(function (fila) {
      var cantidad = textoOpcional(fila.filas) + (fila.corte === 'tope-de-filas' ? ' (cortado en el tope)' : '');
      return [String(fila.iniciadaEn), textoOpcional(fila.finalizadaEn), textoOpcional(fila.duracionMs),
        cantidad, String(fila.estado), errorDeCorrida(fila)];
    }),
    'ejecucion',
    filas.length === 0 ? 'Esta automatización todavía no tiene ejecuciones.'
      : resultado.cuerpo.truncado ? 'Se muestran solo las ' + filas.length + ' ejecuciones más recientes.' : null
  );
}

// Switching tenants wipes the screen before anything else happens. This is the visual
// half of the isolation guarantee: rows and saved-query names belonging to the tenant
// the operator just left must not stay on the page next to the new tenant's name.
selectorTenant.addEventListener('change', function () {
  fijarTenant(selectorTenant.value);
  ocultarBanner();
  limpiarResultados();
  vaciar(listaGuardadas);
  limpiarParametros();
  limpiarAutomatizaciones();
  pagina = { desplazamiento: 0, limite: 50, hayMas: false, siguiente: null, corte: null };
  if (tenantActivo !== null) {
    listarGuardadas();
    listarAutomatizaciones();
  }
});

formulario.addEventListener('submit', function (evento) {
  evento.preventDefault();
  ejecutar(0);
});

botonGuardar.addEventListener('click', function () {
  guardar();
});

botonAgregarParametro.addEventListener('click', function () {
  agregarFilaParametro('', 'texto');
});

botonSiguiente.addEventListener('click', function () {
  ejecutar(pagina.siguiente === null ? pagina.desplazamiento : pagina.siguiente);
});

botonAnterior.addEventListener('click', function () {
  ejecutar(Math.max(0, pagina.desplazamiento - pagina.limite));
});

// The tenant list comes first: nothing else on this page can be asked for until the
// console knows which tenant it is operating as.
cargarTenants().then(function () {
  if (tenantActivo !== null) {
    listarGuardadas();
    listarAutomatizaciones();
  }
});
</script>
</body>
</html>
`;

/**
 * `GET /consola`. Takes no `PrismaClient`: the page touches no database of ours — it
 * only talks to `POST /consultas/ejecutar` from the browser. `/` is left unclaimed.
 */
export function registerConsolaRoute(app: FastifyInstance): void {
  app.get('/consola', async (_request, reply) => {
    return reply.code(200).type('text/html; charset=utf-8').send(DOCUMENTO_CONSOLA);
  });
}
