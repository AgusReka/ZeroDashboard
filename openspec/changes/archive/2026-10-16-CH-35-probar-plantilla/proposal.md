# Proposal: CH-35 — Testing a template against a connection from the console

**Status**: ready for spec and design. Inputs: exploration.md, DEC-177, DEC-62, DEC-11, DEC-61, DEC-159, the audit of 2026-10-13 (§3.2, F3).

## Intent
The operator sees what a template returns on a tenant's mapping before creating an automation, from the console, without writing SQL or creating a saved query.

## Scope

### In Scope
- **«Probar en el tenant activo»** in the template side panel. It holds a connection of the active tenant, one input per declared parameter, and «Probar». «Probar» sends `POST /plantillas/:id/prueba` and shows the first page of the result as a table, with the row count and whether there are more.
- Every refusal is legible: unapproved views (naming the entities and pointing to Mapeo y validación), invalid parameters, an execution failure, unknown connection or template, an unreadable credential, and tenant failures.
- With no active tenant, the block says what to choose and sends nothing. Another template, closing the panel or a tenant switch clears the result.
- `docs/02-mapa-de-changes.md` gains the CH-35 row. DEC-177 is already recorded.

### Out of Scope
- Turning a template into a saved query, a third query kind, or editing a template (DEC-177).
- Paginating the test result.
- Any route, migration or engine change.

## Capabilities

### Modified Capabilities
- `query-console`: Templates Screen (adds the test against the active tenant).

## Approach
Front end only, in `src/consola.ts`. The new block is static markup inside `#plantilla-panel`, and its ids are registered in `IDS`. The script reuses `construirValores`, `valoresDe`, `ponerOpcionesConexion`, `renderizarTabla`, `mensajeDeFallo`, `MENSAJES_ERROR`, `manejarFalloDeTenant` and `pedir`. All API text is written with `textContent`, and no `zd-*` class is set from the script (G3').

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`
- `openspec/specs/query-console/spec.md` (at archive), `docs/02-mapa-de-changes.md`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A global screen sends a tenant-scoped request with no tenant | Low | `pedir` refuses with no tenant; the block checks first and says so |
| A stale result from the previous template or tenant stays on screen | Medium | Cleared on `verPlantilla`, on close and on tenant switch, with tests |
| New ids or classes break `verificarIds` or G3' | Medium | Static markup, ids in `IDS`, plain script elements |
