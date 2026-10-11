# Tasks: CH-20 — Query execution audit

Branch base: `master` (after CH-28). Strict TDD: each task pair writes the failing test first, against `npm test` (`TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres` for the live-database files).

## Review Workload Forecast
- Estimated changed lines: ~1000 (PR1 ~400, PR2 ~350, PR3 ~250)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR0 — Planning
- [ ] 0.1 Exploration, DEC-159 to DEC-163, proposal, specs, design and tasks (this branch, `ch20/exploracion`).

## PR1 — The record and its listing
- [ ] 1.1 Schema + migration with the trigger (rollback in the header); client regenerated; applied to the dev database; `RegistroEjecucion` in `MODELOS_AISLADOS` and in the model-list test.
- [ ] 1.2 RED: `src/auditoria.test.ts` (pure) and `src/auditoria-tabla.test.ts` (trigger refuses update, delete, truncate; tenant delete still works).
- [ ] 1.3 GREEN: pure layer of `src/auditoria.ts`.
- [ ] 1.4 RED: `src/auditoria-rutas.test.ts`. GREEN: `GET /auditoria` and its registration in `src/rutas.ts`.

## PR2 — Recording in the four paths
- [ ] 2.1 RED: `src/auditoria-registro.test.ts` (one row per path with the operator; refused requests write nothing; bound values absent; forced write failure keeps the answer).
- [ ] 2.2 GREEN: `registrarEjecucion` and its call in `consultas.ts`, `plantilla-prueba.ts`, `validacion-mapeo-rutas.ts` and `conexiones.ts`.

## PR3 — Saved query reference
- [ ] 3.1 RED: `src/consultas-auditoria.test.ts` and the console case in `src/consola.test.ts`.
- [ ] 3.2 GREEN: the optional body fields, `consultaGuardadaVerificada`, and the console sending id and version.

## Close
- [ ] 4.1 Full suite, `tsc --noEmit`, `npm run build`, smoke.
- [ ] 4.2 Verify against the specs, archive, sync `execution-audit`, `query-execution` and `query-console` into `openspec/specs/`, mark CH-20 in `docs/02-mapa-de-changes.md`.
