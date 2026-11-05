# Client Panel Automations Specification (CH-44 delta)

## ADDED Requirements

### Requirement: Card Notice When a Telegram Automation Has No Chat (DEC-197)
An `activas` item SHALL carry `sinVinculo: true` exactly when its automation is active, has `canal='telegram'` and the session's tenant has no `VinculoTelegram`; otherwise the key SHALL be absent. It SHALL be derived from those two reads, with no `Ejecucion` read and no token check. The card SHALL then show a warning banner titled «Este aviso no te está llegando» with the body «Se manda por Telegram y no hay un chat vinculado.» It SHALL NOT change `estado` or `ultimaEjecucion`: the run's result still reads as it does today.

#### Scenario: A Telegram automation with no link
- **GIVEN** an active automation with `canal='telegram'` and no link on the tenant
- **WHEN** the panel reads the list
- **THEN** its item SHALL have `sinVinculo: true`, and its card SHALL show the banner

#### Scenario: Unlinking shows the notice
- **GIVEN** a Telegram automation whose last run has `estado='ok'`, on a tenant that then unlinks
- **WHEN** the panel reads the list
- **THEN** the item SHALL have `sinVinculo: true`, and `ultimaEjecucion.resultado` SHALL still be `completada`

#### Scenario: A link or another channel shows no notice
- **GIVEN** a Telegram automation on a linked tenant, and a `correo` automation on an unlinked one
- **WHEN** the panel reads each list
- **THEN** neither item SHALL have `sinVinculo`

#### Scenario: A paused automation shows no notice
- **GIVEN** a deactivated Telegram automation with no link
- **WHEN** the panel reads the list
- **THEN** its item SHALL NOT have `sinVinculo`

#### Scenario: Another tenant's link does not count
- **GIVEN** tenant A with a Telegram automation and no link, and tenant B with a link
- **WHEN** A's session reads the list
- **THEN** A's item SHALL have `sinVinculo: true`

## MODIFIED Requirements

### Requirement: Automations Read Route and Response Shape (DEC-137)

The system SHALL expose `GET /api/panel/automatizaciones`, a read-only route that answers `200` with exactly the keys `activas`, `disponibles`, `zonaHoraria` and `truncado`. `activas` SHALL be an array of the tenant's automations, each with exactly `titulo`, `descripcion`, `estado`, `ultimaEjecucion`, `proximaEjecucion` and, only when applicable, `frecuencia` and `sinVinculo`. `disponibles` SHALL be an array of items with exactly `titulo` and `descripcion`. `zonaHoraria` SHALL be the deployment-wide IANA zone (DEC-77) that the schedules are resolved in. `truncado` SHALL be a boolean. The route SHALL NOT accept a body, a query parameter or a path parameter that influences its result.
(Previously: the only conditional key was `frecuencia`.)

#### Scenario: Successful read with active and available entries

- **GIVEN** an authenticated session whose tenant has one active automation of the `stock-fisico` template and no automation of the `stock-producible` template
- **WHEN** `GET /api/panel/automatizaciones` is called
- **THEN** the response SHALL be `200`
- **AND** the body keys SHALL be exactly `activas`, `disponibles`, `zonaHoraria`, `truncado`
- **AND** `activas` SHALL contain one item and `disponibles` SHALL contain the `stock-producible` entry

#### Scenario: Tenant without any automation

- **GIVEN** an authenticated session whose tenant has no `Automatizacion` rows
- **WHEN** the route is called
- **THEN** `activas` SHALL be `[]`, `truncado` SHALL be `false`
- **AND** `disponibles` SHALL list every template that has business copy

#### Scenario: zonaHoraria reports the deployment zone

- **GIVEN** the registrar was given the zone `America/Argentina/Buenos_Aires`
- **WHEN** the route is called
- **THEN** `zonaHoraria` SHALL equal `America/Argentina/Buenos_Aires`

### Requirement: Allow-List Projection Without Technical Fields (Rule 1, DEC-137)

The response SHALL be built by an explicit allow-list projection of named output keys, never by passing a stored row through. The serialized response SHALL NOT contain, at any depth, the keys `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql` or `chatId`. The route SHALL NOT read or reproduce the by-id template route (`GET /plantillas/:id`) nor any console projection (`AutomatizacionResumen`, `EjecucionListada`, `PlantillaResumen`). The template's console `nombre` SHALL NOT be returned. Each `activas` item also carries the opaque `id` (CH-23, "List Items Carry an Opaque Id").
(Previously: `chatId` was not named, and items had no `sinVinculo`.)

#### Scenario: Forbidden keys are absent

- **GIVEN** a tenant with an automation that has `valores`, a `conexionId`, a failed execution with `error` and `codigoError`, a template with `sql`, and a linked chat
- **WHEN** the route is called
- **THEN** the parsed body, walked recursively, SHALL contain none of the keys `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`, `chatId`
- **AND** the raw body text SHALL NOT contain the template's SQL text, the stored error code or the chat id

#### Scenario: Only allow-listed keys per item

- **GIVEN** any non-empty response
- **WHEN** the keys of each `activas` item and each `disponibles` item are listed
- **THEN** `activas` items SHALL use only `id`, `titulo`, `descripcion`, `estado`, `frecuencia`, `ultimaEjecucion`, `proximaEjecucion`, `sinVinculo`
- **AND** `disponibles` items SHALL use only `titulo` and `descripcion`

### Requirement: Read Current Settings
`GET /api/panel/automatizaciones/:id/ajustes` SHALL return `{ umbral?, hora?, dias?, destinatarios, canal, canales, zonaHoraria }`. `umbral` SHALL be present only if the template declares a `umbral` parameter. `hora` (`HH:MM`) and `dias` (`todos`, `lun-vie` or `lun-sab`) SHALL be present only if the stored cron is one of the three DEC-129 patterns. `destinatarios` is the stored list, in order, and `[]` when none is stored. `canal` is the stored channel. `canales` is the list the client may choose from: always `correo`, plus `telegram` when the stored channel is `telegram`, or when the token is configured and the tenant has a link. The response SHALL NOT contain `tenantId`, `conexionId`, `valores`, `cron`, `sql`, `codigoError`, `error`, `minimoFilas` or `chatId`.
(Previously: there was no `canal` or `canales`.)

#### Scenario: Preset schedule is returned as hour and days
- **GIVEN** an automation with cron `30 8 * * 1-5` and `valores = { umbral: 20 }`
- **WHEN** its settings are read
- **THEN** the body has `umbral: 20`, `hora: "08:30"`, `dias: "lun-vie"`

#### Scenario: Custom cron hides the schedule
- **GIVEN** an automation with cron `0 */6 * * *`
- **WHEN** its settings are read
- **THEN** the body has no `hora` and no `dias`, and no cron text

#### Scenario: The recipients are returned as a list
- **GIVEN** an automation with `destinatarios` `["a@b.com", "c@d.com"]`
- **WHEN** its settings are read
- **THEN** the body has `destinatarios: ["a@b.com", "c@d.com"]`

#### Scenario: A linked tenant may choose Telegram
- **GIVEN** a `correo` automation, a configured token and a linked tenant
- **WHEN** its settings are read
- **THEN** the body has `canal: "correo"` and `canales: ["correo", "telegram"]`

#### Scenario: An unlinked tenant may not
- **GIVEN** a `correo` automation and no link
- **WHEN** its settings are read
- **THEN** `canales` is `["correo"]`

#### Scenario: No token, no Telegram to choose
- **GIVEN** a `correo` automation, a stored link and no token
- **WHEN** its settings are read
- **THEN** `canales` is `["correo"]`

#### Scenario: A Telegram automation can always go back
- **GIVEN** a `telegram` automation, with no link and no token
- **WHEN** its settings are read
- **THEN** the body has `canal: "telegram"` and `canales: ["correo", "telegram"]`

### Requirement: Update Settings In Place
`PUT /api/panel/automatizaciones/:id/ajustes` SHALL accept a strict JSON body `{ umbral?, hora?, dias?, destinatarios?, canal? }` with at least one key. The server SHALL build the cron from `{hora, dias}`, replace only `umbral` inside the stored `valores`, validate `valores` against the template declaration, the cron with `cronValido` and `destinatarios` with the list rule of `email-notification`, then perform one tenant-scoped `update`. A sent `destinatarios` SHALL hold at least one address after that rule; an empty list SHALL be refused naming `destinatarios` (DEC-194 2(a)). A sent `canal` SHALL be one of the `canales` the read answers for that automation at that moment; otherwise the update SHALL be refused naming `canal`. A body changing `canal` to `correo` SHALL end with at least one address, sent or stored; otherwise it SHALL be refused naming `destinatarios`. The response SHALL repeat the read shape plus `proximaEjecucion` (ISO UTC). The change SHALL apply from the next run without any other action.
(Previously: there was no `canal`.)

#### Scenario: Valid update is stored
- **GIVEN** an active automation with a preset cron
- **WHEN** `PUT` sends `{ umbral: 5, hora: "09:15", dias: "lun-sab", destinatarios: ["a@b.com", "c@d.com"] }`
- **THEN** the response is 200, the stored cron is `15 9 * * 1-6`, `valores.umbral` is 5, `destinatarios` is `["a@b.com", "c@d.com"]`, and other `valores` keys are unchanged

#### Scenario: Only the sent fields change
- **GIVEN** an automation with cron `0 8 * * *`
- **WHEN** `PUT` sends `{ hora: "10:00" }`
- **THEN** the stored cron is `0 10 * * *` (days kept) and `valores`, recipients and channel are unchanged

#### Scenario: Invalid values name the field in business terms
- **WHEN** `PUT` sends `{ umbral: "x", hora: "25:00", destinatarios: ["a@b.com", "no-es-un-correo"] }`
- **THEN** the response is 400 `solicitud-invalida` with `campos` listing `umbral`, `hora` and `destinatarios`, and nothing is stored

#### Scenario: The panel cannot empty the list
- **GIVEN** an automation with recipients
- **WHEN** `PUT` sends `{ destinatarios: [] }` or a list whose elements are all blank
- **THEN** the response is 400 `solicitud-invalida` with `campos` containing `destinatarios`, and the stored list is unchanged

#### Scenario: More than five addresses are refused
- **WHEN** `PUT` sends six distinct valid addresses
- **THEN** the response is 400 with `campos` containing `destinatarios`, and nothing is stored

#### Scenario: Forbidden keys are refused
- **WHEN** `PUT` sends any of `tenantId`, `cron`, `sql`, `valores`, `activo`, `minimoFilas`, `chatId`, the former `destinatario` or an unknown key
- **THEN** the response is 400 and nothing is stored

#### Scenario: Unknown or foreign id
- **GIVEN** an automation of tenant B
- **WHEN** tenant A's session calls `GET` or `PUT` with that id
- **THEN** the response is 404 `automatizacion-no-encontrada`, identical to an unknown id, and tenant B's row is unchanged

#### Scenario: Paused automation is not adjustable
- **GIVEN** an automation with `activo = false`
- **WHEN** `PUT` is called
- **THEN** the response is 409 `automatizacion-pausada`

#### Scenario: Schedule change over a custom cron is refused
- **GIVEN** an automation with a non-preset cron
- **WHEN** `PUT` sends `hora` or `dias`
- **THEN** the response is 409 `horario-no-editable` and the cron is unchanged

#### Scenario: Umbral on a template without it
- **GIVEN** a template that does not declare `umbral`
- **WHEN** `PUT` sends `umbral`
- **THEN** the response is 400 with `campos` containing `umbral`

#### Scenario: Switching to Telegram keeps the recipients
- **GIVEN** a `correo` automation with recipients, on a linked tenant with a token
- **WHEN** `PUT` sends `{ canal: "telegram" }`
- **THEN** the response is 200, `canal` is `telegram` and `destinatarios` is unchanged

#### Scenario: Telegram without a link is refused
- **GIVEN** a `correo` automation on an unlinked tenant
- **WHEN** `PUT` sends `{ canal: "telegram" }`
- **THEN** the response is 400 with `campos` containing `canal`, and nothing is stored

#### Scenario: An unknown channel is refused
- **WHEN** `PUT` sends `{ canal: "sms" }`
- **THEN** the response is 400 with `campos` containing `canal`, and nothing is stored

#### Scenario: Going back to email needs an address
- **GIVEN** a `telegram` automation with `destinatarios` `[]`
- **WHEN** `PUT` sends `{ canal: "correo" }`
- **THEN** the response is 400 with `campos` containing `destinatarios`, and the channel is unchanged

#### Scenario: Going back to email with an address
- **GIVEN** a `telegram` automation with `destinatarios` `[]`
- **WHEN** `PUT` sends `{ canal: "correo", destinatarios: ["a@b.com"] }`
- **THEN** the response is 200 with `canal: "correo"` and that list

### Requirement: Adjust Form (P-04)
For `activa` and `con_falla` cards the panel SHALL offer "Ajustar", which opens a form with the number, the time, the days and the email, prefilled from the read. When `canales` holds more than one value, the form SHALL also show a select «Enviar por» with «Correo» and «Telegram», set to `canal`. With «Telegram» chosen, the «Enviar a» field SHALL be hidden and the body SHALL NOT send `destinatarios`; with «Correo» chosen, the field SHALL show its stored or typed value. The body SHALL send `canal` only when it changed. The form SHALL show validation per field, a success banner "Se aplican desde la próxima revisión", and SHALL NOT show SQL, cron, identifiers or technical terms. On success the card is refreshed. An automation whose `canales` holds one value SHALL show the form as before.
(Previously: the form had no channel.)

#### Scenario: Successful save
- **WHEN** the client saves valid values
- **THEN** the banner "Se aplican desde la próxima revisión" is shown and the card shows the new frequency and next review

#### Scenario: Field error
- **WHEN** the server answers 400 with `campos`
- **THEN** the offending fields are marked with a business-language message and nothing is reported as saved

#### Scenario: Choosing Telegram
- **GIVEN** the form of a `correo` automation whose `canales` holds both values
- **WHEN** «Telegram» is chosen and saved
- **THEN** «Enviar a» is hidden, and the body is `{ canal: "telegram" }`

#### Scenario: No choice to offer
- **GIVEN** the form of a `correo` automation whose `canales` is `["correo"]`
- **THEN** «Enviar por» is not shown, and «Enviar a» is

#### Scenario: A failed choice names the field
- **GIVEN** a link removed after the form opened
- **WHEN** «Telegram» is saved and the server answers 400 with `campos` containing `canal`
- **THEN** the field is marked with «Elegí por dónde querés recibir este aviso.» and nothing is reported as saved
