# Archive Report: CH-30b

**Change**: CH-30b — Tenants and Connections screens (second cut of CH-30; stories T1, A1)
**Archived at**: 2026-10-13
**Destination**: `openspec/changes/archive/2026-10-13-CH-30b-tenants-y-conexiones/`
**Main specs synced**: `openspec/specs/connection-registration/spec.md` ("Listing the Active Tenant's Connections" replaced by its modified version) and `openspec/specs/query-console/spec.md` ("Navigation by Hash" replaced; "Tenants Screen" and "Connections Screen" appended)

## Artifacts

exploration.md, proposal.md, specs/connection-registration/spec.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-167: the screens show what the API already has; `GET /conexiones` answers the public connection fields; no migration.
- DEC-168: a deactivated tenant cannot be chosen as the active one; DEC-14 unchanged.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1270 of 1274 tests pass and the other four are the known `conexiones` false positives; every spec scenario has an automated test; the user did the visual pass on 2026-10-13.

## Final state

- `src/conexiones.ts`: `GET /conexiones` selects `ConexionPublica`; `ConexionListada` removed.
- `src/consola.ts`: navigation groups Global (Tenants), Puesta en marcha (Conexiones), Trabajo diario; the Tenants screen (list, create, choose, inline baja confirmation); the Conexiones screen (list, side panel with "Guardar y probar", per-row "Probar"); `cambiarTenant(id)` as the one path that changes the active tenant.
- `src/consola.test.ts`: a guard against functions declared twice in the console script.

## Open items

- CH-30c (Agentes and Usuarios del panel) is next.
