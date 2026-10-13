# Design: CH-30a — Console shell and `#` navigation

Inputs: proposal.md, the `query-console` delta, DEC-164 to DEC-166, the design guide (`guidelines/consola.md` sections 1 and 5) and the skill's `SideNav`, `PageHeader` and `ScopeTag` components.

## 1. Files

| File | Change |
|---|---|
| `public/ui/components/components.css` | Copied from `.claude/skills/zerodashboard-design/components/components.css`, byte for byte (requirement "Vendored Files Are Verbatim") |
| `src/consola.ts` | Markup reorganized into the shell; bridge style adjusted; `mostrarPantalla()` and its `hashchange` listener |
| `src/consola.test.ts` | Harness gains `location.hash` and window listeners; new ids; shell, order and navigation cases |

## 2. Markup (console document)

```html
<header id="barra-tenant" class="zd-tenantbar"> … unchanged … </header>
<div class="zd-shell">
  <nav class="zd-sidenav" aria-label="Secciones de la consola">
    <div class="zd-sidenav__brand"><span class="zd-sidenav__brandname">ZeroDashboard</span><span class="zd-eyebrow">Consola</span></div>
    <div class="zd-sidenav__scope">
      <span class="zd-sidenav__subheading">Trabajo diario</span>
      <a id="nav-consultas" class="zd-sidenav__item" href="#consultas"><span>Consultas</span></a>
      <a id="nav-automatizaciones" class="zd-sidenav__item" href="#automatizaciones"><span>Automatizaciones</span></a>
      <a id="nav-frescura" class="zd-sidenav__item" href="#frescura"><span>Frescura de datos</span></a>
    </div>
  </nav>
  <main class="zd-page">
    <p id="banner" class="banner" role="alert" hidden></p>          <!-- G2 literal, unchanged -->
    <section id="pantalla-consultas" aria-labelledby="titulo-consultas">
      <header class="zd-pagehead"> scope tag · <h1 id="titulo-consultas" class="zd-h1">Consultas</h1> · the former "Solo lectura…" help </header>
      <form id="formulario"> … unchanged … </form>
      <p id="estado" …>, div.zd-table-wrap > table#resultados, div.paginacion   <!-- moved here -->
      <section id="guardado"> … unchanged … </section>
    </section>
    <section id="pantalla-automatizaciones" hidden> page header · <section id="automatizaciones"> … </section></section>
    <section id="pantalla-frescura" hidden> page header · <section id="frescura"> … </section></section>
  </main>
</div>
```

- The former page-level `<h1>Consola de consultas</h1>` becomes the Consultas page header's `<h1>Consultas</h1>`; each other screen gets its own `<h1>`. The sections' existing `<h2>` stay.
- The scope tag is static text: `<span class="zd-scope zd-scope--tenant">Del tenant activo</span>`; the tenant's name stays in the bar, the one place that names it (T4).
- Screens start with `hidden` except Consultas, so the document is usable before the script runs.

## 3. Script

```js
var PANTALLAS = ['consultas', 'automatizaciones', 'frescura'];
function mostrarPantalla() {
  var pedida = String(window.location.hash || '').replace(/^#/, '');
  var activa = PANTALLAS.indexOf(pedida) === -1 ? 'consultas' : pedida;
  PANTALLAS.forEach(function (nombre) {
    document.getElementById('pantalla-' + nombre).hidden = nombre !== activa;
    var enlace = document.getElementById('nav-' + nombre);
    if (nombre === activa) { enlace.setAttribute('aria-current', 'page'); } else { enlace.removeAttribute('aria-current'); }
  });
}
window.addEventListener('hashchange', mostrarPantalla);
mostrarPantalla();
```

Called before `cargarTenants()`. No `zd-*` token, no class assignment (G3'). The script finds every other node by id, as today, so nothing else moves.

## 4. Bridge style

- Remove `body.zd-root > :not(#barra-tenant) { margin-inline: … }`: the shell and `.zd-page` own the layout now.
- Keep every other rule (`#barra-tenant`, tables, wizard, versions, `#operador`).
- Add: `@media (max-width: 48rem) { .zd-shell { grid-template-columns: minmax(0, 1fr); } .zd-sidenav { border-right: 0; border-bottom: var(--border-width) solid var(--border-1); } }`.

## 5. Tests

- Harness: `ventana.location.hash` (default `''`) and `ventana.addEventListener(tipo, fn)` storing listeners; a helper `irA(escenario, hash)` sets the hash and fires `hashchange`. `Nodo` gains `setAttribute`, `removeAttribute`, `getAttribute` if missing.
- `IDS` adds `pantalla-consultas`, `pantalla-automatizaciones`, `pantalla-frescura`, `nav-consultas`, `nav-automatizaciones`, `nav-frescura`; the two non-Consultas screens join `IDS_OCULTOS`.
- New cases: default screen and current link; switching by `hashchange`; unknown hash; markup order (execute button < results < saved queries, all inside `pantalla-consultas`); banner outside every screen.
- Existing suites unchanged and green: G1, G2, G3, G3', the wizard guard, CH-29's login and operator cases.

## 6. Trade-offs
- **Text-only navigation.** The guide's icons need inline SVGs per item; they come with the screens of CH-30b onwards.
- **No sub-views yet.** `#automatizaciones/alta` stays an in-page wizard as today.

## 7. Size forecast
~315 lines, one PR.
