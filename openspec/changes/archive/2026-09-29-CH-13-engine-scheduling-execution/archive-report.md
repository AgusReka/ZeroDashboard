# Archive Report: CH-13 — Engine: Scheduling and Execution

**Change**: CH-13-engine-scheduling-execution  
**Date Archived**: 2026-09-29  
**Status**: COMPLETE — PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)  
**Branch**: ch13/7-verify-archivo (HEAD fd77c56)  
**Repo**: ZeroDashboard

## Executive Summary

CH-13 implements the unattended automation scheduling and execution engine: tenant-scoped automatizaciones bound to plantillas, connections, parameter values, and cron schedules; an in-process scheduler that fires due, active automations for active tenants only; full execution log (`Ejecucion`) with closed error categories; and console UI to create, list, deactivate, and view runs.

All 46 implementation tasks (Phases 1–6, 7 verification/archive steps) are complete. Verification passed with warnings; no CRITICAL findings block delivery. The change folder has been merged into the main specs and archived.

## Artifacts Merged

All delta specs from `openspec/changes/CH-13-engine-scheduling-execution/specs/` have been merged into the main specifications:

### New Specifications Created
| Spec | Location | Source |
|------|----------|--------|
| Automation Scheduling | `openspec/specs/automation-scheduling/spec.md` | Created from delta (mechanical copy) |
| Execution Log | `openspec/specs/execution-log/spec.md` | Created from delta (mechanical copy) |

### Modified Specifications Updated
| Spec | Location | Source | Changes |
|------|----------|--------|---------|
| Domain Data Model | `openspec/specs/domain-data-model/spec.md` | Merged via sdd-archive-compose | Added MAY for `Automatizacion` and `Ejecucion` tables; `Usuario` remains forbidden |
| Tenant Isolation | `openspec/specs/tenant-isolation/spec.md` | Merged via sdd-archive-compose | Added scheduler-context isolation requirement (ADDED section) |
| Project Environment | `openspec/specs/project-environment/spec.md` | Merged via sdd-archive-compose | Added global timezone configuration (ZONA_HORARIA_AUTOMATIZACIONES) |
| Query Console | `openspec/specs/query-console/spec.md` | Merged via sdd-archive-compose | Extended with Automatizaciones section for create, list, deactivate, and runs views |

## Implementation Completion

| Phase | Goal | Status | Completion |
|-------|------|--------|-----------|
| 1 | Schema, isolation, config, dependency (`cron-parser` 5.10.1) | ✅ COMPLETE | [x] 1.1–1.9 |
| 2a | Pure `automatizaciones.ts`: cron validity and due-window | ✅ COMPLETE | [x] 2.1–2.5 |
| 2b | Pure `automatizaciones.ts`: close-of-run mapping | ✅ COMPLETE | [x] 2.1–2.5 |
| 3a | Create route + server registration | ✅ COMPLETE | [x] 3.1–3.8 |
| 3b | List, get, desactivar routes | ✅ COMPLETE | [x] 3.1–3.8 |
| 4a | Scheduler loop core (tick, due-check, tenant isolation) | ✅ COMPLETE | [x] 4.1–4.4 |
| 4b | Failure isolation, Ejecucion writes, server wiring | ✅ COMPLETE | [x] 4.5–4.11 |
| 5 | Runs route + T2 sweep | ✅ COMPLETE | [x] 5.1–5.4 |
| 6a | Console list, deactivate, runs, tenant switch | ✅ COMPLETE | [x] 6.1–6.6 |
| 6b | Console create form | ✅ COMPLETE | [x] 6.1–6.6 |

**Total Implementation Tasks**: 43/43 complete  
**Verification/Archive Tasks**: 7.1–7.3 (Phase 7, non-implementation)

## Verification Results

**Source**: `verify-report.md` (fd77c56), verified PASS WITH WARNINGS

### Metrics
- **Tests**: 536/536 passed (two independent runs)
- **Typecheck**: `npx tsc --noEmit` — clean
- **Build**: `npm run build` — clean
- **Schema**: `npx prisma validate` — valid
- **Requirements**: 23/23 fully defined
- **Scenarios**: 36/36 tested; 34/36 fully compliant, 2/36 partial (non-blocking static inspection)

### Compliance
- **CRITICAL findings**: 0
- **WARNING findings**: 3 (non-blocking, project-convention consistent)
  - WARNING-1: Server-boot integration test gap (pre-existing project-wide pattern, unit tests cover wiring)
  - WARNING-2: .env.example content test gap (pre-existing project-wide pattern, manually verified)
  - WARNING-3: Console cron error-message branch gap (known follow-up, general scenario covered)
- **SUGGESTION findings**: 2 (usability/hardening, no defect)
  - SUGGESTION-1: Console connection field as free-text id (documented deviation, in-scope respect)
  - SUGGESTION-2: Follow-up hardening tests recommended for CH-17

### Non-Negotiable Rules (AGENTS.md)
All 7 rules hold:
1. ✅ P2 never executes arbitrary SQL — no query editor, runs reuse CH-12 composition pipeline
2. ✅ Tenant isolation, tenant id never from the request — header-based, MODELOS_AISLADOS updated
3. ✅ Read-only, two layers — reuses ejecutarConsulta pipeline and read-only DB role
4. ✅ No SQL concatenation — prepararSentencia and sanearSql handle all composition
5. ✅ Data minimization — Ejecucion carries only metadata, no row contents
6. ✅ Engine executes only the pattern — cron-parser used for next-fire only, no retry/catch-up
7. ✅ Secrets out of repository — .env.example documents ZONA_HORARIA_AUTOMATIZACIONES=UTC placeholder only

### Architecture Decisions
All 7 DEC-74 through DEC-80 decisions plus design-level resolutions under DEC-13/14 and DEC-71 are registered in `docs/01-decisiones.md` as firm, with context, options, decision, and consequences. No undocumented architecture decision was found.

## Work Unit Delivery

Per tasks.md "Suggested Work Units", the change was delivered in 7 PRs + 1 verification/archive:

| Unit | Branch | Commits | Notes |
|------|--------|---------|-------|
| 1 | ch13/1-esquema-aislamiento-config | b82bd03..21e76ad | Schema, isolation, config, dependency |
| 2a | ch13/2a-cron-ventana | 85e4b87 | Cron validity, due-window functions |
| 2b | ch13/2b-cierre-ejecucion | b6f7f42, 52e1e8b | Close-of-run mapping |
| 3a | ch13/3a-alta-automatizacion | 9d1f0b1 | Create route + registration |
| 3b | ch13/3b-consulta-desactivar | 0a8f987 | List, get, desactivar routes |
| 4a | ch13/4a-planificador | 42ab413 | Scheduler tick loop (size:exception 458 lines, user-approved) |
| 4b | ch13/4b-... | 4c6a60f | Failure isolation, Ejecucion writes, server wiring |
| 5 | ch13/5-rutas-ejecuciones-t2 | 253a11a, 91c2ca8 | Runs route + T2 sweep |
| 6a | ch13/6a-consola-lectura | fa4ffde | Console list, deactivate, runs, tenant switch |
| 6b | ch13/6b-consola-alta | 5422970 | Console create form |
| 7 | ch13/7-verify-archivo | fd77c56 | Verification + this archive |

**Delivery strategy**: auto-chain (stacked-to-main); 400-line budget exceeded at unit 4a (458 lines, user-approved size:exception per apply-progress.md); no further cohesive split possible.

**Audited ledger resets**: Two approved by the user during unit 2 split and unit 4a size exception, documented in apply-progress.md.

## Final-State Facts vs. Snapshot Claims

### Task Completion
Per orchestrator's final-state facts: all 46 tasks complete. The persisted `tasks.md` artifact shows:
- Phases 1–6 implementation: 43/43 [x]
- Phase 7 verification/archive: 7.1–7.3 (archive closure steps, not implementation debt)

Reconciliation: Phase 7 tasks are the verify-report generation (7.2, met by verify-report.md) and archive (7.3, completed by this run). Task 7.1 (full-suite checkpoint) confirmed by verify-report.md build/test/schema metrics. The 43 implementation tasks remain definitively closed; Phase 7 tasks advance the archive lifecycle, not implementation scope.

### Verification Claims
Per `verify-report.md` (fd77c56):
- Tests: 536/536 passed (two independent runs)
- 23/23 requirements, 36/36 scenarios (34/36 fully compliant, 2/36 partial but non-blocking)
- 0 CRITICAL, 3 WARNING (non-blocking), 2 SUGGESTION (usability/hardening)
- All 7 AGENTS.md non-negotiable rules held
- All 7 DEC-74..DEC-80 architecture decisions plus design-level resolutions registered

These facts are final-state authority; intermediate snapshots (apply-progress.md) are valid history at their point-in-time but do not override later-closed work or newer verification passes.

## Archive Contents

The archived folder `openspec/changes/archive/2026-09-29-CH-13-engine-scheduling-execution/` contains:

- ✅ **proposal.md** — Scope, approach, rollback plan (DEC-74..DEC-80)
- ✅ **specs/** — Delta specifications for all 6 domains (now merged into main specs)
- ✅ **design.md** — Architecture, scheduler loop, console wiring, migration notes
- ✅ **tasks.md** — Phases 1–7, 46 items, 43 implementation complete
- ✅ **verify-report.md** — Full compliance matrix, 536/536 tests, PASS WITH WARNINGS
- ✅ **state.yaml** — SDD state machine (retained per convention)

**Main specs updated**: 
- `openspec/specs/automation-scheduling/` (created)
- `openspec/specs/execution-log/` (created)
- `openspec/specs/domain-data-model/spec.md` (merged)
- `openspec/specs/tenant-isolation/spec.md` (merged)
- `openspec/specs/project-environment/spec.md` (merged)
- `openspec/specs/query-console/spec.md` (merged)

## Known Deviations and Follow-ups

### Documented Deviations (In-Scope, Non-Blocking)
1. **Console connection input** (Unit 6b): Free-text id input instead of a select widget, because no route lists connections by tenant. Adding one would widen the API scope. Functionally compliant with spec (create control submits a connection value); usability improvement is a follow-up.

2. **Unit 4a size exception** (458 changed lines vs. 400-line budget): User-approved per apply-progress.md; no cohesive split smaller than 4a/4b was possible while maintaining RED/GREEN clarity and rollback boundaries.

### Known Follow-ups (Out of Scope, Non-Blocking)
- **SUGGESTION-2**: Consider adding three hardening tests (server-boot smoke test, .env.example assertion, console cron error message) as low-cost additions in CH-17.
- **SUGGESTION-1 (usability)**: Connection-listing route would improve console UX; future work.

## Rollback and Delivery

**Rollback plan** (if needed post-archive, per design.md):
- Revert all commits from unit 1 (b82bd03) through unit 7 (fd77c56)
- Run `DROP TABLE "Ejecucion"; DROP TABLE "Automatizacion";`
- Remove `Automatizacion` and `Ejecucion` from MODELOS_AISLADOS in `src/aislamiento-prisma.ts`
- Revert ZONA_HORARIA_AUTOMATIZACIONES config and .env.example entries
- Revert console "Automatizaciones" section (src/consola.ts and tests)

**Ordinary delivery** follows repository policy (PR merge, release gate, et al.). This archive report is informational; native review and ordinary deployment gates remain separate.

## Traceability

- **Proposal**: Defined X1, X2 scope and 7 DEC decisions (DEC-74..DEC-80)
- **Spec**: 6 domains (automation-scheduling, execution-log, domain-data-model, tenant-isolation, project-environment, query-console) with 23 requirements and 36 scenarios
- **Design**: 10 subsections covering architecture, scheduler loop, console wiring, threat matrix, and migration notes
- **Tasks**: 46 items mapped to 10 phases (1 schema, 2 pure functions, 3 routes, 4 scheduler, 5 runs, 6 console, 7 verify/archive)
- **Verification**: 536/536 tests, PASS WITH WARNINGS, all non-negotiable rules held
- **Archive**: All artifacts mechanically moved, delta specs merged into main specs, change cycle closed

---

**Archive Prepared By**: sdd-archive (Haiku 4.5)  
**Archive Date**: 2026-09-29  
**SDD Cycle**: COMPLETE — Ready for next change
