# Exploration: CH-42 — Message preview for an automation, in the console, without sending

Status: **decided** (2026-11-03): 1(a), 2(a), 3(a), 4(a), chosen by the user; 1–3 to be registered as DEC-195, 4 is delivery only (one PR with `size:exception`). Store: openspec. Story X10. Decision: DEC-189 (a), firm (2026-10-23). Depends on CH-39 and CH-40 (both merged). No research phase: everything needed is in the repository. New decisions here would be registered as DEC-195.

X10 (`docs/mapa-historias.md:115`): "Como P1, quiero ver qué mensaje saldría de una automatización sin esperar al horario." A preview in the console with current data, "sin enviar nada y sin registrar una ejecución. No hay envío manual: todo sigue siendo programado (DEC-189)."

DEC-189 (`docs/01-decisiones.md:3664-3694`) "Forma":
- The preview runs the automation's query with its connection and its stored values, and shows the rows and the message built for the channel.
- It sends nothing, creates no `Ejecucion`, and "queda en la auditoría como la prueba de plantilla".
- It lives in the automation detail in the console; the panel does not have it (rule 1).
- It reuses `componerSentencia`, the read-only execution and the same email and Telegram renderers, and applies `minimoFilas` to show whether the notice would go out.
- The message appears "como texto o HTML en un marco aislado, armado con los mismos escapes que el envío real".
- Resigned: the client's replica is queried on every use; a real send still depends on the schedule. Option (b), «Enviar ahora» with origin `manual`, was rejected.

CH-44 adds the Telegram view later; this change renders email only.

## What exists (verified)

| Piece | State |
|---|---|
| Rendering | `componerCorreo(EntradaCorreo)` (`src/automatizaciones/correo.ts:217`) is pure and returns `{asunto, html, texto}`. Escaping: `escaparHtml` (`:109`), `textoDeCelda` (`:62`). `respaldoDe` (`:201`) says whether the message falls back to the table (CH-39). Markers: `src/plantillas/marcadores-mensaje.ts`. |
| Outcome | `decidirNotificacion(r, destinatarios, configurado, minimoFilas)` (`src/automatizaciones/automatizaciones.ts:366`) is pure: not ok → `omitida-sin-filas` → `omitida-bajo-minimo` (CH-40, `hayMas` counts as reaching the minimum, DEC-193) → `sin-destinatario` → `no-configurada` → send. |
| Glue | The planner's `notificar` closure (`src/automatizaciones/planificador.ts:350-392`) builds the `mensaje` from `encabezadoMensaje`/`lineaMensaje` (`:372-386`), calls `componerCorreo`, writes `notificacion='enviando'` and calls `notificador.enviar` (SMTP). `resultadoDeCorrida` (`:225-274`) runs the query: view gate, `componerSentencia`, `prepararSentencia`, `destinoDeConexion`, `ejecutarConsulta` with `limite = topeFilas`. **Both are closures inside `crearPlanificador`, not exported.** |
| Read-only run | `ejecutarConsulta` → `enSesionSoloLectura` (`src/ejecucion/consulta-ejecucion.ts`): `BEGIN TRANSACTION READ ONLY`, server-side `statement_timeout` (15 s default), cap `maxFilasPorConsulta` 200. |
| Template test | `POST /plantillas/:id/prueba` (`src/plantillas/plantilla-prueba.ts:260`) → `probarContraConexion` (`:183`) → `ejecutarPrueba` (`:106`): ownership 404, `evaluarVistas` 409, `prepararSentencia` 400, `destinoDeConexion` 409, `ejecutarConsulta` with `limite: 50`, then `registrarEjecucion(..., {origen: 'plantilla-prueba', conexionId, sql, consulta: null, plantillaId}, veredicto)`. Renders no message, sends nothing. |
| Audit | `RegistroEjecucion` (`prisma/schema.prisma:383`): `origen` is a free `String`; there is `plantillaId` but **no `automatizacionId`**. No values, no rows. `OrigenEjecucion` union at `src/auditoria/auditoria.ts:21`; the console maps origins in `ORIGENES_AUDITORIA` (`src/consola/consola.ts:5714`). Write failures are swallowed (DEC-162). |
| Console | **There is no automation detail screen.** `#pantalla-automatizaciones` is a list (`#auto-lista`) with per-row buttons «Ver ejecuciones», «Ajustar», «Desactivar» (the last two only when active), pinned by `consola.test.ts:1325`/`:1339`. Pop-ups: `#auto-alta` (create, with a static schematic preview, DEC-131) and `#auto-ajuste`. `mostrarResultadoPrueba` (`:4902`) and `renderizarTabla` already render an engine result. |
| Console guards | `IDS` (`consola.test.ts:150-428`), `IDS_OCULTOS` (`:434`), `verificarIds` (`:443`, each id exactly once in the markup), G3' (`:657`, no `zd-*` classes in the script beyond three), buttons `type="button"`. |
| Isolated frame | No `iframe`, `srcdoc`, `sandbox` or CSP anywhere in `src`. New. |
| Routes | `registerAutomatizacionRoutes(app, prisma, zonaHoraria, topeFilas)` (`src/automatizaciones/automatizaciones-rutas.ts`), tenant-scoped, behind the operator guard. The isolation matrix (`src/aislamiento/aislamiento.test.ts:~460`) lists every `/automatizaciones/:id*` route. |

### Specs affected

- `query-console`: the automation list (new row action), the preview pop-up, ids guard, the audit screen origin label.
- `automation-scheduling`: the new read-only route next to the other automation routes; "everything stays scheduled" (no manual send).
- `email-notification`: the message building shared by the run and the preview.
- `execution-audit`: the `origen` list (`:9`) and "Every Audited Path" (`:21`).
- `tenant-isolation`: the new scoped route in the sweep.

## Shape that fits

- **One builder, shared.** Extract the query part of `resultadoDeCorrida` and the message part of `notificar` (`planificador.ts:372-386`) into exported pure/side-effect-free functions (e.g. `mensajeDeAutomatizacion(plantilla, resultado, ...) → EntradaCorreo`), used by both the planner and the preview, so they cannot drift. The planner keeps the SMTP step and the `Ejecucion` writes; the preview never reaches `notificador`.
- **Route.** `POST /automatizaciones/:id/vista-previa` in `automatizaciones-rutas.ts` (POST because it touches the client's replica and writes an audit row). It reads the scoped automation and its template, runs the query with `limite = topeFilas` (the planner's page, so `hayMas` and the minimum check match a real run), then returns `{ resultado, decision, correo: {asunto, html, texto} | null, destinatarios }`. Gate refusals reuse the template test's codes (404, 409 view not approved, 400 values, 409 unreadable credential).
- **Outcome shown.** `decidirNotificacion` with the stored `destinatarios`, `minimoFilas` and whether SMTP is configured: the preview says «se enviaría a …» or names the skip (`omitida-sin-filas`, `omitida-bajo-minimo`, `sin-destinatario`, `no-configurada`), and still shows the message when one can be built.
- **Audit.** One `registrarEjecucion` per preview, with `conexionId`, the composed `sql` and `plantillaId` (decision 1 settles the `origen`).
- **Console.** A row action opens a pop-up with the outcome line, «Para», «Asunto», the rows (`renderizarTabla`) and the message (decision 3). New ids go to `IDS`/`IDS_OCULTOS`.
- **Unchanged.** The schedule, `Ejecucion`, the panel, Telegram (CH-44), the create wizard's schematic preview.

## Decisions (chosen by the user on 2026-11-03: 1(a), 2(a), 3(a), 4(a))

1. **Audit origin.** `RegistroEjecucion` has no `automatizacionId`, so reusing the origin makes previews indistinguishable from template tests. (a) A new origin `automatizacion-vista-previa`, labelled «Vista previa de automatización» in the audit screen, with `plantillaId` set as the template test does. `origen` is a free string, so no migration; touches `OrigenEjecucion`, `ORIGENES_AUDITORIA` and the audit tests. (b) Reuse `plantilla-prueba` literally. No new label, but the audit loses what the operator did. *Recommended: (a); "como la prueba de plantilla" read as "recorded the same way", not "under the same name".*
2. **Where it lives.** DEC-189 says "detalle de la automatización", and no detail screen exists. (a) A «Vista previa» row action (only for active automations, like «Ajustar») that opens a pop-up, as «Ajustar» does. (b) Build an automation detail screen and put the preview there. Closer to the wording, but a new screen with no design and more size. *Recommended: (a); the pop-up is the console's existing "detail" pattern, and (b) can come later without an API change.*
3. **How the message is shown.** (a) Text and HTML: the text version in a `<pre>`, and the HTML in an `<iframe sandbox srcdoc>` (empty `sandbox`: no scripts, no same-origin, no forms), the same bytes `componerCorreo` sends. (b) Text only for now. Smaller and no new frame, but it does not show what the client actually sees, and DEC-189 names the isolated frame. *Recommended: (a).*
4. **Delivery.** Rough size: extract builders from the planner ~60, route + gates ~80, audit origin ~10, console markup + script ~120, tests ~300 (route, isolation row, planner unchanged-behaviour, console ids and pop-up), specs ~50 → **~620 changed lines**. The session chose Single PR (400 budget). (a) One PR with `size:exception`, as CH-40 and CH-41. (b) Two stacked PRs: CH-42a builders + route + audit, CH-42b console. The first PR stands alone (the route works without UI). *Recommended: (b) only if review size matters; otherwise (a), matching the last two changes.*

## Risks

- Extracting from `notificar`/`resultadoDeCorrida` touches the run path: `planificador.test.ts` (1909 lines) must stay green with no behaviour change, and the extraction must not move the `notificacion='enviando'` write.
- The preview must never reach `notificador.enviar` nor write `Ejecucion`; a test should assert both (spy on the notifier, count `Ejecucion` rows).
- The HTML frame: `srcdoc` with an empty `sandbox` is the safe form; any relaxing (`allow-same-origin`, `allow-scripts`) would let message content touch the console.
- Every preview queries the client's replica (accepted by DEC-189); the 15 s timeout and the 200-row cap bound it.
- Console guards (`IDS`, G3', the pinned row-button list at `consola.test.ts:1325`) break on any new button or id.
- `zonaHoraria` and `fecha` are inputs of `componerCorreo`: the preview must pass the deployment zone and "now", as the planner does, or the subject date will differ.
