# Proposal: CH-32a — Saved queries without duplicates, and a connection picker

**Status**: ready for spec and design. Inputs: exploration.md, DEC-172, DEC-11 (a saved query is not bound to a connection), DEC-132/DEC-167 (`GET /conexiones`), CH-25 (versions), the design guide (C-08) and its language rules.

## Intent
- Loading a saved query and saving can no longer create a copy by accident (audit observation 3).
- The operator picks the connection to run against from a list instead of typing its id (audit observation 4).
- The operator can go back to an empty editor without reloading the page.

## Scope

### In Scope
- **Saving with a query loaded (DEC-172):** "Guardar consulta" is hidden while a saved query is loaded; "Guardar como nueva versión" stays. With no query loaded, it shows as today.
- **"Consulta nueva":** empties the SQL, the parameters, the name and the description, and forgets the loaded query. When the editor holds edits that are not saved, it first asks inline with «Descartar cambios» before discarding them.
- **Connection picker:** `#conexion` becomes a `select` filled from `GET /conexiones` (option text: the connection's name and a short id, as in the automation wizard; value: its id), loaded when the tenant is set, like the saved queries. No connection: the select says so. "Ejecutar" with no connection chosen says «Elegí una conexión para ejecutar» and sends nothing.
- Help text of the saved-queries section updated to the new behaviour.

- **Screen path (DEC-173, PR2):** the Consultas screen reads top to bottom as header («Consulta nueva») → a strip with the editor's state and its save action → editor → result → saved queries. Saving opens a side panel («Guardar consulta», or «Guardar como versión N+1» with a query loaded) with «Cancelar»; the version history opens in a wide side panel. No field changes.

### Out of Scope
- Binding a saved query to a connection (DEC-11 stands).
- Creating a query from a template (audit §3.2, a pending product decision).
- The two-column layout of C-08 (it needs a new shared layout class; the single column keeps the order the operator works in).
- Any change to routes or to the API.

## Capabilities

### Modified Capabilities
- `query-console`: saving with a loaded query; "Consulta nueva"; the connection picker.

## Approach
Same pattern as CH-30a to CH-30d: static markup with the existing ids (none renamed: `#conexion` keeps its id and becomes a `select`), everything the API returns written as text, no `zd-*` class assigned from the script (guard G3'), tenant routes through `pedir()`. `olvidarConsultaCargada()` and `recordarConsultaCargada()` already toggle the version block; they also toggle "Guardar consulta".

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A hundred tests set `#conexion` by value | Medium | The fake DOM's `value` works for a select; the tests that need an option add it through the `GET /conexiones` answer of the scenario |
| "Consulta nueva" discards typed work | Medium | Inline confirmation only when the editor differs from the loaded query (or is not the default with none loaded) |
| The select hides a connection created later on the Conexiones screen | Low | The list is reloaded on every visit to Consultas |

## Rollback
Revert the PR: front-end only, no data or API change.

## Review Workload Forecast
- `src/consola.ts` ~140 lines, `src/consola.test.ts` ~180 lines, spec ~40: **~360 lines**. 400-line budget risk: Medium; Chained PRs recommended: No; Decision needed before apply: No.
