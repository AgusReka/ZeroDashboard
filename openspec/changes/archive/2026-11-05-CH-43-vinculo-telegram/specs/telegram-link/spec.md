# Telegram Link Specification (CH-43, new)

## Purpose
A tenant links one Telegram chat to the platform's global bot with a one-time code, read by polling Telegram outward with no webhook and no inbound port (N5, DEC-185, DEC-196). The link is what CH-44 will send notices to. This capability sends nothing to the chat except the bot's two fixed answers, and never runs an automation.

Bot API facts this spec relies on, from the Bot API reference (core.telegram.org/bots/api, "Making requests", `getUpdates`, `Chat`) and the features page (core.telegram.org/bots/features, "Deep linking"), checked on 2026-11-04:
- Requests go to `https://api.telegram.org/bot<token>/<method>`, so the token is in every URL. Every response is a JSON object with a boolean `ok`, and an optional `description` and `error_code`.
- "An update is considered confirmed as soon as getUpdates is called with an offset higher than its update_id." Unconfirmed updates are kept no longer than 24 hours. `timeout` is the long-poll wait in seconds.
- getUpdates "will not work if an outgoing webhook is set up."
- A chat id "may have more than 32 significant bits" and "at most 52 significant bits".
- A deep link `https://t.me/<bot_username>?start=<parameter>` makes the bot receive `/start <parameter>`. The parameter allows `A-Z`, `a-z`, `0-9`, `_` and `-`, up to 64 characters.

## ADDED Requirements

### Requirement: Link Model, One Chat and One Live Code per Tenant (DEC-185)
The system SHALL store at most one `VinculoTelegram` per tenant (`tenantId` unique, `chatId` as a 64-bit integer, `vinculadoEn`) and at most one `CodigoVinculoTelegram` per tenant (`tenantId` unique, `codigoHash` unique, `venceEn`, `creadoEn`). Neither table SHALL store a Telegram username, display name, message text or the plain code (rule 5). Both models SHALL be tenant-scoped by the isolation extension.

#### Scenario: A chat id above 32 bits is kept exactly
- **GIVEN** a `/start` with a valid code from chat `-1001234567890123`
- **WHEN** the link is stored and read back
- **THEN** the stored `chatId` equals `-1001234567890123` exactly

#### Scenario: No personal data is stored
- **GIVEN** an update whose `message.from` carries a username, first name and last name
- **WHEN** it links a tenant
- **THEN** the stored rows contain only the columns above

### Requirement: One-Time Code
A code SHALL be 8 characters from the Crockford base32 alphabet (`0-9`, `A-Z` without `I`, `L`, `O`, `U`), generated from a cryptographic random source, and valid 10 minutes from creation. Only its SHA-256 hex digest SHALL be stored. Creating a code for a tenant SHALL replace that tenant's previous code. A code SHALL be deleted when it links. Before hashing, a received code SHALL be normalized: spaces and hyphens removed, upper-cased, `O` read as `0`, `I` and `L` read as `1`.

#### Scenario: A new code replaces the previous one
- **GIVEN** tenant A with a live code C1
- **WHEN** A creates code C2
- **THEN** only C2's hash is stored for A, and `/start C1` is answered as not valid

#### Scenario: A code typed loosely still matches
- **GIVEN** a live code `7KQ2M9XA`
- **WHEN** the bot receives `/start 7kq2-m9xa`
- **THEN** the tenant is linked

#### Scenario: An expired code does not link
- **GIVEN** a code whose `venceEn` has passed
- **WHEN** the bot receives `/start <code>`
- **THEN** no link is stored or changed, and the "not valid" answer is sent

### Requirement: Linking Derives the Tenant Only From the Code Row (rule 2)
On a message whose text is `/start <payload>` or `/start@<bot> <payload>`, the poller SHALL normalize and hash the payload, find the code row by `codigoHash` through the single unscoped lookup defined in `tenant-isolation`, and, when the row exists and is not expired, enter that tenant's context. Inside that context it SHALL, in one transaction, replace the tenant's link with the message's `chat.id` and delete the code. The tenant id SHALL NOT come from any field of the Telegram update. A chat MAY be linked to several tenants. A new link SHALL replace the tenant's previous chat (DEC-196 3(a)). Any other message SHALL be ignored, with no answer.

#### Scenario: A valid code links the chat
- **GIVEN** tenant A with a live code and no link
- **WHEN** chat 42 sends `/start <code>`
- **THEN** A's link has `chatId` 42, A has no code, and chat 42 gets the success answer

#### Scenario: Relinking replaces the chat
- **GIVEN** tenant A linked to chat 42 and a new live code
- **WHEN** chat 77 sends `/start <code>`
- **THEN** A's link has `chatId` 77, and there is still one link for A

#### Scenario: One chat for two tenants
- **GIVEN** tenant A linked to chat 42 and a live code for tenant B
- **WHEN** chat 42 sends `/start <B's code>`
- **THEN** A and B are both linked to chat 42

#### Scenario: Other messages are ignored
- **WHEN** the bot receives `hola`, `/start` with no payload, `/ayuda`, or an update with no message text
- **THEN** nothing is stored and nothing is sent

### Requirement: Fixed Bot Answers (DEC-196 2(a))
After a successful link the poller SHALL send exactly «Listo, este chat va a recibir los avisos de <nombre>.», where `<nombre>` is the tenant's name from its own row. After a `/start <payload>` that does not match a live code, it SHALL send exactly «Ese código no es válido o ya venció. Generá uno nuevo desde el panel.». No other text SHALL be sent. A failed answer SHALL be logged by category and SHALL NOT undo the link.

#### Scenario: The answer failing keeps the link
- **GIVEN** a valid code and a `sendMessage` that fails
- **WHEN** the code is received
- **THEN** the link is stored and the failure is logged by category only

### Requirement: Guessing Cap per Chat
A chat that sends 5 non-matching codes within 10 minutes SHALL be ignored for the next 10 minutes: its `/start` messages are neither looked up nor answered. The count SHALL be kept in memory and MAY reset on restart.

#### Scenario: The sixth attempt is ignored
- **GIVEN** chat 42 sent 5 wrong codes in the last 10 minutes
- **WHEN** it sends a valid code
- **THEN** nothing is looked up or answered, and the tenant stays unlinked until the window passes

### Requirement: Poller Lifecycle, Separate From the Scheduler
When the bot token is configured, the poller SHALL start after the HTTP server listens. It SHALL call `getMe` until it succeeds, keep the bot username in memory, then loop on `getUpdates` with long polling (`timeout` 25 s, `allowed_updates` `["message"]`), passing an `offset` one greater than the last `update_id` it handled. The offset SHALL live in memory. Requests SHALL never overlap. The poller SHALL NOT read or run automations, and SHALL NOT enter a tenant context except to link. On app close, `detener()` SHALL abort the request in flight and resolve without waiting for the long-poll timeout. With no token, the poller SHALL NOT start and SHALL make no request.

#### Scenario: Handled updates are confirmed by the next offset
- **GIVEN** a `getUpdates` answer with updates 10 and 11
- **WHEN** they are handled
- **THEN** the next request carries `offset` 12

#### Scenario: Shutdown does not wait for the long poll
- **GIVEN** a `getUpdates` request in flight
- **WHEN** the app closes
- **THEN** `detener()` resolves before the 25 s wait ends, and no further request is made

#### Scenario: No token, no requests
- **GIVEN** `TELEGRAM_BOT_TOKEN` unset
- **WHEN** the app starts and runs
- **THEN** no request to Telegram is made

### Requirement: Errors Back Off and Never Stop the App
A network failure, a timeout, a non-JSON body, an answer with `ok: false` (including the conflict a webhook or a second poller causes), or a malformed update list SHALL make the poller wait before the next request: exponential with equal jitter, between 1 s and 60 s, reset after a successful request. The poller SHALL log only the error category, never a URL, token, `description`, response body or message text. A malformed single update SHALL be skipped and its id still confirmed.

#### Scenario: Repeated conflicts back off
- **GIVEN** `getUpdates` answering `{ ok: false, error_code: 409 }` three times
- **WHEN** the poller retries
- **THEN** the waits grow and stay within [1 s, 60 s], and the app keeps serving

#### Scenario: The token never reaches a log
- **GIVEN** a fake transport whose every failure carries the token in its error message
- **WHEN** the poller runs through those failures
- **THEN** no log entry and no thrown error contains the token
