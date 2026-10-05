# Proposal: CH-21b — Initial Template Catalog (stock fisico, stock producible; D3)

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-125 to DEC-128 (firm, 2026-10-05).

## Intent

- `Plantilla` is empty on a fresh install, so the console selector `#auto-plantilla` has no options and D3 is uncovered.
- Seed the two templates whose SQL has already been verified (CH-16b `04_`, CH-16d `11_`). The current console can then create automations from them before CH-21c.

## Scope

### In Scope
- New `src/catalogo-inicial.ts`: a closed list of two entries with fixed ids, plus `sembrarCatalogoInicial(...)`. It creates a row only when the row's id is absent and never overwrites one (DEC-125, DEC-68).
- `stock-fisico`: the `11_` query with `<= :umbral`, the verified `NOT EXISTS` over `v_receta_componente`, and `entidades: ['producto','receta_componente']` (DEC-127). Tolerance 60 min.
- `stock-producible`: the `04_` query with `HAVING FLOOR(MIN(...)) <= :umbral` and tolerance 120 min (DEC-128).
- Both entries declare `parametros: [{ nombre: 'umbral', tipo: 'numero' }]`, use `formato: 'correo-html'`, and read only `v_<entidad>` aliases (DEC-70).
- `prisma/seed.ts` calls the seeder independently of the tenant early return. Tenant seeding keeps its current behavior.
- Tests and a smoke check.

### Out of Scope
- `reporte-diario` (DEC-126). It is documented as an artifact limit for Cap. 6.
- `descripcion`/`icono` columns, or any schema, migration or API change (DEC-128).
- Console UI changes, the CH-21c two-step creation flow, and "disabled with reason".
- Tolerance enforcement (CH-24), per-template email format (N3), and versioned catalog sync.
- Any engine change (rule 6).

## Capabilities

### New Capabilities
- `initial-template-catalog`: what the catalog contains when it ships, create-if-absent seeding by fixed id, idempotency, survival of operator edits, the requirement that every entry passes the `POST /plantillas` save-time checks, and the absence of `reporte-diario`. This is a new capability because `automation-templates` covers only the D1 mechanism, and this change adds catalog content and a write path that does not go through HTTP.

### Modified Capabilities
- None. `automation-templates` requirements do not change, and the seeded rows must satisfy them as written. `domain-data-model` also stays unchanged: there is no schema change, and the `Tenant` row count is already "zero, one, or more".

## Approach

This follows the DEC-125 (a) mechanism, with the scope set by DEC-126 (a), DEC-127 (b) and DEC-128 (a). The seeder runs every entry through the same validation functions the route uses, so a seeded row could also have been saved through `POST /plantillas`. Rule 2 holds: the catalog is global, holds only `:marker` SQL and no tenant data, and the seeder takes no tenant input. Rules 1, 3, 4, 5 and 7 are untouched: the SQL is SELECT-only, values are bound by the driver, only contract fields are used, and no secrets are involved.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/catalogo-inicial.ts`, `src/catalogo-inicial.test.ts` | New |
| `prisma/seed.ts` | Modified (thin caller; restructured early return) |
| `scripts/smoke.sh` | Modified (asserts both catalog ids) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The nested `SELECT * FROM (<tpl>) AS _plantilla` with `:umbral` has not been run on real data, and `ORDER BY` may not survive it | Med | Test through the real `componerSentencia` + `prepararSentencia` path on Postgres with a miniature fixture |
| The selector stays empty again because the seed fails silently or is skipped | Med | Smoke check on `GET /plantillas`, plus a test that the seed runs when a tenant exists |
| `stock-fisico` returns 409 or `rechazo` for tenants without recipes, while M4 reports it as applicable | High (by design) | Documented in DEC-127. An empty `receta_componente` view is valid. CH-21c derives the disabled state from the template's entities |
| Email headers are raw column names | High | Choose business-readable aliases in design |
| Anyone with API access can `PUT` the seeded rows | Low (pre-existing) | Accepted in DEC-125. The seed never re-applies its own content |
| Seeded fixed ids pollute the test DB or break listing assertions | Med | Tests clean up the fixed ids. Existing list tests filter by prefix |

## Rollback Plan

Revert PR1. Rows that were already seeded persist, because there is no delete route (DEC-68). The seeded rows are harmless; to remove them, an operator first checks for `Automatizacion` rows that reference the two fixed ids, then runs `DELETE FROM "Plantilla" WHERE id IN (<two fixed ids>)` on the own database. PR0 is documentation only.

## Dependencies

- Prerequisite: DEC-125 to DEC-128 (PR0, committed).
- Downstream: CH-21c consumes the rows, `umbral`, `entidades` and `automatizacion`. CH-22b needs business copy, which is not stored here. CH-24 enforces the tolerances.

## Review Workload Forecast

| PR | Content | Lines |
|----|---------|-------|
| PR0 | Exploration, proposal, DEC-125..128 | ~80-100 + planning docs |
| PR1 | Module (~110), seed (~25), tests (~150), smoke (~5) | ~290-320 |

`Decision needed before apply: No`; `Chained PRs recommended: Yes`; `400-line budget risk: Low`.

## Open Questions

- The template `nombre` values and the email column aliases (design-time copy).
- The literal values of the fixed ids.
- Whether a seed failure should abort container start.
- What to do if `ORDER BY` does not survive the nesting: document that order is not guaranteed, or restructure the template SQL. The engine is not changed in either case.

## Success Criteria

- [ ] Seeding an empty catalog creates exactly two rows with the fixed ids and the specified fields. `stock-fisico` declares `['producto','receta_componente']`, and the tolerances are 60 and 120.
- [ ] Seeding twice leaves exactly two rows. A row edited with `PUT` is byte-identical after a second seed.
- [ ] The seed creates the catalog when a tenant already exists, and tenant seeding behavior is unchanged.
- [ ] Each entry passes the `POST /plantillas` save-time checks. The composed SQL contains only placeholders and, on Postgres, filters by `umbral` (`stock-fisico` also excludes products that have a recipe).
- [ ] There is no `reporte-diario` row, no migration, and no diff in engine files. After container start, the smoke test lists both ids.
