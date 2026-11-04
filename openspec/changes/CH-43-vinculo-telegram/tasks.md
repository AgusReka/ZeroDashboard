# Tasks: CH-43 — Telegram link

Inputs: proposal.md, specs/telegram-link/spec.md, specs/client-panel-telegram/spec.md, specs/tenant-isolation/spec.md, specs/project-environment/spec.md, design.md.

Delivery: three stacked PRs (DEC-196 6(b), split in design §14, chosen by the user on 2026-11-04). Strategy `single-pr`: each slice over 400 lines needs `size:exception` before its apply (forecast below).
- **CH-43a** — data and panel API — branch `ch43/vinculo-telegram` from `master`; carries the planning artifacts.
- **CH-43b** — network loop — branch `ch43/sondeo-telegram` from CH-43a.
- **CH-43c** — panel UI — branch `ch43/panel-telegram` from CH-43b.

DEC-196 goes on `v2/dec-196` from `master`, in its own PR, before any code (AGENTS.md).

## 0. Decision
- [x] 0.1 Move DEC-196 out of the CH-43 branch to `v2/dec-196` from `master` and commit it there, before any code. Done 2026-11-04: commit `99eccd8` on `v2/dec-196`.

## CH-43a — data and panel API

### 1. Model
- [x] 1.1 `prisma/schema.prisma`: `VinculoTelegram`, `CodigoVinculoTelegram` and the two back-relations on `Tenant`, with the CH-43 comment (design §1).
- [x] 1.2 Migration `20261105000000_vinculo_telegram` with the rollback in its header. Regenerate the Prisma client.

### 2. Isolation
- [x] 2.1 `src/aislamiento/aislamiento-prisma.ts`: both models in `MODELOS_AISLADOS`; `codigoVinculoTelegram.buscarPorHash` returning only `tenantId`, `tenantNombre`, `tenantActivo`, `venceEn` (design §7).
- [x] 2.2 `src/aislamiento/contexto-tenant.ts`: the `conTenantActivo` comment names three production entries.
- [x] 2.3 `src/aislamiento/aislamiento.test.ts`: both models fail closed with no context; the lookup's exact fields and its two-tenant case; other unscoped operations still throw.

### 3. Config and code
- [x] 3.1 `src/telegram/telegram-config.ts`: `leerTelegram(env)` (design §2). `src/compartido/config.test.ts`: `TELEGRAM_BOT_TOKEN` in the reset list; `leerTelegram` unset, empty, set.
- [ ] 3.2 `docker-compose.yml` (`${TELEGRAM_BOT_TOKEN:-}` with a comment), the example env file and the README variable table. Compose and README done; the example env file is pending: the agent's permissions block it, so the user adds `TELEGRAM_BOT_TOKEN=` by hand.
- [x] 3.3 `src/telegram/codigo-vinculo.ts` and its test: `generarCodigo`, `normalizarCodigo`, `hashCodigo`, `DURACION_CODIGO_MS` (design §3).

### 4. Panel API
- [x] 4.1 `src/panel/panel-telegram.ts`: `PuertoTelegram`, `registerPanelTelegramRoutes` with GET, POST and DELETE (design §8).
- [x] 4.2 `src/aislamiento/contexto-tenant.ts`: the three rows in `RUTAS_PANEL_PUBLICAS`. `src/app/rutas.ts`: `telegram: PuertoTelegram | null` in `DependenciasRutas`, registered after the settings routes. `src/server.ts`: passes `telegram: null` and logs `configurado`/`no-configurado` (the poller arrives in CH-43b).
- [x] 4.3 `src/panel/panel-telegram-rutas.test.ts`: the four states (with a fake port), `POST` replacing a code and returning it once, 409 with no bot, idempotent `DELETE`, expired code read as `sin-vincular`, 401 with no cookie, strict empty bodies.
- [x] 4.4 `src/aislamiento/aislamiento-panel.test.ts`: the two-tenant Telegram rows of `tenant-isolation`.

### 5. Verification (CH-43a)
- [x] 5.1 `npm run build` and `npx prisma validate`.
- [x] 5.2 `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`; only the known `conexiones.test.ts` false positives may fail.

## CH-43b — network loop

### 6. Client
- [x] 6.1 `src/telegram/cliente-telegram.ts`: `Buscar`, `CategoriaTelegram`, `ActualizacionTelegram`, `crearClienteTelegram` (design §4).
- [x] 6.2 `src/telegram/cliente-telegram.test.ts`: request shape, every category, update parsing (a chat id above 32 bits, missing fields), and the token never appearing in a result when the fake throws errors containing it.

### 7. Linking
- [x] 7.1 `src/telegram/vincular.ts`: `crearVincular` with the lookup and the `deleteMany` + `create` transaction (design §6).
- [x] 7.2 `src/telegram/vincular-rutas.test.ts` (DB): link, relink, shared chat, expired code, deactivated tenant, code deleted after use, A's code never touching B, no personal data stored.

### 8. Poller
- [x] 8.1 `src/automatizaciones/planificador.ts`: export `relojDelSistema`.
- [x] 8.2 `src/telegram/sondeo-telegram.ts`: `crearSondeoTelegram`, `esperaSondeo`, `manejarMensaje`, the cap and the closed-field logs (design §5).
- [x] 8.3 `src/telegram/sondeo-telegram.test.ts`: offset advance, no overlap, `getMe` gate, backoff bounds and reset, ignored messages, `/start@bot`, loose code, the cap, both answers, a failed answer keeping the link, `detener()` aborting an open request, no log containing the token or a chat id.

### 9. Wiring
- [x] 9.1 `src/server.ts`: build the poller when the token is set, its `onClose` hook, `telegram: sondeo` to the routes, `sondeo?.iniciar()` after `listen` (design §9).

### 10. Verification (CH-43b)
- [x] 10.1 `npm run build`; `npm run test:db` as in 5.2.
- [ ] 10.2 With the user's go-ahead and a test bot token in their own `.env`: `docker compose up -d --build app`, generate a code with `curl` against the panel API, send `/start <code>` from Telegram, read `vinculado`. Without a token, the app starts and logs `no-configurado`.

## CH-43c — panel UI

### 11. Card
- [x] 11.1 `src/panel/panel.ts`: the «Avisos por Telegram» card with its fixed blocks, `cargarTelegram()`, create, unlink with confirmation, the 409 repaint (design §10).
- [x] 11.2 `src/panel/panel.test.ts`: card markup and ids, glossary, values inserted with `textContent` only, the card's error state leaving the list alone.

### 12. Docs
- [x] 12.1 `guidelines/pantallas.md` P-07, in both copies of the design skill, identical.
- [x] 12.2 `docs/guia/06-automatizaciones.md`: "Vincular Telegram". README: how to create the bot and that a webhook stops the link.
- [x] 12.3 `docs/02-mapa-de-changes.md`: the CH-43 row with the three PR numbers. The numbers are not known yet: the row says `PRs #pendiente` until the PRs open.

### 13. Verification (CH-43c)
- [x] 13.1 `npm run build`; `npm run test:db` as in 5.2.
- [ ] 13.2 Every scenario of the four delta specs maps to a test, or to 10.2, in the verify report.

## Review Workload Forecast
- Estimated changed lines, by slice (DEC-196 is on its own branch and not counted; the specs are synced at archive; planning artifacts ride in CH-43a and are not counted):
  - CH-43a: ~520 (code ~210, tests ~280, docs ~30).
  - CH-43b: ~600 (code ~330, tests ~260, docs ~10).
  - CH-43c: ~280 (code ~170, tests ~60, docs ~50).
- 400-line budget risk: High for CH-43a (~120 over) and CH-43b (~200 over); Low for CH-43c.
- Chained PRs recommended: Yes, three, as above (stacked to `master`).
- Decision: `size:exception` for CH-43a and CH-43b, accepted by the user on 2026-11-04, before apply.
