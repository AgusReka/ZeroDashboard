# Archive Report: CH-38

**Change**: CH-38 — Templates screen in the console (stories D4, D5)
**Archived at**: 2026-10-27, on branch `ch38/pantalla-plantillas` before PR #214 was merged (the archive commit travels with the PR)
**Destination**: `openspec/changes/archive/2026-10-27-CH-38-pantalla-de-plantillas/`

**Main specs synced**:
- `automation-templates`:
  - Added "A Template In Use Is Not Replaced", "The Full Projection Reports Use" and "Testing an Unsaved Template".
  - "Catalog Supports Create, List, Get, Replace — No Delete (DEC-68)" was replaced in place: replace is refused on a template in use.
  - The Purpose says the catalog is curated from the console too, and cites DEC-182 and DEC-191.
  - Requirements go from 13 to 16, and scenarios from 25 to 35.
- `tenant-isolation`:
  - Added "Template Use Is the Single Audited Unscoped Read of Automatizacion".
  - Requirements go from 12 to 13, and scenarios from 29 to 32.
- `execution-audit`:
  - "Every Audited Path Records Its Execution" was replaced in place: it lists `POST /plantillas/prueba`, which records `plantillaId` null.
  - There are still 6 requirements. Scenarios go from 9 to 10.
- `query-console`:
  - "Templates Screen" was replaced in place: header action, client texts, and «Editar» or «Duplicar y editar» by `enUso`.
  - Added "Template Pop-Up for Create, Edit and Duplicate", right after it.
  - Requirements go from 50 to 51, and scenarios from 149 to 156.

## Artifacts

exploration.md, proposal.md, specs (automation-templates, tenant-isolation, execution-audit, query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-182**, edit (b), taken by the user on 2026-10-23.
- **DEC-191**, taken by the user on 2026-10-27 in the exploration (PR #213):
  - in use means an active automation (1(b), against the recommended (a));
  - the cross-tenant read is a function handed to the routes (2(a));
  - a new route tests an unsaved template, and saving is gated by a passing test (3(a));
  - a copy starts without client texts (4(b)).
  - A second commit (`0c7cdf4`) records three refinements from the design, approved before the tasks: the read lives in the isolation extension, it answers yes or no, and a row lock closes the race.
- **Delivery**: one PR with `size:exception`, chosen by the user in the exploration (5(b)).

## Verify summary

PASS with warnings (see `verify-report.md`); the warnings are only the 4 known `conexiones` false positives:
- `tsc` clean.
- `test:db` 1560 / 1564.
- 15 / 15 tasks, 30 / 30 scenarios covered, 0 critical, 0 warning, 5 suggestions on test strength.

One deviation was corrected before the verification: after a `409`, «Duplicar y editar» now clears the client texts, as DEC-191 says for any copy.

## Follow-ups

- **S1 to S3.** Tests for the `terminos` body and the first-page size of `POST /plantillas/prueba`, and for no audit row when it refuses.
- **S4.** The race test detects the lock with a 750 ms probe. It is timeboxed, but could be sensitive to a slow machine.
- **Bitácora.** The CH-38 entry in `docs/bitacora/`.
- **CH-39.** The message text fields, loaded in this same pop-up.
