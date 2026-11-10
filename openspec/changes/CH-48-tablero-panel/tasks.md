# Tasks: CH-48 — Panel dashboard

Inputs: proposal.md, the seven specs under specs/, design.md.

DEC-201 and DEC-202 go on `v2/dec-201-202` from `master`, in their own docs-only PR, before any code (AGENTS.md).

Delivery: three chained PRs (exploration decision 7, taken under the user's delegation of 2026-11-10). Each slice passes 400 lines with tests, so each carries `size:exception`, following CH-44 to CH-47.
- **CH-48a** — server — branch `ch48/api-tablero-panel` from `master` after the DEC PR merges; carries the planning artifacts.
- **CH-48b** — page without the library — branch `ch48/pantalla-tablero-panel` from CH-48a.
- **CH-48c** — charts — branch `ch48/graficos-tablero-panel` from CH-48b.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,250, without the planning artifacts: a ~915 (395 production), b ~890 (420 production), c ~440 (150 production) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Three chained PRs, CH-48a → CH-48b → CH-48c, each with `size:exception`. Fallback: split b into b1 (nav, freshness, number and table) and b2 (period select, states, retry) |
| Delivery strategy | exception-ok |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| a | Shared run, `auditoria: null`, panel API, gate, rows, two-tenant proof | CH-48a | `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npx tsx --test src/panel/panel-tablero*.test.ts src/reportes/reporte-*.test.ts src/aislamiento/aislamiento-panel.test.ts src/aislamiento/contexto-tenant.test.ts src/auditoria/auditoria-registro.test.ts src/app/rutas.test.ts src/consola/consola-auth.test.ts` | `npm run test:db` on port 5434 | Revert the slice: the routes and rows go, `probarReporte` gets its body back. No data |
| b | Guide first, then the page: nav, freshness, cards, period, states, Telegram move | CH-48b | `npx tsx --test src/panel/panel-tablero-pagina.test.ts src/panel/panel.test.ts` with the `TEST_DB_*` variables | N/A: fake DOM; the page calls only the routes of a | Revert the slice: the panel page is today's again, the API stays |
| c | Chart.js consumer, drawing, tokens, theme, guide and map | CH-48c | `npx tsx --test src/panel/panel-tablero-pagina.test.ts src/panel/panel.test.ts src/compartido/estilos-rutas.test.ts` with the `TEST_DB_*` variables | N/A: stub `Chart` in the fake DOM | Revert the slice: charts show as their tables |

## 0. Decision
- [x] 0.1 DEC-201 and DEC-202 in `docs/01-decisiones.md`, and the map's numbering line (DEC-203) and CH-48 row in `docs/02-mapa-de-changes.md`, committed on `v2/dec-201-202` from `master` before any code. PR #249, merged.

## CH-48a — server

### 1. Shared run
- [x] 1.1 `src/ejecucion/ejecucion-sobre-vistas.ts`: `auditoria` accepts `null`, which skips `registrarEjecucion` (design §1.1).
- [x] 1.2 `src/reportes/reporte-ejecucion.ts`: `diasDelPedido`, `ReporteAEjecutar`, `ContextoReporte`, `ejecutarReporte` (design §1.2).
- [x] 1.3 `src/reportes/reporte-prueba.ts`: `probarReporte` calls `ejecutarReporte` with the `reporte-prueba` audit, keeping its answers. `diasDeLaPrueba` is removed.
- [x] 1.4 `src/reportes/reporte-ejecucion.test.ts`: `diasDelPedido` cases; same date and `limite` for both callers under a fixed clock. `src/reportes/reporte-prueba.test.ts` passes unchanged.
- [x] 1.5 `src/auditoria/auditoria-registro.test.ts`: `auditoria: null` writes no row and logs no `error`; a console path still writes one row.

### 2. Pure panel logic and gate
- [x] 2.1 `src/panel/panel-tablero.ts`: constants, `leerDiasDeConsulta`, `entradaDeConfiguracion`, `respuestaDeEjecucion`, `normalizarValor`, `aNumero` (design §1.3).
- [x] 2.2 `src/panel/panel-tablero.ts`: `crearCompuerta` with join, admit, start, drop and cleanup (design §1.4).
- [x] 2.3 `src/panel/panel-tablero.test.ts`:
  - `dias` shapes: absent, "7", "7.0", "-7", "1e1", repeated key, extra key;
  - configuration entries carry no technical key; a corrupt row is listed with a null period;
  - every state row of "Closed Result States"; the projection drops an `email` column; numeric strings; a non-numeric `valor`; dates; `corte`;
  - gate: a 4th run waits; another tenant does not; beyond 8 queued is `'lleno'`; single-flight calls once and answers both; a second identical request after the end runs again; a closed request is dropped; a throw frees its slot; an idle tenant leaves no record.

### 3. Routes and wiring
- [x] 3.1 `src/panel/panel-tablero-rutas.ts`: `registerPanelTableroRoutes` with both routes, `no-store`, the refusal order, the `info` line and the corrupt-report `error` line (design §1.5).
- [x] 3.2 `src/aislamiento/contexto-tenant.ts`: the two exact rows in `RUTAS_PANEL_PUBLICAS`, with a CH-48 comment. `src/app/rutas.ts`: register after the Telegram routes with `zonaHoraria`, `topeFilas` and `canales`.
- [x] 3.3 `src/panel/panel-tablero-rutas.test.ts` (live test DB, `VALUES` views):
  - configuration in order; no dashboard; empty dashboard; freshness null and set; no technical key;
  - 401 with no cookie; `no-store` on both;
  - 404 for a catalog report not on the dashboard; 400 `/dias` for undeclared and for a report with no period; default period;
  - `ok` with only the assigned columns; `sin-datos`; `no-disponible` for unapproved views, a missing column and a corrupt report;
  - no `RegistroEjecucion` row and no `error` line; one `info` line with the six fields;
  - 429 through an injected gate that answers `'lleno'`.
- [x] 3.4 `src/aislamiento/aislamiento-panel.test.ts`: the three two-tenant scenarios of `tenant-isolation`, plus the gate counting each tenant apart (rule 2).
- [x] 3.5 `src/app/rutas.test.ts`, `src/consola/consola-auth.test.ts`, `src/aislamiento/contexto-tenant.test.ts`: the two rows are exact and exempt; the counts derived from `RUTAS_PANEL_PUBLICAS` hold; `POST /api/panel/tablero` and a longer path stay scoped.

### 4. Verification (CH-48a)
- [x] 4.1 `npx tsc -p tsconfig.json --noEmit`, `npm run build`, and the focused command of unit a.
- [x] 4.2 `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`; only the known failures may fail.

## CH-48b — page without the library

### 5. Design guide first
- [x] 5.1 `.claude/skills/zerodashboard-design/SKILL.md`: the scope line rewritten as design §2.1 says (P-06 stays out; the live dashboard is allowed).
- [x] 5.2 `.claude/skills/zerodashboard-design/guidelines/pantallas.md`: P-08 «Tablero» (purpose, data, nav, cards, number card, table, chart box, states with the copy of design §2.4, actions, freshness); P-07 moves below «Mis automatizaciones»; the CH-48 row of the change table.
- [x] 5.3 `.claude/skills/zerodashboard-design/guidelines/lenguaje.md`: «resultados» for the dashboard.
- [x] 5.4 The same three edits in `.agents/skills/zerodashboard-design/`, and a check that both copies are identical (`diff -rq`).

### 6. Page
- [x] 6.1 `src/panel/panel-tablero-pagina.ts`: `ESTILOS_TABLERO`, `MARCADO_NAV`, `MARCADO_TABLERO`, `SCRIPT_TABLERO` (design §2.2, §2.3). Chart cards render their table open; there is no canvas yet.
- [x] 6.2 `src/panel/panel.ts`: styles into `CABEZA_PAGINA`; nav and dashboard section; `#seccion-avisos` wrapping the list and, after it, the Telegram card; `SCRIPT_TABLERO` before the automations script, which stays last.
- [x] 6.3 `src/panel/panel-tablero-pagina.test.ts` (fake DOM):
  - nav only with reports; default «Tablero»; hash switch and `aria-current`; configuration failure shows «Avisos» only;
  - 3 requests at a time in dashboard order; a slow card does not block the rest; stale answers dropped;
  - every state with its copy; «Reintentar» re-runs one card; 429 and network show the error state; 401 reloads;
  - period select options and default; changing it sends one request with `dias`; no select and no `dias` without a period;
  - «Actualizar» disabled while pending and re-running all; no timer;
  - number formatting `es-AR`; table caption, `th scope="col"`, `zd-num` only on all-number columns; `corte` and «Desde el dd/mm» lines;
  - freshness: hours, minutes, days, null;
  - markup in titles and values is text; no tenant identifier in any request.
- [x] 6.4 `src/panel/panel.test.ts`: the automations script is still last; the glossary scan covers `SCRIPT_TABLERO`; the Telegram card follows the list.

### 7. Verification (CH-48b)
- [x] 7.1 `npx tsc -p tsconfig.json --noEmit`, `npm run build`, the focused command of unit b, and `npm run test:db`.

## CH-48c — charts

### 8. Drawing
- [x] 8.1 `src/panel/panel.ts`: `<script src="/ui/vendor/chart.umd.js"></script>` in `documentoShell` only, before the dashboard script.
- [x] 8.2 `src/panel/panel-tablero-pagina.ts`: canvas with `role="img"` and `aria-label`; one dataset; `colores()` from the tokens; theme listeners (`matchMedia` and a `MutationObserver` on `data-theme`); `destroy` before re-run; the `<details>` collapsed when drawn and the table open when `Chart` is missing (design §3).
- [x] 8.3 `src/panel/panel-tablero-pagina.test.ts` with a stub `Chart`: canvas and label; colors equal the stubbed token values; theme flip calls `update`; `destroy` before re-run; no `Chart` shows the table open.
- [x] 8.4 `src/panel/panel.test.ts`: only the authenticated shell holds the script, once, before the dashboard script; the login page does not.

### 9. Docs
- [x] 9.1 `docs/guia/09-reportes.md`: the panel section (what the client sees, period, states, freshness, the run limit, and why panel runs leave no audit row).
- [x] 9.2 `docs/02-mapa-de-changes.md`: the CH-48 row with the three PR numbers.

### 10. Verification (CH-48c)
- [x] 10.1 `npm run build`, `npm run build:agente`, `npx tsc -p tsconfig.json --noEmit` and `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`.
