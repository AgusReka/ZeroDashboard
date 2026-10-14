# Tasks: CH-31 — Development and test data

Branch base: `master` (after CH-30d). Tests first where there is code to test, against `npm run test:db` once it exists.

## Review Workload Forecast
- Estimated changed lines: ~520 hand-written (PR1 ~170, PR2 ~350), plus the `food_store` dump (generated data, ~600 lines)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`). **Decided 2026-10-13: chained PRs, stacked-to-main.** PR1 carries the `food_store` dump, generated data that cannot be split cleanly: that PR is marked `size:exception` for the dump only; its hand-written part stays within budget.

## PR0 — Planning
- [x] 0.1 DEC-170, DEC-171, exploration, proposal, specs, design and tasks (`ch31/exploracion`); the change map row; the audit's screen changes renumbered to CH-32a and CH-32b.

## PR1 — Test database and demo replica
- [x] 1.1 `scripts/test-db.mjs` and `npm run test:db`: resolve `TEST_DB_*`, refuse `zerodashboard`/`POSTGRES_DB`, create the database if absent, migrate, run the suite.
- [x] 1.2 The owner dumps `food_store` (`pg_dump --no-owner --no-privileges`) into `docker/replica-demo/01-esquema-y-datos.sql`; replace the `user` rows with neutral values; check that no other table holds personal data.
- [x] 1.3 `docker/replica-demo/02-lector.sh`: the read-only user from `REPLICA_DEMO_PASSWORD`, `SELECT` only.
- [x] 1.4 `replica-demo` service under the `demo` profile, its volume, and the app's optional `depends_on`.
- [x] 1.5 `.env.example`: `SEED_DEMO`, `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE`, `DEMO_PANEL_CORREO`, `DEMO_PANEL_CLAVE` as placeholders; how to start the demo; `TEST_DB_*` for `test:db`.
- [x] 1.6 Check: full `npm run test:db` with `app` running; the dev tenant count is the same before and after; `--profile demo` brings `replica-demo` up, its views answer, an `INSERT` by the read-only user is refused.

## PR2 — Shared probe and demo seed
- [x] 2.1 Extract `registrarVeredictos` from the validation route; `validacion-mapeo-rutas.test.ts` passes unchanged.
- [x] 2.2 RED: `semilla-demo.test.ts` — missing variable; first run with fixed ids and one audit row; second run idempotent and keeps an edit; probe failure throws and creates no automation.
- [x] 2.3 GREEN: `src/semilla-demo.ts` (`sembrarDemo`, `leerEntornoDemo`, `IDS_DEMO`); `prisma/seed.ts` calls it before `sembrarTenant()` when `SEED_DEMO=1`.
- [x] 2.4 Check the five views' SQL and the saved query against `replica-demo` (probe "valida" for all five; the query runs with `umbral`).
- [x] 2.5 Manual: `docker compose down -v`, then `--profile demo --profile correo up` with `SEED_DEMO=1`; walk the console and the panel per the "Fresh demo" scenario.

## Close
- [x] 3.1 `npm run test:db`, `tsc --noEmit`, `npm run build`.
- [x] 3.2 Verify, archive, sync `project-environment` and `execution-audit` (append the new requirements), mark CH-31 in `docs/02-mapa-de-changes.md`; update the memory note on how to run tests with a database.
