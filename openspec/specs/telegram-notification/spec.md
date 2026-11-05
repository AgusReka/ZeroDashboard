# Telegram Notification Specification

## Purpose
An automation whose channel is `telegram` delivers each run's result as one text message to the tenant's linked chat (N4, DEC-185, DEC-197). With no link the run records `sin-vinculo`. Retries, several messages per run, a channel per recipient and a chat per automation are out of scope (documented artifact limits, rule 6).

Bot API facts this spec relies on, from the Bot API reference (core.telegram.org/bots/api, `sendMessage`, `ResponseParameters`, "Making requests") and the FAQ (core.telegram.org/bots/faq), checked on 2026-11-05:
- `sendMessage.text` holds "1-4096 characters after entities parsing".
- `error_code` "contents are subject to change in the future".
- A group migrated to a supergroup gets a new identifier (`migrate_to_chat_id`), so the stored chat id stops working.
- A bot should "avoid sending more than one message per second" in a chat, and sends at most 20 messages per minute in a group. Past the limits it gets 429 errors.

## Requirements

### Requirement: Notification Outcome Precedence on the Telegram Channel (DEC-185, DEC-197)
After the query of a run with `canal='telegram'` finishes, the system SHALL compute exactly one `notificacion` value by evaluating these conditions in order, the first that holds winning:

| # | Condition | `notificacion` |
|---|-----------|----------------|
| 1 | The run's query failed | `null` |
| 2 | The query succeeded with zero rows | `omitida-sin-filas` |
| 3 | The query succeeded with fewer rows than `minimoFilas` and the result was not cut by the row cap | `omitida-bajo-minimo` |
| 4 | The tenant has no `VinculoTelegram` | `sin-vinculo` |
| 5 | `TELEGRAM_BOT_TOKEN` is not configured | `no-configurada` |
| 6 | Telegram accepted the message | `enviada` |
| 7 | Telegram rejected the message, or the send failed or timed out | `fallo-envio` |

Rows 1 to 3 SHALL be the same evaluation as in `email-notification`. Rows 2 to 5 SHALL close with `estado='ok'` and send nothing. `destinatarios` SHALL NOT be read on this channel.

#### Scenario: A run with a link sends one message
- **GIVEN** a due Telegram automation whose query returns rows reaching its minimum, a linked chat 42 and a configured token
- **WHEN** the run closes
- **THEN** exactly one message SHALL have gone to chat 42, `notificacion` SHALL be `enviada` and `estado` SHALL be `ok`

#### Scenario: A run with no link records it
- **GIVEN** a Telegram automation whose query returns rows, on a tenant with no link
- **WHEN** the run closes
- **THEN** `notificacion` SHALL be `sin-vinculo`, `estado` SHALL be `ok`, and nothing SHALL be sent

#### Scenario: Recipients do not stand in for the link
- **GIVEN** a Telegram automation with `destinatarios` `["ops@empresa.com"]`, on a tenant with no link
- **WHEN** the run closes
- **THEN** `notificacion` SHALL be `sin-vinculo`, and no email SHALL be sent

#### Scenario: Zero rows win over a missing link
- **GIVEN** a Telegram automation whose query returns zero rows, on a tenant with no link
- **WHEN** the run closes
- **THEN** `notificacion` SHALL be `omitida-sin-filas`

#### Scenario: The minimum applies
- **GIVEN** a Telegram automation with `minimoFilas` 5 whose query returns 2 rows, with a link
- **WHEN** the run closes
- **THEN** `notificacion` SHALL be `omitida-bajo-minimo`, and nothing SHALL be sent

#### Scenario: A missing link wins over a missing token
- **GIVEN** a Telegram automation whose query returns rows, with no link and no token
- **WHEN** the run closes
- **THEN** `notificacion` SHALL be `sin-vinculo`

#### Scenario: A link with no token
- **GIVEN** a Telegram automation whose query returns rows, with a link and no token
- **WHEN** the run closes
- **THEN** `notificacion` SHALL be `no-configurada`, and no request to Telegram SHALL be made

### Requirement: The Chat Comes From the Running Tenant's Own Link (rule 2)
The run SHALL read the link through the tenant-scoped client, inside the tenant context it already runs in, and only when `canal='telegram'` and the result passed rows 1 to 3. An unlink or a relink before that read SHALL apply to the run. A failed read SHALL send nothing and SHALL close the run as a throw in the notify step does: `estado='fallo'`, `fase='notificacion'`, `error='error-interno'`, `notificacion='fallo-envio'`.

#### Scenario: Two tenants, two chats
- **GIVEN** tenant A linked to chat 42 and tenant B linked to chat 77, each with a due Telegram automation
- **WHEN** both run
- **THEN** A's message SHALL go only to chat 42 and B's only to chat 77

#### Scenario: Another tenant's link does not count
- **GIVEN** tenant A with no link and tenant B linked to chat 77
- **WHEN** A's Telegram automation runs with rows
- **THEN** A's run SHALL record `sin-vinculo`, and nothing SHALL reach chat 77

#### Scenario: Unlinking before the run
- **GIVEN** a Telegram automation whose tenant removes its link before the run
- **WHEN** the run closes with rows
- **THEN** `notificacion` SHALL be `sin-vinculo`

#### Scenario: Relinking before the run
- **GIVEN** a tenant whose link changes from chat 42 to chat 77 before the run
- **WHEN** the run sends
- **THEN** the message SHALL go to chat 77

#### Scenario: Correo runs do not read the link
- **GIVEN** an automation with `canal='correo'`
- **WHEN** it runs
- **THEN** no `VinculoTelegram` read SHALL be made and no request to Telegram SHALL be made

#### Scenario: A failed link read closes the run
- **GIVEN** a Telegram automation with rows and a link read that throws
- **WHEN** the run closes
- **THEN** nothing SHALL be sent, and the row SHALL have `estado='fallo'`, `fase='notificacion'`, `error='error-interno'` and `notificacion='fallo-envio'`

### Requirement: One Send per Run, With the Existing Mark and No Retry (X6, DEC-108, DEC-185)
A run SHALL attempt at most one `sendMessage`. The `enviando` mark SHALL be written on the run's own row after the message is composed and before the send, as on the email channel, and the boot sweep SHALL close a row found `enviando` as `incierta` whatever its channel. No failure, including a 429, SHALL be retried, and the send SHALL NOT read `retry_after`.

#### Scenario: A flood answer is not retried
- **GIVEN** a `sendMessage` answering `{ ok: false, error_code: 429 }`
- **WHEN** the run closes
- **THEN** exactly one request SHALL have been made, and the row SHALL have `notificacion='fallo-envio'`

#### Scenario: A process stopped mid-send
- **GIVEN** a Telegram run's row left `en-curso` with `notificacion='enviando'`
- **WHEN** the boot sweep runs
- **THEN** the row SHALL close `fallo`/`interrumpida` with `notificacion='incierta'`

### Requirement: Send Failures Use the Closed Categories (DEC-81, DEC-185)
A failed send SHALL close with `estado='fallo'`, `fase='notificacion'`, `notificacion='fallo-envio'`, the row count of the query, `codigoError` null, and `error` mapped from the client's category:

| Client category | `error` |
|-----------------|---------|
| `tiempo-agotado` | `tiempo-agotado` |
| `red` | `servidor-inalcanzable` |
| `rechazada` | `envio-rechazado` |
| `respuesta-invalida`, `conflicto`, `abortada` | `error-desconocido` |

A blocked bot, a missing chat, a migrated group, a bad token and a 429 SHALL NOT be told apart. Nothing from Telegram's answer, the URL, the token or the chat id SHALL reach the row or a log line.

#### Scenario: A chat that blocked the bot
- **GIVEN** a query with 3 rows and a `sendMessage` answering `{ ok: false, error_code: 403 }`
- **WHEN** the run closes
- **THEN** the row SHALL have `estado='fallo'`, `fase='notificacion'`, `error='envio-rechazado'`, `codigoError` null, `filas=3`

#### Scenario: A timeout
- **GIVEN** a `sendMessage` with no answer inside the client's deadline
- **WHEN** the run closes
- **THEN** the row SHALL have `error='tiempo-agotado'` and `notificacion='fallo-envio'`

#### Scenario: Nothing sensitive reaches a log
- **GIVEN** a fake transport whose failure carries the token and the chat id in its error message and description
- **WHEN** the run closes
- **THEN** no log entry and no column of the row SHALL contain the token or the chat id

### Requirement: The Message Is the Email's Text Part, Cut to Fit (DEC-185, DEC-188, DEC-197)
The message SHALL be plain text with no `parse_mode` and with link previews disabled. It SHALL hold the same lines as the email's text part for the same input: the template's name, the date line, the body (the header and one line per row when the template's texts are used, otherwise the column row and the `a | b | c` rows), the notices and the footer. The CH-39 fallback to the table SHALL apply and SHALL be recorded in `mensajeRespaldo` as on the email channel. The subject and the HTML part SHALL NOT be sent.

A message SHALL be at most 4096 UTF-16 code units. A longer one SHALL be cut by keeping the leading body lines that fit, whole, with the name, date, notices and footer always kept, and SHALL add the notice «Por el largo del mensaje, entran N de las M filas.», where M is the rows read and N those shown. A line that cannot fit whole with no other row shown SHALL itself be cut by code points and end in «…», so no emoji is split.

#### Scenario: A short message matches the email's text part
- **GIVEN** a result and a template with texts
- **WHEN** both the email and the Telegram message are composed for it
- **THEN** the Telegram message SHALL equal the email's `texto`

#### Scenario: A template with no texts
- **GIVEN** a template with null message texts, columns `a` and `b`, and one row `1`, `2`
- **WHEN** the message is composed
- **THEN** its body SHALL be the lines `a | b` and `1 | 2`

#### Scenario: Characters that are markup elsewhere stay literal
- **GIVEN** a cell holding `<b>*x*</b>_&`
- **WHEN** the message is sent
- **THEN** the text SHALL carry those characters unchanged, and the request SHALL carry no `parse_mode`

#### Scenario: A link in a cell makes no preview
- **GIVEN** a cell holding `https://example.com`
- **WHEN** the message is sent
- **THEN** the request SHALL disable link previews

#### Scenario: A long result is cut and says so
- **GIVEN** 500 rows whose lines add up to more than 4096 code units
- **WHEN** the message is composed
- **THEN** it SHALL be at most 4096 code units, keep the name and the footer, end its body on a whole line, and carry «Por el largo del mensaje, entran N de las 500 filas.»

#### Scenario: The row cap's notice stays
- **GIVEN** a result cut by the row cap whose lines also exceed the limit
- **WHEN** the message is composed
- **THEN** it SHALL carry both the row cap's notice and the length notice

#### Scenario: One line above the limit
- **GIVEN** one row whose line alone exceeds the limit and ends in emoji
- **WHEN** the message is composed
- **THEN** it SHALL be at most 4096 code units, end that line in «…» and contain no unpaired surrogate

#### Scenario: The run row keeps the true count
- **GIVEN** a cut message for a query that returned 500 rows
- **WHEN** the row closes
- **THEN** `filas` SHALL be 500

#### Scenario: A fallback to the table is recorded
- **GIVEN** a template whose line names column `stock`, and a result without it
- **WHEN** the run sends
- **THEN** the message SHALL carry the table's lines and `mensajeRespaldo` SHALL be `["stock"]`

### Requirement: The Poller and the Fixed Answers Stay Unchanged (DEC-185, DEC-196)
The poller SHALL keep linking only and SHALL NOT read or run automations. The bot's two fixed answers SHALL keep their exact request body. The client SHALL be built once at boot and shared by the poller and the channel. With no token, no request to Telegram SHALL be made.

#### Scenario: The fixed answer's request is unchanged
- **WHEN** the poller answers a `/start`
- **THEN** the `sendMessage` body SHALL hold exactly `chat_id` and `text`

### Requirement: Preview on the Telegram Channel (X10, DEC-189, DEC-195)
For an automation with `canal='telegram'`, the preview SHALL decide with the same evaluation as the run, reading the link through the scoped client and the same token signal as the run. Its answer SHALL carry `canal: "telegram"`, `decision` (`enviar`, `omitida-sin-filas`, `omitida-bajo-minimo`, `sin-vinculo`, `no-configurada` or `null`), `para: []`, `correo: null`, and `telegram`: `{ texto }` built by the function a send uses, or `null` when no message can be built. A message SHALL be built for `enviar`, `sin-vinculo` and `no-configurada`. The answer SHALL NOT carry the chat id. The preview SHALL send nothing, SHALL write no run row, and SHALL audit as on the email channel.

#### Scenario: A run would send
- **GIVEN** a Telegram automation with a link, a token and a result reaching its minimum
- **WHEN** it is previewed
- **THEN** `decision` SHALL be `enviar`, `telegram.texto` SHALL be set, `correo` SHALL be null, and nothing SHALL be sent

#### Scenario: No link still shows the message
- **GIVEN** a Telegram automation with no link and a result reaching its minimum
- **WHEN** it is previewed
- **THEN** `decision` SHALL be `sin-vinculo` and `telegram.texto` SHALL be set

#### Scenario: Zero rows build nothing
- **GIVEN** a Telegram automation whose query returns no rows
- **WHEN** it is previewed
- **THEN** `decision` SHALL be `omitida-sin-filas` and `telegram` SHALL be null

#### Scenario: The chat id never leaves
- **GIVEN** a Telegram automation linked to chat 42
- **WHEN** it is previewed
- **THEN** the raw response body SHALL NOT contain the chat id
