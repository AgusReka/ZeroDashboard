# Exploration: CH-49 — Demo data (second tenant, every-minute automation, linked Telegram, dashboard with reports)

Status: **explored** (2026-11-10), decisions **partly answered** by the user on 2026-11-10: tenant 2 «Café del Puerto» on its own database `cafe_demo`; the every-minute automations **always active** (not behind a flag); Telegram linked from `DEMO_TELEGRAM_CHAT_ID` when set; the agent seeded and run as a compose service in its own profile, after a spike. Not asked yet, recommended: the provoked failure live (`docker compose stop agente`), the four reports, failing on an old replica volume, and the slicing. DEC-206 and DEC-207 are registered (PR #258). No research phase: everything is internal to the repository. Store: openspec. No story (map row: "Reemplaza el pendiente de datos de demo. Es la base del guion del video"). Depends on CH-44 (merged) and CH-48 (merged). Next free decision number: DEC-208 (the planned DEC-203 and DEC-204 were registered as DEC-206 and DEC-207).

Goal: after `docker compose down -v` and one `up`, a fresh environment has everything the video script needs (map, "Pendientes fuera del código"): console with an active tenant and an agent connection, a read-only query and its rejection, a template written live and its preview, an automation with several recipients and a minimum of rows, email and Telegram received, client panel with threshold adjustment and the report dashboard, a provoked failure and tenant isolation.

Constraints that bind this change:
- **AGENTS.md rules 2, 3, 5, 7.** Tenant isolation, read-only in two layers, minimization, secrets out of the repo (the Telegram chat id, the agent token and every password come from the environment).
- **DEC-170 / DEC-171** (`docs/01-decisiones.md:3084`, `:3102`): the demo replica travels with the repo; the seed is opt-in (`SEED_DEMO` exactly `1`), fixed ids, create-if-absent, never update or delete (except the views of the same run when validation fails), runs the **same probe** as `POST /conexiones/:id/validacion-mapeo`, fails loudly naming the cause so the app does not start.
- **DEC-125 / DEC-68**: the catalog is seeded create-if-absent through the route's own checks (`rechazoDeEntrada`); global rows are replaced in place by P1, never deleted.
- **DEC-79**: an automation is never reactivated; deactivation is one-way.
- **DEC-198 / DEC-199**: a report is saved through `rechazoDeReporte`; a dashboard has one connection and 0 to 8 reports, unapproved views are only an advisory.
- **DEC-196 / DEC-197**: one `VinculoTelegram` per tenant (`tenantId` unique, `chatId` BigInt); a chat may serve several tenants; `canal` is `correo` or `telegram`, never both on one automation.
- **DEC-202**: panel report runs write no audit row. **DEC-201**: one call per report, 3 in flight per tenant.
- **Project memory**: no manual visual pass, no new logbook entries; focus on closing v2.

Out of scope: any product behaviour change (no reactivation path, no new channel, no new engine capacity, rule 6); the UX-review fixes of C-01 (tenant switch dialog) and the junk rows of the user's dev DB; the video script itself; the template for the "write it live" step (the video writes it in the console, so the seed does not create it).

## Current state (verified)

| Piece | State |
|---|---|
| Seed entry | `prisma/seed.ts` runs the catalog, then `sembrarDemo` (only with `SEED_DEMO=1`), then the generic tenant (only on an empty table). Everything imports from `dist/`. A rejection is `Seed failed:` and exit 1; `docker-entrypoint.sh` has `set -e`, so the app does not start. |
| Demo seed | `src/semillas/semilla-demo.ts` (395 lines): operator `demo`, tenant «Food Store», one **direct** connection to `replica-demo:5432` (`food_store`, role `lector_zerodashboard`), five `v_*` views validated by the real probe (`sondearEstructura` + `diagnosticar` + `registrarVeredictos`, one audit row `validacion-mapeo`), one saved query, one panel user, one automation (`stock-fisico`, cron `0 9 * * *`, `umbral` 5, one recipient, `canal` default). Ids are `31d00000-0000-4000-8000-0000000000NN`. `crearSiFalta` is the idempotency primitive. It does **not** create reports, a dashboard, a Telegram link or an agent. Its test (`semilla-demo.test.ts`) uses a fake probe and the application DB; the replica is never dialled in tests (DEC-170). |
| Env | Required with the demo: `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE`, `DEMO_PANEL_CORREO`, `DEMO_PANEL_CLAVE`; forwarded in `docker-compose.yml`. `TELEGRAM_BOT_TOKEN` and `SMTP_*` are separate and optional. |
| Replica | One Postgres 16 container, profile `demo`, one database `food_store` (the dump of 2229 lines plus `02-lector.sh`, which creates **one** role, `lector_zerodashboard`, with `CONNECT` + `SELECT`). No published port. Init files run only on an **empty volume**. |
| **Data is stale** | Orders: 99 rows from 2026-08-18 to 2026-09-16 (dump of 2026-09-17), hard-coded timestamps. Today is 2026-11-10: a report with a 7- or 30-day period returns no rows. `detalle_pedido` covers only orders 1 to 72, so the last 27 orders have no items. |
| **The demo automation never sends** | `stock-fisico` only covers products with **no recipe**: products 7 (Coca Cola, stock 150), 8 (Agua Mineral, 200) and 9 (Brownie, 40) (products 5 and 6 have a `product_ingredient` row). With `umbral` 5 the result is empty: the run is `omitida-sin-filas` and no email is ever sent. For "email received" the data must change (replica init) or the threshold must be 40 or more. |
| Reports / dashboard | `Reporte` is global (`nombre`, `titulo`, `descripcion`, `sql`, `entidades`, `visualizacion`, `columnas` JSON, `periodo` JSON). `rechazoDeReporte(validationError, cuerpo, {exigirColumnas})` and `datosDeReporte` are exported pure functions in `src/reportes/reportes-rutas.ts`; the AJV half is Fastify's, so a seeder restates it (exactly what `rechazoDeEntrada` does for templates in `catalogo-inicial.ts`). Save-time column check trusts `columnasPrueba`. `Tablero` is scoped (`tenantId @unique`, `conexionId`, `reportes String[]`, max 8, `TOPE_REPORTES_TABLERO`). The CH-48 panel runs them live. |
| Telegram | `VinculoTelegram { tenantId @unique, chatId BigInt, vinculadoEn }` is written by `crearVincular` after the bot receives `/start <code>` through `getUpdates` (needs `TELEGRAM_BOT_TOKEN` and a real chat). Sending is `notificador-telegram` with the chat id read from the row. A Telegram automation with no link closes `sin-vinculo` and the panel shows a warning (`panel-automatizaciones.ts:184`). |
| Scheduler | Self-rescheduling `setTimeout` ticks at every minute boundary; `cronValido` accepts `* * * * *` (five fields, `*` allowed). Missed fires are not caught up (DEC-95). A run that reaches `minimoFilas` notifies **every** minute. Connection retry on transient failures: 3 attempts, 5 s pause. |
| Mailpit | Profile `correo`, in memory, no volume; it keeps the newest 500 messages by default (upstream default, not set in this repo), so unbounded growth is not a storage problem, only noise. |
| Agent | `Agente { tenantId @unique, tokenHash @unique }`: **only the SHA-256 of the token is stored** (`hashTokenAgente`), so a seed can create an agent whose token is a value from the environment. `Conexion.agenteId` binds a connection to it. The agent process (`docker-compose.agente.yml`, `target: agente`) needs `AGENT_SERVER_URL` (`wss://` anywhere, `ws://` **only loopback**), `AGENT_TOKEN` (`zda_` + 43 chars), `AGENT_ALLOWED_TARGETS` (exact `host:port`). The standalone compose runs in its own project and network ("never run together with docker-compose.yml"), so it cannot resolve `replica-demo`, and the app is not loopback for it. |
| Known junk | UX review C-01 / C-20: two «Food Store», a report named «Recorrido 1794315526090 …», «Nuevo Negocio». These are manual-test leftovers in the user's dev DB; the seed itself never creates a duplicate (with `SEED_DEMO=1` the demo runs before `sembrarTenant`, which then does nothing). |

### Specs affected

- New capability `demo-seed` (or a delta on the seed requirement if one exists under `project-environment`; the design phase decides after reading it).
- `report-catalog` and `tenant-dashboard`: no rule change; the seed is a new writer that must pass the same checks.
- `telegram-link`: no change (the seeded link is a row, the code flow is untouched).
- `agent-registration` / `agent-channel`: no change; only if the agent option (decision 6) is taken.
- Docs: README «Probar la demo completa» (steps 2 and 3 become "ya vienen sembrados"; the panel paragraph no longer says the dashboard "llega con CH-48"), `.env.example` (new optional variables, names only), `docs/02-mapa-de-changes.md` row.

## Decisions (each with options and a recommendation)

### 1. Second tenant: where does its data live

| Option | Pros | Cons |
|---|---|---|
| (a) **A second database in the same `replica-demo` container** (`cafe_demo`), with its own role, its own tables and its own five `v_*` views | One container, one volume, no new compose service. Each tenant has its own connection (database, role) and its own mapping, so isolation is visible: same screens and same reports, different products and numbers. A different table design behind the same canonical contract is the product's whole point (it shows the mapping per client). `CREATE DATABASE` cannot run in the app, so it is a replica init file | Init files run only on an empty volume: `down -v` is required (decision 5). A new ~150-line SQL to maintain |
| (b) Same database, second mapping that filters (`WHERE category = ...`) | Almost no SQL | Both tenants read the same rows: it does not look like isolation, only like filters, and it weakens the "tenant A cannot see B" claim of the video |
| (c) A second replica service (`replica-demo-2`) | Strongest "different customer" picture | A new service, volume and healthcheck for no extra demonstration over (a); the app `depends_on` grows |

*Recommended: (a).* Shape:
- `docker/replica-demo/` gets a script that creates `cafe_demo` and loads a small dataset **generated relative to `now()`** (`generate_series`, deterministic formulas, no `random()`), with deliberately different table names (for example `sales`, `sale_lines`, `items`, `supplies`, `recipes`) and the five canonical views over them.
- **One role per database** (`lector_zerodashboard` for `food_store`, a second one for `cafe_demo`), `REVOKE CONNECT ... FROM PUBLIC` on both, so each tenant's credential cannot open the other's database (rule 3, second layer, kept literally). Both use `REPLICA_DEMO_PASSWORD`: no new secret.
- App side: tenant, connection, five views validated by the same probe, one panel user, one active daily automation (so its panel is not empty), a dashboard with a subset of the reports.
- Name: a legible, **distinct** one (the UX review asks for it, C-01 and C-20). Proposed «Café del Puerto» (open question 1). Fixed ids with a CH-49 prefix (`49d00000-0000-4000-8000-0000000000NN`), documented, so the video can show a foreign id answering `404` (rule 2).
- Panel user of tenant 2: optional `DEMO_PANEL2_CORREO` / `DEMO_PANEL2_CLAVE`; when absent, derive the email with a `+cafe` tag on `DEMO_PANEL_CORREO` and reuse `DEMO_PANEL_CLAVE`, so the five required variables do not grow. (Design detail.)

Needs a DEC (DEC-206).

### 2. The every-minute automation

Facts: `* * * * *` is a valid cron; a run notifies every minute while it has at least `minimoFilas` rows; there is **no way to reactivate** a deactivated automation (DEC-79), so "seed it inactive and switch it on while recording" does not exist. The channel is exclusive per automation, so "email and Telegram received" needs **two** automations (one per channel).

| Option | Notes |
|---|---|
| (a) Always seeded active | A fresh `up` sends an email (and a phone notification) every minute forever, and the 09:00 demo automation becomes noise. Rejected |
| (b) **Seeded only when an opt-in variable is set** (`DEMO_CADA_MINUTO=1`), alongside the existing daily one | The default demo stays quiet; a recording session turns it on with one variable and a restart. To stop: unset it and `down`/`stop app`, or «Desactivar» in the console (one-way, as the product defines it). Fixed ids, create-if-absent |
| (c) Not seeded; the video creates it live with cron `* * * * *` | Matches the script ("Alta con varios destinatarios y mínimo de filas" is a live step) and needs no flag. But rehearsals and the panel/Telegram steps need an existing one, and it costs video time |
| (d) A manual runbook only | Nothing to maintain, nothing to test |

*Recommended: (b), and the video's live "alta" step still creates its own.* The two seeded automations are on the Food Store tenant: an email one with **several recipients** (the panel user plus one or two `*.example` addresses, up to the DEC-187 limit of 5) and `minimoFilas` 2 or 3, and a Telegram one. The Telegram one is created **only when the tenant is linked** (decision 3); without a link it would show a «sin chat» warning that is not the story. For the numbers to work the replica data must give 2 or 3 products under the threshold (decision 5 / slice A: set stock of products 7, 8 and 9 to small, distinct values, for example 18, 9 and 4, and `umbral` 10). That also gives the panel step "ajuste de umbral" something to change (raising 10 to 20 adds a row; lowering it drops below the minimum and the run is `omitida-bajo-minimo`). Needs a DEC (inside DEC-206): a new demo variable and the "recording" mode.

### 3. Telegram "linked"

The real flow needs a bot token and a person sending `/start <code>` from a real chat; a seed can neither obtain nor invent a chat id, and a made-up id would make every send fail (`envio-rechazado`).

| Option | Notes |
|---|---|
| (a) **Optional `DEMO_TELEGRAM_CHAT_ID`**: if set and the tenant has no link, the seed inserts the `VinculoTelegram` row (the model needs only `tenantId`, `chatId`) | The video starts already linked. The value is the owner's own chat (a user id, or a negative id for a group); it lives in `.env`, never in the repo (rule 7). The owner must have pressed Start on the bot once (a bot cannot write first). Validate `^-?\d{1,19}$` and the int64 range, error names the variable and never echoes the value |
| (b) Never seeded; link live in the video with the real code flow | Shows the real flow, but needs network and a human at the phone during recording, and it adds seconds of waiting |
| (c) **(a) when the variable is present, otherwise unlinked** | The demo works for anyone who clones the repo (no Telegram needed); the owner gets the linked state. The live flow stays available because the tenant is simply unlinked |

*Recommended: (c).* Rules: create-if-absent per tenant (`tenantId` unique): an existing link, even to another chat, is never touched. Only the Food Store tenant is linked; the second tenant is left unlinked on purpose (DEC-196 allows sharing a chat, but one chat receiving both tenants' alerts would blur the isolation story). `TELEGRAM_BOT_TOKEN` stays a separate runtime variable: the seed does not read it. The README says the two together are what make the Telegram step work. Inside DEC-206.

### 4. Reports and dashboard

Seeded as **global `Reporte` rows with fixed ids**, written through the same checks as the console: a seeder-side `rechazoDeEntradaReporte` that restates the AJV half (types, enums, required, no extra keys) and then calls `rechazoDeReporte(undefined, cuerpo, {exigirColumnas: true})` with a `columnasPrueba` list, as `sembrarCatalogoInicial` does with `rechazoDeEntrada`. A rejected entry throws, writing nothing. Readable `nombre` (operator) and `titulo` (client, passes the panel glossary, so no «consulta», «réplica», «tenant», «parámetro»...), one per visualization type, all over canonical entities so they run on **both** tenants:

| Type | `nombre` (console) / `titulo` (panel) | Reads | Period | Roles |
|---|---|---|---|---|
| `numero` | Ventas del período / «Ventas» | `pedido` (excluding `cancelado`) | 7, 30, 90 | `valor` «Ventas» |
| `barras` | Productos más vendidos / «Lo más vendido» | `item_pedido`, `pedido`, `producto` (top 8) | 7, 30, 90 | `etiqueta` «Producto», `valor` «Unidades» |
| `linea` | Ventas por día / «Ventas por día» | `pedido` | 30, 60 | `etiqueta` «Día», `valor` «Ventas» |
| `tabla` | Stock de productos / «Stock de tus productos» | `producto` | none | `columna` «Producto», `columna` «Stock» |

Dashboards: Food Store gets all four, in that order; the second tenant gets three, so the same report shows different numbers per tenant. `Tablero` is created after the views are validated and only if the tenant has none (create-if-absent by `tenantId`).

**How the checks stay honest.** `columnasPrueba` in a seed is a constant, so nothing proves the SQL really returns those columns. Two tests close it, both without the replica (DEC-170): (1) the seeder test asserts `rechazoDeReporte` returns `null` for every entry and that a corrupted entry (extra key, wrong role, empty title, forbidden term) is rejected; (2) a test composes each report over `VALUES`-literal views (the technique in `reporte-prueba.test.ts`), runs it on the test DB and asserts the returned column names equal `columnasPrueba`. For the period it passes a date through the same `fechaDelPeriodo` path.

Notes for the design phase: `numeric`/`bigint` arrive as strings (CH-48 turns a non-numeric `valor` into `no-disponible`), and `fechaCreacion` as an ISO string (CH-48 flagged label formatting); the seeded SQL should cast to `::numeric` and `::date`/`to_char` where it helps. Reports are global, so the existing dev DB (which may hold the junk report) keeps its own rows; fixed ids avoid collisions.

*Recommended: as above.* Needs a DEC (inside DEC-206): a second writer of `Reporte`/`Tablero` (the seed) and the rule "a seeded report must pass `rechazoDeReporte`".

### 5. Idempotency, existing databases, how to start clean

Principle (unchanged from DEC-171): every new row has a fixed id and is created only if absent; nothing is updated or deleted.

| New item | On a database that already has demo rows |
|---|---|
| Tenant 2, connection, views, user, automation, tablero | Created if absent. The views of this run are probed once and deleted if invalid (existing rule) |
| Reports | Created by fixed id if absent. A report the owner edited is left as is |
| Dashboard of Food Store | `tenantId` is unique: if the tenant already has a dashboard (the dev DB does), **it is not touched**, so the junk dashboard stays. This is by design |
| Telegram link | Created only if the variable is set **and** the tenant has no link |
| Every-minute automations | Created only on a start that has `DEMO_CADA_MINUTO=1`. Unsetting it later does **not** delete them |
| Agent (decision 6) | Created only if the tenant has no agent (`tenantId` unique); an existing agent with another token stays and the sidecar then fails with exit 2, which the README explains |
| Replica changes (second database, relative dates, stock values) | Init files run **only on an empty volume**. An old `replica-demo-data` volume has none of them |

Failure mode: new code on an old replica volume makes the second tenant's probe fail (`3D000`, invalid catalog). *Recommended: fail loud, as DEC-171 requires*, with a message that names the cause and the fix: «replica-demo has no database cafe_demo: recreate the volume with `docker compose down -v`». A half-seeded demo is worse for a video than a clear stop. The probe error is translated in the seed (closed text, no driver message).

**Starting clean** (the only supported way to get the video state): `docker compose --profile demo --profile correo down -v`, then `up -d --build` with the demo variables. `-v` removes both `db-data` and `replica-demo-data`, so the app DB, the replica data and the junk rows disappear together; the seed rebuilds everything from fixed ids. The junk of the dev DB (duplicate Food Store, test reports, «Nuevo Negocio») is not the seed's business and the seed will not try to clean it. The README states this in one line.

Also: `replica-demo` data is **loaded once**, with timestamps relative to that moment. A demo recorded weeks after its volume was created ages again; the remedy is the same `down -v`. The README says it.

### 6. Agent connection in the demo

| Option | Notes |
|---|---|
| (a) **Direct only; the agent is shown live** | Seed unchanged on this point. The video would create the agent, copy the token and run `docker compose -f docker-compose.agente.yml up` live. The agent cannot reach `replica-demo` from its own compose project (no shared network, `localhost` is the container), so even the live run needs a host-published replica port or a custom network: not a one-command story |
| (b) **Seeded agent + a sidecar service in the demo profile** | Seed creates `Agente` with `tokenHash = hashTokenAgente(DEMO_AGENTE_TOKEN)` and the Food Store connection with `agenteId`. A new `agente` service in `docker-compose.yml`, profile `agente`, `build.target: agente`, `network_mode: "service:app"`: the agent shares the app's network namespace, so `AGENT_SERVER_URL=ws://localhost:${APP_PORT}` is **loopback** (the only `ws://` the agent accepts) and `AGENT_ALLOWED_TARGETS=replica-demo:5432` resolves through the app's DNS. Hardened like the standalone file (`read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `init`). The token is a variable (`zda_` + 43 characters; the README gives the one-liner to generate it), never in the repo |
| (c) Agent only for tenant 2 | Opening shot on Food Store would be direct, which contradicts the script ("consola con tenant activo y conexión por agente") |

*Recommended: (b), as its own slice (CH-49d), droppable without blocking the rest.* Facts and caveats to settle in the design:
- The seed runs **before** the server listens, so it cannot probe through the agent. It probes the replica **directly** (same `host:port` and credential the agent will use), then stores the connection as an agent connection. The validated views are identical either way.
- On a fresh start the agent connects as soon as the app listens; the agent already retries on connection errors (exit codes 1, 2, 3 are the ones needing the operator).
- The shared namespace is a demo shortcut (in production the agent is in the customer's network). The README says so in one sentence; the video should not claim otherwise.
- Whether the shared namespace shares the embedded DNS on Docker Desktop for Windows is the one technical unknown: **a spike is the first task of the slice**. Fallback if it fails: publish the replica on `127.0.0.1` (host port) and run the agent with `network_mode: host`-equivalent behaviour on the host (not on Docker Desktop), i.e. option (a).
- A new connection fixed id for the agent-backed connection when an old dev DB already has the direct one: create-if-absent means the old one stays direct. Clean start fixes it.

Needs a DEC (DEC-207): a service in the main compose file that the agent file's header says should not live there, and a seeded agent token hash. Only if (b) is chosen.

### 7. The provoked failure

Nothing in the seed needs to be broken for the video; a seeded failing artifact would add noise to every tenant's lists, audit and logs (and the UX review already lists a "bad password" test connection as junk that cannot be deleted from the console).

| Option | Notes |
|---|---|
| (a) **Provoke it live with a documented command** | With the agent: `docker compose stop agente` makes the next run fail with category `error-desconocido`, code `ESINAGENTE` (documented in `docs/guia/02` and `08`). Without it: `docker compose stop replica-demo` (`host-inalcanzable` after the retries). The console shows the failed run, the panel shows «con falla». `start` restores it. Zero seed, zero junk, and it is the real behaviour |
| (b) A seeded connection with a wrong password and an automation on it, behind the recording variable | Failure is ready, but it is a permanent failing row in Auditoría/Ejecuciones, retries every minute (3 attempts, 5 s) and cannot be removed from the console |
| (c) A seeded report with a bad SQL in the catalog, added to a dashboard live | Shows the report error card (DEC-198). It passes save-time checks only because columns are trusted; it is a deliberately faulty row in a global catalog |

*Recommended: (a).* If the user wants a visual in the **panel** specifically, add (c) as a fifth report **not** in any dashboard (the video adds it live): decide in open question 6. No DEC for (a).

### 8. Slicing, size, tests

A docs-only PR first with DEC-206 (and DEC-207 if the agent is in), as for DEC-199 and DEC-201/202.

| Slice | Content | Production | With tests / docs |
|---|---|---|---|
| **CH-49a — replica** | `cafe_demo` database (roles, tables, five views, generated data), relative dates and fixed gap of `detalle_pedido` in `food_store`, low-stock values for products 7 to 9, grants in `02-lector.sh` | ~220 SQL / shell | no TS tests (the replica is not under test, DEC-170); a documented manual check of the five views; README |
| **CH-49b — seed: second tenant, reports, dashboards** | Split `semilla-demo.ts` into modules (shared helpers, tenant 1, tenant 2, reports); second tenant end to end; seeded reports with the `rechazoDeReporte` gate; both `Tablero` rows; `.env`/compose forwarding of the optional variables | ~350 | ~600: extend `semilla-demo.test.ts` (second tenant, idempotent re-run, invalid report rejected, tablero created once, a foreign-id 404 pinned) and the `VALUES`-views column test per report |
| **CH-49c — Telegram link and every-minute automations** | `DEMO_TELEGRAM_CHAT_ID` parsing and link, `DEMO_CADA_MINUTO` flag, the two automations (email with several recipients and `minimoFilas`; Telegram), README «Probar la demo completa» rewritten as the script's base | ~130 | ~250 (link created / skipped / never overwritten, bad chat id rejected without echo, flag off creates nothing, Telegram automation only with a link) |
| **CH-49d — demo agent (optional)** | `agente` sidecar in the compose file, seeded `Agente` + agent-backed connection, token variable, README | ~60 + compose | ~150 (hash stored, connection bound, existing agent untouched); needs the spike first |

Each slice ships on its own: after a, the replica is richer and nothing else changes; after b, a clean start has two tenants and dashboards; c adds the video's channel steps; d the agent opening. With the project convention (`size:exception` for CH-44 to CH-47) a, b and c fit as separate PRs; b is the one near the budget, and splits into b1 (tenant 2) and b2 (reports and dashboards) if it passes 400 production lines.

## Which points need a new DEC

| DEC | Content | Why it needs one |
|---|---|---|
| **DEC-206** | CH-49: the demo dataset and seed scheme. Second tenant in a second database with its own role; relative dates and adjusted stock in the replica; seeded global reports that must pass `rechazoDeReporte`, and the two dashboards; optional `DEMO_TELEGRAM_CHAT_ID` link; opt-in `DEMO_CADA_MINUTO` automations; fail-loud when the replica volume is old; `down -v` as the only clean start | Extends DEC-170/171; the seed becomes a writer of `Reporte`, `Tablero` and `VinculoTelegram`; new demo variables; AGENTS.md requires it before code |
| **DEC-207** (only if 6 (b)) | CH-49: a demo agent as a sidecar sharing the app's network namespace, token from `DEMO_AGENTE_TOKEN`, seed writes only its hash | A service in the main compose file, an exception to "never together"; a seeded credential hash |
| No DEC | Report titles and SQL (data), row counts, names, the README rewrite, the live-failure commands (guide material) | Content, not architecture |

## Open product questions (answer in one line each; recommended option first)

| # | Question | Options | Recommended |
|---|---|---|---|
| 1 | Name of the second tenant | (a) «Café del Puerto»; (b) another name of yours | **(a)** |
| 2 | Second tenant's data | (a) second database in the same container, own role and own table design; (b) same database with a filtered mapping; (c) a second replica container | **(a)** |
| 3 | Every-minute automations | (a) always on; (b) only with `DEMO_CADA_MINUTO=1`, one email (several recipients, minimum of rows) and one Telegram; (c) not seeded, created live in the video | **(b)** |
| 4 | Telegram link | (a) always unlinked, link live; (b) from `DEMO_TELEGRAM_CHAT_ID` when set, otherwise unlinked; (c) not applicable | **(b)** |
| 5 | Agent in the demo | (a) direct only, agent shown live; (b) seeded agent plus a sidecar in a `agente` profile (one extra slice, needs a spike); (c) agent for tenant 2 only | **(b)** |
| 6 | Provoked failure | (a) live, with `docker compose stop agente` (or the replica); (b) a seeded failing connection and automation; (c) a seeded faulty report you add live | **(a)** |
| 7 | Reports | (a) four reports, one per type (sales, top products, sales per day, stock table) and dashboards of 4 and 3; (b) fewer; (c) your own list | **(a)** |
| 8 | Old replica volume with new code | (a) fail with a clear message telling to run `down -v`; (b) skip the new parts and warn | **(a)** |
| 9 | Slicing | (a) docs PR with DEC-206/207, then a, b, c, d; (b) one PR | **(a)** |

## Risks

- **Stale and incomplete replica data** (verified): without relative dates and the missing `detalle_pedido` rows the dashboard shows «sin datos» for 7 and 30 days, and without the stock change the demo automation never sends. This is the most important finding; slice A exists for it.
- **The "email received" step depends on stock values, the threshold and the minimum together**: pin them in a test of the data (a SQL check run by the design's manual step) and in the README, or the demo silently sends nothing.
- **Spam**: an every-minute notifier is an email and a phone message per minute. The opt-in variable and the one-way deactivation are the only brakes; the README must say how to stop it.
- **Agent sidecar** (decision 6 (b)): the shared network namespace and DNS behaviour on Docker Desktop is unverified; a spike comes first, and the slice can be dropped.
- **Seed size**: `semilla-demo.ts` is already 395 lines; adding tenant 2, reports, link, automations and agent in one file would make it unreviewable. The split into modules is part of slice B, not an afterthought.
- **Two tenants share one Postgres cluster in the demo**: the app still isolates by `tenantId` and credentials; separate roles with `REVOKE CONNECT ... FROM PUBLIC` keep rule 3 literal. This is a demo topology, not a production claim.
- **The real Telegram chat id** is personal data of the owner; it only lives in `.env` and the `VinculoTelegram` row, never in the repo or a log, and the seed's errors never echo it.
- **Old dev DB**: create-if-absent means its junk dashboard/report/connection survive an app upgrade. Only `down -v` gives the video state; this must be stated, not discovered.

## Ready for proposal

Yes, once the user answers the nine questions above (or accepts the recommendations): then DEC-206 (and DEC-207 if the agent is in) are registered in `docs/01-decisiones.md` in a docs-only PR, and the proposal starts with slice CH-49a. No research phase. The only item that needs a spike before design is the agent sidecar's network namespace (decision 6 (b)).
