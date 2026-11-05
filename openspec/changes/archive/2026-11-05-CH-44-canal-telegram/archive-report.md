# Archive Report: CH-44

**Change**: CH-44 — Telegram channel (N4, DEC-185, DEC-197)
**Archived at**: 2026-11-05, on branch `ch44/archivo` from `master`, after PR #233 (DEC-197, 87c8d87b) and PR #234 (the change, 85a29976) were merged into `master`.
**Destination**: `openspec/changes/archive/2026-11-05-CH-44-canal-telegram/`

**Main specs synced** (copied by script from the delta, each title checked to appear exactly once afterwards; added requirements placed next to their most related requirement):
- `telegram-notification` (new capability): 7 requirements, 32 scenarios.
- `client-panel-automations`: 1 added ("Card Notice When a Telegram Automation Has No Chat", after "Failure Banner Visible in Panel (UI)"), 5 modified ("Automations Read Route and Response Shape", "Allow-List Projection Without Technical Fields", "Read Current Settings", "Update Settings In Place", "Adjust Form").
- `execution-log`: 1 added ("Ejecucion Records Its Channel", after "Ejecucion Records the Notification Outcome"), 2 modified ("Ejecucion Records the Notification Outcome", "Runs Listing Exposes the Notification Outcome").
- `automation-scheduling`: 3 added ("The Automation Chooses One Channel", "The Run Notifies Through Its Channel", "The Preview Reads the Automation's Channel"), each after its related requirement.
- `query-console`: 3 added ("Console Chooses the Channel", "Runs View Reads Each Run's Own Channel", "Preview Pop-Up on the Telegram Channel"), each after its related requirement.
- `email-notification`: 2 added ("This Capability Applies to the correo Channel", "The Preview Names the Channel").
- `domain-data-model`: 1 added ("Channel Columns Are Text With Their Values in Code"), at the end.
- `telegram-link`: the first paragraph of Purpose only.

Totals: 18 requirements added and 7 modified across seven capabilities, with 106 scenarios in the delta specs.

**Decisions**: DEC-185 (Telegram as a second channel), DEC-197 (the panel also chooses the channel and warns when the chat is missing, the run stores its channel, and a template with no texts uses the email's text part).

**Final state**:
- Tasks 34/34 complete. Task 8.2 changed: the scoped read is proven in `panel-automatizaciones.test.ts`, not in `aislamiento-panel.test.ts`.
- Verify report: PASS WITH WARNINGS, 0 critical, 2 warnings, 2 suggestions.
- `npm run build` and `npm run build:agente`: exit 0.
- `npm run test:db`: 1862/1866 on `ch44/canal-telegram` before the merge. The 4 failures are in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4 and CH-07), with the error of the known false positive. They were not rerun without this change, and the suite was not rerun on the merged `master`. Only the map row changed on the branch after that run.
- The verification ran in the session that wrote the code, because the hook refuses `sdd-*` sub-agents: it is not an independent review.
- Size versus forecast, excluding SDD artifacts: about 1,800 changed lines (forecast about 1,050), of which about 1,070 are tests. The user accepted `size:exception` for one PR.

**Archive gate**: at archive time `gentle-ai sdd-status` reported archive `blocked` with `verification evidence is incomplete: unknown verify result field warnings`. The verify-report envelope does not follow the strict `gentle-ai.verify-result/v1` format, and `test_exit_code` is 1. The maintainer decided on 2026-11-05 to archive by hand, as in CH-40 to CH-43, and this report records it. The gate was not satisfied and no value in the report was changed to pass it.

**Incident**: a `git add docs` put `docs/design/ZeroDashboard Design System.zip` in commit `a7f415a`, which was pushed to `ch44/canal-telegram`. The commit was amended and force-pushed before PR #234 was opened, so neither the PR nor `master` holds the file. The orphaned commit may stay reachable by its hash on GitHub for a while.

**Follow-ups** (not scheduled):
1. Run the manual check with a real bot, needing `TELEGRAM_BOT_TOKEN`: one notice to a chat, one with the bot blocked and one long result. No message has reached real Telegram yet. It should happen before CH-49 builds the demo on this channel.
2. Repair the 4 failing `src/conexiones/conexiones.test.ts` cases in a separate change, which also lets the suite exit 0, and move the verify envelope to the strict format. This gate has now blocked five archives.
3. The wiring in `src/server.ts` has no test, as in CH-43.
4. Verify suggestion 2: a form case for the 400 on `canal` in `panel.test.ts`.

**Map**: the CH-44 row of `docs/02-mapa-de-changes.md` already carries DEC-197 and #234, so it needs no change in this branch.
