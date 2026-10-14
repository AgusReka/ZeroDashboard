# Verify Report: CH-22b — "Mis automatizaciones" in the client panel

**Date**: 2026-10-14, retroactively: CH-22b was implemented and merged on 2026-10-07 (PRs #102 to #105) but never verified nor archived. Verified on `master` at `c0c8682`, where CH-22c (failure state) and CH-23 (in-place adjustment) have since built on it.
**Verdict**: PASS with warnings. No blockers.
Verified inline by the orchestrator (the Claude Code hook refuses `sdd-*` sub-agent dispatch). Origin: the audit of 2026-10-13 (`docs/auditoria-2026-10-13.md`, §6), which classified CH-22b as completed but not archived.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0 (run for CH-31 on `797037c`; no source changed since) |
| `npm run build` | ok (same run) |
| `npm run test:db` (full suite, `zerodashboard_test`) | 1308 of 1312; the 4 failures are the known `conexiones` false positives (same run) |
| `npx tsx --test src/panel-automatizaciones.test.ts src/panel.test.ts src/panel-auth.test.ts src/aislamiento-panel.test.ts` against `zerodashboard_test` | 72 tests, 72 pass |
| Manual visual review (task 3.10) | done by the user, accepted on 2026-10-14 |

## Spec coverage

Every scenario of the traceability table in `tasks.md` maps to tests in `src/panel-automatizaciones.test.ts` (pure projection, copy map, frequency, next run, available rule), `src/panel.test.ts` (page states, glossary scan, labels), `src/panel-auth.test.ts` (session guard, exemption row) and `src/aislamiento-panel.test.ts` (two-tenant sweep with a foreign `X-Tenant-Id`). All pass.

Three CH-22b scenarios were later superseded and are verified in their current form:
- "A failed last execution does not change the status": replaced by CH-22c's `con_falla` rule ("Business Status Includes Failure").
- "Only allow-listed keys per item": CH-23 added the opaque `id` to `activas` items.
- "No actions offered": CH-23 added "Ajustar" for active and failing cards; the page still offers no "Activar" (`panel.test.ts`: "activation is not offered").

## Warnings

- **W1** — Pre-existing: four `conexiones` tests fail with the password `postgres`.
- **W2** — The available rule implemented (and recorded in DEC-137's amendment of 2026-10-06) dedupes twin templates by slug and hides them together; the CH-22b delta spec never said so. The sync adds that sentence and a scenario, from DEC-137 and the code, not a new decision.
- **W3** — CH-22b's delta specs were never synced, so the main `client-panel-automations` spec started with CH-22c's "MODIFIED (overriding CH-22b)" and three "(unchanged)" placeholders pointing at text that was not there. The sync composes the spec (see `archive-report.md`).
