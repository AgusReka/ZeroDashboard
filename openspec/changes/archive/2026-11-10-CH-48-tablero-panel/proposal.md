# Proposal: CH-48 — Panel dashboard

**Status**: ready for spec and design. Inputs: exploration.md, DEC-183, DEC-184, DEC-198, DEC-199, DEC-200, DEC-201, DEC-202. Stories R3h, R4h, R5h. Depends on CH-46 and CH-47, both merged.

The eight open questions of the exploration were answered with the recommended option by the agent, under the user's instruction of 2026-11-10 to keep going without stopping. They are recorded as DEC-201 and DEC-202, both open to the user's review.

## Intent
P1 can build each tenant's dashboard (CH-46), and Chart.js is served (CH-47), but the client sees nothing. This change shows the dashboard in the panel. Each report runs live on the dashboard's connection. Its period can be chosen from the days P1 declared. A line says when the business's data was last updated. Every chart has an equivalent accessible table. No row is stored, and the tenant comes only from the session.

## Scope

### In Scope
- **Panel API (DEC-201).**
  - `GET /api/panel/tablero` answers the dashboard configuration in business terms, plus the freshness of the tenant's data.
  - `GET /api/panel/tablero/:reporteId/resultado?dias=N` runs one report of the session tenant's dashboard and answers a closed `estado`.
  - Both are exact rows of `RUTAS_PANEL_PUBLICAS`, session-guarded, with `Cache-Control: no-store`.
- **Run limits (DEC-201).** A per-tenant gate of 3 runs in flight with a bounded FIFO queue and `429` beyond it, and single-flight on `(tenant, report, days)`. All in memory, holding nothing once a run ends.
- **Shared run.** The report half of the console test (days, date, cap, `limite = tope + 1`) moves to one module that the console test and the panel both call.
- **Audit (DEC-202).** `ejecutarSobreVistas` accepts `auditoria: null`. Panel runs write no `RegistroEjecucion` row and log one closed-field `info` line.
- **Projection (rule 5).** Only the assigned columns leave the server, picked by index. Dates are normalized and chart values are checked as numbers.
- **Page.**
  - A «Tablero» / «Avisos» navigation, shown only when the dashboard has at least one report.
  - One card per report: number, table, bars or line, with a period select when the report declares days, its own loading, empty and error states and «Reintentar».
  - The freshness line, and «Actualizar» with no timer.
  - The Telegram card moves below «Mis automatizaciones» (UX review P-07).
- **Charts (DEC-184, DEC-200).** The first `<script src>` of the vendored Chart.js, colors from the design tokens, a collapsed «Ver los datos en una tabla» per chart, and fallback to the table when the library does not load.
- **Design guide first.** P-08 «Tablero» in `guidelines/pantallas.md`, the clarified `SKILL.md` scope line, and the number-card, nav and chart rules, in both skill copies.
- **Docs.** `docs/guia/09-reportes.md` (panel section) and the map row.

### Out of Scope
- The console (CH-45, CH-46 are done) and the demo data (CH-49).
- Activating automations from the panel, and «Último resultado» (CH-27, P-06, out under DEC-93).
- Any cache of results, any stored period preference, auto-refresh.
- A "desactualizada" badge: reports have no tolerance to compare with.
- An audit row for panel runs (DEC-202), and a rate limiter on the login.
- UX review P-09 (cards stating their rule): next UX batch.

## Capabilities

### New Capabilities
- `client-panel-dashboard`: the two panel routes, their checks, the result states, the projection, the run gate, the freshness line, and the dashboard section of the panel page with its cards and charts.

### Modified Capabilities
- `tenant-isolation`: the two-tenant proof for the panel dashboard routes.
- `report-catalog`: one shared run path for the console test and the panel.
- `execution-audit`: panel report runs are not audited (DEC-202).
- `shared-visual-system`: the panel shell becomes the first consumer of the vendored chart script.
- `client-panel-automations`: the glossary requirement no longer forbids the live dashboard's projected results.
- `client-panel-telegram`: the card sits below «Mis automatizaciones».

## Approach
Follow the existing panel routes (`levantarSesionPanel` plus `conTenantActivo`, exact rows) and the engine path of the console test, with no new engine capability. The run is extracted, not copied. The page grows through a new module of markup and script strings imported by `panel.ts`, so `panel.ts` does not swell and the automations script stays last. Three chained PRs (CH-48a server, CH-48b page without the library, CH-48c charts), each shippable alone, after a docs-only PR with DEC-201 and DEC-202.

## Rules Check
- **Rule 1.** P2 picks a report of its own dashboard and one of the declared days. No route takes SQL, and the period is a validated integer (DEC-183, DEC-198).
- **Rule 2.** The tenant comes only from the session. The report id is checked against the session tenant's `Tablero`, and the connection is the dashboard's. `X-Tenant-Id` has no effect. An automated two-tenant test covers both routes.
- **Rule 3.** Unchanged: the engine's read-only layers apply to every run.
- **Rule 4.** The date is computed by the server and bound as a driver parameter, as in the console test.
- **Rule 5.** Only the assigned columns, picked by index, reach the browser. Nothing is stored (DEC-93): no cache, no audit row, and the single-flight map holds only a promise while a run is in flight.
- **Rule 6, anti-scope.** The engine's timeouts and caps stay as they are. The gate sits in front of the engine.
- **Rule 7.** No new secret or environment variable: the gate's numbers are constants.

## Rollback
Each slice reverts on its own. Reverting CH-48c leaves the cards with their tables. Reverting CH-48b leaves today's panel page. Reverting CH-48a removes the routes and restores `probarReporte`. No migration and no stored data, so nothing to clean up.

## Affected Areas
- `src/reportes/reporte-ejecucion.ts` (new), `src/reportes/reporte-prueba.ts`
- `src/ejecucion/ejecucion-sobre-vistas.ts`
- `src/panel/panel-tablero.ts`, `panel-tablero-rutas.ts`, `panel-tablero-pagina.ts` (new), `src/panel/panel.ts`
- `src/aislamiento/contexto-tenant.ts`, `src/app/rutas.ts`
- Tests: `src/panel/`, `src/aislamiento/aislamiento-panel.test.ts`, `src/reportes/`, `src/consola/consola-auth.test.ts`, `src/app/rutas.test.ts`
- `.claude/skills/zerodashboard-design/` and `.agents/skills/zerodashboard-design/` (`SKILL.md`, `guidelines/pantallas.md`)
- `docs/guia/09-reportes.md`, `docs/02-mapa-de-changes.md`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scheduled automations starved of agent sessions | Medium without the gate | Gate of 3 per tenant, below the agent's 8 sessions, with a test |
| A refactor of the console test changes its behavior | Low | The existing `reporte-prueba` tests run unchanged |
| `panel.test.ts` coupling: last-script extraction and the glossary scan | Medium | The automations script stays last, and the new copy is checked against the glossary |
| Non-numeric values from the replica (`numeric` and `bigint` as strings) | Medium | Values are converted on the server. A chart value that is not a number makes the card `no-disponible` |
| A corrupt stored report breaks the whole dashboard | Low | Per-card `no-disponible` plus an `error` log, never a 500 for the configuration |
| Size, about 2,000 lines | Certain | Three chained slices, `size:exception` where a slice passes 400 with tests |
| The decisions were taken by the agent | Certain | DEC-201 and DEC-202 are marked for the user's review, and the docs PR goes first |

## Success Criteria
- [ ] A client sees the reports of their dashboard in order, each with its number, table or chart, and with a table for every chart.
- [ ] Changing a card's period re-runs only that card, and only declared days are accepted.
- [ ] The freshness line shows the last update, or says it is unknown. It never shows unknown data as current.
- [ ] Tenant A never receives tenant B's configuration, report or rows, also with B's `X-Tenant-Id`. This is proven by an automated test.
- [ ] At most 3 runs per tenant are in flight. Beyond the queue the answer is 429, and nothing is stored.
- [ ] Panel runs write no audit row and log no `error` line for a missing operator.
- [ ] `npm run test:db` and `npx tsc -p tsconfig.json --noEmit` pass, apart from the known failures.
