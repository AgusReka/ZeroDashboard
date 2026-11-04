```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 3
suggestions: 3
requirements: 8/8
scenarios: all mapped (0 missing; the MODIFIED scenarios that predate this change are covered by their existing tests, which stayed green)
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npx tsc --noEmit
build_exit_code: 0
```

# Verify report: CH-42 — Message preview for an automation, in the console, without sending

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 3 WARNING, 3 SUGGESTION). Branch `ch42/vista-previa`, uncommitted work on top of `09445b4`; base `master`. Strict TDD mode: every scenario was checked against the test body that asserts it, not only against the test's existence. DEC-195 is written in `docs/01-decisiones.md` (working tree).

Verification ran in the same session as the apply, by a verifier with no write access to source or tests. The only files written are this report and the tick of task 7.4.

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1724 tests, 1720 pass, 4 fail, 0 cancelled, 0 skipped. The 4 failures are the known environmental ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07). `planificador.test.ts` has no failure (no `"motor":"postgres"` case failed either). All 9 live CH-42 cases, the 2 isolation cases for the new route and the planner CH-41 cases pass. |
| `TEST_DB_PORT=1 DATABASE_URL=postgresql://x:y@localhost:1/none npm test` | exit 0. 1178 tests, 1178 pass, 0 fail; the live CH-42 suite is skipped as a whole (reason printed: "no PostgreSQL server at localhost:1"), the pure, structural and console suites run. |
| `git diff --exit-code master -- src/automatizaciones/planificador.test.ts` | exit 0, clean: the planner's test file is untouched, and it passes in the DB run. |

Static checks, by search:
- `vista-previa.ts` and `corrida.ts` import neither `./notificador.js` nor `./planificador.js` and name no `ejecucion.` delegate (the only hits are the module paths `consulta-ejecucion.js`). Test 3.5 asserts the same and passes.
- `srcdoc` appears once in `src/consola/consola.ts` (`marcoVistaPrevia.srcdoc = String(html);` inside `mostrarHtmlVistaPrevia`); the script never contains `sandbox`; the only `<iframe` is `id="vp-html" sandbox="" title="Mensaje en HTML"`.
- The route has no notifier parameter (`OpcionesVistaPrevia` carries `canales` and `correoConfigurado` only), and no `ejecucion` write exists in either new module.

## Tasks
| Task | Evidence |
|---|---|
| 0.1 | **Open, not an implementation defect.** DEC-195 is in the working tree of `ch42/vista-previa`; the `v2/dec-195` branch does not exist yet. It stays a pending user git action. |
| 1.1–1.4 | `corrida.ts`; planner calls `prepararCorrida`, `peticionDeCorrida`, `entradaDeCorreo` and keeps the dial, retries, `enviando` marker, notifier and `Ejecucion` writes; `planificador.test.ts` byte-identical to `master`; 3 pure cases in `vista-previa.test.ts` |
| 2.1 | `auditoria.ts` origin union and header; `auditoria.test.ts` pure case |
| 3.1–3.6 | `vista-previa.ts`, registrar parameter, `rutas.ts`/`server.ts` wiring (`correoConfigurado: notificador !== null`), `rutas.test.ts`; pure cases, structural case, 9 live cases |
| 4.1, 4.2 | `aislamiento.test.ts` matrix row before `/desactivar` (owner control `409`); live case 4.2 |
| 5.1–5.6 | `consola.ts` markup, styles, script, `ORIGENES_AUDITORIA`; 23 new console cases plus the changed guards |
| 6.1–6.3 | `docs/guia/06-automatizaciones.md`; both `guidelines/consola.md` copies (diff -q: identical); `docs/02-mapa-de-changes.md` |
| 7.1–7.3 | Commands above |
| 7.4 | This report; ticked in `tasks.md` |

## Spec scenarios → evidence

Abbreviations: VP `src/automatizaciones/vista-previa.test.ts`, AI `src/aislamiento/aislamiento.test.ts`, AU `src/auditoria/auditoria.test.ts`, CO `src/consola/consola.test.ts`, CT `src/automatizaciones/correo.test.ts`, PL `src/automatizaciones/planificador.test.ts`, RT `src/app/rutas.test.ts`.

### automation-scheduling (9)
| Scenario | Test | Status |
|---|---|---|
| Previewing an automation whose run would send | VP "3.6 reaching the minimum: rows, enviar, para and the message; twice, with no run and no change" (3 rows, `enviar`, both addresses, `correo`); VP "3.6 no send and no run, with a spy notifier…" (zero `Ejecucion` rows, spy untouched); VP 3.5 structural | covered |
| The preview reads the run's page | VP "3.6 the run page: a row cap of 2 on three rows with minimum 5 reads two rows, hayMas and enviar" (the spec's 50/20 shape scaled down, same logic) | covered |
| A gate refusal dials nothing | VP "3.6 refusals answer before anything is dialled and write no audit row" (`409`, `vista-canonica-no-aprobada`, `entidades` `['pedido']`, zero audit rows); AI "3.3 POST /automatizaciones/:id/vista-previa still works against the caller's own id" (owner reaches the gate, `409`) | covered |
| Stored values no longer valid | VP "3.6 refusals…" (`400`, `solicitud-invalida`, non-empty `campos` and `problemas`) | covered |
| A failed query is the engine's answer | VP "3.6 a query failing at execution is a 200 with the failure, no decision, no message, one fallo row"; VP "3.4 a failed query has no decision and no message, and keeps the engine failure" | covered |
| Deactivated and foreign automations | VP "3.6 refusals…" (`404` unknown, `409 automatizacion-desactivada`); AI "3.3 POST /automatizaciones/:id/vista-previa answers 404 for the other tenant's id, both ways" | covered |
| Previewing twice changes nothing | VP "3.6 reaching the minimum…" (loop of two calls; the automation row and its `Ejecucion` rows deep-equal to before) | covered |
| MODIFIED: Missing or failing view validation blocks the run | PL pre-existing DEC-71 cases, unedited and green after the extraction | covered (pre-existing) |
| MODIFIED: The run is unchanged by the shared steps | `git diff --exit-code master -- src/automatizaciones/planificador.test.ts` exit 0, and the planner suite passes in test:db | covered |

### email-notification (13)
| Scenario | Test | Status |
|---|---|---|
| A run would send | VP "3.4 a run would send: enviar, both addresses in order, and the message"; live in "3.6 reaching the minimum…" | covered |
| Without recipients the message is still shown | VP "3.4 without recipients the message is still built" | covered |
| Without SMTP the message is still shown | VP "3.4 without SMTP the message is still built"; VP "3.6 SMTP configured or not: enviar or no-configurada, both with the message" (two apps) | covered |
| Below the minimum there is no message | VP "3.4 below the minimum, and with zero rows, there is no message" (`minimoFilas` 5 on 3 uncut rows) | covered |
| Zero rows have no message | same test (`omitida-sin-filas`, `correo` null) | covered |
| The preview's message equals the run's | VP "3.4 the preview message equals the message a run composes for the same four inputs" (deep-equal to `componerCorreo(entradaDeCorreo(...))`, the function the planner calls) | covered |
| A missing column shows the table | VP "3.4 a line naming a missing column gives the table, as the run sends it" | covered |
| MODIFIED: Lines per row; Empty value in a line; Truncated result with lines; Template without texts | CT "componerCorreo — the body built from the template texts (CH-39)" cases, renderer unchanged | covered (4, pre-existing) |
| MODIFIED: One input for the run and the preview | VP "1.4 with one text null the input carries mensaje null…" and "1.4 with both texts the input is what a run builds" | covered |
| (Rule) a result cut by the row cap under the minimum still sends | VP "3.4 a result cut by the row cap under the minimum still sends, as a run decides" | covered |

### execution-audit (5)
| Scenario | Test | Status |
|---|---|---|
| Audit record accepts the origin (MODIFIED) | AU "CH-20 audit row — pure" new assertion (`automatizacion-vista-previa`, `plantillaId` `p-1`) | covered |
| A message preview is recorded under its own origin | VP "3.6 one audit row under its own origin, with the statement and the template, and nothing else" (exactly one new row; `origen`, `conexionId`, `plantillaId`, composed `sql`, `operadorNombre`; the serialized row holds no recipient, subject, cell or automation id) | covered |
| A refused preview records nothing | VP "3.6 refusals…" (unknown, deactivated, unapproved view, stale values: zero new rows) | covered |
| The preview's audit write fails | VP "3.6 a failed audit write keeps the normal answer and logs one error line" (`200`, `enviar`, `correo`, one level-50 line) | covered |
| Pre-existing scenarios of the two modified requirements (ad hoc query, bound values, read-only rejection, refused request, unsaved template test, audit write fails) | `auditoria-registro.test.ts` and `auditoria.test.ts`, green | covered (pre-existing) |

### query-console (16)
| Scenario | Test | Status |
|---|---|---|
| Row actions | CO "CH-42 «Vista previa» is offered on active rows only, between «Ver ejecuciones» and «Ajustar»"; the pinned list at the old `:1325` case | covered |
| Previewing an automation that would send | CO "the pop-up opens at once, says it is generating, and sends one POST with the tenant and no body" + "a run that would send: decision, «Para», subject, rows, count, text and the frame" | covered |
| Without recipients | CO "without recipients the message is still shown and «Para» says «sin destinatario»" | covered |
| Below the minimum | CO "the decision omitida-bajo-minimo has its own line" + "with no message the block stays hidden and the pop-up says so" | covered |
| A gate refusal stays inside the pop-up | CO "an unapproved view is told inside the pop-up, with no rows and no message" | covered |
| A failed query | CO "a failed query is told inside the pop-up…" (see WARNING 3 on the assertion) | covered, weak |
| The automation is gone | CO "a 404 automatizacion-no-encontrada says the automation screen's sentence and reloads the list" (exact sentence; list `GET` last) and the `409` twin | covered |
| The frame is isolated | CO "CH-42 the only iframe is the preview frame, with an empty sandbox, and the script never names sandbox" | covered |
| Markup in the message stays in the frame | CO "a run that would send…" (`srcdoc` equals the received HTML containing `<b>alerta</b>`; `<pre>` text verbatim, zero child nodes) | covered |
| A tenant switch closes the preview | CO "a tenant switch closes the pop-up and the answer still in flight lands nowhere" | covered |
| Nothing to send from the pop-up | CO markup test («Cerrar» is the only `<button>` of the pop-up, `type="button"`) + "a run that would send…" (no button created in the dynamic nodes) | covered |
| Each other decision line, the cut page, the unknown decision, `400`, `409 credencial-ilegible`, network failure, Cerrar, Escape, ids and hidden-at-start | CO cases named "CH-42 …" (decisions loop of 3, "a page cut by the row cap…", "an unknown decision…", the 5-case refusal loop, "Cerrar closes…", "Escape closes…") and `IDS`/`IDS_OCULTOS` | covered |
| MODIFIED: Console page servable — The only srcdoc is the sandboxed preview frame | CO "CH-29 the console page by session" `sinPeligros(documento, true)` (exactly one `srcdoc`, as `.srcdoc = `, in the script) and the login document's `sinPeligros(documento)` (none) | covered |
| MODIFIED: Script hazards stay out of the page; Script may reference the shared classes (G3') | `sinPeligros` (one closing script tag, no backtick, no `innerHTML`); G3' test unchanged and green | covered |
| MODIFIED: Audit screen — A message preview row | CO "CH-42 a message preview row names its origin and its template" («Vista previa de automatización», «Plantilla p-1») | covered |
| Pre-existing audit scenarios | CO CH-30e1 cases, green | covered (pre-existing) |

### tenant-isolation (3)
| Scenario | Test | Status |
|---|---|---|
| Preview sweep row | AI "3.3 POST /automatizaciones/:id/vista-previa answers 404 for the other tenant's id, both ways" (404 `automatizacion-no-encontrada`; body free of statement, credential, tenant id, automation id, execution id and recipient addresses) + "…still works against the caller's own id" (`409`, the owner reaches the DEC-71 gate) | covered |
| The preview's «Para» comes from the previewed automation | VP "4.2 two tenants on the same template each read only their own recipients as para" | covered |
| MODIFIED: Full sweep, the two-tenant tick, recipient from the run's own automation, no global fallback | AI "CH-14 5.11 a tick over A and B…", PL CH-41 cases, RT route table (the new route is registered after the operator guard and listed), all green | covered (pre-existing) |

## Design conformance
| Design point | Result |
|---|---|
| §2 shared steps in `corrida.ts`, importing neither notifier nor planner | Conforms; the planner keeps `loadConfig()` after `prepararCorrida`, so the order of reads is the old one. `PlantillaACorrer` is an alias of `PlantillaDeCorrida`. |
| §3 nine steps, flat `200`, refusals as the template test, one dial with no retry | Conforms line by line in `vista-previa.ts`. Audit write sits between the dial and the answer and is swallowed by `registrarEjecucion`. |
| §3 registered from `registerAutomatizacionRoutes` with `opciones = {}` | Conforms; the three existing callers compile (tsc exit 0). |
| §4 `correoConfigurado: notificador !== null`, required in `DependenciasRutas` | Conforms; `rutas.test.ts` passes `false`. |
| §5 audit origin, no migration | Conforms. |
| §6 markup tree, ids, one helper for `srcdoc`, generation guard, closed decision map, `ORIGENES_AUDITORIA` | Conforms. `type="button"` on the only button, `#vp-confirmar` hidden, no `zd-` class assigned by the script. |
| §6 header comment names the frame as the single exception | Conforms (CH-42 paragraph in `consola.ts`). |
| §9 tests | All listed cases exist; the spy-notifier case is built as the task allows (see deviation 6). |

## Deviations reported by the writer, judged
| # | Deviation | Judgment |
|---|---|---|
| 1 | Wider pop-up rule `#auto-vista-previa .zd-dialog { width: min(900px, 100%); }` | **Accepted.** It repeats the existing pattern of `#auto-alta`, `#plantilla-dialogo` (900px) and `#consulta-dialogo`; it is id-scoped, uses no new token and no new `zd-` class, and the design already put the frame's and the `<pre>`'s sizes in id rules of the same block. No spec text depends on the width. |
| 2 | «Con este resultado una ejecución no arma un mensaje.» appended to the status line («2 filas. Con este resultado…») | **Accepted.** The spec says the pop-up SHALL say it, and does not fix the node; the text is visible exactly when `#vp-mensaje` is hidden and the exact string is asserted in CO "with no message the block stays hidden and the pop-up says so". |
| 3 | `llevarBannerA(dialogoVistaPrevia, avisoVistaPrevia)` on a null response | **Accepted.** `leerPrueba` returns null only for a tenant refusal that already showed the banner behind the pop-up; moving the sentence inside is the existing pattern (`llevarBannerAlDialogo`) and is consistent with the spec's "legible message inside the pop-up". Not covered by a test (SUGGESTION 1). |
| 4 | Variable renamed `asuntoMensajeVistaPrevia` | **Accepted, and necessary.** A top-level function `asuntoVistaPrevia(nombre, etiqueta)` already exists at `consola.ts:4105` (the wizard's preview); a `var` of that name in the same script scope would have been overwritten by the function declaration and broken the wizard. |
| 5 | CH-21c E3 test now expects exactly one `srcdoc` instead of none | **Accepted.** It follows the MODIFIED requirement ("the console document MUST contain `srcdoc` exactly once"). The wizard-specific claim is still carried by the exact-once guard plus the single-helper assertion in the markup test. |
| 6 | Spy notifier test built through a scheduler that shares the DB client | **Accepted as the closest possible reading, with a warning** (WARNING 2): the route has no notifier input, so no spy can be wired into it. |
| 7 | `docs/guia/07-usuarios-y-permisos.md` origin line | **Accepted.** One-line doc parity with the audit screen's Origen column, which the query-console delta now lists; not in the task list but within the change's surface. |

## Issues
### CRITICAL (0)
None.

### WARNING (3)
1. **No TDD Cycle Evidence table.** There is no `apply-progress` artifact in the change folder, so the RED-before-GREEN order cannot be verified. The GREEN half is confirmed by execution above, and every test file exists and passes.
2. **The spy-notifier test cannot fail.** `vista-previa.test.ts` "3.6 no send and no run, with a spy notifier…" gives the spy to a scheduler that is never started (`iniciar()` is not called), while the route cannot receive a notifier. `enviados.length === 0` therefore holds by construction. The real guarantee is the route's signature, test 3.5 (no notifier import, no `Ejecucion` delegate) and the zero-`Ejecucion` assertions beside it, which do exercise the route.
3. **A weak assertion for the failed query in the console.** CO "CH-42 a failed query is told inside the pop-up…" matches the status line with `/./`, so it proves the line is non-empty and no longer «Generando…», not that it is the console's failure message for `fase` and `categoria`. The same renderer (`mostrarResultadoPrueba`) is covered with exact failure messages by the template-test cases, so the risk is low.

**Resolved after verify (2026-11-03):**
- WARNING 2: the spy notifier was removed. The case is now "3.6 no run, with SMTP configured and a decision to send", and its comment states that "never sends" rests on the route's signature and on test 3.5.
- WARNING 3: the case now uses the real category `tiempo-agotado`; the fixture had `timeout`, which no message maps. It asserts the exact sentence «La consulta superó el tiempo máximo de ejecución y fue cancelada.»
- Evidence: `npx tsc --noEmit` exit 0; `vista-previa.test.ts` and `consola.test.ts` against `zerodashboard_test` on 5434, 409/409 pass.

### SUGGESTION (3)
1. **Untested branch:** the `leido === null` path of `abrirVistaPrevia` (`llevarBannerA`) has no case.
2. **Indirect proof of "nothing is dialled":** the refusal scenarios show the status, the body and zero audit rows (an audit row is only written after the dial), not the absence of a connection attempt; the `400` case asserts non-empty `campos` and `problemas`, not the parameter's name. The audit scenario's "no parameter value" is not asserted on a template with parameters either. The code makes all three true by construction.
3. **Stray untracked files** `0`, `` ` `` and `tolerancia` (empty, dated Oct 13–29) sit in the repository root; they are not from this change and must not be staged with it.

## Key Learnings
1. A top-level function declaration and a `var` of the same name in the console's single script share one scope, so a new variable must never reuse the name of an existing function (here `asuntoVistaPrevia`).
2. In this repository `npm test` with `TEST_DB_PORT=1` skips each live-database suite as one skipped suite, and the summary line still prints `skipped 0` because it counts tests, not suites.
3. `crearPlanificador` does nothing until `iniciar()` is called, so a notifier spy handed to an unstarted scheduler can never record a call.
4. The CH-42 route cannot receive a notifier at all, so "never sends" is proven by the route's signature and the structural import test, not by a spy.
5. `leerPrueba` returns null only for a tenant refusal that `manejarFalloDeTenant` already put in the banner, and `llevarBannerA` is the established way to move that sentence into an open pop-up.
