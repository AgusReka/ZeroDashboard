# Client Panel Automations Specification (CH-41 delta)

## Purpose
P-04 reads and writes the automation's list of recipients instead of one address, and keeps needing at least one (N6, DEC-187, DEC-194 2(a)).

## MODIFIED Requirements

### Requirement: Read Current Settings
`GET /api/panel/automatizaciones/:id/ajustes` SHALL return `{ umbral?, hora?, dias?, destinatarios, zonaHoraria }`. `umbral` SHALL be present only if the template declares a `umbral` parameter. `hora` (`HH:MM`) and `dias` (`todos`, `lun-vie` or `lun-sab`) SHALL be present only if the stored cron is one of the three DEC-129 patterns. `destinatarios` is the stored list, in order, and `[]` when none is stored. The response SHALL NOT contain `tenantId`, `conexionId`, `valores`, `cron`, `sql`, `codigoError`, `error` or `minimoFilas`.
(Previously: one `destinatario`, `null` when none was stored.)

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

### Requirement: Update Settings In Place
`PUT /api/panel/automatizaciones/:id/ajustes` SHALL accept a strict JSON body `{ umbral?, hora?, dias?, destinatarios? }` with at least one key. The server SHALL build the cron from `{hora, dias}`, replace only `umbral` inside the stored `valores`, validate `valores` against the template declaration, the cron with `cronValido` and `destinatarios` with the list rule of `email-notification`, then perform one tenant-scoped `update`. A sent `destinatarios` SHALL hold at least one address after that rule; an empty list SHALL be refused naming `destinatarios` (DEC-194 2(a)). The response SHALL repeat the read shape plus `proximaEjecucion` (ISO UTC). The change SHALL apply from the next run without any other action.
(Previously: the body took one `destinatario`, validated with `direccionValida`.)

#### Scenario: Valid update is stored
- **GIVEN** an active automation with a preset cron
- **WHEN** `PUT` sends `{ umbral: 5, hora: "09:15", dias: "lun-sab", destinatarios: ["a@b.com", "c@d.com"] }`
- **THEN** the response is 200, the stored cron is `15 9 * * 1-6`, `valores.umbral` is 5, `destinatarios` is `["a@b.com", "c@d.com"]`, and other `valores` keys are unchanged

#### Scenario: Only the sent fields change
- **GIVEN** an automation with cron `0 8 * * *`
- **WHEN** `PUT` sends `{ hora: "10:00" }`
- **THEN** the stored cron is `0 10 * * *` (days kept) and `valores` and recipients are unchanged

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
- **WHEN** `PUT` sends any of `tenantId`, `cron`, `sql`, `valores`, `activo`, `minimoFilas`, the former `destinatario` or an unknown key
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
