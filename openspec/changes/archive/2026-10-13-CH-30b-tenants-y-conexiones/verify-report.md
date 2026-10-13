# Verify Report: CH-30b — Tenants and Connections screens

**Date**: 2026-10-13. **Branches**: `ch30b/tenants`, `ch30b/conexiones`, on `ch30b/exploracion` (PRs #157 to #159). Verified at `c607e92`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. The review assessment was medium risk, so no independent verifier ran.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`) | 1274 tests, 1270 pass, 4 fail: the known `conexiones` false positives (W1). No suite skipped by the reachability probe |
| Manual visual pass | done by the user on 2026-10-13 ("ya quedó"), on the Docker app rebuilt from `ch30b/conexiones` |
| `scripts/smoke.sh` | not run: its console checks come after CH-03, where the pre-existing `postgres` false positive stops it (W1) |

## Spec coverage — `specs/connection-registration/spec.md` (delta)

| Requirement / scenario | Evidence |
|---|---|
| Listing own connections with exactly the public fields, never `credencial` | `conexiones.test.ts` "C1 the listing has exactly the tenant's rows, with the public fields only, by nombre then id" |
| Two tenants | `aislamiento.test.ts` "CH-21c T2-L the connection listing never shows the other tenant's connection" (credential checked in every field but `motor`) |
| Missing tenant | existing `conexiones.test.ts` cases, unchanged and green |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement / scenario | Evidence (`consola.test.ts`, prefix `CH-30b`) |
|---|---|
| Navigation by hash, order of the groups | "the Global group with Tenants comes before the daily-work screens"; "Puesta en marcha with Conexiones sits between Tenants and the daily work"; CH-30a's hash cases, now over five screens |
| Tenants screen: list, create, choose, inline confirmation, deactivating the active tenant | "showing Tenants lists active and deactivated tenants, with actions only for the active ones"; "creating a tenant posts the name and reloads the list and the selector"; "choosing a tenant makes it the active one"; "Dar de baja asks inline first, and cancelling sends nothing"; "deactivating the active tenant returns the console to no tenant and says so" |
| Connections screen: no tenant, list, register and test, failed test, no password in the page | "with no tenant, Conexiones asks for one and sends nothing"; "Conexiones lists the tenant connections as text, each with Probar"; "Guardar y probar registers, empties the password, tests and reloads the list"; "Probar shows a failure with its category and code next to the row" |
| Script hygiene | "no function is declared twice in the script" (added after a name clash broke seven automation tests) |

## Design deviations (accepted)

- `GET /conexiones` answers `ConexionPublica`, which includes `actualizadaEn`; the spec delta and DEC-167's text were aligned to it.
- `ConexionListada` was removed: nothing else used it.

## Warnings

- **W1** — Pre-existing, not caused by CH-30b: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail and the smoke stops at CH-03. The widened listing triggered the same class in `aislamiento.test.ts` T2-L, fixed by checking every field but `motor`.
- **W2** — Out of scope by design (DEC-167, DEC-168): the stored last test, the date of baja, per-tenant counts and the frozen bar state; agents (CH-30c).
