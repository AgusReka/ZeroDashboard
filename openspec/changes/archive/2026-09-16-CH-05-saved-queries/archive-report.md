# Archive Report: CH-05 — Saved Queries

**Date**: 2026-09-16  
**Change**: CH-05-saved-queries  
**Verdict**: ARCHIVED SUCCESSFULLY  
**Artifact Store**: hybrid (openspec + engram)

## Summary

CH-05 has been fully completed, verified, and archived. All 24 tasks are complete, the verify-report shows PASS WITH WARNINGS (0 CRITICAL findings), and both delta specs have been merged into the main spec repository. Two apply-time deviations were independently adjudicated correct by verify, with no spec conflict or regression. The change folder has been moved to archive and is ready for delivery.

## Engram Artifacts (Source of Traceability)

All artifacts persisted to Engram during the SDD cycle:

| Artifact | Observation ID | Created | Status |
|----------|---|---|---|
| Proposal | #53 | 2026-09-16 21:09:42 | COMPLETE |
| Spec (Delta) | #54 | 2026-09-16 21:12:13 | COMPLETE |
| Design | #55 | 2026-09-16 21:17:01 | COMPLETE |
| Tasks | #56 | 2026-09-16 21:20:48 | COMPLETE (24/24 checked) |
| Verify-Report | #59 | 2026-09-16 22:09:53 | PASS WITH WARNINGS |

## Artifacts Archived

- **Proposal**: `proposal.md`
- **Design**: `design.md`
- **Tasks**: `tasks.md` (24/24 complete, every [x] checked)
- **Specs**:
  - `specs/saved-queries/spec.md` (new capability)
  - `specs/query-console/spec.md` (delta, merged into existing)
- **Verify Report**: `verify-report.md`

**Archive location**: `openspec/changes/archive/2026-09-16-CH-05-saved-queries/`

## Specs Synced to Main Repository

| Domain | Action | Status |
|--------|--------|--------|
| `saved-queries` | Created | ✓ Copied to `openspec/specs/saved-queries/spec.md` (4 requirements, 11 scenarios) |
| `query-console` | Modified (ADDED 3 requirements) | ✓ Merged to `openspec/specs/query-console/spec.md` (now 6 total requirements, 6 scenarios) |

Both specs are now the source of truth for these capabilities. The saved-queries spec is new and complete; the query-console spec was enriched with three ADDED requirements per DEC-12.

## Task Completion Status

**Total tasks**: 24  
**Complete**: 24  
**Incomplete**: 0  
**Status**: All tasks marked [x], verified complete

All implementation tasks have been completed and committed:
- ✓ Phase 1: Route Module & Wiring (6/6)
- ✓ Phase 2: Integration Tests (10/10)
- ✓ Phase 3: Console UI (5/5)
- ✓ Phase 4: Smoke, Manual & Process (3/3)

## Verification Summary

**Verify Report Verdict**: PASS WITH WARNINGS (per obs #59)

**Metrics**:
- Saved-queries spec: 4/4 requirements, 11/11 scenarios compliant
- Query-console spec (delta): 3/3 ADDED requirements, 3/3 scenarios compliant
- **Total**: 7/7 requirements, 14/14 scenarios compliant
- Tests passed: 84/84 (all CH-03/CH-04/CH-05 live suites)
- Build: `npm run build` exit 0
- Smoke: `npm run smoke` PASSED
- CRITICAL findings: 0
- WARNING findings: 2 (environment limitation, non-blocking)
- SUGGESTION findings: 2

### Warnings (Non-Blocking, Documented)

1. **Console spec scenarios deepest evidence** — Apply-self-reported DOM-shim harness (19/19 checks), not independently reproduced in verify due to browser unavailability; environment limitation disclosed in verify-report.
2. **Bitácora states verify/archive pending** — Informational only; now resolved in this archive.

### Apply-Time Deviations (Adjudicated Correct by Verify)

Per verify-report (obs #59), two implementation deviations from design.md were investigated and both adjudicated as CORRECT with NO SPEC CONFLICT:

**Deviation 1**: `src/conexiones.ts` `camposInvalidos()` field-name fix
- **Why changed**: AJV's `required`/`additionalProperties`/`propertyNames` violations report an empty `instancePath`; the field name lives in `params`. Design assumed non-empty `instancePath`; design was incomplete, not wrong.
- **Evidence**: Re-read `openspec/specs/connection-registration/spec.md` and `openspec/specs/query-execution/spec.md` in full — neither pins the literal `['/']` output. Grepped `src/conexiones.test.ts` and `src/consultas.test.ts` — neither asserts the literal `campos` value (only `length > 0`).
- **Verification**: Independently ran `npm test` confirming 84/84 pass with CH-03 and CH-04 live suites exercising the changed function; zero regressions.
- **Verdict**: Correct. Improves error messages; no regression; non-regressive by test re-run.

**Deviation 2**: `src/consola.ts` literal `</script>` in comment defect
- **What**: A closing script tag inside a JavaScript comment in the HTML template literal ended the `<script>` element, silently breaking the console page despite clean build output.
- **Evidence**: Caught during apply's 19/19 DOM-shim harness; no browser to detect it during development.
- **Fix**: Removed the literal `</script>` sequence; `scripts/smoke.sh` now asserts exactly one closing script tag in the served document.
- **Verification**: Independently ran `npm run smoke` and observed this exact check pass against the live served `/consola` page.
- **Verdict**: Fixed and guarded. Non-regressive by smoke re-run.

## Design Decisions Resolved

Four design-level decisions were made and implemented (carried from proposal.md):

1. **DEC-10** — No update or delete routes; saved queries immutable once created (firm, user-decided 2026-09-16, cited not re-opened)
2. **DEC-11** — No migration; CH-02's schema used as-is; saved queries carry no relation to a specific `Conexion` (firm, cited)
3. **DEC-12** — Console gains save-current-statement, saved list, and load-into-editor (firm, cited)

Plus four additional design-level architecture decisions resolved during design phase:

- **Decision 1**: `/consultas-guardadas` as top-level collection (not nested under `/consultas`)
- **Decision 2**: Route module named `src/consultas-guardadas.ts` (plural, following route-to-collection pattern)
- **Decision 3**: List payload = metadata only, newest-first ordering, hard cap 200 with `truncado` flag
- **Decision 4**: Duplicate `nombre` allowed (consistent with unenforced `Conexion.nombre` precedent); console UI keyed on `id` not name

All decisions match code exactly.

## Implementation Details

### New Files Created
- `src/consultas-guardadas.ts` (176 lines) — Three routes (POST create, GET list, GET by-id), schema, selects, tenant resolution
- `src/consultas-guardadas.test.ts` (597 lines) — 17 integration test cases via `app.inject()` against live Postgres

### Files Modified
- `src/conexiones.ts` — `camposInvalidos()` fix to extract field names from AJV params (impacts CH-03/CH-04 error messages, strictly improved)
- `src/consola.ts` — New `<section id="guardado">` markup, three script functions (`listarGuardadas`, `renderizarGuardadas`, `guardar`, `cargarGuardada`), four CSS rules
- `src/server.ts` — One import + one registration call for the new routes
- `scripts/smoke.sh` — CH-05 end-to-end section (save → list → get → execute), plus guards for empty-list and exactly-one-closing-script-tag
- `docs/bitacora/CH-05-consultas-guardadas.md` — Project log entry

### No Schema Changes
No Prisma migration required. CH-02's `ConsultaGuardada` model used as-is, with no `conexionId`. No new dependencies, no config/env changes, no build changes.

## Testing Coverage

| Layer | Evidence | Status |
|---|---|---|
| Unit / Integration | 17 cases covering all spec scenarios | PASS (84/84 with CH-03/CH-04) |
| Build | `npm run build` | PASS |
| Smoke / E2E | `npm run smoke` all checks green | PASS (including new CH-05 section) |
| Console verification | 19/19 checks via source-extracted inline script on DOM shim | PASS (apply harness re-reported in verify) |
| Manual verification | Save/list/load/execute flow, hostile `nombre` rendering | VERIFIED |

No browser available in test environment; console verification by DOM-shim harness rather than full HTML parse. Disclosed as WARNING (environment limitation, not defect).

## Known Limitations (Documented, Not Prevented)

Stated in design.md and verify-report, resolved as acceptable within R0 scope:

1. Reads not tenant-scoped (T1/T2/T4 deferred to CH-06) — known limit, not regression
2. Past 200 saved queries older rows unreachable; DEC-10 allows no pagination, no delete (revisit CH-25/B4)
3. Wrong name or stale statement cannot be corrected; duplicate allowed (DEC-10 and decision 4)
4. Saved statement may fail against a connection with different schema (DEC-11 constraint, not validated)
5. Duplicate names indistinguishable by name alone; mitigated by rendering `creadaEn` and keying on `id`

## Out of Scope (Unchanged from Proposal)

- Update and delete (DEC-10; B4 versioning → CH-25)
- Binding to a `Conexion` (DEC-11; no schema change)
- B3 parameterized queries (CH-11)
- A2 credential encryption (CH-07)
- T1/T2/T4 tenant CRUD and isolation (CH-06)
- Persisting execution results (gate D-1 stays open)

## Rollback Plan

No migration and no schema change. Rollback is reverting the commit: the new route module and test, the registration line in `src/server.ts`, the `src/consola.ts` edits, the `camposInvalidos()` fix in `src/conexiones.ts`, the smoke section, and the bitácora entry. Rows written for CH-05 would be orphaned but harmless in a table that predates this change; CH-01–CH-04 behavior is untouched.

## Delivery State

The change is complete and ready for delivery. The SDD cycle is closed:

- ✓ Proposal written and cited (obs #53)
- ✓ Specifications written (obs #54 delta → merged specs)
- ✓ Design decisions resolved and implemented (obs #55)
- ✓ Tasks completed and checked (obs #56, 24/24)
- ✓ Implementation verified against specs (obs #59, PASS WITH WARNINGS, 7/7 requirements, 14/14 scenarios)
- ✓ Apply-time deviations adjudicated correct
- ✓ Verify warnings documented (environment-limitation only)
- ✓ Artifacts synced to main repository
- ✓ Change archived with all evidence

## Archive Integrity

**Mechanical copy verification** (per archive contract):
- Saved-queries spec → main specs: EMPTY `diff -r` output (byte-identical)
- Query-console delta → main specs (via `gentle-ai sdd-archive-compose`): Zero exits, merge successful
- Change folder → archive: EMPTY `diff -r` output (byte-identical)
- Active changes directory: Now clean (no CH-05 folder remains)

All copy and move operations used shell commands (`cp -R`, `mv`, `git mv`) with post-operation verification. No file content passed through model Read/Write, ensuring audit trail integrity.

---

**Archived by**: SDD Archive Phase (sdd-archive)  
**Archive date**: 2026-09-16  
**Change status**: CLOSED — ready for next change
