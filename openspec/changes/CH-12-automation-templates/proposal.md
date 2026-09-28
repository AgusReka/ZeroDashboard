# Proposal: CH-12 — Automation Templates (D1)

**Status**: ready for spec and design. OQ-A..OQ-D resolved by the user as DEC-70..DEC-73.

## Intent

D1: P1 defines a reusable template (query + parameters + format + freshness) over the canonical contract. Canonical views are stored but never composed (DEC-31 assigns `WITH` composition to CH-12), and `AUTOMATIZACIONES` labels are unreconciled (DEC-22).

## Scope

### In Scope
- Global persisted `Plantilla`, no `tenantId`, catalog routes exempt from `x-tenant-id` (DEC-61): create, list, get, replace by id, no delete (DEC-68).
- Fields: `nombre`, `sql`, `parametros` (DEC-52), `entidades` validated against the contract (DEC-63), `automatizacion` enum from `AUTOMATIZACIONES` (DEC-67), `formato` = `correo-html` (DEC-65), `toleranciaFrescuraMinutos` stored, unenforced (DEC-66).
- Save-time checks reused from CH-11 (DEC-56/57/59).
- Pure composition function; test endpoint runs a template against one active-tenant connection via `ejecutarConsulta` (DEC-62). Missing view: legible `4xx` naming the entity.

### Out of Scope
- Condition field (DEC-64); `reporte-diario` query (DEC-69); defaults (DEC-50 holds).
- Scheduler/instances/delivery (CH-13/14/21); freshness enforcement (CH-24); versioning (CH-25); console UI.

## Capabilities

### New Capabilities
- `automation-templates`: model, catalog routes, validation, composition, test endpoint.

### Modified Capabilities
- `domain-data-model`: lift the `Plantilla` prohibition; first global non-`Tenant` model.
- `tenant-isolation`: catalog exemption; `Plantilla` outside `MODELOS_AISLADOS`.
- `canonical-contract`: labels become the template enum (closes DEC-22).
- `tenant-schema-mapping`: views consumed as `WITH`.
- `query-parameters`: template as third declaration source.

## Approach

New `src/plantillas.ts`. Composition prefixes each listed entity's registered view SQL as a CTE and nests the template as a subquery (outer CTEs stay visible), so a template's own `WITH` needs no text parsing. Rule 4: the text only joins stored operator-authored SQL (DEC-31); request values reach the driver only through `prepararSentencia`, whose branded result stays the sole path to execution. Tenant and connection are server-resolved through the isolated delegate (DEC-35).

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma` + migration | Modified (additive) |
| `src/plantillas.ts` (+ test) | New |
| `src/contexto-tenant.ts` (`esExenta`), `src/contrato.ts`, `src/server.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Exemption leaks to the test route | Med | Method+path exemption; test route requires header |
| Scope creep into CH-13/14/21 | Med | Out-of-scope list |
| Template reads native tables | Low | Documented limit (DEC-63) |

## Rollback Plan

Revert slices in reverse; the migration only adds a table. Existing routes stay untouched.

## Resolved Questions

- **OQ-A → DEC-70** CTE alias per entity is `v_<entidad>`.
- **OQ-B → DEC-71** Test endpoint requires a passing saved validation for every composed view; otherwise a legible `4xx` naming the entity.
- **OQ-C → DEC-72** DEC-23 personal-field override is deferred; documented as an artifact limit.
- **OQ-D → DEC-73** `parametros` and `entidades` stored as JSON columns validated in the app (as DEC-55).

## Size Forecast

~900–1200 lines with tests. `400-line budget risk: High`. Chained PRs recommended.

## Success Criteria

- [ ] Template round-trips create/get/replace without `x-tenant-id`.
- [ ] Test endpoint returns rows over composed views, values bound only as driver parameters.
- [ ] Missing view or undeclared entity returns a legible `4xx`.
- [ ] Invalid `automatizacion` rejected; DEC-22 closed.
