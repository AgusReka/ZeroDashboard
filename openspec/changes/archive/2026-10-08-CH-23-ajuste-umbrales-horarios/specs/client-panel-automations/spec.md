# Client Panel Automations Specification (CH-23 delta)

## Purpose
Add in-place adjustment of an automation from the client panel (story **P2h**). Enforces Rules 1, 2 and 6. Decisions: DEC-138 to DEC-141.

## ADDED Requirements

### Requirement: List Items Carry an Opaque Id
Each `activas` item SHALL carry `id`, the automation's identifier, and nothing else new. The rest of the allow-list (CH-22b, CH-22c) is unchanged.

#### Scenario: Active item has an id
- **GIVEN** a tenant with one automation
- **WHEN** `GET /api/panel/automatizaciones` is called with its session
- **THEN** the item has a non-empty string `id`

### Requirement: Read Current Settings
`GET /api/panel/automatizaciones/:id/ajustes` SHALL return `{ umbral?, hora?, dias?, destinatario, zonaHoraria }`. `umbral` SHALL be present only if the template declares a `umbral` parameter. `hora` (`HH:MM`) and `dias` (`todos`, `lun-vie` or `lun-sab`) SHALL be present only if the stored cron is one of the three DEC-129 patterns. `destinatario` is `null` when none is stored. The response SHALL NOT contain `tenantId`, `conexionId`, `valores`, `cron`, `sql`, `codigoError` or `error`.

#### Scenario: Preset schedule is returned as hour and days
- **GIVEN** an automation with cron `30 8 * * 1-5` and `valores = { umbral: 20 }`
- **WHEN** its settings are read
- **THEN** the body has `umbral: 20`, `hora: "08:30"`, `dias: "lun-vie"`

#### Scenario: Custom cron hides the schedule
- **GIVEN** an automation with cron `0 */6 * * *`
- **WHEN** its settings are read
- **THEN** the body has no `hora` and no `dias`, and no cron text

### Requirement: Update Settings In Place
`PUT /api/panel/automatizaciones/:id/ajustes` SHALL accept a strict JSON body `{ umbral?, hora?, dias?, destinatario? }` with at least one key. The server SHALL build the cron from `{hora, dias}`, replace only `umbral` inside the stored `valores`, validate `valores` against the template declaration, the cron with `cronValido` and the recipient with `direccionValida`, then perform one tenant-scoped `update`. The response SHALL repeat the read shape plus `proximaEjecucion` (ISO UTC). The change SHALL apply from the next run without any other action.

#### Scenario: Valid update is stored
- **GIVEN** an active automation with a preset cron
- **WHEN** `PUT` sends `{ umbral: 5, hora: "09:15", dias: "lun-sab", destinatario: "a@b.com" }`
- **THEN** the response is 200, the stored cron is `15 9 * * 1-6`, `valores.umbral` is 5, and other `valores` keys are unchanged

#### Scenario: Only the sent fields change
- **GIVEN** an automation with cron `0 8 * * *`
- **WHEN** `PUT` sends `{ hora: "10:00" }`
- **THEN** the stored cron is `0 10 * * *` (days kept) and `valores` and recipient are unchanged

#### Scenario: Invalid values name the field in business terms
- **WHEN** `PUT` sends `{ umbral: "x", hora: "25:00", destinatario: "no-es-un-correo" }`
- **THEN** the response is 400 `solicitud-invalida` with `campos` listing `umbral`, `hora` and `destinatario`, and nothing is stored

#### Scenario: Forbidden keys are refused
- **WHEN** `PUT` sends any of `tenantId`, `cron`, `sql`, `valores`, `activo` or an unknown key
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

### Requirement: Session and Tenant Only
Both routes SHALL require the panel session (401/409 as the other panel API routes) and SHALL take the tenant only from it; `X-Tenant-Id` has no effect. Both SHALL be listed in `RUTAS_PANEL_PUBLICAS`.

### Requirement: Adjust Form (P-04)
For `activa` and `con_falla` cards the panel SHALL offer "Ajustar", which opens a form with the number, the time, the days and the email, prefilled from the read. The form SHALL show validation per field, a success banner "Se aplican desde la próxima revisión", and SHALL NOT show SQL, cron, identifiers or technical terms. On success the card is refreshed.

#### Scenario: Successful save
- **WHEN** the client saves valid values
- **THEN** the banner "Se aplican desde la próxima revisión" is shown and the card shows the new frequency and next review

#### Scenario: Field error
- **WHEN** the server answers 400 with `campos`
- **THEN** the offending fields are marked with a business-language message and nothing is reported as saved
