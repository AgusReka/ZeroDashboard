# Proposal: CH-30e2 — Onboarding times route and screen

**Status**: ready for apply. Inputs: `../2026-10-16-CH-30e-auditoria-y-tiempos-de-alta/exploration.md`, DEC-178, DEC-87 to DEC-90, DEC-165, screen C-07 of the design guide.

## Intent
While onboarding a tenant, the operator sees which stage each of its connections has reached and when (G1), from the console. Today the marks only come out of `scripts/marcas-alta.sql`, run by hand across every tenant.

## Scope

### In Scope
- `GET /tiempos-alta`: the DEC-89 marks, one entry per connection of the header tenant, read through the isolated client, capped at `LIMITE_LISTADO` with `truncado` (DEC-178).
- A live test that runs the route and the checked-in script on the same fixture and requires the same marks.
- «Tiempos de alta» at the end of "Puesta en marcha" (DEC-165) and its `#tiempos` screen: one stage list per connection; an unreached stage shows "—" and a neutral «Pendiente».
- Legible states: no tenant, no connections, cut list, network, tenant and HTTP failures.
- `guidelines/consola.md`, both copies: C-07 marked as built, its source fixed (a route, not "API" of CH-15) and its stage «conexión probada» replaced by «conexión registrada» (DEC-88).

### Out of Scope
- Any change to `scripts/marcas-alta.sql`, its test or DEC-90: the script stays the cross-tenant P4 tool.
- Agent marks (DEC-119), a per-tenant aggregate (DEC-89), a "Etapa" column in Tenants, any migration.

## Capabilities

### Modified Capabilities
- `onboarding-timing-marks`: adds the active-tenant route and the parity requirement; the "no route" requirements keep holding for the script itself.
- `query-console`: Navigation by Hash (adds `#tiempos`); adds the Onboarding Times Screen requirement.

## Approach
New module `src/tiempos-alta.ts` modeled on `src/auditoria.ts`: scoped `findMany`/`groupBy`/`findFirst` on `Conexion`, `VistaCanonica`, `Automatizacion` and `Ejecucion`, plus the tenant's own `creadoEn`. Orderings and tie-breaks are done by the database, as in the script, so both use the same collation. The console screen follows Auditoría: static markup with ids in `IDS`, one loader with the usual failure ladder and a generation counter, text only, no `zd-*` class from the script (G3').

The parity test lives in a `*.test.ts` file, which the CH-15 static guard does not scan: no application module references the script.

## Affected Areas
- `src/tiempos-alta.ts` (new), `src/rutas.ts`, `src/tiempos-alta-rutas.test.ts` (new)
- `src/consola.ts`, `src/consola.test.ts`
- `.claude/skills/zerodashboard-design/guidelines/consola.md` and its `.agents/` copy
- `openspec/specs/onboarding-timing-marks/spec.md`, `openspec/specs/query-console/spec.md` (at archive)

## Rules check
Rule 2: the tenant comes from the header context, never from the query. Rule 3: GET only, scoped reads, no write. Rule 4: no SQL string; Prisma only. Rule 5: no credential, host or statement in the answer. Rule 6: no engine change.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Route and script drift apart | Medium | The parity test on one fixture, with ties and nulls |
| One query per connection gets slow | Low | A tenant has few connections; the list is capped |
| Marks read as an ordered timeline | Medium | Elapsed time from the previous stage is shown only when positive; the limits sentence sits on the screen |
| New ids break `verificarIds` or G3' | Medium | Static markup, ids in `IDS`, plain elements from the script |

## Rollback
Revert the PR: the route and the screen are additive, no data or schema changes.
