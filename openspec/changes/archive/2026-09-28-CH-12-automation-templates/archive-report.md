# Archive Report: CH-12 — Automation Templates

**Change**: CH-12-automation-templates (D1: Plantillas de automatización)
**Status**: Archived and closed
**Archive Date**: 2026-09-28
**Archival Completeness**: All artifacts synced, all specs merged, all tasks marked complete, bitácora and archive report written

## Executive Summary

CH-12 completes D1 by introducing a global, tenant-unscoped `Plantilla` catalog (no `tenantId`, exempt from `x-tenant-id` header), with create/list/get/replace routes, strict parameter and entity validation inherited from CH-11, `WITH` CTE composition over canonical views per entity, and a scoped test route that executes the composed template read-only against the active tenant's connection. All 471 tests pass (406 baseline + 65 new), verification is PASS WITH WARNINGS (2 non-blocking warnings; 0 CRITICAL issues), and all 43 tasks are complete. The change is fully implemented, verified, and archived.

## Specs Synced

| Spec | Action | Status | Details |
|------|--------|--------|---------|
| automation-templates | Created | ✅ | New spec, copied to `openspec/specs/automation-templates/spec.md` (12 requirements, 18 scenarios) |
| domain-data-model | Merged (MODIFIED) | ✅ | Delta merged via `gentle-ai sdd-archive-compose`; lifts the Plantilla prohibition |
| tenant-isolation | Merged (MODIFIED) | ✅ | Delta merged via `gentle-ai sdd-archive-compose`; catalog exemption added |
| canonical-contract | Merged (MODIFIED) | ✅ | Delta merged via `gentle-ai sdd-archive-compose`; closes DEC-22 (labels → template enum) |
| tenant-schema-mapping | Merged (MODIFIED) | ✅ | Delta merged via `gentle-ai sdd-archive-compose`; wording corrected per WARNING-2 (sanearSql normalization documented) |
| query-parameters | Merged (MODIFIED) | ✅ | Delta merged via `gentle-ai sdd-archive-compose`; template as third declaration source |

**All specs** are now source-of-truth references in `openspec/specs/`.

## Archive Contents

```
openspec/changes/archive/2026-09-28-CH-12-automation-templates/
├── proposal.md              (proposal artifact)
├── design.md                (design artifact)
├── specs/                   (all delta specs for traceability)
│   ├── automation-templates/spec.md
│   ├── domain-data-model/spec.md
│   ├── tenant-isolation/spec.md
│   ├── canonical-contract/spec.md
│   ├── tenant-schema-mapping/spec.md
│   └── query-parameters/spec.md
├── tasks.md                 (all 43 tasks marked complete)
├── verify-report.md         (PASS WITH WARNINGS)
├── apply-progress.md        (implementation tracking)
├── exploration.md           (exploration phase output)
└── archive-report.md        (this file)
```

The active `openspec/changes/` directory no longer contains CH-12-automation-templates; the folder has been moved to archive using `git mv`.

## Implementation Status

### Completion Gate (Task Completion Gate per SKILL.md)

All 43 implementation tasks are marked `[x]` in the persisted `tasks.md`:

- **Unit 1** (schema, exemption): 1.1–1.6 ✅
- **Unit 2** (pure composition module): 2.1–2.7 ✅
- **Unit 3** (catalog routes create/list/get): 3.1–3.5 ✅ (auto-split into 3a/3b)
- **Unit 4** (replace + comment): 4.1–4.5 ✅
- **Unit 5** (test route): 5.1–5.10 ✅ (5a gate, 5b execution; 5a was size:exception approved)
- **Unit 6** (checkpoint, verify, archive): 6.1–6.3 ✅ (6.1 checkpoint; 6.2 verify; 6.3 archive)

No unchecked tasks remain.

### Test Results (per verify-report, final-state authority)

| Metric | Value | Evidence |
|--------|-------|----------|
| Total tests | 471/471 passing | verify-report: TEST_DB_PORT=5434 npm test exit 0 |
| Pre-CH-12 baseline | 406 | stated in final-state facts |
| New tests (CH-12) | 65 | 471 − 406 |
| TypeScript check | Clean | npx tsc --noEmit exit 0 |
| Prisma schema | Valid | npx prisma validate exit 0 |
| Coverage tool | Not configured | npm test uses `tsx --test` with no coverage flag |

### Specification Compliance (per verify-report)

- **Requirements**: 17/17 fully covered
- **Scenarios**: 26/26 traced to passing tests; 2 carry non-blocking warnings (see Issues Found)
- **AGENTS.md non-negotiables**: 7/7 held (rules 1–7 all pass)
- **Verdict**: **PASS WITH WARNINGS** (0 CRITICAL, 2 non-blocking WARNING)

#### Compliance Summary by Spec

| Spec | Requirements | Scenarios | Verdict |
|---|---|---|---|
| automation-templates | 12/12 | 18/18* | COMPLIANT* (1 structural; see WARNING-1) |
| domain-data-model | 1/1 | 2/2 | COMPLIANT |
| tenant-isolation | 1/1 | 2/2 | COMPLIANT |
| canonical-contract | 1/1 | 1/1 | COMPLIANT |
| tenant-schema-mapping | 1/1 | 1/1* | COMPLIANT* (wording corrected; see WARNING-2) |
| query-parameters | 1/1 | 2/2 | COMPLIANT |

*See Issues Found.

## Issues Found (per verify-report)

### CRITICAL
None. Archive proceeds.

### WARNING (Non-Blocking)

**WARNING-1**: specs/automation-templates scenario "Value has no effect on test execution" (DEC-66, `toleranciaFrescuraMinutos`)

- **Finding**: The scenario requires two otherwise-identical templates to execute identically when they differ only in `toleranciaFrescuraMinutos`. The field is structurally guaranteed not to be used (the test route's `plantilla.findUnique` select clause omits it entirely), so no runtime test was written.
- **Status**: Accepted as follow-up debt. The structural guarantee is sufficient for compliance per design.
- **Recommendation**: Add a cheap integration test in a future change (two templates differing only in this field, execute both, assert identical verdicts).
- **Disposition**: Logged in `docs/bitacora/CH-12-plantillas-de-automatizacion.md` as accepted follow-up.

**WARNING-2**: specs/tenant-schema-mapping scenario "Registered SQL is reused verbatim as a CTE body"

- **Finding**: The scenario text says the CTE body "SHALL contain exactly the registered SQL text, unmodified." The shipped and tested behavior applies `sanearSql` exactly once per stored piece (trim + strip trailing semicolon), per an explicit design.md decision (Design heading "Piece sanitizing"; "componerSentencia applies sanearSql exactly once to each stored piece and wraps each body in newlines").
- **Status**: Corrected. This is a spec-wording accuracy issue, not a functional defect. The scenario wording was updated during archive merge to say the CTE body contains the registered SQL text with sanearSql's idempotent-once normalization (trim, trailing-semicolon removal) applied. The corrected text now matches the shipped and tested behavior.
- **Disposition**: Wording corrected in `openspec/specs/tenant-schema-mapping/spec.md` during merge (via `gentle-ai sdd-archive-compose`).

### SUGGESTION (Informational)

**SUGGESTION-1**: Add a route-level integration test that persists a directly-corrupted `Plantilla.parametros` JSON value (bypassing the API's save-time validation) and asserts the test route answers `400 solicitud-invalida` rather than `500`. Per verify adjudication item 5, the structured guarantee is that `prepararSentencia` (unchanged from CH-11) already returns a 400-shaped problem list, but a dedicated CH-12 test case would improve defense-in-depth.

## Decisions Preserved

All decisions from DEC-61 through DEC-73 are now immutable via their archive record. Key decisions:

| Decision | Topic | Status |
|---|---|---|
| DEC-61 | Plantilla is global, no tenantId | ✅ Implemented |
| DEC-62 | Test route requires tenant header; uses full PrismaAislado | ✅ Implemented |
| DEC-63 | entidades validated against canonical contract | ✅ Implemented |
| DEC-64 | `condicion` field deferred | ✅ Noted as out-of-scope |
| DEC-65 | formato fixed to correo-html | ✅ Implemented |
| DEC-66 | toleranciaFrescuraMinutos stored, unenforced | ✅ Implemented (no-op; WARNING-1 for test) |
| DEC-67 | automatizacion is enum; closes DEC-22 | ✅ Implemented |
| DEC-68 | No delete route | ✅ Implemented |
| DEC-69 | reporte-diario deferred | ✅ Noted as out-of-scope |
| DEC-70 | CTEs with v_<entidad> aliases | ✅ Implemented |
| DEC-71 | Validation gate: each entity must pass validation | ✅ Implemented |
| DEC-72 | Personal-field override deferred | ✅ Noted as artifact limit |
| DEC-73 | JSON validation in application | ✅ Implemented |

## Known Limits (Documented in Bitácora)

The following limits are intentional design choices and remain open gates for future changes:

| Limit | Decision | Reason | Future |
|---|---|---|---|
| Personal-field override | DEC-72 | Deferred override mechanism | Unscheduled — decided when a real template needs it (DEC-72) |
| reporte-diario canonical query | DEC-69 | Depends on requirements, not covered by D1 | CH-13/14/21 to decide |
| toleranciaFrescuraMinutos enforcement | DEC-66 | Stored but not enforced; enforcement deferred | CH-24 (future change) |
| Template reads native tables | DEC-63 (documented limit) | No mechanism to prevent; entidades is closed enum but SQL is operator-written | Risk accepted; documented in design |

## Artifact Traceability

### Engram Observations (if applicable)

This archive is hybrid-mode (openspec + Engram). The following observations were persisted during the SDD cycle:

- `sdd/CH-12-automation-templates/proposal` (proposal phase)
- `sdd/CH-12-automation-templates/spec` (spec phase)
- `sdd/CH-12-automation-templates/design` (design phase)
- `sdd/CH-12-automation-templates/tasks` (tasks phase)
- `sdd/CH-12-automation-templates/apply-progress` (apply phase)
- `sdd/CH-12-automation-templates/verify-report` (verify phase)
- `sdd/CH-12-automation-templates/archive-report` (this archive, saved at close)

### Filesystem References

- Main specs: `openspec/specs/{automation-templates,domain-data-model,tenant-isolation,canonical-contract,tenant-schema-mapping,query-parameters}/spec.md`
- Archive folder: `openspec/changes/archive/2026-09-28-CH-12-automation-templates/`
- Bitácora: `docs/bitacora/CH-12-plantillas-de-automatizacion.md`
- Change tracking: `docs/01-decisiones.md` (DEC-61–DEC-73 recorded; no additional entries required by archive)

## Source Control Status

- **Branch**: `ch12/6-verify-archivo` (integration branch, stacked to main after 8 work-unit branches)
- **Commits in this change**: 8 (plus 1 planning commit)
  - 75d51ba: planning
  - 5ddf411: unit1 (schema+exemption)
  - 81b6f9f: unit2 (pure module)
  - 75afed3: unit3a (create/list/get start)
  - 41c4d40: unit3b (create/list/get completion)
  - ccfb4c9: unit4 (replace)
  - 6b73b58: unit5a (test route gate)
  - c1e21b9: unit5b (test route execution)
  - dc10011: checkpoint+verify
- **Lines added**: ~1,520 (schema+migration ~220, src/plantillas.ts ~330, routes/tests ~380+, test-route ~400, all tests across 5 files ~65 new cases)
- **Status**: No uncommitted changes. Archive does not commit or push; the orchestrator owns merge to main.

## Metadata

| Field | Value |
|---|---|
| Change ID | CH-12-automation-templates |
| Release | D1 (Q3 2026) |
| Archive folder | openspec/changes/archive/2026-09-28-CH-12-automation-templates/ |
| Archive date (ISO) | 2026-09-28 |
| Total artifacts | 8 (proposal, design, specs, tasks, apply-progress, verify-report, archive-report, exploration) |
| Spec count | 6 (1 new, 5 delta merges) |
| Task count | 43 (all complete) |
| Verification result | PASS WITH WARNINGS |
| Critical issues | 0 |
| Non-critical warnings | 2 (both accepted, follow-up or corrected) |

## Next Steps

The SDD cycle for CH-12 is complete and closed. The change is ready for:

1. **Repository merge**: Orchestrator to merge `ch12/6-verify-archivo` to main (if using stacked/chained PR strategy, merge forward from prior branches).
2. **Release**: D1 delivery per project schedule.
3. **Follow-up work**: 
   - CH-13/14/21 (scheduling, delivery, instances) depend on D1's Plantilla foundation and can proceed independently.
   - The personal-field override is unscheduled; it is decided when a real template needs it (DEC-72).
   - CH-24 can implement tolerance enforcement (DEC-66 no-op field ready).
   - WARNING-1 (toleranciaFrescuraMinutos test) is a cheap follow-up; can be added anytime after D1 ships.

This archive closes the formal SDD cycle. No further phase work is required.

---

**Archived by**: sdd-archive sub-agent (Haiku 4.5)
**Timestamp**: 2026-09-28 (creation time of this report)
**Archive method**: Hybrid (openspec + Engram); specs merged via `gentle-ai sdd-archive-compose`; change folder moved via `git mv`; all diffs verified empty (byte-identity confirmed)
