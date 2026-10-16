# Archive Report: CH-30e2

**Change**: CH-30e2 — Onboarding times route and screen (G1; second cut of CH-30e, DEC-178)
**Archived at**: 2026-10-16, after PR #190 was merged. PR #189 carried the same commits but was merged into `ch30e1/archivo` after that branch was already in `master`, so #190 re-opened them against `master`.
**Destination**: `openspec/changes/archive/2026-10-16-CH-30e2-tiempos-de-alta/`

**Main specs synced**:
- `onboarding-timing-marks` gains "Active Tenant Marks Route (DEC-178)" and "Route and Script Parity"; "No Schema, Route, or Engine Change" is replaced in place: it binds the CH-15 diff, and the DEC-178 route does not read the script. The purpose names the route. Requirements go from 8 to 10, scenarios from 13 to 16.
- `query-console`, "Navigation by Hash", is replaced in place: "Puesta en marcha" ends with `#tiempos`. It gains "Onboarding Times Screen". Requirements go from 48 to 49, scenarios from 141 to 145.

## Artifacts

proposal.md, specs (onboarding-timing-marks, query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Umbrellas closed

- `2026-10-16-CH-30e-auditoria-y-tiempos-de-alta/`: the CH-30e exploration, shared by CH-30e1 and CH-30e2, both archived.
- `2026-10-16-CH-30-rediseno-de-la-consola/`: the CH-30 exploration. CH-30a to CH-30e2 are archived, so CH-30 is closed in `docs/02-mapa-de-changes.md`.

## Decisions

- **DEC-178** (taken 2026-10-16): the route this change built.
- `size:exception`, accepted by the user on 2026-10-16, to keep one PR per change as DEC-178 says (~556 lines of code and tests).

## Verify summary

PASS (see `verify-report.md`):
- `tsc --noEmit` and `npm run build` are clean.
- `consola.test.ts`: 316 of 316, with 8 new CH-30e2 tests.
- `tiempos-alta-rutas.test.ts` and `marcas-alta.test.ts` against the test database: 17 of 17.
- `npm run test:db`: 1492 of 1496. The 4 failures are the known `conexiones` false positives.

## Final state

- `GET /tiempos-alta` answers the DEC-89 marks of each connection of the header tenant, through the isolated client, capped at 200 with `truncado`.
- A live test keeps the route equal to `scripts/marcas-alta.sql` on one fixture; the script stays the cross-tenant P4 tool (DEC-90) and no application module names it.
- The console's Tiempos de alta screen shows one stage list per connection, with elapsed time only when the previous reached stage is not later.

## Open items

None for CH-30. The "Etapa" column in Tenants that the design guide mentions is not planned.
