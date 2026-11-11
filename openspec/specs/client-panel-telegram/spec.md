# Client Panel Telegram Specification

## Purpose
P2 links the business's Telegram from the panel without technical data (N5, DEC-185): a card shows the link state, gives a one-time code with a direct link to the bot, and lets P2 unlink (DEC-196 5(a)).

## Requirements

### Requirement: Telegram Routes Are Session-Locked Panel Rows
`GET /api/panel/telegram`, `POST /api/panel/telegram/codigo` and `DELETE /api/panel/telegram/vinculo` SHALL be rows of `RUTAS_PANEL_PUBLICAS`, SHALL run behind the panel session hook, and SHALL act only inside the session tenant's context (`tenant-isolation`, "Panel Tenant Derivation Is Session-Locked"). They SHALL take no body or query keys. Without a valid session they SHALL answer like every other panel route.

#### Scenario: No session
- **WHEN** any of the three routes is called with no cookie
- **THEN** the response is 401 `sesion-invalida` and nothing is read or written

### Requirement: Read the Link State
`GET /api/panel/telegram` SHALL return one of:
- `{ estado: "no-disponible" }` when the token is unset or the bot username is not known yet;
- `{ estado: "sin-vincular", bot }` when the tenant has no link and no live code;
- `{ estado: "codigo-pendiente", bot, venceEn }` when the tenant has no link and a live code;
- `{ estado: "vinculado", bot, vinculadoEn, venceEn? }`, where `venceEn` is present only while a replacement code is live.

`bot` is the bot username. Dates are ISO UTC. The response SHALL NOT contain the chat id, the code or its hash, or any tenant id.

#### Scenario: Linked tenant
- **GIVEN** tenant A linked on 2026-11-05 and no live code
- **WHEN** A's session reads the state
- **THEN** the body is `{ estado: "vinculado", bot, vinculadoEn }` with no chat id

#### Scenario: An expired code reads as no code
- **GIVEN** tenant A with no link and a code whose `venceEn` has passed
- **WHEN** A's session reads the state
- **THEN** `estado` is `sin-vincular`

### Requirement: Create a Code
`POST /api/panel/telegram/codigo` SHALL create the tenant's code, replacing any previous one, and answer 201 `{ codigo, bot, enlace, venceEn }` (`bot` is the bot's public username, added by the UX review P-05 so the card can name it), where `enlace` is `https://t.me/<bot>?start=<codigo>`. The plain code SHALL appear only in this response. When the bot is not available it SHALL answer 409 `telegram-no-disponible` and store nothing.

#### Scenario: Code created
- **GIVEN** a configured bot
- **WHEN** tenant A's session posts
- **THEN** the response is 201, `codigo` has 8 characters, `enlace` ends in `?start=<codigo>`, `venceEn` is 10 minutes ahead, and only the code's hash is stored for A

#### Scenario: Bot not available
- **GIVEN** `TELEGRAM_BOT_TOKEN` unset
- **WHEN** the route is called
- **THEN** the response is 409 `telegram-no-disponible` and no code row exists

### Requirement: Unlink
`DELETE /api/panel/telegram/vinculo` SHALL remove the tenant's link and answer 204, also when there was none. It SHALL NOT touch a live code or another tenant's link, and SHALL send nothing to the chat.

#### Scenario: Unlink keeps other tenants
- **GIVEN** tenants A and B linked to the same chat
- **WHEN** A's session unlinks
- **THEN** A has no link and B's link is unchanged

### Requirement: «Avisos por Telegram» Card (P-07)
The panel SHALL show a card titled «Avisos por Telegram» below «Mis automatizaciones», in the «Avisos» content (`client-panel-dashboard`, "Dashboard Section of the Panel Page"), loaded from `GET /api/panel/telegram`, with:
- **no-disponible**: «Por ahora no podés recibir avisos por Telegram.» and no action;
- **sin-vincular**: a short explanation and «Vincular Telegram»;
- **codigo-pendiente** and after creating a code: the code (when this page created it), «Abrir Telegram» pointing to `enlace`, the instruction to send it to the bot, named by its username next to the code (`@<bot>`, from the code response or else from the state; «nuestro bot» when the page has no name), the expiry time in the tenant's time zone, and «Generar otro código»; a code created earlier, whose plain value the page no longer has, shows only the expiry and «Generar otro código»;
- **vinculado**: «Telegram vinculado» with the date, «Vincular otro chat» and «Desvincular», which asks for confirmation first.

The card SHALL follow the panel surface rules of the design guide, the panel glossary (no «tenant», «chat_id», «token» or «bot API»), voseo, and the common loading and error states. Stored or received text SHALL be escaped before it is inserted. The card SHALL load whether or not the dashboard navigation is shown.
(Previously: the card sat above «Mis automatizaciones», as the first block of the page. Moved by UX review P-07: in some states it offers no action and should not be the first thing the client sees.)

#### Scenario: Linking from the card
- **GIVEN** a tenant with no link
- **WHEN** P2 presses «Vincular Telegram»
- **THEN** the card shows the code, «Abrir Telegram» with the link, and the expiry time

#### Scenario: Unlinking asks first
- **WHEN** P2 presses «Desvincular»
- **THEN** a confirmation is shown, and only confirming calls `DELETE`

#### Scenario: The card fails without breaking the list
- **GIVEN** `GET /api/panel/telegram` fails
- **WHEN** the main screen loads
- **THEN** the card shows its error state with «Reintentar», and «Mis automatizaciones» loads as usual

#### Scenario: The card follows the list
- **GIVEN** the authenticated panel page
- **WHEN** its markup is read
- **THEN** the «Avisos por Telegram» card comes after the «Mis automatizaciones» list in document order
