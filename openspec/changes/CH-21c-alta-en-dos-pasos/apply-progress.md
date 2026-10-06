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

## PR2c: Template picker (`ch21c/asistente-plantillas`)

Status: implemented, verified and committed (not pushed). Authored 316 lines. 2c.4 (manual visual review) stays open for a human.

### Commits

| Commit | Content |
|---|---|
| e653420 | `feat(ch21c)`: the card picker (markup, `DESCRIPCIONES_PLANTILLA`, `catalogoPlantillas`, `plantillaElegida`, `detallesPlantilla`, `tarjetaPlantilla`, `renderizarPicker`, `elegirPlantilla(id)`), G3', W1, W8, the markup guard for the radiogroup, and RW1-RW3, W3, W6, W7, W10 adapted to pick a card |
| (docs) | `docs(ch21c)`: `tasks.md` and this file |

### Completed Tasks

- [x] 2c.1 Harness: `arrancar()` creates `auto-plantilla` as a `div`; `elegirTenant` takes an optional catalog; new helpers `tarjetas`, `radioDe`, `elegirTarjeta` (checks one radio, unchecks the others as a browser radio group does, fires `change`); `elegirPlantillaAlta` picks the `p-1` card. G3' replaces the `!script.includes('zd-')` assertion (moved out of the CH-21a G3 test into its own test). W1, W8 written; RW1-RW3, W3, W6, W7, W10 pick a card.
- [x] 2c.2 `#auto-plantilla` is `<div class="zd-templates" role="radiogroup" aria-label="Plantilla">`; the visible heading is `<p class="zd-label" aria-hidden="true">Plantilla</p>` (a `label for` a div names nothing). Script: `DESCRIPCIONES_PLANTILLA` and `DESCRIPCION_NEUTRA`, `catalogoPlantillas`, `plantillaElegida`, `detallesPlantilla` (cleared in `reiniciarAlta`, which also redraws the cards unchosen), `tarjetaPlantilla`, `renderizarPicker`, `elegirPlantilla(id)` guarded by `g === generacionAlta` and `plantillaElegida === id`; `crearAutomatizacion` sends `plantillaId: plantillaElegida`; `selectorPlantilla` and its listener removed.
- [x] 2c.3 Verification (below).
- [ ] 2c.4 Manual visual review: human only.
- [x] 2c.5 Line-count checkpoint: 316 authored (`consola.ts` +88/-35, `consola.test.ts` +168/-25).

### RED evidence

- Before 2c.2, `npx tsx --test src/consola.test.ts`: 43 tests, 30 pass, 13 fail (G3', the wizard markup guard, RW1, RW2, RW3, W1, W3, W4, W6, W7, W8, W9, W10). After 2c.2: 43/43.
- Mutation checks (each applied alone to the committed code, then restored byte-identical): dropping `g !== generacionAlta` from `elegirPlantilla` fails W10 only; dropping the `plantillaElegida !== id` check fails W8 only; a plain `DESCRIPCIONES_PLANTILLA[etiqueta] || DESCRIPCION_NEUTRA` lookup fails W1 only (the `constructor` label); a two-class card fails G3', W1 and every test that picks a card; no cache fails W8 only; not clearing the cache in `reiniciarAlta` fails RW2; not redrawing the cards in `reiniciarAlta` fails W7.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/consola.test.ts`: 43/43 pass |
| Full suite | `TEST_DB_PORT=5434 TEST_DB_PASSWORD=<from .env> npm test`: 885 tests, 885 pass, 0 fail, 0 skipped tests; one suite skipped by design (Mailpit live delivery, no Mailpit on 127.0.0.1:8026). Live target 127.0.0.1:5434 (Compose `db`); port 5432 never used |
| Row counts | Tenant 1, Conexion 4, Automatizacion 0, Plantilla 2, equal before and after the full run |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0; `sh -n scripts/smoke.sh` OK (smoke not run, orchestrator-owned) |
| Page hazards | Added lines carry no backtick, no `${`, no backslash and no markup-assigning property; the only `zd-` tokens in the script are the three G3' ones, each assigned alone; one `<style>`, one closing script tag (guards passing) |
| Runtime harness | Manual visual review (2c.4), human only |
| Rollback boundary | Revert e653420 (console only): restores the template `<select>` |

### Spec Coverage (PR2c)

| Scenario | Test |
|---|---|
| Known label | W1 (`stock-fisico`, `stock-producible`) |
| Unknown label | W1 (`otra`, `constructor`, and the fixture row with no `automatizacion`; the list after the catalog still renders) |
| Script may reference the shared classes | G3' |
| Parameters of the chosen template | W8 (the later card's controls), RW1 |
| POST body is unchanged (`plantillaId` is the chosen card's id) | W8 (`p-2`), RW1-RW3 |
| Late response after a tenant switch is ignored (template-detail half, through a card) | W10 |
| Tenant switch wipes the wizard (no card stays chosen), Tenant load keeps three requests | W6 |
| Step navigation (the chosen card is kept by Volver) | W3 |

Later PRs: the schedule scenarios and "Success banner shows first run and zone" (PR3); availability, disabled cards and the validation half of "Late response after a tenant switch is ignored" (PR4); preview (PR5).

### Ids and guards

- No id added or removed. `auto-plantilla` is now a `div` (same id, still in `IDS`); the `label for="auto-plantilla"` is gone.
- G3 (CH-21a) keeps the stylesheet checks; its `!script.includes('zd-')` line is replaced by the new G3' test (exact set `['zd-template', 'zd-template__desc', 'zd-template__name']`, each `className = '...zd-...'` single-class and assigned once).
- The wizard markup guard also pins `<div id="auto-plantilla" class="zd-templates" role="radiogroup" aria-label="Plantilla"></div>` and the absence of `for="auto-plantilla"`.

### Deviations

- No bridge CSS: `public/ui/components/components.css` already styles `.zd-templates` (grid), `.zd-template` (card, hover, checked through `:has(input:checked)`, focus ring through `:has(input:focus-visible)`) and hides the radio (`.zd-template input`). The disabled-card style is PR4's.
- `zd-sr` and `zd-template__check` are not used: the group is named by `aria-label` (no `fieldset`/`legend`), and the check mark is an icon (DEC-131: no icons on the card).
- The details cache stores a 200 detail whenever the wizard token still matches, even when a later choice already won; that later choice is still the one rendered.
- W3's final re-check of Siguiente now empties the connection instead of unchoosing the template, because a chosen radio card cannot be unchosen by the operator.
- G3' is its own test instead of an edit inside the CH-21a G3 test.
- No notice when the catalog is empty: the picker is an empty group and Siguiente stays disabled, as the empty select behaved before.
- Commit trailer uses `Claude Sonnet 5.5` plus `Claude-Session`, as the launch prompt requested.

## PR3: Step-2 schedule (`ch21c/asistente-horario`)

Status: implemented, verified and committed (not pushed). Authored 312 lines. 3.5 (manual visual review) stays open for a human.

### Commits

| Commit | Content |
|---|---|
| 24c3633 | `feat(ch21c)`: frequency select, 24 h hour, schedule sentence, always-visible cron field (read-only for a preset), `DIAS_FRECUENCIA`, `NOMBRES_FRECUENCIA`, `DIGITOS`, `horaDe`, `cronDeFrecuencia`, `actualizarHorario`, `formatearInstante`, `confirmacionDeAlta`, the invalid-hour block in `crearAutomatizacion`, the schedule reset in `reiniciarAlta`, bridge rule `#auto-cron[readonly]`; tests H1-H6, the new ids, the markup guard and the existing creation tests set the schedule through the presets |
| (docs) | `docs(ch21c)`: `tasks.md` and this file |

### Completed Tasks

- [x] 3.1 Harness: `auto-frecuencia`, `auto-hora`, `auto-horario-texto` in `IDS` (so in `IDS_GUARDADOS`); `arrancar()` creates `auto-frecuencia` as a `select`; new helper `fijarHorario(escenario, frecuencia, valor)` (picks the frequency, fires `change`, then types the hour for a preset or the cron for `personalizado`, asserting that field is typeable, and fires `input`); `crearSinCerrar` (Crear answered 500, so step 2 stays and the body is returned). H1, H2, H3, H4+H5 (one test), H6 written. RW1 uses `personalizado` (`30 7 * * 1`); RW2, RW3, W6, W8 use `diaria` at `06:00` (same `0 6 * * *` body as before); W7 uses `personalizado`. The wizard markup guard pins the four option values in order, `type="time" value="08:00"` and a cron input with no `hidden`.
- [x] 3.2 Markup in `#auto-paso-2`, before the cron field: a `zd-form-row` with `#auto-frecuencia` (`zd-select`, options `diaria` selected, `lun-vie`, `lun-sab`, `personalizado`) and `#auto-hora` (`zd-input`, `type="time"`, `value="08:00"`), both `aria-describedby="auto-horario-texto"`; `<p id="auto-horario-texto" class="ayuda">`; `#auto-cron` keeps its id and classes, gains `readonly` (the start state is a preset) and is never hidden. Bridge CSS: `#auto-cron[readonly]` (dashed border, `--surface-sunken`, `--text-2`).
- [x] 3.3 Script: as listed in the commit row. `crearAutomatizacion` runs `actualizarHorario()` first, so a preset's cron is rebuilt from the hour as it is at that moment, then refuses with "La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30." and no request when `cronDeFrecuencia` gives `null`; Crear stays enabled. The 201 banner: "Se creó la automatización y ya aparece en la lista. Primera ejecución programada: dd/mm/aaaa HH:MM, zona horaria Z. Es un horario, no una garantía: si el servicio no está en marcha a esa hora, esa ejecución no se recupera." Without a string `proximaEjecucion` and `zonaHoraria` it keeps the former sentence.
- [x] 3.4 Verification (below).
- [ ] 3.5 Manual visual review: human only.
- [x] 3.6 Line-count checkpoint: 312 authored (`consola.ts` +118/-4, `consola.test.ts` +177/-13).

### RED evidence

- Before 3.2/3.3, `npx tsx --test src/consola.test.ts`: 48 tests, 36 pass, 12 fail (G1 for the three new ids, the wizard markup guard, RW2, RW3, W6, W7, W8, H1, H2, H3, H4+H5, H6). RW1 passed RED: with no preset logic the typed cron was sent as before. After: 48/48.
- Mutation checks (each applied alone to the committed `consola.ts`, then restored byte-identical; `cmp` confirmed): no per-character digit loop fails H3 only (the added vectors `' 8:30'` and `'-1:30'` parse as numbers); no `actualizarHorario()` at Crear fails H1 only (an hour changed without an event); no invalid-hour block fails H3; no schedule reset in `reiniciarAlta` fails W6, W7, H4+H5, H6; a rethrow instead of the `RangeError` fallback fails H4+H5; no legacy check fails H4+H5; a cron field always read-only fails RW1, W7, H2, H6; the hour not disabled for `personalizado` fails H2; leading zeros kept (`08` instead of `8`) fails RW2, RW3, W6, W7, W8, H1, H2, H6; hour `24` accepted fails H3; no hour `input` listener fails H1, H2, H3; formatting in `UTC` instead of the server zone fails H4+H5.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/consola.test.ts`: 48/48 pass |
| Full suite | `TEST_DB_PORT=5434 TEST_DB_PASSWORD=<from .env> npm test`: 890 tests, 890 pass, 0 fail, 0 skipped tests; one suite skipped by design (Mailpit live delivery, no Mailpit on 127.0.0.1:8026). Live target 127.0.0.1:5434 (Compose `db`); port 5432 never used |
| Row counts | Tenant 1, Conexion 4, Automatizacion 0, Plantilla 2, equal before and after the full run |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0; `sh -n scripts/smoke.sh` OK (smoke not run, orchestrator-owned; its console greps did not change) |
| Page hazards | Added lines carry no backtick, no `${`, no backslash, no regex literal, no `RegExp`, no markup-assigning property and no `className` assignment; the script's `zd-` tokens are still exactly the three G3' ones; one `<style>`, one closing script tag (guards passing) |
| Runtime harness | Manual visual review (3.5), human only; smoke (orchestrator) |
| Rollback boundary | Revert 24c3633 (console only). Per the design, revert PR3 before PR1 (the banner reads `proximaEjecucion`; H5 tolerates its absence) |

### Spec Coverage (PR3)

| Scenario | Test |
|---|---|
| Preset vectors (submitted `cron` for `diaria`, `lun-vie`, `lun-sab` at 08:30) | H1 (six design vectors, each submitted and checked with the server's `cronValido(., 'UTC')`) |
| Cron field shows the translation read-only | H1 (value, `readOnly`, not hidden), markup guard (no `hidden` on `#auto-cron`) |
| Personalizado makes the cron field editable and passes through | H2 (`30 7 * * 1`, `0 */2 * * *`, full body), RW1 |
| Invalid hour | H3 (eight values, no request, banner, step 2 kept) |
| Success banner shows first run and zone (scheduled, not guaranteed) | H4+H5 |
| Server 400 shown in the banner (step 2 and the schedule kept) | RW3 (cron and hour kept) |
| Tenant switch wipes the wizard (schedule half) | H6, W6 |
| POST body is unchanged | H1 (keys), H2 (full body), RW1-RW3, W8 |
| All ids present once (with the three schedule ids) | G1 |
| Requirement text: before creation the copy names no zone | H1, H2, H6 (exact sentences) |

Later PRs: availability, disabled cards and the validation half of "Late response after a tenant switch is ignored" (PR4); preview (PR5).

### Ids and guards

- Added: `auto-frecuencia`, `auto-hora`, `auto-horario-texto` (markup, `IDS`, hence `IDS_GUARDADOS`). Kept: `auto-cron` (same id and classes; now `readonly` in the markup and never hidden). No id removed or renamed.
- G1, G2, G3 and G3' unchanged in code and passing. The wizard markup guard gains the frequency options, the hour attributes and the visible cron field.

### Deviations

- `#auto-hora` is disabled while `personalizado` is selected (the hour does not apply to a raw cron); choosing a preset enables it again. Not in the design; covered by H2 and H6.
- `NOMBRES_FRECUENCIA` (sentence words per preset) next to the design's `DIAS_FRECUENCIA`, and `ZONA_DEL_DESPLIEGUE` for the shared phrase.
- Crear re-runs `actualizarHorario()` before reading the field, so the cron sent for a preset always matches the hour as it is then, even without an `input`/`change` event (H1's last assertion).
- The hour label reads "Hora (24 horas)" and the cron label reads "Expresión cron (minuto hora día-del-mes mes día-de-la-semana)" (was "Horario (...)"), since the frequency and the hour now carry the schedule.
- One bridge rule `#auto-cron[readonly]`: the shared sheet has no read-only look, and `--surface-code` equals `--surface-sunken` in the light theme, so the dashed border is what tells the shown cron from a typed one.
- H3 carries two extra vectors (`' 8:30'`, `'-1:30'`) so the per-character check is observable; H4 and H5 share one test, which also covers the unresolvable-zone fallback.
- The H1 vectors table lives in `consola.test.ts` as `VECTORES_HORARIO`; it is not exported (CH-23 can copy or move it).
- Commit trailer uses `Claude Sonnet 5.5` plus `Claude-Session`, as the launch prompt requested.

## PR4: Disabled with reason (`ch21c/asistente-disponibilidad`)

Status: implemented, verified and committed (not pushed). Authored 345 lines. 4.5 (manual visual review) stays open for a human.

### Commits

| Commit | Content |
|---|---|
| fc51b1c | `feat(ch21c)`: `entidadesNoAprobadas`, `MOTIVOS_VISTA`, `motivoDeVistas`, `entidadesDe`, `aplicarVeredictos`, `sondearConexion` with `generacionSondeo`, the hidden `span.motivo-plantilla` on every card, `partesTarjeta`, `ocultarAviso`, the connection `change` listener, bridge CSS; tests V1-V7 and the adapted helpers |
| (docs) | `docs(ch21c)`: `tasks.md` and this file |

### Completed Tasks

- [x] 4.1 Harness and tests. `informeDe(estados)` builds the report in contract order (`CONTRATO_CANONICO`), `TODO_VALIDO`, `elegirConexion` (queues the probe answer, changes the dropdown, settles), `completarPaso1` and the W3 and W8 connection choices go through it, `elegirPlantillaAlta`'s detail now carries `entidades: ['producto']`. V1 runs six vectors through the UI and through the imported `evaluarVistas` (all valid, `no-mapeada`, `no-validado`, `invalida`, the DEC-127 `stock-fisico` without `receta_componente` with an M4 `aplicable` block in the report, and three entities blocked at once); V2 pins the exact reason text and the absence of raw codes; V3 deselection, values and Siguiente cleared, then freed by a second connection; V4 stale probe by connection change; V5 four failure shapes (HTTP 500, non-JSON, no report in the body, a detail that fails); V6 stale probe after a tenant switch, with no further request; V7 the unchanged POST body after a failed probe.
- [x] 4.2 Script as listed in the commit row. The probe is `GET /conexiones/:id/validacion-mapeo`, then one `GET /plantillas/:id` per catalog row in catalog order (the wizard's cache first), each step dropped unless `generacionAlta` and `generacionSondeo` still hold. Reason copy: "No disponible con esta conexión: ENTIDAD (sin vista registrada | vista sin validar | la validación de la vista falló), .... Cada ejecución se frenaría antes de conectar." Verifying notice and fail-open notice as in the design.
- [x] 4.3 Bridge CSS: `.zd-template:has(input:disabled)`, its `:hover`, `.motivo-plantilla`. Every token used exists in the shared sheet (`--surface-sunken`, `--border-2`, `--text-help`, `--warn-text`).
- [x] 4.4 Verification (below).
- [ ] 4.5 Manual visual review: human only.
- [x] 4.6 Line-count checkpoint: 345 authored (`consola.ts` +108/-1, `consola.test.ts` +224/-12), against the ~270 forecast and the 400 budget.

### RED evidence

- Before the script change, `npx tsx --test src/consola.test.ts`: 55 tests, 40 pass, 15 fail (V1-V7, and the eight tests whose helper now queues a probe answer that nothing consumes: the create and recipient tests, W1, W3, W6, W8, H4/H5). After: 55/55.
- Mutation checks (each applied alone to the committed `consola.ts`, then restored byte-identical; `cmp` confirmed): dropping the `generacionSondeo` check on the probe answer fails V4 only; dropping the `generacionAlta` check fails V6 only; no deselection of a chosen template that became disabled fails V3 only; the raw state code in the reason fails V2 only; a reason naming only the first blocked entity fails V1 and V2; no fail-open notice fails V5 and V7.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/consola.test.ts`: 55/55 pass (48 before PR4 plus V1-V7) |
| Full suite | `TEST_DB_PORT=1 npm test`: 591 tests, 591 pass, 0 fail. The live DB blocks were **not run**: Docker was not running and 127.0.0.1:5434 refused connections (port 5432 never used), and the task forbade starting Compose. PR4 touches no server code, so the live blocks are unchanged by it, but they are not proven by this run. The orchestrator's run against the Compose db is the one of record |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0; `scripts/smoke.sh` not touched (its console greps did not change; the smoke run is orchestrator-owned) |
| Page hazards | Added lines carry no backtick, no `${`, no backslash, no markup-assigning property and no `zd-` token; G3' (exact three-token set, single-class assignments) passes unchanged, since `motivo-plantilla` is not a shared class; one `<style>`, one closing script tag (guards passing) |
| Runtime harness | Manual visual review (4.5), human only: `:has()` support, the disabled look, focus order, verifying and fail-open notices |
| Rollback boundary | Revert fc51b1c (console only): restores the always-enabled cards |

### Spec Coverage (PR4)

| Scenario | Test |
|---|---|
| Template with a non-valid entity is disabled | V1 (`no-validado`, `no-mapeada`, `invalida`, DEC-127, several), V2 |
| Template with all entities valid stays enabled | V1 (all valid), V3 (freed by a connection that can run it) |
| Validation fetch fails | V5, V7 |
| Late validation response is discarded | V4 |
| Late response after a tenant switch is ignored (validation half) | V6 |

Later: preview (PR5).

### Ids and guards

- No id added or removed. `motivo-plantilla` is a class, not an id, and is not a `zd-` class, so G1, G2, G3, G3' and the wizard markup guard are unchanged in code. W1 gains the fifth card child (`span.motivo-plantilla`) in its expected shape, a deliberate test edit.

### Deviations

- The reason lists every blocked entity in contract order (the design's example showed one), and an unknown state word falls back to "vista no aprobada" instead of printing the code.
- A chosen card's own detail counts as the cached detail: a detail without an `entidades` array (malformed) leaves that card enabled and raises the fail-open notice; it is not cached by the probe, only a detail with `entidades` is.
- Choosing a connection hides `#auto-aviso` when the probe ends well, so the "only the first N connections" notice of `truncado` disappears once a connection is chosen. Choosing the placeholder again also hides it.
- On a 500 or a network failure of the probe, only the fail-open notice shows (no banner), except for a non-JSON body or a network error, where `pedirAutomatizacion` already raises its own banner.
- Siguiente is not disabled while the probe is in flight: the advisory answer can still deselect the chosen template when it lands.
- The probe re-runs on every connection change, including the template details not yet read; the picker cards stay enabled while it runs.
- `mostrarAviso` gained a sibling `ocultarAviso`; `reiniciarAlta` keeps its inline reset.
- Commit trailer uses `Claude Sonnet 5.5`, as the launch prompt requested.

## PR5

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

## PR2c verification addendum (orchestrator, 2026-10-05)

- `bash scripts/smoke.sh` on the PR2c tip against the project's Compose stack: SMOKE TEST PASSED (38 OK). Full `npm test` against the Compose db at port 5434: 885/885 (author's run).
- Independent verifier: PASS WITH WARNINGS, 0 CRITICAL, 0 WARNING, 3 SUGGESTION. S1: W3's `Siguiente` click guard for an empty `plantillaElegida` is no longer exercised by a click (unreachable by the operator after a first choice). S2: after a non-200 detail request the card stays chosen and `Siguiente` stays enabled with no value controls; re-clicking a checked radio fires no `change`, so retry needs another card (same as the old select). S3: a stale `/plantillas` catalog answer from a previous tenant can redraw the picker (pre-existing: `cargarCatalogoPlantillas` on master has no generation token); track for a later change.
- Visual review with headless Chrome (light/dark, 1280 and 360 px) against the running stack: both template cards with name and description by label, none checked initially, hover, click chooses the first card (accent border), ArrowDown moves the choice to the second with focus on a radio, Siguiente enabled with a connection, step 2, Volver keeps the card, Cancelar closes; cards stack at 360 px; no horizontal scroll. Not reviewed: Firefox, long template names, the neutral-description card (the catalog only has the two seeded templates).

## PR3 verification addendum (orchestrator, 2026-10-05)

- `bash scripts/smoke.sh` on the PR3 tip against the project's Compose stack: SMOKE TEST PASSED (38 OK). Note: the orchestrator ran `docker compose up -d --build` while the smoke was still running; the smoke finished with the same 38 OK and exit 0, so it was not affected, but the interference was a process error. Full `npm test` against the Compose db at port 5434: 890/890 (author's run).
- Independent verifier: PASS WITH WARNINGS, 0 CRITICAL, 1 WARNING, 3 SUGGESTION. W1: the `hasOwnProperty` guard for an unknown preset in `cronDeFrecuencia` has no covering test (defensive; the select cannot produce an unknown value). S1: `#auto-hora` is disabled for `personalizado` (not required by the spec; note it in the manual review). S2: `formatearInstante` depends on the browser's `Intl` for `es-AR`; confirm the `dd/mm/aaaa HH:MM` format in a real browser. S3: no test drives a `change` event alone on `#auto-hora`.
- Visual review with headless Chrome (light/dark, 1280 and 360 px) against the running stack: each frequency shows the translated cron (`0 8 * * *`, `0 8 * * 1-5`, `0 8 * * 1-6`) read-only with a dashed border and the Spanish sentence; `personalizado` makes the cron editable and disables the hour; changing the hour to 07:30 gives `30 7 * * 1-5`; an empty hour gives an empty cron and Crear shows "La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30." without sending a request; with the creation response stubbed in the page (no automation was created), the success banner reads "Se creó la automatización y ya aparece en la lista. Primera ejecución programada: 06/10/2026 07:30, zona horaria UTC. Es un horario, no una garantía: ..."; no horizontal scroll at 360 px. Not reviewed: Firefox and `type="time"` rendering there, the real server-computed first run (the 201 was stubbed; the server side is covered by PR1 tests).
