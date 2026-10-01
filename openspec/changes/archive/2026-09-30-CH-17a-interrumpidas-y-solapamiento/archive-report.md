# Archive Report: CH-17a — Interrupted Runs and Overlap

**Change**: CH-17a-interrumpidas-y-solapamiento  
**Archived**: 2026-09-30  
**Archive Location**: `openspec/changes/archive/2026-09-30-CH-17a-interrumpidas-y-solapamiento/`  
**Artifact Store Mode**: hybrid (openspec + engram)

---

## Final State

### Completion Status

**All 17 tasks complete.** Per the orchestrator's final-state facts, task 2.8 ("Run sdd-verify, then sdd-archive") is now done (it is this phase). The persisted `tasks.md` artifact shows 16/17 marked complete (1.1-1.9, 2.1-2.7); task 2.8 remains unchecked in the artifact because it is a meta-task describing the verification and archive phases themselves, not a code or test task. The final-state authority confirms all implementation work is complete.

**Verification Verdict**: PASS WITH WARNINGS

```
Verdict: pass_with_warnings
Blockers: 0 CRITICAL
Findings: 2 WARNING, 4 SUGGESTION
Evidence Revision: sha256:28ab6227213ea0d78d8691114954b8246777352a894b7eae019d091555aee5b1
```

Per `verify-report.md` (CH-17a verification phase):
- Tests: 648/648 pass
- Build: `npx tsc --noEmit` exit 0 (clean)
- Requirements: 12/12 with passing scenario coverage
- Scenarios: 29/29 (27 COMPLIANT, 2 PARTIAL with passing parts, 0 UNTESTED)
- Prisma: No migration, no new dependencies

**Artifact Completeness**: proposal.md, specs (4 delta files), design.md, tasks.md, apply-progress.md, verify-report.md — all present.

---

## Specs Synced to Main Repository

All four delta specs have been composed into their main spec targets using `gentle-ai sdd-archive-compose`. Composition succeeds means:
- Each delta requirement is correctly named and traceable
- No duplicate ADDED requirement names
- RENAMED sections (if any) visible before MODIFIED before REMOVED
- All unrelated requirements in the main spec preserved byte-for-byte

| Domain | Action | Delta Contents | Merged Into |
|--------|--------|-----------------|-------------|
| execution-log | COMPOSED | Added: "Estado Set Includes omitida", "Interrupted Runs Are Closed"; Modified: "Every Run Outcome Writes an Ejecucion", "Error Field Classified" | `openspec/specs/execution-log/spec.md` |
| automation-scheduling | COMPOSED | Added: "Overlap Check Before Creating a Run", "Boot Sweep Runs Before the First Tick", "Signals Close the Application Gracefully", "Missed Fires Are Not Recovered"; Modified: (none listed as modified in delta) | `openspec/specs/automation-scheduling/spec.md` |
| tenant-isolation | COMPOSED | Added: "Boot Sweep Enters Each Tenant Context", "Overlap Lookup Is Tenant-Scoped" | `openspec/specs/tenant-isolation/spec.md` |
| query-console | COMPOSED | Added: "Runs View Shows Readable Messages for solapamiento and interrumpida" | `openspec/specs/query-console/spec.md` |

---

## Archive Contents

Change folder moved to `openspec/changes/archive/2026-09-30-CH-17a-interrumpidas-y-solapamiento/`:

- proposal.md ✅ (ready for spec and design)
- explore.md ✅ (context)
- specs/ ✅ (4 delta files, all composed into main specs)
  - execution-log/spec.md
  - automation-scheduling/spec.md
  - tenant-isolation/spec.md
  - query-console/spec.md
- design.md ✅ (5 decisions + 2 accepted deviations)
- tasks.md ✅ (16/17 complete; 1/17 is this archive phase)
- apply-progress.md ✅ (stacked PRs, commit log, TDD cycle evidence)
- verify-report.md ✅ (PASS WITH WARNINGS; 0 CRITICAL)

Archived `tasks.md` contains no unchecked implementation tasks (1.1–1.9, 2.1–2.7 all marked complete). Task 2.8 (verify/archive) is a meta-task and remains unchecked in the artifact by design.

---

## Implementation Summary

**Branch**: `ch17a/2-solapamiento-y-consola` at `f8d6949` (working tree clean, unrelated empty file `run` ignored)

**Stacked commits across 4 branches** (as recorded in apply-progress.md):
1. `ch17a/0-artefactos`: SDD artifacts + DEC-102 decision registration
2. `ch17a/1a-barrido-al-arrancar`: Boot sweep, 269 src lines
3. `ch17a/1b-apagado-ordenado`: Graceful shutdown (SIGTERM/SIGINT), 182 src lines
4. `ch17a/2-solapamiento-y-consola`: Overlap guard + console messages + bitácora, 184 code+test lines

**Total altered**: ~635 src lines across src/planificador.ts, src/apagado.ts, src/server.ts, src/consola.ts, src/contexto-tenant.ts, src/automatizaciones.ts, plus test files and documentation.

**Test suite**: `TEST_DB_PORT=5434 npm test` → 648/648 pass (live PostgreSQL integration tests included)

**Decisions registered**: DEC-95, DEC-96, DEC-99, DEC-100, DEC-102 (in `docs/01-decisiones.md`)  
Note: DEC-97, DEC-98 belong to CH-17b (retry logic), which is NOT complete.

---

## Open Warnings and Carry-Forward Notes

Carried from verify-report.md (2 WARNING, 4 SUGGESTION) with verification PASS status:

**WARNING (0 blocker, 2 informational)**:

1. **Scenario "New values appear in the runs listing" has no route-level test**  
   - No test calls `GET /automatizaciones/:id/ejecuciones` with an `omitida`/`solapamiento` + `fallo`/`interrumpida` row together  
   - Route is a pass-through `select` with no value filtering  
   - Risk: low (both states covered separately: planner persistence + console rendering)  
   - Status: PARTIAL (both parts tested, route itself unexercised)

2. **Console rows verified only on fake DOM, not real browser**  
   - Rows for `Omitida`, overlap message, interruption message, and `null` placeholders  
   - Verified in project's fake DOM (node:test)  
   - Manual real-browser pass still pending  
   - Status: unverified visually but logically sound

**SUGGESTION (0 blocking, 4 follow-up)**:

1. "Downtime leaves no catch-up" covered by 4.1 window test; consider adding a single sweep-then-tick test for deactivated tenants  
2. Signal wiring in `server.ts` verified statically; `server.test.ts` has no signal send test (only unit tests with EventEmitter)  
3. `openspec/config.yaml` still says `strict_tdd: false` — align it with the real strict-TDD workflow  
4. **Task 2.6 cites `docs/bitacora/_plantilla.md` which does not exist** — reference should point to an existing template or remove the citation  
   - Bitácora time-spent line needs the real perceived time before use in thesis

---

## Decisions Referenced

All decisions registered in `docs/01-decisiones.md` before archive:

| ID | Title | Status | Scope |
|----|----|--------|-------|
| DEC-95 | Artifact Limit: No Catch-Up | Closed | Comments corrected; limit documented in bitácora |
| DEC-96 | Overlap Detection via DB Query | Closed | `omitida` one row per tick; `error='solapamiento'` |
| DEC-99 | Boot Sweep All Tenants, Fail-Open | Closed | Runs before first tick; includes deactivated tenants; documented |
| DEC-100 | Signal Handlers Close Gracefully | Closed | SIGTERM/SIGINT trigger app.close() → detener() |
| DEC-102 | Adopting Two Stacked PRs (DEC-101) | Closed | Slice 1 (sweep, signals); Slice 2 (overlap, console) |

**Deviations** (both accepted during verify):
- Deviation 2: also nulls `corte`/`codigoError` in overlap row (harmless, no prior data)
- Deviation 5: overlap check runs for `previo` failure too (correct per "first in correr()" spec)

---

## Compliance and Scope Integrity

| Check | Result | Notes |
|-------|--------|-------|
| AGENTS.md rules 1–7 respected | ✅ | No P2 SQL arbitration, tenant ids scoped, read-only in two layers, no concatenation, minimal data export, no engine expansion, no secrets |
| Scope creep (X5 retry, CH-18, CH-19) | ✅ None | No retry logic; comments record that CH-17b owns it |
| Migration | ✅ None | `prisma/` untouched; `estado` and `error` are free TEXT |
| Raw SQL | ✅ None | All Prisma API only; `conTenantActivo` structural extension used throughout |
| Comment attribution | ✅ Fixed | DEC-95 comments corrected; no remaining CH-17 catch-up attribution in `src/` |

---

## Verification Compliance Matrix (Summary)

**27/29 scenarios COMPLIANT, 2 PARTIAL (both with passing runtime coverage of their parts)**

- Boot Sweep: 4 scenarios ✅ (sweep completes before tick, fail-open, no re-execution, stuck row not reaped)
- Overlap Check: 4 scenarios ✅ (stuck automation skipped, per-automation, per-tenant, lookup failure doesn't stop tick)
- Signals: 1 scenario ✅ (SIGTERM/SIGINT close gracefully)
- No Catch-Up: 1 scenario ✅ (downtime leaves no catch-up)
- Single-Instance: 1 scenario ✅ (limit documented)
- Estado Set: 2 scenarios ✅ (omitida recorded, closed rows untouched)
- Interrupted Runs: 2 scenarios ✅ (swept shape, closed rows untouched)
- Every Run Outcome: 3 scenarios ✅ (validation-gate refusal, execution failure, overlap writes one per tick)
- Error Field: 3 scenarios ✅ (sanitized, closed category, new values render)
- Runs View Messages: 3 scenarios ⚠️ (overlap legible, interruption legible, unknown values render) — console fake-DOM verified, real-browser pending
- Tenant Context: 4 scenarios ✅ (active + deactivated swept, limited to own rows, deactivated automations don't run, outside context fails)
- Overlap Tenant Scope: 1 scenario ✅ (cross-tenant rows invisible)

---

## Artifact Traceability

**Observation IDs** (engram mode): Not recorded here because artifact store is hybrid and main storage is openspec filesystem.

**File Chain**:
- Proposal → Spec (4 delta files) → Design (5 decisions) → Tasks (17) → Apply (4 commits) → Verify (PASS WITH WARNINGS) → Archive (this file)

**Immutable Revision**:
- Evidence Revision (verify): `sha256:28ab6227213ea0d78d8691114954b8246777352a894b7eae019d091555aee5b1`  
- Candidate Commit: `f8d6949` (full hash: `f8d6949...`)  
- Branch: `ch17a/2-solapamiento-y-consola`

---

## Archive Integrity

✅ **Change folder moved** from `openspec/changes/CH-17a-interrumpidas-y-solapamiento/` to `openspec/changes/archive/2026-09-30-CH-17a-interrumpidas-y-solapamiento/`  
✅ **Source folder removed** (no longer in active changes)  
✅ **Specs composed** into main repository specs (4 domains)  
✅ **Diff verification** passed (archive byte-identical to pre-move snapshot)  
✅ **Archive report** created and persisted

The SDD cycle for this change is **COMPLETE**. Ready for the next change.

---

## Change Closed

This change has been fully planned, implemented, verified, and archived. No further action is required for CH-17a. The next change in the sequence (`docs/02-mapa-de-changes.md`) may now be selected.

**Archive Date**: 2026-09-30  
**Archive Executor**: sdd-archive  
**Final Verdict**: PASS WITH WARNINGS (carry-forward: 2 informational warnings, 4 suggestions for follow-up; 0 CRITICAL blockers; ready for next phase or release)
