# Proposal: CH-31 — Development and test data

**Status**: ready for spec and design. Inputs: exploration.md, DEC-170, DEC-171, DEC-125 (create-if-absent seeding), DEC-159/DEC-160 (audit), rules 3 and 7 of `AGENTS.md`.

## Intent
- The test suite runs against its own database, never against the development one, and no longer needs the `app` container stopped.
- A fresh `docker compose up` on any machine, with the demo turned on, gives a working tenant end to end: a replica, a validated mapping, a saved query, an active automation, a panel user and an operator.

## Scope

### In Scope
- `npm run test:db`: creates `zerodashboard_test` if absent, applies the migrations to it and runs the suite with `TEST_DB_NAME=zerodashboard_test`.
- A `replica-demo` Compose service under the `demo` profile: Postgres 16 initialised from `docker/replica-demo/` — the `food_store` schema and data (dumped once, `user` rows replaced by neutral values), the five contract views, and a read-only user whose password comes from `REPLICA_DEMO_PASSWORD`.
- The demo seed, only with `SEED_DEMO=1`: operator `demo`, tenant "Food Store", connection to `replica-demo` enciphered at seed time, the five canonical views (`SELECT … FROM v_<entidad>`), the mapping validated with the shared probe and audited as the demo operator, one saved query, an active automation on "Alerta de stock físico", and a panel user. Fixed ids, create-if-absent.
- The probe of `POST /conexiones/:id/validacion-mapeo` extracted to a function shared by the route and the seed; the route's behaviour does not change.
- `.env.example`: the new variables as placeholders, and how to start the demo.

### Out of Scope
- Tests that use `replica-demo` (DEC-170).
- Generating more realistic data for `food_store` (a later SQL file, by the owner).
- Any change to routes, the console or the panel.
- Making the dev database's fixture cleanup automatic: with the suite moved away it is no longer polluted.

## Capabilities

### Modified Capabilities
- `project-environment`: separate test database; `replica-demo` service; opt-in demo seed.
- `execution-audit`: the demo seed's mapping validation records one row.

## Approach
- The test script is a small Node script in `scripts/` that reads `TEST_DB_*`, creates the database through the maintenance database if missing, runs `prisma migrate deploy` with a `DATABASE_URL` built from the same variables, then `tsx --test`.
- `replica-demo` uses the official image's `docker-entrypoint-initdb.d`: `01-esquema-y-datos.sql` (the dump), `02-lector.sh` (creates the read-only user from the environment and grants `SELECT`).
- The app `depends_on` `replica-demo` with `required: false`, so the default `up` is unchanged.
- `prisma/seed.ts` calls a new `sembrarDemo()` after the catalog when `SEED_DEMO=1`. It reuses `cifrarCredencial`, `hashearClave`, `sondearEstructura`, the extracted verdict writer and `filaDeAuditoria`.

## Affected Areas
- `docker-compose.yml`, `docker/replica-demo/*`, `.env.example`
- `scripts/test-db.mjs`, `package.json`
- `prisma/seed.ts`, a new `src/semilla-demo.ts` with `src/semilla-demo.test.ts`
- `src/validacion-mapeo-rutas.ts` (extraction), `src/validacion-mapeo.ts` or a sibling module

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Demo credentials leak into a real deployment | Low | Opt-in only (`SEED_DEMO=1`); passwords come from the environment; nothing is seeded without it |
| The extraction changes the route's behaviour | Medium | The route's existing tests (`validacion-mapeo-rutas.test.ts`) must pass unchanged |
| The dump carries personal-looking data | Low | `user` rows replaced by neutral values before committing; reviewed in the PR |
| A test still writes to the dev database | Medium | `test:db` sets `TEST_DB_NAME`; verified by counting dev tenants before and after a full run |
| Seed fails and blocks `app` from starting | Medium | Only with `SEED_DEMO=1`, with a message naming the cause; without it the seed is unchanged |

## Rollback
Remove `SEED_DEMO` from `.env` (or set it to 0) and start without the `demo` profile: the environment is exactly as before. The test database can be dropped with no effect on the app.

## Review Workload Forecast
- Hand-written code, tests and specs: ~520 lines; the `food_store` dump adds ~600 generated lines of data.
- **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (session strategy `single-pr`).
