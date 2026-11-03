# Archive Report: CH-40

**Change**: CH-40 — Minimum rows per automation (story X9)
**Archived at**: 2026-11-03, on branch `ch40/archivo` from `master`, after PRs #218 (DEC-193) and #219 (CH-40) were merged
**Destination**: `openspec/changes/archive/2026-11-03-CH-40-minimo-de-filas/`

**Main specs synced**:
- `automation-scheduling`:
  - Added "Minimum Rows Are Bounded by the Row Cap (DEC-186, DEC-19)", right after "Automatizacion Binds a Plantilla, a Tenant's Connection, Parameter Values, and a Schedule (DEC-74)".
  - "Automatizacion Binds a Plantilla…" was replaced in place: the `minimoFilas` column with default 1, and the scenario for rows created before the migration. The old "settable only at creation" for `destinatario` is dropped, since DEC-174 lets the operator adjust it.
  - "Run Pipeline Applies the Condition and Notifies After Query Success (X3, N1)" was replaced in place: the condition reads `minimoFilas`, and a run below it closes without sending.
  - The Purpose says an automation carries a minimum of rows, and cites X9, DEC-186 and DEC-193.
  - Requirements go from 21 to 22, and scenarios from 58 to 67.
- `email-notification`:
  - "Notification Outcome Precedence Is Deterministic" was replaced in place: the table gains row 3, `omitida-bajo-minimo`, with the `hayMas` rule. Its title now also cites DEC-186.
  - The Purpose says a message goes out only when the rows reach the minimum.
  - Requirements stay at 16, and scenarios go from 35 to 41.
- `execution-log`:
  - "Ejecucion Records the Notification Outcome (DEC-83)" and "Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)" were replaced in place: the permitted set and the listing include `omitida-bajo-minimo`.
  - Requirements stay at 14, and scenarios go from 34 to 35.
- `query-console`:
  - "Console Displays Automations and Supports Creating One (DEC-78)", "Console Adjusts an Automation in Place (DEC-174)" and "Console Displays an Automation's Runs (DEC-80)" were replaced in place: the minimum in the create wizard and the adjust, its preview line, and the new run label.
  - Requirements stay at 53, and scenarios go from 162 to 166.

The sync replaced each MODIFIED requirement by title (ignoring the trailing references) and inserted the ADDED one after its anchor; every match was unique. The main specs already lacked a blank line before some requirements; that pre-existing formatting is left as it was.

**Decisions**: DEC-186 (b), firm since 2026-10-23. DEC-193, recorded on `v2/dec-193` before the code (PR #218): the console adjust also edits the minimum, and a result cut by the row cap reaches it.

**Final state**:
- All 20 tasks are done.
- Verify report: PASS WITH WARNINGS. 9/9 requirements, 64/64 scenarios (62 covered, 2 weak: the lowered cap is tested at unit and registrar level, not in a scheduler run). 0 CRITICAL, 0 WARNING, 3 SUGGESTION.
- `npm run test:db`: 1641/1645. The 4 failures are the known `conexiones.test.ts` false positives, outside this change.
- Size: about 617 changed lines without the SDD artifacts. The user accepted `size:exception` on 2026-11-03.

**Deviation from the design, recorded during apply**: the row cap reaches the routes as a parameter from `src/server.ts` (`DependenciasRutas.topeFilas`), like `zonaHoraria`, instead of a `loadConfig()` call per request. `loadConfig()` also validates the master key and `APP_PORT`, which would have forced every pure route test to fake the environment. Design §4.1, the spec and the proposal were updated before the PR.

**Follow-ups** (verify suggestions, not scheduled):
1. A scheduler test with the row cap below an automation's minimum, once the scheduler can take its cap from the test.
2. A console adjust test for a `/minimoFilas` refusal.
3. CH-42 (preview) should reuse `decidirNotificacion` for the minimum, so the `hayMas` rule stays in one place.

**Map**: the CH-40 row of `docs/02-mapa-de-changes.md` gets its PR number (#219) in this same branch.
