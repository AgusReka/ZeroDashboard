# Archive Report: CH-45

**Change**: CH-45 — Reports catalog and screen (R1h, DEC-183, DEC-198)
**Archived at**: 2026-11-07, on branch `ch45/archivo` from `master`, after PR #236 (DEC-198) and PR #237 (the change, merge commit `ef3bb94`) were merged into `master`.
**Destination**: `openspec/changes/archive/2026-11-07-CH-45-reportes/`

**Main specs synced** (composed by script from the delta, each title checked to appear exactly once afterwards; every existing requirement and scenario kept; added requirements placed next to their most related requirement; line endings of each file preserved):
- `report-catalog` (new capability): 8 requirements, 26 scenarios, copied as is.
- `query-console`: 2 added ("Reports Screen (R1h, DEC-183, DEC-198)" and "Report Pop-Up for Create and Edit (DEC-173, DEC-198)", after "Template Message Texts in the Pop-Up (DEC-188, DEC-192)"), 2 modified, replaced entirely ("Navigation by Hash", "Audit Screen").
- `execution-audit`: 2 modified, replaced entirely ("Audit Record", "Every Audited Path Records Its Execution").
- `tenant-isolation`: 1 added ("Reporte Is Outside the Structural Tenant Filter (DEC-183)", after "Plantilla Is Outside the Structural Tenant Filter (DEC-61)").
- `domain-data-model`: 2 added ("Reporte Is a Global Model (DEC-183, DEC-198)", "Audit Rows Can Name a Report (DEC-198)"), at the end.

Totals: 13 requirements added (8 of them in the new capability) and 4 modified across five capabilities, with 64 scenarios in the delta specs.

**Decisions**: DEC-183 (reports as a global catalog, tested on a tenant connection, not a query builder), DEC-198 (declared period, columns by role, row cap by visualization, the audit row can name a report), registered in PR #236.

**Final state**:
- Tasks 28/28 complete, none unchecked.
- Verify report: PASS WITH WARNINGS, 17/17 requirements, 63/64 scenarios.
  - W1 (the row-cap text disagreed with the code) was fixed in commit `7e26070`: design §4 and the `report-catalog` spec now say the ceiling is the cap and the request asks one row more. The code did not change.
  - W2 (no real browser) remains. The console was proven only against the suite's fake DOM.
  - The partial scenario is "Older audit rows" of "Audit Rows Can Name a Report": the null read is covered, but no test migrates a row written before the column existed.
- `npm run test:db`: 1955/1959. The 4 failures are the known ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4 and CH-07), where the password `postgres` matches `"motor":"postgres"`. Per `verify-report` at verification time, any fifth failure would have been a real finding.
- PR #237 was merged with `size:exception`.

**Archive gate**: at archive time the native `sdd-status` blocked archive because `test_exit_code` is 1, caused only by those 4 environmental false positives. The native validator refused the verify envelope for the same reason. The maintainer decided on 2026-11-07 to archive by hand, as in CH-40 to CH-44, and this report records it. The gate was not satisfied and no value in any report was changed to pass it.

**Follow-ups** (not scheduled):
1. Open the Reportes screen in a real browser (W2): layout, focus order, Escape in the dialog, the `Intl` date rendering and the real `fetch` path.
2. Repair the 4 failing `src/conexiones/conexiones.test.ts` cases in a separate change, which also lets the suite exit 0 and the archive gate pass. This gate has now blocked six archives.
3. CH-46: a tenant can have several connections, so the dashboard must decide which one runs each report (noted in `exploration.md`).
4. CH-48: a panel run has no operator, but `RegistroEjecucion.operadorId` is required, so the panel audit needs its own decision (noted in `exploration.md`).

**Map**: the CH-45 row of `docs/02-mapa-de-changes.md` already carries PR #237, so it needs no change in this branch.
