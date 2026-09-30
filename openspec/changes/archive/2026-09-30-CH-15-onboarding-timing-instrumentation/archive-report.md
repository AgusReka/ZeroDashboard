# Archive Report: CH-15 — Onboarding Timing Instrumentation

**Status**: ARCHIVED  
**Change**: CH-15-onboarding-timing-instrumentation  
**Date**: 2026-09-30  
**Archived to**: `openspec/changes/archive/2026-09-30-CH-15-onboarding-timing-instrumentation/`  

---

## Final State Summary

The CH-15 change has been fully planned, implemented, verified, and archived. The new `onboarding-timing-marks` capability is complete and ready for use in R1 closing (alta).

**Verdict**: PASS WITH WARNINGS (0 critical, 5 warnings, 3 suggestions)  
**Test Results**: 13/13 tests in `src/marcas-alta.test.ts`; 633/633 in full suite (npm test)  
**Build**: TypeScript clean (`npx tsc --noEmit`)  
**Tasks**: 12/13 marked complete; task 3.4 (verify+archive) completed per verify-report and final-state facts  

---

## Spec Syncing

### Main Spec Created

- **Source**: `openspec/changes/CH-15-onboarding-timing-instrumentation/specs/onboarding-timing-marks/spec.md`
- **Destination**: `openspec/specs/onboarding-timing-marks/spec.md`
- **Action**: Mechanical copy (via `cp -R`); verified with `diff -r` (no differences)

### Spec Amendments at Archive

Per user direction and verify-report findings:

1. **Removed vacuous scenario**: The "Bound filter" scenario was rewritten to reflect DEC-90 (no tenant parameter). The requirement heading changed from "Read-Only, Parameterized Script (rules 3, 4)" to "Read-Only Script (rules 3, 4)".

2. **Clarified design decisions**: Updated the "Tenant Identifier Never Comes From a Request (rule 2)" requirement to close the "PENDING DESIGN" placeholder and explicitly state that DEC-90 chose no parameters, returning all tenants' connections.

3. **Documented multi-view semantics**: Added a new scenario "Multi-view validation mark" under "Documented Limits" to formally describe the `validacion_ultima` behaviour: across multiple views on a connection, the mark returns the most recent non-null validation date with its state, or null if no view has been validated.

---

## Change Folder Archive

**Source**: `openspec/changes/CH-15-onboarding-timing-instrumentation/`  
**Destination**: `openspec/changes/archive/2026-09-30-CH-15-onboarding-timing-instrumentation/`  
**Method**: Plain `mv` (git mv failed due to untracked files; fallback succeeded)  
**Verification**: `diff -r` shows no differences (empty output)  

### Archive Contents

- proposal.md
- design.md
- explore.md
- specs/onboarding-timing-marks/spec.md
- tasks.md
- apply-progress.md
- verify-report.md

---

## Task Completion Reconciliation

**Task 3.4** ("Run `sdd-verify` against the spec, then `sdd-archive`") was unchecked in `tasks.md` at archive time. Per the Task Completion Gate and Final-State Authority hierarchy, this task is complete:

- **Evidence**: `verify-report.md` (generated 2026-09-30) records PASS WITH WARNINGS verdict
- **Authority**: Final-state facts from user (verify and archive completed)
- **Reconciliation**: Exceptional repair documented here; no archive-time stale-checkbox correction was made to the persisted tasks artifact (by design: only the archive report records the reconciliation to maintain audit trail)

---

## Verification Findings

Per `verify-report.md` (PASS WITH WARNINGS):

### Compliant Requirements (8/8)

- ✅ One Row per Conexion
- ✅ Mark Sources and Definitions
- ✅ Null When a Stage Has Not Happened
- ✅ Documented Limits
- ✅ Read-Only Script
- ✅ Tenant Identifier Never Comes From a Request
- ✅ Fixture Test Runs the Script Unchanged
- ✅ No Schema, Route, or Engine Change

### Passing Scenarios (12/12)

- ✅ Two connections in one tenant
- ✅ Failed run then ok run
- ✅ Re-validation
- ✅ No runs yet
- ✅ Never validated
- ✅ Limits recorded
- ✅ Clock mix
- ✅ Read-only content
- ✅ No parameters (formerly "Bound filter"; now reflects DEC-90)
- ✅ No route exposure
- ✅ Database unreachable
- ✅ Diff surface

### Test Execution

| Command | Result |
|---------|--------|
| `npx tsx --test src/marcas-alta.test.ts` (isolated) | 13 pass, 0 fail |
| `npm test` (full suite, TEST_DB_PORT=5434) | 633 pass, 0 fail |
| `npx tsc --noEmit` | Clean (exit 0) |
| Unreachable DB test (TEST_DB_PORT=5999) | 4 static pass, live suite skipped (correct) |

### AGENTS.md Rules (7/7)

All mandatory security and data-handling rules are satisfied:

1. No arbitrary SQL from P2 ✅
2. Tenant id never from request ✅
3. Read-only at two layers ✅
4. No SQL concatenation ✅
5. Data minimization ✅
6. Engine untouched ✅
7. No secrets in repository ✅

---

## Warnings and Suggestions (as issued in verify-report.md)

### Warnings

1. **Spec gap on multi-view semantics** (now addressed): The multi-view validation mark scenario was not explicitly pinned in the original spec. Fixture covers multi-view for latest-wins (A1) and single-view for clear case (B1), but not the mixed case. **Archive amendment**: Added "Multi-view validation mark" scenario to formally document the behaviour.

2. **Test-count instability** (benign): npm test reported 625 tests in one run and 633 in others; all passed. Not reproduced; likely environmental. No action required.

3. **No citable real capture** (accepted): The own DB (zerodashboard-db-1) has 2/8 migrations. Real marks will be captured at R1 closing alta. Bitácora records dated error block and labeled control run (0 rows on test DB). User accepted this per DEC-87 scope.

4. **Bitácora commit reference**: Points to "pendiente"; timestamp placeholders remain. These are filled at actual alta run time or commit time. Not a blocker.

5. **Task 1.1 deviation**: Planning artifacts were not committed first (user directed no commits). Stray `0` and `run` remain untracked and untouched (correct per user instruction).

### Suggestions

1. **Size exception approved**: About 586 authored lines plus 98 lines of decision documentation, against a 400-line budget. User explicitly approved `size:exception` for a single PR. Recorded and not a blocker.

2. **Bound filter scenario handled**: Spec amendment removes vacuous scenario and closes the "PENDING DESIGN" placeholder.

3. **Database unreachable scenario**: Confirmed by manual run; has no in-suite assertion. Acceptable under test suite convention (same as other live suites).

---

## Decisions Referenced

The following architecture decisions were registered in `docs/01-decisiones.md` before implementation:

- **DEC-87**: Script is read-only and checked in; no migration
- **DEC-88**: Connection registration mark uses `Conexion.creadaEn`
- **DEC-89**: Specific mark definitions and columns
- **DEC-90**: No tenant parameter; script lists all tenants (answers design decision B1)
- **DEC-91**: Script location at `scripts/marcas-alta.sql` (answers design decision B2)
- **DEC-92**: Read-only guarantee via transaction + column-grant role in test, `default_transaction_read_only=on` in P4 (answers design decision B3)

---

## SDD Cycle Complete

The change has been fully:
- ✅ Proposed
- ✅ Specified
- ✅ Designed
- ✅ Tasked
- ✅ Implemented (12/13 tasks complete; final task is archive itself)
- ✅ Verified (PASS WITH WARNINGS, no blockers)
- ✅ Archived

The new `onboarding-timing-marks` specification is now the source of truth at `openspec/specs/onboarding-timing-marks/spec.md` and is ready for use in R1 closing activities.

---

## Artifact Registry

**No Engram observation IDs** — this change used the `openspec` artifact store.

**Filesystem artifacts**:
- Main spec: `openspec/specs/onboarding-timing-marks/spec.md` (created at archive)
- Archived change: `openspec/changes/archive/2026-09-30-CH-15-onboarding-timing-instrumentation/` (all planning and implementation artifacts)
- This report: `openspec/changes/archive/2026-09-30-CH-15-onboarding-timing-instrumentation/archive-report.md`

---

## Next Steps

No follow-up work is required. The CH-15 change is complete and archived. Ready for the next change in R1.
