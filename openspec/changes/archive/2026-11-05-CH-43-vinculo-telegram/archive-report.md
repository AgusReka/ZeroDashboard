# Archive Report: CH-43

**Change**: CH-43 — Telegram link (N5, DEC-185, DEC-196)
**Archived at**: 2026-11-05, on branch `ch43/archivo` from `master`, after PR #228 (DEC-196, a48b2e5), PR #229 (CH-43a, b4dc642), PR #230 (CH-43b, a188a88) and PR #231 (CH-43c, 9b3a562) were merged into `master`. PR #227 (the CH-42 archive) merged before them (85d6342).
**Destination**: `openspec/changes/archive/2026-11-05-CH-43-vinculo-telegram/`

**Main specs synced** (new capabilities created from their delta spec with the delta framing removed, Purpose kept; new requirements in existing specs added next to their most related requirement; nothing else changed):
- `telegram-link` (new capability): 7 requirements, 16 scenarios.
- `client-panel-telegram` (new capability): 5 requirements, 9 scenarios.
- `tenant-isolation`: ADDED only.
  - "Telegram Link Models Are Tenant-Scoped", placed after "Every Scoped Query Is Filtered by the Active Tenant (DEC-13)".
  - "Telegram Panel Routes Are Proven Isolated by a Two-Tenant Test", placed after "Cross-Tenant Isolation Is Proven by an Automated Test (T2)".
  - "The Telegram Poller Enters a Tenant Context Only From the Code Row (rule 2)", placed after "Scheduler-Entered Tenant Context Derives Identity Only From Own-Database Rows".
  - "Code Lookup Is the Single Audited Unscoped Read of CodigoVinculoTelegram", placed after "A Token Never Resolves to a Deactivated Tenant (rule 2)".
- `project-environment`: ADDED only.
  - "Optional Telegram Bot Token From the Environment (rule 7, DEC-185)" and "Telegram Variable Ships Only as a Placeholder", placed in that order after "SMTP Variables Ship Only as Placeholders".

Totals: 18 requirements and 33 scenarios added across four capabilities (two new, two existing), 0 modified. Each added title appears exactly once in its main spec (checked by title after the sync); no delta headings remain in the main specs.

**Decisions**: DEC-185 (Telegram as a second channel: one global bot, with the token in `TELEGRAM_BOT_TOKEN`, a one-time code from the panel, outbound `getUpdates` polling, one linked chat per tenant). DEC-196, recorded on `v2/dec-196` before the code (PR #228): the poll runs whenever a token is set, the bot answers with fixed texts, and a new code replaces the link.

**Final state**:
- Tasks 32/32 complete.
- Verify report: PASS WITH WARNINGS, 0 critical, 0 warnings, 3 suggestions; the label stays because the test suite exits 1 from the 4 known failures. Requirements 18/18; scenarios 33 (30 covered, 3 covered by the manual check 10.2, 0 GAP).
- Manual check 10.2, 2026-11-04: a real bot was linked from the panel card (`telegram-vinculo` `vinculado`); a made-up token kept `/health` at 200 while `telegram-sondeo` logged `rechazada` and backed off, with no token or chat id in the logs; no token logged `no-configurado` with `/health` at 200.
- `npm run build`: exit 0.
- `npm run test:db`: 1779/1783 on the CH-43c branch before the merge. The 4 failures are the known `src/conexiones/conexiones.test.ts` false positives. It was not re-run on the merged `master`; `src`, `prisma`, the README, the guide, the map and the skills were compared against `ch43/panel-telegram` and show no differences.
- Size versus forecast, excluding SDD artifacts: CH-43a about 880 changed lines (forecast about 520), CH-43b about 1070 (about 600), CH-43c about 400 (about 280). The user accepted `size:exception` for a and b before apply. The CH-43c forecast said Low risk and no exception, and it ended right at the 400 budget.

**Archive gate**: at archive time `gentle-ai sdd-status` (gentle-ai 2.9.0) reported archive `blocked` with `verification evidence is incomplete: unknown verify result field warnings`. The verify-report envelope does not follow the strict `gentle-ai.verify-result/v1` format: it carries the extra field `warnings`, has no `evidence_revision` or output hashes, and `test_exit_code` is 1. The maintainer chose on 2026-11-05 to archive by hand, with the same envelope shape as CH-40, CH-41 and CH-42. Not fixing the envelope is deliberate. The root fix is repairing the 4 `conexiones.test.ts` failures in a separate change.

**Follow-ups** (not scheduled):
1. Verify suggestion 1: a boot test for the no-token path, which needs the wiring of `server.ts` extracted first; it would turn the three MANUAL scenarios into COVERED.
2. Verify suggestion 2: a real-clock check of `detener()`; the 25 s bound is only demonstrated by 10.2.
3. Verify suggestion 3: the DB suites skip silently without a reachable database (not new to CH-43).
4. Repair the 4 failing `src/conexiones/conexiones.test.ts` cases in a separate change; it also lets the suite exit 0 and the envelope follow the strict format.
5. CH-44 (Telegram channel) is the next consumer of the link, per the proposal.

**Map**: the CH-43 row of `docs/02-mapa-de-changes.md` already carries #229, #230 and #231, so it needs no change in this branch.
