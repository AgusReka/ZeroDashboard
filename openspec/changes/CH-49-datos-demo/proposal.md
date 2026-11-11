# Proposal: CH-49 — Demo data

**Status**: ready for spec; design waits for the agent network spike (DEC-207). Inputs: exploration.md, DEC-206, DEC-207 (PR #258), and DEC-170, DEC-171, DEC-79, DEC-186, DEC-187, DEC-193, DEC-196, DEC-198, DEC-199. No story (map row: "Reemplaza el pendiente de datos de demo. Es la base del guion del video"). Depends on CH-44 and CH-48, both merged.

The user answered the exploration's product questions on 2026-11-10 and they are registered as DEC-206 and DEC-207. Where the exploration's recommendation differs, the DECs win: the every-minute automations are **always active**, and there is no `DEMO_CADA_MINUTO` variable. No research phase: everything is internal to the repository.

## Intent
The video script needs a fresh environment that already shows every step: a console with an active tenant and an agent connection, an automation with several recipients and a minimum of rows that really sends email and Telegram, a client panel with a threshold to adjust and a dashboard with reports, a provoked failure, and a second tenant that proves isolation. Today the demo has one tenant, stale replica data (orders from August and September, so every 7- or 30-day report is empty) and a daily automation that never sends. This change makes one `docker compose down -v` plus one `up` produce that state.

## Scope

### In Scope
- **Replica (DEC-206).**
  - `food_store`: dates relative to the load moment, the missing `detalle_pedido` rows for orders 73 to 99, and low, distinct stock for products 7, 8 and 9, so the threshold and the minimum of rows are met.
  - A second database `cafe_demo` in the same `replica-demo` container: its own role, its own table design, data generated relative to `now()` without `random()`, and the five canonical `v_*` views over it.
  - One role per database, both with `REPLICA_DEMO_PASSWORD`. `REVOKE CONNECT … FROM PUBLIC` on both, so one tenant's credential cannot open the other's database.
- **Seed: second tenant (DEC-206).** «Café del Puerto» with fixed ids (`49d00000-…`): connection, five views validated by the same probe as `POST /conexiones/:id/validacion-mapeo`, a panel user, one active daily automation, and its dashboard.
- **Seed: reports and dashboards (DEC-206).** Four global reports, one per visualization type (Ventas del período, Productos más vendidos, Ventas por día, Stock de productos). Each passes `rechazoDeReporte` plus a restated input check before it is written. Food Store's dashboard gets the four; Café del Puerto's gets three. Each dashboard is created only if the tenant has none.
- **Seed: Telegram link and every-minute automations (DEC-206).**
  - `DEMO_TELEGRAM_CHAT_ID`, validated as a signed 64-bit integer, creates Food Store's `VinculoTelegram` only if the tenant has none. The error names the variable and never echoes the value.
  - Two every-minute automations on Food Store, always active: an email one with several recipients (up to 5, DEC-187) and `minimoFilas` above 1, and a Telegram one only when the tenant is linked. The existing daily automation stays.
- **Old replica volume (DEC-206).** If the replica lacks `cafe_demo`, the seed fails loudly with a closed message pointing to `docker compose down -v`. The app does not start.
- **Demo agent (DEC-207).**
  - **Seed:** with `DEMO_AGENTE_TOKEN` set, the seed creates Food Store's `Agente`, storing only `hashTokenAgente(token)`, and binds the Food Store connection to it. It probes the replica directly first.
  - **Service:** an `agente` service in `docker-compose.yml`, in its own `agente` profile, hardened like `docker-compose.agente.yml`.
  - **Failure for the video:** `docker compose stop agente` makes the next run fail with `ESINAGENTE`, and `start` restores it.
- **Spike before design (DEC-207).** Confirm on Docker Desktop for Windows that `network_mode: "service:app"` lets the agent reach `ws://localhost:${APP_PORT}` and resolve `replica-demo`. If it fails, DEC-207 is amended before any code, and the alternative is the user's choice.
- **Docs.**
  - README «Probar la demo completa»: what comes seeded, how to start clean, how to stop the every-minute automations, and the agent shortcut.
  - `.env.example`: variable names only.
  - The map row.

### Out of Scope
- Any product behaviour change: no reactivation path (DEC-79), no new channel, no new engine capacity (rule 6).
- The video script itself, and the template the video writes live.
- Cleaning the junk rows of the user's dev database. The seed only creates what is missing; `down -v` is the only clean start.
- A seeded failing connection or faulty report: the failure is provoked live.
- Reconciling DEC-117's category name with the code (`error-desconocido` + `ESINAGENTE`): a separate follow-up.

## Capabilities

### New Capabilities
- None. The demo seed is already specified in `project-environment`.

### Modified Capabilities
- `project-environment`:
  - the demo seed's second tenant, reports, dashboards, Telegram link, every-minute automations and agent;
  - the replica's second database, roles and relative data;
  - the fail-loud rule for an old replica volume;
  - the `agente` profile;
  - the new optional variables.
- `report-catalog`: the seed becomes a second writer of `Reporte` and must pass the same checks as the console.
- `tenant-dashboard`: the seed writes `Tablero` create-if-absent with the same limits.
- `telegram-link`: a link may be seeded from the environment, create-if-absent; the code flow is unchanged.
- `agent-registration`: an agent may be seeded with a hash of an environment token.

The spec phase confirms each delta against the current spec text and drops any that needs no requirement change.

## Approach
Follow DEC-170 and DEC-171 literally: fixed ids, `crearSiFalta`, never update or delete, the same probe as the route, a closed failure message and exit 1. `semilla-demo.ts` (395 lines) is split into modules before it grows: shared helpers, Food Store, Café del Puerto, reports and dashboards, Telegram and automations, agent. Seeded reports reuse the exported `rechazoDeReporte`, as `catalogo-inicial.ts` does with `rechazoDeEntrada`. Replica changes are init files, so they only run on an empty volume.

Work units, in order:

| Unit | Content | Estimate (production / tests and docs) |
|---|---|---|
| a. Replica | `cafe_demo` script, roles and REVOKE, relative dates, missing rows, stock values | ~220 SQL and shell / README note |
| b1. Seed split + second tenant | module split, Café del Puerto end to end, fail-loud on an old volume | ~200 / ~300 |
| b2. Reports and dashboards | four reports behind the gate, both dashboards, column check over `VALUES` views | ~150 / ~300 |
| c. Telegram and every-minute automations | chat id parsing and link, the two automations, README rewrite | ~130 / ~250 |
| d. Agent | seeded agent and bound connection, `agente` service and profile, README | ~60 plus compose / ~150 |

Total is about 760 production lines and about 1,000 lines of tests and docs, well above the 400-line budget. The session's delivery strategy is a single PR, so the tasks phase forecasts the size and the review workload guard decides before apply.

## Rules Check
- **Rule 1.** No route changes. Seeded reports and automations are data written through the same checks as the console.
- **Rule 2.** Two tenants with separate databases, roles, connections and fixed ids. A foreign id still answers `404`, and the isolation tests are unchanged.
- **Rule 3.** Both replica roles are read-only (`CONNECT` + `SELECT`), and `REVOKE CONNECT … FROM PUBLIC` keeps one tenant's credential out of the other database. The engine layers are unchanged.
- **Rule 5.** The seed stores no client rows. The Telegram chat id lives only in `.env` and the `VinculoTelegram` row, and is never logged.
- **Rule 6.** No new engine capacity; every-minute runs use the existing scheduler.
- **Rule 7.** Every new secret or personal value comes from the environment (`DEMO_TELEGRAM_CHAT_ID`, `DEMO_AGENTE_TOKEN`). `.env.example` has names only, and the database stores only the agent token's hash.

## Rollback
Each work unit reverts on its own: d removes the service and the agent rows stop being created; c stops creating the link and the automations; b2 stops creating reports and dashboards; b1 leaves a single tenant; a restores the old dump. Rows already seeded stay, because the seed never deletes. `down -v` returns to the previous state. No migration.

## Affected Areas
- `docker/replica-demo/` (`01-esquema-y-datos.sql`, `02-lector.sh`, a new `cafe_demo` script)
- `src/semillas/semilla-demo.ts`, split into new modules under `src/semillas/`, and `semilla-demo.test.ts`
- `prisma/seed.ts` (wiring only)
- `docker-compose.yml` (variables, `agente` service and profile), `.env.example`
- `README.md`, `docs/02-mapa-de-changes.md`, and `docs/guia` where it describes the demo
- `openspec/specs/project-environment`, `report-catalog`, `tenant-dashboard`, `telegram-link`, `agent-registration`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stock, threshold and minimum fall out of step, so the demo silently sends nothing | Medium | Fix them together in the design, pin them in a data check and in the README |
| Every-minute email and Telegram spam on every fresh `up` | Certain | Accepted by the user (DEC-206). The README says how to stop it («Desactivar», one-way) |
| The agent's shared network does not work on Docker Desktop | Unknown | Spike before design. If it fails, DEC-207 is amended and unit d may be dropped without blocking a to c |
| An old replica volume half-seeds the demo | Medium | Fail loud with a closed `down -v` message (DEC-171) |
| Seeded report columns drift from their SQL | Low | A test runs each report over `VALUES` views and compares columns |
| Seed module grows unreviewable | Medium | Split into modules first (b1) |
| Size above the 400-line budget | Certain | Tasks forecast plus the review workload guard before apply |
| The Telegram chat id is personal data | Low | Only in `.env` and the row; errors never echo it |

## Success Criteria
- [ ] After `down -v` and one `up` with the demo variables, the console shows two distinct tenants with validated mappings, and Food Store's connection goes through the agent when the `agente` profile is up.
- [ ] Food Store's every-minute email automation sends to several recipients once its minimum of rows is met; the Telegram one sends when the tenant is linked.
- [ ] Both panels show their dashboard with non-empty 7- and 30-day reports. The same report shows different numbers per tenant.
- [ ] Raising or lowering the threshold in the panel visibly changes the next run (rows added, or `omitida-bajo-minimo`).
- [ ] `docker compose stop agente` makes the next run fail with `ESINAGENTE`, and `start` restores it.
- [ ] A second `up` creates nothing new and overwrites nothing. An old replica volume stops the app with the `down -v` message.
- [ ] No secret or chat id is in the repository or in a log.
- [ ] `npm run test:db` and `npm run build` pass, apart from the known failures.
