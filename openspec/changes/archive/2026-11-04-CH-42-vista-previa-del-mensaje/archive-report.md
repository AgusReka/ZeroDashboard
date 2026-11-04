# Archive Report: CH-42

**Change**: CH-42 — Message preview for an automation, in the console, without sending (X10, DEC-189, DEC-195)
**Archived at**: 2026-11-04, on branch `ch42/archivo` from `master`, after PR #225 (DEC-195, branch `v2/dec-195`) and PR #226 (CH-42, branch `ch42/vista-previa`) were merged into `master` (merge commits 036ae67 and 4e6c859)
**Destination**: `openspec/changes/archive/2026-11-04-CH-42-vista-previa-del-mensaje/`

**Main specs synced** (new requirements added next to their most related requirement; modified requirements replaced in place by title, whole, scenarios and `(Previously: …)` lines included; nothing else changed):
- `automation-scheduling`:
  - ADDED "Message Preview Runs the Automation's Query Without a Run or a Send (X10, DEC-189, DEC-195)", placed after "Run Pipeline Reuses the Existing Read-Only Composition and Execution Chain (rule 5, DEC-71)".
  - MODIFIED "Run Pipeline Reuses the Existing Read-Only Composition and Execution Chain (rule 5, DEC-71)": the steps before the dial and the run's page are one function shared by the scheduler and the preview.
- `email-notification`:
  - ADDED "Preview Builds the Run's Message and Never Sends It (X10, DEC-189, DEC-195)", placed after "Notification Outcome Precedence Is Deterministic".
  - MODIFIED "Message Built From the Template's Texts (DEC-188, DEC-192)": the renderer input is built by one function shared by the run and the preview.
- `execution-audit`:
  - MODIFIED "Audit Record": `origen` gains `automatizacion-vista-previa`.
  - MODIFIED "Every Audited Path Records Its Execution": `POST /automatizaciones/:id/vista-previa` writes one row per request that reached the engine, under its own origin.
  - MODIFIED "Recording Never Breaks an Execution": the preview's audit-write failure is also logged and the 200 preview is kept.
- `query-console`:
  - ADDED "Console Previews an Automation's Message (X10, DEC-189, DEC-195)", placed after "Console Adjusts an Automation in Place (DEC-174)".
  - MODIFIED "Console Page Is Servable": the console document may contain `srcdoc` exactly once, on the sandboxed preview frame (empty `sandbox`).
  - MODIFIED "Audit Screen": the Origen column names «Vista previa de automatización».
- `tenant-isolation`:
  - MODIFIED "Cross-Tenant Isolation Is Proven by an Automated Test (T2)": the sweep includes the preview route.
  - MODIFIED "Notification Recipient Derives Only From the Tenant-Scoped Automation Row (rule 2)": the preview's «Para» comes only from the previewed automation's row.

Totals: 3 requirements added and 9 modified across five capabilities. Each delta title was matched once in its main spec (checked by title before and after the sync); no delta headings remain in the main specs.

**Decisions**: DEC-189 (X10, the operator sees the message without waiting for the schedule; no on-demand run or send, DEC-189 (b) rejected). DEC-195, recorded on `v2/dec-195` before the code (PR #225): the preview route, the sandboxed frame and the audit origin.

**Final state**:
- Tasks 27/27 complete in substance. Task 0.1 (DEC-195 on its own branch and PR) was completed by PR #225 after verify; it is ticked `- [x]` in the archived `tasks.md`.
- Verify report: PASS WITH WARNINGS, 0 critical. After verify, warnings 2 and 3 were fixed in tests only: the spy notifier was removed, and the failed-query console case now uses the real category `tiempo-agotado` and asserts the exact sentence. `vista-previa.test.ts` and `consola.test.ts` pass 409/409. Warning 1 (no TDD evidence table) remains as a process note.
- `npx tsc --noEmit`: exit 0.
- `npm run test:db`: 1720/1724. The 4 failures are the known `conexiones.test.ts` false positives.
- Unit-only suite: 1178/1178. `src/automatizaciones/planificador.test.ts` is unchanged.
- Size: about 1450 changed lines versus master, excluding SDD artifacts (about 840 tests, about 610 code and docs), against a forecast of about 645. The user accepted `size:exception` before apply.

**Follow-ups** (verify suggestions, not scheduled):
1. The `leido === null` branch of `abrirVistaPrevia` is not covered by a test.
2. The "nothing is dialled" property on refusals is proven only indirectly, through the absence of audit rows and of calls, not by a direct assertion on the connection layer.

**Map**: the CH-42 row of `docs/02-mapa-de-changes.md` gets its PR number (#226) in this same branch.
