# Tasks: CH-49 — Demo data

Inputs: proposal.md, specs/project-environment/spec.md, design.md.

DEC-206 and DEC-207 are registered on `docs/dec-206-207` (PR #258, stacked on #256) before any code (AGENTS.md). The DEC-207 network spike passed on 2026-11-10.

Delivery: the session started as **single-pr**; at the review workload guard (2026-11-10) the user chose **five chained PRs, stacked to master**:
- **a**: replica, on `ch49/datos-demo`, which carries the planning artifacts.
- **b1**: `ch49/b1-segundo-tenant` from a.
- **b2**: `ch49/b2-reportes` from b1.
- **c**: `ch49/c-canales` from b2.
- **d**: `ch49/d-agente` from c.

Each PR targets the previous branch, and they merge in order.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,900 without the planning artifacts: a ~330 (SQL and shell), b1 ~500 (200 production), b2 ~450 (150 production), c ~400 (130 production), d ~220 (60 production plus compose) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Five chained PRs a → b1 → b2 → c → d, each near or under 400 lines with tests. Alternative: one PR with `size:exception` |
| Delivery strategy | auto-chain (user's choice at the guard) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No (resolved by the user)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| a | Replica: recent dates, missing items, stock, REVOKE, `cafe_demo` | none (DEC-170) | isolated demo stack (`-p zd-demo`, `APP_PORT=3100`): views per database, cross-database refusal, stock query | Revert the init files; `down -v` |
| b1 | Seed split, tenant descriptor, Café del Puerto, old-volume pre-check | `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_test DATABASE_URL=postgresql://zerodashboard:postgres@localhost:5434/zerodashboard_test npx tsx --test src/semillas/**/*.test.ts` | `npm run test:db` | Revert: single tenant again |
| b2 | Reports gate, four reports, two dashboards, column test | same | `npm run test:db` | Revert: no reports or dashboards seeded |
| c | Telegram link and every-minute automations, README | same | `npm run test:db`; isolated demo stack with Mailpit for the email | Revert: no link or every-minute automations |
| d | Seeded agent, bound connection, `agente` service | same | isolated demo stack with `--profile agente`; `stop`/`start agente` | Revert: the service and agent rows go; connection direct |

## 0. Decision and spike
- [x] 0.1 DEC-206 and DEC-207 in `docs/01-decisiones.md`; next free DEC-208 in the map (PR #258).
- [x] 0.2 Agent network spike: `network_mode: "service:app"` resolves `replica-demo`, reaches `:5432` and the app over loopback on Docker Desktop.

## a — Replica
- [x] a.1 `02-lector.sh`: add `REVOKE CONNECT ON DATABASE food_store FROM PUBLIC`.
- [x] a.2 `03-datos-recientes.sql`: shift `pedido` and `detalle_pedido` dates by `now()::date - DATE '2026-09-16'`; no item insert: the dump already has items for all 99 orders (194 lines), so the gap the exploration assumed does not exist; set stock of products 7, 8, 9 to 18, 9, 4.
- [x] a.3 `04-cafe-demo.sh` and `cafe/esquema-y-datos.sql`: database, `REVOKE CONNECT`, role `lector_cafe_demo`, tables, data generated over `now()` with no `random()`, five views with exactly the canonical columns.
- [x] a.4 Isolated stack check: each database's five views return rows; last 7 days has orders in both; each `food_store` order has items; each reader cannot connect to the other database; an `INSERT` is refused; `stock-fisico` at `umbral` 10 returns 2 rows. Tear down with `down -v --rmi local`.

## b1 — Seed split and second tenant
- [x] b1.1 `src/semillas/demo/comun.ts`: move `crearSiFalta`, `motivoInvalida` and a `validarVistas` parameterized by `TenantDemo`. The audit row uses the descriptor's tenant.
- [x] b1.2 `demo/tenant.ts`: one tenant from a descriptor (tenant, connection with optional `agenteId`, views and probe, optional saved query, panel user, daily automation). Food Store's output and ids stay identical.
- [x] b1.3 `semilla-demo.ts`: descriptors for both tenants, the derived `+cafe` email, the new `IDS_DEMO` entries (`49d…`), the `ClienteSemilla` additions, the order of steps.
- [x] b1.4 Café del Puerto pre-check: `base-inexistente` throws the closed `down -v` message; nothing of the second tenant is left.
- [x] b1.5 Tests: existing tests pass unchanged except counts and ids; both tenants seeded; second run creates nothing; derived email; old-volume message and no Café rows.

## b2 — Reports and dashboards
- [ ] b2.1 `demo/reportes.ts`: the four reports from the design and `rechazoDeEntradaReporte` (AJV half restated, then `rechazoDeReporte` with columns required); create by fixed id with `datosDeReporte`.
- [ ] b2.2 `demo/tableros.ts`: Food Store 41 to 44, Café del Puerto 41 to 43, only when the tenant has no dashboard.
- [ ] b2.3 Tests: the four entries pass; extra key, wrong role, empty title and glossary term are rejected; an existing dashboard is untouched; each report's columns over `VALUES` views equal its declared columns.

## c — Telegram and every-minute automations
- [ ] c.1 `leerEntornoDemo`: `DEMO_TELEGRAM_CHAT_ID` (signed 64-bit, error without the value).
- [ ] c.2 `demo/canales.ts`: the link when missing; the email every-minute automation (umbral 10, minimum 2, three recipients); the Telegram one only with a link.
- [ ] c.3 Compose forwards `DEMO_TELEGRAM_CHAT_ID`; `.env.example` lists it empty.
- [ ] c.4 Tests: link created, skipped, never overwritten; malformed id rejected without echo; Telegram automation only with a link; email automation shape.
- [ ] c.5 README «Probar la demo completa»: what comes seeded (two tenants, dashboards, every-minute email, Telegram with both variables), the clean start with `down -v`, how to stop the every-minute automations («Desactivar», one-way), the data check query, and the stale CH-48 sentence removed.

## d — Agent
- [ ] d.1 `leerEntornoDemo`: `DEMO_AGENTE_TOKEN` (format check, error without the value).
- [ ] d.2 `demo/agente.ts`: agent with the token hash when the tenant has none; Food Store's connection created with `agenteId`.
- [ ] d.3 `docker-compose.yml`: `agente` service per the design; forward `DEMO_AGENTE_TOKEN`; `.env.example` lists it empty with the `agente` profile.
- [ ] d.4 Tests: only the hash stored; connection bound; existing agent and existing direct connection untouched; no token gives a direct connection.
- [ ] d.5 README: the agent shortcut sentence, the token one-liner, recreating `agente` after rebuilding `app`, and the provoked failure with `stop`/`start agente`. Isolated stack check of the run and the failure.

## Close
- [ ] z.1 `docs/02-mapa-de-changes.md` CH-49 row.
- [ ] z.2 `npm run build` and `npm run test:db` pass apart from the known failures.
