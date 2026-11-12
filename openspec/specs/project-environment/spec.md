# Spec: project-environment

Source of truth for the `project-environment` capability. Merged from `CH-01-app-scaffolding-and-environment` on 2026-09-15 (archived at `openspec/changes/archive/2026-09-15-CH-01-app-scaffolding-and-environment/`).

## Requirements

### Requirement: Reproducible Local Environment

The system SHALL provide a Docker Compose definition that starts the application and its own database with a single command, without additional manual setup steps.

#### Scenario: Bringing the environment up from a clean checkout

- **GIVEN** a clean checkout of the repository with Docker installed, and an environment file populated from the provided example
- **WHEN** a developer runs the Compose bring-up command
- **THEN** the application container and the own-database container SHALL both reach a running state
- **AND** the application SHALL be able to connect to its own database

### Requirement: Own Database via Migrations

The own-database schema SHALL be created and changed only through migrations. Manual or ad hoc schema statements SHALL NOT be part of the setup or run process.

#### Scenario: Applying migrations to an empty database

- **GIVEN** a running own-database instance with no schema
- **WHEN** the migration command is run
- **THEN** the own database SHALL reach the expected schema state
- **AND** re-running the same migration command SHALL NOT change the schema further or produce an error

### Requirement: Environment-Variable Configuration

Application configuration values that vary between environments (at minimum: own-database connection and application port) SHALL be supplied through environment variables. The application SHALL NOT hardcode these values.

#### Scenario: Changing configuration without a code change

- **GIVEN** the application configured via environment variables
- **WHEN** an operator changes an environment variable value (for example, the own-database connection) and restarts the application
- **THEN** the application SHALL use the new value
- **AND** no source file SHALL require modification for that change to take effect

### Requirement: Secrets Excluded From the Repository

The repository MUST NOT contain real secret values. An example environment file with placeholder values MUST be committed instead, and the file holding real values MUST be excluded from version control.

#### Scenario: Inspecting a fresh clone for secrets

- **GIVEN** a fresh clone of the repository
- **WHEN** the environment file used to run the application locally is created from the committed example
- **THEN** the committed example file SHALL contain only placeholder values
- **AND** the file with real values SHALL be ignored by version control

### Requirement: Verifiable Application Skeleton

The application skeleton SHALL expose a way to verify, from outside the process, that it started successfully and can reach its own database.

#### Scenario: Checking the skeleton is alive after bring-up

- **GIVEN** the application and its own database running via Compose
- **WHEN** a readiness check is requested from the application
- **THEN** the application SHALL report a ready status
- **AND** that status SHALL reflect a successful connection to the own database
### Requirement: Global Timezone Configuration for Schedule Interpretation (DEC-77)

The system SHALL read a single, deployment-wide timezone from an environment variable, used to interpret every `Automatizacion`'s cron schedule. WHEN unset, it SHALL default to a documented value. No per-tenant or per-automation timezone SHALL be read from any other source.

#### Scenario: Changing the timezone without a code change

- **GIVEN** the application configured with a timezone environment variable
- **WHEN** an operator changes its value and restarts the application
- **THEN** subsequently computed next-fire times SHALL use the new timezone
- **AND** no source file SHALL require modification

#### Scenario: Unset timezone falls back to the documented default

- **GIVEN** the timezone environment variable is unset
- **WHEN** the application starts
- **THEN** it SHALL use the documented default timezone with no startup error

### Requirement: Timezone Variable Ships Only as a Placeholder Example

The committed example environment file MUST document the timezone variable with a placeholder or default value, never a real deployment-specific value.

#### Scenario: Inspecting the example file

- **GIVEN** a fresh clone of the repository
- **WHEN** the committed example environment file is inspected
- **THEN** it SHALL document the timezone variable with a placeholder or default value only
### Requirement: Optional SMTP Configuration From Environment Variables (rule 7, DEC-86)

The system SHALL read its SMTP settings (host, port, secure flag, user, password, sender) from environment variables. These variables SHALL be optional. SMTP is unset exactly when `SMTP_HOST` is absent or empty: in that case the application MUST start without error and SHALL treat SMTP as not configured (runs record `notificacion='no-configurada'`). WHEN `SMTP_HOST` is present, the rest of the SMTP configuration MUST be complete and valid, or the application MUST fail to start with an error that names the offending variable and never its value. Their values MUST NOT be hardcoded.

#### Scenario: Application starts with SMTP unset

- GIVEN `SMTP_HOST` is absent or empty
- WHEN the application starts
- THEN startup SHALL succeed with no error

#### Scenario: SMTP_HOST present but configuration invalid or incomplete

- GIVEN `SMTP_HOST` is set and another SMTP variable is missing or invalid (for example no `SMTP_FROM`, a non-numeric port, or only one of `SMTP_USER` and `SMTP_PASSWORD`)
- WHEN the application starts
- THEN the application SHALL fail to start with an error naming the variable
- AND the error SHALL NOT contain the variable's value

#### Scenario: Changing SMTP settings without a code change

- GIVEN SMTP variables set and an operator changes one and restarts
- WHEN the next notification is sent
- THEN the new value SHALL be used and no source file SHALL require modification

### Requirement: SMTP Variables Ship Only as Placeholders

The committed example environment file MUST document every SMTP variable with an empty or placeholder value, never a real credential, and the Compose definition SHALL forward them to the application without embedding values.

#### Scenario: Inspecting the example file and Compose definition

- GIVEN a fresh clone of the repository
- WHEN the example environment file and Compose definition are inspected
- THEN every SMTP variable SHALL appear with an empty or placeholder value only
- AND no real credential SHALL be present

### Requirement: Optional Telegram Bot Token From the Environment (rule 7, DEC-185)
The system SHALL read the bot token from `TELEGRAM_BOT_TOKEN`. The variable SHALL be optional: absent or empty, the application MUST start without error, SHALL NOT start the Telegram poller, and the panel SHALL report Telegram as not available. The token MUST NOT be hardcoded, MUST NOT be part of the application config object, and MUST NOT appear in any log, error message or HTTP response. At startup the application SHALL log only whether Telegram is `configurado` or `no-configurado`.

#### Scenario: Application starts with the token unset
- **GIVEN** `TELEGRAM_BOT_TOKEN` absent or empty
- **WHEN** the application starts
- **THEN** startup succeeds, the log says `no-configurado`, and no request to Telegram is made

#### Scenario: A wrong token does not stop the application
- **GIVEN** `TELEGRAM_BOT_TOKEN` set to a value Telegram refuses
- **WHEN** the application starts
- **THEN** it serves requests, the poller backs off on `getMe`, and no log carries the value

### Requirement: Telegram Variable Ships Only as a Placeholder
The committed example environment file MUST document `TELEGRAM_BOT_TOKEN` with an empty value, the README variable table SHALL describe it, and the Compose definition SHALL forward it as `${TELEGRAM_BOT_TOKEN:-}` without embedding a value.

#### Scenario: Inspecting the example file and Compose definition
- **GIVEN** a fresh clone of the repository
- **WHEN** the example environment file and Compose definition are inspected
- **THEN** `TELEGRAM_BOT_TOKEN` appears with an empty value only

### Requirement: Local Mail Catcher Under an Opt-In Compose Profile (DEC-81)

The Compose definition SHALL provide a Mailpit service under a named profile, so that it starts only when that profile is requested. The default bring-up (no profile) MUST NOT start it and MUST remain a single-command start of the application and its database.

#### Scenario: Default bring-up excludes the mail catcher

- GIVEN the Compose definition
- WHEN the default bring-up command runs with no profile
- THEN the Mailpit service SHALL NOT start
- AND the application and its database SHALL reach a running state

#### Scenario: Profile bring-up includes the mail catcher

- GIVEN the Compose definition
- WHEN the bring-up runs with the mail profile
- THEN the Mailpit service SHALL start alongside the application and database
### Requirement: Connection Retry Configuration From Environment Variables (DEC-98, DEC-105, DEC-19)

The system SHALL read two global variables: `CONNECTION_RETRY_ATTEMPTS` (total attempts, default 3) and `CONNECTION_RETRY_PAUSE_MS` (fixed pause, default 5000). Attempts MUST be an integer from 1 to 5; pause MUST be a positive integer. WHEN a value is set and invalid (non-numeric, below 1, above 5 for attempts, non-positive pause), the application MUST fail to start with an error naming the variable. Values MUST NOT be hardcoded outside the documented defaults.

#### Scenario: Defaults apply when unset

- GIVEN both variables unset
- WHEN configuration is loaded
- THEN attempts SHALL be 3 and pause SHALL be 5000 ms

#### Scenario: Valid values override the defaults

- GIVEN `CONNECTION_RETRY_ATTEMPTS=5` and `CONNECTION_RETRY_PAUSE_MS=1000`
- WHEN configuration is loaded
- THEN attempts SHALL be 5 and pause SHALL be 1000 ms

#### Scenario: Attempts of 1 disables retry

- GIVEN `CONNECTION_RETRY_ATTEMPTS=1`
- WHEN a connection fails transiently
- THEN the run SHALL make a single attempt

#### Scenario: Out-of-range or malformed value fails startup

- GIVEN `CONNECTION_RETRY_ATTEMPTS` set to `6`, `0`, or `abc`, or `CONNECTION_RETRY_PAUSE_MS` set to `0` or `abc`
- WHEN configuration is loaded at startup
- THEN it SHALL fail with an error naming the offending variable

### Requirement: Retry Variables Ship Only as Placeholders

The committed example environment file and the Compose definition MUST document and forward both retry variables with default or placeholder values only.

#### Scenario: Inspecting example and Compose files

- GIVEN a fresh clone of the repository
- WHEN `.env.example` and `docker-compose.yml` are inspected
- THEN both variables SHALL appear with default or placeholder values only

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

### Requirement: Demo Replica Under an Opt-In Compose Profile (DEC-170, DEC-206)
Compose SHALL define a `replica-demo` service, started only with the `demo` profile, running PostgreSQL 16 and initialised from versioned files under `docker/replica-demo/`. It SHALL hold two databases:
- `food_store`, with its schema, the five contract views and the read-only user `lector_zerodashboard`;
- `cafe_demo`, with its own table design, the five contract views over it and its own read-only user.

Both users SHALL take their password from `REPLICA_DEMO_PASSWORD`, SHALL have `CONNECT` on their own database and `SELECT` only, and SHALL NOT be able to connect to the other database, because `CONNECT` is revoked from `PUBLIC` on both. Dates in both databases SHALL be relative to the moment the volume is initialised, so a fresh volume has orders in the last 7, 30 and 90 days, and every order in `food_store` SHALL have its items. The stock of the products the demo automations read SHALL be set so that the seeded threshold and minimum of rows are met (the numbers are fixed by the design and checked by a documented data query). The versioned data SHALL hold no personal data and SHALL NOT use `random()`. The default `docker compose up` SHALL be unchanged.

#### Scenario: Starting with the demo profile
- **WHEN** `docker compose --profile demo up` runs on an empty volume
- **THEN** `replica-demo` answers, the five `v_*` views of each database return rows, and an `INSERT` by either read-only user is refused

#### Scenario: One tenant's credential cannot open the other database
- **GIVEN** a fresh `replica-demo`
- **WHEN** the `food_store` read-only user connects to `cafe_demo`, or the `cafe_demo` user to `food_store`
- **THEN** the connection is refused

#### Scenario: Recent data on a fresh volume
- **GIVEN** a volume initialised today
- **WHEN** the orders of the last 7 days are read through `v_pedido` in either database
- **THEN** there are rows, and each `food_store` order has at least one item

#### Scenario: Default start
- **WHEN** `docker compose up` runs with no profile
- **THEN** `replica-demo` is not started and the app starts as before

### Requirement: Opt-In Demo Seed (DEC-171, DEC-206)
When `SEED_DEMO=1`, the seed SHALL, after the catalog, create whatever is missing of:
- operator `demo` with the password `DEMO_OPERADOR_CLAVE`;
- tenant "Food Store", its connection to `replica-demo` (`food_store`) with the credential enciphered (CH-07), the five canonical views, one saved query and a panel user with `DEMO_PANEL_CORREO` and `DEMO_PANEL_CLAVE`;
- tenant "Café del Puerto", its connection to `replica-demo` (`cafe_demo`), its five canonical views, its own panel user and one active daily automation;
- the seeded reports and both dashboards ("Seeded Demo Reports and Dashboards");
- Food Store's every-minute automations, one per template, and, when configured, its Telegram link ("Seeded Every-Minute Automations and Telegram Link");
- when configured, Food Store's agent ("Seeded Demo Agent").

Each row SHALL have a fixed id, and an existing row SHALL NOT be read for change, changed or deleted. When it creates a tenant's views, it SHALL validate them with the same probe as `POST /conexiones/:id/validacion-mapeo`. When `SEED_DEMO` is unset or not `1`, the seed SHALL behave exactly as before. When `SEED_DEMO=1` and a required variable is missing, an optional variable is malformed, the replica does not answer, or an entity is not valid after the probe, the seed SHALL fail naming the cause and never a secret or personal value, and the app SHALL NOT start.

#### Scenario: Fresh demo
- **GIVEN** an empty volume, the `demo` profile and `SEED_DEMO=1`
- **WHEN** the environment starts
- **THEN** the console shows Food Store and Café del Puerto, each with one connection, five "Válida" entities and at least one active automation; Food Store also has one saved query; and the operator `demo` and both panel users can sign in

#### Scenario: Restarting keeps the owner's edits
- **GIVEN** the demo was seeded and the operator edited the saved query and a seeded report
- **WHEN** the app restarts with `SEED_DEMO=1`
- **THEN** both keep the edit and nothing is duplicated

#### Scenario: Missing variable
- **GIVEN** `SEED_DEMO=1` and no `DEMO_OPERADOR_CLAVE`
- **WHEN** the seed runs
- **THEN** it fails naming `DEMO_OPERADOR_CLAVE`

#### Scenario: Demo off
- **WHEN** the seed runs without `SEED_DEMO`
- **THEN** it creates only the tenant (when there are none) and the catalog, as before

### Requirement: Demo Variables Ship Only as Placeholders
`.env.example` SHALL list `SEED_DEMO`, `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE`, `DEMO_PANEL_CORREO`, `DEMO_PANEL_CLAVE`, `DEMO_TELEGRAM_CHAT_ID` and `DEMO_AGENTE_TOKEN` with empty or placeholder values (plus the second panel user's variables, if the design adds any), and how to start the demo with the `demo`, `correo` and `agente` profiles. Compose SHALL forward the optional variables without a default value.

#### Scenario: Copying the example
- **WHEN** `.env.example` is copied as is
- **THEN** `SEED_DEMO` is off, no demo password or token has a usable value, and no Telegram link or agent is seeded

### Requirement: Seeded Demo Reports and Dashboards (DEC-206, DEC-198, DEC-199)
With `SEED_DEMO=1`, the seed SHALL create, by fixed id and only when missing, four global reports, one per visualization:
- `numero`: Ventas del período;
- `barras`: Productos más vendidos;
- `linea`: Ventas por día;
- `tabla`: Stock de productos.

Each SHALL read only canonical entities, so it runs on both tenants, and each client-facing text SHALL pass the panel glossary. Before writing a report, the seed SHALL check it with the same input rules as the console route and with `rechazoDeReporte` requiring columns. A rejected report SHALL stop the seed naming the report, and SHALL write nothing for it. After a tenant's views are valid, and only if the tenant has no dashboard, the seed SHALL create its `Tablero` on that tenant's connection: Food Store with the four reports, Café del Puerto with three.

#### Scenario: A seeded report passes the console's checks
- **WHEN** the seed's report list is checked
- **THEN** every entry passes `rechazoDeReporte`, and an entry with an extra key, a wrong role, an empty title or a forbidden term is rejected

#### Scenario: The seeded SQL returns the declared columns
- **GIVEN** each seeded report composed over views built from literal rows
- **WHEN** it runs on the test database with a period date
- **THEN** the returned column names equal the report's declared columns

#### Scenario: An existing dashboard is not touched
- **GIVEN** Food Store already has a dashboard
- **WHEN** the seed runs
- **THEN** that dashboard is unchanged and no second one is created

#### Scenario: Same report, different numbers
- **GIVEN** a fresh demo
- **WHEN** each panel user opens their dashboard
- **THEN** «Ventas» shows a value for 7 and 30 days, and the two tenants show different values

### Requirement: Seeded Every-Minute Automations and Telegram Link (DEC-206, DEC-79, DEC-186, DEC-187, DEC-196)
With `SEED_DEMO=1`, the seed SHALL create on Food Store, by fixed id and only when missing, an active automation on the `stock-fisico` template with the schedule `* * * * *`, the email channel, between 2 and 5 recipients and a `minimoFilas` above 1. This automation SHALL be created on every seeded start, with no opt-in variable. Food Store SHALL have no daily automation; Café del Puerto keeps its own.

When `DEMO_TELEGRAM_CHAT_ID` is set, the seed SHALL validate it as a signed 64-bit integer, and SHALL create Food Store's `VinculoTelegram` with that chat only if the tenant has no link. An existing link, even to another chat, SHALL NOT be touched. Only when Food Store is linked SHALL the seed also create, by fixed id and only when missing, an active every-minute automation on the Telegram channel and the `stock-producible` template (threshold 20, `minimoFilas` 1). Café del Puerto SHALL NOT be linked. The seed SHALL NOT read `TELEGRAM_BOT_TOKEN`. A malformed chat id SHALL fail the seed naming `DEMO_TELEGRAM_CHAT_ID` without echoing its value. The chat id SHALL NOT be written to a log.

#### Scenario: The email arrives on a fresh demo
- **GIVEN** a fresh demo with SMTP or the mail catcher configured
- **WHEN** the next minute starts
- **THEN** the every-minute email automation runs, finds at least `minimoFilas` rows and notifies every recipient

#### Scenario: Linked from the environment
- **GIVEN** `DEMO_TELEGRAM_CHAT_ID` set and Food Store unlinked
- **WHEN** the seed runs
- **THEN** Food Store is linked to that chat and the Telegram every-minute automation exists

#### Scenario: No chat id
- **GIVEN** `DEMO_TELEGRAM_CHAT_ID` unset
- **WHEN** the seed runs
- **THEN** no link and no Telegram automation are created, and the email automation is created

#### Scenario: An existing link is kept
- **GIVEN** Food Store already linked to another chat
- **WHEN** the seed runs with `DEMO_TELEGRAM_CHAT_ID` set
- **THEN** the link is unchanged

#### Scenario: A malformed chat id
- **GIVEN** `DEMO_TELEGRAM_CHAT_ID=abc`
- **WHEN** the seed runs
- **THEN** it fails naming `DEMO_TELEGRAM_CHAT_ID`, and the message does not contain `abc`

### Requirement: Old Replica Volume Fails Loudly (DEC-206, DEC-171)
When `SEED_DEMO=1` and the replica has no `cafe_demo` database, because the volume was created before this change, the seed SHALL fail with a closed message that names the cause and tells to recreate the volume with `docker compose down -v`. It SHALL NOT include the driver's message, and it SHALL NOT leave the second tenant half-created.

#### Scenario: Old volume
- **GIVEN** a `replica-demo-data` volume without `cafe_demo`
- **WHEN** the app starts with `SEED_DEMO=1`
- **THEN** the seed fails with the `down -v` message and the app does not start

### Requirement: Seeded Demo Agent Under an Opt-In Profile (DEC-207)
When `SEED_DEMO=1` and `DEMO_AGENTE_TOKEN` is set, the seed SHALL validate the token's format and SHALL create Food Store's `Agente` by fixed id, only if the tenant has no agent, storing only `hashTokenAgente(token)`. It SHALL validate Food Store's views by probing the replica directly, then store Food Store's connection bound to that agent when it creates the connection. An existing agent or an existing direct connection SHALL NOT be changed. A malformed token SHALL fail the seed naming `DEMO_AGENTE_TOKEN` without echoing it.

Compose SHALL define an `agente` service, started only with the `agente` profile, built from the agent target, with the hardening of `docker-compose.agente.yml` (`read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `init`), reaching the app over loopback and allowed to reach only the demo replica, through the network mode confirmed by the spike. Without the `agente` profile, the environment SHALL behave as before.

#### Scenario: Agent seeded
- **GIVEN** a fresh demo with `DEMO_AGENTE_TOKEN` set and the `agente` profile
- **WHEN** the environment starts
- **THEN** the database holds only the token's hash, Food Store's connection is an agent connection, and a run through it succeeds

#### Scenario: Provoked failure
- **GIVEN** the agent is running
- **WHEN** `docker compose stop agente` runs and the next scheduled run starts
- **THEN** the run fails with code `ESINAGENTE`, and after `docker compose start agente` the next run succeeds

#### Scenario: No token
- **GIVEN** `DEMO_AGENTE_TOKEN` unset
- **WHEN** the seed runs
- **THEN** no agent is created and Food Store's connection is direct
