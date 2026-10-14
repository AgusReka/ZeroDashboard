# Project Environment Specification (CH-31 delta)

## Purpose
The suite gets its own database, and a fresh environment can start with a working demo tenant (DEC-170, DEC-171).

## ADDED Requirements

### Requirement: Tests Run Against Their Own Database (DEC-170)
`npm run test:db` SHALL create the database named by `TEST_DB_NAME` (default `zerodashboard_test`) when it does not exist, apply every migration to it, and run the whole suite with `TEST_DB_NAME` set to it. It SHALL read the server coordinates from `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER` and `TEST_DB_PASSWORD`, and SHALL refuse to run when the resolved name equals `POSTGRES_DB` or `zerodashboard`.

#### Scenario: A full run leaves the development database untouched
- **GIVEN** the development database holds N tenants
- **WHEN** `npm run test:db` runs the full suite
- **THEN** the development database still holds N tenants

#### Scenario: First run on a new machine
- **GIVEN** `zerodashboard_test` does not exist
- **WHEN** `npm run test:db` runs
- **THEN** the database is created, migrated, and the suite runs against it

#### Scenario: Pointing the suite at the development database
- **WHEN** `TEST_DB_NAME=zerodashboard npm run test:db` runs
- **THEN** it exits with an error naming the variable, and no test runs

### Requirement: Demo Replica Under an Opt-In Compose Profile (DEC-170)
Compose SHALL define a `replica-demo` service, started only with the `demo` profile, running PostgreSQL 16 and initialised from versioned files under `docker/replica-demo/`: the `food_store` schema and data with the five contract views, and a read-only user whose name is `lector_zerodashboard` and whose password comes from `REPLICA_DEMO_PASSWORD`. That user SHALL have `SELECT` and no write privilege. The versioned data SHALL hold no personal data. The default `docker compose up` SHALL be unchanged.

#### Scenario: Starting with the demo profile
- **WHEN** `docker compose --profile demo up` runs on an empty volume
- **THEN** `replica-demo` answers, its five `v_*` views return rows, and an `INSERT` by the read-only user is refused

#### Scenario: Default start
- **WHEN** `docker compose up` runs with no profile
- **THEN** `replica-demo` is not started and the app starts as before

### Requirement: Opt-In Demo Seed (DEC-171)
When `SEED_DEMO=1`, the seed SHALL, after the catalog, create whatever is missing of: operator `demo` with the password `DEMO_OPERADOR_CLAVE`; tenant "Food Store"; its connection to `replica-demo` with the credential enciphered (CH-07); the five canonical views; one saved query; a panel user with the email `DEMO_PANEL_CORREO` and the password `DEMO_PANEL_CLAVE`; and an active automation of "Alerta de stock físico" with `umbral` 5, a daily schedule and the recipient `DEMO_PANEL_CORREO`. Each row SHALL have a fixed id, and an existing row SHALL NOT be read, changed or deleted. When it creates the views, it SHALL validate them with the same probe as `POST /conexiones/:id/validacion-mapeo`. When `SEED_DEMO` is unset or not `1`, the seed SHALL behave exactly as before. When `SEED_DEMO=1` and a required variable is missing, the replica does not answer, or an entity is not valid after the probe, the seed SHALL fail naming the cause and never a secret.

#### Scenario: Fresh demo
- **GIVEN** an empty volume, the `demo` profile and `SEED_DEMO=1`
- **WHEN** the environment starts
- **THEN** the console shows Food Store with one connection, five "Válida" entities, one saved query and one active automation, and the operator `demo` and the panel user can sign in

#### Scenario: Restarting keeps the owner's edits
- **GIVEN** the demo was seeded and the operator edited the saved query
- **WHEN** the app restarts with `SEED_DEMO=1`
- **THEN** the query keeps the edit and nothing is duplicated

#### Scenario: Missing variable
- **GIVEN** `SEED_DEMO=1` and no `DEMO_OPERADOR_CLAVE`
- **WHEN** the seed runs
- **THEN** it fails naming `DEMO_OPERADOR_CLAVE`

#### Scenario: Demo off
- **WHEN** the seed runs without `SEED_DEMO`
- **THEN** it creates only the tenant (when there are none) and the catalog, as before

### Requirement: Demo Variables Ship Only as Placeholders
`.env.example` SHALL list `SEED_DEMO`, `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE`, `DEMO_PANEL_CORREO` and `DEMO_PANEL_CLAVE` with empty or placeholder values, and how to start the demo with the `demo` and `correo` profiles.

#### Scenario: Copying the example
- **WHEN** `.env.example` is copied as is
- **THEN** `SEED_DEMO` is off and no demo password has a usable value
