# Design: CH-30e1 — Audit screen in the console

Inputs: proposal.md, specs/query-console/spec.md, DEC-163, `src/auditoria.ts`.

## 1. Markup
- `<a id="nav-auditoria" class="zd-sidenav__item" href="#auditoria"><span>Auditoría</span></a>` after `nav-frescura`.
- After `pantalla-frescura`:

```html
<section id="pantalla-auditoria" aria-labelledby="titulo-auditoria" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-auditoria" class="zd-h1">Auditoría</h1>
    <p class="zd-pagehead__desc">Qué se ejecutó contra la réplica del tenant, cuándo y por quién. Es un registro: no se modifica ni se borra.</p>
  </div>
</header>
<div class="controles">
  <div><label for="aud-desde" class="zd-label">Desde</label><input id="aud-desde" class="zd-input" type="date"></div>
  <div><label for="aud-hasta" class="zd-label">Hasta</label><input id="aud-hasta" class="zd-input" type="date"></div>
  <div><label for="aud-resultado" class="zd-label">Resultado</label>
    <select id="aud-resultado" class="zd-select"><option value="">Todos</option><option value="ok">OK</option><option value="fallo">Falló</option></select></div>
  <button id="aud-filtrar" class="zd-btn zd-btn--secondary" type="button">Filtrar</button>
</div>
<p id="auditoria-aviso" class="ayuda" role="status"></p>
<div class="zd-table-wrap zd-table-scroll">
  <table class="zd-table">
    <thead><tr><th>Fecha y hora</th><th>Operador</th><th>Origen</th><th>Conexión</th><th>Consulta</th><th>SQL</th><th>Filas</th><th>Duración</th><th>Resultado</th></tr></thead>
    <tbody id="auditoria-cuerpo"></tbody>
  </table>
</div>
</section>
```

The ids join `IDS`; `pantalla-auditoria` joins `IDS_OCULTOS`. A comment above the section names CH-30e1, DEC-163 and DEC-162, like the other screens.

## 2. Script
- `PANTALLAS` gains `'auditoria'`; `mostrarPantalla` calls `cargarPantallaAuditoria()` when it is the active one; `cambiarTenant` reloads it when `pantalla-auditoria` is not hidden.
- **`ORIGENES_AUDITORIA`**: `consulta` → «Consulta», `plantilla-prueba` → «Prueba de plantilla», `validacion-mapeo` → «Validación de mapeo», `conexion-prueba` → «Prueba de conexión»; an unknown value is shown as it comes.
- **`filtrosAuditoria()`** returns `{ ok: true, query }` or `{ ok: false, mensaje }`:
  - `aud-desde` `YYYY-MM-DD` → `new Date(y, m - 1, d).toISOString()`; `aud-hasta` → `new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()`.
  - Desde later than hasta → «La fecha «Desde» es posterior a «Hasta».».
  - The query string uses `encodeURIComponent` and skips empty values.
- **`cargarPantallaAuditoria()`**, same ladder as `cargarPantallaConexiones`:
  - No tenant → empties `auditoria-cuerpo`, «Elegí un tenant para ver su auditoría.».
  - Invalid filters → the message, nothing sent.
  - Reads `GET /conexiones` for an `id → nombre` map (a failure leaves the map empty: names fall back to the short id), then `GET /auditoria` + query.
  - Network failure, `manejarFalloDeTenant`, non-JSON or non-200 → as in Conexiones; `400` → «Revisá las fechas del filtro.».
  - A generation counter, like `generacionVia`, drops an answer that arrives after a newer load.
  - Empty → «No hay ejecuciones registradas con estos filtros.»; `truncado` → «Se muestran las 200 ejecuciones más recientes. Acotá las fechas para ver las anteriores.»; else the notice is empty.
- **`filaAuditoria(registro, nombres)`** builds one `tr` with `celdaTenant`:
  - Fecha y hora: `fechaTenant(creadoEn)` plus `hh:mm:ss`, local.
  - Consulta: `consultaNombre + ' v' + consultaVersion` when there is a name; `'Plantilla ' + plantillaId` when `plantillaId`; else «Ad hoc».
  - SQL: a `details` whose `summary` holds the first 80 characters (plus «…» when cut) and whose body is a `code` with the full statement; all `textContent`.
  - Duración: `< 1000` → `N ms`; else seconds with one decimal and a comma (`1,2 s`).
  - Resultado: «OK», or «Falló: » + `mensajeDeFallo({ fase, categoria, codigo })`.
- `aud-filtrar` calls `cargarPantallaAuditoria()`.

## 3. Tests (`src/consola.test.ts`, CH-30e1 prefix)
- `nav-auditoria` comes after `nav-frescura`; `#auditoria` shows only `pantalla-auditoria` and marks its link current.
- With a tenant, showing the screen sends `GET /conexiones` and `GET /auditoria` with `X-Tenant-Id`; a failed `consulta` row shows operator, «Consulta», the connection name, «Stock v3» and «Falló: …».
- A row with `plantillaId` shows «Plantilla …»; an ad hoc row shows «Ad hoc»; an unknown connection id shows its first eight characters.
- Filters: same local day and `ok` → `desde`, `hasta` and `resultado=ok` in the URL, with `desde` equal to `new Date(y, m - 1, d).toISOString()`.
- Inverted dates → message, no `GET /auditoria`.
- No tenant → message, no request.
- `truncado: true` → the 200-rows notice; empty list → the empty notice; `400` → the dates notice.
- A `sql` with `<b>` renders verbatim and the long statement is cut to 80 characters in the summary.
- Switching tenant while the screen is shown reloads it.

## Files
- `src/consola.ts`, `src/consola.test.ts`
- `guidelines/consola.md`, both copies: C-12 marked as built by CH-30e1 in the change → screens table.

## Size
About 160 lines of code and 150 of tests. One PR.
