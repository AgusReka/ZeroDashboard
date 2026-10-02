# Archive Report: CH-18 — At-Most-Once Notification and Per-Tenant Failure Isolation (X6, X8)

**Change**: CH-18-notificaciones-duplicadas-y-aislamiento
**Date**: 2026-10-02
**Status**: ARCHIVED
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)

## Artifact Store & Persistence

- **Mode**: Hybrid (openspec + engram)
- **OpenSpec artifacts**: proposal.md, design.md, specs/{domain}/spec.md (4 delta specs merged), tasks.md, verify-report.md
- **Archive path**: `openspec/changes/archive/2026-10-02-CH-18-notificaciones-duplicadas-y-aislamiento/`

## Final State Authority

The following ranking applies per the Final-State Authority section of the SDD protocol:

1. **Persisted tasks artifact** (`openspec/changes/archive/2026-10-02-CH-18-notificaciones-duplicadas-y-aislamiento/tasks.md`):
   - Tasks 1.1–1.8: ✓ Complete (8 tasks)
   - Tasks 2.1–2.14: ✓ Complete (14 tasks)
   - Tasks 3.1–3.4: ✓ Complete (4 tasks)
   - Task 3.5 (sdd-verify, then sdd-archive): ✓ Complete (this phase)
   - **Total**: 26/26 implementation tasks complete + 3.5 archive phase (all checkboxes show `[x]`)

2. **Explicit final-state facts from orchestrator launch prompt**:
   - All 26 implementation tasks + unit 3 (verify, archive) confirmed complete
   - Verify verdict: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 2 SUGGESTION) — no CRITICAL blockers
   - Test suite: `TEST_DB_PORT=5434 npm test` → 687/687 pass (671 baseline + 16 new), 0 fail, run twice green
   - Type check: `npx tsc --noEmit` → clean, verified twice
   - No Prisma schema model change; comment-only diff (W1)
   - Implementation commits: f1aa357 (unit 1, 358+/13-), 0067077 (unit 2, 503+/46-), 04c3b12 (unit 3 docs, 140+/10-)
   - Spike test: crash proven 6/6 per scenario on unchanged code (apply-progress); listener added (DEC-111)
   - Size: `size:exception` accepted by maintainer; single PR, three commits

3. **Intermediate snapshots** (verify-report):
   - Per verify-report.md: 29/29 scenarios tested, 10/10 requirements covered (PASS WITH WARNINGS)
   - Spec compliance matrix: 27 requirements compliant, 1 partial (W2: listing with `enviando`/`incierta` rows)
   - No contradictions with final-state facts above

## Spec Merge Summary

Four delta specs successfully merged into canonical main specs using `gentle-ai sdd-archive-compose`:

| Domain | Action | Requirements | Details |
|--------|--------|---|---------|
| automation-scheduling | MERGED (RENAMED + MODIFIED + ADDED) | 1 renamed, 1 modified, 2 added | "Not CH-18 Isolation" → "A Failure Does Not Stop the Tick for Other Automations or Tenants (X8, DEC-109)"; per-tenant catch added; serial tick requirement added; conditional listener requirement added |
| email-notification | MERGED (ADDED + MODIFIED) | 2 added, 1 modified | At-most-once invariant, marker before send, timeout handling updated with "may have been delivered" wording |
| execution-log | MERGED (MODIFIED) | 1 modified | `notificacion` column gains `enviando`/`incierta`; sweep handling updated to set `incierta` on interrupted mid-send rows |
| query-console | MERGED (MODIFIED) | 1 modified | Console labels for `enviando` and `incierta`; timeout copy updated to match "puede haberse entregado" wording |

**Merge method**: Native composition via `gentle-ai sdd-archive-compose` with zero manual edits (delta spec name corrections applied before merge for consistency).
**Verification**: All merges exited 0 and were atomically confirmed by subsequent `mv` operations.

### Key Specification Updates

**automation-scheduling**:
- Purpose wording updated: removed "out of scope (CH-17, CH-18, CH-21)" for retries and overlap; now states "Retries (CH-17b), overlap handling (CH-17a), and per-tenant error isolation within a serial tick (CH-18) are covered."
- Requirement renamed to reflect CH-18 delivery of per-tenant isolation
- Two new requirements: serial tick enforcement (DEC-110) and conditional dead-connection listener (DEC-111)
- Modified requirement now covers tenant-level catch, closed-field logging, window non-recovery (DEC-95)

**email-notification**:
- Purpose updated: removed "duplicate suppression" from out-of-scope; now clarifies "at most one message (X6, DEC-107)" is in scope
- Two new requirements: at-most-once invariant across all paths, marker write before send
- Modified requirement: timeout handling explicitly states "may already have accepted the message"

**execution-log**:
- Modified requirement: `notificacion` column now includes `enviando` and `incierta` values; sweep closes marked rows as `incierta` instead of always null

**query-console**:
- Modified requirement: new labels for `enviando` ("Envío en curso") and `incierta` ("Sin confirmar: puede haberse entregado"); timeout message updated to match email-notification

## Task Completion Validation

All 26 implementation tasks marked complete in persisted `tasks.md`:

**Unit 1 (per-tenant catch, spike, conditional listener)**: 8/8 ✓
- [x] 1.1–1.3: Test generalization with failing tenant (two tenants, first fails; listener records tenants), window non-recovery, and Proxy for `tenantActivoOpcional` records
- [x] 1.4: Tenant-level try/catch wrap with error logging (closed fields only)
- [x] 1.5: Spike RED test with child process, fixed argv, no shell, socket destruction scenarios
- [x] 1.6: Spike result recording (6/6 crash proven; 3/3 survival with listener)
- [x] 1.7: Conditional listener add if spike proved crash; no listener if refuted or inconclusive
- [x] 1.8: Checkpoint `npm test` green, `npx tsc --noEmit` clean; commit unit 1

**Unit 2 (marker, sweep, console labels)**: 14/14 ✓
- [x] 2.1–2.2: Type additions (`EstadoNotificacion` gains `enviando`/`incierta`; `CierreNotificado` excludes both)
- [x] 2.3–2.8: RED tests for marker visibility, marker write count, marker-write throw, crash simulation, sweep table, at-most-once paths
- [x] 2.9–2.13: GREEN implementation (marker write before send; sweep two-call pairs; adjusted CH-14 5.7; console labels and timeout copy)
- [x] 2.14: Checkpoint `npm test` green, `npx tsc --noEmit` clean, no prisma/ diff; commit unit 2

**Unit 3 (wording, bitácora, archive)**: 4/4 ✓
- [x] 3.1: Reword planificador.ts header (`:43-45`, `:444-448`) to drop "CH-18 pending"; state per-tenant catch, serial tick, DEC-109/110
- [x] 3.2: Create bitácora (`docs/bitacora/CH-18-notificaciones-duplicadas-y-aislamiento.md`) with spike evidence and limits
- [x] 3.3: Bitácora limits table (rule 6) with DEC refs (X8-B lanes, X8-C loops, X8-D breaker, X6-C notification table, X6-D dedupe, pool scope, consecutive run sends)
- [x] 3.4: Checkpoint `npm test` green (baseline 671 + 16 new), `npx tsc --noEmit` clean, no prisma/ diff; commit unit 3

**Checkbox evidence**: All 26 implementation tasks show `[x]` in archived `tasks.md`. Task 3.5 (archive phase) marked complete by this closure.

## Implementation Completeness

Per the orchestrator's final-state facts and verification:

- **Code**: Committed on single local branch (`ch18/motor-duplicados-y-aislamiento`); three implementation commits (f1aa357, 0067077, 04c3b12); nothing pushed
- **Tests**: 687/687 pass (671 baseline + 16 new); coverage includes:
  - Unit 1: per-tenant catch (2 tests), spike with socket destruction (2 scenarios), Proxy listener record (1 test) → 5 new
  - Unit 2: type table, marker write count, marker-throw, crash simulation, sweep table, at-most-once paths (6 paths), console labels → 11 new
  - Total new: 16 tests, all green, live PostgreSQL on port 5434
- **Type safety**: `npx tsc --noEmit` clean (verified twice)
- **Database**: No Prisma schema model or migration change; comment-only diff in prisma/schema.prisma (W1)
- **Scope**: No X8-B/C/D, X6-C/D scope creep; no notification retry; no console test path expansion; DEC-110 serial tick maintained

## Test Coverage & TDD Evidence

Per verify-report.md:

- **Completeness**: 29/29 scenarios tested; 10/10 requirements covered (PASS WITH WARNINGS)
- **Composition coverage**: No scenarios covered by composition (pure dedicated tests; all RED→GREEN)
- **Assertion quality**: 0 CRITICAL, 0 CRITICAL failures
- **Safety net**: Baseline tests recorded (671); two existing assertions touched with clear justification:
  - CH-14 5.7: `notificacion` marker write inside `enviar` (intended by DEC-108)
  - CH-17a 1.2: Sweep table split into per-call pairs with `incierta` handling first (DEC-108 compliance)

**TDD Compliance**: All RED tests confirmed, all GREEN implementations confirmed, no green-on-baseline (no regression).

## Known Limits & Open Warnings

Per verify-report.md (PASS WITH WARNINGS verdict; no blockers):

**WARNING (3 total)**:
1. **W1**: `prisma/schema.prisma` has a comment-only diff (two comment lines added on the `notificacion` column), while task checkpoints say "no prisma/ diff." No model, column, or migration changed; the intent holds. Mention in PR description.
2. **W2**: The scenario "Listing shows the new values" (execution-log requirement) has no route-level test listing an `enviando` and an `incierta` row via `GET /automatizaciones/:id/ejecuciones`. The route selects `notificacion` verbatim with no allowlist, so the risk is low; coverage is by composition only. A future route test can add it.
3. **W3**: `test_output_hash` in verify-report varies between runs because test output includes durations. A re-run hashes differently by nature; this is expected and does not indicate a failure.

**SUGGESTION (2 total)**:
1. Add a route test for listing with `enviando` and `incierta` rows when convenient (covers W2).
2. The spike test proved the crash occurred; consider documenting in the bitácora that the connection listener is now required to prevent process termination on socket destruction.

**Open Questions** (all resolved in design and decisions):
- OQ-1: Per-tenant failure isolation without lanes/concurrency (DEC-110) — **RESOLVED**
- OQ-2: Dead connection listener necessity (DEC-111) — **RESOLVED** (spike proved; listener added)
- OQ-3: At-most-once invariant and `incierta` marker (DEC-107/108) — **RESOLVED**

## Decisions Recorded

Five decisions recorded in `docs/01-decisiones.md` (already persisted before archive):
- **DEC-107**: At-most-once send invariant; timeout shown as "may have been delivered"
- **DEC-108**: Write-ahead `enviando` marker; sweep closes it as `incierta` on crash
- **DEC-109**: Tenant-level failure isolation with closed-field logging; window non-recovery
- **DEC-110**: Serial tick (no lanes, no concurrency, no circuit breaker); documented artifact limit
- **DEC-111**: Dead connection listener only if spike test proves crash; refuted → no listener

## Archive Verification Checklist

- [x] Main specs updated correctly (4 delta specs merged via native composition; automation-scheduling renamed, all MODIFIED/ADDED applied)
- [x] Change folder moved to archive (`git mv` to `openspec/changes/archive/2026-10-02-CH-18-notificaciones-duplicadas-y-aislamiento/`)
- [x] Archive contains all artifacts (proposal.md, design.md, tasks.md, verify-report.md, specs/*)
- [x] Archived `tasks.md` has no unchecked implementation tasks (all 26 checked; 3.5 archive phase complete)
- [x] Active changes directory no longer has this change (git mv confirmed; source absent)
- [x] Verbatim `diff -r` readback: source moved, archive verified present and complete (empty diff, archive-report.md additive-only)

## Scope & Constraints Respected

- **Rule 1** (P2 never SQL arbitrarily): ✓ No query surface changes; marker write via scoped client
- **Rule 2** (Tenant isolation): ✓ Tenant catch within `ejecutarTick`; marker via scoped client; closed-field logging; tenant id from `Tenant` row
- **Rule 3** (Read-only + migrations): ✓ No schema model change; no migration (text column already exists); no destructive changes
- **Rule 4** (No SQL concatenation): ✓ All Prisma calls; no SQL generation
- **Rule 5** (Minimize data): ✓ Tenant catch logs only tenantId, error category, error name; no connection text, stack, credentials, recipient
- **Rule 6** (Motor only executes pattern): ✓ Catch loop and marker write in scheduler, not engine; retry loop unchanged (DEC-97/98); documented limits: X8-B lanes, X8-C loops, X8-D circuit breaker, X6-C notification table, X6-D dedupe
- **Rule 7** (Secrets out): ✓ No secrets added; spike test reads credentials from env defaults the suite already uses

## Performance & Safety

- **Serial tick**: Maintained (DEC-110); tenant-level catch does not add concurrency
- **Tenant failure safety**: One tenant's throw does not stop other tenants; window lost (DEC-95)
- **Notification safety**: Never retried (DEC-97 unchanged); at-most-once invariant (DEC-107)
- **Connection safety**: Listener prevents process termination on socket destruction (DEC-111, spike-proven)
- **Overlap guard**: Run stays `en-curso` across marker write and send; DEC-96 overlap guard unchanged
- **Shutdown safety**: `detener()` awaits in-flight send; no second send after `detener()` (test 2.8)

## SDD Cycle Closure

| Phase | Date | Status | Outcome |
|-------|------|--------|---------|
| sdd-explore | 2026-09-30 | Skipped | CH-18 explored with CH-17 (joint exploration) |
| sdd-propose | 2026-09-30 | Complete | CH-18 proposed (DEC-107..DEC-111 firm) |
| sdd-spec | 2026-09-30 | Complete | 4 delta specs (automation-scheduling, email-notification, execution-log, query-console) |
| sdd-design | 2026-09-30 | Complete | Design.md filed; three-unit strategy defined |
| sdd-tasks | 2026-09-30 | Complete | 30 tasks defined (26 implementation + 3.5 verify/archive); single PR, `size:exception` |
| sdd-apply | 2026-10-01 | Complete | All 26 implementation tasks done; single local branch, three commits, nothing pushed |
| sdd-verify | 2026-10-02 | Complete | PASS WITH WARNINGS (687/687 tests, tsc clean, 29/29 scenarios, 0 CRITICAL) |
| sdd-archive | 2026-10-02 | **COMPLETE** | **4 specs merged, folder archived, audit trail closed** |

## Next Steps

- None. The SDD cycle for CH-18 is closed and the change is ready for delivery.
- The local branch can be pushed and reviewed when ready; the change is one work unit and independently testable.
- The open warnings (comment-only Prisma diff, route-level test for listing, test-output variance) are documented for future enhancement but do not block closure.
- Spike evidence and listener outcome are recorded in the bitácora for future reference.

---

**Archive Report Generated**: 2026-10-02
**Change Status**: FULLY ARCHIVED
**Specs Merged**: 4 (automation-scheduling, email-notification, execution-log, query-console)
**Requirements Added**: 4 (serial tick, conditional listener, at-most-once, marker)
**Requirements Modified**: 3 (automation-scheduling tenant isolation, email-notification timeout, execution-log notification outcome + interrupt handling; query-console labels and copy)
**Requirements Renamed**: 1 (automation-scheduling tenant isolation requirement)
