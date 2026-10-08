# Exploration: CH-22c — Panel "My Automations" with Failure State (P3h)

## Context
CH-22b shipped the panel read (`GET /api/panel/automatizaciones`) and screen P-02 with status `activa` | `pausada` and no derived failure banner. Story **P3h**: "Como P2, quiero enterarme si algo falló" with "estado de error visible y aviso de falla al cliente". The project also notes a possible email notification for failures (separating the "visible state" cut from a new mailer).

## Known Constraints
- Rule 1: no SQL, no technical terms in P2 surface. The error reason never reaches the client (only a neutral business message).
- Rule 2: tenant derived exclusively from the session (DEC-135).
- DEC-137 (CH-22b): status is `activa`/`pausada` only; "con falla" is out of scope for CH-22b.
- DEC-93: the panel shows metadata, not execution rows. The last run is `{ fecha, resultado }` with `no-realizada` for `fallo`/`omitida`.
- CH-22b already exposes `ultimaEjecucion.resultado` and the page shows "No se pudo hacer" on `no-realizada`. That is a small signal, not a banner/derived `con falla` state.
- Design skill (P-03): AutomationCard may show an inline Banner error in business language. The visible cut should limit to the panel state/banner; avoid introducing a new SMTP notification unless it is strictly necessary and DEC-aligned.
- No schema changes, no migration, no write actions.

## Open Questions
1. **Where does the "failure" signal come from?**
   - Option A: derive `estado` as `con_falla` when the automation is `activo=true` and its latest finished execution is `fallo`. Also consider if there are `omitida` cases that should trigger a banner? DEC-137 states "a failed last execution does not change the status" for CH-22b - so CH-22c flips/replaces that rule for the panel.
   - Option B: keep `estado` in `{activa, pausada}` and add an `avisos` array with a failure banner when the last finished run failed. This is additive to DEC-137.

2. **Scope of "visible state" vs email notification**
   - The cut is "estado de error visible y aviso de falla al cliente". A new email on failure is a separate notification (mailer exists, CH-14/17 touched emails). The map states ⚠ confirm it encaja or limit to visible. Prefer **limit to visible state only** for CH-22c to keep the cut small; do not add SMTP code.

3. **Copy (neutral, no technical terms)**
   - Suggested banner title: "No pudimos completar esta automatización esta vez" (matches P-03 intent) and body: "Intentamos hacerla a las [hora], pero no salió. La próxima vez que corra la revisión, volvemos a intentarlo." Or a minimal one-line. Also consider if multiple failures - but we only show based on latest finished execution.
   - Must not mention replica, SQL, cron, timeout, conexión, etc.

4. **When to show the failure banner**
   - Only when `activo=true` and `ultimaEjecucion.resultado === 'no-realizada'` (since `fallo`/`omitida` map to `no-realizada`). Also maybe when there is no successful run after failure? But we only have latest finished.
   - Should a paused automation with a failed last run show any banner? Probably not; it's paused.

5. **Backward compatibility**
   - CH-22b clients still work. Response shape: can add `avisos: []` (empty) or change `estado`. Better to add `avisos?: Aviso[]` and keep `estado` as before (`activa`/`pausada`) to be strictly additive. Or introduce `estadoDerivado`? But the spec for CH-22b says "estado" is active/paused. Check DEC-137: "Each `activas` item SHALL carry `estado` equal to `activa` when the stored `activo` is `true` and `pausada` when it is `false`. No other value SHALL be produced; a derived failure status ("con falla") is out of scope (CH-22c)."

So CH-22c **modifies** this requirement. That means the spec for CH-22c will override/extend the CH-22b spec for the failure case. Also need to update DEC-137's consequence or just the change spec.

6. **UI (panel.ts)**
   - Add an inline banner (zd-banner zd-banner--error) in the automation card when applicable, with aria-live or role="alert" as appropriate. Keep script constraints (no innerHTML with API data, string concatenation only).

## Recommendation
- Add optional `avisos` array to each `activas` item: `avisos?: Array<{ tipo: 'error'; titulo: string; cuerpo: string }>` (or minimal shape). Keep `estado` as `activa`/`pausada` to minimize breaking surface and avoid a new enum value rippling; alternatively add `tieneFalla?: boolean` and let the page render banner. But avisos is explicit and future-proof.
- Or alternatively, allow `estado: 'con_falla'` in addition? The design skill says "estado (activa / con_falla / pausada)". That matches P-03. DEC-137 explicitly excluded `con_falla` from CH-22b - CH-22c brings it in.
- The cleanest is: `estado` becomes `activa` | `pausada` | `con_falla`; show banner when `estado === 'con_falla'`. This matches the design skill's AutomationCard (has slot for inline banner, and status badge/text would reflect con_falla).
- Derivation: `con_falla` only when `activo === true` AND `ultimaEjecucion !== null` AND `ultimaEjecucion.resultado === 'no-realizada'`. A paused automation is never `con_falla`.
- Do **not** add email notification code in this change. Keep the cut strictly to visible state in the panel (API + page). Document the email as out of scope or a follow-up if needed.

## Tasks Sketch
PR0 (docs): create openspec/changes/CH-22c with exploration/proposal/specs/design/tasks; may add/update DEC if needed (likely not - can record in change docs).

PR1 (pure layer + unit tests): extend projection in `panel-automatizaciones.ts` to compute derived estado with `con_falla` per rule; add copy for failure avisos/banner text if needed; unit tests for derivation cases.

PR2 (route + wiring + isolation): update route tests to cover failure cases; isolation tests unchanged in shape; wiring same (RUTAS_PANEL_PUBLICAS already has the row).

PR3 (page + page tests): update `panel.ts` to render failure banner in business language when estado is `con_falla`; update `panel.test.ts` to assert presence of failure banner text; glossary scan still passes.

Verification: npx tsc --noEmit, targeted tests, TEST_DB_PORT=5434 npm test where appropriate, npm run build.
