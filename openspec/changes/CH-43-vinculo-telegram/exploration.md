# Exploration: CH-43 — Telegram link

Status: **decided** (2026-11-04): 1(a), 2(a), 3(a), 4(a), 5(a), 6(b)(ii), the recommended options, chosen by the user; registered as DEC-196. No research phase: the Bot API facts are confirmed in the spec against the reference. Store: openspec. Story N5. Decision: DEC-185 bot (a) and link (a): "one global platform bot, token in `TELEGRAM_BOT_TOKEN`, optional with the DEC-86 criterion; the panel shows «Vincular Telegram» with a one-time, short-lived code; P2 sends `/start <code>` to the bot and the platform reads it through an outbound `getUpdates`, with no webhook or inbound ports." Depends on CH-36 only (merged). CH-44 (the channel, `sin-vinculo`) builds on the link model defined here and is out of scope.

DEC-185 constraints that bind this change:
- One linked chat per tenant.
- The `getUpdates` loop is a new background cycle, only for linking; it never triggers automations.
- Rule 7: the token stays in the environment. Rule 2: the tenant comes from the code, never from the Telegram message.

N5 (`mapa-historias.md:127`): "One-time code from the panel, sent to the bot. No webhook or inbound ports (DEC-185)."

## What exists (verified)

| Piece | State |
|---|---|
| Telegram | Nothing in `src/`, `prisma/`, `public/` or `openspec/specs/`. `TELEGRAM_BOT_TOKEN` appears only in `docs/01-decisiones.md`. |
| Background loop precedent | `crearPlanificador` (`src/automatizaciones/planificador.ts:199`): injected `Reloj {ahora, programar}` (`:58-69`), self-rescheduling `setTimeout` with no overlap (`:519-550`), `detener()` awaits the in-flight tick (`:615-621`), a tick error is logged by class name only (`:536-539`). Armed after `listen` (`src/server.ts:71-77`), stopped by `app.addHook('onClose')` (`:48-50`), reached by SIGTERM/SIGINT through `registrarApagado` (`src/app/apagado.ts:29-57`). |
| Backoff precedent | The agent process (`src/agente-proceso/agente.ts:23-32`, `espera.ts`): exponential reconnect with jitter and injected `programar`/`aleatorio`. Separate build (`tsconfig.agente.json`), so it is copied or moved to `src/compartido/`, not imported as is. |
| Optional secret precedent | `leerSmtp(env)` (`src/automatizaciones/notificador.ts:75`) returns `null` when `SMTP_HOST` is unset, throws naming the variable and never the value, and keeps secrets off `AppConfig`; `server.ts:32` logs only `configurado`/`no-configurado`. Env vars are forwarded as `${VAR:-}` in `docker-compose.yml:33-52`, listed in `README.md:37-47` and reset in `config.test.ts:25-36`. |
| Outbound HTTP | None server-side: no `fetch` outside browser strings and tests, no HTTP fake. Node 22 has global `fetch` and `AbortSignal.timeout`. The Telegram client is the first, so it needs an injected seam like `Transporte` (SMTP). |
| Isolation | Application-level, not RLS: `MODELOS_AISLADOS` in `src/aislamiento/aislamiento-prisma.ts:50-66` injects `tenantId`; unscoped lookups are explicit methods on the raw client (`usuario.buscarPorCorreo`, `sesionPanel.buscarPorTokenHash`, `:224-317`). One DB role for panel, console and scheduler. `contexto-tenant.ts:68-84` documents "exactly two" production entries to a tenant context; the poller is a third. |
| Panel | Routes in `src/app/rutas.ts:123-133`; every new `/api/panel/*` row goes into `RUTAS_PANEL_PUBLICAS` (`contexto-tenant.ts:144-151`). Session through `levantarSesionPanel` (`panel-auth.ts:164`) then `conTenantActivo`. UI is inline HTML/JS in `src/panel/panel.ts` (685 lines, string concatenation, `escaparHtml`, `zd-*` classes). Copy rules: voseo, and the glossary in `src/compartido/glosario-panel.ts` forbids tenant, consulta, ejecución, etc. Token helpers: `generarTokenSesion`/`hashTokenSesion` (`src/compartido/crypto-auth.ts:105,116`). |
| Audit | `RegistroEjecucion` is console-only (`operadorId NOT NULL`, stores SQL and a verdict). Panel actions are not audited today, so a link event does not fit it. |
| Design guide | `guidelines/pantallas.md` has no Telegram screen; the panel section lists P-01 to P-06 only. **The link UI is not designed.** |
| Migrations | Latest `20261104000000_automatizacion_destinatarios` (CH-41). Quoted PascalCase tables, `TEXT` uuid ids, `TIMESTAMP(3)`, FK to `"Tenant"` `ON DELETE RESTRICT`, a CH comment block and a rollback recipe. |

Telegram Bot API facts the shape relies on (from the Bot API reference; to confirm in research or spec): `getUpdates` with `offset` confirms every earlier update on Telegram's side, unconfirmed updates are kept up to 24 h, and `timeout` enables long polling; a second concurrent `getUpdates` or an active webhook answers 409; a deep link `t.me/<bot>?start=<payload>` sends `/start <payload>` with a payload of up to 64 characters from `A-Z a-z 0-9 _ -`; `getMe` returns the bot username.

### Specs affected

- New capability `telegram-link`: config, code lifecycle, poller, link model.
- `client-panel-auth` / `client-panel-automations`: the new panel routes and the link section (or a new `client-panel-telegram`).
- `tenant-isolation`: the new isolated model, the unscoped code lookup and the third tenant-context entry.
- `automation-scheduling`: only to state the poller is separate and never runs automations.

## Shape that fits

- **Config.** `leerTelegram(env)` next to the client, same contract as `leerSmtp`: unset or empty token → `null`, the loop never starts and the panel shows the section as unavailable. The token never reaches `AppConfig` or a log. At start, `getMe` gives the bot username for the deep link; if it fails, the loop logs the class and retries with backoff.
- **Model.** `VinculoTelegram { tenantId @unique, chatId BigInt, vinculadoEn }` (one per tenant, DEC-185) and `CodigoVinculoTelegram { tenantId @unique, codigoHash @unique, venceEn, creadoEn }` (one live code per tenant: a new one replaces the previous). Both in `MODELOS_AISLADOS`. Only the hash is stored, like panel sessions. No username, name or message text is kept (rule 5).
- **Code.** 8 characters from an unambiguous alphabet, valid 10 minutes, deleted on use. The panel shows it with the deep link and a short instruction.
- **Client.** `ClienteTelegram { obtenerBot(), recibir(offset, timeoutS), responder(chatId, texto) }` over an injected `fetch`, with `AbortSignal.timeout`, closed error categories and no token in any message (the token is in the URL path).
- **Poller.** `crearSondeoTelegram(deps)` copies the scheduler shape: injected clock and client, `iniciar`/`detener`, a second `onClose` hook. Long polling with `allowed_updates=["message"]`; the offset lives in memory, because Telegram already confirms processed updates and a reprocessed `/start` is harmless (the code is gone). On `/start <code>`: hash, explicit unscoped lookup by `codigoHash`, check `venceEn`, then inside `conTenantActivo` upsert the link and delete the code, in one transaction. Anything else is ignored. 409 and network errors back off with jitter.
- **Panel API.** `GET /api/panel/telegram` (status: unavailable, unlinked, code pending with its expiry, linked with its date), `POST /api/panel/telegram/codigo`, `DELETE /api/panel/telegram/vinculo`.
- **Unchanged.** The scheduler, the email channel, automations and the run record.

## Decisions (chosen by the user on 2026-11-04: 1(a), 2(a), 3(a), 4(a), 5(a), 6(b)(ii))

1. **When the loop polls.** (a) Always, while the token is set: one long-poll request open at a time, link within a second or two. (b) Only while some tenant has a live code: no traffic most of the time, but the loop needs a periodic DB check and a wake-up from the code route. *Recommended: (a): simpler, and a long poll is one idle request; DEC-185 limits what the loop does, not how often it waits.*
2. **Does the bot answer.** (a) Yes, with fixed texts: «Listo, este chat va a recibir los avisos de <nombre del negocio>.», and for an unknown or expired code «Ese código no es válido o ya venció. Generá uno nuevo desde el panel.». (b) No answer: the user checks the panel. *Recommended: (a): without an answer the user doesn't know it worked; it is outbound only and sends no tenant data beyond the business name the user already knows.*
3. **Relinking and shared chats.** (a) A new successful code replaces the tenant's linked chat, and the same chat may be linked to several tenants (one person running two businesses). (b) Replacing requires unlinking first, and a chat belongs to one tenant only. *Recommended: (a): it keeps one chat per tenant (DEC-185) without making the user undo anything, and nothing in CH-44 needs a chat to be exclusive.*
4. **Audit of link events.** (a) No new table: the link row keeps `vinculadoEn`, and the poller and routes log closed fields (event, tenant id, outcome). (b) A new panel-actions audit table. *Recommended: (a): panel actions are not audited anywhere today; a table for this alone is new scope.*
5. **Where the panel shows it.** (a) A «Avisos por Telegram» card on the panel's main screen, above «Mis automatizaciones». (b) A separate page reachable from the panel header. Either way it is a new screen spec in the design guide (P-07). *Recommended: (a): one action and one status do not earn a page, and P2 sees it where the automations are.*
6. **Delivery and research.** Rough size: migration + schema ~45, isolation ~25, config ~30, client ~80, poller ~130, panel routes ~90, panel UI ~90, tests ~450, docs and design guide ~60 → **~1,000 changed lines**. The session chose Single PR (400 budget). (a) One PR with `size:exception`, as CH-40 and CH-41. (b) Two stacked PRs: CH-43a backend (config, client, model, poller, routes) and CH-43b panel UI; the split needs no compatibility code. Research: (i) a short `sdd-research` lane to confirm the Bot API facts above, or (ii) none, confirming them in the spec against the reference. *Recommended: (b) and (ii): the split is clean here, unlike CH-41, and each half stays reviewable; the facts are few and stable.*

## Risks

- The token is in the URL path of every request: a logged URL or error message leaks it. The client must never log a URL, `message` or response body.
- The poller is the third production entry to a tenant context, from outside any request; the unscoped lookup must return only the tenant id, and the comment in `contexto-tenant.ts` and the isolation spec must say so.
- Two app instances (or a dev machine and the container with the same token) make Telegram answer 409 to one of them; it must back off quietly, not spin. Polling also fails if someone set a webhook on the bot.
- Code guessing: 8 characters from 32 symbols with a 10-minute life is ~10^12 values; a per-chat cap on failed attempts is cheap and worth specifying.
- Message content reaches Telegram's servers (DEC-185 "Se resigna"); CH-43 sends only the fixed confirmation texts, but the ethical and legal note belongs in the thesis before CH-44.
- Tests need a fake client and a fake clock; no test may reach `api.telegram.org`.
