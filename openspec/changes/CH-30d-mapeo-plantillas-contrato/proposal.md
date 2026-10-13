# Proposal: CH-30d — Mapping and validation, Templates and Contract screens

**Status**: ready for spec and design. Inputs: exploration.md, DEC-30 to DEC-46, DEC-61, DEC-164 to DEC-166, DEC-169, the design guide (C-03, C-04, C-06).

## Intent
- P1 maps a tenant's connection to the canonical contract and validates it from the console (M2–M4), following the one-SQL-per-entity model (DEC-169).
- P1 reads the template catalog and the canonical contract (M1) without outside tools.

## Scope

### In Scope
- Navigation: "Plantillas" and "Contrato" in "Global" after Tenants; "Mapeo y validación" in "Puesta en marcha" after Agentes (DEC-165 order).
- **Plantillas** (`#plantillas`, global, read-only): name, automation, format, freshness tolerance; "Ver" opens a side panel with the entities it needs, its parameters and its statement.
- **Contrato** (`#contrato`, global, read-only): one block per entity (name, obligatory or optional) with its fields: name, type, obligatory or optional, automations that use it.
- **Mapeo y validación** (`#mapeo`, active tenant): choose a connection; per contract entity its state, its SQL in an editor with "Guardar" (`PUT …/vistas-canonicas/:entidad`), and the last diagnostics per field (verdict, column, observed type, cast hint); "Validar" (`POST …/validacion-mapeo`) shows the new report, or the session failure (phase, category, code) without losing the previous verdicts; the three automations with their state and every reason.

### Out of Scope
- Generating SQL from columns or listing the replica's columns (DEC-169).
- Editing templates from the console (create and replace stay API-only).
- Tiempos de alta and Auditoría (CH-30e).

## Capabilities

### Modified Capabilities
- `query-console`: navigation adds three items; the three screens.

## Approach
Same pattern as CH-30b and CH-30c: static markup with ids, everything the API answers written as text by the script, no `zd-*` class from the script, tenant routes through `pedir()`, global ones through `fetch` with the 401 check. The Mapping screen builds one block per entity from the report, which always lists the five contract entities in order.

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A session failure read as "every entity invalid" | Medium | The screen checks `resultado` first and shows the failure apart, keeping the last report |
| Saving SQL wipes a validation silently | Low | After saving, the entity shows "Sin validar" (DEC-41) and asks to validate |
| Stored SQL or a template statement rendered as markup | Low | Written with `textContent` and `textarea.value` only |

## Review Workload Forecast
- PR1: navigation, Plantillas and Contrato with tests: ~380 lines
- PR2: Mapeo y validación with tests: ~480 lines (split if it passes 400)
Total ~860; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (session strategy `single-pr`).
