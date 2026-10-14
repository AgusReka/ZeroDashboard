# Exploration: CH-31 — Development and test data

Status: **decided** (2026-10-13): DEC-170 (own test database, `replica-demo` from `food_store`) and DEC-171, option (b) — the demo seed validates the mapping and creates an active automation. Store: openspec. Origin: the audit of 2026-10-13 (`docs/auditoria-2026-10-13.md`, F0) and the owner's request to get usable demo data after a fresh `docker compose up`, on any machine, without the test suite filling the development database with fixtures.

## What exists (verified)

| Piece | State |
|---|---|
| Test database | The integration helpers read `TEST_DB_HOST/PORT/USER/PASSWORD/NAME`, defaulting the name to `zerodashboard` (e.g. `src/consola-auth-apoyo.ts:16-19`, `src/canal-agente-apoyo.ts:8-12`): the **same database the app uses**. Every full run leaves fixture tenants behind (2026-10-13: 22 tenants, 223 automations, 345 runs). |
| Scheduler interference | The running `app` scheduler processes the fixture tenants too, which breaks tick-counting tests (CH-14 5.11, CH-17a 2.1) and causes the intermittent cleanup error of `panel-automatizaciones.test.ts` (CH-22b, W2 of CH-30c). Today the suite is run with `docker compose stop app`. |
| Seed | `prisma/seed.ts`, run by `docker-entrypoint.sh` on every start after `prisma migrate deploy`: creates tenant "Food Store" only when the table is empty, and the two-template catalog create-if-absent by fixed id (DEC-125). Nothing else. |
| Replica | The only working replica is `food_store`, a fictional database of the owner's university project, served by **another** Compose project on host port 5433. It does not travel with this repository. |
| `food_store` content | PostgreSQL 16; 17 tables, small but coherent data (9 products, 14 ingredients, 26 recipe rows, 99 orders, 194 order items); it **already has the five contract views** `v_producto`, `v_insumo`, `v_receta_componente`, `v_pedido`, `v_item_pedido` (CH-16 era), so each entity maps as `SELECT * FROM v_<entidad>`. Table `user` holds 5 rows with email and `hashed_password`. |
| Read-only user | `lector_zerodashboard` exists in `food_store` (rule 3, second layer). |
| Credentials | Stored enciphered with `CREDENTIAL_MASTER_KEY` (CH-07). A seed can encipher with `cifrarCredencial` at seed time, since the key is in the container environment. Operator and panel passwords are hashed with `hashearClave` (`src/crypto-auth.ts`). |
| Validation | The mapping probe lives inside the route (`src/validacion-mapeo-rutas.ts`), not in a reusable function. |
| Spec | `project-environment` covers the Compose environment, migrations, env variables, secrets and the Mailpit profile; `initial-template-catalog` covers the catalog seed. Nothing covers test isolation or demo data. |

## Shape that fits (no decision needed)

1. **A separate test database** `zerodashboard_test` in the same Postgres. A script `npm run test:db` creates it if absent, applies the migrations to it and runs the suite with `TEST_DB_NAME=zerodashboard_test`. The helpers keep their defaults, so nothing else changes. The scheduler of `app` only reads the development database, so the suite no longer needs `app` stopped.
2. **A `replica-demo` Compose service** (Postgres 16) initialised from versioned SQL under `docker/replica-demo/`: the `food_store` schema and data (dumped once, with the `user` rows replaced by neutral values), the five views, and the read-only user. Its password comes from the environment (rule 7), with a placeholder in `.env.example`. More realistic data later goes into a further SQL file.
3. **An opt-in demo seed** (`SEED_DEMO=1`, never on by default): tenant Food Store, its connection to `replica-demo` enciphered at seed time, the five canonical views with their known SQL, one saved query, a panel user and an operator whose passwords come from the environment. Create-if-absent by fixed id, like the catalog (DEC-125). A full reset is `docker compose down -v && docker compose up`.

The suite keeps its own fixtures; it does not depend on `replica-demo`. Pointing some tests at `food_store` is possible later, not in this change.

## Decision that is not mine to take

1. **How far the demo seed goes.**
   - (a) It leaves the mapping "Sin validar" and creates no automation: the first steps of a demo are the real path (Validar, then create an automation with the wizard).
   - (b) It also validates the mapping and creates an active automation sending to Mailpit, so everything works from the first minute; this needs the validation probe extracted from its route into a reusable function (a backend refactor).

## Size
Compose service and SQL dump (the dump is data, mostly generated), `test:db` script, seed extension with tests, `.env.example`. Estimated ~350 lines of hand-written code and specs, plus the dump.
