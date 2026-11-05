# Proposal: CH-43 — Telegram link

**Status**: ready for spec and design. Inputs: exploration.md, DEC-185 bot (a) and link (a), DEC-196 (exploration decisions 1–6), DEC-86. Story N5.

## Intent
P2 wants to link the business's Telegram without technical data (N5). The panel gives a one-time code with a direct link to the platform bot. P2 sends `/start <code>`, and the platform reads it by polling Telegram outward, with no webhook or inbound ports (DEC-185). The tenant ends up with one linked chat, which CH-44 will use as the destination of the Telegram channel. Nothing is sent to that chat yet beyond the bot's fixed answer.

## Scope

### In Scope
- **Config.**
  - Optional `TELEGRAM_BOT_TOKEN`, read by a module-local `leerTelegram(env)` with the `leerSmtp` contract. Unset or empty means `null`: the poller does not start and the panel shows the section as unavailable.
  - The token never reaches `AppConfig`, a log, an error message or a response. The boot log says only `configurado` or `no-configurado`.
  - The variable is added to `docker-compose.yml` as `${TELEGRAM_BOT_TOKEN:-}`, to the README table and to the `config.test.ts` reset list.
- **Model.** One migration, two tables, both in `MODELOS_AISLADOS`:
  - `VinculoTelegram`: `tenantId` unique, `chatId` (`BIGINT`) and `vinculadoEn`. There is one per tenant (DEC-185).
  - `CodigoVinculoTelegram`: `tenantId` unique, `codigoHash` unique, `venceEn` and `creadoEn`. There is one live code per tenant, and a new one replaces it.
  - No username, display name or message text is stored (rule 5).
- **Code.**
  - 8 characters from an unambiguous 32-symbol alphabet, valid 10 minutes.
  - Only its SHA-256 hash is stored, like panel sessions. The plain code is returned once, to the panel that asked for it.
  - It is deleted when used.
- **Telegram client.**
  - `ClienteTelegram` exposes `obtenerBot()` (`getMe`), `recibir(offset, espera)` (`getUpdates`, long polling, `allowed_updates=["message"]`) and `responder(chatId, texto)` (`sendMessage`).
  - It runs over an injected `fetch` with `AbortSignal.timeout`, and errors fall into closed categories.
  - Nothing it logs or throws carries the URL, the token, a response body or a message text.
- **Poller.**
  - `crearSondeoTelegram(deps)` runs a second background cycle, separate from the scheduler, and never runs automations.
  - It has an injected clock and client, and `iniciar`/`detener`.
  - It starts after `listen` and stops through its own `onClose` hook.
  - It runs whenever the token is set (DEC-196 1(a)). The offset lives in memory.
- **Linking.**
  - On `/start <code>`, the poller hashes the code and looks it up without a tenant scope. The lookup is an explicit isolation method that returns only the tenant id, like `sesionPanel.buscarPorTokenHash`.
  - When the code is not expired, it enters that tenant's context. In one transaction it upserts the link, replacing any previous chat (DEC-196 3(a)), and deletes the code.
  - Any other message is ignored.
  - A chat may be linked to several tenants.
- **Bot answers** (DEC-196 2(a)): fixed texts only.
  - On success: «Listo, este chat va a recibir los avisos de <nombre del negocio>.»
  - On an unknown or expired code: «Ese código no es válido o ya venció. Generá uno nuevo desde el panel.»
- **Guessing cap.** After a fixed number of failed codes, a chat is ignored for a while. The count lives in memory.
- **Errors.** 409 (another poller, or a webhook set on the bot), network failures and timeouts back off with jitter. The class is logged, the poller does not spin, and it never stops the app.
- **Panel API.** Every row goes into `RUTAS_PANEL_PUBLICAS`, behind `levantarSesionPanel`, inside `conTenantActivo`:
  - `GET /api/panel/telegram` returns the state: `no-disponible`, `sin-vincular`, `codigo-pendiente` (with `venceEn`) or `vinculado` (with `vinculadoEn`). The state includes the bot username for the link.
  - `POST /api/panel/telegram/codigo` creates or replaces the code and returns it once, with `venceEn` and the `t.me` link.
  - `DELETE /api/panel/telegram/vinculo` removes the link.
- **Panel UI** (`src/panel/panel.ts`). A «Avisos por Telegram» card on the main screen, above «Mis automatizaciones» (DEC-196 5(a)), with the four states, «Vincular Telegram», the code with its link and expiry, and «Desvincular». The copy follows the panel glossary.
- **Logs.** Link, unlink and code events log closed fields (event, tenant id, outcome) instead of an audit table (DEC-196 4(a)).
- **Docs.**
  - The panel guide gets the card. The env guide gets the token.
  - `guidelines/pantallas.md` gets P-07, in both copies of the design skill.
  - The `contexto-tenant.ts` comment counts three production entries.
  - The CH-43 row in `docs/02-mapa-de-changes.md` gets the PR numbers.
  - DEC-196 in `docs/01-decisiones.md` goes on a `v2/dec-196` branch from `master`, as DEC-194 and DEC-195 did.

### Out of Scope
- The Telegram channel on the automation, the text message per run and `sin-vinculo` (CH-44).
- A bot for the end customer (P3) or any command other than `/start <code>` (DEC-185).
- A per-tenant bot, a webhook or a `chat_id` typed by hand (DEC-185).
- More than one chat per tenant (DEC-185).
- An audit table for panel actions (DEC-196 4(a)).
- Linking from the console, and demo data with a linked chat (CH-49).
- Any change to the scheduler, the email channel, automations or the run record.

## Delivery (DEC-196 6(b), split in design §14)
One SDD change, three stacked PRs, chosen by the user on 2026-11-04 after the design forecast:
- **CH-43a — data and panel API**, branch `ch43/vinculo-telegram` from `master`: planning artifacts, config, migration, isolation, code, panel API (the bot reads as not available until CH-43b wires the poller).
- **CH-43b — network loop**, branch `ch43/sondeo-telegram` from CH-43a: client, poller, linking, wiring.
- **CH-43c — panel UI**, branch `ch43/panel-telegram` from CH-43b: the card, P-07 and the guide.

No slice needs compatibility code. Estimate ~1,400 changed lines in total; the tasks forecast reports each slice against the 400-line budget.

## Capabilities

### New Capabilities
- `telegram-link`: the token config, the code lifecycle, the client contract, the poller (start, stop, backoff, guessing cap), the link model and the bot's answers.
- `client-panel-telegram`: the panel API rows and the «Avisos por Telegram» card with its four states.

### Modified Capabilities
- `tenant-isolation`: the two new isolated models, the unscoped code lookup that returns only a tenant id, the poller as the third tenant-context entry, and a two-tenant case (a code from tenant A links A only; B's panel never sees A's link).
- `project-environment`: `TELEGRAM_BOT_TOKEN`, optional, kept out of `AppConfig` and logs.

## Approach
- **Same shape as what exists.** The config copies `leerSmtp`. The poller copies the scheduler: a self-rescheduling timer, no overlap, `detener()` awaiting the request in flight. The client copies the `Transporte` seam. Backoff copies the agent's `espera.ts` into `src/compartido/`, because the agent is a separate build.
- **Tenant from the code, never from the message.** The only unscoped read is by `codigoHash`. Everything after it runs inside `conTenantActivo` with the tenant the code belongs to (rule 2).
- **Idempotent link.** Telegram confirms each processed update through the next `offset`. The worst case after a restart is a repeated `/start` whose code is already gone, which gets the "not valid" answer.
- **No network in tests.** A fake `fetch` returns scripted Bot API payloads. A manual clock drives the poller. Route tests use the panel's two-tenant pattern (`panel-ajustes-rutas.test.ts`).
- **Bot API facts** (the `offset` confirmation, 24 h retention, 409 on a concurrent poll or webhook, the `start` payload alphabet and its 64-character limit, `getMe`) are checked against the Bot API reference in the spec phase and cited there.

## Affected Areas
- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `src/telegram/` (new): config, client, poller, link rules and their tests
- `src/aislamiento/aislamiento-prisma.ts`, `contexto-tenant.ts` and their tests
- `src/compartido/` (backoff), `src/compartido/config.test.ts`
- `src/server.ts`, `src/app/rutas.ts`
- `src/panel/panel-telegram.ts` (new), `src/panel/panel.ts` and their tests
- `docker-compose.yml`, `README.md`, `docs/guia/`, both copies of `guidelines/pantallas.md`, `docs/02-mapa-de-changes.md`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The token leaks: it is in the URL path of every request | Medium | The client never logs or rethrows a URL, `message` or body; a test makes every fake failure throw text containing the token and asserts no log line or error carries it |
| The unscoped lookup becomes a cross-tenant read | Low | One method, by hash only, returning only `tenantId`; a two-tenant test; the comment and the isolation spec name it |
| A 409 from a second instance or a webhook makes the poller spin or flood logs | Medium | Backoff with jitter and a cap; a test with scripted 409s asserts growing waits |
| Code guessing | Low | ~10^12 values, 10-minute life, per-chat cap on failures; a test hits the cap |
| `detener()` waits on an open long poll at shutdown | Medium | Abort the request in flight on `detener()`; a test asserts shutdown finishes without waiting for the poll timeout |
| `chatId` exceeds a 32-bit integer | Certain for groups | `BIGINT` column, carried as `bigint` or string, never `number` |
| CH-42's archive (PR #227) touches `tenant-isolation` in the main specs | Certain | Merge #227 before CH-43's archive; the delta specs here are written against the post-CH-42 text |
| Size ~1,000 lines | Certain | Two stacked PRs; the tasks forecast checks each slice |
