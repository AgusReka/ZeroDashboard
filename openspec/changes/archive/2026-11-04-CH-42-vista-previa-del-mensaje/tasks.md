# Tasks: CH-42 — Message preview for an automation, in the console, without sending

Inputs: proposal.md, specs/automation-scheduling/spec.md, specs/email-notification/spec.md, specs/execution-audit/spec.md, specs/query-console/spec.md, specs/tenant-isolation/spec.md, design.md.

Delivery: single-pr with `size:exception`, accepted up front (exploration decision 4(a)). Branch `ch42/vista-previa` from `master`.

DEC-195 is already written in `docs/01-decisiones.md` and goes on `v2/dec-195` from `master`, in its own PR, before the code (AGENTS.md). These tasks do not rewrite it.

Order is fixed for safety: the shared steps are extracted from the planner first, with `src/automatizaciones/planificador.test.ts` untouched and green; then the audit origin and the route; then the console; then the docs.

## 0. Decision
- [x] 0.1 DEC-195 is present in `docs/01-decisiones.md` on `v2/dec-195` (written; design §0). Confirm it is merged or in its own PR before code. Do not edit it here. (Completed by PR #225, merged 2026-11-04, after verify.)

## 1. Shared steps (planner untouched)
- [x] 1.1 `src/automatizaciones/corrida.ts` (new): `AutomatizacionDeCorrida`, `PlantillaDeCorrida` (moved from the planner's `PlantillaACorrer`), `PreparacionCorrida`, `prepararCorrida`, `peticionDeCorrida`, `entradaDeCorreo` (design §2). It imports neither `./notificador.js` nor `./planificador.js`.
- [x] 1.2 `src/automatizaciones/planificador.ts`: `resultadoDeCorrida` calls `prepararCorrida` and `peticionDeCorrida` (`loadConfig()` still read after `destinoDeConexion`); `notificar` calls `entradaDeCorreo` inside the existing `try`; `PlantillaACorrer` aliases `PlantillaDeCorrida`; header comment notes CH-42. The `enviando` write, the retries, the notifier call and the `Ejecucion` writes stay where they are.
- [x] 1.3 `src/automatizaciones/planificador.test.ts` is NOT edited. Run it (DB suite, command in 7.2) and confirm it passes as it is, before any later section; this is the proof the run did not move. `git diff --exit-code master -- src/automatizaciones/planificador.test.ts` is clean.
- [x] 1.4 `src/automatizaciones/vista-previa.test.ts` (new, pure part for the shared steps): `entradaDeCorreo` with one text null gives `mensaje: null`, and with both texts set equals what a run builds (spec "One input for the run and the preview"); `peticionDeCorrida` carries `limite` = the row cap and `desplazamiento` 0.

## 2. Audit origin
- [x] 2.1 `src/auditoria/auditoria.ts`: `OrigenEjecucion` gains `'automatizacion-vista-previa'`; the header comment lists the preview among the audited paths (design §5). No migration: `origen` is free text.

## 3. Preview route
- [x] 3.1 `src/automatizaciones/vista-previa.ts` (new): the types, the pure `respuestaDeVistaPrevia` (decision, `para`, `correo` per the spec's table) and `registerVistaPreviaRoute` with the nine steps of design §3: scoped read (`404` / `409 automatizacion-desactivada`), template read (`404`), `prepararCorrida` refusals mapped to the template test's bodies, one `ejecutarConsulta`, the sanitized `log.warn` on failure, one `registrarEjecucion` with `origen: 'automatizacion-vista-previa'`, `decidirNotificacion`, `componerCorreo`, flat `200`. No notifier, no `Ejecucion`.
- [x] 3.2 `src/automatizaciones/automatizaciones-rutas.ts`: optional `opciones: OpcionesVistaPrevia = {}` parameter, calls `registerVistaPreviaRoute`, header comment (design §3, last paragraph). The three existing test callers compile unchanged.
- [x] 3.3 `src/app/rutas.ts` and `src/server.ts`: `DependenciasRutas.correoConfigurado: boolean` (required); `server.ts` passes `notificador !== null`; the registrar receives `{ canales: registro, correoConfigurado }` (design §4). `src/app/rutas.test.ts` adds `correoConfigurado: false`.
- [x] 3.4 `src/automatizaciones/vista-previa.test.ts`, pure cases of design §9: `respuestaDeVistaPrevia` for `enviar` with two addresses (`para` in order, `correo` set), `sin-destinatario` and `no-configurada` (`correo` set), `omitida-bajo-minimo`, `omitida-sin-filas`, a `fallo` (`decision` and `correo` null), a `hayMas` result under the minimum (`enviar`); parity with `componerCorreo(entradaDeCorreo(...))` for the same template, result, instant and zone; a line naming a missing column gives the table.
- [x] 3.5 `src/automatizaciones/vista-previa.test.ts`, structural test: `vista-previa.ts` and `corrida.ts` import neither `./notificador.js` nor `./planificador.js`, and neither names `ejecucion.` (the `Ejecucion` delegate). Static half of "never sends, never records a run".
- [x] 3.6 `src/automatizaciones/vista-previa.test.ts`, DB cases (live database, skip when unreachable; fixture copied from `auditoria-registro.test.ts`: operator session, read-only role on a test schema, approved `producto` view, template, automation):
  - Reaching the minimum: `200`, rows, `decision` `enviar`, `para`, `correo`; then zero `Ejecucion` rows for the automation and the automation row deep-equal to before (also after calling twice).
  - **No send, no run, with a spy notifier**: the app is built with a spy notifier reachable by the test (and `correoConfigurado: true`); after the preview, the spy has zero calls and the `Ejecucion` row count is unchanged at zero.
  - Exactly one `RegistroEjecucion` with `origen` `automatizacion-vista-previa`, the connection, the composed statement and `plantillaId`; no recipient, subject, parameter value or cell in any column.
  - `correoConfigurado: true` vs `false` on two apps: `enviar` vs `no-configurada`, both with `correo`.
  - Row cap 2 on three rows with `minimoFilas` 5: two rows, `hayMas`, `enviar`.
  - Refusals, each with zero audit rows: unknown id `404`, deactivated `409`, unapproved view `409` with `entidades`, stale `valores` `400` with `problemas`.
  - A query failing at execution: `200` `fallo`, `decision` and `correo` null, one audit row `fallo`.
  - An audit write made to fail (the `auditoria-registro.test.ts:273` technique): the normal `200` with decision and message, and one `error` log line.

## 4. Isolation
- [x] 4.1 `src/aislamiento/aislamiento.test.ts`: one matrix row for `POST /automatizaciones/:id/vista-previa`, placed before `/desactivar`. Cross-tenant half expects `404 automatizacion-no-encontrada` with the existing leak checks (statement, credential, tenant id, automation id, recipients). The owner control expects `409` (the fixture's template reads `pedido`, which has no approved view), proving the route resolved the caller's own automation (design §9).
- [x] 4.2 `src/automatizaciones/vista-previa.test.ts` or the isolation suite: two tenants with different `destinatarios` and the same template each preview their own automation; each `para` equals its own list, in order, with none of the other tenant's addresses (spec "The preview's «Para» comes from the previewed automation").

## 5. Console UI
- [x] 5.1 `src/consola/consola.ts`, markup and styles: the `#auto-vista-previa` pop-up after `#auto-ajuste` (design §6 markup tree), with the single `<iframe id="vp-html" sandbox="" title="Mensaje en HTML">`, «Cerrar» as the only button, and the two `#vp-texto` / `#vp-html` id rules in the existing `<style>` block. Only existing classes; no `zd-` class in the script; no comment containing `srcdoc` or a backtick.
- [x] 5.2 `src/consola/consola.ts`, script: the «Vista previa» row action (active rows only, before «Ajustar»), `dialogoVistaPrevia`, `limpiarVistaPrevia`, `mostrarHtmlVistaPrevia` (the only `.srcdoc = ` in the document), `abrirVistaPrevia` with the generation guard, `DECISIONES_VISTA_PREVIA`, refusal and failure handling through `mostrarResultadoPrueba` and `MENSAJES_AUTOMATIZACION`, `ORIGENES_AUDITORIA['automatizacion-vista-previa']` = «Vista previa de automatización», and the header comment's CH-42 paragraph (design §6).
- [x] 5.3 `src/consola/consola.test.ts`, guards: new ids in `IDS` (`auto-vista-previa`, `vp-titulo`, `vp-aviso`, `vp-decision`, `vp-para`, `vp-tabla`, `vp-mensaje`, `vp-asunto`, `vp-texto`, `vp-html`, `vp-confirmar`, `vp-cerrar`) and `auto-vista-previa`, `vp-mensaje`, `vp-confirmar` in `IDS_OCULTOS`; the pinned row-button list at `:1325` becomes `['Ver ejecuciones', 'Vista previa', 'Ajustar', 'Desactivar']` (`:1339` stays); G3' stays as is.
- [x] 5.4 `src/consola/consola.test.ts`, **`srcdoc` guard** (`sinPeligros`, `:7373`): `innerHTML`, `outerHTML` and `insertAdjacentHTML` stay forbidden in both documents; `srcdoc` is forbidden in the login document and required exactly once in the console document, matched as `.srcdoc = `. Add the markup test: the only `<iframe` is `id="vp-html"` with `sandbox=""`, and the script never contains `sandbox`.
- [x] 5.5 `src/consola/consola.test.ts`, behaviour with queued answers: the `POST` URL, tenant header and no body; each decision line; «Para» and «sin destinatario»; the count line and the `hayMas` sentence; `srcdoc` equal to the received HTML and `<pre>` text verbatim for a message containing `<b>alerta</b>` (no element created); `correo` null hides `#vp-mensaje` and shows «Con este resultado una ejecución no arma un mensaje.»; `409` unapproved view, `400`, `fallo`, `409 credencial-ilegible`; `404` / `409 automatizacion-desactivada` with the list reload; a tenant switch mid-flight closes the pop-up and drops the answer; «Cerrar» is the only button; an emptied pop-up sets `srcdoc` to `''`; the deactivated row offers «Ver ejecuciones» only.
- [x] 5.6 `src/consola/consola.test.ts`, audit screen: a row with `origen` `automatizacion-vista-previa` and `plantillaId` `p-1` shows «Vista previa de automatización» and «Plantilla p-1».

## 6. Docs
- [x] 6.1 `docs/guia/06-automatizaciones.md`: the preview, what it runs, that it sends nothing and creates no run, and its audit row under the new origin.
- [x] 6.2 `.claude/skills/zerodashboard-design/guidelines/consola.md` and `.agents/skills/zerodashboard-design/guidelines/consola.md`: C-09 list actions gain «Vista previa» and one line on the pop-up; both copies identical.
- [x] 6.3 `docs/02-mapa-de-changes.md`: the CH-42 row says a row action and a pop-up, not a detail screen.

## 7. Verification
- [x] 7.1 `npm run build` (typecheck) and `npm test` (unit and console suites).
- [x] 7.2 `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` (preview, isolation, planner and audit suites); only the 4 known false positives of `conexiones.test.ts` may fail (the password `postgres` matches `"motor":"postgres"` in the response).
- [x] 7.3 `git diff --exit-code master -- src/automatizaciones/planificador.test.ts` is clean, and a search finds no `Ejecucion` delegate, notifier or planner import in `vista-previa.ts` and `corrida.ts` and exactly one `srcdoc` in the console script.
- [x] 7.4 Every scenario of the five delta specs maps to a test in the verify report.

## Review Workload Forecast
- Estimated changed lines: ~645 (code ~320: `corrida.ts` and planner edits ~70, route, registrar, deps and server ~110, audit origin ~5, console ~130; tests ~305; docs ~25). DEC-195 is on its own branch and not counted; the specs are synced at archive.
- 400-line budget risk: High (about 245 over).
- Chained PRs recommended: No: the extraction, the route and the console form one reviewable behaviour, and the planner-unchanged proof only holds if they land together (exploration decision 4(a)).
- Decision needed before apply: No. `size:exception` was accepted by the user on 2026-11-03, up front, for one PR on `ch42/vista-previa`.
