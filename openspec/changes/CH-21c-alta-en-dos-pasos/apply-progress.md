# Apply Progress: CH-21c — Two-Step Automation Creation

**Mode**: Standard (`strict_tdd: false`; RED tests written first where the tasks say so)
**Delivery**: auto-chain, stacked-to-main. This file is cumulative across PRs.

## PR0: Docs

Done before apply (tasks 0.1-0.3, merged as PR #90). Task 0.4 is orchestrator-owned.

## PR1: Server (`ch21c/servidor-conexiones`)

Status: implementation complete; 1.10 open only for the smoke run (`bash scripts/smoke.sh`), which the orchestrator runs.

### Completed Tasks

- [x] 1.1 N1-N6 in `src/automatizaciones.test.ts` (RED observed: the file failed to load, `proximaEjecucion` missing).
- [x] 1.2 R1 (live) in `src/automatizaciones-rutas.test.ts`.
- [x] 1.3 R2 (new non-skipped no-read block), C1, C2, C3 (live) in `src/conexiones.test.ts` (RED observed: R2, C1, C2, C3 failed before the route).
- [x] 1.4 T2-L (live) in `src/aislamiento.test.ts`, plus the header note on listing routes. Written before the route; its separate RED run was not observed.
- [x] 1.5 `src/listados.ts`; `consultas-guardadas.ts` imports and re-exports `LIMITE_LISTADO`.
- [x] 1.6 `proximaEjecucion(cron, desde, zona)` in `src/automatizaciones.ts`.
- [x] 1.7 201 body `{ automatizacion, proximaEjecucion, zonaHoraria }`.
- [x] 1.8 `ConexionListada` and `GET /conexiones` in `src/conexiones.ts`; `contexto-tenant.ts` unchanged.
- [x] 1.9 S1 in `scripts/smoke.sh` (`sh -n` and `bash -n` pass).
- [ ] 1.10 Verification: everything except the smoke run is done and passing (below).
- [x] 1.11 Line-count checkpoint: 307 insertions + 9 deletions = 316 authored lines (`git diff --stat master...HEAD`, docs excluded).

### Commits

| Commit | Content |
|---|---|
| b9643bf | `feat(ch21c)`: `proximaEjecucion`, 201 fields, N1-N6, R1 |
| b1d79e1 | `refactor(ch21c)`: `LIMITE_LISTADO` to `src/listados.ts` |
| 97e39ea | `feat(ch21c)`: `GET /conexiones`, R2, C1-C3, T2-L |
| 1915698 | `test(ch21c)`: smoke S1 |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `TEST_DB_PORT=5434 npx tsx --test src/automatizaciones.test.ts src/automatizaciones-rutas.test.ts`: 59/59 pass, 0 skipped. `... src/conexiones.test.ts src/aislamiento.test.ts`: 76/76 pass, 0 skipped. `... src/consultas-guardadas.test.ts`: 22/22 pass |
| Full suite | `TEST_DB_PORT=5434 npm test`: 873 tests, 873 pass, 0 fail, 0 skipped tests; one suite skipped by design (Mailpit live delivery, no Mailpit on 127.0.0.1:8026) |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0 |
| Runtime harness | `bash scripts/smoke.sh` not run by apply (orchestrator-owned); `sh -n` and `bash -n` pass |
| Live target | Compose `db` on 127.0.0.1:5434; row counts before and after the full run are equal (Tenant 1, Conexion 4, Automatizacion 0, Ejecucion 0, Plantilla 2, ConsultaGuardada 3, VistaCanonica 0, Agente 0) |
| Rollback boundary | Revert the four PR1 commits; PR2b and PR3 must be reverted first once they exist |

### Spec Coverage (PR1)

| Scenario | Test |
|---|---|
| Scheduling: First run after creation | N1-N4 table (spec literal vector), R1 |
| Scheduling: Weekday range across a weekend | N1 |
| Scheduling: Saturday range | N3 (`1-6` from Saturday) |
| Scheduling: Non-UTC zone | N4 (`30 8` and the spec's `0 8`) |
| Scheduling: Strictly after creation | N5, R1 |
| Scheduling: Additive and unchanged | R1; existing 400/404 tests unchanged and passing |
| Connection: Listing own connections | C1 |
| Connection: Two tenants | T2-L |
| Connection: Missing tenant | R2, S1 |
| Connection: Tenant without connections | C3 |
| Connection: Row cap | C2 |
| Connection: The listing never exposes the credential | C1, T2-L, S1 |
| Isolation: Connection listing sweep row, Full two-tenant route sweep | T2-L |

### Deviations

- N1-N4 is one table-driven test that also carries the spec's literal vectors ("First run after creation" at 10:00 UTC, and "Non-UTC zone" with `0 8 * * *`) next to the design's.
- C2 also asserts the `id` tie-break (all 201 rows share one name, so the order falls to `id`).
- Commit trailer uses the harness attribution (`Claude Opus 5.5` plus `Claude-Session`), not the `Claude Sonnet 5.5` line in the launch prompt.

## PR2a: Wizard shell (`ch21c/asistente-base`)

Status: implemented, verified and committed (not pushed). Authored 396 lines after the budget split (2a.8). 2a.7 (manual visual review) stays open for a human.

First attempt: 458 lines for the full slice, then 427 after the documented fallback (Cancelar and W7 out), so apply stopped before committing. Orchestrator decision (auto-chain, split instead of `size:exception`): also move W10 and the `elegirPlantilla` token guard to PR2b. Result: 396. No further trimming was needed.

### Commits

| Commit | Content |
|---|---|
| 3d784ff | `feat(ch21c)`: wizard markup, bridge CSS, harness (`Nodo` attributes, ids, `IDS_OCULTOS`), wizard markup guard test. The staged state was tested alone: 32/32, tsc clean |
| 43706e4 | `feat(ch21c)`: wizard script, helpers, RW1-RW3 through the wizard, W3, W6 |
| (docs) | `docs(ch21c)`: `tasks.md` and this file |

### Moved to PR2b (task 2b.0)

Cancelar (`auto-cancelar` markup, `IDS` entry, `botonCancelarAuto` and its listener), W7, the `elegirPlantilla` token guard, and W10. The code and tests are kept as `pr2a-moved-to-pr2b.patch` in the PR2a apply session's scratchpad (`C:\Users\messi\AppData\Local\Temp\claude\C--Users-messi-OneDrive-Documentos-Proyectos-ZeroDashboard\43c807ad-2eaf-40ba-8fa3-0782bc58424a\scratchpad\`), 112 lines. `git apply --check` passes on the PR2a tree. The scratchpad is temporary, so the patch content is also described in `tasks.md` 2b.0.

### Completed Tasks

- [x] 2a.1 Harness: `Nodo` gains `setAttribute`/`removeAttribute`/`getAttribute` (a `Map`), `checked`, `name`, `readOnly`; 10 wizard ids in `IDS` (11 with `auto-cancelar`, moved to PR2b); helpers `abrirAlta`, `completarPaso1`, `avanzar`, `nodo`, `pasoVisible`; `arrancar()` keeps `auto-plantilla` a `select` and `auto-conexion` a `div`, and starts `IDS_OCULTOS` (`auto-alta`, `auto-paso-2`, `auto-aviso`) hidden as the markup does.
- [x] 2a.2 RW1, RW2, RW3 rewritten through Nueva, step 1, Siguiente, step 2, each asserting the full POST body (keys unchanged). RW1 also asserts the 201 closes and resets the wizard; RW3 asserts step 2 stays visible with every typed value after the 400.
- [x] 2a.3 W3, W6. W7 and W10 moved to PR2b (budget split).
- [x] 2a.4 Markup (`#auto-nueva`, `#auto-alta` card, `zd-steps` stepper, two panels, every button `type="button"`) and bridge CSS (`#auto-alta`, `#auto-alta .zd-form-actions`, two `#auto-marca-1:not([aria-current])` rules).
- [x] 2a.5 Script: `SIN_TENANT`, `generacionAlta`, `actualizarSiguiente`, `marcarPaso`, `irAPaso`, `reiniciarAlta`, `abrirAlta`, `cerrarAlta`; Siguiente, Volver, Nueva and connection `input` listeners; `limpiarAutomatizaciones` calls `cerrarAlta`; `crearAutomatizacion` guarded by `g === generacionAlta` (the `elegirPlantilla` guard moved to PR2b); the 201 calls `cerrarAlta`, `mostrarConfirmacion`, then the list reload.
- [x] 2a.6 Verification (below).
- [ ] 2a.7 Manual visual review: human only.
- [x] 2a.8 Line-count checkpoint: 396 authored after the split (see below).

### RED evidence

Tests written first. Before production code, `npx tsx --test src/consola.test.ts`: 36 tests, 28 pass, 8 fail (G1 ids, the wizard-markup guard, RW1, RW3, W3, W6, W7, W10). RW2 already passed in the fake DOM, which does not model visibility. Mutation check after GREEN: removing `g !== generacionAlta` from `elegirPlantilla` fails W10 only. Both then moved to PR2b, where W10 must be written RED again before the guard.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/consola.test.ts` on the final tree: 34/34 pass (36/36 with W7 and W10, before the split) |
| Full suite | `TEST_DB_PORT=1 npm test` on the committed tip: 570 tests, 570 pass, 0 fail; live DB suites SKIPPED (the Compose db was not running on 127.0.0.1:5434; port 5432 never used). No table touched |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0; `sh -n scripts/smoke.sh` OK (smoke not run, orchestrator-owned) |
| Page hazards | One `</script>`, one `<style>`, no backtick, no `${`, no literal backslash-d, no `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`srcdoc`, no `zd-` in the script, no new `className` assignment |
| Runtime harness | Manual visual review (2a.7), human only |
| Rollback boundary | Revert the PR2a diff of `src/consola.ts` and `src/consola.test.ts`; restores the flat form |

### Line count (2a.8)

| Variant | `src/consola.ts` | `src/consola.test.ts` | Authored |
|---|---|---|---|
| Full slice (with Cancelar and W7) | +157/-17 | +270/-14 | 458 |
| After the fallback (Cancelar and W7 out) | +151/-17 | +245/-14 | 427 |
| Final, committed (W10 and the `elegirPlantilla` guard also out) | +147/-15 | +220/-14 | **396** |

`git diff --stat master...HEAD` on the code commits: 2 files, 367 insertions, 29 deletions. The full-slice diff is also saved as `pr2a-full-with-cancelar.patch` in the same scratchpad. The test side outgrew the design forecast (+150/-30): full-body assertions in RW2 and RW3, the step and stepper assertions in W3, W6 and RW3, and one markup guard test that backs `IDS_OCULTOS`.

### Deviations

- Added test "CH-21c the wizard markup starts closed, on step 1, with type=\"button\" on every button" and `IDS_OCULTOS` in the harness: the fake DOM does not parse markup, so the hidden start state is mirrored and the mirror is pinned against the markup.
- Extra helpers `completarPaso1`, `nodo` and `pasoVisible` next to the design's `abrirAlta` and `avanzar`.
- `reiniciarAlta` also hides and empties `#auto-aviso` and empties `#auto-resumen` (wizard state reset).
- `auto-crear` became primary (design), from secondary.
- PR2a has no Cancelar: until PR2b, the open wizard closes only on a 201 or a tenant switch.
- In PR2a `elegirPlantilla` keeps only the pre-existing "later choice wins" check. Every reset clears the select, so a late detail from the previous tenant is dropped, unless a template with the same id is chosen again before that detail arrives (the case W10 covers). The token guard that the spec scenario requires, and W10, land in PR2b.

### Spec Coverage (PR2a)

| Scenario | Test |
|---|---|
| Requesting the console page, Page links the shared stylesheet, Script hazards, Script may reference the shared classes | existing guards plus G1/G3, all passing |
| Viewing the automations list | existing list test, passing |
| Creating an automation from the console, Parameters of the chosen template, POST body is unchanged | RW1 |
| Creating with a recipient | RW2 |
| Invalid recipient shown legibly, Server 400 shown in the banner (step 2 kept) | RW3 |
| Wizard opens on step 1 (stepper half; the `GET /conexiones` half is PR2b) | W3 |
| Step navigation | W3 |
| Tenant switch wipes the wizard, Tenant load keeps three requests | W6 |
| All ids present once, A renamed id fails the guard, Limit attributes preserved | G1, G2 with the wizard ids; the wizard markup guard |

Later PRs: "Late response after a tenant switch is ignored" (fully PR2b: W10 and W5), "Tenant has no connections", "Connections fetch fails", the `GET /conexiones` half of "Wizard opens on step 1" (PR2b); "Known label", "Unknown label" (PR2c); the schedule scenarios and "Success banner shows first run and zone" (PR3); availability (PR4); preview (PR5).

## PR2b: Connection dropdown (`ch21c/asistente-conexion`)

Status: implemented, verified and committed (not pushed). Authored 299 lines. 2b.4 (manual visual review) stays open for a human.

### Commits

| Commit | Content |
|---|---|
| b34d468 | `feat(ch21c)`: task 2b.0, the items moved from PR2a: Cancelar (`auto-cancelar` markup, `IDS` entry, `botonCancelarAuto` and its listener), W7, the `elegirPlantilla` token guard, W10. `pr2a-moved-to-pr2b.patch` applied cleanly with `git apply` (tests first, then code) |
| 1204650 | `feat(ch21c)`: the connection dropdown, `cargarConexiones`, `renderizarConexiones`, W2, W4, W5, W9, and RW1-RW3, W3, W6, W7, W10 adapted to the dropdown |
| (docs) | `docs(ch21c)`: `tasks.md` and this file |

### Completed Tasks

- [x] 2b.0 Moved items from PR2a (see the first commit).
- [x] 2b.1 Harness: `arrancar()` creates `auto-conexion` as a `select`; `abrirAlta` is async, queues the `GET /conexiones` answer (default `CONEXIONES`, one row per connection id the tests pick, or a pending `Promise` to keep it in flight) and settles; new helpers `opcionesConexion` and `elegirPlantillaAlta`; `completarPaso1` picks the connection with a `change` event and asserts it is offered. W2, W4, W5, W9 written; RW1-RW3, W3, W6, W7, W10 pick from the dropdown.
- [x] 2b.2 `#auto-conexion` is `<select class="zd-select">` labeled "Conexión"; `cargarConexiones()` is called by `abrirAlta` through `pedirAutomatizacion('/conexiones')` with the `g === generacionAlta` guard; `renderizarConexiones` builds the `''` placeholder ("Elegí una conexión", or "No hay conexiones registradas" for an empty list) and one option per row with text `nombre (id.slice(0, 8)…)` through `textContent`; empty list and `truncado` notices in `#auto-aviso`; a non-200 calls `mostrarRechazo`; a `change` listener replaces the `input` listener; `reiniciarAlta` rebuilds the dropdown with only the placeholder.
- [x] 2b.3 Verification (below).
- [ ] 2b.4 Manual visual review: human only.
- [x] 2b.5 Line-count checkpoint: 299 authored (`consola.ts` +68/-11, `consola.test.ts` +196/-24).

### RED evidence

- 2b.0: with only the test half of the patch applied, `npx tsx --test src/consola.test.ts`: 36 tests, 3 fail (G1 for the missing `auto-cancelar`, W7, W10). With the code half: 36/36.
- 2b.1: before 2b.2, 40 tests, 29 pass, 11 fail (RW1, RW2, RW3, W3, W6, W7, W10 through the dropdown; W2, W4, W5, W9). After 2b.2: 40/40.
- Mutation check: removing the `g !== generacionAlta` line from `cargarConexiones` fails W5 only (39/40); restored.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/consola.test.ts`: 40/40 pass |
| Full suite | `TEST_DB_PORT=5434 TEST_DB_PASSWORD=<from .env> npm test`: 882 tests, 882 pass, 0 fail, 0 skipped tests; one suite skipped by design (Mailpit live delivery, no Mailpit on 127.0.0.1:8026). Live target 127.0.0.1:5434 (Compose `db`); port 5432 never used |
| Row counts | Tenant 1, Conexion 4, Automatizacion 0, Plantilla 2, equal before and after the full run |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0; `sh -n scripts/smoke.sh` OK (smoke not run, orchestrator-owned) |
| Page hazards | Added lines carry no backtick, no `${`, no backslash, no markup-assigning property and no `className` assignment; the script still contains no `zd-` (G3 unchanged and passing); one `<style>`, one closing script tag (guards passing) |
| Runtime harness | Manual visual review (2b.4), human only |
| Rollback boundary | Revert the two PR2b commits (console only); PR2b must be reverted before PR1 because the dropdown needs `GET /conexiones` |

### Spec Coverage (PR2b)

| Scenario | Test |
|---|---|
| Wizard opens on step 1 (request half: one `GET /conexiones` with the active tenant) | W2, W3 |
| Tenant has no connections | W4 (also the `truncado` notice) |
| Connections fetch fails | W9 |
| Late response after a tenant switch is ignored (`GET /conexiones` and template-detail halves) | W5, W10 |
| Tenant switch wipes the wizard (no connection of A stays selectable) | W6 |
| Tenant load keeps three requests | W6 |
| Creating from the console, with a recipient, invalid recipient, POST body unchanged | RW1-RW3 through the dropdown |
| All ids present once (with `auto-cancelar`) | G1 |

Later PRs: "Known label", "Unknown label" and W8 (PR2c); the schedule scenarios and "Success banner shows first run and zone" (PR3); availability and the validation half of "Late response after a tenant switch is ignored" (PR4); preview (PR5).

### Ids and guards

- Added: `auto-cancelar` (markup, `IDS`). Changed: `auto-conexion` is now a `select` (same id). No id removed.
- G1, G2, G3 and the wizard markup guard are unchanged in code and pass; the markup guard now also sees Cancelar among the `type="button"` buttons.

### Deviations

- On a failed `GET /conexiones` (non-200, or a null result such as a network failure) `#auto-aviso` also says "No se pudieron cargar las conexiones. Cancelá y volvé a abrir el alta para reintentar." next to the banner, so the retry path is stated in the wizard. The design named only the banner.
- The step-2 summary names the connection by its option text (`nombre (id prefix…)`) instead of the raw id.
- `crearAutomatizacion` sends `selectorConexionAuto.value` without `.trim()`: the value is an option id, so the POST body is unchanged.
- The script variable `entradaConexionAuto` is renamed `selectorConexionAuto`; helpers `mostrarAviso` and `opcionDe` are added.
- Commit trailer uses `Claude Sonnet 5.5` plus `Claude-Session`, as the launch prompt requested.

## PR2c-PR5

Not started.

## PR1 verification addendum (orchestrator, 2026-10-05)

- `bash scripts/smoke.sh` on the PR1 tip against the project's Compose stack: SMOKE TEST PASSED, including "CH-21c: GET /conexiones ... no header -> 400; tenant A -> 200 with its connection and no credential" (task 1.10).
- Commit trailers of the apply agent were rewritten from `Claude Opus 5.5` to `Claude Sonnet 5.5` before pushing (unpushed commits, identical diff).
- Independent verifier: PASS WITH WARNINGS, 0 CRITICAL. W1: the C2 `id` tie-break is compared against a JavaScript sort (valid for uuid ids, passed live). W2: live-DB evidence rests on the author's run; the smoke now closes S1. Suggestions not applied: a non-UTC route-level assertion in R1 and a guard against `ConexionListada` gaining fields.
- Side effect of the smoke: the stack was brought down afterwards without removing volumes; the project database keeps its seeded catalog rows.

## PR2b verification addendum (orchestrator, 2026-10-05)

- `bash scripts/smoke.sh` on the PR2b tip against the project's Compose stack: SMOKE TEST PASSED (38 OK). Full `npm test` against the Compose db at port 5434: 882/882 (author's run).
- Independent verifier: PASS WITH WARNINGS, 0 CRITICAL. W1: a network failure (or unreadable body) raises the generic banner inside `pedirAutomatizacion` before the caller's `generacionAlta` check, so a stale network failure can still show a banner (the non-200 path is guarded); W2: no test drives the network-failure branch of `cargarConexiones` or a cancel/reopen while the fetch is in flight. Suggestions: a retry button instead of "cancel and reopen" is a later UX choice.
- Visual review with headless Chrome (light/dark, 1280 and 360 px) against the running stack with 4 real connections: dropdown lists `nombre (id8…)` options after the "Elegí una conexión" placeholder, Cancelar visible next to Siguiente, Siguiente enabled after choosing a connection and a template, step 2 shows the connection's name in the summary, a 400 for an invalid cron keeps the wizard on step 2, Volver keeps the values, Cancelar closes and resets the dropdown to the placeholder; no horizontal scroll. Not reviewed: empty list, `truncado` notice and failure banner (not reproducible against this tenant), Firefox.
