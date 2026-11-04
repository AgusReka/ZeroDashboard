# Proposal: CH-42 — Message preview for an automation, in the console, without sending

**Status**: ready for spec and design. Inputs: exploration.md, DEC-189 (a), DEC-195 (exploration decisions 1–3), DEC-186, DEC-193, DEC-187, DEC-188, DEC-192, DEC-162, DEC-131. Story X10.

## Intent
P1 wants to see the message an automation would send without waiting for its schedule (X10). The console gets a preview that runs the automation's query with its connection and stored values, shows the rows, says whether the notice would go out and to whom, and shows the message as text and HTML. It sends nothing and records no `Ejecucion`; it leaves one audit row, recorded the same way as the template test (DEC-189, DEC-195). Every real send is still scheduled: there is no «Enviar ahora».

## Scope

### In Scope
- **Shared building blocks, extracted from the planner** (`src/automatizaciones/planificador.ts`), with no change to the run's behaviour:
  - The query step of `resultadoDeCorrida`: view gate, `componerSentencia`, `prepararSentencia`, `destinoDeConexion`, `ejecutarConsulta` with `limite = topeFilas`, `desplazamiento = 0`.
  - The message step of `notificar` (`:372-386`): the `mensaje` from `encabezadoMensaje`/`lineaMensaje` and the `EntradaCorreo` for `componerCorreo`.
  - The planner keeps the `notificacion='enviando'` write, the SMTP call and the `Ejecucion` rows.
- **Route.** `POST /automatizaciones/:id/vista-previa` in `automatizaciones-rutas.ts`, tenant-scoped like the other automation routes:
  - Reads the scoped automation (404 if missing or from another tenant) and its template.
  - Gate refusals reuse the template test's codes: 409 view not approved, 400 stored values no longer valid, 409 unreadable credential.
  - Runs the query read-only with the planner's page, so `hayMas` and the minimum check match a real run.
  - Applies `decidirNotificacion(resultado, destinatarios, smtpConfigurado, minimoFilas)`.
  - Replies `200` with the engine result, the decision (`enviar` with `para`, or the skip: `omitida-sin-filas`, `omitida-bajo-minimo`, `sin-destinatario`, `no-configurada`), and `correo: {asunto, texto, html}` whenever a message can be built (also on `sin-destinatario` and `no-configurada`), else `null`. A failed query replies with the engine error, as the template test does.
  - Never calls the notifier and never writes `Ejecucion`.
- **Audit.** One `registrarEjecucion` per preview with `origen: 'automatizacion-vista-previa'`, `conexionId`, the composed `sql` and `plantillaId` (DEC-195). `OrigenEjecucion` gains the value; the console's `ORIGENES_AUDITORIA` labels it «Vista previa de automatización». A write failure is swallowed (DEC-162).
- **Console UI** (`src/consola/consola.ts`):
  - A «Vista previa» row action, only on active automations, next to «Ajustar» (DEC-195).
  - A pop-up with: the decision line («Se enviaría a …» or the reason it would be skipped), «Para», «Asunto», the rows (`renderizarTabla`), the text in a `<pre>`, and the HTML in an `<iframe sandbox srcdoc>` with no permissions.
  - Loading and error states; a gate refusal or query error is shown with the console's existing messages.
  - New ids in `IDS`/`IDS_OCULTOS`; no `zd-*` classes in the script (G3').
- **Docs.**
  - `docs/guia/06-automatizaciones.md`: the preview, what it runs, that it sends nothing, and its audit row.
  - The console guideline for the automation screen (C-09) in both copies of the design skill, if it lists the row actions.
  - DEC-195 in `docs/01-decisiones.md` (written).

### Out of Scope
- «Enviar ahora» or any manual send (DEC-189 (b), rejected).
- A dedicated automation detail screen (DEC-195, 2(b)).
- The Telegram view (CH-44).
- Preview in the panel (rule 1).
- Linking the audit row to the automation (`RegistroEjecucion` has no `automatizacionId`; DEC-195 "Se resigna").
- Any change to the create wizard's schematic preview (DEC-131), the schedule, or the run record.

## Delivery (exploration decision 4(a))
One SDD change, one PR, branch `ch42/vista-previa` from `master`. Estimate ~620 changed lines; `size:exception` accepted by the user on 2026-11-03. DEC-195 goes on a `v2/dec-195` branch from `master`, as DEC-194 did.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `automation-scheduling`: the preview route next to the other automation routes; the run pipeline's query and message steps are shared with it; every send is still scheduled.
- `email-notification`: the message built from the template texts is one function used by the run and by the preview.
- `execution-audit`: the `origen` list gains `automatizacion-vista-previa`; the preview is an audited path.
- `query-console`: the «Vista previa» row action, the pop-up, and the audit screen's origin label.
- `tenant-isolation`: the new scoped route in the two-tenant sweep.

## Approach
- **Extract, then reuse.** Two exported functions next to the planner (e.g. `consultaDeAutomatizacion` and `entradaDeCorreo`), called by `crearPlanificador` and by the route. The planner tests stay green unchanged; that is the proof the run did not move.
- **Same inputs as the run.** "Now" and the deployment zone (`zonaHoraria`) feed `componerCorreo`, as in the planner, so the subject date matches.
- **Isolated frame.** The HTML goes into `srcdoc` as a property set from the script (no string concatenation into markup), with `sandbox=""`. Nothing in the message can run script or reach the console's origin.
- **Proof of no side effects.** Route tests with a spy notifier assert zero calls and count zero new `Ejecucion` rows; one audit row with the new origin.

## Affected Areas
- `src/automatizaciones/planificador.ts`, `automatizaciones-rutas.ts`, a new module for the extracted steps, and their tests
- `src/auditoria/auditoria.ts` and its tests
- `src/consola/consola.ts`, `src/consola/consola.test.ts`
- `src/aislamiento/aislamiento.test.ts`
- `docs/guia/06-automatizaciones.md`, both copies of the console guideline, `docs/02-mapa-de-changes.md`
- The five specs above (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The extraction changes the run (order of writes, retries) | Medium | Extract only pure steps; the `enviando` write, retries and the notifier stay in the planner; `planificador.test.ts` unchanged and green |
| The preview reaches the notifier or writes `Ejecucion` | Low | No notifier is passed to the route; tests assert zero sends and zero runs |
| Message HTML runs in the console | Low | `iframe` with empty `sandbox` and `srcdoc` set as a property; a console test checks the attribute |
| Every preview queries the client's replica | Certain | Accepted by DEC-189; bounded by the 15 s timeout and the 200-row cap; operators only |
| Console guards (`IDS`, G3', the pinned row-button list) | High | New ids registered; the pinned list updated to include «Vista previa» |
| Size ~620 lines | Certain | `size:exception` accepted; the tasks forecast still reports it |
