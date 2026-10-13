import type { FastifyInstance } from 'fastify';
import type { OperadorAutenticado } from './consola-auth.js';
import { escaparHtml } from './correo.js';

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
 *
 * CH-29 (DEC-154): the document is built per request because it names the operator in
 * the tenant bar. That name is stored data, so it is interpolated only through
 * `escaparHtml`; it is the one interpolation in the whole document.
 */
function documentoConsola(nombreOperador: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroDashboard — Consola de consultas</title>
<!--
  CH-21a (DEC-124): the shared stylesheet, served by exact exempt GET routes. The style
  element below is the console's bridge, not a second design: it styles the nodes the
  script builds or renames (their className is the script's, so they carry no zd-*
  class; the template cards of CH-21c are the one exception and use the shared card
  classes as they are) and lays out what the shared components do not cover. Tokens only.
-->
<link rel="stylesheet" href="/ui/styles.css">
<style>
  [hidden] { display: none !important; }
  /* CH-30a (DEC-164): the bar spans the page; below it the shared shell (side navigation and
     one screen at a time). On a narrow screen the navigation stacks above the screen. */
  body.zd-root { padding-bottom: var(--space-10); }
  @media (max-width: 48rem) {
    .zd-shell { grid-template-columns: minmax(0, 1fr); }
    .zd-sidenav { border-right: 0; border-bottom: var(--border-width) solid var(--border-1); }
  }
  /* T4: sticky and violet from the shared bar; amber while no tenant is selected, with
     the text saying so. Without :has() the bar stays violet, so the no-tenant text keeps its own
     underline to stay distinct from the active-tenant state. */
  #barra-tenant { flex-wrap: wrap; padding-block: var(--space-2); }
  #tenant-activo { margin-left: auto; text-align: right; font-size: var(--text-md); font-weight: var(--weight-bold); }
  #tenant-activo.sin-tenant { text-decoration: underline; text-decoration-color: var(--warn); text-decoration-thickness: 2px; text-underline-offset: 3px; }
  .zd-tenantbar:has(#tenant-activo.sin-tenant) { background: var(--warn-soft); color: var(--warn-text); box-shadow: inset 0 -2px 0 var(--warn); }
  #barra-tenant .zd-select { width: auto; max-width: 18rem; min-height: var(--control-h-sm); }
  #barra-tenant .zd-select:focus-visible { outline-color: var(--tenant-on); border-color: var(--tenant-on); }
  .zd-tenantbar:has(#tenant-activo.sin-tenant) .zd-select:focus-visible { outline-color: var(--warn-text); border-color: var(--warn-text); }
  .zd-h1 { margin: var(--space-8) 0 var(--space-2); }
  .zd-h2 { margin: var(--space-9) 0 var(--space-2); }
  .zd-label { display: block; margin: var(--space-5) 0 var(--space-2); }
  .ayuda { margin: 0 0 var(--space-6); font-size: var(--text-help); color: var(--text-2); }
  /* Parameter rows and automation values, built by the script. */
  .parametro { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-4); margin-top: var(--space-4); }
  .parametro label, #auto-valores label, .parametro-leyenda { font-size: var(--text-label); font-weight: var(--weight-semibold); color: var(--text-1); }
  .parametro label, #auto-valores label { display: flex; flex: 1 1 8rem; flex-direction: column; gap: var(--space-2); min-width: 0; }
  #auto-valores label { margin-top: var(--space-5); }
  .parametro-nombre, .parametro-tipo, .parametro-valor { width: 100%; min-height: var(--control-h); padding: 0 var(--space-4);
    border: var(--border-width) solid var(--border-2); border-radius: var(--radius-md); background: var(--surface-card);
    color: var(--text-1); font: inherit; font-size: var(--text-body); font-weight: var(--weight-regular); }
  .parametro-nombre:hover, .parametro-tipo:hover, .parametro-valor:hover { border-color: var(--border-strong); }
  .parametro-nombre:focus-visible, .parametro-tipo:focus-visible, .parametro-valor:focus-visible {
    outline: var(--focus-width) solid var(--focus-ring); outline-offset: 0; border-color: var(--focus-ring); }
  #agregar-parametro { margin-top: var(--space-4); }
  .controles { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-5); margin-top: var(--space-5); }
  .controles > div { width: 10rem; }
  .controles .zd-label { margin: 0 0 var(--space-2); }
  .paginacion { margin-top: var(--space-5); }
  /* Script-built buttons (Quitar, Cargar, Ver ejecuciones, Desactivar): small secondary. */
  button:not(.zd-btn) { display: inline-flex; align-items: center; justify-content: center; height: var(--control-h-sm);
    padding: 0 var(--space-4); border: var(--border-width) solid var(--border-2); border-radius: var(--radius-md);
    background: var(--surface-card); color: var(--text-1); font: inherit; font-size: var(--text-xs);
    font-weight: var(--weight-semibold); white-space: nowrap; cursor: pointer; }
  button:not(.zd-btn):hover:not(:disabled) { background: var(--surface-hover); border-color: var(--border-strong); }
  button:not(.zd-btn):disabled { cursor: not-allowed; opacity: .5; }
  .ver-ejecuciones + .desactivar { margin-left: var(--space-3); }
  /* One alert region; a multi-line refusal keeps its line breaks. */
  .banner { margin: var(--space-6) 0 0; padding: var(--space-5) var(--space-6); border: var(--border-width) solid var(--error-border);
    border-left: var(--space-2) solid var(--error); border-radius: var(--radius-md); background: var(--error-soft);
    color: var(--text-1); white-space: pre-wrap; }
  .banner.exito { border-color: var(--ok-border); border-left-color: var(--ok); background: var(--ok-soft); }
  .estado { margin: var(--space-6) 0 var(--space-2); font-size: var(--text-sm); color: var(--text-2); }
  /* The row-cap cut, styled so it cannot be mistaken for the pagination line it sits
     next to or for the pager buttons: its own block, its own rule and colour, and
     semibold against the quiet status text. DEC-18 separates the two verdicts in the
     API; this separates them on screen. */
  .estado .corte { display: block; margin-top: var(--space-3); padding-left: var(--space-4);
    border-left: var(--space-2) solid var(--warn); color: var(--warn-text); font-weight: var(--weight-semibold); }
  .zd-table-wrap { margin-top: var(--space-5); }
  .zd-table-wrap:not(:has(th, td)) { border: 0; }
  .zd-table td { white-space: pre-wrap; vertical-align: top; }
  .zd-table td.nulo { color: var(--text-3); font-style: italic; }
  #guardadas { list-style: none; padding: 0; margin: var(--space-5) 0 0; }
  #guardadas li { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-4); padding: var(--space-3) 0;
    border-bottom: var(--border-width) solid var(--border-1); }
  #guardadas .ayuda { margin: 0; }
  /* CH-21c wizard. The script moves aria-current only, so step 1 reads as done whenever
     it is not the current step (the shared sheet's done look needs a class the script
     does not assign). */
  #auto-alta { margin-top: var(--space-5); }
  #auto-alta .zd-form-actions { margin-top: var(--space-6); }
  #auto-marca-1:not([aria-current]) { color: var(--text-2); }
  #auto-marca-1:not([aria-current]) .zd-step__n { border-color: var(--accent); color: var(--accent-text); }
  /* A preset writes the cron field: it reads as shown, not typed (the sheet has no read-only look). */
  #auto-cron[readonly] { border-style: dashed; background: var(--surface-sunken); color: var(--text-2); }
  /* DEC-127: a template the chosen connection cannot run reads as unavailable and says why.
     The radio is disabled, so the card is skipped by the keyboard and cannot be chosen. */
  .zd-template:has(input:disabled) { cursor: not-allowed; background: var(--surface-sunken); border-style: dashed; }
  .zd-template:has(input:disabled):hover { border-color: var(--border-2); }
  /* DEC-131: the preview's title bar; its accent is set by the script, as the email does. */
  .vista-correo__titulo { padding: var(--space-3) var(--space-4); color: var(--text-on-accent); font-weight: 600; }
  .motivo-plantilla { font-size: var(--text-help); color: var(--warn-text); }
  /* CH-24 (C-22): a freshness state is an icon and a word, never a color alone. */
  .estado-frescura { display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 600; }
  .estado-frescura--al-dia { color: var(--ok-text); }
  .estado-frescura--desactualizada { color: var(--warn-text); }
  .estado-frescura--sin-declarar { color: var(--text-2); }
  .icono-frescura { width: 1.15em; height: 1.15em; flex: none; }
  #fresc-minutos { width: 10rem; }
  /* CH-25 (C-05): the versions panel. The current version is an icon and a word, never a color alone. */
  .version-vigente { display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 600; color: var(--ok-text); }
  .versiones-bloques { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); margin-top: var(--space-5); }
  .versiones-bloque pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  @media (max-width: 40rem) { .versiones-bloques { grid-template-columns: minmax(0, 1fr); } }
  /* CH-29 (C-01): the operator slot and Salir sit at the end of the tenant bar. */
  #operador { margin-inline-start: auto; }
  /* CH-30d: the mapping editors the script builds, one per contract entity. */
  #mapeo-entidades { display: grid; gap: var(--space-6); }
  #mapeo-entidades textarea { width: 100%; min-height: 8rem; font-family: var(--font-mono); font-size: var(--text-sm); }
  #mapeo-entidades ul { margin: var(--space-3) 0 0; padding-inline-start: var(--space-6); }
</style>
</head>
<body class="zd-root">
<!--
  T4: the active tenant is named here at all times, above everything else and sticky,
  so no action is ever performed against a tenant the operator cannot see. The name is
  written with textContent — a tenant nombre is operator-authored but persisted and
  replayed later, which makes it a stored-input surface (regla 7).
-->
<header id="barra-tenant" class="zd-tenantbar">
  <label for="tenant" class="zd-tenantbar__label">Tenant activo</label>
  <select id="tenant" class="zd-select"></select>
  <strong id="tenant-activo" class="sin-tenant">Ningún tenant seleccionado</strong>
  <!-- CH-29 (DEC-154, C-01): who operates. The name is escaped by the server. -->
  <span id="operador" class="zd-operator">Operador: <strong>${escaparHtml(nombreOperador)}</strong></span>
  <button id="salir" class="zd-btn zd-btn--ghost zd-btn--sm" type="button">Salir</button>
</header>

<!--
  CH-30a (DEC-164, DEC-165): the shell of the design guide. The navigation links the screens
  by hash and the script shows one at a time; every id below is the one the console always
  had, moved and never renamed. Only the three existing screens are linked: the others arrive
  with CH-30b to CH-30e. The banner stays above every screen: it speaks for the whole page.
-->
<div class="zd-shell">
<nav class="zd-sidenav" aria-label="Secciones de la consola">
  <div class="zd-sidenav__brand"><span class="zd-sidenav__brandname">ZeroDashboard</span><span class="zd-eyebrow">Consola</span></div>
  <div class="zd-sidenav__group">
    <span class="zd-sidenav__heading">Global</span>
    <a id="nav-tenants" class="zd-sidenav__item" href="#tenants"><span>Tenants</span></a>
    <a id="nav-plantillas" class="zd-sidenav__item" href="#plantillas"><span>Plantillas</span></a>
    <a id="nav-contrato" class="zd-sidenav__item" href="#contrato"><span>Contrato canónico</span></a>
  </div>
  <div class="zd-sidenav__scope">
    <span class="zd-sidenav__subheading">Puesta en marcha</span>
    <a id="nav-conexiones" class="zd-sidenav__item" href="#conexiones"><span>Conexiones</span></a>
    <a id="nav-agentes" class="zd-sidenav__item" href="#agentes"><span>Agentes</span></a>
    <a id="nav-mapeo" class="zd-sidenav__item" href="#mapeo"><span>Mapeo y validación</span></a>
    <a id="nav-usuarios" class="zd-sidenav__item" href="#usuarios"><span>Usuarios del panel</span></a>
    <span class="zd-sidenav__subheading">Trabajo diario</span>
    <a id="nav-consultas" class="zd-sidenav__item" href="#consultas"><span>Consultas</span></a>
    <a id="nav-automatizaciones" class="zd-sidenav__item" href="#automatizaciones"><span>Automatizaciones</span></a>
    <a id="nav-frescura" class="zd-sidenav__item" href="#frescura"><span>Frescura de datos</span></a>
  </div>
</nav>
<main class="zd-page">
<p id="banner" class="banner" role="alert" hidden></p>

<!--
  CH-30b (DEC-167, DEC-168, screen C-02): every tenant, active and deactivated. Global: it
  does not depend on the selector. A deactivated tenant is listed with no action and can
  never be chosen (DEC-14 refuses every call for it). Rows are built by the script as text.
-->
<section id="pantalla-tenants" aria-labelledby="titulo-tenants" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--global">Global · todos los tenants</span></div>
    <h1 id="titulo-tenants" class="zd-h1">Tenants</h1>
    <p class="zd-pagehead__desc">Dar de baja congela el tenant: sus conexiones, consultas y automatizaciones dejan de operar y no se borra nada.</p>
  </div>
</header>
<form id="tenant-alta" class="controles">
  <div>
    <label for="tenant-nombre" class="zd-label">Nuevo tenant</label>
    <input id="tenant-nombre" class="zd-input" type="text" autocomplete="off" placeholder="Nombre del negocio" required>
  </div>
  <button class="zd-btn zd-btn--primary" type="submit">Crear tenant</button>
</form>
<p id="tenant-aviso" class="ayuda" role="status"></p>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Nombre</th><th>Id</th><th>Estado</th><th>Alta</th><th>Acciones</th></tr></thead>
    <tbody id="tenants-cuerpo"></tbody>
  </table>
</div>
</section>

<!--
  CH-30b (DEC-167, screen C-05): the active tenant's connections. Registering opens a side
  panel; "Guardar y probar" registers and tests at once. The password is sent once and never
  written back to the page: the field is emptied right after reading it.
-->
<section id="pantalla-conexiones" aria-labelledby="titulo-conexiones" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-conexiones" class="zd-h1">Conexiones</h1>
    <p class="zd-pagehead__desc">Cómo llega la consola a la réplica del tenant. Probá cada conexión antes de usarla.</p>
  </div>
  <div class="zd-pagehead__actions">
    <button id="conexion-nueva" class="zd-btn zd-btn--primary" type="button">Nueva conexión</button>
  </div>
</header>
<p id="conexiones-aviso" class="ayuda" role="status"></p>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Nombre</th><th>Motor</th><th>Servidor</th><th>Base</th><th>Usuario</th><th>Prueba</th></tr></thead>
    <tbody id="conexiones-cuerpo"></tbody>
  </table>
</div>
<aside id="conexion-panel" class="zd-drawer" aria-labelledby="titulo-conexion-nueva" hidden>
  <div class="zd-drawer__head"><h2 id="titulo-conexion-nueva" class="zd-h2">Nueva conexión</h2></div>
  <form id="conexion-alta" class="zd-drawer__body">
    <div><label for="cx-nombre" class="zd-label">Nombre</label><input id="cx-nombre" class="zd-input" type="text" autocomplete="off" required></div>
    <div><label for="cx-host" class="zd-label">Servidor</label><input id="cx-host" class="zd-input zd-input--code" type="text" autocomplete="off" spellcheck="false" required></div>
    <div><label for="cx-puerto" class="zd-label">Puerto</label><input id="cx-puerto" class="zd-input" type="number" min="1" max="65535" value="5432" required></div>
    <div><label for="cx-base" class="zd-label">Base de datos</label><input id="cx-base" class="zd-input zd-input--code" type="text" autocomplete="off" spellcheck="false" required></div>
    <div><label for="cx-usuario" class="zd-label">Usuario</label><input id="cx-usuario" class="zd-input zd-input--code" type="text" autocomplete="off" spellcheck="false" required></div>
    <div><label for="cx-via" class="zd-label">Cómo llega</label><select id="cx-via" class="zd-select"><option value="">Directa</option></select></div>
    <div><label for="cx-clave" class="zd-label">Contraseña</label><input id="cx-clave" class="zd-input" type="password" autocomplete="new-password" required></div>
    <p class="ayuda">La contraseña se guarda cifrada y no se vuelve a mostrar.</p>
    <p id="cx-resultado" class="ayuda" role="status"></p>
    <div class="zd-form-actions">
      <button class="zd-btn zd-btn--primary" type="submit">Guardar y probar</button>
      <button id="cx-cerrar" class="zd-btn zd-btn--ghost" type="button">Cerrar</button>
    </div>
  </form>
</aside>
</section>

<!--
  CH-30c (DEC-121, screen C-05 "Agentes"): the tenant's one agent. Its token is shown once,
  in the notice below, and cleared on "Ya lo guardé", on leaving the screen and on a tenant
  switch; it is never written anywhere else.
-->
<section id="pantalla-agentes" aria-labelledby="titulo-agentes" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-agentes" class="zd-h1">Agentes</h1>
    <p class="zd-pagehead__desc">El agente corre en la red del cliente y abre la conexión hacia la consola: el cliente no expone puertos.</p>
  </div>
</header>
<p id="agentes-aviso" class="ayuda" role="status"></p>
<div id="agente-secreto" class="zd-card" role="alert" hidden>
  <p class="ayuda">Este es el token del agente. Copialo ahora: no se vuelve a mostrar.</p>
  <code id="agente-secreto-valor"></code>
  <div class="zd-form-actions">
    <button id="agente-copiar" class="zd-btn zd-btn--secondary" type="button">Copiar</button>
    <button id="agente-guardado" class="zd-btn zd-btn--ghost" type="button">Ya lo guardé</button>
  </div>
</div>
<div id="agente-estado"></div>
</section>

<!--
  CH-30c (DEC-155 to DEC-158, DEC-165): the client administrators who log into the panel.
  Their passwords are generated by the server and shown once, in the notice below, under
  the same rules as the agent token.
-->
<section id="pantalla-usuarios" aria-labelledby="titulo-usuarios" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-usuarios" class="zd-h1">Usuarios del panel</h1>
    <p class="zd-pagehead__desc">Quién del negocio entra al panel. La clave la genera el sistema y se muestra una sola vez.</p>
  </div>
</header>
<form id="usuario-alta" class="controles">
  <div><label for="usuario-correo" class="zd-label">Correo</label><input id="usuario-correo" class="zd-input" type="email" autocomplete="off" required></div>
  <div><label for="usuario-nombre" class="zd-label">Nombre (opcional)</label><input id="usuario-nombre" class="zd-input" type="text" autocomplete="off"></div>
  <button class="zd-btn zd-btn--primary" type="submit">Crear usuario</button>
</form>
<p id="usuarios-aviso" class="ayuda" role="status"></p>
<div id="usuario-secreto" class="zd-card" role="alert" hidden>
  <p class="ayuda">Esta es la clave del usuario. Pasásela por un canal seguro: no se vuelve a mostrar.</p>
  <code id="usuario-secreto-valor"></code>
  <div class="zd-form-actions">
    <button id="usuario-copiar" class="zd-btn zd-btn--secondary" type="button">Copiar</button>
    <button id="usuario-guardado" class="zd-btn zd-btn--ghost" type="button">Ya la guardé</button>
  </div>
</div>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Correo</th><th>Nombre</th><th>Estado</th><th>Alta</th><th>Acciones</th></tr></thead>
    <tbody id="usuarios-cuerpo"></tbody>
  </table>
</div>
</section>

<!--
  CH-30d (DEC-61, screen C-03): the template catalog, global and read-only. Creating and
  replacing a template stay API-only. A template's statement is written as text.
-->
<section id="pantalla-plantillas" aria-labelledby="titulo-plantillas" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--global">Global · todos los tenants</span></div>
    <h1 id="titulo-plantillas" class="zd-h1">Plantillas</h1>
    <p class="zd-pagehead__desc">El catálogo de automatizaciones que se pueden activar. Cada plantilla necesita ciertas entidades mapeadas.</p>
  </div>
</header>
<p id="plantillas-aviso" class="ayuda" role="status"></p>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Nombre</th><th>Automatización</th><th>Formato</th><th>Tolera</th><th></th></tr></thead>
    <tbody id="plantillas-cuerpo"></tbody>
  </table>
</div>
<aside id="plantilla-panel" class="zd-drawer" aria-labelledby="plantilla-titulo" hidden>
  <div class="zd-drawer__head"><h2 id="plantilla-titulo" class="zd-h2"></h2></div>
  <div class="zd-drawer__body">
    <p id="plantilla-entidades"></p>
    <p id="plantilla-parametros"></p>
    <pre id="plantilla-sql"></pre>
    <button id="plantilla-cerrar" class="zd-btn zd-btn--ghost" type="button">Cerrar</button>
  </div>
</aside>
</section>

<!--
  CH-30d (DEC-21, DEC-24, screen C-04): the canonical contract, global and read-only.
-->
<section id="pantalla-contrato" aria-labelledby="titulo-contrato" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--global">Global · todos los tenants</span></div>
    <h1 id="titulo-contrato" class="zd-h1">Contrato canónico</h1>
    <p class="zd-pagehead__desc">Lo que cada tenant tiene que exponer, entidad por entidad, y qué automatización usa cada campo.</p>
  </div>
</header>
<p id="contrato-aviso" class="ayuda" role="status"></p>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Campo</th><th>Tipo</th><th>Obligatorio</th><th>Lo usan</th></tr></thead>
    <tbody id="contrato-cuerpo"></tbody>
  </table>
</div>
</section>

<!--
  CH-30d (DEC-169, DEC-30 to DEC-46, screen C-06): one SQL statement per contract entity, written
  by the operator. "Validar" probes them with zero rows and stores a verdict per field; the
  automations' state (aplicable, inaplicable, bloqueada, pendiente) is computed from it. The
  statements are editor values and every diagnostic is text.
-->
<section id="pantalla-mapeo" aria-labelledby="titulo-mapeo" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-mapeo" class="zd-h1">Mapeo y validación</h1>
    <p class="zd-pagehead__desc">Por cada entidad del contrato, la consulta que la arma desde la réplica del cliente. Validar la prueba sin leer filas.</p>
  </div>
  <div class="zd-pagehead__actions">
    <button id="mapeo-validar" class="zd-btn zd-btn--primary" type="button">Validar mapeo</button>
  </div>
</header>
<div>
  <label for="mapeo-conexion" class="zd-label">Conexión</label>
  <select id="mapeo-conexion" class="zd-select"></select>
</div>
<p id="mapeo-aviso" class="ayuda" role="status"></p>
<div id="mapeo-entidades"></div>
<h2 class="zd-h2">Automatizaciones</h2>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Automatización</th><th>Estado</th><th>Motivos</th></tr></thead>
    <tbody id="mapeo-automatizaciones"></tbody>
  </table>
</div>
</section>

<section id="pantalla-consultas" aria-labelledby="titulo-consultas">
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-consultas" class="zd-h1">Consultas</h1>
    <p class="zd-pagehead__desc">Solo lectura. La sentencia se ejecuta dentro de una transacción de solo lectura y se rechaza si el rol conectado puede escribir.</p>
  </div>
</header>

<form id="formulario">
  <label for="conexion" class="zd-label">Identificador de la conexión registrada</label>
  <input id="conexion" class="zd-input zd-input--code" type="text" autocomplete="off" spellcheck="false" placeholder="por ejemplo: 0f1c…" required>

  <label for="sql" class="zd-label">Sentencia SQL</label>
  <textarea id="sql" class="zd-textarea zd-textarea--code" rows="8" spellcheck="false" required>SELECT 1</textarea>

  <!--
    CH-11: one row per :nombre the statement uses (DEC-48). The page does no scanning:
    the server names an undeclared or unused parameter, and this page shows that answer.
    Every button here is type="button" so none of them submits the form.
  -->
  <p class="ayuda">Parámetros: declare cada :nombre que use la sentencia. Un valor vacío no se envía.</p>
  <div id="parametros"></div>
  <button id="agregar-parametro" class="zd-btn zd-btn--secondary" type="button">Agregar parámetro</button>

  <div class="controles">
    <div>
      <!--
        No max attribute since CH-07, for the same reason the request schema dropped
        its maximum: 200. The ceiling is now MAX_FILAS_CONSULTA (DEC-19) and the server
        applies it and says so; a literal here would clamp the request below the ceiling
        so the cut could never happen, leaving the operator unable to observe from the
        only surface they have that a limit exists at all.
      -->
      <label for="limite" class="zd-label">Filas por página</label>
      <input id="limite" class="zd-input" type="number" min="1" value="50">
    </div>
    <button id="ejecutar" class="zd-btn zd-btn--primary" type="submit">Ejecutar</button>
  </div>
</form>

<!-- CH-30a: the result of a run sits right below the execute button, before the saved queries. -->
<p id="estado" class="estado" hidden></p>

<div class="zd-table-wrap zd-table-scroll">
  <table id="resultados" class="zd-table"><thead></thead><tbody></tbody></table>
</div>

<div class="zd-form-actions paginacion">
  <button id="anterior" class="zd-btn zd-btn--secondary" type="button" disabled>Página anterior</button>
  <button id="siguiente" class="zd-btn zd-btn--secondary" type="button" disabled>Página siguiente</button>
</div>

<!--
  Saved queries live OUTSIDE #formulario on purpose. #conexion and #sql are required,
  so a name field inside the same form would let browser validation block *execution*
  until a name was typed. #guardar is type="button" for the mirror-image reason: the
  default type="submit" would run the form's submit handler and execute the query
  instead of saving it.
-->
<section id="guardado">
  <h2 class="zd-h2">Consultas guardadas</h2>
  <p class="ayuda">Guarda la sentencia que está ahora en el editor. Al cargar una consulta guardada podés editarla y guardar los cambios como una versión nueva: cada cambio queda en su historial. No se puede borrar.</p>

  <label for="nombre" class="zd-label">Nombre</label>
  <input id="nombre" class="zd-input" type="text" autocomplete="off" placeholder="por ejemplo: Stock producible">

  <label for="descripcion" class="zd-label">Descripción (opcional)</label>
  <input id="descripcion" class="zd-input" type="text" autocomplete="off">

  <div class="controles">
    <button id="guardar" class="zd-btn zd-btn--secondary" type="button">Guardar consulta</button>
  </div>

  <!--
    CH-25 (DEC-148, DEC-150): shown only while a saved query is loaded in the editor. The
    note is optional; the button sends the editor's content as a new version of that query.
  -->
  <div id="version-guardar" hidden>
    <p id="version-cargada" class="ayuda"></p>
    <label for="version-nota" class="zd-label">Nota de la versión (opcional)</label>
    <input id="version-nota" class="zd-input" type="text" maxlength="500" autocomplete="off" placeholder="por ejemplo: Agrega filtro por depósito">
    <div class="controles">
      <button id="version-boton" class="zd-btn zd-btn--secondary" type="button">Guardar como nueva versión</button>
    </div>
  </div>

  <ul id="guardadas"></ul>

  <!--
    CH-25 (DEC-146 to DEC-150, screen C-05): the history of one saved query. Starts closed;
    the script fills it as text. Every button is type="button". Restoring never deletes: it
    creates a new version.
  -->
  <div id="versiones" hidden>
    <h3 id="versiones-titulo" class="zd-h2"></h3>
    <p id="versiones-estado" class="ayuda" role="status"></p>
    <ul id="versiones-lista"></ul>
    <div id="versiones-comparacion"></div>
    <button id="versiones-cerrar" class="zd-btn zd-btn--ghost" type="button">Cerrar versiones</button>
  </div>
</section>
</section>

<section id="pantalla-automatizaciones" aria-labelledby="titulo-automatizaciones" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-automatizaciones" class="zd-h1">Automatizaciones</h1>
  </div>
</header>

<!--
  CH-13 (DEC-78, DEC-79, DEC-80): outside #formulario for the reason saved queries are,
  and every button is type="button". There is no edit, delete or reactivate control on
  purpose: a mistaken automation is deactivated and created again.
-->
<section id="automatizaciones">
  <h2 class="zd-h2">Automatizaciones</h2>
  <p class="ayuda">Ejecuta una plantilla del catálogo contra una conexión del tenant activo según un horario cron de cinco campos, en la zona horaria configurada del despliegue. No se puede editar ni reactivar una automatización: para corregirla, se desactiva y se crea otra.</p>

  <button id="auto-nueva" class="zd-btn zd-btn--primary" type="button">Nueva automatización</button>

  <!--
    CH-21c (DEC-129): creation is a two-step wizard. The stepper and both panels are static
    markup; the script only toggles hidden and aria-current on them, never their classes.
  -->
  <div id="auto-alta" class="zd-card zd-form" hidden>
    <ol class="zd-steps" aria-label="Pasos del alta">
      <li id="auto-marca-1" class="zd-step" aria-current="step"><span class="zd-step__n">1</span><span>Conexión y plantilla</span></li>
      <li id="auto-marca-2" class="zd-step"><span class="zd-step__n">2</span><span>Parámetros y horario</span></li>
    </ol>

    <div id="auto-paso-1">
      <!-- CH-21c (DEC-132): the script fills it from GET /conexiones each time the wizard opens. -->
      <label for="auto-conexion" class="zd-label">Conexión</label>
      <select id="auto-conexion" class="zd-select"></select>
      <p id="auto-aviso" class="ayuda" hidden></p>

      <!-- CH-21c (DEC-131): one radio card per catalog template, built by the script as text.
           The group carries its own accessible name, so the visible heading is not read twice. -->
      <p class="zd-label" aria-hidden="true">Plantilla</p>
      <div id="auto-plantilla" class="zd-templates" role="radiogroup" aria-label="Plantilla"></div>

      <div class="zd-form-actions">
        <button id="auto-siguiente" class="zd-btn zd-btn--primary" type="button" disabled>Siguiente</button>
        <button id="auto-cancelar" class="zd-btn zd-btn--ghost" type="button">Cancelar</button>
      </div>
    </div>

    <div id="auto-paso-2" hidden>
      <p id="auto-resumen" class="ayuda"></p>
      <div id="auto-valores"></div>

      <!-- CH-21c (DEC-129): a frequency and an hour write the cron field below, which stays
           visible: read-only for a preset, editable for Personalizado. -->
      <div class="zd-form-row">
        <div>
          <label for="auto-frecuencia" class="zd-label">Frecuencia</label>
          <select id="auto-frecuencia" class="zd-select" aria-describedby="auto-horario-texto">
            <option value="diaria" selected>Todos los días</option>
            <option value="lun-vie">De lunes a viernes</option>
            <option value="lun-sab">De lunes a sábado</option>
            <option value="personalizado">Personalizado (expresión cron)</option>
          </select>
        </div>
        <div>
          <label for="auto-hora" class="zd-label">Hora (24 horas)</label>
          <input id="auto-hora" class="zd-input" type="time" value="08:00" aria-describedby="auto-horario-texto">
        </div>
      </div>
      <p id="auto-horario-texto" class="ayuda"></p>

      <label for="auto-cron" class="zd-label">Expresión cron (minuto hora día-del-mes mes día-de-la-semana)</label>
      <input id="auto-cron" class="zd-input zd-input--code" type="text" autocomplete="off" spellcheck="false" placeholder="por ejemplo: 0 6 * * *" readonly>

      <label for="auto-destinatario" class="zd-label">Correo del destinatario (opcional; no se puede cambiar después)</label>
      <input id="auto-destinatario" class="zd-input" type="email" autocomplete="off" spellcheck="false" placeholder="por ejemplo: operaciones@empresa.com">

      <!-- CH-21c (DEC-131): a schematic of the notification email. Text nodes only, filled by the
           script; it never shows a row of any result. -->
      <div class="zd-card" role="group" aria-label="Vista previa del correo">
        <p class="ayuda">Asunto: <span id="auto-vista-asunto"></span></p>
        <p class="ayuda">Para: <span id="auto-vista-para"></span></p>
        <p id="auto-vista-titulo" class="vista-correo__titulo"></p>
        <p class="ayuda">Debajo del título va una tabla cuyas columnas son los alias de la consulta de la plantilla. Si la consulta no devuelve filas, no se envía correo. n es la cantidad de filas; lleva + cuando el resultado se cortó en el tope.</p>
        <p class="ayuda">Enviado automáticamente por ZeroDashboard.</p>
      </div>

      <div class="zd-form-actions">
        <button id="auto-volver" class="zd-btn zd-btn--secondary" type="button">Volver</button>
        <button id="auto-crear" class="zd-btn zd-btn--primary" type="button">Crear automatización</button>
      </div>
    </div>
  </div>

  <div class="zd-table-wrap zd-table-scroll"><table id="auto-lista" class="zd-table"></table></div>
  <h2 class="zd-h2">Ejecuciones</h2>
  <div class="zd-table-wrap zd-table-scroll"><table id="auto-ejecuciones" class="zd-table"></table></div>
</section>
</section>

<section id="pantalla-frescura" aria-labelledby="titulo-frescura" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-frescura" class="zd-h1">Frescura de datos</h1>
  </div>
</header>

<!--
  CH-24 (DEC-142 to DEC-145, screen C-22): what the implementer declared about the active
  tenant's replica, next to each template's tolerance. Declare and show only: nothing here
  stops or changes a run. Outside #formulario, every button is type="button", and every
  value is written by the script as text.
-->
<section id="frescura">
  <h2 class="zd-h2">Frescura de datos</h2>
  <p class="ayuda">Declarás cada cuánto se regenera la réplica del tenant activo y cuándo se actualizó por última vez. Una plantilla figura como desactualizada cuando esa ventana supera la antigüedad que tolera. Es informativo: no detiene ni cambia ninguna ejecución.</p>
  <p id="fresc-ventana" class="ayuda"></p>
  <p id="fresc-actualizada" class="ayuda"></p>

  <div class="controles">
    <div>
      <label for="fresc-minutos" class="zd-label">Ventana (minutos)</label>
      <input id="fresc-minutos" class="zd-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="vacía: sin declarar">
    </div>
    <button id="fresc-guardar" class="zd-btn zd-btn--secondary" type="button" disabled>Guardar ventana</button>
    <button id="fresc-marcar" class="zd-btn zd-btn--secondary" type="button" disabled>Marcar réplica actualizada ahora</button>
  </div>
  <p id="fresc-aviso" class="ayuda" role="status"></p>

  <div class="zd-table-wrap zd-table-scroll"><table id="fresc-plantillas" class="zd-table"></table></div>
</section>
</section>
</main>
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
  'ejecucion:error-desconocido': 'La ejecución falló por un motivo no reconocido.',
  // CH-14: a failed send. The query itself ran; only the email did not go out. CH-18
  // (DEC-108): a send cut by the time limit may still have been accepted by the server,
  // so its copy says the email may have been delivered, never that it was not sent.
  'notificacion:tiempo-agotado': 'El servidor de correo no respondió dentro del tiempo permitido. La consulta se ejecutó, pero no se confirmó el envío: el correo puede haberse entregado.',
  'notificacion:servidor-inalcanzable': 'No se pudo conectar con el servidor de correo configurado. La consulta se ejecutó, pero el correo no se envió.',
  'notificacion:credenciales-invalidas': 'El servidor de correo rechazó las credenciales configuradas. La consulta se ejecutó, pero el correo no se envió.',
  'notificacion:envio-rechazado': 'El servidor de correo rechazó el mensaje o el destinatario. La consulta se ejecutó, pero el correo no se envió.',
  'notificacion:error-desconocido': 'El envío del correo falló por un motivo no reconocido. La consulta se ejecutó, pero el correo no se envió.'
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
  'plantilla-no-encontrada': 'La plantilla elegida ya no existe en el catálogo.',
  'conexion-no-encontrada': 'No existe una conexión registrada con ese identificador para el tenant activo.',
  'automatizacion-no-encontrada': 'Esa automatización ya no existe para el tenant activo. Se actualizó la lista.',
  'automatizacion-desactivada': 'Esa automatización ya estaba desactivada. Se actualizó la lista.'
};

// CH-21c (DEC-131): the template cards' description lives in the console, keyed by the
// template's automatizacion label; the catalog carries none. Any other label, a missing
// one included, gets the neutral sentence. No icon and no tolerance on the card.
var DESCRIPCIONES_PLANTILLA = {
  'stock-fisico': 'Avisa cuando un producto queda por debajo del mínimo.',
  'stock-producible': 'Avisa cuando los insumos no alcanzan para producir.'
};
var DESCRIPCION_NEUTRA = 'Plantilla del catálogo, sin descripción en la consola.';

// A run closed before dialing carries one of these closed categories instead of a
// {fase, categoria} pair from MENSAJES. The row never holds driver text (X2).
var MENSAJES_CORRIDA = {
  'vista-canonica-no-aprobada': 'La corrida se frenó antes de conectar. Entidades sin una validación de vista canónica aprobada:',
  'valores-invalidos': 'Los valores guardados ya no cumplen la declaración actual de la plantilla. No se conectó con el destino.',
  'conexion-no-encontrada': 'La conexión de la automatización ya no existe. No se conectó con el destino.',
  'credencial-ilegible': 'La credencial guardada de la conexión no se pudo descifrar. No se conectó con el destino.',
  'error-interno': 'La corrida falló por un error interno de la aplicación.',
  // CH-17a: an overlap skip (DEC-96) and a run closed by the boot sweep (DEC-99).
  'solapamiento': 'No se ejecutó: la corrida anterior de esta automatización seguía en curso.',
  'interrumpida': 'La corrida se interrumpió por un reinicio del servicio y no se volvió a ejecutar.'
};

// CH-17a (DEC-96): a label for the one estado that is not already a plain word. Any
// other estado is shown as it is, as before.
var ETIQUETAS_ESTADO = {
  'omitida': 'Omitida'
};

// CH-14 (DEC-83): one label per closed notificacion value. Anything else, null
// included, is the placeholder: a raw value never reaches the page. CH-18 (DEC-108):
// enviando marks a send in progress, and incierta a run interrupted during its send.
var ETIQUETAS_NOTIFICACION = {
  'enviada': 'Enviada',
  'omitida-sin-filas': 'No enviada: sin filas',
  'sin-destinatario': 'Sin destinatario',
  'no-configurada': 'Correo no configurado',
  'fallo-envio': 'Falló el envío',
  'enviando': 'Envío en curso',
  'incierta': 'Sin confirmar: puede haberse entregado'
};

var CLAVE_TENANT = 'zerodashboard.tenantActivo';

// Shared by pedir() and the wizard's Nueva: both refuse to act without an active tenant.
var SIN_TENANT = 'Elegí un tenant en la barra superior antes de operar. No se envió ninguna solicitud.';

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
var contenedorPlantillas = document.getElementById('auto-plantilla');
var contenedorValoresAuto = document.getElementById('auto-valores');
var selectorConexionAuto = document.getElementById('auto-conexion');
var entradaCron = document.getElementById('auto-cron');
var entradaDestinatario = document.getElementById('auto-destinatario');
var botonCrearAuto = document.getElementById('auto-crear');
var tablaAutomatizaciones = document.getElementById('auto-lista');
var tablaEjecuciones = document.getElementById('auto-ejecuciones');
var botonNuevaAuto = document.getElementById('auto-nueva');
var altaAuto = document.getElementById('auto-alta');
var marcaAlta1 = document.getElementById('auto-marca-1');
var marcaAlta2 = document.getElementById('auto-marca-2');
var pasoAlta1 = document.getElementById('auto-paso-1');
var pasoAlta2 = document.getElementById('auto-paso-2');
var avisoAlta = document.getElementById('auto-aviso');
var botonSiguienteAuto = document.getElementById('auto-siguiente');
var vistaAsunto = document.getElementById('auto-vista-asunto');
var vistaPara = document.getElementById('auto-vista-para');
var vistaTitulo = document.getElementById('auto-vista-titulo');
var botonCancelarAuto = document.getElementById('auto-cancelar');
var resumenAlta = document.getElementById('auto-resumen');
var botonVolverAuto = document.getElementById('auto-volver');
var selectorFrecuencia = document.getElementById('auto-frecuencia');
var entradaHora = document.getElementById('auto-hora');
var textoHorario = document.getElementById('auto-horario-texto');

// The template catalog by id, for naming each automation's plantilla in the list, and
// the value controls of the template chosen in the create form.
var nombresPlantilla = Object.create(null);
var filasValoresAuto = [];

// CH-21c: the catalog rows the picker draws its cards from, the chosen card's id ('' when
// none), and the template details read during this wizard, by id. Every reset empties the
// choice and the details.
var catalogoPlantillas = [];
var plantillaElegida = '';
var detallesPlantilla = Object.create(null);

// CH-21c: the wizard's stale-response token. Every reset (open, cancel, created, tenant
// switch) moves it, and a response that started under an older value is dropped.
var generacionAlta = 0;

// CH-21c (DEC-127): the availability probe's own token, moved by every connection change. A
// probe answer applies only while both tokens still hold. The card parts the probe edits
// are kept by template id, because the picker is rebuilt on every reset.
var generacionSondeo = 0;
var partesTarjeta = Object.create(null);

var pagina = { desplazamiento: 0, limite: 50, hayMas: false, siguiente: null, corte: null };

// The selected tenant lives here and nowhere else (DEC-15: explicit per request, no
// server session). Every call reads it through pedir() below.
var tenantActivo = null;

// CH-24: the rows GET /tenants returned, kept so the freshness section can read the active
// tenant's declaration without another request.
var tenantsCargados = [];

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
  mostrarFrescura();
}

function renderizarSelector(tenants) {
  tenantsCargados = tenants;
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
    respuesta = await fetch('/tenants').then(siNoAutenticado);
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
 * CH-29 (DEC-154): a 401 means the operator's session is gone (expired, logged out
 * elsewhere, or reset). Reloading lets the server serve the login screen; the promise
 * that never settles keeps every caller from rendering a failure in the meantime.
 */
function siNoAutenticado(respuesta) {
  if (respuesta.status === 401) {
    window.location.reload();
    return new Promise(function () {});
  }
  return respuesta;
}

/**
 * Every call to a tenant-scoped route goes through here. Returns null — and makes no
 * request at all — when no tenant is selected, so the operator sees "elegí un tenant"
 * instead of a 400 the API had to be bothered for.
 */
function pedir(url, opciones) {
  if (tenantActivo === null) {
    mostrarBanner(SIN_TENANT);
    return Promise.resolve(null);
  }

  var config = opciones || {};
  var cabeceras = {};
  if (config.headers) {
    Object.keys(config.headers).forEach(function (clave) { cabeceras[clave] = config.headers[clave]; });
  }
  cabeceras['X-Tenant-Id'] = tenantActivo;

  return fetch(url, { method: config.method, headers: cabeceras, body: config.body }).then(siNoAutenticado);
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
    cerrarVersiones();
    olvidarConsultaCargada();
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
// parameter instead of receiving an empty string it would have to interpret. Shared by
// the query editor and the automation form (CH-13): each entry is {nombre, tipo, valor}
// with valor the control itself.
function valoresDe(entradas) {
  // No prototype: a parameter may legally be called __proto__, and it must stay a key.
  var valores = Object.create(null);
  entradas.forEach(function (entrada) {
    var tipo = entrada.tipo;
    var crudo = tipo === 'texto' ? entrada.valor.value : entrada.valor.value.trim();
    if (crudo === '') { return; }
    var valor = crudo;
    if (tipo === 'booleano') { valor = crudo === 'true'; }
    // Not a finite number: the raw text is sent, and the server names the problem.
    if (tipo === 'numero' && Number.isFinite(Number(crudo))) { valor = Number(crudo); }
    valores[entrada.nombre] = valor;
  });
  return valores;
}

function valoresActuales() {
  return valoresDe(filasParametros.map(function (fila) {
    return { nombre: fila.nombre.value.trim(), tipo: fila.tipo.value, valor: fila.valor };
  }));
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

// CH-20 (DEC-161): the run names the loaded saved query, by id and version, only while the
// editor still holds its statement exactly; the server checks it again against the stored
// version, and any edit makes the run ad hoc.
function cuerpoDeEjecucion(limite, desplazamiento, declaracion) {
  var cuerpo = {
    conexionId: entradaConexion.value.trim(),
    sql: entradaSql.value,
    parametros: declaracion,
    valores: valoresActuales(),
    limite: limite,
    desplazamiento: desplazamiento
  };
  if (consultaCargada !== null && typeof consultaCargada.version === 'number' && entradaSql.value === consultaCargada.sql) {
    cuerpo.consultaGuardadaId = consultaCargada.id;
    cuerpo.version = consultaCargada.version;
  }
  return cuerpo;
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
      body: JSON.stringify(cuerpoDeEjecucion(limite, desplazamiento, declaracion))
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

    // CH-25: the history of this query, in the panel below the list.
    var botonVersiones = document.createElement('button');
    botonVersiones.type = 'button';
    botonVersiones.textContent = 'Versiones';
    botonVersiones.addEventListener('click', function () { abrirVersiones(fila); });
    item.appendChild(botonVersiones);

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
    olvidarConsultaCargada();
    await listarGuardadas();
    return;
  }
  if (respuesta.status !== 200) {
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }

  // CH-25: the name and description come into their fields too, so an edit sends them as
  // the operator sees them, and the loaded query is remembered for "Guardar como nueva versión".
  entradaNombre.value = String(cuerpo.consultaGuardada.nombre);
  entradaDescripcion.value = cuerpo.consultaGuardada.descripcion === null || cuerpo.consultaGuardada.descripcion === undefined
    ? '' : String(cuerpo.consultaGuardada.descripcion);
  recordarConsultaCargada(cuerpo.consultaGuardada);

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
// Every call goes through pedir(), the template catalog included although it is
// exempt: the section belongs to the active tenant and has nothing to show without one.
// Every value below reaches the page through textContent, as everywhere else.

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
  catalogoPlantillas = [];
  nombresPlantilla = Object.create(null);
  // The wizard goes too, values and all: nothing typed for one tenant survives the switch.
  cerrarAlta();
  // The freshness table is drawn from the catalog just emptied.
  mostrarFrescura();
}

// --- Creation wizard (CH-21c, DEC-129) ------------------------------------------
// Two static panels and a static stepper. The script only flips hidden and the step
// markers' aria-current; no class is assigned here and no markup is written.

// Siguiente needs a connection and a chosen template; the values have their own
// legible server-side errors on step 2.
function actualizarSiguiente() {
  botonSiguienteAuto.disabled = selectorConexionAuto.value === '' || plantillaElegida === '';
}

function mostrarAviso(texto) {
  avisoAlta.textContent = texto;
  avisoAlta.hidden = false;
}

function ocultarAviso() {
  avisoAlta.textContent = '';
  avisoAlta.hidden = true;
}

// DEC-129: each preset is a day-of-week set; the minute and the hour come from the hour
// control. Built by concatenation and character checks only: no pattern literal can live
// in this page without doubled escapes.
var DIAS_FRECUENCIA = { 'diaria': '*', 'lun-vie': '1-5', 'lun-sab': '1-6' };
var NOMBRES_FRECUENCIA = { 'diaria': 'Todos los días', 'lun-vie': 'De lunes a viernes', 'lun-sab': 'De lunes a sábado' };
var DIGITOS = '0123456789';
var ZONA_DEL_DESPLIEGUE = 'en la zona horaria configurada del despliegue';

// {h, m} for exactly HH:MM in 24 hours, otherwise null. The time control is not trusted:
// every character is checked here, whatever the browser let through.
function horaDe(texto) {
  if (typeof texto !== 'string' || texto.length !== 5 || texto.charAt(2) !== ':') { return null; }
  for (var i = 0; i < 5; i++) {
    if (i !== 2 && DIGITOS.indexOf(texto.charAt(i)) === -1) { return null; }
  }
  var h = Number(texto.slice(0, 2));
  var m = Number(texto.slice(3));
  return h <= 23 && m <= 59 ? { h: h, m: m } : null;
}

// 'M H * * dias' with no leading zeros, or null for an invalid hour or an unknown preset.
function cronDeFrecuencia(frecuencia, texto) {
  var hora = horaDe(texto);
  if (hora === null || !Object.prototype.hasOwnProperty.call(DIAS_FRECUENCIA, frecuencia)) { return null; }
  return hora.m + ' ' + hora.h + ' * * ' + DIAS_FRECUENCIA[frecuencia];
}

// The cron field is never hidden: a preset makes it read-only and writes its translation
// (empty for an invalid hour); Personalizado makes it editable and leaves what it holds.
function actualizarHorario() {
  var frecuencia = selectorFrecuencia.value;
  var personalizado = frecuencia === 'personalizado';
  entradaCron.readOnly = !personalizado;
  entradaHora.disabled = personalizado;
  if (personalizado) {
    textoHorario.textContent = 'Expresión cron estándar de cinco campos, ' + ZONA_DEL_DESPLIEGUE + '. Se valida al crear.';
    return;
  }
  var cron = cronDeFrecuencia(frecuencia, entradaHora.value);
  entradaCron.value = cron === null ? '' : cron;
  textoHorario.textContent = cron === null ? 'Elegí una hora válida (HH:MM, 24 horas).'
    : NOMBRES_FRECUENCIA[frecuencia] + ' a las ' + entradaHora.value + ', ' + ZONA_DEL_DESPLIEGUE + '.';
}

// dd/mm/aaaa HH:MM of a server instant, in the zone the server named. A zone or an
// instant this browser cannot resolve (RangeError) shows the instant as it came.
function formatearInstante(iso, zona) {
  try {
    var partes = Object.create(null);
    new Intl.DateTimeFormat('es-AR', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).forEach(function (parte) {
      partes[parte.type] = parte.value;
    });
    return partes.day + '/' + partes.month + '/' + partes.year + ' ' + partes.hour + ':' + partes.minute;
  } catch (noResuelto) {
    return iso;
  }
}

// DEC-129 (P1): the first run and the zone are the server's, from the 201; a body without
// them (a server before CH-21c) keeps the former sentence. DEC-95: a schedule, not a promise.
function confirmacionDeAlta(cuerpo) {
  var creada = 'Se creó la automatización y ya aparece en la lista.';
  if (typeof cuerpo.proximaEjecucion !== 'string' || typeof cuerpo.zonaHoraria !== 'string') { return creada; }
  return creada + ' Primera ejecución programada: ' + formatearInstante(cuerpo.proximaEjecucion, cuerpo.zonaHoraria) +
    ', zona horaria ' + cuerpo.zonaHoraria + '. Es un horario, no una garantía: si el servicio no está en marcha a esa hora, esa ejecución no se recupera.';
}

function opcionDe(valor, texto) {
  var opcion = document.createElement('option');
  opcion.value = valor;
  opcion.textContent = texto;
  return opcion;
}

// Rebuilds the connection dropdown as text only (regla 7): the '' placeholder, then one
// option per row. The short id tells apart connections that share a name (the T4 idiom).
function renderizarConexiones(filas, textoVacio) {
  vaciar(selectorConexionAuto);
  selectorConexionAuto.appendChild(opcionDe('', textoVacio));
  filas.forEach(function (fila) {
    var id = String(fila.id);
    selectorConexionAuto.appendChild(opcionDe(id, String(fila.nombre) + ' (' + id.slice(0, 8) + '…)'));
  });
  selectorConexionAuto.value = '';
}

// DEC-132: asked each time the wizard opens, never on tenant load, so that load stays at
// three requests. A failure leaves step 1 open with only the placeholder; Cancelar and
// reopening retry.
async function cargarConexiones() {
  var g = generacionAlta;
  var resultado = await pedirAutomatizacion('/conexiones');
  // Dropped when the wizard was reset meanwhile (cancelled, reopened or a tenant switch).
  if (g !== generacionAlta) { return; }
  if (resultado !== null && resultado.status !== 200) { mostrarRechazo(resultado); }
  if (resultado === null || resultado.status !== 200) {
    mostrarAviso('No se pudieron cargar las conexiones. Cancelá y volvé a abrir el alta para reintentar.');
    return;
  }
  var filas = Array.isArray(resultado.cuerpo.conexiones) ? resultado.cuerpo.conexiones : [];
  renderizarConexiones(filas, filas.length === 0 ? 'No hay conexiones registradas' : 'Elegí una conexión');
  if (filas.length === 0) {
    mostrarAviso('Este tenant no tiene conexiones registradas. Registrá una para poder crear una automatización.');
  } else if (resultado.cuerpo.truncado === true) {
    mostrarAviso('Se muestran solo las primeras ' + filas.length + ' conexiones, en orden alfabético.');
  }
  actualizarSiguiente();
}

function marcarPaso(marca, actual) {
  if (actual) { marca.setAttribute('aria-current', 'step'); } else { marca.removeAttribute('aria-current'); }
}

function irAPaso(n) {
  pasoAlta1.hidden = n !== 1;
  pasoAlta2.hidden = n !== 2;
  marcarPaso(marcaAlta1, n === 1);
  marcarPaso(marcaAlta2, n === 2);
}

// Empties every wizard field and moves the token, so a response still in flight for
// the previous wizard lands nowhere.
function reiniciarAlta() {
  generacionAlta += 1;
  plantillaElegida = '';
  detallesPlantilla = Object.create(null);
  // Fresh cards, none chosen: from the catalog of the tenant now active, or none at all.
  renderizarPicker();
  vaciar(contenedorValoresAuto);
  filasValoresAuto = [];
  // Options and choice both go: no connection of the previous tenant stays selectable.
  renderizarConexiones([], 'Elegí una conexión');
  // The schedule goes back to the markup's start: every day at 08:00, cron read-only.
  selectorFrecuencia.value = 'diaria';
  entradaHora.value = '08:00';
  actualizarHorario();
  entradaDestinatario.value = '';
  vistaAsunto.textContent = '';
  vistaPara.textContent = '';
  vistaTitulo.textContent = '';
  resumenAlta.textContent = '';
  avisoAlta.textContent = '';
  avisoAlta.hidden = true;
  actualizarSiguiente();
}

function abrirAlta() {
  if (tenantActivo === null) {
    mostrarBanner(SIN_TENANT);
    return;
  }
  ocultarBanner();
  reiniciarAlta();
  altaAuto.hidden = false;
  botonNuevaAuto.hidden = true;
  irAPaso(1);
  cargarConexiones();
}

function cerrarAlta() {
  altaAuto.hidden = true;
  reiniciarAlta();
  botonNuevaAuto.hidden = false;
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

// CH-21c (DEC-131): one card per catalog row, text only (regla 7). The label wraps a
// radio of one shared name, so a click on the card and the arrow keys both choose it;
// the shared sheet hides the radio and draws the checked and focused states.
function tarjetaPlantilla(fila) {
  var tarjeta = document.createElement('label');
  tarjeta.className = 'zd-template';
  var radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'auto-plantilla-opcion';
  radio.value = fila.id;
  radio.addEventListener('change', function () {
    if (radio.checked) { elegirPlantilla(fila.id); }
  });
  var nombre = document.createElement('span');
  nombre.className = 'zd-template__name';
  nombre.textContent = fila.nombre;
  // String() makes a missing label 'undefined', and the own-key test keeps 'constructor'
  // and every other prototype name out: both get the neutral sentence, never a throw.
  var etiqueta = String(fila.automatizacion);
  var descripcion = document.createElement('span');
  descripcion.className = 'zd-template__desc';
  descripcion.textContent = Object.prototype.hasOwnProperty.call(DESCRIPCIONES_PLANTILLA, etiqueta)
    ? DESCRIPCIONES_PLANTILLA[etiqueta] : DESCRIPCION_NEUTRA;
  // DEC-127: empty and hidden until the chosen connection cannot run this template.
  var motivo = document.createElement('span');
  motivo.className = 'motivo-plantilla';
  motivo.hidden = true;
  partesTarjeta[fila.id] = { radio: radio, motivo: motivo };
  tarjeta.appendChild(radio);
  tarjeta.appendChild(nombre);
  tarjeta.appendChild(descripcion);
  tarjeta.appendChild(motivo);
  return tarjeta;
}

function renderizarPicker() {
  vaciar(contenedorPlantillas);
  partesTarjeta = Object.create(null);
  catalogoPlantillas.forEach(function (fila) {
    contenedorPlantillas.appendChild(tarjetaPlantilla(fila));
  });
}

async function cargarCatalogoPlantillas() {
  var resultado = await pedirAutomatizacion('/plantillas');
  if (resultado === null) { return; }
  if (resultado.status !== 200) { mostrarRechazo(resultado); return; }
  nombresPlantilla = Object.create(null);
  catalogoPlantillas = (Array.isArray(resultado.cuerpo.plantillas) ? resultado.cuerpo.plantillas : []).map(function (fila) {
    nombresPlantilla[fila.id] = String(fila.nombre);
    // CH-24: the tolerance rides along for the freshness table; the picker ignores it.
    return { id: String(fila.id), nombre: String(fila.nombre), automatizacion: fila.automatizacion, tolerancia: fila.toleranciaFrescuraMinutos };
  });
  renderizarPicker();
  mostrarFrescura();
}

// The chosen template's declaration becomes one value control per parameter, built by
// controlDeValor exactly as the query editor builds them. A detail already read in this
// wizard is reused; otherwise it is asked for once.
async function elegirPlantilla(id) {
  var g = generacionAlta;
  plantillaElegida = id;
  actualizarSiguiente();
  vaciar(contenedorValoresAuto);
  filasValoresAuto = [];
  var detalle = detallesPlantilla[id];
  if (detalle === undefined) {
    var resultado = await pedirAutomatizacion('/plantillas/' + encodeURIComponent(id));
    // Any wizard reset in between (a tenant switch included) drops the answer.
    if (resultado === null || g !== generacionAlta) { return; }
    if (resultado.status === 200) { detallesPlantilla[id] = resultado.cuerpo.plantilla; }
    // A later choice made while this one was in flight wins.
    if (plantillaElegida !== id) { return; }
    if (resultado.status !== 200) { mostrarRechazo(resultado); return; }
    detalle = resultado.cuerpo.plantilla;
  }
  var parametros = detalle.parametros;
  (Array.isArray(parametros) ? parametros : []).forEach(function (parametro) {
    var entrada = { nombre: String(parametro.nombre), tipo: String(parametro.tipo), valor: controlDeValor(String(parametro.tipo)) };
    contenedorValoresAuto.appendChild(rotular(entrada.nombre, entrada.valor));
    filasValoresAuto.push(entrada);
  });
}

// --- Template availability (CH-21c, DEC-127) ---------------------------------------
// Advisory only: nothing here is sent to the server, and the run-time view gate stays the
// authority. Cards the chosen connection cannot run are disabled, each with its reason.

var MOTIVOS_VISTA = { 'no-mapeada': 'sin vista registrada', 'no-validado': 'vista sin validar', 'invalida': 'la validación de la vista falló' };
var AVISO_SIN_SONDEO = 'No se pudo verificar el mapeo de esta conexión. Las plantillas quedan habilitadas; la compuerta de vistas se aplica igual en cada ejecución.';

// Mirror of the server's evaluarVistas: a declared entity blocks unless the report says
// valida, and a row missing from the contract-ordered report is no-mapeada there already.
function entidadesNoAprobadas(declaradas, informe) {
  return informe.filter(function (fila) {
    return declaradas.indexOf(fila.entidad) !== -1 && fila.estado !== 'valida';
  }).map(function (fila) { return { entidad: fila.entidad, estado: fila.estado }; });
}

function motivoDeVistas(bloqueadas) {
  return 'No disponible con esta conexión: ' + bloqueadas.map(function (fila) {
    var palabras = Object.prototype.hasOwnProperty.call(MOTIVOS_VISTA, fila.estado) ? MOTIVOS_VISTA[fila.estado] : 'vista no aprobada';
    return fila.entidad + ' (' + palabras + ')';
  }).join(', ') + '. Cada ejecución se frenaría antes de conectar.';
}

function entidadesDe(detalle) {
  return detalle !== null && typeof detalle === 'object' && Array.isArray(detalle.entidades) ? detalle.entidades : null;
}

// One reason per blocked template id (a null-prototype map, '' or absent when it can run).
// A chosen template that is now blocked is unchosen, with its values.
function aplicarVeredictos(veredictos) {
  catalogoPlantillas.forEach(function (fila) {
    var partes = partesTarjeta[fila.id];
    if (partes === undefined) { return; }
    var motivo = veredictos[fila.id] || '';
    partes.radio.disabled = motivo !== '';
    partes.motivo.textContent = motivo;
    partes.motivo.hidden = motivo === '';
  });
  if (plantillaElegida !== '' && veredictos[plantillaElegida]) {
    if (partesTarjeta[plantillaElegida] !== undefined) { partesTarjeta[plantillaElegida].radio.checked = false; }
    plantillaElegida = '';
    vaciar(contenedorValoresAuto);
    filasValoresAuto = [];
  }
  actualizarSiguiente();
}

// Runs on every connection change. The report is read first, then each template's detail in
// catalog order (the one cached for the step-2 controls when present). Any answer that is
// missing or malformed leaves the cards it concerns enabled and says so.
async function sondearConexion() {
  var g = generacionAlta;
  generacionSondeo += 1;
  var s = generacionSondeo;
  aplicarVeredictos(Object.create(null));
  ocultarAviso();
  var conexion = selectorConexionAuto.value;
  if (conexion === '') { return; }
  mostrarAviso('Verificando las vistas canónicas de la conexión elegida…');
  var lectura = await pedirAutomatizacion('/conexiones/' + encodeURIComponent(conexion) + '/validacion-mapeo');
  if (g !== generacionAlta || s !== generacionSondeo) { return; }
  var mapeo = lectura !== null && lectura.status === 200 ? lectura.cuerpo.validacionMapeo : null;
  var informe = mapeo !== null && typeof mapeo === 'object' ? mapeo.entidades : null;
  var informeValido = Array.isArray(informe) && informe.every(function (fila) { return fila !== null && typeof fila === 'object'; });
  var incompleto = !informeValido;
  var veredictos = Object.create(null);
  for (var i = 0; informeValido && i < catalogoPlantillas.length; i++) {
    var id = catalogoPlantillas[i].id;
    var detalle = detallesPlantilla[id];
    if (detalle === undefined) {
      var respuesta = await pedirAutomatizacion('/plantillas/' + encodeURIComponent(id));
      if (g !== generacionAlta || s !== generacionSondeo) { return; }
      detalle = respuesta !== null && respuesta.status === 200 ? respuesta.cuerpo.plantilla : null;
      if (entidadesDe(detalle) !== null) { detallesPlantilla[id] = detalle; }
    }
    var declaradas = entidadesDe(detalle);
    if (declaradas === null) { incompleto = true; continue; }
    var bloqueadas = entidadesNoAprobadas(declaradas, informe);
    if (bloqueadas.length > 0) { veredictos[id] = motivoDeVistas(bloqueadas); }
  }
  aplicarVeredictos(veredictos);
  if (incompleto) { mostrarAviso(AVISO_SIN_SONDEO); } else { ocultarAviso(); }
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
      var nombre = nombresPlantilla[fila.plantillaId];
      return [nombre === undefined ? String(fila.plantillaId) : nombre, String(fila.conexionId),
        String(fila.cron), fila.activo === true ? 'activa' : 'desactivada', String(fila.creadaEn), acciones];
    }),
    'automatizacion',
    resultado.cuerpo.truncado ? 'Se muestran solo las ' + filas.length + ' automatizaciones más recientes.' : null
  );
}

async function cargarAutomatizaciones() {
  await cargarCatalogoPlantillas();
  await listarAutomatizaciones();
}

async function crearAutomatizacion() {
  ocultarBanner();
  // A preset's cron is rebuilt from the hour as it is now; an invalid hour sends nothing.
  actualizarHorario();
  if (selectorFrecuencia.value !== 'personalizado' && cronDeFrecuencia(selectorFrecuencia.value, entradaHora.value) === null) {
    mostrarBanner('La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30.');
    return;
  }
  botonCrearAuto.disabled = true;
  var g = generacionAlta;
  // No tenant here: the header names it (DEC-15), and the route refuses one in the body.
  var alta = {
    plantillaId: plantillaElegida,
    conexionId: selectorConexionAuto.value,
    valores: valoresDe(filasValoresAuto),
    cron: entradaCron.value.trim()
  };
  // CH-14: the recipient is optional; a blank one is not sent at all.
  var destinatario = entradaDestinatario.value.trim();
  if (destinatario !== '') { alta.destinatario = destinatario; }
  var resultado = await pedirAutomatizacion('/automatizaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alta)
  });
  botonCrearAuto.disabled = false;
  // Dropped when the wizard was reset meanwhile (a tenant switch): it no longer exists.
  if (resultado === null || g !== generacionAlta) { return; }
  // A 400 leaves the wizard on step 2 with every value as typed.
  if (resultado.status === 400) {
    var campos = Array.isArray(resultado.cuerpo.campos) ? resultado.cuerpo.campos : [];
    mostrarBanner(campos.indexOf('/cron') !== -1
      ? 'El horario no es una expresión cron estándar de cinco campos (minuto hora día-del-mes mes día-de-la-semana).'
      : campos.indexOf('/destinatario') !== -1
        ? 'El correo del destinatario no es válido. Escriba una sola dirección, por ejemplo operaciones@empresa.com, sin espacios, comas ni punto y coma.'
        : mensajeDeSolicitudInvalida(resultado.cuerpo, []));
    return;
  }
  if (resultado.status !== 201) { mostrarRechazo(resultado); return; }
  cerrarAlta();
  mostrarConfirmacion(confirmacionDeAlta(resultado.cuerpo));
  await listarAutomatizaciones();
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
  if (!fila.codigoError) { return texto; }
  // CH-14: a failed send carries an SMTP reply code, never a SQLSTATE.
  return texto + (fila.fase === 'notificacion' ? ' (código SMTP ' : ' (SQLSTATE ') + fila.codigoError + ')';
}

function etiquetaNotificacion(valor) {
  return Object.prototype.hasOwnProperty.call(ETIQUETAS_NOTIFICACION, valor) ? ETIQUETAS_NOTIFICACION[valor] : '—';
}

function etiquetaEstado(valor) {
  return Object.prototype.hasOwnProperty.call(ETIQUETAS_ESTADO, valor) ? ETIQUETAS_ESTADO[valor] : String(valor);
}

async function verEjecuciones(id) {
  ocultarBanner();
  var resultado = await pedirAutomatizacion('/automatizaciones/' + encodeURIComponent(id) + '/ejecuciones');
  if (resultado === null) { return; }
  if (resultado.status !== 200) { mostrarRechazo(resultado); await listarAutomatizaciones(); return; }
  var filas = Array.isArray(resultado.cuerpo.ejecuciones) ? resultado.cuerpo.ejecuciones : [];
  renderizarTabla(
    tablaEjecuciones,
    // CH-17b: Intentos goes last so every existing column keeps its position (DEC-103).
    ['Inicio', 'Fin', 'Duración (ms)', 'Filas', 'Estado', 'Notificación', 'Error', 'Intentos'],
    filas.map(function (fila) {
      var cantidad = textoOpcional(fila.filas) + (fila.corte === 'tope-de-filas' ? ' (cortado en el tope)' : '');
      return [String(fila.iniciadaEn), textoOpcional(fila.finalizadaEn), textoOpcional(fila.duracionMs),
        cantidad, etiquetaEstado(fila.estado), etiquetaNotificacion(fila.notificacion), errorDeCorrida(fila),
        textoOpcional(fila.intentos)];
    }),
    'ejecucion',
    filas.length === 0 ? 'Esta automatización todavía no tiene ejecuciones.'
      : resultado.cuerpo.truncado ? 'Se muestran solo las ' + filas.length + ' ejecuciones más recientes.' : null
  );
}

// --- Freshness (CH-24, DEC-142 to DEC-145, screen C-22) --------------------------
// What the implementer declared for the active tenant, next to each template's tolerance.
// Declare and show only: nothing here changes a run. The tenant rows come from GET /tenants
// (kept by renderizarSelector) and the tolerances from the catalog the automations section
// already reads, so a tenant switch costs no request of its own. Every value reaches the
// page through textContent, and the state badge takes its look from the page's bridge style.
var LIMITE_VENTANA = 525600;
var SIN_DECLARAR = 'Sin declarar';
var MENSAJE_VENTANA = 'La ventana tiene que ser un número entero de minutos, entre 0 y ' + LIMITE_VENTANA +
  ', o quedar vacía para volver a "sin declarar".';
var DIGITOS_VENTANA = '0123456789';
var textoVentana = document.getElementById('fresc-ventana');
var textoReplica = document.getElementById('fresc-actualizada');
var entradaVentana = document.getElementById('fresc-minutos');
var botonVentana = document.getElementById('fresc-guardar');
var botonMarcar = document.getElementById('fresc-marcar');
var avisoFrescura = document.getElementById('fresc-aviso');
var tablaFrescura = document.getElementById('fresc-plantillas');

var ETIQUETAS_FRESCURA = { 'al-dia': 'Al día', 'desactualizada': 'Desactualizada', 'sin-declarar': SIN_DECLARAR };
var ICONOS_FRESCURA = {
  'al-dia': [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'm9 12 2 2 4-4' }]],
  'desactualizada': [
    ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }],
    ['path', { d: 'M12 9v4' }],
    ['path', { d: 'M12 17h.01' }]
  ],
  'sin-declarar': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }],
    ['path', { d: 'M12 17h.01' }]
  ]
};

// The client twin of evaluarFrescura in src/frescura.ts, pinned by the same vectors: an
// undeclared window is its own state, and a window equal to the tolerance is still al-dia.
function estadoFrescura(ventana, tolerancia) {
  if (ventana === null || ventana === undefined) { return 'sin-declarar'; }
  return ventana > tolerancia ? 'desactualizada' : 'al-dia';
}

// "hace 3 h 10 min". An instant in the future (clock skew) reads as just now, never negative.
function hace(iso, ahoraMs) {
  var instante = Date.parse(iso);
  if (isNaN(instante)) { return SIN_DECLARAR; }
  var segundos = Math.floor((ahoraMs - instante) / 1000);
  if (segundos < 60) { return 'hace unos segundos'; }
  var minutos = Math.floor(segundos / 60);
  if (minutos < 60) { return 'hace ' + minutos + ' min'; }
  var horas = Math.floor(minutos / 60);
  var resto = minutos % 60;
  if (horas < 24) { return 'hace ' + horas + ' h' + (resto === 0 ? '' : ' ' + resto + ' min'); }
  return 'hace ' + Math.floor(horas / 24) + ' d';
}

function iconoDeEstado(clave) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icono-frescura');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  ICONOS_FRESCURA[clave].forEach(function (forma) {
    var trazo = document.createElementNS('http://www.w3.org/2000/svg', forma[0]);
    Object.keys(forma[1]).forEach(function (atributo) { trazo.setAttribute(atributo, forma[1][atributo]); });
    svg.appendChild(trazo);
  });
  return svg;
}

function insignia(clave) {
  var nodo = document.createElement('span');
  nodo.className = 'estado-frescura estado-frescura--' + clave;
  nodo.appendChild(iconoDeEstado(clave));
  var texto = document.createElement('span');
  texto.textContent = ETIQUETAS_FRESCURA[clave];
  nodo.appendChild(texto);
  return nodo;
}

function filaDeTenant(id) {
  for (var i = 0; i < tenantsCargados.length; i++) {
    if (String(tenantsCargados[i].id) === id) { return tenantsCargados[i]; }
  }
  return null;
}

function ventanaDe(fila) {
  return typeof fila.ventanaDesactualizacionMinutos === 'number' ? fila.ventanaDesactualizacionMinutos : null;
}

function reemplazarTenant(nuevo) {
  for (var i = 0; i < tenantsCargados.length; i++) {
    if (String(tenantsCargados[i].id) === String(nuevo.id)) { tenantsCargados[i] = nuevo; }
  }
}

function renderizarFrescura(ventana) {
  renderizarTabla(tablaFrescura, ['Plantilla', 'Tolerancia (min)', 'Estado'],
    catalogoPlantillas.map(function (fila) {
      if (typeof fila.tolerancia !== 'number') { return [fila.nombre, '—', '—']; }
      return [fila.nombre, String(fila.tolerancia), insignia(estadoFrescura(ventana, fila.tolerancia))];
    }), 'frescura', null);
}

// Redraws the whole section from the kept rows. Called on every tenant change, when the
// catalog arrives and after a save, so it never shows another tenant's declaration.
function mostrarFrescura() {
  var fila = tenantActivo === null ? null : filaDeTenant(tenantActivo);
  var habilitado = fila !== null;
  entradaVentana.disabled = !habilitado;
  botonVentana.disabled = !habilitado;
  botonMarcar.disabled = !habilitado;
  avisoFrescura.textContent = '';
  if (!habilitado) {
    textoVentana.textContent = 'Elegí un tenant para ver su frescura.';
    textoReplica.textContent = '';
    entradaVentana.value = '';
    vaciar(tablaFrescura);
    return;
  }
  var ventana = ventanaDe(fila);
  textoVentana.textContent = 'Ventana de desactualización: ' + (ventana === null ? SIN_DECLARAR : ventana + ' min') + '.';
  var replica = fila.replicaActualizadaEn;
  textoReplica.textContent = 'Última actualización de la réplica: ' +
    (typeof replica === 'string' ? hace(replica, Date.now()) : SIN_DECLARAR) + '.';
  entradaVentana.value = ventana === null ? '' : String(ventana);
  renderizarFrescura(ventana);
}

// Digits only, otherwise the raw text goes up and the server refuses it: a number control or
// a lenient parse would turn "abc" into an empty value and clear the declaration by accident.
function ventanaEscrita() {
  var texto = entradaVentana.value.trim();
  if (texto === '') { return null; }
  for (var i = 0; i < texto.length; i++) {
    if (DIGITOS_VENTANA.indexOf(texto.charAt(i)) === -1) { return texto; }
  }
  return Number(texto);
}

async function guardarFrescura(cuerpo) {
  if (tenantActivo === null) { return; }
  var id = tenantActivo;
  botonVentana.disabled = true;
  botonMarcar.disabled = true;
  // The path names the tenant (the route is exempt from the header) and pedir() sends the
  // header anyway, as for the catalog: the section belongs to the active tenant.
  var resultado = await pedirAutomatizacion('/tenants/' + encodeURIComponent(id) + '/frescura', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  // A tenant switch while the request was in flight owns the section now.
  if (id !== tenantActivo) { return; }
  if (resultado !== null && resultado.status === 200 && resultado.cuerpo.tenant) {
    reemplazarTenant(resultado.cuerpo.tenant);
    mostrarFrescura();
    avisoFrescura.textContent = 'Guardado.';
    return;
  }
  // A refusal keeps the previous declaration on screen.
  mostrarFrescura();
  if (resultado !== null) {
    avisoFrescura.textContent = resultado.status === 400 ? MENSAJE_VENTANA
      : 'La aplicación respondió HTTP ' + resultado.status + '.';
  }
}

botonVentana.addEventListener('click', function () {
  guardarFrescura({ ventanaMinutos: ventanaEscrita() });
});

botonMarcar.addEventListener('click', function () {
  guardarFrescura({ actualizadaAhora: true });
});

// --- Versions (CH-25, DEC-146 to DEC-150, screen C-05) ---------------------------
// The history of one saved query: list, plain-text comparison with the current version
// (no diff is computed, DEC-149) and restore, which never deletes: it creates a new version
// (DEC-147). Every call goes through pedirAutomatizacion, so the tenant header and the
// tenant refusals are handled in one place. Values reach the page through textContent, and
// no shared class is assigned here: the look comes from the page's bridge style.
var panelVersiones = document.getElementById('versiones');
var tituloVersiones = document.getElementById('versiones-titulo');
var estadoVersiones = document.getElementById('versiones-estado');
var listaVersiones = document.getElementById('versiones-lista');
var comparacionVersiones = document.getElementById('versiones-comparacion');
var botonCerrarVersiones = document.getElementById('versiones-cerrar');

// The query whose panel is open ({ id, nombre, vigente }), and the token that makes a
// response from an older open, a closed panel or another tenant drop itself.
var consultaAbierta = null;
var generacionVersiones = 0;

var MENSAJES_VERSIONES = {
  'consulta-guardada-no-encontrada': 'Esa consulta guardada ya no existe. Se actualizó la lista.',
  'version-no-encontrada': 'Esa versión ya no existe. Se actualizó el historial.',
  'version-vigente': 'Esa ya es la versión vigente: no hay nada que restaurar.',
  'conflicto-de-edicion': 'Otra edición se guardó antes. Se actualizó el historial; volvé a intentarlo.',
  'solicitud-invalida': 'La nota no es válida: tiene que ser un texto de hasta 500 caracteres.'
};

function mensajeDeVersiones(resultado) {
  var error = resultado.cuerpo.error;
  return Object.prototype.hasOwnProperty.call(MENSAJES_VERSIONES, error)
    ? MENSAJES_VERSIONES[error] : 'La aplicación respondió HTTP ' + resultado.status + '.';
}

function rutaVersiones(id, numero) {
  return '/consultas-guardadas/' + encodeURIComponent(id) + '/versiones' +
    (numero === undefined ? '' : '/' + encodeURIComponent(numero));
}

function cerrarVersiones() {
  generacionVersiones += 1;
  consultaAbierta = null;
  panelVersiones.hidden = true;
  tituloVersiones.textContent = '';
  estadoVersiones.textContent = '';
  vaciar(listaVersiones);
  vaciar(comparacionVersiones);
}

function insigniaVigente() {
  var nodo = document.createElement('span');
  nodo.className = 'version-vigente';
  nodo.appendChild(iconoDeEstado('al-dia'));
  var texto = document.createElement('span');
  texto.textContent = 'Vigente';
  nodo.appendChild(texto);
  return nodo;
}

// "Parámetros: umbral (numero), dias (numero)", or a plain statement that there are none.
function textoDeParametros(parametros) {
  var lista = Array.isArray(parametros) ? parametros : [];
  if (lista.length === 0) { return 'Parámetros: ninguno.'; }
  return 'Parámetros: ' + lista.map(function (p) { return String(p.nombre) + ' (' + String(p.tipo) + ')'; }).join(', ') + '.';
}

function bloqueDeVersion(version) {
  var bloque = document.createElement('div');
  bloque.className = 'versiones-bloque';
  var titulo = document.createElement('strong');
  titulo.textContent = 'Versión ' + version.version + (version.esActual === true ? ' (vigente)' : '');
  bloque.appendChild(titulo);
  [
    'Nombre: ' + String(version.nombre),
    'Descripción: ' + (version.descripcion === null || version.descripcion === undefined ? '—' : String(version.descripcion)),
    textoDeParametros(version.parametros)
  ].forEach(function (linea) {
    var parrafo = document.createElement('p');
    parrafo.className = 'ayuda';
    parrafo.textContent = linea;
    bloque.appendChild(parrafo);
  });
  var sentencia = document.createElement('pre');
  sentencia.textContent = String(version.sql);
  bloque.appendChild(sentencia);
  return bloque;
}

// Compare: the chosen version and the current one, side by side as text. Two requests, in
// that order; a response that arrives after the panel changed is dropped.
async function compararVersion(numero) {
  var g = generacionVersiones;
  var consulta = consultaAbierta;
  vaciar(comparacionVersiones);
  estadoVersiones.textContent = 'Cargando la comparación…';
  var elegida = await pedirAutomatizacion(rutaVersiones(consulta.id, numero));
  var actual = elegida !== null && elegida.status === 200
    ? await pedirAutomatizacion(rutaVersiones(consulta.id, consulta.vigente)) : null;
  if (g !== generacionVersiones) { return; }
  if (elegida === null || elegida.status !== 200) {
    estadoVersiones.textContent = elegida === null ? 'No se pudo leer la versión.' : mensajeDeVersiones(elegida);
    return;
  }
  if (actual === null || actual.status !== 200) {
    estadoVersiones.textContent = actual === null ? 'No se pudo leer la versión vigente.' : mensajeDeVersiones(actual);
    return;
  }
  estadoVersiones.textContent = '';
  var bloques = document.createElement('div');
  bloques.className = 'versiones-bloques';
  bloques.appendChild(bloqueDeVersion(elegida.cuerpo.version));
  bloques.appendChild(bloqueDeVersion(actual.cuerpo.version));
  comparacionVersiones.appendChild(bloques);
}

// Restore: creates version N+1 with the content of the chosen one and reloads the panel and
// the list. A refusal keeps the rows and says why.
async function restaurarVersion(numero, nota) {
  var g = generacionVersiones;
  var consulta = consultaAbierta;
  var cuerpo = nota === '' ? {} : { nota: nota };
  var resultado = await pedirAutomatizacion(rutaVersiones(consulta.id, numero) + '/restaurar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  if (g !== generacionVersiones || resultado === null) { return; }
  if (resultado.status !== 200) {
    estadoVersiones.textContent = mensajeDeVersiones(resultado);
    if (resultado.cuerpo.error === 'consulta-guardada-no-encontrada') { cerrarVersiones(); listarGuardadas(); }
    return;
  }
  var nueva = resultado.cuerpo.consultaGuardada;
  // If this is the query loaded in the editor, the editor shows the restored content (it
  // reloads first: loading clears the banner, and the confirmation comes after).
  if (consultaCargada !== null && consultaCargada.id === consulta.id) { await cargarGuardada(consulta.id); }
  mostrarConfirmacion('Se creó la versión ' + nueva.version + ' con el contenido de la versión ' + numero + '.');
  await listarGuardadas();
  await abrirVersiones({ id: consulta.id, nombre: nueva.nombre });
}

// The confirmation repeats the action and its object (never "Sí"), and takes an optional note.
function pedirConfirmacion(celda, numero) {
  vaciar(celda);
  var nota = document.createElement('input');
  nota.type = 'text';
  nota.maxLength = 500;
  nota.placeholder = 'nota (opcional)';
  celda.appendChild(nota);
  celda.appendChild(botonDeVersion('Restaurar versión ' + numero, function () {
    restaurarVersion(numero, nota.value.trim());
  }));
  celda.appendChild(botonDeVersion('Cancelar', function () {
    vaciar(celda);
    celda.appendChild(accionesDeVersion(celda, numero));
  }));
}

function botonDeVersion(texto, accion) {
  var boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = texto;
  boton.addEventListener('click', accion);
  return boton;
}

function accionesDeVersion(celda, numero) {
  var acciones = document.createElement('span');
  acciones.appendChild(botonDeVersion('Comparar con la actual', function () { compararVersion(numero); }));
  acciones.appendChild(botonDeVersion('Restaurar', function () { pedirConfirmacion(celda, numero); }));
  return acciones;
}

function filaDeVersion(version, conAcciones) {
  var item = document.createElement('li');
  var titulo = document.createElement('strong');
  titulo.textContent = 'Versión ' + version.version;
  item.appendChild(titulo);
  var fecha = document.createElement('span');
  fecha.className = 'ayuda';
  fecha.textContent = String(version.fecha);
  item.appendChild(fecha);
  if (version.nota !== null && version.nota !== undefined) {
    var nota = document.createElement('span');
    nota.className = 'ayuda';
    nota.textContent = String(version.nota);
    item.appendChild(nota);
  }
  if (version.esActual === true) {
    item.appendChild(insigniaVigente());
  } else if (conAcciones) {
    var celda = document.createElement('span');
    celda.appendChild(accionesDeVersion(celda, version.version));
    item.appendChild(celda);
  }
  return item;
}

function renderizarVersiones(cuerpo) {
  var lista = Array.isArray(cuerpo.versiones) ? cuerpo.versiones : [];
  var vigente = null;
  lista.forEach(function (v) { if (v.esActual === true) { vigente = v.version; } });
  consultaAbierta.vigente = vigente;
  vaciar(listaVersiones);
  lista.forEach(function (version) { listaVersiones.appendChild(filaDeVersion(version, lista.length > 1)); });
  estadoVersiones.textContent = lista.length <= 1 ? 'Esta es la versión inicial.'
    : cuerpo.truncado === true ? 'Se muestran solo las ' + lista.length + ' versiones más recientes.' : '';
}

async function abrirVersiones(fila) {
  generacionVersiones += 1;
  var g = generacionVersiones;
  consultaAbierta = { id: String(fila.id), nombre: String(fila.nombre), vigente: null };
  vaciar(listaVersiones);
  vaciar(comparacionVersiones);
  tituloVersiones.textContent = 'Versiones de «' + consultaAbierta.nombre + '»';
  estadoVersiones.textContent = 'Cargando versiones…';
  panelVersiones.hidden = false;
  var resultado = await pedirAutomatizacion(rutaVersiones(consultaAbierta.id));
  if (g !== generacionVersiones) { return; }
  if (resultado === null) { estadoVersiones.textContent = 'No se pudieron leer las versiones.'; return; }
  if (resultado.status !== 200) {
    estadoVersiones.textContent = mensajeDeVersiones(resultado);
    if (resultado.cuerpo.error === 'consulta-guardada-no-encontrada') { listarGuardadas(); }
    return;
  }
  renderizarVersiones(resultado.cuerpo);
}

botonCerrarVersiones.addEventListener('click', function () {
  cerrarVersiones();
});

// --- Save as a new version (CH-25, DEC-148, DEC-150) ------------------------------
// Offered only while a saved query is loaded in the editor. The editor's name, description,
// statement and declaration go up exactly as the create sends them, plus the optional note,
// as a PUT on that query's id. The server decides what counts as a change (sin-cambios).
var bloqueVersion = document.getElementById('version-guardar');
var textoCargada = document.getElementById('version-cargada');
var entradaNotaVersion = document.getElementById('version-nota');
var botonVersion = document.getElementById('version-boton');

// The query loaded in the editor ({ id, nombre, version, sql }), or null when none is.
// CH-20 (DEC-161): version and sql let a run name the query while the editor still holds it.
var consultaCargada = null;

function olvidarConsultaCargada() {
  consultaCargada = null;
  bloqueVersion.hidden = true;
  textoCargada.textContent = '';
  entradaNotaVersion.value = '';
}

function recordarConsultaCargada(consulta) {
  consultaCargada = {
    id: String(consulta.id),
    nombre: String(consulta.nombre),
    version: consulta.version,
    sql: String(consulta.sql)
  };
  bloqueVersion.hidden = false;
  textoCargada.textContent = 'Consulta cargada: «' + consultaCargada.nombre +
    '». Los cambios del editor se guardan como una versión nueva de esta consulta.';
  entradaNotaVersion.value = '';
}

async function guardarNuevaVersion() {
  if (consultaCargada === null) { return; }
  ocultarBanner();
  var consulta = consultaCargada;
  var declaracion = declaracionActual();
  var nota = entradaNotaVersion.value.trim();
  var cuerpo = {
    nombre: entradaNombre.value.trim(),
    descripcion: entradaDescripcion.value,
    sql: entradaSql.value,
    parametros: declaracion
  };
  if (nota !== '') { cuerpo.nota = nota; }
  botonVersion.disabled = true;
  var resultado = await pedirAutomatizacion('/consultas-guardadas/' + encodeURIComponent(consulta.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  botonVersion.disabled = false;
  // A tenant switch while the request was in flight owns the page now.
  if (resultado === null || consultaCargada === null || consultaCargada.id !== consulta.id) { return; }

  if (resultado.status === 200) {
    var guardada = resultado.cuerpo.consultaGuardada;
    consultaCargada.nombre = String(guardada.nombre);
    // CH-20 (DEC-161): the editor now holds the saved version, so a run names it.
    consultaCargada.version = guardada.version;
    consultaCargada.sql = String(guardada.sql);
    entradaNotaVersion.value = '';
    mostrarConfirmacion('Se guardó la versión ' + guardada.version + ' de «' + consultaCargada.nombre + '».');
    await listarGuardadas();
    if (consultaAbierta !== null && consultaAbierta.id === consulta.id) {
      await abrirVersiones({ id: consulta.id, nombre: consultaCargada.nombre });
    }
    return;
  }
  var error = resultado.cuerpo.error;
  if (resultado.status === 404) {
    mostrarBanner('Esa consulta guardada ya no existe. Se actualizó la lista.');
    olvidarConsultaCargada();
    await listarGuardadas();
  } else if (resultado.status === 409 && error === 'sin-cambios') {
    mostrarBanner('No hay cambios respecto de la versión vigente.');
  } else if (resultado.status === 409 && error === 'conflicto-de-edicion') {
    mostrarBanner('Otra edición se guardó antes que esta. Volvé a cargar la consulta e intentá de nuevo.');
  } else if (resultado.status === 400 && Array.isArray(resultado.cuerpo.campos) && resultado.cuerpo.campos.indexOf('/nota') !== -1) {
    mostrarBanner('La nota tiene que ser un texto de hasta 500 caracteres.');
  } else if (resultado.status === 400) {
    mostrarBanner(mensajeDeSolicitudInvalida(resultado.cuerpo, declaracion));
  } else {
    mostrarBanner('La aplicación respondió HTTP ' + resultado.status + '.');
  }
}

botonVersion.addEventListener('click', function () {
  guardarNuevaVersion();
});

// Switching tenants wipes the screen before anything else happens. This is the visual
// half of the isolation guarantee: rows and saved-query names belonging to the tenant
// the operator just left must not stay on the page next to the new tenant's name.
// CH-30b: the one path that changes the active tenant, from the selector, from the Tenants
// screen's "Elegir como activo", or to none after deactivating the active tenant.
function cambiarTenant(id) {
  fijarTenant(id);
  ocultarBanner();
  limpiarResultados();
  vaciar(listaGuardadas);
  cerrarVersiones();
  olvidarConsultaCargada();
  limpiarParametros();
  limpiarAutomatizaciones();
  pagina = { desplazamiento: 0, limite: 50, hayMas: false, siguiente: null, corte: null };
  if (tenantActivo !== null) {
    listarGuardadas();
    cargarAutomatizaciones();
  }
  panelConexion.hidden = true;
  olvidarSecretos();
  if (!document.getElementById('pantalla-conexiones').hidden) { cargarPantallaConexiones(); }
  if (!document.getElementById('pantalla-agentes').hidden) { cargarPantallaAgentes(); }
  if (!document.getElementById('pantalla-mapeo').hidden) { cargarPantallaMapeo(); }
  if (!document.getElementById('pantalla-usuarios').hidden) { cargarPantallaUsuarios(); }
}

selectorTenant.addEventListener('change', function () {
  cambiarTenant(selectorTenant.value);
});

// The probe starts by re-evaluating Siguiente, so a placeholder choice disables it at once.
selectorConexionAuto.addEventListener('change', function () {
  sondearConexion();
});

botonNuevaAuto.addEventListener('click', function () {
  abrirAlta();
});

botonCancelarAuto.addEventListener('click', function () {
  cerrarAlta();
});

// CH-21c (DEC-131): the accent and emoji per label, a copy of the closed palette in
// correo.ts. Unknown labels get a gray bar and no emoji; the own-key test keeps names such
// as 'constructor' off the prototype.
var TEMAS_CORREO = {
  'stock-fisico': { acento: '#f59e0b', emoji: '⚠️' },
  'stock-producible': { acento: '#dc2626', emoji: '🔴' },
  'reporte-diario': { acento: '#2563eb', emoji: '📊' }
};
var TEMA_NEUTRO = { acento: '#6b7280', emoji: '' };
var SIN_DESTINATARIO = 'sin destinatario: la ejecución no envía correo';

function temaCorreo(etiqueta) {
  return Object.prototype.hasOwnProperty.call(TEMAS_CORREO, etiqueta) ? TEMAS_CORREO[etiqueta] : TEMA_NEUTRO;
}

// The server's subject, with the count left as the n placeholder (no single-line
// normalization and no length cut: parity is for ordinary names).
function asuntoVistaPrevia(nombre, etiqueta) {
  var emoji = temaCorreo(etiqueta).emoji;
  return (emoji === '' ? '' : emoji + ' ') + nombre + ' (n)';
}

function actualizarVistaPrevia() {
  var nombre = nombresPlantilla[plantillaElegida];
  nombre = nombre === undefined ? '' : nombre;
  var etiqueta = '';
  catalogoPlantillas.forEach(function (fila) {
    if (fila.id === plantillaElegida) { etiqueta = String(fila.automatizacion); }
  });
  vistaAsunto.textContent = asuntoVistaPrevia(nombre, etiqueta);
  vistaTitulo.textContent = nombre;
  vistaTitulo.style.backgroundColor = temaCorreo(etiqueta).acento;
  var destinatario = entradaDestinatario.value.trim();
  vistaPara.textContent = destinatario === '' ? SIN_DESTINATARIO : destinatario;
}

entradaDestinatario.addEventListener('input', function () {
  actualizarVistaPrevia();
});

// Re-checks the gate before moving, so a stale enabled state cannot skip step 1.
botonSiguienteAuto.addEventListener('click', function () {
  actualizarSiguiente();
  if (botonSiguienteAuto.disabled) { return; }
  var nombre = nombresPlantilla[plantillaElegida];
  resumenAlta.textContent = 'Plantilla: ' + (nombre === undefined ? plantillaElegida : nombre) +
    ' · Conexión: ' + selectorConexionAuto.options[selectorConexionAuto.selectedIndex].textContent;
  actualizarVistaPrevia();
  irAPaso(2);
});

botonVolverAuto.addEventListener('click', function () {
  irAPaso(1);
});

selectorFrecuencia.addEventListener('change', function () {
  actualizarHorario();
});

// Both events: some browsers fire input per keystroke in a time control, others only change.
entradaHora.addEventListener('input', function () {
  actualizarHorario();
});

entradaHora.addEventListener('change', function () {
  actualizarHorario();
});

botonCrearAuto.addEventListener('click', function () {
  crearAutomatizacion();
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

// CH-29 (DEC-154): Salir revokes the session and reloads into the login screen; it reloads
// even if the call fails, and it sends no tenant header (the route names no tenant).
document.getElementById('salir').addEventListener('click', function () {
  fetch('/consola/salir', { method: 'POST' }).then(function () {
    window.location.reload();
  }, function () {
    window.location.reload();
  });
});

// ---- CH-30b (DEC-167, DEC-168, screen C-02): Tenants --------------------------------------

var formularioTenant = document.getElementById('tenant-alta');
var entradaNombreTenant = document.getElementById('tenant-nombre');
var avisoTenant = document.getElementById('tenant-aviso');
var cuerpoTenants = document.getElementById('tenants-cuerpo');

function fechaTenant(iso) {
  var fecha = new Date(String(iso));
  if (isNaN(fecha.getTime())) { return ''; }
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };
  return dos(fecha.getDate()) + '/' + dos(fecha.getMonth() + 1) + '/' + fecha.getFullYear();
}

function celdaTenant(fila, texto) {
  var td = document.createElement('td');
  td.textContent = texto;
  fila.appendChild(td);
  return td;
}

function botonTenant(texto, alHacerClic) {
  var b = document.createElement('button');
  b.type = 'button';
  b.textContent = texto;
  b.addEventListener('click', alHacerClic);
  return b;
}

// The action cell of an active tenant: Elegir and Dar de baja, or the inline confirmation.
function accionesTenant(td, tenant) {
  vaciar(td);
  td.appendChild(botonTenant('Elegir como activo', function () { cambiarTenant(String(tenant.id)); }));
  td.appendChild(botonTenant('Dar de baja', function () {
    vaciar(td);
    td.appendChild(botonTenant('Dar de baja ' + String(tenant.nombre), function () { darDeBaja(tenant); }));
    td.appendChild(botonTenant('Cancelar', function () { accionesTenant(td, tenant); }));
  }));
}

function renderizarTenants(tenants) {
  vaciar(cuerpoTenants);
  tenants.forEach(function (tenant) {
    var fila = document.createElement('tr');
    celdaTenant(fila, String(tenant.nombre));
    celdaTenant(fila, String(tenant.id).slice(0, 8) + '…');
    celdaTenant(fila, tenant.activo === true ? 'Activo' : 'Dado de baja');
    celdaTenant(fila, fechaTenant(tenant.creadoEn));
    var acciones = celdaTenant(fila, '');
    if (tenant.activo === true) { accionesTenant(acciones, tenant); }
    cuerpoTenants.appendChild(fila);
  });
  avisoTenant.textContent = tenants.length === 0 ? 'Todavía no hay tenants.' : '';
}

// Global calls: plain fetch with the 401 check, never pedir() (they carry no tenant).
async function cargarTenantsPantalla() {
  var respuesta;
  try {
    respuesta = await fetch('/tenants?incluirInactivos=true').then(siNoAutenticado);
  } catch (fallaDeRed) {
    avisoTenant.textContent = 'No se pudo contactar con la aplicación para leer los tenants.';
    return;
  }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (cuerpo === null || respuesta.status !== 200 || !Array.isArray(cuerpo.tenants)) {
    avisoTenant.textContent = 'No se pudo leer la lista de tenants (HTTP ' + respuesta.status + ').';
    return;
  }
  renderizarTenants(cuerpo.tenants);
}

async function darDeBaja(tenant) {
  var id = String(tenant.id);
  var respuesta;
  try {
    respuesta = await fetch('/tenants/' + encodeURIComponent(id) + '/baja', { method: 'POST' }).then(siNoAutenticado);
  } catch (fallaDeRed) {
    avisoTenant.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta.status !== 200) {
    avisoTenant.textContent = 'No se pudo dar de baja el tenant (HTTP ' + respuesta.status + ').';
    return;
  }
  if (id === tenantActivo) {
    cambiarTenant(null);
    mostrarBanner('Diste de baja el tenant activo. Elegí otro en la barra superior.');
  }
  await cargarTenantsPantalla();
  await cargarTenants();
}

formularioTenant.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  var nombre = entradaNombreTenant.value.trim();
  if (nombre === '') { avisoTenant.textContent = 'Escribí el nombre del tenant.'; return; }
  var respuesta;
  try {
    respuesta = await fetch('/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre })
    }).then(siNoAutenticado);
  } catch (fallaDeRed) {
    avisoTenant.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta.status !== 201) {
    avisoTenant.textContent = 'No se pudo crear el tenant (HTTP ' + respuesta.status + ').';
    return;
  }
  entradaNombreTenant.value = '';
  await cargarTenantsPantalla();
  avisoTenant.textContent = 'Se creó el tenant «' + nombre + '».';
  await cargarTenants();
});

// ---- CH-30b (DEC-167, screen C-05): Conexiones -------------------------------------------

var avisoConexiones = document.getElementById('conexiones-aviso');
var cuerpoConexiones = document.getElementById('conexiones-cuerpo');
var panelConexion = document.getElementById('conexion-panel');
var formularioConexion = document.getElementById('conexion-alta');
var resultadoConexion = document.getElementById('cx-resultado');

// The verdict of a connection test, as one line of text.
function textoDePrueba(cuerpo) {
  if (cuerpo === null || typeof cuerpo !== 'object') { return 'No se pudo leer el resultado de la prueba.'; }
  if (cuerpo.resultado === 'ok') { return 'OK · ' + cuerpo.duracionMs + ' ms'; }
  return 'Falló · ' + String(cuerpo.categoria) + (cuerpo.codigo ? ' (' + String(cuerpo.codigo) + ')' : '');
}

async function probarConexionPorId(id) {
  var respuesta;
  try {
    respuesta = await pedir('/conexiones/' + encodeURIComponent(id) + '/prueba', { method: 'POST' });
  } catch (fallaDeRed) {
    return 'No se pudo contactar con la aplicación.';
  }
  if (respuesta === null) { return 'Elegí un tenant.'; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return ''; }
  if (respuesta.status !== 200) { return 'La prueba no se pudo hacer (HTTP ' + respuesta.status + ').'; }
  return textoDePrueba(cuerpo);
}

function renderizarPantallaConexiones(conexiones) {
  vaciar(cuerpoConexiones);
  conexiones.forEach(function (cx) {
    var fila = document.createElement('tr');
    celdaTenant(fila, String(cx.nombre));
    celdaTenant(fila, String(cx.motor));
    celdaTenant(fila, String(cx.host) + ':' + String(cx.puerto));
    celdaTenant(fila, String(cx.baseDeDatos));
    celdaTenant(fila, String(cx.usuarioDb));
    var prueba = celdaTenant(fila, '');
    var resultado = document.createElement('span');
    prueba.appendChild(botonTenant('Probar', async function () {
      resultado.textContent = 'Probando…';
      resultado.textContent = await probarConexionPorId(String(cx.id));
    }));
    prueba.appendChild(resultado);
    cuerpoConexiones.appendChild(fila);
  });
  avisoConexiones.textContent = conexiones.length === 0
    ? 'Todavía no hay conexiones. Registrá la primera: es el primer paso de la puesta en marcha.'
    : '';
}

async function cargarPantallaConexiones() {
  if (tenantActivo === null) {
    vaciar(cuerpoConexiones);
    avisoConexiones.textContent = 'Elegí un tenant para ver sus conexiones.';
    return;
  }
  var respuesta;
  try {
    respuesta = await pedir('/conexiones');
  } catch (fallaDeRed) {
    avisoConexiones.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (cuerpo === null || respuesta.status !== 200 || !Array.isArray(cuerpo.conexiones)) {
    avisoConexiones.textContent = 'No se pudo leer la lista de conexiones (HTTP ' + respuesta.status + ').';
    return;
  }
  renderizarPantallaConexiones(cuerpo.conexiones);
}

document.getElementById('conexion-nueva').addEventListener('click', function () {
  resultadoConexion.textContent = '';
  panelConexion.hidden = false;
  opcionesDeVia();
});

// CH-30c: "Cómo llega" offers the tenant's agent only while it is active.
async function opcionesDeVia() {
  var via = document.getElementById('cx-via');
  vaciar(via);
  var directa = document.createElement('option');
  directa.value = '';
  directa.textContent = 'Directa';
  via.appendChild(directa);
  var respuesta;
  try { respuesta = await pedir('/agentes'); } catch (fallaDeRed) { return; }
  if (respuesta === null || respuesta.status !== 200) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  var agente = cuerpo !== null && Array.isArray(cuerpo.agentes) ? cuerpo.agentes[0] : undefined;
  if (agente !== undefined && agente.revocadoEn === null) {
    var opcion = document.createElement('option');
    opcion.value = String(agente.id);
    opcion.textContent = 'Por el agente del tenant';
    via.appendChild(opcion);
  }
}

document.getElementById('cx-cerrar').addEventListener('click', function () {
  panelConexion.hidden = true;
});

// "Guardar y probar": the password is read once into the request and the field emptied at
// once, so it never stays in the page; it is never written back (rule 7).
formularioConexion.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  var campoClave = document.getElementById('cx-clave');
  var cuerpoAlta = {
    nombre: document.getElementById('cx-nombre').value.trim(),
    motor: 'postgres',
    host: document.getElementById('cx-host').value.trim(),
    puerto: parseInt(document.getElementById('cx-puerto').value, 10),
    baseDeDatos: document.getElementById('cx-base').value.trim(),
    usuarioDb: document.getElementById('cx-usuario').value.trim(),
    credencial: campoClave.value
  };
  campoClave.value = '';
  var via = document.getElementById('cx-via').value;
  if (via !== '') { cuerpoAlta.agenteId = via; }
  resultadoConexion.textContent = 'Guardando…';
  var respuesta;
  try {
    respuesta = await pedir('/conexiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoAlta)
    });
  } catch (fallaDeRed) {
    resultadoConexion.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { resultadoConexion.textContent = 'Elegí un tenant.'; return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (respuesta.status === 400 && cuerpo !== null && Array.isArray(cuerpo.campos)) {
    resultadoConexion.textContent = 'Revisá estos campos: ' + cuerpo.campos.join(', ') + '. Volvé a escribir la contraseña.';
    return;
  }
  if (respuesta.status !== 201 || cuerpo === null || cuerpo.conexion === undefined) {
    resultadoConexion.textContent = 'No se pudo registrar la conexión (HTTP ' + respuesta.status + ').';
    return;
  }
  resultadoConexion.textContent = 'Guardada. Probando…';
  resultadoConexion.textContent = 'Guardada. Prueba: ' + await probarConexionPorId(String(cuerpo.conexion.id));
  await cargarPantallaConexiones();
});

// ---- CH-30c: secrets shown once (agent tokens, panel passwords) --------------------------

// Each entry is a notice and the node that holds the secret's text. The secret lives only
// there, and only until it is dismissed, the screen changes or the tenant changes.
var SECRETOS = [
  { contenedor: document.getElementById('agente-secreto'), valor: document.getElementById('agente-secreto-valor') },
  { contenedor: document.getElementById('usuario-secreto'), valor: document.getElementById('usuario-secreto-valor') }
];

function mostrarSecreto(indice, texto) {
  SECRETOS[indice].valor.textContent = String(texto);
  SECRETOS[indice].contenedor.hidden = false;
}

function olvidarSecretos() {
  SECRETOS.forEach(function (secreto) {
    secreto.valor.textContent = '';
    secreto.contenedor.hidden = true;
  });
}

// Copies the shown secret when the browser allows it; otherwise asks to copy by hand.
function copiarSecreto(indice, aviso) {
  var texto = SECRETOS[indice].valor.textContent;
  var portapapeles = window.navigator && window.navigator.clipboard;
  if (!portapapeles || texto === '') { aviso.textContent = 'Seleccioná el texto y copialo a mano.'; return; }
  portapapeles.writeText(texto).then(function () {
    aviso.textContent = 'Copiado.';
  }, function () {
    aviso.textContent = 'Seleccioná el texto y copialo a mano.';
  });
}

// ---- CH-30c (DEC-121, screen C-05 "Agentes"): Agentes ------------------------------------

var avisoAgentes = document.getElementById('agentes-aviso');
var estadoAgente = document.getElementById('agente-estado');

document.getElementById('agente-guardado').addEventListener('click', olvidarSecretos);
document.getElementById('agente-copiar').addEventListener('click', function () { copiarSecreto(0, avisoAgentes); });

function lineaAgente(texto) {
  var p = document.createElement('p');
  p.textContent = texto;
  estadoAgente.appendChild(p);
}

function renderizarAgente(agente) {
  vaciar(estadoAgente);
  if (agente === null) {
    lineaAgente('Este tenant todavía no tiene agente.');
    estadoAgente.appendChild(botonTenant('Crear agente', emitirTokenAgente));
    return;
  }
  if (agente.revocadoEn !== null) {
    lineaAgente('Revocado desde el ' + fechaTenant(agente.revocadoEn) + '. Sus conexiones no funcionan hasta emitir un token nuevo.');
    estadoAgente.appendChild(botonTenant('Emitir un token nuevo', emitirTokenAgente));
    return;
  }
  lineaAgente('Activo · creado el ' + fechaTenant(agente.creadoEn) + ' · token emitido el ' + fechaTenant(agente.tokenEmitidoEn));
  estadoAgente.appendChild(botonTenant('Revocar', function () {
    vaciar(estadoAgente);
    lineaAgente('Al revocar el token, las conexiones que pasan por este agente dejan de funcionar hasta emitir uno nuevo.');
    estadoAgente.appendChild(botonTenant('Revocar el token', function () { revocarAgente(String(agente.id)); }));
    estadoAgente.appendChild(botonTenant('Cancelar', function () { renderizarAgente(agente); }));
  }));
}

async function cargarPantallaAgentes() {
  if (tenantActivo === null) {
    vaciar(estadoAgente);
    avisoAgentes.textContent = 'Elegí un tenant para ver su agente.';
    return;
  }
  var respuesta;
  try { respuesta = await pedir('/agentes'); } catch (fallaDeRed) {
    avisoAgentes.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (cuerpo === null || respuesta.status !== 200 || !Array.isArray(cuerpo.agentes)) {
    avisoAgentes.textContent = 'No se pudo leer el agente (HTTP ' + respuesta.status + ').';
    return;
  }
  avisoAgentes.textContent = '';
  renderizarAgente(cuerpo.agentes.length > 0 ? cuerpo.agentes[0] : null);
}

async function emitirTokenAgente() {
  var respuesta;
  try {
    respuesta = await pedir('/agentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  } catch (fallaDeRed) {
    avisoAgentes.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if ((respuesta.status === 201 || respuesta.status === 200) && cuerpo !== null && typeof cuerpo.token === 'string') {
    mostrarSecreto(0, cuerpo.token);
  } else if (respuesta.status === 409) {
    avisoAgentes.textContent = 'El tenant ya tiene un agente activo.';
  } else {
    avisoAgentes.textContent = 'No se pudo emitir el token (HTTP ' + respuesta.status + ').';
  }
  await cargarPantallaAgentes();
}

async function revocarAgente(id) {
  var respuesta;
  try {
    respuesta = await pedir('/agentes/' + encodeURIComponent(id) + '/revocar', { method: 'POST' });
  } catch (fallaDeRed) {
    avisoAgentes.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  if (respuesta.status !== 200 && respuesta.status !== 409) {
    avisoAgentes.textContent = 'No se pudo revocar el token (HTTP ' + respuesta.status + ').';
  }
  await cargarPantallaAgentes();
}

// ---- CH-30c (DEC-155 to DEC-158): Usuarios del panel --------------------------------------

var avisoUsuarios = document.getElementById('usuarios-aviso');
var cuerpoUsuarios = document.getElementById('usuarios-cuerpo');
var formularioUsuario = document.getElementById('usuario-alta');

document.getElementById('usuario-guardado').addEventListener('click', olvidarSecretos);
document.getElementById('usuario-copiar').addEventListener('click', function () { copiarSecreto(1, avisoUsuarios); });

// One write on a user (reset, deactivate, reactivate): shows a generated password when the
// answer carries one, then reloads the list.
async function accionUsuario(id, verbo) {
  var respuesta;
  try {
    respuesta = await pedir('/usuarios/' + encodeURIComponent(id) + '/' + verbo, { method: 'POST' });
  } catch (fallaDeRed) {
    avisoUsuarios.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (respuesta.status === 200 && cuerpo !== null && typeof cuerpo.clave === 'string') {
    mostrarSecreto(1, cuerpo.clave);
  } else if (respuesta.status !== 200) {
    avisoUsuarios.textContent = 'No se pudo completar la acción (HTTP ' + respuesta.status + ').';
  }
  await cargarPantallaUsuarios();
}

function accionesUsuario(td, usuario) {
  vaciar(td);
  var id = String(usuario.id);
  if (usuario.activo === true) {
    td.appendChild(botonTenant('Reponer clave', function () { accionUsuario(id, 'clave'); }));
    td.appendChild(botonTenant('Desactivar', function () {
      vaciar(td);
      td.appendChild(botonTenant('Desactivar ' + String(usuario.correo), function () { accionUsuario(id, 'desactivar'); }));
      td.appendChild(botonTenant('Cancelar', function () { accionesUsuario(td, usuario); }));
    }));
  } else {
    td.appendChild(botonTenant('Reactivar', function () { accionUsuario(id, 'reactivar'); }));
    td.appendChild(botonTenant('Reponer clave', function () { accionUsuario(id, 'clave'); }));
  }
}

function renderizarUsuarios(usuarios) {
  vaciar(cuerpoUsuarios);
  usuarios.forEach(function (usuario) {
    var fila = document.createElement('tr');
    celdaTenant(fila, String(usuario.correo));
    celdaTenant(fila, usuario.nombre === null || usuario.nombre === undefined ? '—' : String(usuario.nombre));
    celdaTenant(fila, usuario.activo === true ? 'Activo' : 'Desactivado');
    celdaTenant(fila, fechaTenant(usuario.creadoEn));
    accionesUsuario(celdaTenant(fila, ''), usuario);
    cuerpoUsuarios.appendChild(fila);
  });
}

async function cargarPantallaUsuarios() {
  if (tenantActivo === null) {
    vaciar(cuerpoUsuarios);
    avisoUsuarios.textContent = 'Elegí un tenant para ver sus usuarios del panel.';
    return;
  }
  var respuesta;
  try { respuesta = await pedir('/usuarios'); } catch (fallaDeRed) {
    avisoUsuarios.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (cuerpo === null || respuesta.status !== 200 || !Array.isArray(cuerpo.usuarios)) {
    avisoUsuarios.textContent = 'No se pudo leer la lista de usuarios (HTTP ' + respuesta.status + ').';
    return;
  }
  renderizarUsuarios(cuerpo.usuarios);
}

formularioUsuario.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  var entradaCorreo = document.getElementById('usuario-correo');
  var entradaNombre = document.getElementById('usuario-nombre');
  var cuerpoAlta = { correo: entradaCorreo.value.trim() };
  if (entradaNombre.value.trim() !== '') { cuerpoAlta.nombre = entradaNombre.value.trim(); }
  var respuesta;
  try {
    respuesta = await pedir('/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoAlta)
    });
  } catch (fallaDeRed) {
    avisoUsuarios.textContent = 'No se pudo contactar con la aplicación.';
    return;
  }
  if (respuesta === null) { return; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return; }
  if (respuesta.status === 409) { avisoUsuarios.textContent = 'Ese correo ya está en uso.'; return; }
  if (respuesta.status === 400 && cuerpo !== null && Array.isArray(cuerpo.campos)) {
    avisoUsuarios.textContent = 'Revisá estos campos: ' + cuerpo.campos.join(', ') + '.';
    return;
  }
  if (respuesta.status !== 201 || cuerpo === null || typeof cuerpo.clave !== 'string') {
    avisoUsuarios.textContent = 'No se pudo crear el usuario (HTTP ' + respuesta.status + ').';
    return;
  }
  entradaCorreo.value = '';
  entradaNombre.value = '';
  avisoUsuarios.textContent = '';
  mostrarSecreto(1, cuerpo.clave);
  await cargarPantallaUsuarios();
});

// ---- CH-30d (DEC-61, screen C-03): Plantillas -------------------------------------------

var avisoPlantillas = document.getElementById('plantillas-aviso');
var cuerpoPlantillas = document.getElementById('plantillas-cuerpo');
var panelPlantilla = document.getElementById('plantilla-panel');

function toleranciaTexto(minutos) {
  if (typeof minutos !== 'number') { return '—'; }
  return minutos % 60 === 0 ? (minutos / 60) + ' h' : minutos + ' min';
}

// Global reads: plain fetch with the 401 check; null on any failure, after saying why.
async function leerGlobal(url, aviso) {
  var respuesta;
  try { respuesta = await fetch(url).then(siNoAutenticado); } catch (fallaDeRed) {
    aviso.textContent = 'No se pudo contactar con la aplicación.';
    return null;
  }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (cuerpo === null || respuesta.status !== 200) {
    aviso.textContent = 'No se pudo leer ' + url + ' (HTTP ' + respuesta.status + ').';
    return null;
  }
  return cuerpo;
}

async function verPlantilla(id) {
  var cuerpo = await leerGlobal('/plantillas/' + encodeURIComponent(id), avisoPlantillas);
  if (cuerpo === null || cuerpo.plantilla === undefined) { return; }
  var plantilla = cuerpo.plantilla;
  document.getElementById('plantilla-titulo').textContent = String(plantilla.nombre);
  var entidades = Array.isArray(plantilla.entidades) ? plantilla.entidades : [];
  document.getElementById('plantilla-entidades').textContent = 'Necesita: ' + (entidades.length === 0 ? '—' : entidades.join(', '));
  var parametros = Array.isArray(plantilla.parametros) ? plantilla.parametros : [];
  document.getElementById('plantilla-parametros').textContent = 'Parámetros: ' + (parametros.length === 0 ? 'ninguno'
    : parametros.map(function (p) { return String(p.nombre) + ' (' + String(p.tipo) + ')'; }).join(', '));
  document.getElementById('plantilla-sql').textContent = String(plantilla.sql);
  panelPlantilla.hidden = false;
}

async function cargarPantallaPlantillas() {
  var cuerpo = await leerGlobal('/plantillas', avisoPlantillas);
  if (cuerpo === null || !Array.isArray(cuerpo.plantillas)) { return; }
  vaciar(cuerpoPlantillas);
  cuerpo.plantillas.forEach(function (plantilla) {
    var fila = document.createElement('tr');
    celdaTenant(fila, String(plantilla.nombre));
    celdaTenant(fila, String(plantilla.automatizacion));
    celdaTenant(fila, String(plantilla.formato));
    celdaTenant(fila, toleranciaTexto(plantilla.toleranciaFrescuraMinutos));
    celdaTenant(fila, '').appendChild(botonTenant('Ver', function () { verPlantilla(String(plantilla.id)); }));
    cuerpoPlantillas.appendChild(fila);
  });
  avisoPlantillas.textContent = cuerpo.truncado === true
    ? 'Se muestran solo las primeras ' + cuerpo.plantillas.length + ' plantillas.'
    : (cuerpo.plantillas.length === 0 ? 'Todavía no hay plantillas.' : '');
}

document.getElementById('plantilla-cerrar').addEventListener('click', function () { panelPlantilla.hidden = true; });

// ---- CH-30d (DEC-21, screen C-04): Contrato -----------------------------------------------

var avisoContrato = document.getElementById('contrato-aviso');
var cuerpoContrato = document.getElementById('contrato-cuerpo');

async function cargarPantallaContrato() {
  var cuerpo = await leerGlobal('/contrato', avisoContrato);
  if (cuerpo === null || cuerpo.contrato === undefined || !Array.isArray(cuerpo.contrato.entidades)) { return; }
  vaciar(cuerpoContrato);
  cuerpo.contrato.entidades.forEach(function (entidad) {
    var encabezado = document.createElement('tr');
    var titulo = document.createElement('th');
    titulo.colSpan = 4;
    titulo.textContent = String(entidad.nombre) + ' · ' + (entidad.obligatoriedad === 'obligatorio' ? 'obligatoria' : 'opcional');
    encabezado.appendChild(titulo);
    cuerpoContrato.appendChild(encabezado);
    (Array.isArray(entidad.campos) ? entidad.campos : []).forEach(function (campo) {
      var fila = document.createElement('tr');
      celdaTenant(fila, String(campo.nombre));
      celdaTenant(fila, String(campo.tipo));
      celdaTenant(fila, campo.obligatoriedad === 'obligatorio' ? 'Sí' : 'No');
      celdaTenant(fila, Array.isArray(campo.automatizaciones) ? campo.automatizaciones.join(', ') : '');
      cuerpoContrato.appendChild(fila);
    });
  });
  avisoContrato.textContent = '';
}

// ---- CH-30d (DEC-169, screen C-06): Mapeo y validación ------------------------------------

var avisoMapeo = document.getElementById('mapeo-aviso');
var selectorMapeo = document.getElementById('mapeo-conexion');
var contenedorEntidades = document.getElementById('mapeo-entidades');
var cuerpoAutomatizacionesMapeo = document.getElementById('mapeo-automatizaciones');
// One entry per entity block: its state line, its editor and its diagnostics list.
var bloquesMapeo = {};
var conexionMapeo = null;

var ESTADOS_ENTIDAD = { 'no-mapeada': 'Sin mapear', 'no-validado': 'Sin validar', valida: 'Válida', invalida: 'Inválida' };

function textoDeEstado(estado) {
  return 'Estado: ' + (ESTADOS_ENTIDAD[estado] || String(estado));
}

function urlMapeo(sufijo) {
  return '/conexiones/' + encodeURIComponent(String(conexionMapeo)) + sufijo;
}

// Reads one JSON answer through pedir(); null when there is nothing to show (and says why).
async function leerMapeo(url, opciones) {
  var respuesta;
  try { respuesta = await pedir(url, opciones); } catch (fallaDeRed) {
    avisoMapeo.textContent = 'No se pudo contactar con la aplicación.';
    return null;
  }
  if (respuesta === null) { return null; }
  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }
  if (manejarFalloDeTenant(cuerpo)) { return null; }
  return { status: respuesta.status, cuerpo: cuerpo };
}

async function guardarVista(entidad) {
  var bloque = bloquesMapeo[entidad];
  var leido = await leerMapeo(urlMapeo('/vistas-canonicas/' + encodeURIComponent(entidad)), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: bloque.editor.value })
  });
  if (leido === null) { return; }
  if (leido.status === 200 || leido.status === 201) {
    // DEC-41: replacing a view always resets it to not validated.
    bloque.estado.textContent = textoDeEstado('no-validado');
    vaciar(bloque.diagnostico);
    avisoMapeo.textContent = 'Se guardó la vista de ' + entidad + '. Validá el mapeo para comprobarla.';
  } else if (leido.status === 400 && leido.cuerpo !== null && Array.isArray(leido.cuerpo.campos)) {
    avisoMapeo.textContent = 'Revisá estos campos: ' + leido.cuerpo.campos.join(', ') + '.';
  } else {
    avisoMapeo.textContent = 'No se pudo guardar la vista (HTTP ' + leido.status + ').';
  }
}

// Builds the entity's block the first time and keeps it, so a repaint never loses an edit.
function bloqueDeEntidad(fila) {
  var entidad = String(fila.entidad);
  if (bloquesMapeo[entidad] === undefined) {
    var bloque = document.createElement('div');
    var titulo = document.createElement('h3');
    titulo.textContent = entidad + ' · ' + (fila.obligatoriedad === 'obligatorio' ? 'obligatoria' : 'opcional');
    var estado = document.createElement('p');
    var editor = document.createElement('textarea');
    editor.spellcheck = false;
    var diagnostico = document.createElement('ul');
    bloque.appendChild(titulo);
    bloque.appendChild(estado);
    bloque.appendChild(editor);
    bloque.appendChild(botonTenant('Guardar', function () { guardarVista(entidad); }));
    bloque.appendChild(diagnostico);
    contenedorEntidades.appendChild(bloque);
    bloquesMapeo[entidad] = { estado: estado, editor: editor, diagnostico: diagnostico };
  }
  return bloquesMapeo[entidad];
}

function renderizarInforme(informe) {
  (Array.isArray(informe.entidades) ? informe.entidades : []).forEach(function (fila) {
    var bloque = bloqueDeEntidad(fila);
    bloque.estado.textContent = textoDeEstado(fila.estado);
    vaciar(bloque.diagnostico);
    var diagnostico = fila.diagnostico;
    if (diagnostico && diagnostico.sondeo && diagnostico.sondeo.resultado === 'fallo') {
      var linea = document.createElement('li');
      linea.textContent = 'La consulta no corrió: ' + String(diagnostico.sondeo.categoria);
      bloque.diagnostico.appendChild(linea);
    }
    (diagnostico && Array.isArray(diagnostico.campos) ? diagnostico.campos : []).forEach(function (campo) {
      if (campo.veredicto === 'ok') { return; }
      var item = document.createElement('li');
      item.textContent = String(campo.campo) + ': ' + String(campo.veredicto) +
        (campo.columna ? ' · columna ' + String(campo.columna) : '') +
        (campo.tipoObservado ? ' · tipo ' + String(campo.tipoObservado) : '') +
        (campo.pista && campo.pista.sugerencia ? ' · probá castear con ' + String(campo.pista.sugerencia) : '');
      bloque.diagnostico.appendChild(item);
    });
    (diagnostico && Array.isArray(diagnostico.columnasSobrantes) ? diagnostico.columnasSobrantes : []).forEach(function (sobrante) {
      var item = document.createElement('li');
      item.textContent = 'Columna sobrante: ' + String(sobrante.columna);
      bloque.diagnostico.appendChild(item);
    });
  });
  vaciar(cuerpoAutomatizacionesMapeo);
  (Array.isArray(informe.automatizaciones) ? informe.automatizaciones : []).forEach(function (auto) {
    var fila = document.createElement('tr');
    celdaTenant(fila, String(auto.automatizacion));
    celdaTenant(fila, String(auto.estado));
    celdaTenant(fila, (Array.isArray(auto.motivos) ? auto.motivos : []).map(function (m) {
      return String(m.entidad) + (m.campo ? '.' + String(m.campo) : '') + ': ' + String(m.motivo);
    }).join('; '));
    cuerpoAutomatizacionesMapeo.appendChild(fila);
  });
}

async function cargarMapeoDeConexion(id) {
  conexionMapeo = id;
  bloquesMapeo = {};
  vaciar(contenedorEntidades);
  vaciar(cuerpoAutomatizacionesMapeo);
  if (id === '') { conexionMapeo = null; avisoMapeo.textContent = 'Elegí una conexión para ver su mapeo.'; return; }
  var informe = await leerMapeo(urlMapeo('/validacion-mapeo'));
  if (informe === null || informe.status !== 200 || informe.cuerpo === null) {
    if (informe !== null) { avisoMapeo.textContent = 'No se pudo leer el mapeo (HTTP ' + informe.status + ').'; }
    return;
  }
  avisoMapeo.textContent = '';
  renderizarInforme(informe.cuerpo.validacionMapeo || {});
  var vistas = await leerMapeo(urlMapeo('/vistas-canonicas'));
  if (vistas === null || vistas.status !== 200 || vistas.cuerpo === null || !Array.isArray(vistas.cuerpo.vistasCanonicas)) { return; }
  for (var i = 0; i < vistas.cuerpo.vistasCanonicas.length; i++) {
    var entidad = String(vistas.cuerpo.vistasCanonicas[i].entidad);
    var vista = await leerMapeo(urlMapeo('/vistas-canonicas/' + encodeURIComponent(entidad)));
    if (vista !== null && vista.status === 200 && vista.cuerpo !== null && vista.cuerpo.vistaCanonica && bloquesMapeo[entidad]) {
      // The stored statement is an editor value, never markup.
      bloquesMapeo[entidad].editor.value = String(vista.cuerpo.vistaCanonica.sql);
    }
  }
}

async function cargarPantallaMapeo() {
  vaciar(selectorMapeo);
  bloquesMapeo = {};
  vaciar(contenedorEntidades);
  vaciar(cuerpoAutomatizacionesMapeo);
  conexionMapeo = null;
  if (tenantActivo === null) { avisoMapeo.textContent = 'Elegí un tenant para mapear sus conexiones.'; return; }
  var leido = await leerMapeo('/conexiones');
  if (leido === null || leido.status !== 200 || leido.cuerpo === null || !Array.isArray(leido.cuerpo.conexiones)) { return; }
  var vacia = document.createElement('option');
  vacia.value = '';
  vacia.textContent = leido.cuerpo.conexiones.length === 0 ? 'No hay conexiones' : 'Elegí una conexión';
  selectorMapeo.appendChild(vacia);
  leido.cuerpo.conexiones.forEach(function (cx) {
    var opcion = document.createElement('option');
    opcion.value = String(cx.id);
    opcion.textContent = String(cx.nombre);
    selectorMapeo.appendChild(opcion);
  });
  avisoMapeo.textContent = leido.cuerpo.conexiones.length === 0
    ? 'Registrá una conexión antes de mapear.'
    : 'Elegí una conexión para ver su mapeo.';
}

selectorMapeo.addEventListener('change', function () { cargarMapeoDeConexion(selectorMapeo.value); });

document.getElementById('mapeo-validar').addEventListener('click', async function () {
  if (conexionMapeo === null) { avisoMapeo.textContent = 'Elegí una conexión para validar.'; return; }
  avisoMapeo.textContent = 'Validando…';
  var leido = await leerMapeo(urlMapeo('/validacion-mapeo'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (leido === null) { return; }
  if (leido.status !== 200 || leido.cuerpo === null) {
    avisoMapeo.textContent = 'No se pudo validar (HTTP ' + leido.status + ').';
    return;
  }
  if (leido.cuerpo.resultado === 'fallo') {
    // A failed session writes nothing (CH-10): the last stored report stays on screen.
    avisoMapeo.textContent = 'La validación no pudo conectarse: ' + String(leido.cuerpo.fase) + ' · ' +
      String(leido.cuerpo.categoria) + (leido.cuerpo.codigo ? ' (' + String(leido.cuerpo.codigo) + ')' : '') +
      '. Se mantiene el último resultado.';
    return;
  }
  avisoMapeo.textContent = 'Validación terminada.';
  renderizarInforme(leido.cuerpo.validacionMapeo || {});
});

// CH-30a (DEC-164): one screen at a time, chosen by location.hash; an empty or unknown hash
// shows Consultas. Only hidden and aria-current change: every node keeps its id and its
// place, so nothing else in this script depends on which screen is showing.
var PANTALLAS = ['tenants', 'plantillas', 'contrato', 'conexiones', 'agentes', 'mapeo', 'usuarios', 'consultas', 'automatizaciones', 'frescura'];
function mostrarPantalla() {
  var pedida = String(window.location.hash || '').replace(/^#/, '');
  var activa = PANTALLAS.indexOf(pedida) === -1 ? 'consultas' : pedida;
  olvidarSecretos();
  PANTALLAS.forEach(function (nombre) {
    document.getElementById('pantalla-' + nombre).hidden = nombre !== activa;
    var enlace = document.getElementById('nav-' + nombre);
    if (nombre === activa) { enlace.setAttribute('aria-current', 'page'); } else { enlace.removeAttribute('aria-current'); }
  });
  // CH-30b: a screen that reads its own data loads it when it is shown.
  if (activa === 'tenants') { cargarTenantsPantalla(); }
  if (activa === 'plantillas') { cargarPantallaPlantillas(); }
  if (activa === 'contrato') { cargarPantallaContrato(); }
  if (activa === 'conexiones') { cargarPantallaConexiones(); }
  if (activa === 'agentes') { cargarPantallaAgentes(); }
  if (activa === 'mapeo') { cargarPantallaMapeo(); }
  if (activa === 'usuarios') { cargarPantallaUsuarios(); }
}
window.addEventListener('hashchange', mostrarPantalla);
mostrarPantalla();

// The tenant list comes first: nothing else on this page can be asked for until the
// console knows which tenant it is operating as.
cargarTenants().then(function () {
  if (tenantActivo !== null) {
    listarGuardadas();
    cargarAutomatizaciones();
  }
});
</script>
</body>
</html>
`;
}

/**
 * CH-29 (DEC-154): the console's login screen, served by `GET /consola` when the request
 * carries no valid operator session. Built on the panel's P-01 pattern (`src/panel.ts`)
 * with the shared `.zd-*` classes: a centered card, one form, one error banner, a loading
 * button. It carries no data at all, so nothing in it needs escaping. The script posts
 * the name and password as JSON to `POST /consola/ingresar` and reloads on success, so the
 * server serves the console; a `401` keeps the typed name and says so. Same hazards as
 * the console: string concatenation only, `textContent` only, one script element.
 */
const DOCUMENTO_INGRESO = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroDashboard — Ingreso a la consola</title>
<link rel="stylesheet" href="/ui/styles.css">
<style>
  [hidden] { display: none !important; }
  .consola-ingreso { min-height: 100vh; display: grid; place-items: center; padding: var(--space-6); }
  .consola-ingreso__caja { width: min(420px, 100%); display: grid; gap: var(--space-8); }
  .consola-ingreso__marca { display: grid; gap: var(--space-3); text-align: center; }
  .consola-ingreso__marca strong { font-size: var(--text-2xl); letter-spacing: -.02em; }
  .consola-ingreso__marca .zd-muted { margin: 0; }
</style>
</head>
<body class="zd-root">
<!-- CH-29 (DEC-154): unauthenticated /consola. -->
<section class="consola-ingreso" data-screen-label="Ingreso a la consola" data-change="CH-29" data-estado="implementado">
  <div class="consola-ingreso__caja">
    <div class="consola-ingreso__marca">
      <strong>ZeroDashboard</strong>
      <p class="zd-muted">Consola del implementador</p>
    </div>
    <form id="form-ingreso" class="zd-card zd-form" action="/consola/ingresar" method="post" novalidate>
      <h1 class="zd-h2">Ingresar</h1>
      <div class="zd-field">
        <label class="zd-label" for="nombre">Nombre</label>
        <input class="zd-input" id="nombre" name="nombre" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" required>
      </div>
      <div class="zd-field">
        <label class="zd-label" for="clave">Clave</label>
        <input class="zd-input" id="clave" name="clave" type="password" autocomplete="current-password" required>
      </div>
      <div id="aviso-ingreso" class="zd-banner zd-banner--error" role="alert" hidden>
        <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>
        <div>
          <p class="zd-banner__title">No se pudo ingresar</p>
          <p class="zd-banner__body" id="texto-aviso">Nombre o clave incorrectos.</p>
        </div>
      </div>
      <button id="boton-ingresar" class="zd-btn zd-btn--primary zd-btn--block" type="submit">
        <svg id="icono-cargando" class="zd-icon zd-icon--spin" aria-hidden="true" viewBox="0 0 24 24" hidden><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
        <span id="etiqueta-ingresar">Ingresar</span>
      </button>
    </form>
    <p class="zd-meta">Las cuentas de operador se crean con <code>npm run operador:alta</code>.</p>
  </div>
</section>
<script>
var formulario = document.getElementById('form-ingreso');
var campoNombre = document.getElementById('nombre');
var campoClave = document.getElementById('clave');
var aviso = document.getElementById('aviso-ingreso');
var textoAviso = document.getElementById('texto-aviso');
var boton = document.getElementById('boton-ingresar');
var etiqueta = document.getElementById('etiqueta-ingresar');
var iconoCargando = document.getElementById('icono-cargando');
var MENSAJE_CREDENCIALES = 'Nombre o clave incorrectos.';
var MENSAJE_RED = 'No se pudo contactar con la consola. Revisá que la aplicación esté en marcha y volvé a intentar.';
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
  etiqueta.textContent = 'Ingresando…';
  iconoCargando.hidden = false;
  fetch('/consola/ingresar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: campoNombre.value, clave: campoClave.value })
  }).then(function (respuesta) {
    if (respuesta.ok) {
      window.location.reload();
      return null;
    }
    if (respuesta.status === 401) {
      fallar(MENSAJE_CREDENCIALES);
      return null;
    }
    fallar(MENSAJE_RED);
    return null;
  }).catch(function () {
    fallar(MENSAJE_RED);
  });
});
</script>
</body>
</html>
`;

/** Resolves the operator a request's `Cookie` header names, or `null` when there is none. */
export type ResolverOperador = (cabeceraCookie: string | undefined) => Promise<OperadorAutenticado | null>;

/**
 * `GET /consola`. Exempt from the operator guard and from the tenant header, because it is
 * where an operator without a session logs in (DEC-152). With a valid session it serves
 * the console naming the operator; without one, the login screen. It takes a resolver
 * rather than a `PrismaClient` so the page itself still touches no database: production
 * passes `resolverSesionConsola` (`src/rutas.ts`), the console tests a fixed operator.
 * `no-store`, because the page names a person and changes with the session. `/` is left
 * unclaimed.
 */
export function registerConsolaRoute(app: FastifyInstance, resolverOperador: ResolverOperador): void {
  app.get('/consola', async (request, reply) => {
    const operador = await resolverOperador(request.headers.cookie);
    const documento = operador === null ? DOCUMENTO_INGRESO : documentoConsola(operador.nombre);
    return reply.code(200).type('text/html; charset=utf-8').header('cache-control', 'no-store').send(documento);
  });
}
