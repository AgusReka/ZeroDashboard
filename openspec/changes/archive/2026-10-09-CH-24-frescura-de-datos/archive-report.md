# Archive Report: CH-24

**Change**: CH-24 — Data freshness per tenant and per template (F1, F2; screen C-22)
**Archived at**: 2026-10-09
**Destination**: `openspec/changes/archive/2026-10-09-CH-24-frescura-de-datos/`
**Main spec synced**: `openspec/specs/data-freshness/spec.md` (new capability, created from the delta)

## Artifacts

exploration.md, proposal.md, specs/data-freshness/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-142: freshness is declared and shown; the engine does not apply it.
- DEC-143: the last refresh of the replica is declared by the implementer.
- DEC-144: the window is a column of the tenant.
- DEC-145: `PUT /tenants/:id/frescura` and the extended `GET /tenants`.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean; with the app container stopped, 1059 of 1063 tests pass and the other four are the known `conexiones` false positives caused by the database password, which pass with another password; every spec scenario has an automated test; the user did the visual pass on the console on 2026-10-09.

## Final state

- `prisma/schema.prisma` and migration `20261008000000_tenant_frescura` (two nullable columns on `Tenant`), `src/frescura.ts` (pure rule and body validation), `src/tenants.ts` (`PUT /tenants/:id/frescura`, extended `TenantPublico`), `src/consola.ts` (section "Frescura de datos").
- F2 needed no new attribute: `Plantilla.toleranciaFrescuraMinutos` already existed (DEC-66) and is now read by the console.
- No change in `planificador.ts`, no change in the client panel, no new rejection category.

## Open items

- PR1 (~536 lines) and PR2 (~404) exceed the 400-line budget: `size:exception` or split before opening them.
- `docs/02-mapa-de-changes.md` and the C-22 status in the design skill were not updated.
- Run the full suite with the app container stopped and with a database password that does not appear in the API responses (see `verify-report.md`, W3 and W4).
- CH-26 (client warning on activation) will read these two fields; CH-19d1 can replace the declared last refresh with the agent heartbeat without changing the read contract.

## Delivery branches (stacked, local, not pushed)

`ch23/archivo` -> `fix/test-aislamiento-panel-2-16` -> `ch24/exploracion` -> `ch24/servidor` -> `ch24/consola` -> `ch24/archivo`.
