# Exploration: CH-48 — Panel dashboard (live run, declared period, freshness, accessible table per chart)

Status: **explored** (2026-11-10). The eight decisions below were taken by the agent with the recommended option, under the user's instruction of 2026-11-10 to keep going without stopping, and recorded as DEC-201 and DEC-202, both open to the user's review. No research phase: everything is internal to the repository. Store: openspec. Stories R3h, R4h, R5h. Depends on CH-46 (merged) and CH-47 (merged). Next free decision number: DEC-203.

Constraints that bind this change:
- **DEC-183** (`docs/01-decisiones.md:3430`): each dashboard view runs the reports live against the replica, no cache, no stored rows; the cap on rows is in code; the panel receives only the columns the visualization declares (rule 5); the tenant comes only from the panel session (DEC-135, rule 2); the dashboard shows the replica freshness (CH-24) "como información".
- **DEC-184** (`:3479`): Chart.js 4 on `<canvas>`, colors from the design tokens read with `getComputedStyle`, number and table without the library, an accessible table per chart, an error state (not a broken chart) when columns are missing.
- **DEC-198** (`:4156`): period = days declared by P1 per report, the first is the default, the server computes the date and binds it (rule 4); columns by role with a client title; row cap per visualization (number 1, bars 20, table 50, line 100); the stored columns are re-checked on every execution and a missing column is the report's error state.
- **DEC-199** (`:4221`): one connection per dashboard, 0 to 8 reports, unapproved views are advisory at save time, so CH-48 needs the report's error state anyway.
- **DEC-200** (`:4270`): Chart.js is served and pinned; "CH-47 solo sirve el archivo. El `<script>` del panel y el dibujo de los gráficos son de CH-48."
- **DEC-93** (`:1703`): execution metadata may be persisted; the content of returned rows may not. **DEC-135**: panel routes derive the tenant only from the session.

R3h (`docs/mapa-historias.md:166`): "Se ejecuta en vivo, sin guardar filas (DEC-93), sin SQL ni términos técnicos y con un tope de filas. El tenant sale de la sesión. Cada gráfico tiene una tabla equivalente accesible."
R4h (`:167`): "Solo los períodos que P1 declaró, con el valor validado y nunca SQL."
R5h (`:168`): "Frescura de la réplica visible, solo informativa (CH-24)."

Out of scope: the console (CH-45, CH-46 are done), the demo data (CH-49), activating automations from the panel, "último resultado" (CH-27, P-06, stays out under DEC-93).

## What exists (verified)

| Piece | State |
|---|---|
| Run path | `ejecutarSobreVistas` (`src/ejecucion/ejecucion-sobre-vistas.ts:46`) does ownership (404), the DEC-71 gate (409), values vs declaration (400), credential (409), execute, one audit row, answer. Report-specific logic (days → date → `valores`, `topeEfectivo`, `limite = tope + 1`) lives in the **non-exported** `probarReporte` (`src/reportes/reporte-prueba.ts:96-137`), with `diasDeLaPrueba` (`:90`). Pure helpers are in `src/reportes/reportes.ts` (`topeEfectivo :82`, `fechaDelPeriodo :165`, `faltantesEn :178`, `leerReporte :246`). |
| Result shape | `EjecucionExitosa` has `columnas: string[]` and `filas: unknown[][]` (positional), `corte`, `paginacion`, `duracionMs`; a failure is `{resultado:'fallo', fase, categoria, codigo, duracionMs}` (`src/ejecucion/consulta-ejecucion.ts:97-118`). Rows are positional, so rule 5 needs a projection by column index. |
| Timeouts | Connect 5 s, query 15 s plus a 2 s backstop (`config.ts:24,31`; `consulta-ejecucion.ts:131`). One new connection per execution (no pool). Worst case per report about 22 s. |
| Audit | `RegistroEjecucion.operadorId` and `operadorNombre` are `String` NOT NULL (`prisma/schema.prisma:428-429`); `origen` is free text; no foreign keys; a DB trigger refuses UPDATE, DELETE and TRUNCATE (DEC-162). `registrarEjecucion` **returns early and logs `error` "audit skipped: no operator"** when `request.operador` is undefined (`src/auditoria/auditoria.ts:273-276`). Panel routes are exempt from the operator guard (`EXENCIONES_OPERADOR` includes `RUTAS_PANEL_PUBLICAS`, `src/consola/consola-auth.ts:57`), so a panel request never has an operator. Calling `ejecutarSobreVistas` from the panel as is would run fine and log one `error` line per run. CH-45 already flagged this. `GET /auditoria` lists the newest `LIMITE_LISTADO` rows of the tenant. |
| Agent sessions | An agent serves at most **8 concurrent sessions** (`LIMITES.sesionesPorAgente`, `src/agente/registro-agentes.ts:13`, enforced at `:89`); the ninth is refused with `ESINAGENTE`. The scheduler dials through the same registry. An 8-report dashboard run fully in parallel takes every session of the tenant's agent, and a second tab, a refresh or a console test at the same time makes **scheduled automations fail** for that tenant. |
| Rate limiting | None anywhere in `src/` (no plugin, no per-tenant guard; the login has none either). |
| Dashboard data | `GET /tablero` is console-only. `Tablero` is scoped (`tenantId @unique`, `conexionId`, `reportes String[]`); `respuestaDe` (`src/tablero/tablero-rutas.ts:41`) is the model for reading it. The panel has no dashboard route. `Reporte` and `Tenant` are global (not in `MODELOS_AISLADOS`), so the panel reads the report by id and the tenant's freshness columns with the plain extended client, the id coming from the session. |
| Panel auth | `levantarSesionPanel` + `conTenantActivo({id, nombre}, ...)` (`src/panel/panel-automatizaciones.ts:276-283`); public rows in `RUTAS_PANEL_PUBLICAS` (`src/aislamiento/contexto-tenant.ts:162`), 9 rows today. A new panel route needs an exact row there, a call in `src/app/rutas.ts` (after `:152`), and the exemption checks derived from the set (`src/consola/consola-auth.test.ts:62-65`, which sizes `EXENCIONES_OPERADOR` from `RUTAS_PANEL_PUBLICAS`, and the route-table guard test `src/app/rutas.test.ts`). |
| Freshness today | Only `Tenant.ventanaDesactualizacionMinutos` and `replicaActualizadaEn` (null = "sin declarar", never "fresh"), set by P1 in the console (`src/tenants/frescura.ts`). The panel reads neither. A report has **no tolerance**, so a "desactualizada" status (which compares window vs a template tolerance) has nothing to compare against in the dashboard. |
| Panel page | `src/panel/panel.ts` is 965 lines: `CABEZA_PAGINA :58`, `documentoShell :222`, three inline `<script>` blocks, `registerPanelRoutes :955`. No CSP or security header anywhere (`rg` found none), so a `<script src="/ui/vendor/chart.umd.js">` needs no server change. The page is a single column with the Telegram card (P-07) above "Mis automatizaciones". There is no navigation. |
| Panel tests | `shellConScript` takes the **last** `<script>` (`src/panel/panel.test.ts:217`, also `:548`); the glossary test scans visible text and script string literals for `tenant|cron|sql|consulta|query|ejecución|réplica|parámetro|timeout|plantilla` (`:791-803`). New inline scripts must keep both working. |
| Two-tenant pattern | `src/aislamiento/aislamiento-panel.test.ts` (cookie per tenant, foreign `X-Tenant-Id` ignored) and `src/reportes/reporte-prueba.test.ts:171` (two tenants on the live test DB; a view's SQL can be a `VALUES` literal, so no external replica is needed). |
| Design system | `public/ui/styles.css` has `.zd-table`, `.zd-table-wrap`, `.zd-table-scroll`, `.zd-num`, `.zd-state`, `.zd-banner`, `.zd-skeleton`, `.zd-card`. It has **no number/KPI card, no chart component, no chart tokens, no tab/nav component for the panel**. Dark mode is both `[data-theme="dark"]` and `prefers-color-scheme: dark`. `--panel-max: 960px`. `SKILL.md:11` says "No ... implementes vistas con filas de resultados en el panel", written for P-06 (persisted last result); the live dashboard needs that line clarified. Rule in the guide: no screen outside `guidelines/pantallas.md`. |
| UX review | Lote 1 of `docs/revisiones/2026-11-10-revision-ux.md` is merged (PR #248): P-04 (available cards say who to ask) and P-08 are done. Still open and relevant: **P-07** (Telegram card sits first, with no action in some states) and **P-09** (cards do not state the rule), both "antes de CH-48". |

### Specs affected

- New capability: `client-panel-dashboard` (read of the dashboard config, per-report run, states, freshness line, page).
- `client-panel-auth` (new exact public rows), `report-catalog` (shared run, no change of rules), `execution-audit` (only if decision 3 is not (a)), `shared-visual-system` (first consumer of the vendored script, "No page loads the script in this change" becomes false), `tenant-dashboard` (Purpose line already says CH-48 renders it).
- Design skill: `guidelines/pantallas.md` (new P-08 Tablero), `SKILL.md:11`, a short chart/number-card guideline.

## Shape that fits

- **Routes (panel, session-guarded, exempt by exact row):**
  - `GET /api/panel/tablero`: no replica access. Answers the dashboard config in business terms: `reportes: [{ id, titulo, descripcion, visualizacion, periodo: { dias: [..], predeterminado } | null }]` in dashboard order, and `datos: { actualizadosEn: ISO|null }`. Never `nombre`, `sql`, `entidades`, `columnas` mapping, `conexionId` or a column name. A tenant with no dashboard answers `reportes: []`.
  - `GET /api/panel/tablero/:reporteId/resultado?dias=N`: runs one report of **this tenant's** dashboard. `:reporteId` is only a pick among the ids the session tenant's `Tablero` holds (else `404 reporte-no-encontrado`, the same answer for an unknown id and for another tenant's report). The connection is the dashboard's, never a parameter. `dias` is parsed by hand (`/^\d+$/`, then `includes` against the declared list; AJV coercion is avoided) and refused with `400 solicitud-invalida` if undeclared or if the report has no period.
- **Answer of the run**, always `200` once the route resolved the report, with a closed `estado`: `ok` (`columnas: [{rol, titulo}]`, `filas` positional **projected to the assigned columns only**, `corte: boolean`, `periodo: { dias, desde } | null`), `sin-datos` (ok and zero rows), `no-disponible` (DEC-71 gate 409, unreadable credential, report row out of the rules, missing assigned column), `tiempo-agotado` («Tu tienda tardó demasiado en responder.»), `sin-conexion` (connection phase failure) and `error` (anything else). No category, code, column name or SQL text ever leaves (the DEC-137 stance: the reason of a failure does not reach the client). `Cache-Control: no-store`.
- **Shared run.** Extract the report half of `probarReporte` into `src/reportes/reporte-ejecucion.ts` (days → `valores`, `tope`, `limite = tope+1`, call to `ejecutarSobreVistas`) used by both the console test and the panel. `ejecutarSobreVistas` gets `auditoria: ... | null` (null = write nothing and log nothing at `error`) so the panel path does not trip the "no operator" branch.
- **Rule 2.** The tenant is `sesion.tenantId` inside `conTenantActivo`; `Tablero`, `Conexion`, `VistaCanonica` are scoped; `X-Tenant-Id` has no effect; the report id and `dias` are the only client inputs, and both are checked against the tenant's own data.
- **Rule 5 / DEC-93.** The projection keeps only the assigned columns, by index; the rest of the row is dropped in memory and never serialized. Nothing is written (no audit row under option (a), no cache). An in-flight single-flight map holds a promise only while the run is in flight.
- **Page.** A new module `src/panel/panel-tablero-pagina.ts` (markup + script as strings, like `panel-telegram.ts`) is imported by `panel.ts`, so `panel.ts` does not grow by hundreds of lines. Script order keeps the automations script **last** so `panel.test.ts` keeps extracting it. The shell loads `<script src="/ui/vendor/chart.umd.js">` only in slice C.
- **Cards.** One `zd-card` per report: title, optional description, a period select when the report declares days, the body by visualization. Number: big `zd-num` value from a new card style. Table: `zd-table` inside `zd-table-wrap`/`zd-table-scroll`. Bars and line: `<canvas role="img" aria-label="...">` plus a `<details>` «Ver los datos en una tabla» with a real `<table>` (`<caption>`, `<th scope="col">`).
- **Client loading.** The page asks `GET /api/panel/tablero` first, then the report results through a small queue of 3 at a time, in dashboard order, each card with its own skeleton, error state and «Reintentar». Changing a card's period re-runs only that card. There is no timer; a visible «Actualizar» re-runs all.

## Decisions (each with a recommendation; the user answers, then DEC-201/202 are written)

### 1. Panel API shape

| Option | Pros | Cons |
|---|---|---|
| (a) **One call per report** (`/resultado` per report) with a per-tenant server gate and a client queue | Per-report error state and retry for free; progressive paint (first card appears in about 1 s even if the fourth is slow); a period change re-runs one report; the 8-session agent limit is respected by construction; each request is small | N+1 requests per page view (8 at most) |
| (b) One call that runs all reports | One round trip, simple client | One slow report delays all; payload is all-or-nothing; the period needs a map in the query string; partial failure shape is awkward; the server must still bound concurrency |

*Recommended: (a). Concurrency: the server admits at most **3 report runs in flight per tenant** (a constant in code, no env var), queueing FIFO up to a small bound and answering `429 demasiadas-solicitudes` beyond it; the client queue also uses 3. Timeouts stay the engine's (connect 5 s, query 15 s, rule 6: the engine is not extended); a per-report failure is a card state, never a page failure.* Needs a DEC (new panel routes, concurrency gate). Details (queue bound, abandoned requests: a queued run whose request closed is dropped) go to the design.

### 2. Period

| Option | Pros | Cons |
|---|---|---|
| (a) **Per report**: each card with a period shows its own select of the days P1 declared; default is the first declared (DEC-198) | Reports declare different lists (one may offer 7 and 30, another 30 and 90); matches R4h literally; re-runs one card | Several selects on a screen |
| (b) One global selector | Fewer controls | Only the intersection of the lists is valid; a report whose list lacks the value silently uses another one |

*Recommended: (a). Labels are «Últimos 7 días», «Últimos 30 días»; the card also states «Desde el 03/11» from `periodo.desde`. The choice is not stored (no preference model); a reload returns to the defaults. Reports without a period show no select.* Recorded inside DEC-201, no separate decision.

### 3. Audit of panel runs (needs a DEC; option (b) also needs a migration)

DEC-159 audits "todo camino de la consola"; scheduled runs stay in `Ejecucion` (DEC-159 option (b) with a "Sistema" operator was rejected). A panel run has no operator.

| Option | Migration | Notes |
|---|---|---|
| (a) **Panel runs write no `RegistroEjecucion` row.** A closed-field `info` log line per run (`reporteId`, `conexionId`, result, `filas`, `duracionMs`; never SQL, values or rows) | No | Same stance as scheduled runs. The SQL is a stored report written by P1 and audited when tested (`reporte-prueba`); P2 supplies one validated integer. Avoids growth |
| (b) Nullable `operadorId` and `operadorNombre`, `origen` `panel-reporte` | **Yes** (drop NOT NULL; the trigger blocks UPDATE/DELETE/TRUNCATE, not ALTER) | `GET /auditoria` and the console audit screen (C-12) must show «Cliente (panel)» instead of an operator: a console change |
| (c) Sentinel operator in the existing columns (`operadorId` = panel user id, `operadorNombre` = «Panel del cliente») | No | Overloads the meaning of `operadorId`; stores a client user id forever |
| (d) A separate actor field (`usuarioPanelId`) plus nullable operator | **Yes** | Cleanest data, largest change |

Volume matters: the table is append-only with no pruning (DEC-162), a dashboard view is up to 8 runs, and `GET /auditoria` returns the newest `LIMITE_LISTADO` rows, so panel runs would bury the operator's own entries unless the listing is also filtered by origin.

*Recommended: (a). It is reversible (a row type can be added later; rows written now can never be removed), and it keeps the audit about what the console does. If the user wants every replica read on the record, (b) is the right shape and the cost is the migration plus the audit screen.* Needs a DEC either way (DEC-202, because it touches DEC-159/DEC-162).

### 4. Freshness on the dashboard (R5h)

DEC-180's option (b) ("freshness also in the panel") was left open "solo si el cliente necesita verla"; CH-48's row (R5h) now requires it **on the dashboard only**; the P-05 activation warning stays out (P2 does not activate, DEC-137). DEC-183 already settles that the dashboard shows it as information, so no new DEC.

| Option | Notes |
|---|---|
| (a) **One line with the last update**: «Datos de tu negocio actualizados hace 3 h» (also the absolute `dd/mm, HH:mm` in the zone) and, with no date, «Todavía no tenemos la fecha de actualización de tus datos.» | Glossary-safe («los datos se actualizaron hace…»); null is never shown as fresh |
| (b) (a) plus the window: «Pueden tener hasta 3 h de atraso.» | More information, one more sentence; the window is P1's declaration |
| (c) A "desactualizada" badge | Not possible: reports have no tolerance to compare with (would need a new column and a DEC) |

*Recommended: (a). It goes in the `GET /api/panel/tablero` answer (a read of the session tenant's two `Tenant` columns), so it shows even while reports load. It is purely informative: it never blocks or alters a run (DEC-142).*

### 5. Rendering

- **Chart.js loading.** `<script src="/ui/vendor/chart.umd.js">` before the inline dashboard script, in the authenticated shell only. No SRI (DEC-200). If the script fails to load (`typeof Chart === 'undefined'`), bar and line cards degrade to their table and the card says nothing technical. Chart instances are created once per card and `destroy()`ed on re-run or period change.
- **Colors.** `getComputedStyle(document.body)` on `--accent` (series), `--text-2` (ticks, legend), `--border-1` (grid), `--surface-card`; font from `--font-sans`. Re-read and `chart.update()` on `prefers-color-scheme` change and when `data-theme` flips. No Chart.js palette.
- **Accessible table.** Options: (a) a `<details>` «Ver los datos en una tabla» per chart (collapsed, real `<table>`); (b) the table always visible below the chart; (c) a visually hidden table. *Recommended: (a). It is keyboard and screen-reader reachable, available to low-vision and sighted users who want the numbers, and does not double the height at 390 px. The `<canvas>` carries `role="img"` and an `aria-label` made from the title and the range of values.*
- **Number.** A card with the value in `--text-3xl`, `Intl.NumberFormat('es-AR')`, and the column title as label. **Table:** the system table; at most 50 rows (cap), numeric columns right-aligned only if every value is numeric.
- **Error and empty states** (no chart ever breaks): `sin-datos`, `no-disponible`, `tiempo-agotado`, `sin-conexion`, `error` each use `zd-state` with the DEC-137 formula (what did not happen, why in business terms, what we do, whether the client must act) and «Reintentar» where retrying can help. A non-numeric `valor` in a chart is `no-disponible`.
- **Cut.** When `corte` is true: «Mostramos solo los primeros 20 resultados.» (the number is the visualization's cap).
- **Rule 5 and DEC-93.** Only `columnas` titles and projected rows reach the browser; every value is assigned with `textContent` or handed to Chart.js (canvas). The browser keeps the data only in memory; `no-store` on the answer.
- **Date labels.** The engine returns `Date` objects as ISO strings in JSON. A `date` label would read «2026-11-03T00:00:00.000Z». The projection should send `Date` values as `YYYY-MM-DD` and the client format them `dd/mm` (design detail for slice A or C, no DEC).

### 6. Panel home layout (UX review P-07, P-09) and 390 px

| Option | Notes |
|---|---|
| (a) **Two sections under a small nav** (links with `aria-current`, hash `#tablero` / `#avisos`): «Tablero» and «Avisos» (automations + Telegram). The nav is shown **only when the tenant has at least one report**; otherwise the page is today's page, unchanged | No regression for tenants without a dashboard; automations and Telegram stop competing with eight cards; the Telegram card (P-07) moves below the list inside «Avisos», where it is no longer the first thing a P2 sees |
| (b) One long page: dashboard first, then Telegram, then automations | No new navigation; 8 cards at about 300 px each push the automations several screens down at 390 px |
| (c) A separate page `/panel/tablero` | One more exempt page row and a second shell to keep in sync |

*Recommended: (a), default section «Tablero» when it exists. P-09 (the card stating the rule and destination) is a different part of the screen; leave it to the next UX batch so CH-48 does not grow.* Layout lives in the design guide (new P-08 in `pantallas.md`, written before the markup), not in a DEC. Mobile: one column, cards full width, the nav as a second row under the header, charts at a fixed height of about 220 px, table in `zd-table-scroll`. Per the project memory there is no manual visual pass at 360/1280 px; the checks are the fake-DOM tests.

### 7. Slicing (chained PRs, like CH-43a/b/c)

A docs-only PR with DEC-201 and DEC-202 comes first (as PR #239 did for DEC-199).

| Slice | Content | Production | With tests, spec, guide |
|---|---|---|---|
| **CH-48a — server** | `reporte-ejecucion.ts` extraction; `auditoria` nullable in `ejecutarSobreVistas`; `panel-tablero.ts` (pure projection and states, per-tenant gate and single-flight, the two routes); two exact rows in `RUTAS_PANEL_PUBLICAS` and the wiring; spec `client-panel-dashboard`; **the automated two-tenant test (rule 2)** | about 300 | about 850 |
| **CH-48b — page, no library** | design guide first (P-08, `SKILL.md:11`, number card); `panel-tablero-pagina.ts`; nav and sections; freshness line; number and table cards; period select; all states; Telegram card move; bar and line cards show their table only | about 440 | about 850 |
| **CH-48c — charts** | `<script src>` of Chart.js; bar and line drawing; tokens through `getComputedStyle`, theme change; `<details>` table already in b is reused; `aria-label`; `shared-visual-system` spec line; guide `docs/guia/09-reportes.md` panel section and the map row | about 170 | about 450 |

Each slice ships on its own: after a, nothing is visible but the API is tested; after b the client already sees numbers, tables, period and freshness; c adds the drawing. Under the project convention (CH-44, CH-45, CH-46, CH-47 all merged with `size:exception`), a and b would need it when tests and specs count; production-only they are near the budget. A four-slice fallback splits b into b1 (nav, freshness, number and table) and b2 (period select, states, retry).

*Recommended: three chained slices as above.*

### 8. Rate limiting and abuse (P2 refreshing)

The real risk is not the count of requests but the **8-session agent cap shared with the scheduler** (see "What exists"), plus one new connection to the client's database per run and no cache by design.

| Option | Notes |
|---|---|
| (a) **Per-tenant gate of 3 in flight, bounded FIFO queue, `429` beyond; single-flight on `(tenantId, reporteId, dias)` while a run is in flight; queued runs of closed requests are dropped; client queue of 3; no timer, no auto-refresh; «Actualizar» disabled while loading** | In memory (one process), no dependency, leaves 5 agent sessions free; single-flight holds no result after it resolves, so DEC-93 and "sin caché" hold |
| (b) Nothing beyond the cap of 8 reports | A refresh storm or two tabs starves the scheduled automations of the same tenant |
| (c) A rate-limit plugin per session or IP | New dependency (the project has none for the front or the API), does not model the agent budget |
| (d) A short result cache | Contradicts DEC-183 "sin caché"; reopens DEC-93 |

*Recommended: (a).* Needs a DEC (inside DEC-201). The login endpoint has no limiter either; that is a separate matter and is not part of this change.

## Which points need a new DEC

| DEC | Content | Why it needs one |
|---|---|---|
| **DEC-201** | CH-48: per-report panel API (`GET /api/panel/tablero`, `.../:reporteId/resultado`), per-report period with the first declared as default, the per-tenant concurrency gate and single-flight, closed result states without technical detail, `no-store` | New panel surface and a limit on live execution that DEC-183 leaves open; AGENTS.md requires it before code |
| **DEC-202** | CH-48: panel runs and `RegistroEjecucion` (option chosen in decision 3) | Touches DEC-159 and DEC-162; if option (b) or (d), also a migration |
| No DEC | Freshness line (DEC-183 + DEC-142), Chart.js loading and colors (DEC-184, DEC-200), layout and navigation (design guide P-08), accessible table as `<details>` (DEC-184 leaves the form open) | Already covered, or design-guide material |

## Open product questions (answer in one line each; recommended option first)

| # | Question | Options | Recommended |
|---|---|---|---|
| 1 | API shape | (a) one call per report; (b) one call for all | **(a)** |
| 2 | Period | (a) per report, first declared is the default; (b) one global selector | **(a)** |
| 3 | Audit of panel runs | (a) no audit row, closed-field log; (b) nullable operator + origin `panel-reporte` (migration); (c) sentinel operator; (d) separate actor field (migration) | **(a)** |
| 4 | Freshness text | (a) last update only; (b) last update and window | **(a)** |
| 5 | Table for each chart | (a) collapsed `<details>`; (b) always visible; (c) visually hidden | **(a)** |
| 6 | Home layout | (a) nav «Tablero» / «Avisos», only when there are reports; (b) one long page; (c) separate page | **(a)** |
| 7 | Slicing | (a) three chained slices after a docs-only DEC PR; (b) one PR with `size:exception` | **(a)** |
| 8 | Abuse limits | (a) gate of 3 per tenant + single-flight + client queue; (b) nothing; (c) rate-limit plugin | **(a)** |

## Risks

- **Scheduler starvation** if the gate is skipped or set above the agent budget (decision 8). The gate lives in the process: two app instances would double it (the project runs one).
- **Audit gap** under option (a): a replica read by the panel leaves a log line, not a row. Mitigated by the fixed report SQL and the closed input; reversible later.
- **`panel.test.ts` coupling:** the last-script extraction and the glossary scan over script literals. New strings must avoid `consulta`, `réplica`, `ejecución`, `parámetro`, `plantilla`, `timeout`, `sql`, `tenant`, `cron`, `query`. The word "datos" is allowed; avoid "filas" in copy ("resultados", "productos").
- **Types from the replica:** `numeric` and `bigint` arrive as strings. Charts need numbers; a non-numeric `valor` must become `no-disponible`, never `NaN` bars. Dates need the label normalization above.
- **Missing design pieces** (number card, chart tokens, nav): they must enter `zerodashboard-design` before the markup, and `SKILL.md:11` must stop reading as a ban on the live dashboard.
- **Size:** about 2,000 lines overall with tests, specs and guide; the slicing above keeps the production code of each slice near or under 400.
- **Live cost:** up to 8 queries per view against the client's replica, by design (DEC-183 "Se resigna").
- **Corrupt stored report:** `leerReporte` throws on out-of-rule rows; in the panel that must be a card in `no-disponible` plus an `error` log, not a 500 for the whole dashboard.

## Ready for proposal

Yes, once the user answers the eight questions above (or accepts the recommendations): then DEC-201 and DEC-202 are registered in `docs/01-decisiones.md` in a docs-only PR and the proposal is written for slice CH-48a. No research phase.
