# Proposal: CH-30e1 — Audit screen in the console

**Status**: ready for apply. Inputs: `../2026-10-16-CH-30e-auditoria-y-tiempos-de-alta/exploration.md`, DEC-178, DEC-163, DEC-162, DEC-165, screen C-12 of the design guide.

## Intent
The operator sees what was executed against the active tenant's replica, when, by whom and with what result (A5), from the console, instead of calling `GET /auditoria` by hand.

## Scope

### In Scope
- «Auditoría» at the end of "Trabajo diario" (DEC-165) and its `#auditoria` screen, scoped to the active tenant.
- Filters «Desde», «Hasta» (local days) and «Resultado», sent as the route's `desde`, `hasta` and `resultado`.
- A read-only table: date and time, operator, origin, connection name, query, SQL summary with the full statement on demand, rows, duration and result with the console's failure message.
- Legible states: no tenant, inverted dates, empty list, cut list (200 rows), `400`, network, tenant and HTTP failures.
- `guidelines/consola.md`, both copies: C-12 marked as built.

### Out of Scope
- Tiempos de alta and `GET /tiempos-alta` (CH-30e2, DEC-178).
- Any route, migration or change to the audit itself; pagination beyond the 200-row cap; filters the route does not take (operator, origin).
- Changing or deleting a row (DEC-162).

## Capabilities

### Modified Capabilities
- `query-console`: Navigation by Hash (adds `#auditoria`); adds the Audit Screen requirement.

## Approach
Front end only, in `src/consola.ts`, following the Conexiones screen: static markup with ids in `IDS`, one loader with the usual failure ladder, rows built with `celdaTenant` and `textContent`, no `zd-*` class from the script (G3'). Connection names come from `GET /conexiones`; failure text from `mensajeDeFallo`.

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`
- `.claude/skills/zerodashboard-design/guidelines/consola.md` and its `.agents/` copy
- `openspec/specs/query-console/spec.md` (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Date-only filters read as UTC days hide rows near midnight | Medium | The screen sends local-day bounds as ISO instants; a test pins them |
| A slow answer for the previous tenant or filters overwrites a newer one | Medium | Generation counter, as in `opcionesDeVia` |
| A statement with markup is rendered as HTML | Low | Every value through `textContent`; a `<b>` test |
| New ids break `verificarIds` or G3' | Medium | Static markup, ids in `IDS`, plain elements from the script |
