# Tasks: CH-20 — Query execution audit

Branch base: `master` (after CH-28). Strict TDD: each task pair writes the failing test first, against `npm test` (`TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres` for the live-database files).

## Review Workload Forecast
- Estimated changed lines: ~1000 (PR1 ~400, PR2 ~350, PR3 ~250)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`). **Decided 2026-10-11: chained PRs, stacked-to-main.**

## PR0 — Planning
- [x] 0.1 Exploration, DEC-159 to DEC-163, proposal, specs, design and tasks (this branch, `ch20/exploracion`).

## PR1a — The record (split from the planned PR1, which came out at 590 lines)
- [x] 1.1 Schema + migration with the trigger (rollback in the header); client regenerated; applied to the dev database; `RegistroEjecucion` in `MODELOS_AISLADOS` and in the model-list test.
- [x] 1.2 RED: `src/auditoria.test.ts` (pure) and `src/auditoria-tabla.test.ts` (trigger refuses update, delete, truncate; tenant delete still works). The trigger test passed at once: the trigger was written in 1.1, before its test (not a true RED). A bug found on re-read (a date with an offset that is another day in UTC was refused) got its failing case first.
- [x] 1.3 GREEN: pure layer of `src/auditoria.ts`.

## PR1b — The listing
- [x] 1.4 RED: `src/auditoria-rutas.test.ts`. GREEN: `GET /auditoria` and its registration in `src/rutas.ts`.

## PR2a — Recording: the write, the ad hoc query and the connection probe (split from the planned PR2, which came out at 414 lines)
- [x] 2.1 RED: `src/auditoria-registro.test.ts` (one row per path with the operator; refused requests write nothing; bound values absent; forced write failure keeps the answer and logs `error` without the statement). Target: the Compose database through the suite's own read-only role `ch20_lector`. RED: 7 failures, the queries themselves answering `ok`.
- [x] 2.2 GREEN: `registrarEjecucion` (skips a request with no operator, which only a guard-less test app has) and its call in `consultas.ts` and `conexiones.ts`; `SENTENCIA_PRUEBA` exported by `db-probe.ts`.

## PR2b — Recording: the template test and the mapping validation
- [x] 2.3 GREEN with their cases in `src/auditoria-registro.test.ts`: the composed statement and the template id; every probe statement (`sentenciaDeSondeo`, exported by the engine) and `veredictoDeSondeo`.

## PR3 — Saved query reference
- [x] 3.1 RED: the saved query cases in `src/auditoria-registro.test.ts` (it already holds the tenant, the connection and the operator) and the console cases in `src/consola.test.ts`.
- [x] 3.2 GREEN: the optional body fields, `consultaGuardadaVerificada`, and the console sending id and version.

## PR3 — Review fixes (independent verifier)
- [x] 3.3 RED first (5 failures): the saved query check could throw outside the audit guard and turn an executed query into a 500 — now it falls back to ad hoc; `version` bounded to a 32-bit integer; a date-only `hasta` covers that whole day; after "Guardar como nueva versión" the console keeps the saved version and text; a request without an operator logs `audit skipped` at `error`.

## Close
- [x] 4.1 Full suite, `tsc --noEmit`, `npm run build`. 1252/1256 (only the 4 known `conexiones` false positives). Smoke not run: CH-20 does not touch it (verify-report).
- [x] 4.2 Verify against the specs, archive, sync `execution-audit`, `query-execution` and `query-console` into `openspec/specs/`, mark CH-20 in `docs/02-mapa-de-changes.md`.
