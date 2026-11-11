# Project Environment Specification (CH-49 delta)

All the demo seed's new writers (reports, dashboards, Telegram link, agent) are specified here, as part of the seed. The specs `report-catalog`, `tenant-dashboard`, `telegram-link` and `agent-registration` keep their requirements unchanged: the seed writes through the same checks those specs define, and their routes and flows do not change. So no delta is needed for them.

## MODIFIED Requirements

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
- tenant "Food Store", its connection to `replica-demo` (`food_store`) with the credential enciphered (CH-07), the five canonical views, one saved query, a panel user with `DEMO_PANEL_CORREO` and `DEMO_PANEL_CLAVE`, and the daily automation of "Alerta de stock físico" with the recipient `DEMO_PANEL_CORREO`;
- tenant "Café del Puerto", its connection to `replica-demo` (`cafe_demo`), its five canonical views, its own panel user and one active daily automation;
- the seeded reports and both dashboards ("Seeded Demo Reports and Dashboards");
- Food Store's every-minute automations and, when configured, its Telegram link ("Seeded Every-Minute Automations and Telegram Link");
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

## ADDED Requirements

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
With `SEED_DEMO=1`, the seed SHALL create on Food Store, by fixed id and only when missing, an active automation with the schedule `* * * * *`, the email channel, between 2 and 5 recipients and a `minimoFilas` above 1. These automations SHALL be created on every seeded start, with no opt-in variable. The existing daily automation SHALL be kept.

When `DEMO_TELEGRAM_CHAT_ID` is set, the seed SHALL validate it as a signed 64-bit integer, and SHALL create Food Store's `VinculoTelegram` with that chat only if the tenant has no link. An existing link, even to another chat, SHALL NOT be touched. Only when Food Store is linked SHALL the seed also create, by fixed id and only when missing, an active every-minute automation on the Telegram channel. Café del Puerto SHALL NOT be linked. The seed SHALL NOT read `TELEGRAM_BOT_TOKEN`. A malformed chat id SHALL fail the seed naming `DEMO_TELEGRAM_CHAT_ID` without echoing its value. The chat id SHALL NOT be written to a log.

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
