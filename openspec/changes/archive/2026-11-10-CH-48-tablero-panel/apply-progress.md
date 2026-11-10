# Apply progress: CH-48 — Panel dashboard

## CH-48a (server): tasks 1.1 to 4.2, done

Branch `ch48a/servidor`, from `master` after PR #249 (DEC-201, DEC-202). CH-48b (tasks 5 to 7) and CH-48c (tasks 8 to 10) are not started.

### Tasks done

- 1.1: `PedidoSobreVistas.auditoria` accepts `null`, which skips `registrarEjecucion`. The warn line, the gate and the answers are unchanged.
- 1.2, 1.3: `src/reportes/reporte-ejecucion.ts` with `diasDelPedido`, `ReporteAEjecutar`, `ContextoReporte`, `ResultadoReporte` and `ejecutarReporte`. `probarReporte` calls it with the `reporte-prueba` audit and keeps its answers. `diasDeLaPrueba` is gone.
- 1.4: `src/reportes/reporte-ejecucion.test.ts`: the `diasDelPedido` cases, and both audit choices bind the same date and ceiling under a fixed clock. `src/reportes/reporte-prueba.test.ts` passes unchanged.
- 1.5: `src/auditoria/auditoria-registro.test.ts`: a run with `auditoria: null` and no operator writes no row and logs no `error`; `/consultas/ejecutar` still writes one.
- 2.1 to 2.3: `src/panel/panel-tablero.ts` (constants, `leerDiasDeConsulta`, `entradaDeConfiguracion`, `respuestaDeEjecucion`, `normalizarValor`, `aNumero`, `crearCompuerta`) and `src/panel/panel-tablero.test.ts` (26 cases).
- 3.1, 3.2: `src/panel/panel-tablero-rutas.ts`, the two rows in `RUTAS_PANEL_PUBLICAS`, and the registration in `src/app/rutas.ts` after the Telegram routes.
- 3.3: `src/panel/panel-tablero-rutas.test.ts` (12 cases, live test DB, `VALUES` views).
- 3.4: `src/aislamiento/aislamiento-panel.test.ts`: a new two-tenant suite with the three `tenant-isolation` scenarios and the gate counting each tenant apart.
- 3.5: `src/app/rutas.test.ts`, `src/consola/consola-auth.test.ts` and `src/aislamiento/contexto-tenant.test.ts`: the rows are exact and exempt, and another method or a longer path stays scoped.
- 4.1, 4.2: the verification below.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `src/ejecucion/ejecucion-sobre-vistas.ts` | Modify | +18 / -10 |
| `src/reportes/reporte-ejecucion.ts` | Create | +88 |
| `src/reportes/reporte-prueba.ts` | Modify | +19 / -48 |
| `src/panel/panel-tablero.ts` | Create | +283 |
| `src/panel/panel-tablero-rutas.ts` | Create | +173 |
| `src/aislamiento/contexto-tenant.ts` | Modify | +4 |
| `src/app/rutas.ts` | Modify | +5 |
| `src/reportes/reporte-ejecucion.test.ts` | Create | +170 |
| `src/panel/panel-tablero.test.ts` | Create | +404 |
| `src/panel/panel-tablero-rutas.test.ts` | Create | +427 |
| `src/aislamiento/aislamiento-panel.test.ts` | Modify | +250 |
| `src/auditoria/auditoria-registro.test.ts` | Modify | +48 |
| `src/aislamiento/contexto-tenant.test.ts` | Modify | +41 |
| `src/app/rutas.test.ts` | Modify | +8 |
| `src/consola/consola-auth.test.ts` | Modify | +8 |

### Deviations from the design, with reasons

- **`sigueAbierto` reads the response, not the request.** The design's `!request.raw.destroyed && !reply.raw.writableEnded` would drop every queued run: on Node 24, `request.raw.destroyed` is already `true` once a GET's empty body has been read (checked with a plain `http` server). The route uses `!reply.raw.destroyed && !reply.raw.writableEnded`. `reply.raw.destroyed` turns `true` when the client goes away (also checked).
- **`Compuerta.pedir` answers `Promise<T | 'descartado'>`.** The design does not say what a dropped run resolves to. It resolves to the exported `DESCARTADO`, which only reaches requests that are already closed. The route answers it as `{ estado: 'error' }`, which goes nowhere.
- **`Compuerta` has an `ocupacion()` method, for tests only.** It proves that an idle tenant leaves no record.
- **The single-flight key uses the resolved days.** It is `tenant|report|days` after `diasDelPedido`, so a request with no `dias` and one with the default `dias` share a run. The design wrote `dias ?? '-'` from the raw query.
- **`no-store` is set in a route-level `onRequest` hook.** So the session hook's `401` carries it too, not only the handler's answers.
- **The `info` line's `filas` is `0` for `sin-datos`.** It is the row count for `ok` and `null` for every other state. The spec says "row count, or null".
- **The corrupt-report `error` line uses `app.log`**, like the `info` line, so both carry only their own fields.
- **The 400 for a malformed `dias` comes before the 404.** This is the design's order (§1.5 step 1). The spec lists the 404 first. Both answer before anything is dialed.
- **`ejecutarReporte` is checked through its two audit choices, not through the two routes.** The console route has no clock seam, and adding one would change its registrar. Both routes call this one function.

### Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
- `npm run build`: exit 0.
- Focused command of unit a, with `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_test DATABASE_URL=postgresql://zerodashboard:postgres@localhost:5434/zerodashboard_test`: 192 tests, 192 pass, 0 fail.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2102 tests, 2098 pass, 4 fail. The 4 are the known failures in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07).

### For CH-48b

- The page reads `GET /api/panel/tablero` → `{ reportes: [{ id, titulo, descripcion, visualizacion, periodo: { dias, predeterminado } | null }], datos: { actualizadosEn: string | null }, zonaHoraria }`.
- A run is `GET /api/panel/tablero/<id>/resultado[?dias=N]` → `200 { estado }`. With `ok` it also has `columnas: [{ rol, titulo }]`, `filas` (positional, `valor` already a number), `corte: boolean` and `periodo: { dias, desde: 'YYYY-MM-DD' } | null`. The other answers are `400 { error: 'solicitud-invalida', campos: ['/dias'] }`, `404 reporte-no-encontrado`, `429 demasiadas-solicitudes`, and `401 sesion-invalida` / `sesion-expirada` (or `409 tenant-desactivado`) from the session hook.
- Any query key other than `dias`, or `dias` that is not 1 to 3 digits, is a `400`. The page sends no other key.

## CH-48b (page without the library): tasks 5.1 to 7.1, done

Branch `ch48b/pantalla`, from `master` after CH-48a (PR #250). CH-48c (tasks 8 to 10) is not started.

### Tasks done

- 5.1 to 5.4: the design guide, both copies, identical (`diff -rq` empty). `SKILL.md` scope line as design §2.1; `pantallas.md` gets P-08 «Tablero» (purpose, data, nav, cards, number, table, chart box, states with the §2.4 copy, actions, freshness, implementation), P-07 now sits below «Mis automatizaciones», and the CH-48 row; `lenguaje.md` allows «resultados» on the dashboard.
- 6.1: `src/panel/panel-tablero-pagina.ts` with `ESTILOS_TABLERO`, `MARCADO_NAV`, `MARCADO_TABLERO` and `SCRIPT_TABLERO`. Bar and line cards show their table open inside `<details>`; no canvas.
- 6.2: `src/panel/panel.ts`: the styles in `CABEZA_PAGINA`; the nav between the header and `<main>`; the dashboard section, then `#seccion-avisos` with the list and, after it, the Telegram card; `SCRIPT_TABLERO` after «Salir» and before the automations script, which stays last.
- 6.3: `src/panel/panel-tablero-pagina.test.ts`, 35 cases on its own fake DOM with a controllable `fetch` and a fixed clock. No database.
- 6.4: `src/panel/panel.test.ts`: the dashboard script comes before the automations script, which is still last, once, only in the authenticated shell; the glossary scan covers `SCRIPT_TABLERO`'s literals; the Telegram card follows the list inside «Avisos»; «Actualizar» joins «Salir» as a static control.
- 7.1: the verification below.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `.claude/skills/zerodashboard-design/{SKILL.md,guidelines/pantallas.md,guidelines/lenguaje.md}` | Modify | +26 / -3 |
| `.agents/skills/zerodashboard-design/` (same three) | Modify | +26 / -3 |
| `src/panel/panel-tablero-pagina.ts` | Create | +477 |
| `src/panel/panel.ts` | Modify | +34 / -31 |
| `src/panel/panel-tablero-pagina.test.ts` | Create | +524 |
| `src/panel/panel.test.ts` | Modify | +33 / -3 |

### Deviations from the design, with reasons

- **The script is wrapped in its own function.** The automations script declares global `nodo`, `mostrar`, `fallar` and others; two classic scripts share one global scope, so the last one would overwrite the first's names.
- **Right alignment uses `is-num zd-num`.** In `components.css`, `.zd-num` only sets tabular figures; the right alignment of a table cell is `.zd-table .is-num`. Both classes go on all-number columns, and the tests check `zd-num`.
- **The cut line uses the number of rows received** as N («Mostramos solo los primeros N resultados.»). With `corte`, the server sends exactly the effective cap (`topeEfectivo`, which can be lower than the visualization's cap), and the page does not know `maxFilasPorConsulta`. A number card shows no cut line («los primeros 1 resultados» reads wrong).
- **A one-day option reads «Último día»**, not «Últimos 1 días».
- **A failing «Actualizar» keeps the cards** and shows a banner, «No pudimos actualizar el tablero.» / «Volvé a intentar en unos minutos.». The design only says what a failing first read does («Avisos» only).
- **`no-disponible` and `sin-datos` use `role="status"`**, the three states with «Reintentar» use `role="alert"`.
- **Card headers align to the top** and the select sits at the right on desktop, under the title on mobile (seen in the browser: aligned to the bottom, a card with no description left its title floating).
- **A table header over a number column keeps the sans font** (`.zd-table .is-num` sets mono, which looked off in a header).

### Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `npm run build`: exit 0.
- Focused command of unit b, with the `TEST_DB_*` variables and `DATABASE_URL` on port 5434: 65 tests, 65 pass, 0 skipped.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2138 tests, 2134 pass, 4 fail: the known `src/conexiones/conexiones.test.ts` 5.1, 5.3, 5.4 and CH-07.
- Browser (demo container, headless Chrome at 1280 and 390 px): «Tablero» with a number, a bar (as its table) and a table card, the period changed to 7 days, «Avisos», and every card in the error state after forcing `429`. No page exceptions.

### For CH-48c

- The bar and line bodies are built in `pintarResultado`, branch `vista === 'barras' || vista === 'linea'`: a `<details class="panel-datos">` with `open = true`, a `<summary>` «Ver los datos en una tabla» and `tablaDe(titulo, columnas, filas)`. Draw the canvas before that `<details>` and set `open` to false when `Chart` is a function.
- Each card object (`tarjeta`) has `reporte`, `dias`, `generacion`, `pendiente`, `descartada`, `cuerpo` and `elemento`. Every re-run goes through `encolar(tarjeta)`, and `vaciar(tarjeta)` clears the body: that is the place for `chart.destroy()`. «Actualizar» marks the old cards `descartada` in `pintarTablero`, so their charts must be destroyed there too.
- The `<script src="/ui/vendor/chart.umd.js">` goes before the `<!-- P-08 Tablero (CH-48) ... -->` comment and `<script>` that hold `SCRIPT_TABLERO` in `documentoShell`. The panel test checks `html.indexOf(SCRIPT_TABLERO)`.
- The page test runs the script with `new Function('document', 'fetch', 'window', 'Date', SCRIPT_TABLERO)`; add a `Chart` parameter and stub it there. The fake DOM's `Nodo` has no `getComputedStyle`: `colores()` needs a stubbed global or a parameter too.
- Values in a `tabla` column arrive as the driver returns them: a `COUNT` or `SUM` over `bigint` is a string ("26"), so that column is neither right-aligned nor formatted es-AR. The `valor` of a chart is always a number (the server converts it).
- «Desde el dd/mm» drops the year, which reads oddly for 366 days («Desde el 09/11» means last year).

## CH-48c (charts): tasks 8.1 to 10.1, done; 9.2 open

Branch `ch48c/graficos`, from `master` after CH-48a (PR #250) and CH-48b (PR #251). Task 9.2 stays open: the map row has PRs #250 and #251, and CH-48c's number goes in when its PR exists.

### Tasks done

- 8.1: `documentoShell` loads `<script src="/ui/vendor/chart.umd.js"></script>` right before the `<script>` that holds `SCRIPT_TABLERO`. The login page does not.
- 8.2: `barras` and `linea` cards draw a `<div class="panel-grafico">` (220 px) with a `<canvas role="img" aria-label="<título>: valores de <mín> a <máx>.">`, then the `<details>` folded. One dataset; `animation: false`, `maintainAspectRatio: false`, `locale: 'es-AR'`, legend hidden, y axis titled with the `valor` column. `colores()` reads `--accent`, `--text-2`, `--border-1` and `--font-sans` from `getComputedStyle(document.body)`; `tintar` writes them on the series, ticks, grid, border, y title and tooltip fonts. A `matchMedia('(prefers-color-scheme: dark)')` listener and a `MutationObserver` on `data-theme` re-tint every live chart and call `update()`. `vaciar` destroys the card's chart, so a re-run or a period change destroys it before the new one; «Actualizar» destroys the old cards' charts in `pintarTablero`. No `Chart`, a non-number value or a `Chart` that throws leaves the table open (the empty box hidden).
- Follow-up 1 (from CH-48b): a table column is numeric (`is-num zd-num`, `es-AR`) when it has a value and every non-empty value is a number or a decimal number as text without a leading zero (`/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/`). "007", "1e5", "XL" keep the column as text.
- Follow-up 2: «Desde el dd/mm/aaaa» when the year of `periodo.desde` is not the current year in the tenant's time zone (`Intl.DateTimeFormat('en-US', { timeZone, year })` on `Date.now()`).
- 8.3: `src/panel/panel-tablero-pagina.test.ts`: a `Chart` stub that records configs, `destroy` and `update` in order; the fake `window` has `getComputedStyle`, `matchMedia` and `MutationObserver`. New cases: bar card (canvas, label, folded table, config), line type, token colors trimmed, both theme paths, destroy on period change before the new chart, «Actualizar» destroying, non-number value and throwing `Chart`, narrow-label cut, numeric text columns, «Desde el» with and without the year (including 31 December in Buenos Aires after midnight UTC).
- 8.4: `src/panel/panel.test.ts`: the shell holds the script once, right before the dashboard script, and no other external script after it; the login page has none. The console page already has a test for exactly one script element.
- 9.1: `docs/guia/09-reportes.md`: «Lo que ve el cliente», «El límite de ejecuciones» and «Por qué no hay fila de auditoría»; the pending-views line names the real state; two limits updated.
- Guide and spec: P-08 (both copies, `diff -rq` empty) and the `client-panel-dashboard` delta spec state the two follow-ups.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `src/panel/panel-tablero-pagina.ts` | Modify | +165 / -13 |
| `src/panel/panel.ts` | Modify | +2 / -1 |
| `src/panel/panel-tablero-pagina.test.ts` | Modify | +251 / -4 |
| `src/panel/panel.test.ts` | Modify | +15 |
| `docs/guia/09-reportes.md` | Modify | +22 / -2 |
| `docs/02-mapa-de-changes.md` | Modify | +1 / -1 |
| `.claude/` and `.agents/` `skills/zerodashboard-design/guidelines/pantallas.md` | Modify | +2 / -2 each |
| `openspec/changes/CH-48-tablero-panel/specs/client-panel-dashboard/spec.md` | Modify | +2 / -2 |

### Deviations from the design, with reasons

- **`window.getComputedStyle`, `window.matchMedia`, `window.MutationObserver`**, not the bare globals: the same objects in the browser, and the page test stubs them on its fake `window`.
- **Fonts go per element** (ticks, y title, tooltip title and body), not through `Chart.defaults`: nothing global is changed, and a theme change patches the same keys.
- **A long bar label is cut on a chart narrower than 600 px** (11 characters and «…»), through a `ticks.callback` on the bar x axis. Seen at 390 px: the rotated product names took most of the 220 px and left the bars short. The tooltip and the table keep the whole label. Line charts keep their `dd/mm` labels.
- **A `Chart` that throws, or a non-number `valor`, falls back to the open table**, like a missing `Chart`. The server already turns a non-number `valor` into `no-disponible`; this is a guard.
- **The x grid is hidden and the y border too**; the y grid carries `--border-1`. Less ink, the same token.
- **Numeric text excludes leading zeros and exponents**, so codes stay text. A code column made only of plain numbers ("1234") reads as a number (1.234); this is in the guide's limits.

### Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `npm run build`: exit 0. `npm run build:agente`: exit 0.
- Focused command of unit c (`src/panel/panel-tablero-pagina.test.ts src/panel/panel.test.ts src/compartido/estilos-rutas.test.ts`, with the `TEST_DB_*` variables and `DATABASE_URL` on port 5434): 89 tests, 89 pass.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2148 tests, 2144 pass, 4 fail: the known `src/conexiones/conexiones.test.ts` 5.1, 5.3, 5.4 and CH-07. It ran before the narrow-label cut, which the focused run covers.
- Browser (demo container, headless Chrome, 1280 and 390 px, light and dark): a number, «Lo más vendido» as bars, a table and «Pedidos por día» as a line, drawn in the token colors (light `#0f6b5c` / ticks `#4a535c` / grid `#d1d7dc`; dark `#3ea38e` / `#b2bbc3` / `#22282e`), both theme paths re-tinting, the tables folded, «Pedidos» and «Unidades» of the text table right-aligned, «Desde el 09/11/2025» on the 366-day cards. A period change with no data destroys the line chart (2 live charts to 1). With the script blocked: no canvas, both tables open. No page exceptions.
