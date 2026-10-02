# Archive Report: CH-17b — Bounded Connection Retries (X5)

**Change**: CH-17b-reintentos-de-conexion
**Date**: 2026-10-01
**Status**: ARCHIVED
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 4 SUGGESTION)

## Artifact Store & Persistence

- **Mode**: Hybrid (openspec + engram)
- **OpenSpec artifacts**: proposal.md, design.md, specs/{domain}/spec.md (4 delta specs merged), tasks.md, verify-report.md
- **Engram observation IDs** (all required artifacts read):
  - proposal (in proposal.md)
  - spec (in merged specs under openspec/specs)
  - design (in design.md)
  - tasks (in tasks.md, 21/21 complete per persisted artifact)
  - verify-report (in verify-report.md)
- **Archive path**: `openspec/changes/archive/2026-10-01-CH-17b-reintentos-de-conexion/`

## Final State Authority

The following ranking applies per the Final-State Authority section of the SDD protocol:

1. **Persisted tasks artifact** (`openspec/changes/archive/2026-10-01-CH-17b-reintentos-de-conexion/tasks.md`):
   - Tasks 1.1–1.7: ✓ Complete
   - Tasks 2.1–2.7: ✓ Complete
   - Tasks 3.1–3.6: ✓ Complete
   - Task 3.7 (sdd-verify, then sdd-archive): ✓ Complete (this phase)
   - **Total**: 21/21 tasks complete (checkbox validation in archive)

2. **Explicit final-state facts from orchestrator launch prompt**:
   - All 21 tasks complete (task 3.7 = verify phase, now done)
   - Verify verdict: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 4 SUGGESTION) — no CRITICAL blockers
   - Test suite: TEST_DB_PORT=5434 npm test → 671/671 pass, 0 fail
   - Type check: npx tsc --noEmit → clean
   - Prisma: only additive nullable migration `20261001000000_ejecucion_intentos`
   - No source code changes need to be touched (already committed on stacked local branches)
   - Implementation verified and no re-verification needed

3. **Intermediate snapshots** (verify-report, apply-progress):
   - Per verify-report.md: 27/27 scenarios tested, 10/10 requirements covered
   - Per apply-progress.md (implicit via verify-report): TDD evidence recorded, all RED→GREEN cycles complete
   - These are consistent with final-state facts above; no contradictions

## Spec Merge Summary

Four delta specs successfully merged into canonical main specs using `gentle-ai sdd-archive-compose`:

| Domain | Action | Requirements | Details |
|--------|--------|---|---------|
| automation-scheduling | MERGED (ADDED) | 4 new | Retry only transient connection failures; bounded in-run loop with fixed pause; overlap guard covers mid-retry run; stop cancels pending pause |
| execution-log | MERGED (ADDED) | 2 new | Records connection attempts in nullable `intentos` column; exposes `intentos` in listing; last category wins on cap exhaustion |
| project-environment | MERGED (ADDED) | 2 new | Connection retry env vars (`CONNECTION_RETRY_ATTEMPTS`, `CONNECTION_RETRY_PAUSE_MS`); defaults and validation; placeholders in example files |
| query-console | MERGED (MODIFIED) | 1 modified | Console displays attempts (`intentos`), preserving all existing requirements and scenarios; null renders as placeholder, never as text `null` |

- **Total added to main specs**: 9 new requirements (automation-scheduling: 4, execution-log: 2, project-environment: 2)
- **Total modified**: 1 requirement (query-console: Console Displays an Automation's Runs, now includes `intentos`)
- **Merge method**: Native composition via `gentle-ai sdd-archive-compose` with zero manual edits
- **Verification**: All merges exited 0 and were atomically confirmed by subsequent `mv` operations

## Task Completion Validation

All implementation tasks marked complete in persisted `tasks.md`:

**Slice 1 (config, env, migration, pure rule)**: 7/7 ✓
- [x] 1.1–1.2: `esFalloReintentable` predicate and truth table
- [x] 1.3–1.4: Config constants and parsing (`enteroEnRangoOpcional`, `connectionRetryAttempts`, `connectionRetryPauseMs`)
- [x] 1.5: `.env.example` and `docker-compose.yml` placeholders
- [x] 1.6: Schema and additive migration (`intentos Int?`)
- [x] 1.7: Checkpoint (full suite, tsc clean)

**Slice 2 (retry loop, wiring, tests)**: 7/7 ✓
- [x] 2.1–2.4: Planner tests (no retry, cap, transient-then-ok, pause timing, stop during pause, overlap, sentinel shapes)
- [x] 2.5: `PoliticaReintentos`, `pausar()`, `conectarConReintentos()`, `cancelarPausa()`, sentinels
- [x] 2.6: Server wiring
- [x] 2.7: Checkpoint (full suite, tsc clean, existing scheduler tests unmodified)

**Slice 3 (listing, console, bitácora)**: 7/7 ✓
- [x] 3.1–3.4: Listing and console column (`intentos` exposed, rendered as placeholder when null)
- [x] 3.5: Bitácora creation (`docs/bitacora/CH-17b-reintentos-de-conexion.md`)
- [x] 3.6: Checkpoint (full suite, tsc clean, no Prisma changes)
- [x] 3.7: Archive phase (this closure)

**Checkbox evidence**: All 21 implementation tasks show `[x]` in archived `tasks.md`.

## Implementation Completeness

Per the orchestrator's final-state facts and verification:

- **Code**: Committed on stacked local branches (`ch17b/1-artefactos`, `ch17b/2-config-y-regla`, `ch17b/3-bucle-y-cableado`, `ch17b/4-apagado-y-cableado`, `ch17b/5-listado-consola-bitacora`); nothing pushed
- **Tests**: 671/671 pass; coverage includes:
  - Unit: pure rule, config, fake DOM (~16 tests)
  - Integration: live PostgreSQL, fake Reloj, real sockets (~8 tests)
  - E2E: not installed (out of scope)
- **Type safety**: `npx tsc --noEmit` clean
- **Database**: Additive nullable migration in sync with schema; no destructive changes
- **Scope**: No X6/X8/CH-19 scope creep, no notification retry, no console test path expansion

## Test Coverage & TDD Evidence

Per verify-report.md:

- **Completeness**: 27/27 scenarios have runtime or reading evidence; 10/10 requirements covered
- **Composition coverage**: 4 scenarios use composition (dns-no-resuelve rule, non-retryable exhaustive list, cap-3 path split, attempts=1 disable), all acceptable per DEC-106
- **Assertion quality**: 0 CRITICAL, 0 WARNING (no tautologies, no ghost loops)
- **Safety net**: Baseline tests recorded (71/71, 26/26, 36/36); two existing assertions touched with justification (column allowlist, console full-row trailing placeholder)

**TDD Compliance**: 6/6 checks passed

## Known Limits & Open Warnings

Per verify-report.md (PASS WITH WARNINGS verdict; no blockers):

**WARNING (3 total)**:
1. Four scenarios covered by composition rather than dedicated end-to-end: dns-no-resuelve retry (rule truth table only per DEC-106), non-retryable categories, cap-3 path, attempts=1 disable config
2. Console `Intentos` column verified on fake DOM only; manual browser pass pending
3. Server.ts retry wiring has no runtime test (one-line, values validated by config tests)

**SUGGESTION (4 total)**:
1. Add planner test with policy of 1 attempt, 5000 ms pause and transient failure to cover attempts=1 directly
2. Align `openspec/config.yaml` (`strict_tdd: false`) with real strict-TDD workflow
3. Complete bitácora time-spent section before citing in thesis
4. If 200 ms real-socket tests ever flake, widen timeout or inject per test

**Open Questions** (all resolved in design and decisions):
- OQ-1: `intentos` exposed in API and console (per DEC-106) — **RESOLVED**
- OQ-2: `detener()` during pause cancels and closes mid-retry (per DEC-104, DEC-106) — **RESOLVED**
- OQ-3: Design resolutions recorded as DEC-103–DEC-106 in `docs/01-decisiones.md` — **RESOLVED**

## Decisions Recorded

Five decisions recorded in `docs/01-decisiones.md` (already persisted before archive):
- **DEC-97**: Retry only transient connection categories (connection phase + 3 specific errors)
- **DEC-98**: In-run loop with fixed pause, injected clock, default off
- **DEC-103**: `intentos` nullable; null = never dialled or legacy row
- **DEC-104**: `detener()` cancels pending pause, no further attempts
- **DEC-105**: Env vars, validation, fail at boot
- **DEC-106**: Injected policy relaxation for DNS examples (composition coverage); stop scope clarified

## Archive Verification Checklist

- [x] Main specs updated correctly (4 delta specs merged via native composition)
- [x] Change folder moved to archive (`openspec/changes/archive/2026-10-01-CH-17b-reintentos-de-conexion/`)
- [x] Archive contains all artifacts (proposal.md, design.md, tasks.md, verify-report.md, apply-progress.md, specs/*)
- [x] Archived `tasks.md` has no unchecked implementation tasks (all 21 checked)
- [x] Active changes directory no longer has this change (git mv confirmed)
- [x] Verbatim `diff -r` readback: source moved, archive verified present and complete

## Scope & Constraints Respected

- **Rule 1** (P2 never SQL arbitrarily): ✓ No query surface changes
- **Rule 2** (Tenant isolation): ✓ Retry loop scoped within run; no tenant boundary changes
- **Rule 3** (Read-only + migrations): ✓ Only additive nullable column; no destructive migrations
- **Rule 4** (No SQL concatenation): ✓ No new SQL generation
- **Rule 5** (Minimize data)**  ✓ Logs carry `automatizacionId`, `intentos`, category only (per verify-report)
- **Rule 6** (Motor only executes pattern): ✓ Retry loop in scheduler, not engine
- **Rule 7** (Secrets out): ✓ `.env.example` and Compose hold empty placeholders only

## Performance & Safety

- **Serial tick blocking**: Up to ~25 s during max-retry pause (documented in bitácora, CH-18 parallelism out of scope)
- **Notification safety**: Never retried; send failure stays one attempt, one call
- **Overlap guard**: Run stays `en-curso` across retries, so DEC-96 overlap guard still applies
- **Shutdown safety**: `detener()` cancels pending pause, closes row with attempts reached, no wait

## SDD Cycle Closure

| Phase | Date | Status | Outcome |
|-------|------|--------|---------|
| sdd-explore | 2026-09-30 | Complete | CH-17 explored, archived with CH-17a |
| sdd-propose | 2026-09-30 | Complete | CH-17b proposed (DEC-97, DEC-98) |
| sdd-spec | 2026-09-30 | Complete | 4 delta specs (automation-scheduling, execution-log, project-environment, query-console) |
| sdd-design | 2026-09-30 | Complete | Design.md filed; slice strategy defined (split slice 2 into 2a/2b for 400-line budget) |
| sdd-tasks | 2026-09-30 | Complete | 21 tasks defined, 3 work units (chained PRs, stacked-to-main) |
| sdd-apply | 2026-10-01 | Complete | All 20 implementation tasks done; stacked local branches, nothing pushed |
| sdd-verify | 2026-10-01 | Complete | PASS WITH WARNINGS (671/671 tests, tsc clean, 27/27 scenarios, 0 CRITICAL) |
| sdd-archive | 2026-10-01 | **COMPLETE** | **4 specs merged, folder archived, audit trail closed** |

## Next Steps

- None. The SDD cycle for CH-17b is closed and the change is ready for delivery.
- The stacked local branches can be pushed and reviewed when ready; each slice is independently testable and rollback-safe.
- The open warnings (composition coverage, fake DOM verification, server wiring test) are documented for future enhancement but do not block closure.

---

**Archive Report Generated**: 2026-10-01
**Change Status**: FULLY ARCHIVED
