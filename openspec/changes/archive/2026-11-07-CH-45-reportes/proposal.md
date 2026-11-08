# Proposal: CH-45 — Reports: model, global catalog and console screen

**Status**: ready for spec and design. Inputs: exploration.md, DEC-183, DEC-184, DEC-198. Story R1h. Depends on CH-36, merged.

## Intent
P1 has no way to define a report. This change adds the global catalog that CH-46 and CH-48 build on: one report written against `v_*` works for every mapped tenant without rewriting.

## Scope

### In Scope
- **Model.** Global `Reporte` (`nombre`, `titulo`, `descripcion`, `sql`, `entidades`, `visualizacion`, `columnas`, period declaration) and nullable `RegistroEjecucion.reporteId`, in one migration.
- **Rules.** The DEC-198 period, column roles and per-type row caps, with client titles checked against the panel glossary.
- **Catalog API.** List, create, read and replace, exempt from `x-tenant-id`. No delete (DEC-68).
- **Test API.** Saved and unsaved report tests under the active tenant, reusing the DEC-71 gate. A shared run step moves out of `plantilla-prueba.ts`, whose tests stay unchanged.
- **Audit.** Origin `reporte-prueba`, visible in the audit screen.
- **Console.** A `Reportes` screen under `Global`: list, detail, create and edit, and a test by connection and declared period, shown as a table.
- **Docs.** Design guidelines in both copies, and the console guide if it lists screens.

### Out of Scope
- Per-tenant dashboard and the rule for a report in use (CH-46).
- Chart.js and chart rendering (CH-47, CH-48).
- Panel routes and P2 period selection (CH-48).
- A SQL parser enforcing `v_*` (DEC-09).

## Capabilities

### New Capabilities
- `report-catalog`: the report model, its rules, and the catalog and test routes.

### Modified Capabilities
- `query-console`: the Reportes screen and the audit label.
- `execution-audit`: the new origin and `reporteId`.
- `tenant-isolation`: the exempt rows; the test stays scoped.
- `domain-data-model`: `Reporte` and the audit column.

## Approach
Module `src/reportes/` mirrors the split of `src/plantillas/` (pure rules, global routes, scoped test route) and imports its exported functions. There is no shared table or generic catalog abstraction.

## Rules Check
- **Rule 1.** Only P1 writes SQL, in the console.
- **Rule 2.** The catalog holds no tenant data. The test takes the tenant from the operator's scope, and a two-tenant test covers it.
- **Rules 3, 4.** The existing pipeline runs it. The period reaches the driver as a parameter.
- **Rule 5.** No rows are stored; columns are declared by role.
- **Rule 6, anti-scope.** Not a query builder: SQL by P1 and a fixed visualization (DEC-183).

## Rollback
Revert the code, then drop `Reporte` and `RegistroEjecucion.reporteId`. Audit rows keep their `reporte-prueba` origin as plain text. The migration carries the recipe.

## Affected Areas
- `prisma/schema.prisma`, `prisma/migrations/`
- `src/reportes/` (new), `src/plantillas/plantilla-prueba.ts`
- `src/app/rutas.ts`, `src/aislamiento/contexto-tenant.ts`, `src/auditoria/auditoria.ts`
- `src/consola/consola.ts`, `consola.test.ts`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Size ~2500-3000 lines | Certain | `size:exception` or a split at the tasks forecast |
| Extraction changes template test behavior | Medium | Existing tests stay unchanged |
| Stale `columnasPrueba` passes save | Low | Each run rechecks columns |
| A report reads a raw replica table | Low | Documented limit (DEC-198) |

## Success Criteria
- [ ] P1 creates, tests and edits a report of each of the four types from the console.
- [ ] One report runs on two mapped tenants without rewriting, and an unmapped tenant gets `vista-canonica-no-aprobada`.
- [ ] A period outside the declared list is rejected, and the row cap applies per type.
- [ ] Each test leaves one `reporte-prueba` audit row with no rows or values.
- [ ] `npm run test:db` and `npx tsc -p tsconfig.json --noEmit` pass.
