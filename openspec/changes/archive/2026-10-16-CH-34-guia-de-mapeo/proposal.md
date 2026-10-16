# Proposal: CH-34 — A step-by-step guide and an example SQL per entity on the Mapping screen

**Status**: ready for spec and design. Inputs: exploration.md (D1, D2, D3 resolved 2026-10-16), DEC-176 (narrows DEC-30's resignation), DEC-30, DEC-32, DEC-169, DEC-45, the design guide (`guidelines/pantallas.md` C-08/C-09, `guidelines/lenguaje.md`).

## Intent
- An operator facing an empty editor per entity knows what to write: the steps of the screen in order, and one real SELECT per entity that shows quoted camelCase aliases, casts, a `CASE` and joins.
- The operator can start from the example instead of a blank editor, without the console ever saving SQL the operator did not save.

## Scope

### In Scope
- **Step-by-step** in the static markup of `#pantalla-mapeo`, above the entities, collapsible: choose the connection; per entity, write one SELECT over the replica whose columns are named exactly like the contract fields (camelCase in double quotes) with the contract types; «Guardar» each entity; «Validar mapeo» and read each field's verdict and cast hint; the automations table says which ones the mapping enables. Optional entities can stay unmapped.
- **One fixed example per entity** (DEC-176): the five `v_*` views of the food_store demo replica (`docker/replica-demo/01-esquema-y-datos.sql:579-645`) rewritten as plain SELECTs, shown in each entity block as text, collapsible, labelled as an example over the demo schema.
- **«Usar de punto de partida»** per entity: copies the example into the editor only when the editor is empty (whitespace counts as empty); otherwise it is disabled or says the editor already has SQL. It never sends a request.
- **Alignment test**: each example aliases every field of its entity in `CONTRATO_CANONICO`, quoted when camelCase, and nothing else.
- `docs/02-mapa-de-changes.md` gains the CH-34 row. DEC-176 is already recorded.

### Out of Scope
- Generating SQL from the tenant's columns, listing replica columns, a column picker (DEC-30, DEC-169).
- Any route, migration, validation or engine change.
- Per-tenant or per-platform examples (Medusa, Woo, Saleor).
- The audit's visual pass at 360/1280 px (standing user preference: not added).

## Capabilities

### Modified Capabilities
- `query-console`: Mapping and Validation Screen (adds the guide, the per-entity example and the copy-into-empty-editor action).

## Approach
Front end only, in `src/consola.ts`. The guide is static markup with guarded ids. The examples live as a constant keyed by entity name in the console script and are written with `textContent`. They render inside `bloqueDeEntidad` as plain elements with the `ayuda` class, because G3' forbids new `zd-*` tokens in the script. The copy action sets the textarea's `.value` only when it is blank. To keep the examples testable against the contract without importing server code into the browser string, the constant is defined in a small module that both the console builder and the test import. Design decides where it lives.

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts` (ids, Mapeo tests, G3')
- a new module holding the examples, if design chooses it
- `openspec/specs/query-console/spec.md` (at archive), `docs/02-mapa-de-changes.md`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The examples drift from the contract when a field is added | Medium | Alignment test over `CONTRATO_CANONICO` |
| The examples drift from the demo replica's views | Low | Test or note tying each example to its `v_*` view; the demo SQL file rarely changes |
| A new `zd-*` class or unregistered id breaks G3' / `verificarIds` | Medium | Guide in markup, script nodes use `ayuda`, ids added to `IDS` |
| The copy overwrites operator SQL | Low | Copy only into a blank editor, with a test |
