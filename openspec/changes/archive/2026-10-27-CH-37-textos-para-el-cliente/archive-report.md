# Archive Report: CH-37

**Change**: CH-37 — Client-facing title and description on the template (story D4)
**Archived at**: 2026-10-27, on branch `ch37/textos-cliente` before PR #211 was merged (the archive commit travels with the PR)
**Destination**: `openspec/changes/archive/2026-10-27-CH-37-textos-para-el-cliente/`

**Main specs synced**:
- `client-panel-automations`:
  - "Available Automations Rule (DEC-137)" and "Business Copy Map With Neutral Fallback (DEC-128, DEC-137)" were replaced in place. Texts come from the template row; dedup, hiding and order go by title.
  - The Purpose cites DEC-182 and DEC-190.
  - There are still 19 requirements. Scenarios go from 57 to 60.
- `initial-template-catalog`:
  - Added "Seeded Entries Carry the Client Texts" and "Existing Rows Receive the Texts by Slug".
  - "No Schema, API or Engine Change" was replaced; the two columns are its only exception.
  - The Purpose cites CH-37.
  - Requirements go from 11 to 13, and scenarios from 27 to 31.
- `automation-templates`:
  - Added "Optional Client Texts, Length-Capped and Glossary-Checked".
  - Requirements go from 12 to 13, and scenarios from 18 to 25.

## Artifacts

exploration.md, proposal.md, specs (client-panel-automations, initial-template-catalog, automation-templates), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-182**, business text (a), taken by the user on 2026-10-23.
- **DEC-190**, taken by the user on 2026-10-24 in the exploration. All four points went with option (a):
  - backfill by slug in the migration;
  - dedup and hiding by title;
  - `POST`/`PUT` accept the texts in this change;
  - order by title, then `id`.
  - It amends the "disponibles" rule of DEC-137. PR #210.
- **Delivery**: one PR with `size:exception` (~855 changed lines, ~600 of them tests), chosen by the user on 2026-10-27 over three chained PRs.

## Verify summary

PASS (see `verify-report.md`):
- `tsc` clean.
- 164 / 164 CH-37 tests on `zerodashboard_test`.
- `test:db` 1515 / 1519, the 4 failures being the known `conexiones` false positives.

The independent review's two warnings and one suggestion on test strength were fixed before the report.

## Follow-ups

- **S1.** The glossary check is a substring match over the 10 terms the spec fixes, narrower than `lenguaje.md`. Widening it is a decision on DEC-04.
- **Bitácora.** The CH-37 entry in `docs/bitacora/`.
- **CH-38.** The console screen to create and edit templates, which now only needs the front end for the texts.
