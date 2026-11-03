# Archive Report: CH-41

**Change**: CH-41 — Several recipients per automation (story N6)
**Archived at**: 2026-11-03, on branch `ch41/archivo` from `master`, after PRs #222 (DEC-194) and #223 (CH-41) were merged
**Destination**: `openspec/changes/archive/2026-11-03-CH-41-varios-destinatarios/`

**Main specs synced** (every requirement replaced in place; none added):
- `automation-scheduling`:
  - "Automatizacion Binds a Plantilla…": `destinatarios`, a list of at most 5, replaces `destinatario`; the migration scenario.
  - "Automation Lifecycle Is Create, List, Get, Deactivate — No Edit or Delete": the adjust takes `destinatarios` (and `minimoFilas`); `[]` empties it; the former key is refused.
  - "Run Pipeline Applies the Condition…": the run reads the list.
  - Requirements stay at 22, and scenarios go from 67 to 68.
- `email-notification`:
  - "Notification Outcome Precedence Is Deterministic": row 4 is an empty list; one message to every address; partial and full rejection scenarios. Its title now also cites DEC-187.
  - "Recipient Is Validated and Header-Safe": the list rule (trim, `direccionValida`, case-insensitive deduplication keeping the first spelling, cap of 5 after deduplication) and how each surface names a refusal.
  - The Purpose says the message goes to the automation's recipients, up to 5 in one message.
  - Requirements stay at 16, and scenarios go from 41 to 46.
- `client-panel-automations`:
  - "Read Current Settings" and "Update Settings In Place": P-04 reads and writes the list and needs at least one address.
  - Requirements stay at 19, and scenarios go from 60 to 63.
- `query-console`:
  - "Console Displays Automations and Supports Creating One" and "Console Adjusts an Automation in Place": one separated field, the split list, the 400 naming the typed address, the preview «Para».
  - Requirements stay at 53, and scenarios go from 166 to 168.
- `tenant-isolation`:
  - "Cross-Tenant Isolation Is Proven by an Automated Test" (the tick with A's two addresses) and "Notification Recipient Derives Only From the Tenant-Scoped Automation Row" (the whole list).
  - Requirements stay at 13, and scenarios stay at 32.

The sync replaced each MODIFIED requirement by title, ignoring the trailing references; every match was unique.

**Decisions**: DEC-187 (a)(i), firm since 2026-10-23. DEC-194, recorded on `v2/dec-194` before the code (PR #222): one separated field, the panel keeps at least one address, duplicates removed ignoring case.

**Final state**:
- All 22 tasks are done.
- Verify report: PASS WITH WARNINGS. 11/11 requirements, 85/85 scenarios (84 covered by tests, 1 by the manual check of the migration on the development database). 0 CRITICAL, 0 WARNING, 3 SUGGESTION.
- `npm run test:db`: 1674/1678. The 4 failures are the known `conexiones.test.ts` false positives.
- Development database: 4 pending migrations applied (CH-37, CH-39, CH-40, CH-41); the one stored address kept as a one-element list.
- Running app: one message to two addresses through Mailpit (`enviada`); the user confirmed delivery to both mailboxes through their own SMTP.
- Size: about 1204 changed lines without the SDD artifacts (tests ~820), against a forecast of ~690. The user accepted `size:exception` before apply.

**Deviations from the design, found in apply**:
- The notifier spreads the list (`to: [...c.para]`), because nodemailer's `to` does not accept a read-only array.
- Hint ids `auto-destinatario-ayuda` and `aj-destinatario-ayuda` were added, with `aria-describedby`.
- `docs/guia/08-diagnostico.md` was updated too: it documented the former error fields.
- The spec examples with `dueña@` were changed to `duena@`, because `direccionValida` accepts only ASCII addresses.

**Follow-ups** (verify suggestions, not scheduled):
1. `src/panel/panel.test.ts` needs the database; run without the `TEST_DB_*` variables it dials `localhost:5432`, which belongs to another project on this machine. A skip guard like the other DB suites would prevent it.
2. A partial rejection leaves no trace (DEC-187 resigns it); `info.rejected` is where it would come from.
3. One field per address (DEC-194 1(b)) stays possible without an API change.
4. Candidate recorded during the manual test: distinguish the template's `umbral` from the minimum rows in the console (`docs/02-mapa-de-changes.md`, «Candidatos que surgieron en la v2»).

**Map**: the CH-41 row of `docs/02-mapa-de-changes.md` gets its PR number (#223) in this same branch.
