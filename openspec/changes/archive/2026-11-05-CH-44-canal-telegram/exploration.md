# Exploration: CH-44 — Telegram channel

Status: **decided** (2026-11-05): 1(a), 2(a), 3(a), the recommended options, chosen by the user; registered as DEC-197. No research phase: the Bot API facts below are confirmed against the reference. Store: openspec. Story N4. Depends on CH-39 and CH-43, both merged. CH-49 (demo data) depends on this change.

DEC-185 constraints that bind this change (`docs/01-decisiones.md:3543-3552`):
- The automation chooses one channel, `correo` or `telegram`.
- With `telegram`, the destination is the tenant's linked chat. With no link, the result is `sin-vinculo`, "visible like any other result".
- The message is text, built by a generic renderer from the same rows as the email. It is cut to the Telegram limit and the cut is announced, as in the email.
- One message per run, with no send retry.
- The poller stays link-only. It never triggers automations.

N4 (`docs/mapa-historias.md:126`): "As P2, I want to receive notices by Telegram. The automation chooses the channel. One message per run reaches the tenant's linked chat; with no link, the run records it."

Row 6 of the map (`docs/02-mapa-de-changes.md:64`) adds a scope item: CH-44 adds the Telegram view to the CH-42 preview.

## What exists (verified)

| Piece | State |
|---|---|
| Send step | `notificar` (`src/automatizaciones/planificador.ts:307-337`): decide, compose, compute `respaldo`, write the `enviando` mark, call `notificador.enviar`. A throw becomes a value, so the row always closes. It is email-only. |
| Decision | `decidirNotificacion(r, destinatarios, configurado, minimoFilas)` (`src/automatizaciones/automatizaciones.ts:366-388`), pure, shared by the scheduler and the preview (`vista-previa.ts:56`). Order: query failed, zero rows, below minimum, no recipient, not configured, send. |
| Close | `cierreConNotificacion` (`automatizaciones.ts:445-468`) is channel-agnostic. `categoriaEnvio` re-gates to the closed `CategoriaEnvio` set (`:171-176`). `codigoEnvio` accepts any three digits from 200 to 599. |
| Outcome vocabulary | `EstadoNotificacion` (`automatizaciones.ts:314-322`) is plain TEXT with values in code, so `sin-vinculo` needs no migration (precedent: CH-18 and CH-40 in `prisma/schema.prisma:234-244`). |
| Boot sweep | `enviando` to `incierta` (DEC-108) does not depend on the channel, and the label «Sin confirmar: puede haberse entregado» reads correctly for Telegram. |
| Text renderer | `textoDe` (`src/automatizaciones/correo.ts:311-325`) is private. It already gives name, date, body, notices and footer, with no markup. `componerCorreo` (`:217-239`) returns it as `texto`, alongside the HTML and subject. |
| Placeholders | `sustituir` (`src/plantillas/marcadores-mensaje.ts:36-49`) takes channel-specific `literal` and value functions, as anticipated for CH-44 (`:10`). |
| Catalog templates | `encabezadoMensaje` and `lineaMensaje` are null in the catalog (`src/plantillas/catalogo-inicial.ts:55-56,84-85`), so **they render the table form**, which DEC-188 says does not work in Telegram (`docs/01-decisiones.md:3636`). See decision 3. |
| Telegram client | `ClienteTelegram.responder(chatId, texto, senal?)` (`src/telegram/cliente-telegram.ts:145-148`) sends plain text with a 10 s deadline and never throws. The only instance is built inline inside the `crearSondeoTelegram` call (`src/server.ts:44-52`), so it must become a shared constant. |
| Client errors | Every `ok: false` except 409 becomes `rechazada` (`cliente-telegram.ts:114-117`). `error_code` and `parameters` are dropped, so a blocked bot, a missing chat, a bad token and a 429 look the same. |
| Link read | `VinculoTelegram` is tenant-scoped by the isolation extension, and the scheduler already runs inside the tenant context, so a scoped read adds no new tenant entry. |
| Run row | `Ejecucion` (`prisma/schema.prisma:254-275`) has no channel column. It stores no recipient, and it must store no chat id either (rule 5). |
| Console copy | `ETIQUETAS_NOTIFICACION` (`src/consola/consola.ts:1211-1220`) has «Correo no configurado». Failure texts `notificacion:*` (`:1126-1130`) name the mail server. `errorDeCorrida` prints «código SMTP» for any code in the notification phase (`:3184`). |
| Console form | Create: `auto-destinatario` and `auto-minimo` (`consola.ts:918-926`), plus the email schematic (`:930-935`, DEC-131). Adjust: `aj-destinatario` (`:986`). Help texts say «El correo sale» (`:926`) and «el correo muestra la tabla» (`:594`). Body allow-lists: `automatizaciones-rutas.ts:107,277`. |
| Preview | `respuestaDeVistaPrevia` answers `para` and `correo` (`src/automatizaciones/vista-previa.ts:34-38,48-68`), with only `correoConfigurado` as signal (`:74`). Dialog: `vp-para`, `vp-asunto`, `vp-texto`, `vp-html` (`consola.ts:1017-1022`). |
| Panel adjust | Four-key allow-list (`src/panel/panel-ajustes.ts:205`), and `Enviar a` must hold 1 to 5 addresses (DEC-194; `panel.ts:363,536`). A Telegram automation has no use for that field, so the rule must depend on the channel. |
| Panel result | `resultadoDe` only reads `estado` (`src/panel/panel-automatizaciones.ts:103-105`). A `sin-vinculo` run has `estado='ok'`, so **P2 sees «completada» while nobody got the notice.** See decision 1. |
| Panel link port | `PuertoTelegram` is non-null exactly when the token is set (`src/app/rutas.ts:47`, `src/panel/panel-telegram.ts`). |
| Design guide | P-04 (`guidelines/pantallas.md:136`) and the console guide have no channel. P-07 (`:146-150`) exists. Panel subtitle: «te mandamos por correo» (`panel.ts:281`). |

### Bot API facts (checked 2026-11-05 against core.telegram.org/bots/api and /bots/faq)

- `sendMessage.text`: "1-4096 characters after entities parsing". JavaScript's `.length` counts UTF-16 units, never fewer than characters, so cutting by `.length` is the safe side. With no `parse_mode` there is nothing to escape.
- Limits (FAQ): avoid more than one message per second in a chat, "not able to send more than 20 messages per minute" in a group, about 30 per second overall. Past them come 429 errors with `retry_after`.
- `error_code` "contents are subject to change", so branching on it is fragile.
- A group migrated to a supergroup answers with `migrate_to_chat_id`: the stored chat id stops working.

### Specs affected

- `email-notification`: the outcome table gains the channel and `sin-vinculo`.
- `telegram-link`: Purpose states that this capability sends only the fixed answers; the sending lives in a new capability, `telegram-notification`.
- `automation-scheduling`, `execution-log`, `query-console`, `client-panel-automations`, `client-panel-telegram`, `domain-data-model`.
- Docs: `docs/guia/06-automatizaciones.md:79` (the limit disappears), `guidelines/pantallas.md` and the console guide.

## Shape that fits

- **Model.** `Automatizacion.canal` TEXT NOT NULL DEFAULT `'correo'`, values in code like `notificacion`. Every existing automation keeps sending email, with no data copy. `destinatarios` stays stored and ignored under `telegram`, so switching back loses nothing.
- **Decision.** One destination-aware decision, still pure. `correo`: as today. `telegram`: the same order, with `sin-vinculo` in the `sin-destinatario` row and `no-configurada` when there is no token. The minimum (CH-40) applies the same way. The list of recipients (CH-41) does not apply.
- **Link read.** At run time, right before the decision, only when `canal='telegram'`, and inside the existing `try`, so a failed read closes `error-interno`. An unlink before that moment gives `sin-vinculo`, with no race to handle.
- **Sending.** A `NotificadorTelegram` beside `Notificador`, over the shared client, and `null` with no token. The `enviando` mark and the `respaldo` (CH-39) work unchanged.
- **Failure mapping, no new categories.** `tiempo-agotado` to `tiempo-agotado`, `red` to `servidor-inalcanzable`, `rechazada` to `envio-rechazado`, the rest to `error-desconocido`. `codigoError` stays null, which also avoids a false «código SMTP». The rejected text covers the common case: «Telegram rechazó el mensaje: el bot puede estar bloqueado o el chat ya no existir.» *Not splitting 401, 403 and 429 keeps the client as is, and Telegram warns `error_code` may change.*
- **Rendering.** `componerTelegram(entrada)` beside `componerCorreo`, sharing `Pieza`. No `parse_mode`. Cut at a line boundary to stay within 4096, always keeping the footer and adding a notice of the cut; one line above the limit is cut by code points so no emoji splits. Link previews off (`link_preview_options.is_disabled`), so a URL in a cell does not make Telegram fetch it and the message shows no card.
- **Preview.** Answers `canal` and a text body for Telegram, built by the same function the send uses (DEC-195). `vp-para` shows «Chat vinculado», never the chat id; the subject and HTML frame stay hidden. It reports `sin-vinculo` and `no-configurada` per channel. It remains audited under its own origin.
- **Console.** A `Canal` select in create and adjust, which swaps the recipient field and schematic. Texts become channel-neutral or depend on `canal`.
- **Unchanged.** The poller, the link routes, the scheduler's timing, the run's query and the DEC-108 sweep.

## Decisions (chosen by the user on 2026-11-05: 1(a), 2(a), 3(a); registered as DEC-197)

1. **Panel.** N4 is a P2 story, and P2 is the one who links the chat. (a) P2 chooses the channel in the adjust form, and a Telegram automation with no link shows a notice on its card. The notice derives from `canal` and the link, with no run read. (b) The same choice, with no notice. (c) Only the console chooses the channel. *Recommended: (a): (c) leaves P2 with a link that does nothing until they ask the operator, and without the notice P2 sees «completada» after unlinking.*
2. **Channel in the run history.** (a) `Ejecucion.canal`, nullable TEXT written when the row is created; null reads as `correo` for older rows. (b) No column: generic labels («Canal no configurado», neutral failure texts). (c) Read the automation's current channel. *Recommended: (a): the channel can change in the adjust, so (c) rewrites history and (b) loses the specific failure text. It is a closed value, so rule 5 holds.*
3. **Message with no template texts (all catalog templates today).** (a) The email's text part: a header row and `a | b | c` lines. (b) One line per row as `columna: valor`, separated by ` · `, a Telegram-only form. *Recommended: (a) is the smallest, the same bytes as the email text, and templates with texts already read well. (b) reads better on a phone, at the cost of a second format; DEC-188 itself says the table does not work in Telegram, so this choice deserves the user's call.*

## Research

None, chosen by the user: the few facts above were confirmed against the reference, as CH-43 did.

## Delivery

Rough size: migration and schema ~30, decision and send ~100, renderer ~70, routes ~60, console ~80, panel ~70, docs and specs ~60, tests ~500 → **~1,000 changed lines**. The session chose Single PR, with a 400-line budget, so the tasks forecast will stop and require `size:exception` or a change of strategy. CH-43 split cleanly into backend and UI; this change can too.

## Risks

- The token is in every URL, so the send path must keep the client's rule: only categories leave, never a URL, `description` or body. The chat id must not reach a log or a run row either (rule 5).
- Message content now leaves through Telegram's servers. DEC-185 says this "is noted in the ethical and legal considerations", and that note is not in `docs/` yet (only the decision mentions it); the thesis chapter needs it.
- Regla 6: one channel per automation. Sending on both channels, per-recipient routing, retries and message queues are out of scope, and each stays a documented limit.
- Documented limits: a burst of several automations of one tenant in the same tick can exceed one message per second and get a 429, recorded as `fallo-envio` with no retry (DEC-185). A group migrated to a supergroup fails until it is linked again.
- Without a token, a tenant with no link records `sin-vinculo` under the shared order, though the panel cannot link at that moment. It is the DEC-83 order kept on purpose, and the panel card already explains the state.
- Tests need a fake client: no test may reach `api.telegram.org`, and `consola.test.ts` and `planificador.test.ts` are large suites asserting today's email-only copy.
