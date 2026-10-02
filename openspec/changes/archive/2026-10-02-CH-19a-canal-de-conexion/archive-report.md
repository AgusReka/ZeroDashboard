# Archive Report: CH-19a — Connection Channel Seam and Protocol Types

**Date**: 2026-10-02  
**Change**: CH-19a-canal-de-conexion  
**Status**: Archived — PASS WITH WARNINGS  
**Artifact Store**: openspec

## Executive Summary

CH-19a implements the connection channel seam and protocol type catalog for the agent's outbound database routing. All implementation and verification tasks completed. Commit steps (1.4, 2.7, 3.4, 4.5) deferred to the orchestrator per launch instructions. Budget checkpoint (4.4) resolved by `size:exception` accepted by the author. Archive proceeds with resolved warnings.

## Final State Authority

This report reflects the state of the change AT CLOSE, after implementation, verification, and archive phase review. When intermediate `verify-report` and `apply-progress` snapshots claim pending or blocked states, and a higher-ranked source (persisted tasks, launch instructions, repository evidence) confirms completion, the higher-ranked state is authoritative here.

**Ranking (highest to lowest)**:
1. Persisted tasks artifact (`tasks.md`)
2. Launch instructions explicit facts
3. Verify-report and apply-progress (intermediate snapshots)

## Task Completion Status

**Persisted tasks**: 21 total, **21 complete**, 0 pending
- Unit 1 (Protocol Types): tasks 1.1–1.4 ✅ complete
  - 1.4 (commit step) marked complete; creation deferred to orchestrator
- Unit 2 (Seam and Spike): tasks 2.1–2.7 ✅ complete
  - 2.7 (commit step) marked complete; creation deferred to orchestrator
- Unit 3 (Threading): tasks 3.1–3.4 ✅ complete
  - 3.4 (commit step) marked complete; creation deferred to orchestrator
- Unit 4 (Dropped Channel): tasks 4.1–4.6 ✅ complete
  - 4.4 (budget checkpoint): resolved by `size:exception` accepted 2026-10-02
  - 4.5 (final checkpoint): verified green; commit step deferred to orchestrator
  - 4.6 (archive): this step

**Task reconciliation note**: tasks.md updated at archive time to mark 4.4, 4.5, and 4.6 as complete, with note that commit steps are deferred. Per launch instructions: this is intentional and expected.

## Verification Summary

**Source**: `verify-report.md` generated during sdd-verify phase

| Metric | Result |
|--------|--------|
| Build status | PASS |
| Test suite | 702/702 PASS (baseline 687 + new 15) |
| Type check | PASS (`npx tsc --noEmit` clean) |
| Requirements verified | 5/5 |
| Scenarios executed | 14/14 |
| Critical findings | 0 |
| Blockers | 0 |
| Overall verdict | PASS WITH WARNINGS |

**Test Environment**: TEST_DB_PORT=5434, PostgreSQL reachable on localhost  
**Compliance**: 13/14 fully compliant, 1 partial (helper-level test; inspected at caller level)

### Warnings Resolved

Per verify-report and launch instructions:

1. **Task checkboxes (4.4, 4.5, 4.6) unchecked**: RESOLVED
   - 4.4: budget overage (547 lines) resolved by `size:exception` accepted by author 2026-10-02; marked complete in updated tasks.md
   - 4.5: checkpoint work (tests green, tsc clean) verified; commit step deferred; marked complete
   - 4.6: archive proceeding; marked complete
   
2. **Commit steps not yet created**: EXPECTED
   - Tasks 1.4, 2.7, 3.4, 4.5 are marked complete in tasks.md with note: "commit step deferred to orchestrator"
   - This is per launch instruction: "note commit steps (1.4, 2.7, 3.4, 4.5) are deferred to the orchestrator"
   
3. **Scenario "Caller passes the channel through" proven at helper level only**: ACCEPTED
   - Per verify-report: helper tested (H1); four callers verified by inspection (all spread `camposDeDestino`)
   - Risk noted; optional follow-up suggested for later slice (19c1/19d)

4. **Empty directory `prisma;C:` exists**: PRE-EXISTING, NOT FROM THIS CHANGE
   - Per verify-report: "dated Sep 15, untracked, pre-existing"
   - Not touched by archive

## Specifications Merged

### Agent-Channel Specification (NEW)

**File**: `openspec/specs/agent-channel/spec.md`  
**Action**: Created (copy from delta spec)  
**Requirements**: 4
- Protocol Type Catalog Is Limited to Fixed Decisions
- Channel Is Optional on the Connection Destination
- Channel Is Threaded Through Callers Without Inspection
- Channel Failure Modes Are Bounded

**Scenarios**: 9 (4 subsections, 9 total scenarios across all requirements)

**Evidence**: Mechanical copy; verified byte-identical via diff.

### Query-Execution Specification (EXISTING — ADDED requirement)

**File**: `openspec/specs/query-execution/spec.md`  
**Action**: Updated via `gentle-ai sdd-archive-compose`  
**Change**: ADDED 1 requirement with 5 scenarios

**New Requirement**: A Session Over an Injected Channel Keeps Every Execution Guarantee
- Covers row return, write blocking, multi-statement rejection, data-modifying statement rejection, and prior behavior preservation

**Scenarios added**: 5
- Rows returned over a channel (Q1)
- Write-privileged role blocked (Q2)
- Data-modifying statement rejected (Q3)
- Multi-statement rejected (Q4)
- Absent channel preserves prior behavior (coverage)

**Composition command**: `gentle-ai sdd-archive-compose --canonical openspec/specs/query-execution/spec.md --delta openspec/changes/CH-19a-canal-de-conexion/specs/query-execution/spec.md --output openspec/specs/query-execution/spec.md.compose-tmp && mv ...`  
**Status**: EXIT 0 (successful merge)  
**Evidence**: Mechanical composition; atomic write via `mv`.

## Implementation Details

### New Files
- `src/agente-protocolo.ts` (types only, 40 lines)
- `src/agente-protocolo.test.ts` (25 lines)
- `src/db-probe-canal.test.ts` (spike suite, 200 lines)

### Modified Files
- `src/db-probe.ts`: channel types and seam branch (35 lines added)
- `src/conexion-destino.ts`: helper function (14 lines added)
- `src/conexiones.ts:226`, `consultas.ts:116`, `plantilla-prueba.ts:103`, `planificador.ts:256`: threading updates
- `src/conexion-destino.test.ts`: helper test

### Not Touched
- `prisma/` directory (no schema change)
- `package.json`, `package-lock.json` (no dependencies)
- `.env.example` (no env vars)
- `docs/01-decisiones.md` (DEC-112..DEC-120 pre-registered)

## Coherence & AGENTS.md Rules

**Rule compliance verified**:
1. ✅ Rule 1 (no arbitrary SQL from P2): unaffected
2. ✅ Rule 2 (tenant isolation): session-open type has no tenant; isolation preserved
3. ✅ Rule 3 (read-only, two layers): held over channel (Q2, Q3 confirm)
4. ✅ Rule 4 (no SQL concatenation): no SQL touched
5. ✅ Rule 5 (data minimization): seam does not log/buffer; D2 confirms password absent
6. ✅ Rule 6 (engine runs only pattern): injection seam unused in production
7. ✅ Rule 7 (secrets out of repo): no secrets added

**Architecture decisions**: DEC-112, DEC-113, DEC-114, DEC-115 (point open), DEC-117, DEC-118, DEC-119, DEC-120  
- All registered before change
- No new decisions required

**No production code sets `canal`**: grep of `src/` confirms

## Archive Folder Structure

**Location**: `openspec/changes/archive/2026-10-02-CH-19a-canal-de-conexion/`

**Contents**:
- `proposal.md` ✅
- `design.md` ✅
- `specs/agent-channel/spec.md` ✅
- `specs/query-execution/spec.md` ✅
- `tasks.md` ✅ (updated with complete checkboxes and deferral note)
- `verify-report.md` ✅
- `apply-progress.md` ✅

**Not archived**: CH-19-conectividad-definitiva/ remains in place (umbrella for CH-19b–19e per launch instructions)

## Diff Verification

**Mechanical copy/move verification** (mandatory per skill):

**Agent-channel spec copy**:
```
[no output = files identical]
```

**Query-execution spec composition**:
```
[composed via gentle-ai sdd-archive-compose; exit 0]
```

**Folder move**:
```
[snapshot created, git mv attempted, fallback mv used, source absent, readback: no differences]
```

All mechanical operations passed structural readback; no truncation or alteration detected.

## Risks & Open Items

### Resolved Warnings
- ✅ 4.4 budget overage: resolved by `size:exception`
- ✅ Unchecked tasks: marked complete with audit note
- ✅ Commit steps: marked deferred in tasks.md

### Remaining Notes
- Optional follow-up (non-blocking): add caller-level test for channel pass-through when 19c1/19d wires production channel (suggested in verify-report)
- Empty directory `prisma;C:` remains (pre-existing, unrelated; cleanup is optional)

### No Critical Blockers
The change is archived at the close of a PASS WITH WARNINGS verdict. All critical findings are 0. Archive proceeds.

## Audit Trail

- **Proposal**: Ready for spec and design; inputs DEC-112..DEC-120 (firm, 2026-10-02)
- **Design**: Approved; covers all three units and spike strategy
- **Implementation**: 547 changed lines; size:exception accepted 2026-10-02
- **Verification**: PASS WITH WARNINGS; 702 tests green; 5 requirements, 14 scenarios; critical findings 0
- **Archive**: Tasks complete; specs merged; folder moved; report created

## Change Metadata

| Key | Value |
|-----|-------|
| Change ID | CH-19a-canal-de-conexion |
| Umbrella | CH-19-conectividad-definitiva (CH-19a is slice 1 of C1) |
| Slice | C1 (agent outbound routing context 1) |
| Closed | 2026-10-02 |
| Artifacts | proposal.md, design.md, specs/ (agent-channel, query-execution), tasks.md, verify-report.md |
| Commits deferred | 1.4, 2.7, 3.4, 4.5 (4 checkpoint commits) |

---

**End of Archive Report**

This change is now closed. All artifacts are in `openspec/changes/archive/2026-10-02-CH-19a-canal-de-conexion/`. The main specs have been updated: `openspec/specs/agent-channel/spec.md` (new) and `openspec/specs/query-execution/spec.md` (enhanced). The SDD cycle is complete.
