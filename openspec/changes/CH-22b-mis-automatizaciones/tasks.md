# Tasks: CH-22b — Panel "My Automations" (P1h)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~280, PR2 ~330, PR3 ~190 authored (about 800 total; docs excluded) |
| 400-line budget risk | PR1 Low (~280), PR2 Medium (~330, closest to the cap: watch the isolation tests), PR3 Low (~190) |
| Chained PRs recommended | Yes |
| Decision needed before apply | No |
| Suggested split | PR0 (SDD artifacts + DEC-137) -> PR1 (pure layer + unit tests) -> PR2 (route, wiring, route and isolation tests) -> PR3 (panel page + page test) |
| Delivery strategy | chained PRs (overrides the earlier `single-pr` default; chosen by the user) |
| Chain strategy | stacked-to-main: every PR targets `master` and merges in order PR0, PR1, PR2, PR3 |
| Review budget | 400 changed lines (additions + deletions) per PR |

> **Slicing rule.** One honest slicing pass, as forecast in `design.md` section 10. The budget constrains how work is sliced, never the code: no comments, blank lines, docs or tests are removed to fit. If a PR lands above 400 in real numbers, report the overage and recommend `size:exception` instead of compressing code.
>
> **Stacked-to-main mechanics.** PR(n+1) is branched from PR(n)'s branch but its base is `master`; each PR merges in order and, after PR(n) merges, PR(n+1) is rebased on `master` so its diff shows only its own work unit. Every child PR body carries Chain Context (start, end, prior dependency, follow-up, out of scope) and a dependency diagram marking the current PR with a pin.
>
> **Verification commands.** Verified in `package.json`: `npm test` (`tsx --test "src/**/*.test.ts"`) and `npm run build` (`tsc -p tsconfig.json`) exist. There is NO `lint` and NO `typecheck` script; typecheck is `npx tsc --noEmit`. Focused tests run with `npx tsx --test <file>`. DB-backed tests skip (not fail) when PostgreSQL is unreachable; run the full suite with `TEST_DB_PORT=5434 npm test` (CH-22a convention) so they actually execute.
>
> **Strict TDD is off** (`openspec/config.yaml`), but every code task is paired with its test inside the same work unit and commit.

### Chain overview

```
master <- PR0 (docs) <- PR1 (pure layer) <- PR2 (route + wiring) <- PR3 (page)
```

| PR | Branch | Depends on | Est. lines |
|----|--------|------------|-----------|
| PR0 | `ch22b/exploracion` | none | docs only |
| PR1 | `ch22b/capa-pura` | PR0 merged | ~280 |
| PR2 | `ch22b/ruta-automatizaciones` | PR1 merged | ~330 |
| PR3 | `ch22b/pantalla-automatizaciones` | PR2 merged | ~190 |

## PR0: SDD Artifacts & DEC-137 (docs only)

Branch `ch22b/exploracion` (current). Base `master`. No dependency. Out of scope: any code.

- [ ] 0.1 `exploration.md`, `proposal.md`, delta specs under `specs/` (`client-panel-automations`, `client-panel-auth`, `tenant-isolation`) and `design.md` committed (design sections 1-10).
- [ ] 0.2 DEC-137 (contract of the "mis automatizaciones" read) and the resolution of the six open questions recorded in `docs/01-decisiones.md` (design "Open questions").
- [ ] 0.3 `tasks.md` committed (this file).
- [ ] 0.4 Verification: structural readback only (docs). Confirm no change under `src/` (`git diff --stat master`).
- [ ] 0.5 Open PR0 against `master`.

Commits (conventional, docs only; `.atl/` registry files and the unrelated `docs/verificacion-tesis-2026-10-01.md` are NOT part of this unit):

1. `docs(ch22b): registrar DEC-137 y exploracion de mis automatizaciones`
2. `docs(ch22b): proposal, specs delta y design de mis automatizaciones`
3. `docs(ch22b): plan de tareas y entrega en PRs encadenados`

Rollback: revert the docs commits; no code or data touched.

## PR1: Pure Layer & Unit Tests (~280 authored)

Branch `ch22b/capa-pura`. Base `master` (stacked-to-main), branched from `ch22b/exploracion`. Depends on PR0. Follow-up: PR2 (route). Out of scope: Prisma, route, wiring, page.

File: `src/panel-automatizaciones.ts` (pure half only) and `src/panel-automatizaciones.test.ts` (pure half only). No Prisma import, no I/O, unit-testable without a database.

- [x] 1.1 Copy map and fallback. `COPY_NEGOCIO` (`ReadonlyMap`, keys `stock-fisico`, `stock-producible`, insertion order is the `disponibles` order), `COPY_NEUTRO`, `copyDe(slug)` that never throws and never uses the template `nombre`. Spec: Business Copy Map With Neutral Fallback (scenarios Mapped slug, Unmapped slug on an existing automation); design sections 5 and 1. Test: mapped slug returns the map entry; unmapped slug (`reporte-semanal`) returns the fallback; fallback never contains a `nombre`.
- [x] 1.2 Frequency mapping `frecuenciaDeCron(cron): string | null`. Normalize whitespace, match exactly `M H * * D` with `D` in `*`, `1-5`, `1-6`, minute <= 59, hour <= 23, zero-padded `HH:MM`. Spec: Frequency Text Only for the Three DEC-129 Patterns (scenarios Daily, Weekdays, Monday to Saturday, Any other cron omits the key); design section 6. Test vectors: `30 8 * * *`, `0 9 * * 1-5`, `0 18 * * 1-6`, zero-padding (`5 7 * * *`), extra whitespace, and `null` for `*/15 * * * *`, `0 8 1 * *`, `0 8 * * 0-6`, `0 8 * * 1`, `61 8 * * *`, `0 24 * * *`; result never contains the cron string.
- [x] 1.3 Result mapping `resultadoDe(estado)`: `ok` gives `completada`; `fallo`, `omitida` and any unknown state give `no-realizada`. Spec: Last Execution Is the Latest Finished One (scenario Failed execution is neutral); design open-question resolution 1. Test: each state plus an unknown string.
- [x] 1.4 Active-item projection `proyectarActiva(fila, ultima, ahora, zona)`: literal allow-list builder, no spread of a stored row, `estado` is `activa` or `pausada` only (a failed last run does not change it), `frecuencia` is a missing key (not `null`) when `frecuenciaDeCron` yields `null`, `fecha` is `finalizadaEn ?? iniciadaEn` as ISO, no `id`. Specs: Allow-List Projection Without Technical Fields (scenarios Forbidden keys are absent, Only allow-listed keys per item); Business Status Is Active or Paused (all three scenarios); design sections 2 and 1. Test: recursive forbidden-key walk (`tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`) over a fixture row that carries every forbidden field; exact key set of the item; status mapping for active, paused and failed-last-run.
- [x] 1.5 Injectable clock in the projection. `proyectarActiva` receives `ahora: Date` (the route will read the clock once per request) and computes `proximaEjecucion(cron, ahora, zona).toISOString()`; `null` when paused. Spec: Next Execution Is Computed on Request From an Injectable Clock (scenarios Next run from a fixed clock, Zone changes the instant, Paused automation has no next run); design section 4. Test: fixed instant `2026-10-07T10:00:00Z`, cron `0 8 * * *`, zone `UTC` gives `2026-10-08T08:00:00.000Z` and zone `America/Argentina/Buenos_Aires` gives `2026-10-07T11:00:00.000Z`; paused gives `null`; no `Date` mocking, no global timers.
- [x] 1.6 Corrupt-cron resilience. Wrap the next-run computation in `try/catch` (guarded with `cronValido`) so an invalid stored cron yields `proximaEjecucion: null` and no `frecuencia`, never a throw. Spec: scenario Corrupt stored schedule; design section 2 and open-question resolution 4. Test: `proyectarActiva` with cron `no es un cron` and with `61 8 * * *` returns an item with `proximaEjecucion: null`, no `frecuencia` key, and does not throw.
- [x] 1.7 Available-automations rule `proyectarDisponibles(plantillas, plantillaIdsActivas)`: keep only templates with copy and without an active automation of the tenant, deduplicate by slug (open-question resolution 6), order by copy-map insertion order then template `id`, output only `{ titulo, descripcion }`. Specs: Available Automations Rule (scenarios Template with an active automation is not available, Template with only a paused automation is available, Template without business copy is hidden, Another tenant's automation does not hide a template); Tenant without any automation; design section 3 "Disponibles". Tests: active hides, paused-only shows (id absent from the active set), unmapped slug hidden, duplicate slug listed once, deterministic order, no extra keys.
- [x] 1.8 Slug dedupe in `proyectarDisponibles` has its own explicit test: two templates with the same `automatizacion` slug yield a single `disponibles` entry. (Pairs with 1.7; kept separate so the dedupe decision is traceable.) Spec: design open-question resolution 6 / DEC-137.
- [x] 1.9 Glossary scan test. Scan every `COPY_NEGOCIO` value, `COPY_NEUTRO`, and every frequency text case-insensitively for `tenant`, `cron`, `sql`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout`, `plantilla`. Spec: No Technical Terms in the Client Surface (scenario Copy and page contain no glossary-forbidden term); design section 5.
- [x] 1.10 Verification (run in the foreground, record exact results):
  - `npx tsc --noEmit`
  - `npx tsx --test src/panel-automatizaciones.test.ts`
  - `TEST_DB_PORT=5434 npm test` (no regressions; pure tests need no DB)
  - `git diff --stat master...HEAD` to confirm ~280 changed lines and that only the two new files changed.

Commits (work units, tests included in each):

1. `feat(panel): mapa de textos de negocio y frecuencia legible para automatizaciones` (tasks 1.1, 1.2, 1.9 and their tests)
2. `feat(panel): proyeccion de automatizaciones activas con lista permitida y reloj inyectable` (tasks 1.3 to 1.6 and their tests)
3. `feat(panel): regla de automatizaciones disponibles sin duplicados por slug` (tasks 1.7, 1.8 and their tests)

Rollback: delete `src/panel-automatizaciones.ts` and `src/panel-automatizaciones.test.ts`; nothing else imports them yet.

## PR2: Route, Server Wiring & Isolation Tests (~330 authored)

Branch `ch22b/ruta-automatizaciones`. Base `master` (stacked-to-main), branched from `ch22b/capa-pura`; rebase on `master` after PR1 merges. Depends on PR1. Follow-up: PR3 (page). Out of scope: `src/panel.ts`, any write endpoint, any schema change.

- [ ] 2.1 RED route tests in `src/panel-automatizaciones.test.ts` (live DB, skip when unreachable, fixture style of `src/panel-auth.test.ts`): `200` and exact body keys `activas`, `disponibles`, `zonaHoraria`, `truncado`; `zonaHoraria` equals the registrar zone; tenant with no automations gives `activas: []`, `truncado: false`, `disponibles` listing every mapped template. Specs: Automations Read Route and Response Shape (all three scenarios); design section 9.
- [ ] 2.2 Session-guard route tests: `401 { error: 'sesion-invalida' }` with no cookie (and with an unknown token), `401 { error: 'sesion-expirada' }` with an expired session and body without `activas`/`disponibles`, `409 { error: 'tenant-desactivado' }` with a deactivated tenant and no next-run or automation data. Spec: Session Guard and Status Codes (scenarios No cookie, Expired session, Deactivated tenant); design section 1.
- [ ] 2.3 Header-hook exemption tests: a request with a valid cookie and NO `X-Tenant-Id` answers `200`, not `400`. Specs: Panel Automations Route Resolves Tenant Only From the Session (scenario Request without X-Tenant-Id is not rejected by the header hooks); Rule 2.
- [ ] 2.4 GREEN `registerPanelAutomatizacionesRoutes(app, prisma, zonaHoraria, ahora = () => new Date())` in `src/panel-automatizaciones.ts`: `GET /api/panel/automatizaciones` with `preHandler: [levantarSesionPanel(prisma)]`, every read inside `conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, ...)`, no body/query/path parameter influences the result, clock read ONCE per request and shared by every item. Specs: Session Guard; Next Execution Is Computed on Request From an Injectable Clock; design sections 1 and 4.
- [ ] 2.5 Query plan Q1 to Q5 with a fixed query count: Q1 `automatizacion.findMany` (select without forbidden keys, `orderBy [{ creadaEn: 'desc' }, { id: 'asc' }]`, `take: LIMITE_LISTADO + 1`); Q2 `ejecucion.groupBy` (`_max.iniciadaEn`, `estado: { not: 'en-curso' }`); Q3 `ejecucion.findMany` by `(automatizacionId, iniciadaEn)` pairs, skipped when Q2 is empty; Q4 `plantilla.findMany` bounded by the copy-map slugs, never selecting `sql`, `nombre` or `parametros`; Q5 `automatizacion.groupBy` active templates. NO raw SQL, NO relation filter from `Plantilla` into `Automatizacion`, NO nested `ejecuciones`, NO `distinct`. `LIMITE_LISTADO` imported from `src/listados.ts`. Specs: Last Execution Is the Latest Finished One; Available Automations Rule; Listing Is Bounded; design section 3.
- [ ] 2.6 Route data tests for `ultimaEjecucion`: no execution gives `null`; only `en-curso` gives `null`; finished `ok` 08:00 plus newer `en-curso` 09:00 gives the 08:00 instant with `completada`; two automations each report their own latest; `fallo` with `error`/`codigoError` gives `no-realizada` with no error text; `activo=false` item is listed as `pausada` with `proximaEjecucion: null`. Specs: Last Execution (all five scenarios); Business Status (Paused automation is listed, A failed last execution does not change the status).
- [ ] 2.7 Route tests for `disponibles` and copy: active `stock-fisico` hides it, paused-only shows it, a template with an unmapped slug is hidden, an existing automation of an unmapped slug appears in `activas` with the fallback and without the template `nombre`. Specs: Available Automations Rule; Business Copy Map With Neutral Fallback (Unmapped slug on an existing automation); design section 3 "Disponibles".
- [ ] 2.8 Injectable-clock route test: register with a fixed `ahora` and zone `UTC`, cron `0 8 * * *`, clock `2026-10-07T10:00:00Z` gives `2026-10-08T08:00:00.000Z`; zone `America/Argentina/Buenos_Aires` gives `2026-10-07T11:00:00.000Z`. Spec: Next Execution (scenarios Next run from a fixed clock, Zone changes the instant); design section 4. (No `Date` mocking.)
- [ ] 2.9 Corrupt-cron route test: an active automation with a stored invalid cron still answers `200`, its item has `proximaEjecucion: null`, no `frecuencia` key, and the other automations are intact. Spec: scenario Corrupt stored schedule; design section 2.
- [ ] 2.10 Forbidden-keys test: tenant with an automation carrying `valores` and a `conexionId`, a failed execution with `error` and `codigoError`, and a template with `sql`; the parsed body walked recursively contains none of `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`; the raw body text contains neither the template SQL nor the stored error code nor the template `nombre`; each `activas` item uses only `titulo`, `descripcion`, `estado`, `frecuencia`, `ultimaEjecucion`, `proximaEjecucion`, each `disponibles` item only `titulo` and `descripcion`; no cron string in the body. Specs: Allow-List Projection (both scenarios); Frequency (Any other cron omits the key, no cron text).
- [ ] 2.11 Truncation tests: below the limit gives `truncado: false`; `LIMITE_LISTADO + 1` automations gives exactly `LIMITE_LISTADO` items and `truncado: true`, and `disponibles` is not affected by the truncation (Q5). Spec: Listing Is Bounded (Within the limit, Over the limit); design section 3 Q5.
- [ ] 2.12 Wiring: add the exact row `'GET /api/panel/automatizaciones'` to `RUTAS_PANEL_PUBLICAS` in `src/contexto-tenant.ts` (equality match, no prefix); update the set's comment. In `src/server.ts` import and call `registerPanelAutomatizacionesRoutes(app, prisma, config.zonaHoraria)` right after `registerPanelAuthRoutes(app, prisma)` and before `registerPanelRoutes(app, prisma)`, without passing the clock. Specs: Panel Automations Route Resolves Tenant Only From the Session; design section 8.
- [ ] 2.13 `src/contexto-tenant.test.ts`: the exact row is present; `GET /api/panel/automatizaciones/extra` and `POST /api/panel/automatizaciones` without `X-Tenant-Id` are NOT exempt (the header hook still answers `400`). Spec: scenario The exemption is an exact row.
- [ ] 2.14 Two-tenant isolation test in `src/aislamiento-panel.test.ts` (live DB, no mocks): tenant A with active `stock-fisico` plus a finished execution at a known instant, tenant B with active `stock-producible` plus a finished execution at a different instant; each user calls the route with their own session; A sees only its own `activas` and instant, `disponibles` lists the template the other tenant uses and not its own; B is the mirror; neither body contains the other tenant's id, automation title or execution instant; another tenant's active automation does not hide a template. Specs: tenant-isolation delta, scenario Panel automations route sweep row; Two tenants see only their own automations; Another tenant's automation does not hide a template; design section 9.
- [ ] 2.15 `X-Tenant-Id` ignored: in the same isolation file, each tenant calls the route again carrying `X-Tenant-Id` naming the OTHER tenant; the response body is byte-for-byte equal to the response without the header and contains no foreign data; also assert a foreign tenant id in a query parameter changes nothing. Specs: Tenant Derives Only From the Session (scenario Foreign X-Tenant-Id is ignored); client-panel-auth (scenario Tenant comes from the session even when a header names another); tenant-isolation delta.
- [ ] 2.16 Verification (foreground, record exact results):
  - `npx tsc --noEmit`
  - `npx tsx --test src/panel-automatizaciones.test.ts src/aislamiento-panel.test.ts src/contexto-tenant.test.ts`
  - `TEST_DB_PORT=5434 npm test` (full suite, the DB tests must run, not skip)
  - `npm run build`
  - `git diff --stat master...HEAD` to confirm ~330 changed lines; if over 400, report the overage and recommend `size:exception` (do not trim tests).

Commits (work units, tests included in each):

1. `feat(panel): ruta de lectura de mis automatizaciones con sesion y reloj inyectable` (tasks 2.1 to 2.9, 2.11 and the route code 2.4, 2.5)
2. `test(panel): cobertura de claves prohibidas en mis automatizaciones` (task 2.10; kept as its own reviewable unit if the first commit grows past the budget, otherwise folded into commit 1)
3. `feat(panel): exencion exacta de cabecera y registro de la ruta en el servidor` (tasks 2.12, 2.13)
4. `test(aislamiento): dos negocios y X-Tenant-Id ajeno en mis automatizaciones` (tasks 2.14, 2.15)

Rollback: revert PR2; removes the route, the one `RUTAS_PANEL_PUBLICAS` row and the `server.ts` call. No migration or data change.

## PR3: Panel Page & Page Test (~190 authored)

Branch `ch22b/pantalla-automatizaciones`. Base `master` (stacked-to-main), branched from `ch22b/ruta-automatizaciones`; rebase on `master` after PR2 merges. Depends on PR2. Follow-up: CH-22c (derived failure status) and CH-23 (write actions), both out of scope. Out of scope: any "Ajustar" or "Activar" control, any data-changing request, changes to `public/ui/`.

- [ ] 3.1 P-02 screen markup in `documentoShell` of `src/panel.ts`: replace the partial `<section data-estado="parcial">` inside `<main class="panel-main">` with title and subtitle (kept), one region for the loading skeleton, empty state, error state, active cards list and the "available" section; layout rules in the existing page-local `<style>` block using tokens only; reuse `.zd-card`, `.zd-banner`, status badge and skeleton from `/ui/styles.css` after verifying class names against the `zerodashboard-design` skill. The Salir script stays. Specs: Panel Page Shows the Automations Screen in Defined States; client-panel-auth (scenario Shell hosts the screen and expires with the session); design section 7.
- [ ] 3.2 Page script, loading and rendering: `fetch('/api/panel/automatizaciones', { credentials: 'same-origin' })` with no custom header and no tenant identifier in header, query or body; skeleton while pending; a card per item (title, description, "Activa"/"Pausada" label, `frecuencia` when present, last run, next run when present); "Todavía no hubo una revisión" for `ultimaEjecucion: null`; `resultado` texts "Se completó" and "No se pudo hacer"; "available" section with title and description; dates with `Intl.DateTimeFormat('es-AR', { timeZone: zonaHoraria, ... })` and a fallback to the browser zone if `Intl` throws. Specs: Loading state, Cards show the business data; design section 7.
- [ ] 3.3 Page script, empty state: title "Todavía no activaste ninguna automatización" plus a one-line explanation, skeleton hidden. Spec: scenario Empty state; design section 7.
- [ ] 3.4 Page script, error and 409 copy: network error or `5xx` shows "No pudimos cargar tus automatizaciones" with "Volvé a intentar en unos minutos." and no status code; a `409` shows the login screen's text "Tu negocio no está activo en este momento. Comunicate con quien te dio acceso." in the error state. Specs: scenario Error state; design section 7 and open-question resolution 5.
- [ ] 3.5 Page script, session expired: a `401` runs `window.location.reload()` so `GET /panel` serves the login screen. Spec: scenario Session expired; design section 7.
- [ ] 3.6 Script safety constraints: string concatenation only (no JS backticks, no `${...}`, no regex literals or backslash escapes in the script), every API value inserted with `textContent` or `createElement` + `textContent`, no `innerHTML` with API data, no `href`/`src` built from API data, the tenant name still goes through `escaparHtml`. Specs: Panel Page Shows the Automations Screen; No Technical Terms in the Client Surface; design section 7 "Script constraints".
- [ ] 3.7 No actions offered: no "Ajustar" or "Activar" markup, label or handler anywhere in the HTML or script; no control that changes data. Spec: scenario No actions offered; design section 7.
- [ ] 3.8 `src/panel.test.ts` additions: authenticated `/panel` contains the screen markup and the script reading `/api/panel/automatizaciones`; script contains no template literal, no `${`, no `innerHTML`; script sends no tenant identifier (no `X-Tenant-Id`); script text contains the state strings for loading, empty ("Todavía no activaste ninguna automatización"), error ("No pudimos cargar tus automatizaciones"), the 409 inactive-business text, "Todavía no hubo una revisión", "Activa"/"Pausada", and the `reload` branch for `401`; served HTML and script do not contain "Ajustar" or "Activar"; glossary scan (case-insensitive) of visible text and script string literals finds none of `tenant`, `cron`, `SQL`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout`, `plantilla`; the login render (no session) is unchanged. Specs: all Panel Page scenarios; No Technical Terms in the Client Surface (scenario Copy and page contain no glossary-forbidden term); client-panel-auth (Shell hosts the screen). Runtime rendering is not asserted by tests; it is covered by 3.10.
- [ ] 3.9 Verification (foreground, record exact results):
  - `npx tsc --noEmit`
  - `npx tsx --test src/panel.test.ts`
  - `TEST_DB_PORT=5434 npm test`
  - `npm run build`
  - `git diff --stat master...HEAD` to confirm ~190 changed lines.
- [ ] 3.10 Manual visual review (human only, CH-22a stack HTTPS local): loading skeleton, empty state, error state, populated cards and "available" section, session-expired reload; 360 px and 1280 px; light and dark themes. Not an automated task.

Commits (work units, tests included in each):

1. `feat(panel): pantalla de mis automatizaciones con estados de carga, vacio y error` (tasks 3.1 to 3.5, 3.7 and the matching `src/panel.test.ts` cases)
2. `test(panel): guardas de seguridad y lenguaje del script de automatizaciones` (tasks 3.6, 3.8 glossary and script-safety cases; folded into commit 1 if the diff stays well under budget)

Rollback: revert PR3; the shell returns to the previous partial section. The route from PR2 stays harmless and unused.

## Closure

- [ ] 4.1 Verify per PR (`sdd-verify`): check every scenario in the traceability table below against the merged tests and requirements.
- [ ] 4.2 Archive (`sdd-archive`) after PR3 merges: sync delta specs to `openspec/specs/` and move the folder to `openspec/changes/archive/<fecha>-CH-22b-mis-automatizaciones/`.

## Spec Scenario to Task Traceability

| Spec / requirement | Scenario | Task(s) |
|--------------------|----------|---------|
| client-panel-automations / Read Route and Response Shape | Successful read with active and available entries | 2.1, 2.5 |
| | Tenant without any automation | 2.1, 1.7 |
| | zonaHoraria reports the deployment zone | 2.1 |
| / Session Guard and Status Codes | No cookie | 2.2 |
| | Expired session | 2.2 |
| | Deactivated tenant | 2.2 |
| / Tenant Derives Only From the Session | Foreign X-Tenant-Id is ignored | 2.15 |
| | Two tenants see only their own automations | 2.14 |
| / Allow-List Projection | Forbidden keys are absent | 1.4, 2.10 |
| | Only allow-listed keys per item | 1.4, 2.10 |
| / Business Status | Active automation | 1.4, 2.6 |
| | Paused automation is listed | 1.4, 2.6 |
| | A failed last execution does not change the status | 1.4, 2.6 |
| / Available Automations Rule | Template with an active automation is not available | 1.7, 2.7 |
| | Template with only a paused automation is available | 1.7, 2.7 |
| | Template without business copy is hidden | 1.7, 2.7 |
| | Another tenant's automation does not hide a template | 1.7, 2.14 |
| / Last Execution Is the Latest Finished One | No execution yet | 2.5, 2.6 |
| | Only an in-progress execution | 2.5, 2.6 |
| | In-progress run is skipped for the latest finished one | 2.5, 2.6 |
| | Latest per automation, not global | 2.5, 2.6 |
| | Failed execution is neutral | 1.3, 2.6 |
| / Next Execution, Injectable Clock | Next run from a fixed clock | 1.5, 2.8 |
| | Zone changes the instant | 1.5, 2.8 |
| | Paused automation has no next run | 1.5, 2.6 |
| | Corrupt stored schedule | 1.6, 2.9 |
| / Frequency Text, Three Patterns | Daily pattern | 1.2 |
| | Weekdays pattern | 1.2 |
| | Monday to Saturday pattern | 1.2 |
| | Any other cron omits the key | 1.2, 2.10 |
| / Listing Is Bounded | Within the limit | 2.11 |
| | Over the limit | 2.11 |
| / Business Copy Map With Neutral Fallback | Mapped slug | 1.1 |
| | Unmapped slug on an existing automation | 1.1, 2.7 |
| / Panel Page, Defined States | Loading state | 3.1, 3.2, 3.8 |
| | Empty state | 3.3, 3.8 |
| | Error state | 3.4, 3.8 |
| | Session expired | 3.5, 3.8 |
| | No actions offered | 3.7, 3.8 |
| | Cards show the business data | 3.2, 3.8 |
| / No Technical Terms | Copy and page contain no glossary-forbidden term | 1.9, 3.6, 3.8 |
| client-panel-auth / Route Resolves Tenant Only From the Session | Request without X-Tenant-Id is not rejected by the header hooks | 2.3, 2.12 |
| | Tenant comes from the session even when a header names another | 2.15 |
| | The exemption is an exact row | 2.12, 2.13 |
| | Shell hosts the screen and expires with the session | 3.1, 3.8 |
| tenant-isolation / Cross-Tenant Isolation Proven by Automated Test | Panel automations route sweep row | 2.14, 2.15 |
| Design-only decisions (no scenario) | Slug dedupe (open question 6) | 1.7, 1.8 |
| | 409 copy on the page (open question 5) | 3.4 |
| | Five-query plan, no N+1 (open question 2) | 2.5 |
