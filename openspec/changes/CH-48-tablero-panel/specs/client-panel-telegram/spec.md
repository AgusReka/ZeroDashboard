# Client Panel Telegram Specification (CH-48 delta)

## MODIFIED Requirements

### Requirement: «Avisos por Telegram» Card (P-07)
The panel SHALL show a card titled «Avisos por Telegram» below «Mis automatizaciones», in the «Avisos» content (`client-panel-dashboard`, "Dashboard Section of the Panel Page"), loaded from `GET /api/panel/telegram`, with:
- **no-disponible**: «Por ahora no podés recibir avisos por Telegram.» and no action;
- **sin-vincular**: a short explanation and «Vincular Telegram»;
- **codigo-pendiente** and after creating a code: the code (when this page created it), «Abrir Telegram» pointing to `enlace`, the instruction to send it to the bot, the expiry time in the tenant's time zone, and «Generar otro código»; a code created earlier, whose plain value the page no longer has, shows only the expiry and «Generar otro código»;
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
