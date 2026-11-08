# Archive Report: CH-46

**Change**: CH-46 — Tenant dashboard (R2h, DEC-199)
**Archived at**: 2026-11-08, on branch `ch46/archivo` from `master`, after PR #240 (the change, merge commit `d20098b`) was merged into `master`.
**Destination**: `openspec/changes/archive/2026-11-08-CH-46-tablero/`

**Main specs synced** (composed by script from the delta, each requirement title checked to appear exactly once afterwards; every existing requirement and scenario kept; added requirements placed next to their most related requirement; line endings of each file preserved as CRLF; every MODIFIED title matched a main requirement exactly, so no name mismatch occurred):
- `tenant-dashboard` (new capability): 4 requirements, 14 scenarios, copied as is.
- `query-console`: 1 added ("Tenant Dashboard Screen (R2h, DEC-199)", after "Report Pop-Up for Create and Edit (DEC-173, DEC-198)"), 3 modified, replaced entirely ("Navigation by Hash", "Reports Screen (R1h, DEC-183, DEC-198)", "Report Pop-Up for Create and Edit (DEC-173, DEC-198)").
- `report-catalog`: 1 modified, replaced entirely ("Catalog Routes").
- `tenant-isolation`: 2 added ("Tablero Is Tenant-Scoped (DEC-199)" and "Report Use Is the Single Audited Unscoped Read of Tablero (DEC-199)", after "Reporte Is Outside the Structural Tenant Filter (DEC-183)").
- `domain-data-model`: 1 added ("Tablero Is a Tenant-Scoped Model (DEC-199)"), at the end.

Totals: 8 requirements added (4 of them in the new capability), 4 modified and 0 removed across five capabilities, with 48 scenarios in the delta specs.

**Decisions**: DEC-199 (one dashboard per tenant: connection, ordered list of 0 to 8 distinct reports, reports in use cannot be replaced, a single audited unscoped read of `Tablero`), building on DEC-183 and DEC-198.

**Final state**:
- Tasks 24/24 complete, none unchecked.
- Verify report: PASS WITH WARNINGS, 0 critical, 3 warnings, 12/12 requirements, 46/48 scenarios.
  - W1 (the spec said a duplicate needs its own passing test, but the code keeps «Guardar» enabled from the test of the same content, as the template path does) was fixed in commit `e22208d`: the spec now matches the template duplicate behavior. The code did not change.
  - W2 (no real browser) remains. The console was proven only against the suite's fake DOM.
  - W3 (a stale test database row left by a concurrent verify run) was removed afterwards. It was not a CH-46 defect.
  - The 2 scenarios without a direct test are the `domain-data-model` ones: "One dashboard per tenant" and "The connection cannot vanish under a dashboard" (S2 of the verify report).
- `npm run test:db`: 1984/1988. The 4 failures are the known ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4 and CH-07), where the password `postgres` matches `"motor":"postgres"`. Per `verify-report` at verification time, any fifth failure would have been a real finding.
- PR #240 was merged with `size:exception`.

**Archive gate**: at archive time the native `sdd-status` blocks archive because `test_exit_code` is 1, caused only by those 4 environmental false positives, and the verify envelope was not admitted by the native validator. The maintainer decided to archive by hand, as in CH-40 to CH-45, and this report records it. The gate was not satisfied and no value in any report was changed to pass it.

**Follow-ups** (not scheduled):
1. Open the Tablero and Reportes screens in a real browser (W2): layout, focus order after «Subir», «Bajar» and «Quitar», Escape in the dialog, the `Intl` date rendering and the real `fetch` path.
2. Repair the 4 failing `src/conexiones/conexiones.test.ts` cases in a separate change, which also lets the suite exit 0 and the archive gate pass. This gate has now blocked seven archives.
3. Add the two missing DB cases for `Tablero`: a second dashboard for the same tenant (unique violation) and deleting a connection that has a dashboard (foreign-key violation), so both schema scenarios become directly tested.
4. CH-48: the panel renders the dashboard, and a panel run has no operator while `RegistroEjecucion.operadorId` is required, so the panel audit needs its own decision (noted in CH-45's `exploration.md`).

**Map**: the CH-46 row of `docs/02-mapa-de-changes.md` already carries PR #240, so it needs no change in this branch.
