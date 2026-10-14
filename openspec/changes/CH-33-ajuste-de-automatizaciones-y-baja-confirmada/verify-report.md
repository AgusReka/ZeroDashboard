# Verify report: CH-33 — Adjusting an automation from the console, and a typed confirmation for a tenant's baja

**Verdict: PASS, with two notes.** Branch `ch33/ajuste-y-baja` (commits `01e6d7c`, `b7ea409`, `2d13a3a`, `c48f3e0`), 2026-10-14. One PR with `size:exception` (user decision, tasks.md).

## Evidence
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1448 tests, 1444 pass, 4 fail. The 4 are the known `conexiones` false positives with the `postgres` password (5.1, 5.3, 5.4 and CH-07 in `conexion routes`), unrelated to this change.
- `npx tsc --noEmit` clean; `npm run build` clean.
- Focused runs: `tenants.test.ts` + `contexto-tenant.test.ts` 70/70, `automatizaciones-rutas.test.ts` 20/20, `aislamiento.test.ts` 64/64, `consola.test.ts` 279/279.

## Spec scenarios → tests

| Spec | Scenario | Test |
|---|---|---|
| automation-scheduling | Adjusting keeps the id and the history | `automatizaciones-rutas.test.ts` "CH-33 an adjust changes only the sent columns, keeps the id and the runs…" |
| | Values are checked against the stored template and replaced whole | "CH-33 valores are checked against the stored template…"; units "resolverAjusteOperador returns only the columns…" |
| | Clearing the recipient | "CH-33 valores are checked… a null recipient clears it" |
| | Template, connection and state cannot be adjusted | "CH-33 an adjust body that is empty or names anything but…" (before any read) |
| | Empty body, invalid cron and invalid recipient | same, plus "CH-33 an invalid cron or recipient is a 400 naming it…" |
| | A deactivated automation cannot be adjusted / another tenant's is not found | "CH-33 a deactivated automation answers 409, an unknown or foreign one 404…"; `aislamiento.test.ts` sweep `PUT /automatizaciones/:id/ajustes` both ways |
| | Delete and reactivation do not exist | existing "3.4 …" (`hasRoute` PUT/PATCH/DELETE on `/automatizaciones/:id`, `/activar`) |
| tenant-management | Deactivating preserves rows | existing "3.1 a baja flips activo…", now with the name |
| | A name that does not match deactivates nothing | "CH-33 a name that is not exactly the stored one…"; U12 (sockets stay open on a mismatch) |
| | A baja without the name is refused | "CH-33 a baja without the name, or with any other key, is a 400…" |
| | Already-inactive is safe | existing "3.1 repeating the baja…"; "CH-33 an unknown id and an already-inactive tenant answer before the name…" |
| query-console | Adjust opens prefilled; custom cron; only changed fields; emptied recipient; refusals inside; deactivated rows | `consola.test.ts` "CH-33 «Ajustar» …" block (12 tests) and the updated row-actions assertion |
| | Baja waits for the exact name; deactivate the active tenant; cancel | `consola.test.ts` "CH-33 Dar de baja …" block (7 tests) |
| | Pop-up rule (Cancelar/Escape, discard, tenant switch) | adjust: "CH-33 Cancelar/Escape on the adjust pop-up…", "a tenant switch closes the adjust pop-up…"; existing CH-32b pop-up tests unchanged |

## Notes
1. **Intermittent suite mark.** In the first full run the `GET /api/panel/automatizaciones` suite (CH-22b) was marked failed without any failed test counted (total stayed at 4 failures). It passed alone (44/44) and in a second full run. It looks like the known order dependency of the shared test database, not this change; it was not investigated further.
2. **Attempt ledger.** The apply attempt settled `passed`, but counted 1320 changed lines against the 1200 declared at acquire, so the ledger is `blocked: maintainer_decision` for any new attempt. A further apply on this change needs a maintainer reset first.

## Not done here
- Archive and spec sync (task 4.2): after the merge, as in CH-32b.
- The audit's visual pass at 360/1280 px: not added (standing user preference).
