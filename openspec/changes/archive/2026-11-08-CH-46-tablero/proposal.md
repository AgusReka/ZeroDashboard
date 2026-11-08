# Proposal: CH-46 — Tenant dashboard

**Status**: ready for spec and design. Inputs: exploration.md, DEC-183, DEC-198, DEC-199. Story R2h. Depends on CH-45, merged.

## Intent
The report catalog exists (CH-45), but nothing says which reports a client sees. This change lets P1 build each tenant's dashboard, choosing the reports, their order and the connection they run on. CH-48 then renders it in the panel.

## Scope

### In Scope
- **Model.** A tenant-scoped `Tablero` (`tenantId` unique, `conexionId`, ordered `reportes`) in one migration, added to `MODELOS_AISLADOS`.
- **Rules (DEC-199).** At most 8 reports, no repeats, an empty dashboard allowed, and the connection checked against the active tenant.
- **Console API.** `GET /tablero` and `PUT /tablero` under the tenant header. The read also says, per report, whether its views are approved on the connection. That check is advisory and never blocks a save.
- **Report in use.** Two typed reads in the isolation extension, as DEC-191 does for templates: one answers whether a report is on any dashboard, the other replaces the report only if it is not, under a row lock.
  - `PUT /reportes/:id` answers 409 `reporte-en-uso`.
  - `GET /reportes/:id` returns `enUso`.
- **Console.**
  - A «Tablero del cliente» screen in "Puesta en marcha": a connection select, the ordered list with «Subir», «Bajar» and «Quitar», «Agregar reporte», the views notice, and «Guardar».
  - The Reportes screen offers «Duplicar y editar» for a report in use.
- **Docs.** Design guidelines in both copies (the first ordering control), `docs/guia/09-reportes.md`, and the map.

### Out of Scope
- Panel routes, live execution, the period chosen by P2 and freshness (CH-48).
- Chart.js (CH-47).
- More than one connection per dashboard, or a main connection (DEC-199).
- Blocking a save on unapproved views (DEC-199).

## Capabilities

### New Capabilities
- `tenant-dashboard`: the `Tablero` model, its rules, and `GET` and `PUT /tablero`.

### Modified Capabilities
- `report-catalog`: replacing a report in use, `enUso`, duplication.
- `query-console`: the Tablero screen, the nav, and «Duplicar y editar» on Reportes.
- `tenant-isolation`: the scoped model, the audited in-use read, and the two-tenant proof.
- `domain-data-model`: `Tablero`.

## Approach
Mirror DEC-191 for the in-use port and `VinculoTelegram` for the tenant-scoped row. The dashboard is replaced as a whole on each save, so there is no per-item route.

## Rules Check
- **Rule 1.** P1 picks reports; nobody writes SQL here.
- **Rule 2.** Tenant from the header, connection checked against it; the in-use read returns only a boolean. A two-tenant test covers both.
- **Rules 3-5.** Nothing runs against the replica. The views check reads mapping metadata only.
- **Rule 6, anti-scope.** Configuration only.

## Rollback
Revert the code, then `DROP TABLE "Tablero"`. Reports become editable again, as after CH-45. The migration carries the recipe.

## Affected Areas
- `prisma/schema.prisma`, `prisma/migrations/`
- `src/tablero/` (new), `src/reportes/reportes-rutas.ts`
- `src/aislamiento/aislamiento-prisma.ts`, `src/app/rutas.ts`
- `src/consola/consola.ts`, `consola.test.ts`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Size ~1,500-1,800 lines | Certain | `size:exception` or a split at the tasks forecast |
| Race between adding a report to a dashboard and editing it | Low | The replace takes a row lock and rechecks use, as DEC-191 does |
| The in-use read leaks another tenant's data | Low | Boolean only, with an isolation test |
| First ordering control without a design pattern | Medium | Guidelines written before the markup |

## Success Criteria
- [ ] P1 builds, reorders and saves a dashboard of up to 8 reports for a tenant.
- [ ] Another tenant's connection is refused, and two tenants never see each other's dashboard.
- [ ] A report on any dashboard answers 409 on edit, and its duplicate can be edited.
- [ ] Unapproved views are flagged without blocking the save.
- [ ] `npm run test:db` and `npx tsc -p tsconfig.json --noEmit` pass, apart from the known failures.
