# Tasks: CH-30b — Tenants and Connections screens

Branch base: `master` (after CH-30a). Strict TDD: the test cases first, against `npm test`.

## Review Workload Forecast
- Estimated changed lines: ~700 (PR1 ~330, PR2 ~370)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`). **Decided 2026-10-13: chained PRs, stacked-to-main.**

## PR0 — Planning
- [ ] 0.1 DEC-167 and DEC-168, exploration, proposal, specs, design and tasks (`ch30b/exploracion`).

## PR1 — Navigation groups and the Tenants screen
- [x] 1.1 RED (11 failures): navigation order and the `#tenants` hash; Tenants rows (active, deactivated), create, choose, inline confirmation, deactivating the active tenant.
- [x] 1.2 GREEN: markup, `cargarTenantsPantalla()`, the actions; `cambiarTenant(id)` extracted from the selector's change handler. The first GREEN broke seven automation tests: a new `boton()` replaced an existing one (function declarations hoist). Renamed, and a guard added: no function is declared twice in the script (mutation-checked).

## PR2 — Connections
- [x] 2.1 RED (10 console failures, the listing test): `GET /conexiones` public fields; Conexiones screen cases (no tenant, rows, save and test, probe ok and failure, no password in the page).
- [x] 2.2 GREEN: `ConexionPublica` in the listing (`ConexionListada` removed; `actualizadaEn` included, spec and DEC-167 aligned); markup, panel and script. The widening made `aislamiento.test.ts` T2-L hit the `postgres` password false positive (`"motor":"postgres"`): the check now looks for the credential in every field but `motor`.
- [ ] 2.3 Manual visual pass of both screens at 360 px and 1280 px, light and dark.

## Close
- [ ] 3.1 Full suite, `tsc --noEmit`, `npm run build`.
- [ ] 3.2 Verify, archive, sync `connection-registration` and `query-console` into `openspec/specs/`, mark CH-30b in `docs/02-mapa-de-changes.md`.
