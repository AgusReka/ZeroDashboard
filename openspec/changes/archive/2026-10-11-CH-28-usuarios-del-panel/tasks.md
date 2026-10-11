# Tasks: CH-28 — Panel users managed from the console

Branch base: `master` (after CH-29). Strict TDD: each task pair writes the failing test first, against `npm test` (`TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres` for the live-database files).

## Review Workload Forecast
- Estimated changed lines: ~800 (PR1 ~420, PR2 ~380)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`). **Decided 2026-10-10: chained PRs, stacked-to-main.**

## PR0 — Planning
- [x] 0.1 DEC-155 to DEC-158, exploration marked decided, proposal, specs, design and tasks (this branch, `ch28/exploracion`).

## PR1 — Create and list
- [x] 1.1 RED: `src/usuarios-panel.test.ts` (generator, `normalizarCorreo`, `correoValido`).
- [x] 1.2 GREEN: pure layer of `src/usuarios-panel.ts`.
- [x] 1.3 RED: `src/usuarios-panel-rutas.test.ts` (create, strict body, `correo-en-uso` across tenants, list and its cap, password never in the list or the log, mixed-case panel login with the generated password); shared setup in `src/usuarios-panel-apoyo.ts`.
- [x] 1.4 GREEN: `POST /usuarios`, `GET /usuarios`, registration in `src/rutas.ts`, `normalizarCorreo` in the panel login.

## PR2 — Reset, deactivate, reactivate
- [x] 2.1 RED: `src/usuarios-panel-estado.test.ts` (reset, deactivate, reactivate, two-tenant 404s).
- [x] 2.2 GREEN: the three routes, each in one transaction with the session deletion where the spec says.
- [x] 2.3 `scripts/smoke.sh`: create a panel user, log into the panel with the generated password, deactivate it, panel login refused. Placed before CH-03 so it runs even where the `postgres` false positive stops the script; the final cleanup deletes the smoke tenants' users before the tenants (RESTRICT). Run in Docker on 2026-10-10: the CH-28 section passed.

## Close
- [x] 3.1 Full suite, `tsc --noEmit`, `npm run build`, smoke. 1215/1219 (only the 4 known `conexiones` false positives); smoke CH-28 section passed (verify-report W2, W3).
- [x] 3.2 Verify against the specs, archive, sync `panel-user-management` and `client-panel-auth` into `openspec/specs/`, mark CH-28 in `docs/02-mapa-de-changes.md`.
