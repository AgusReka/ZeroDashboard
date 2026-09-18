# Archive Report: CH-08 — Canonical Contract

**Date**: 2026-09-18  
**Status**: ARCHIVED — Change Complete  
**Verdict**: PASS WITH WARNINGS (per verify-report.md)

## Executive Summary

CH-08 has been successfully implemented, verified, and archived. The canonical contract — a static TypeScript catalog of minimal e-commerce entities and fields required for generic automations — is now the source of truth in the codebase. The change introduces a new capability, `canonical-contract`, exposed via `GET /contrato` endpoint that projects the frozen catalog. All 25 tasks are complete. The full test suite (248/248 tests) passes. Zero CRITICAL findings. This change closes stories M1 and M5 and enables downstream CH-09 and CH-10.

## What Shipped

### New Capability: canonical-contract

A static, tenant-agnostic contract defining the minimal set of entities and fields a candidate e-commerce platform must expose for generic automations to work without per-client rewrites.

**Entities**: 5 total
- Required: `producto`, `pedido`, `item_pedido`
- Optional: `insumo`, `receta_componente`

**Fields**: 24 total across all entities
- Each field marked required or optional (independent of entity-level mark)
- Each field labeled with automation dependencies (stock-fisico, stock-producible, reporte-diario)

**Endpoint**: `GET /contrato`
- Returns the catalog as `{ "contrato": { "entidades": [...] } }`
- Exempt from tenant-context header requirement (DEC-24)
- Read-only (no mutations, no side effects)

### Decisions Confirmed

- **DEC-21**: Catalog is static code, not a persisted Prisma model or database table
- **DEC-22**: Automation labels are exported constants (`AUTOMATIZACIONES`), never inline string literals
- **DEC-23**: Personal fields (domicilio, teléfono, correo) are structurally absent from the contract
- **DEC-24**: `GET /contrato` joins the tenant-context exemption allowlist (`esExenta`)

### Code Changes Summary

**New Files**:
- `src/contrato.ts` (258 lines): Catalog module with `AUTOMATIZACIONES`, `CONTRATO_CANONICO` constant, and type definitions
- `src/contrato-rutas.ts` (33 lines): Route handler for `GET /contrato`
- `src/contrato.test.ts` (314 lines): Catalog invariants, personal-field absence sweep, automation traceability
- `src/contrato-rutas.test.ts` (186 lines): Route shape, header-independence, method-specificity tests

**Modified Files**:
- `src/server.ts`: Added import and registration of `registerContratoRoutes(app)`
- `src/contexto-tenant.ts`: Widened `esExenta` exemption list to include `GET /contrato`; updated doc comment

**Unchanged Files** (verified):
- `prisma/schema.prisma`: Byte-identical to pre-CH-08 (no migration)
- `src/aislamiento-prisma.ts`: `MODELOS_AISLADOS` unchanged
- `openspec/specs/domain-data-model/spec.md`: Not touched

## Verification Results

**Test Execution**: 248/248 pass, 0 fail, 0 skipped (re-run independently in verify phase against live PostgreSQL)  
**Build**: Exit code 0 (`npx tsc -p tsconfig.json --noEmit`)  
**Spec Compliance**: 5/5 requirements, 7/7 scenarios COMPLIANT

### Compliance Matrix

| Requirement | Scenarios | Status |
|---|---|---|
| Static Catalog Is the Source of Truth | 1 | ✅ COMPLIANT |
| Each Field Is Marked Required or Optional and Names Its Automation | 2 | ✅ COMPLIANT |
| Personal Fields Are Structurally Absent | 1 | ✅ COMPLIANT |
| Read-Only Endpoint Projects the Catalog | 1 | ✅ COMPLIANT |
| `GET /contrato` Is Exempt From the Tenant-Context Header | 2 | ✅ COMPLIANT |

### Success Criteria Traceability

All six success criteria from proposal.md are met:

1. ✅ `GET /contrato` returns every canonical entity with its fields, each field marked required/optional, and each field naming its automation(s)
2. ✅ The response contains no field named or meaning domicilio, teléfono, or correo, and no customer entity (verified by automated test in `contrato.test.ts`)
3. ✅ `prisma/schema.prisma` is byte-identical to its pre-CH-08 state, and no migration is added
4. ✅ `MODELOS_AISLADOS` is unchanged
5. ✅ `GET /contrato` answers identically with and without an `x-tenant-id` header
6. ✅ Every entity and field in the catalog is traceable to at least one of stock-fisico, stock-producible, reporte-diario

## Warnings Carried Forward (Per verify-report.md)

**WARNING 1**: Authored Diff Exceeds Review Budget

The implemented change totals approximately 932 lines of authored code (production + tests), exceeding both the 400-line review-workload budget and `tasks.md`'s own forecast (355 total). The forecast undercounted the two catalog/route test files by roughly 145 lines combined. This is a **process/forecasting observation, not a code-quality or spec-compliance defect**. The three commits are already aligned with the three independent rollback boundaries `tasks.md` names (catalog, route, exemption), so a later chained-PR slice remains straightforward if this repository adopts PR-review workflow.

**WARNING 2**: Native Attempt-Ledger Resets During Apply

The apply session record (Engram `sdd/CH-08/apply-progress`) disclosed two prior maintainer-authorized resets of the candidate's native attempt ledger, both attributed to ledger candidate-wide changed-line accounting rather than to any code-quality issue. The verify phase found nothing in the shipped code, tests, or commit history suggesting residual risk. These resets are **process/traceability notes, not spec-compliance or code-quality defects**, and are recorded here for continuity with CH-07's verify-report convention.

## Task Completion

**Total Tasks**: 25  
**Complete**: 25  
**Incomplete**: 0  
**Verification**: No stale checkboxes; every checked task corresponds to shipped code verified in this session.

### Task Breakdown
- **Section 1 (Catalog Module)**: 8/8 complete
- **Section 2 (Route Module)**: 7/7 complete
- **Section 3 (Tenant-Context Exemption)**: 7/7 complete
- **Section 4 (Full-Suite Checkpoint)**: 3/3 complete

## Commits Archived

Three commits land in the archived change folder:

1. `8571ce1` CH-08: catalogo canonico y ruta de lectura /contrato
2. `c03c3a7` CH-08: exencion de /contrato en el contexto de tenant
3. `8ecab1b` CH-08: checkpoint de suite completa y cierre de tareas

All three are reachable via `git log 8ecab1b~2..8ecab1b` in the repository history.

## Capability Boundary

Per the proposal's "Capability Boundary" section, `canonical-contract` is a **new capability**, not a modification to an existing one. `domain-data-model` (which describes ZeroDashboard's own persisted Prisma tables) remains unchanged, preserving its "No Premature Modeling" requirement. The canonical contract describes the shape a tenant's replica must expose — conceptually CH-09's mapping target, not our schema.

**Spec Tree**:
- `openspec/specs/canonical-contract/spec.md` (NEW) — canonical contract specification
- `openspec/specs/domain-data-model/spec.md` (UNCHANGED)

## Rollback Profile

Cleanest rollback of any change since CH-01:
1. Revert the three commits (revert history shows no dependencies on downstream changes)
2. No migration to unwind
3. No persisted state touched
4. The module and route disappear, `esExenta` returns to its three-entry form

## Artifact Store

**Store Mode**: hybrid (OpenSpec + Engram)  
**OpenSpec Artifacts**: All proposal/spec/design/tasks/verify-report/archive-report files persisted to `openspec/changes/archive/2026-09-18-CH-08-canonical-contract/`  
**Engram Artifacts**: Archive report persisted to `sdd/CH-08/archive-report` with full observation ID traceability

## SDD Cycle Completion

**Phases Completed**:
1. ✅ sdd-explore: Investigation of the canonical contract need and design space
2. ✅ sdd-propose: User-approved proposal with scope, decisions, rollback plan
3. ✅ sdd-spec: Specification of the canonical-contract capability with 5 requirements and 7 scenarios
4. ✅ sdd-design: Technical approach with architecture decisions and data flow
5. ✅ sdd-tasks: 25 tasks derived from design, all completed during apply phase
6. ✅ sdd-apply: Implementation of new modules, routes, tests, and exemption edits
7. ✅ sdd-verify: Independent verification of spec compliance, all scenarios green, zero CRITICAL findings
8. ✅ sdd-archive: Mechanical copy of delta specs to main tree, folder move to archive, archive report written

## Next Recommended Change

CH-08 is fully closed. The next planned change is **CH-09 — Mapeo de esquema por tenant** (schema mapping per tenant), which depends on CH-08's canonical contract as the mapping target.

---

**Archive Date**: 2026-09-18  
**Prepared by**: sdd-archive phase (Haiku 4.5)
