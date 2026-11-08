# Archive Report: CH-47

**Change**: CH-47 — Chart.js vendored in `public/ui/vendor/` (DEC-184, DEC-200)
**Archived at**: 2026-11-08, on branch `ch47/archivo` from `master`, after PR #243 (the change, merge commit `e305067`) was merged into `master`.
**Destination**: `openspec/changes/archive/2026-11-08-CH-47-chartjs/`

**Main specs synced** (composed by script from the delta, each requirement title checked to appear exactly once afterwards; every existing requirement and scenario kept; line endings preserved as CRLF; every MODIFIED title matched a main requirement exactly, so no name mismatch occurred):
- `shared-visual-system`: 1 added ("Vendored Chart Library Is Pinned (CH-47, DEC-184, DEC-200)", after "Vendored Files Are Verbatim"), 5 modified, replaced entirely ("Fixed-List Stylesheet Registrar", "Assets Are Loaded at Boot and Fail Closed", "Response Headers", "Assets Carry No Tenant Data (Rule 2)", "Vendored Files Are Verbatim"). The Purpose line now names the vendored library.

Totals: 1 requirement added, 5 modified and 0 removed in one capability, with 18 scenarios in the delta spec.

**Decisions**: DEC-200 (Chart.js 4.6.1 `dist/chart.umd.js`, one more row in the closed list of DEC-124 with a content type per row, committed by hand, sha256 pinned in a test, `public/ui/vendor/* -text`), building on DEC-124 and DEC-184.

**Final state**:
- Tasks 12/12 complete, none unchecked.
- Verify report: PASS WITH WARNINGS, 0 critical, 2 warnings, 4 suggestions, 6/6 requirements, 17/18 scenarios.
  - The verifier ran `npm pack chart.js@4.6.1` again: `chart.umd.js` and the license are byte-identical to `public/ui/vendor/` and to the committed blobs, and the index stores them as `-text` with LF.
  - W1: the scenario "Parity with the skill" has no automated test. It is unchanged since CH-21a, and a manual `diff -q` over the five stylesheets found no difference. This is the scenario without a covering test.
  - W2: the script was loaded only in a bare `node:vm` context, never in a real browser. No page loads it until CH-48.
- `npm run test:db`: 2023/2027. The 4 failures are the known ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4 and CH-07), where the password `postgres` matches `"motor":"postgres"`.
- PR #243 was merged with `size:exception`, for the 205 KiB vendored file only.

**Archive gate**: the native validator did not admit the verify envelope because `test_exit_code` is 1, caused only by those 4 environmental false positives. The maintainer decided to archive by hand, as in CH-40 to CH-46, and this report records it. The gate was not satisfied and no value in any report was changed to pass it.

**Follow-ups** (not scheduled):
1. CH-48 loads `/ui/vendor/chart.umd.js` in the panel; that is the first real-browser check of the file (W2).
2. Repair the 4 failing `src/conexiones/conexiones.test.ts` cases in a separate change, so the suite exits 0 and the archive gate passes. This gate has now blocked eight archives.
3. Verify S3: `src/consola/consola-auth.ts` also spreads `ESTILOS_EXENTOS`, so the script is exempt from the operator session as the stylesheets are. No spec names that second consumer; record it if the list grows again.
4. Verify S2: rewrap the edited comment in `src/aislamiento/contexto-tenant.test.ts` and update the describe title that still says "stylesheet".

**Map**: the CH-47 row of `docs/02-mapa-de-changes.md` already carries PR #243, so it needs no change in this branch.
