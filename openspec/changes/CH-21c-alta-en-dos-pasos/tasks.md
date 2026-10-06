# Tasks: CH-21c — Two-Step Automation Creation (D2) and Template-Tied Email Format (N3)

From `design.md`, the four delta specs under `specs/` and `proposal.md`. Where they differ, the SPEC wins. No task edits `docs/01-decisiones.md` (DEC-129 to DEC-132 are registered). Test ids (N1-N6, R1, R2, C1-C3, T2-L, S1, W1-W10, RW1-RW3, G3', H1-H6, V1-V7, E1-E4) are the design's. Apply never commits; commits, PRs, verify and archive belong to the orchestrator. No schema, migration, dependency, env or engine change (rule 6): `correo.ts`, `contexto-tenant.ts`, `planificador.ts`, `consulta-ejecucion.ts` and `prisma/` are not modified. The inline script keeps one `</script>`, no backtick, no `${` and no markup-assigning property.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~250, PR2a ~330 (landed at 396 after moving work to PR2b), PR2b ~250 (was ~190; +Cancelar, W7, W10 and the `elegirPlantilla` token guard from PR2a), PR2c ~220, PR3 ~305, PR4 ~270, PR5 ~170 authored (docs excluded) |
| 400-line budget risk | Medium (PR2a is the tightest at ~330; every other PR is under 310) |
| Chained PRs recommended | Yes |
| Suggested split | PR0 (docs) -> PR1 -> PR2a -> PR2b -> PR2c -> PR3 -> PR4 -> PR5 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Base rule: each PR has base `master` once the previous PR in merge order has merged; until then it is stacked on the previous branch. Do not split a PR in advance; if its authored count exceeds 400 at the checkpoint task, STOP and split before opening.

Line-count checkpoint method: `git diff --stat` plus `git status --porcelain` with the line count of each `??` file. `docs/**` and `openspec/**` are excluded from the authored count.

**Live-PostgreSQL note (applies to every task marked LIVE).** The project's Compose `db` must be published through an override file kept OUTSIDE the repository, mapping `127.0.0.1:5434:5432`. Run with `TEST_DB_PORT=5434` and `TEST_DB_PASSWORD` read from `.env` as an environment variable only (never printed, never written to a file). NEVER use port 5432 (an unrelated Saleor PostgreSQL). Report exactly which tests ran and which were skipped, with the target host and port and no secrets. Never claim a pass that was not observed; a skipped live block is reported as skipped and its task as not proven.

**Manual visual-review tasks** (console PRs) cannot be marked done by an agent. They check every state of the PR's UI, light and dark themes, 360 px and 1280 px widths, in Chromium and Firefox. The agent leaves them unchecked and lists them in its report.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 0 | Exploration, DEC-129..132, proposal, specs, design, tasks | PR0 `ch21c/exploracion` | N/A (docs only) | N/A | Revert docs commits |
| 1 | `proximaEjecucion`, 201 fields, `GET /conexiones`, `listados.ts` | PR1 `ch21c/servidor-conexiones` | `npx tsx --test src/automatizaciones.test.ts src/conexiones.test.ts` | `bash scripts/smoke.sh` | Revert last of the chain's server dependents (PR3, PR2b first) |
| 2 | Wizard shell | PR2a `ch21c/asistente-base` | `npx tsx --test src/consola.test.ts` | Manual visual review | Restores flat form |
| 3 | Connection dropdown | PR2b `ch21c/asistente-conexion` | `npx tsx --test src/consola.test.ts` | Manual visual review | Revert before PR1 |
| 4 | Template picker cards | PR2c `ch21c/asistente-plantillas` | `npx tsx --test src/consola.test.ts` | Manual visual review | Restores select |
| 5 | Schedule presets and first-run banner | PR3 `ch21c/asistente-horario` | `npx tsx --test src/consola.test.ts` | `bash scripts/smoke.sh` plus visual review | Revert before PR1 |
| 6 | Disabled-with-reason | PR4 `ch21c/asistente-disponibilidad` | `npx tsx --test src/consola.test.ts` | Manual visual review | Console-only revert |
| 7 | Email preview | PR5 `ch21c/asistente-vista-previa` | `npx tsx --test src/consola.test.ts` | Manual visual review | Console-only revert |

## PR0: Docs

- [x] 0.1 Exploration and DEC-129 to DEC-132 in `docs/01-decisiones.md` (commits 5b98076, 5fb49a7) on `ch21c/exploracion`.
- [x] 0.2 `proposal.md`, the four delta specs and `design.md` written (commit a9a4582).
- [x] 0.3 `tasks.md` written (this file).
- [ ] 0.4 One docs commit with `tasks.md` on `ch21c/exploracion`, before PR1 starts. Orchestrator-owned.

## PR1: Server (~250 authored)

Branch `ch21c/servidor-conexiones`. RED tests first (1.1-1.4), then GREEN (1.5-1.9).

- [x] 1.1 RED N1-N6 in `src/automatizaciones.test.ts` (no database): vectors in design PR1 (`1-5` Friday to Monday, `1-6` to Saturday, Saturday to Monday, Buenos Aires vs UTC, strictly-after with `estaVencida` at `p` and `p - 1 ms`, `@daily` and six fields throw). Specs: Scheduling "First run after creation", "Weekday range across a weekend", "Saturday range", "Non-UTC zone", "Strictly after creation". Verify: `npx tsx --test src/automatizaciones.test.ts` fails (function missing).
- [x] 1.2 RED R1 (LIVE) in `src/automatizaciones-rutas.test.ts`: 201 body keys exactly `automatizacion, proximaEjecucion, zonaHoraria`, `automatizacion` keys unchanged, `proximaEjecucion` equals the function applied to `creadaEn`, `zonaHoraria === 'UTC'`. Specs: "Additive and unchanged", "First run after creation".
- [x] 1.3 RED R2 (no database, non-skipped block), C1, C2, C3 (LIVE) in `src/conexiones.test.ts`. R2: new describe block with a no-read client mirroring `clienteSoloTenant` (`automatizaciones-rutas.test.ts:19-30`), `GET /conexiones` without header gives 400 `tenant-no-indicado`. C1: keys exactly `['id','nombre']`, no `credencial`, password or host, order `nombre` then `id`. C2: `LIMITE_LISTADO + 1` rows via `createMany`, 200 rows and `truncado: true`, cleanup. C3: fresh tenant gives `200 { conexiones: [], truncado: false }`. Specs: Connection "Listing own connections", "Missing tenant", "Tenant without connections", "Row cap", "The listing never exposes the credential".
- [x] 1.4 RED T2-L (LIVE) in `src/aislamiento.test.ts`: both directions `[a,b]` and `[b,a]`, 200, own `conexionId` in, owner's out; body excludes `duenio.conexionId`, the other tenant's connection name (`Replica A` / `Replica B`), `duenio.tenantId`, `objetivo.password`; add the header note that listing routes are proven by listing tests. Specs: Isolation "Connection listing sweep row", "Full two-tenant route sweep", Connection "Two tenants".
- [x] 1.5 GREEN Create `src/listados.ts` (`LIMITE_LISTADO = 200` and its doc); in `src/consultas-guardadas.ts` replace the definition with `import { LIMITE_LISTADO } from './listados.js';` plus `export { LIMITE_LISTADO };`. Verify: `npx tsc --noEmit`, `npx tsx --test src/consultas-guardadas.test.ts` unchanged.
- [x] 1.6 GREEN `src/automatizaciones.ts`: `export function proximaEjecucion(cron, desde, zona): Date` via `camposCron` (throws `'proximaEjecucion: horario fuera de cron estándar'` on `null`) and `CronExpressionParser.parse(campos.join(' '), { currentDate: desde, tz: zona }).next().toDate()`, no try/catch. Satisfies N1-N6.
- [x] 1.7 GREEN `src/automatizaciones-rutas.ts`: 201 body `{ automatizacion, proximaEjecucion: proximaEjecucion(cron, automatizacion.creadaEn, zonaHoraria).toISOString(), zonaHoraria }` plus import. Satisfies R1.
- [x] 1.8 GREEN `src/conexiones.ts`: `ConexionListada = { id: true, nombre: true }` and `app.get('/conexiones', ...)` with `orderBy: [{ nombre: 'asc' }, { id: 'asc' }]`, `take: LIMITE_LISTADO + 1`, body `{ conexiones, truncado }`, no `where` (extension scopes), no exemption in `src/contexto-tenant.ts`. Satisfies R2, C1-C3, T2-L.
- [x] 1.9 `scripts/smoke.sh` S1 (+12): without the header `GET /conexiones` is 400; with the smoke tenant it is 200, contains the registered smoke connection id, and does not contain `credencial`. Verify: `bash -n scripts/smoke.sh` here; the full run is in 1.10.
- [x] 1.10 (done 2026-10-05: smoke PASSED on the PR1 tip) Verification (LIVE): `npx tsc --noEmit`, `npx tsx --test src/automatizaciones.test.ts src/automatizaciones-rutas.test.ts src/conexiones.test.ts src/aislamiento.test.ts`, full `npm test`, `npm run build`, `bash scripts/smoke.sh` (after `docker compose restart app`). Report ran vs skipped and counts.
- [x] 1.11 Line-count checkpoint (method above): authored at most 400 excluding docs (forecast ~250).

## PR2a: Wizard shell (~330 authored, no new request)

Branch `ch21c/asistente-base`, stacked on PR1 until it merges. Tightest PR (2026-10-05: it exceeded 400; both this fallback and the W10 and `elegirPlantilla` guard move were applied, see 2a.8 and 2b.0): if the checkpoint (2a.8) exceeds 400, move Cancelar (`auto-cancelar`, `cerrarAlta` button wiring) and W7 to PR2b before opening.

- [x] 2a.1 RED harness in `src/consola.test.ts`: `Nodo` gains `setAttribute`/`removeAttribute`/`getAttribute` (a `Map`), `checked`, `name`, `readOnly`; add the 11 ids to `IDS` (`auto-nueva`, `auto-alta`, `auto-marca-1`, `auto-marca-2`, `auto-paso-1`, `auto-paso-2`, `auto-aviso`, `auto-siguiente`, `auto-cancelar`, `auto-resumen`, `auto-volver`); helpers `abrirAlta` and `avanzar`; `arrancar()` (`:336`) keeps `auto-plantilla` as `select` and `auto-conexion` as `div`. Spec: Query-console "All ids present once", "A renamed id fails the guard", "Limit attributes preserved".
- [x] 2a.2 RED rewrite RW1 (`:803`), RW2 (`:881`), RW3 (`:900`) through Nueva, step 1, Siguiente, step 2, asserting the same POST body as today; RW3 also asserts `#auto-paso-2` visible, `#auto-paso-1` hidden and typed values kept after the 400. Specs: "Creating an automation from the console", "Creating with a recipient", "Invalid recipient shown legibly", "Server 400 shown in the banner", "POST body is unchanged", "Parameters of the chosen template".
- [x] 2a.3 RED W3 (Siguiente disabled until connection and template are set, Volver keeps values, `aria-current` moves), W6 (tenant switch hides and wipes the wizard, still exactly 3 requests), W7 (Cancelar closes and resets), W10 (deferred `GET /plantillas/:id` resolved after a tenant switch builds no value control). Specs: "Wizard opens on step 1" (request half deferred to PR2b), "Step navigation", "Tenant switch wipes the wizard", "Late response after a tenant switch is ignored", "Tenant load keeps three requests". (2026-10-05: W3 and W6 done; W7 and W10 moved to PR2b by the budget split, see 2a.8 and 2b.0.)
- [x] 2a.4 GREEN `src/consola.ts` markup: replace `:188-202` with `#auto-nueva`, `#auto-alta` card, stepper `<ol class="zd-steps">` with `#auto-marca-1`/`#auto-marca-2`, `#auto-paso-1` (connection input, `#auto-aviso`, `#auto-plantilla` select, `auto-siguiente` disabled, `auto-cancelar`), `#auto-paso-2` (`#auto-resumen`, `auto-valores`, `auto-cron`, `auto-destinatario`, `auto-volver`, `auto-crear`); every button `type="button"`. Bridge CSS: two `#auto-marca-1:not([aria-current])` rules plus `#auto-alta` spacing. (`auto-cancelar` moved to PR2b by the budget fallback.)
- [x] 2a.5 GREEN `src/consola.ts` script: `SIN_TENANT` shared, `generacionAlta`, `abrirAlta`, `cerrarAlta`, `reiniciarAlta`, `irAPaso` (`setAttribute`/`removeAttribute` only), `actualizarSiguiente`, Siguiente handler, connection `input` listener, `limpiarAutomatizaciones` calls `cerrarAlta`, `elegirPlantilla` and `crearAutomatizacion` guarded by `g === generacionAlta` (201 calls `cerrarAlta`, `mostrarConfirmacion`, then list reload; a 400 keeps step 2). (2026-10-05: the `elegirPlantilla` token guard moved to PR2b by the budget split; `crearAutomatizacion` keeps its guard.)
- [x] 2a.6 Verification: `npx tsc --noEmit`, `npx tsx --test src/consola.test.ts`, full `npm test` (live blocks as ran or skipped; see the live note), `npm run build`. Confirm the page guards (one `</script>`, no backtick, no `${`, no `innerHTML`) pass: Query-console "Requesting the console page", "Page links the shared stylesheet", "Script hazards stay out of the page", "Script may reference the shared classes", "Viewing the automations list". (2026-10-05: all pass; live DB blocks SKIPPED with `TEST_DB_PORT=1` because the Compose db was not running; PR2a changes no server code.)
- [ ] 2a.7 Manual visual review (human only, cannot be marked done by an agent): wizard closed and open, step 1 and step 2, stepper states, disabled Siguiente, banner; light and dark; 360 and 1280 px; Chromium and Firefox.
- [x] 2a.8 Line-count checkpoint (method above): authored at most 400 excluding docs (forecast ~330). If over, apply the fallback above. (2026-10-05: full slice 458 = `consola.ts` +157/-17, `consola.test.ts` +270/-14. Fallback (Cancelar and W7 out): 427. Orchestrator decision (auto-chain, split instead of `size:exception`): W10 and the `elegirPlantilla` token guard also moved to PR2b. Final: 396 = `consola.ts` +147/-15, `consola.test.ts` +220/-14.)

## PR2b: Connection dropdown (~250 authored)

Branch `ch21c/asistente-conexion`. Depends on PR1 and PR2a.

- [x] 2b.0 (done 2026-10-05: the patch applied cleanly with `git apply`; RED observed for G1, W7 and W10 before the code) Moved from PR2a by the budget split (2026-10-05), all required in PR2b. The removed code and tests were kept as a patch that applies on the PR2a tip (`pr2a-moved-to-pr2b.patch`, in the PR2a apply session's scratchpad; recorded in `apply-progress.md`):
  - Cancelar: `<button id="auto-cancelar" class="zd-btn zd-btn--ghost" type="button">Cancelar</button>` in `#auto-paso-1` next to Siguiente, `auto-cancelar` in `IDS`, `botonCancelarAuto` and its `click` listener calling `cerrarAlta()`.
  - W7: Cancelar closes the wizard and resets it, with no request.
  - The `elegirPlantilla` token guard: capture `var g = generacionAlta;` and drop the detail unless `g === generacionAlta` (and the choice is unchanged).
  - W10: a deferred `GET /plantillas/:id` resolved after a tenant switch builds no value control. Write it RED before the guard; the PR2a apply showed that removing only the guard fails only W10.

- [x] 2b.1 (done 2026-10-05: 11 RED failures observed before 2b.2) RED harness: `arrancar()` creates `auto-conexion` as `select`. RED W2 (opening issues `GET /conexiones` with `X-Tenant-Id`, options built through `textContent`, text `nombre (id.slice(0,8)…)`), W4 (empty list shows `#auto-aviso`, Siguiente stays disabled), W5 (deferred `/conexiones` resolved after a tenant switch adds no option, queued as an unresolved `Promise`), W9 (500 shows the `mostrarRechazo` banner, wizard open, Siguiente disabled, Cancelar works, reopening issues a fresh request). Adapt RW1-RW3 to pick from the dropdown. Specs: "Wizard opens on step 1", "Tenant has no connections", "Connections fetch fails", "Late response after a tenant switch is ignored", "Tenant load keeps three requests".
- [x] 2b.2 GREEN `src/consola.ts`: `#auto-conexion` becomes `<select class="zd-select">` labeled "Conexión"; `cargarConexiones()` called by `abrirAlta` via `pedirAutomatizacion('/conexiones')` with the `g === generacionAlta` guard; `renderizarConexiones` adds placeholder `''` ("Elegí una conexión") and one option per row; empty list or `truncado` message in `#auto-aviso` ("No hay conexiones registradas" placeholder); non-200 calls `mostrarRechazo`; `change` listener replaces the `input` listener.
- [x] 2b.3 Verification: `npx tsc --noEmit`, `npx tsx --test src/consola.test.ts`, full `npm test`, `npm run build`. (2026-10-05: all pass; full suite LIVE on 127.0.0.1:5434, 882/882, 0 skipped tests.)
- [ ] 2b.4 Manual visual review (human only): dropdown with options, empty list notice, failure banner, long names; light and dark; 360 and 1280 px; Chromium and Firefox.
- [x] 2b.5 Line-count checkpoint: authored at most 400 excluding docs (forecast ~250: ~190 plus about 60 for Cancelar, W7, W10 and the `elegirPlantilla` token guard moved from PR2a). (2026-10-05: 299 = `consola.ts` +68/-11, `consola.test.ts` +196/-24.)

## PR2c: Template picker (~220 authored)

Branch `ch21c/asistente-plantillas`. Depends on PR2b.

- [x] 2c.1 (done 2026-10-05: 13 RED failures observed before 2c.2) RED harness: `arrancar()` creates `auto-plantilla` as `div`. RED G3' (exact set `['zd-template', 'zd-template__desc', 'zd-template__name']`, every script `className` single-class; replaces `:327`), W1 (one single-class card per template with name and description, fallback description for an unknown label and for the fixture's missing label at `:368`, no throw, no prototype key), W8 (two choices in flight, later wins). Adapt W10 and RW1-RW3 to click a card. Specs: Query-console "Known label", "Unknown label", "Script may reference the shared classes", "Parameters of the chosen template", "Late response after a tenant switch is ignored".
- [x] 2c.2 (done 2026-10-05; no bridge CSS was needed, the shared sheet styles every card state, see `apply-progress.md`) GREEN `src/consola.ts`: `#auto-plantilla` becomes `<div class="zd-templates" role="radiogroup" aria-label="Plantilla">`; `catalogoPlantillas`, `detallesPlantilla` cache cleared in `reiniciarAlta`, `renderizarPicker`, `tarjetaPlantilla` (label, radio `name='auto-plantilla-opcion'`, name and description spans, `hasOwnProperty` lookup in `DESCRIPCIONES_PLANTILLA`), `elegirPlantilla(id)` guarded by `plantillaElegida === id && g === generacionAlta`; `crearAutomatizacion` sends `plantillaId: plantillaElegida`; remove `selectorPlantilla` and its listener. Bridge CSS for `.zd-templates` and `.zd-template*`.
- [x] 2c.3 Verification: `npx tsc --noEmit`, `npx tsx --test src/consola.test.ts`, full `npm test`, `npm run build`. (2026-10-05: all pass; console 43/43; full suite LIVE on 127.0.0.1:5434, 885/885, 0 skipped tests.)
- [ ] 2c.4 Manual visual review (human only): cards unselected, hover, selected, focus ring, keyboard radio navigation, unknown-label fallback; light and dark; 360 and 1280 px; Chromium and Firefox.
- [x] 2c.5 Line-count checkpoint: authored at most 400 excluding docs (forecast ~220). (2026-10-05: 316 = `consola.ts` +88/-35, `consola.test.ts` +168/-25.)

## PR3: Step-2 schedule (~305 authored)

Branch `ch21c/asistente-horario`. Depends on PR1 and PR2a (stacked on PR2c in merge order).

- [x] 3.1 (done 2026-10-05: 12 RED failures observed before 3.2/3.3) RED H1 (six preset vectors, each also accepted by the server's `cronValido(., 'UTC')`), H2 (`personalizado` passes `30 7 * * 1` and `0 */2 * * *` unchanged, POST keys unchanged), H3 (`24:00`, `8:30`, `08:60`, `ab:cd`, `''`, `08:30:00` give empty cron, error sentence, no request on Crear), H4 (201 with `2026-10-06T11:30:00.000Z` in `America/Argentina/Buenos_Aires` shows `06/10/2026 08:30` and the zone), H5 (legacy 201 without the field shows the old sentence), H6 (tenant switch resets to `diaria`/`08:00`). Add ids `auto-frecuencia`, `auto-hora`, `auto-horario-texto` to `IDS`. Specs: Query-console "Preset vectors", "Cron field shows the translation read-only", "Personalizado makes the cron field editable and passes through", "Invalid hour", "Success banner shows first run and zone", "Server 400 shown in the banner", "Tenant switch wipes the wizard".
- [x] 3.2 (done 2026-10-05; plus one bridge rule for the read-only cron field, see `apply-progress.md`) GREEN `src/consola.ts` markup: `#auto-frecuencia` select (four options), `#auto-hora` `type="time"` default `08:00`, `#auto-horario-texto`; `#auto-cron` stays visible.
- [x] 3.3 (done 2026-10-05) GREEN `src/consola.ts` script: `DIAS_FRECUENCIA`, `DIGITOS`, `horaDe`, `cronDeFrecuencia` (concatenation only, no regex), `actualizarHorario` (read-only for presets, editable for `personalizado`, sentence copy), listeners (frequency `change`, hour `input` and `change`), `reiniciarAlta` resets, invalid-hour block in `crearAutomatizacion` with banner "La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30.", `formatearInstante(iso, zona)` with `Intl.DateTimeFormat('es-AR', ...)` and `RangeError` fallback, 201 banner with the DEC-95 wording and legacy fallback.
- [x] 3.4 Verification: `npx tsc --noEmit`, `npx tsx --test src/consola.test.ts`, full `npm test`, `npm run build`, `bash scripts/smoke.sh` if its console greps changed (LIVE; see the live note). (2026-10-05: all pass; console 48/48; full suite LIVE on 127.0.0.1:5434, 890/890, 0 skipped tests. The smoke's console greps did not change; the smoke run is orchestrator-owned.)
- [ ] 3.5 Manual visual review (human only): each frequency, hour error, read-only cron, `personalizado`, success banner with first run; light and dark; 360 and 1280 px; Chromium and Firefox.
- [x] 3.6 Line-count checkpoint: authored at most 400 excluding docs (forecast ~305). (2026-10-05: 312 = `consola.ts` +118/-4, `consola.test.ts` +177/-13.)

## PR4: Disabled with reason (~270 authored)

Branch `ch21c/asistente-disponibilidad`. Depends on PR2c.

- [ ] 4.1 RED V1 (shared vectors through the UI and the server's imported `evaluarVistas`: all valid, `no-mapeada`, `no-validado`, `invalida`, DEC-127 `stock-fisico` `['producto','receta_componente']` without `receta_componente`; enabled state equals `ok`, reason names the same entities, the report's M4 `aplicable` ignored), V2 (no raw state code in the text), V3 (chosen template that becomes disabled is deselected, values and Siguiente cleared), V4 (deferred probe for an earlier connection discarded), V5 (500 or non-JSON fails open with the note), V6 (tenant switch mid-probe discards it), V7 (creation after a failed probe, unchanged body). Specs: Query-console "Template with a non-valid entity is disabled", "Template with all entities valid stays enabled", "Validation fetch fails", "Late validation response is discarded", "Late response after a tenant switch is ignored".
- [ ] 4.2 GREEN `src/consola.ts`: `entidadesNoAprobadas`, `MOTIVOS_VISTA`, `generacionSondeo`, `sondearConexion()` (probe `GET /conexiones/:id/validacion-mapeo`, then sequential `GET /plantillas/:id` with the cache, double token check), `aplicarVeredictos()` (`input.disabled`, `span.motivo-plantilla`, deselect), fail-open notice; `change` on the connection select calls it. Add `.motivo-plantilla` to the G3' set only if it is script-assigned as a single class (test edit deliberate).
- [ ] 4.3 GREEN bridge CSS in `src/consola.ts`: `.zd-template:has(input:disabled)`, its `:hover`, `.motivo-plantilla`.
- [ ] 4.4 Verification: `npx tsc --noEmit`, `npx tsx --test src/consola.test.ts`, full `npm test`, `npm run build`, `bash scripts/smoke.sh` if its console greps changed (LIVE; see the live note).
- [ ] 4.5 Manual visual review (human only): disabled card with reason, `:has()` support, focus order, verifying notice, fail-open notice; light and dark; 360 and 1280 px; Chromium and Firefox.
- [ ] 4.6 Line-count checkpoint: authored at most 400 excluding docs (forecast ~270).

## PR5: Email preview (~170 authored)

Branch `ch21c/asistente-vista-previa`. Depends on PR2c.

- [ ] 5.1 RED E1 (subject with `(n)` equals `asuntoCorreo({nombre, automatizacion, filas: 0, hayMas: false})` with trailing ` (0)` replaced by ` (n)`, for `stock-fisico`, `stock-producible`, `reporte-diario`, `otra`, `constructor`, ordinary names), E2 (accent equals `background:` in `componerCorreo(...).html`), E3 (hostile `nombre` verbatim through `textContent`; document has no `inner`+`HTML` and no `src`+`doc`), E4 (preview nodes have no children, footer string in the document and `componerCorreo(...).texto`). `Nodo` gains `style`; add preview ids to `IDS`. Specs: Query-console "Preview parity with the server subject", "Preview is text-only and read-only", "Script hazards stay out of the page".
- [ ] 5.2 GREEN `src/consola.ts`: static preview block in step 2 (`role="group"`, ids `auto-vista-asunto`, `auto-vista-para`, `auto-vista-titulo`, note, footer), `TEMAS_CORREO` copy of `correo.ts:123-127`, `TEMA_NEUTRO` `#6b7280`, `temaCorreo` via `hasOwnProperty`, `asuntoVistaPrevia`, `actualizarVistaPrevia` (on Siguiente and recipient `input`, `style.backgroundColor`), bridge `.vista-correo__titulo`.
- [ ] 5.3 Verification: `npx tsc --noEmit`, `npx tsx --test src/consola.test.ts`, full `npm test`, `npm run build`.
- [ ] 5.4 Manual visual review (human only): preview with and without recipient, each accent, long names; light and dark; 360 and 1280 px; Chromium and Firefox.
- [ ] 5.5 Line-count checkpoint: authored at most 400 excluding docs (forecast ~170).

## Spec Traceability

| Spec scenario | Task(s) / test id |
|---|---|
| Scheduling: First run after creation, Weekday range, Saturday range, Non-UTC zone, Strictly after creation | 1.1 N1-N5, 1.2 R1, 1.6 |
| Scheduling: Additive and unchanged | 1.2 R1, 1.7 |
| Connection: Listing own connections, Tenant without connections, Row cap | 1.3 C1, C3, C2, 1.8 |
| Connection: Two tenants | 1.4 T2-L, 1.3 C1 |
| Connection: Missing tenant | 1.3 R2, 1.9 S1 |
| Connection: The listing never exposes the credential (other credential scenarios unchanged) | 1.3 C1, 1.4 T2-L, 1.9 S1 |
| Isolation: Connection listing sweep row, Full two-tenant route sweep | 1.4 T2-L |
| Isolation: Database unreachable, Two-tenant tick | 1.4, 1.10 (unchanged, skip reported) |
| Console: Requesting the page, Page links stylesheet, Script hazards, Script may reference classes | 2a.6, 2c.1, 5.1 |
| Console: Viewing the automations list | 2a.6 |
| Console: Creating from the console, with a recipient, Invalid recipient, POST body unchanged, Parameters | 2a.2 RW1-RW3 |
| Console: Wizard opens on step 1 | 2a.3, 2b.1 W2 |
| Console: Step navigation | 2a.3 W3 |
| Console: Success banner, Server 400 | 3.1 H4/H5, 2a.2 RW3 |
| Console: Tenant has no connections, Connections fetch fails | 2b.1 W4, W9 |
| Console: Switching tenant, Tenant switch wipes the wizard | 2a.3 W6, 3.1 H6 |
| Console: Late response ignored | 2b.0 W10 (moved from 2a.3), 2b.1 W5, 2c.1 W8, 4.1 V4/V6 |
| Console: Tenant load keeps three requests | 2a.3 W6, 2b.1 |
| Console: All ids present once, Renamed id fails, Limit attributes | 2a.1 (ids added per PR in 3.1, 5.1) |
| Console: Preset vectors, Cron read-only, Personalizado, Invalid hour | 3.1 H1-H3 |
| Console: Disabled, Enabled, Validation fetch fails, Late validation discarded | 4.1 V1-V7 |
| Console: Preview parity, Preview text-only | 5.1 E1-E4 |
| Console: Known label, Unknown label | 2c.1 W1 |

## Closure

- [ ] 6.1 Verify per PR (`sdd-verify`): re-check each scenario above against the observed results of the verification tasks (1.10, 2a.6, 2b.3, 2c.3, 3.4, 4.4, 5.3), the empty diff for schema, migrations, `correo.ts`, `contexto-tenant.ts` and engine files, and DEC-129..132. Manual visual-review tasks stay open until a human signs them. Orchestrator-owned.
- [ ] 6.2 Archive (`sdd-archive`) after PR5 merges: sync the four deltas to `openspec/specs/` and move the change folder to `openspec/changes/archive/`. Orchestrator-owned.
