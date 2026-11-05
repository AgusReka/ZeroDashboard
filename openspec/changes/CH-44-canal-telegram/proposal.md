# Proposal: CH-44 — Telegram channel

**Status**: ready for spec and design. Inputs: exploration.md, DEC-185, DEC-188, DEC-195, DEC-196, DEC-197. Story N4. Depends on CH-39 and CH-43, both merged.

## Intent
P2 can link a Telegram chat (CH-43), but no automation sends anything to it. This change lets an automation choose its channel, `correo` or `telegram`. With `telegram`, each run sends one text message to the tenant's linked chat, and a run with no link records `sin-vinculo` (DEC-185). P2 can choose the channel from the panel and is told when a Telegram automation has no chat to reach (DEC-197).

## Scope

### In Scope
- **Model.** One migration:
  - `Automatizacion.canal`: TEXT NOT NULL DEFAULT `'correo'`, values in code. Existing automations keep sending email, with no data copy.
  - `Ejecucion.canal`: nullable TEXT, written when the row is created. Null reads as `correo` for older rows (DEC-197).
  - No chat id on any run row (rule 5). `destinatarios` is kept and ignored under `telegram`, so switching back loses nothing.
- **Outcome.** `sin-vinculo` joins `EstadoNotificacion`, with no migration. It takes the `sin-destinatario` row of the DEC-83 order, and `estado` stays `ok`. `no-configurada` means no token on this channel. The row minimum (CH-40) and zero rows apply unchanged.
- **Link read.** At run time, through the scoped client, only when `canal='telegram'`, after the query and before the decision. A failed read closes the run as `error-interno`.
- **Sending.**
  - A `NotificadorTelegram` beside `Notificador`, over one client shared with the poller (now built once in `server.ts`). It is `null` with no token.
  - At most one send per run, with no retry (DEC-185). The `enviando` mark, the DEC-108 sweep and the `respaldo` (CH-39) apply unchanged.
- **Failures.** Mapped to the existing closed `CategoriaEnvio`, with no new values: `tiempo-agotado` to `tiempo-agotado`, `red` to `servidor-inalcanzable`, `rechazada` to `envio-rechazado`, everything else to `error-desconocido`. `codigoError` stays null on this channel.
- **Message.**
  - `componerTelegram(entrada)` beside `componerCorreo`, reusing the email's text part: the CH-39 texts when the template has them, otherwise the `a | b | c` lines (DEC-197).
  - Plain text, with no `parse_mode` and link previews off.
  - Cut at a line boundary to fit 4096, keeping the footer and announcing the cut (DEC-185). A single line over the limit is cut by code points.
- **Console API.** `canal` in the create and adjust bodies and in the automation detail. An unknown value is a 400. Having no link does not refuse the save: an unlink later reaches the same state, and the run records it.
- **Console UI** (`src/consola/consola.ts`).
  - A `Canal` select in create and adjust, which swaps the recipient field and the email schematic (DEC-131).
  - Help texts that say «correo» become channel-neutral or depend on `canal`.
  - The runs table labels and failure texts depend on `Ejecucion.canal`. «Sin vínculo» is new.
- **Preview** (DEC-189, DEC-195).
  - The response gains `canal` and the Telegram text, built by the same function as the send.
  - The dialog shows the text and «Chat vinculado», never the chat id, and hides the subject and the HTML frame.
  - It reports `sin-vinculo` and `no-configurada` per channel. The audit row is unchanged.
- **Panel adjust** (`src/panel/panel-ajustes.ts`, `panel.ts`).
  - `canal` joins the allow-list. The `Enviar a` field and its 1-to-5 rule (DEC-194) apply only to `correo`.
  - The panel offers Telegram only when the tenant's chat is linked. An automation already on `telegram` keeps showing it, so a save never changes the channel silently.
  - With no token, the panel does not offer Telegram. An automation already on `telegram` can still go back to `correo`.
- **Panel list.** A Telegram automation with no link shows a notice on its card, derived from `canal` and the link, with no run read (DEC-197). The copy follows the panel glossary.
- **Docs.**
  - `docs/guia/06-automatizaciones.md` loses the line 79 limit and gains the channel.
  - `guidelines/pantallas.md` and the console guide gain the channel, in both copies of the design skill.
  - `telegram-link`'s Purpose stops saying CH-44 "will" send.
  - The CH-44 row in `docs/02-mapa-de-changes.md` gets DEC-197 and the PR numbers.
  - DEC-197 goes on a `v2/dec-197` branch from `master`, as DEC-194 to DEC-196 did.
  - The ethical and legal note that DEC-185 asks for, which is not in `docs/` yet.

### Out of Scope
- Sending on both channels, or a channel per recipient (DEC-185: the automation chooses one).
- Send retries, queues or a rate limiter (DEC-185). A 429 is recorded as `fallo-envio`.
- Splitting a run across several messages: one message per run (DEC-185).
- Telling a blocked bot, a missing chat and a bad token apart. They share `envio-rechazado` and one text.
- Following a group's migration to a supergroup: the group links again.
- `sin-vinculo` in the panel's run result: `completada` still means the run worked, and the notice covers the missing link.
- A new message format for Telegram, or message texts for the catalog templates.
- Telegram or message changes for the end customer (P3, DEC-185).
- Demo data with a linked chat (CH-49).

## Delivery
~1,000 changed lines estimated, against the 400-line budget. The session chose Single PR, so the tasks forecast stops and asks for `size:exception` or a split before apply. Backend and UI separate cleanly, as in CH-43. No slice is fixed here.

## Capabilities

### New Capabilities
- `telegram-notification`: the channel's outcome, sending, failure mapping and message format.

### Modified Capabilities
- `email-notification`: the outcome table and the preview depend on the channel.
- `automation-scheduling`: `canal` on the automation and in the create and adjust bodies, the link read in the run, and the preview's channel.
- `execution-log`: `Ejecucion.canal` and `sin-vinculo`.
- `domain-data-model`: the two columns.
- `query-console`: the select, the labels, the failure texts and the preview dialog.
- `client-panel-automations`: the channel in the adjust, the channel-dependent recipient rule and the card notice.
- `telegram-link`: Purpose only.

## Approach
- **Same seams as the email.** A second notifier and a second composer. The decision stays pure and is shared by the run and the preview, so what they report cannot drift.
- **Tenant from the context.** The chat comes from a scoped read of the running tenant's own link, never from the request or from Telegram (rule 2).
- **No network in tests.** A fake client for the run, the existing fake `fetch` for the client, and the panel's two-tenant route pattern.
- **Bot API facts** (4096 limit, flood limits, `error_code` subject to change, group migration) are in exploration.md and cited in the spec.

## Rules Check
- **Rule 1.** The panel gains one closed value; it writes no SQL.
- **Rule 2.** Covered under Approach; a two-tenant test proves a run sends only to its own chat, and that one tenant's link does not silence the other's notice.
- **Rule 3 and 4.** No new query against the tenant's database.
- **Rule 5.** The chat id stays in `VinculoTelegram`: not in a run row, log, console response or panel response. The message holds only what the email already holds.
- **Rule 6.** The engine still runs query, condition, notification. The channel is a second output of the notification step, already decided in DEC-185.
- **Rule 7.** The token stays in the client, where only categories leave.
- **Anti-scope.** Respected: one message per run, no triggers from Telegram, the poller still only links.

## Rollback
Revert the code, then drop the columns:
```sql
ALTER TABLE "Ejecucion" DROP COLUMN "canal";
ALTER TABLE "Automatizacion" DROP COLUMN "canal";
```
Telegram automations go back to email at their stored recipients, or record `sin-destinatario` if they have none. Runs already closed as `sin-vinculo` keep that text and read «—» in the console, since an unknown value falls to the placeholder. The migration carries this recipe, as CH-41's does.

## Affected Areas
- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `src/automatizaciones/`: `automatizaciones.ts`, `correo.ts`, `planificador.ts`, `vista-previa.ts`, `automatizaciones-rutas.ts`, a new Telegram notifier and composer, and their tests
- `src/telegram/cliente-telegram.ts` (link previews), `src/server.ts`, `src/app/rutas.ts`
- `src/consola/consola.ts`, `src/panel/panel.ts`, `panel-ajustes.ts`, `panel-automatizaciones.ts` and their tests
- `docs/guia/`, both copies of the design guidelines, `docs/02-mapa-de-changes.md`, `docs/01-decisiones.md`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The fixed bot answers change when the client gains link-preview options | Low | The send path gets its own option; a test pins the poller's request body |
| The token or chat id reaches a log | Medium | Only categories leave the client; the existing token test extends to the send path, and a new one covers the chat id |
| P2 thinks a notice was sent when no chat is linked | Medium | The card notice (DEC-197), with a test after unlinking |
| A burst in one tick exceeds one message per second and gets a 429 | Low | Documented limit: recorded as `fallo-envio`, with no retry (DEC-185) |
| A message cut at 4096 hides rows | Medium for long results | The cut is announced in the message; `Ejecucion` keeps the true row count |
| A panel save overwrites the channel or empties the recipients | Medium | The body only carries changed keys, as today; tests cover switching in both directions |
| Message content leaves through Telegram's servers | Certain | DEC-185 accepts it; the ethical and legal note is in scope |
| Large test suites assert today's email-only copy | Certain | Copy changes stay limited to channel-dependent strings, and the suites are updated with them |
| Size ~1,000 lines | Certain | Handled at the tasks forecast (see Delivery) |
