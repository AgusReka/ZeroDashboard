# Client Panel Automations Specification (CH-22c, CH-23)

## Purpose
Extend CH-22b to show a visible failure state in business language when an active automation's last finished run failed. Fulfils story **P3h**. Enforce Rules 1 and 2; no schema changes, no email notification.

## MODIFIED Requirements (overriding CH-22b where specified)

### Requirement: Business Status Includes Failure (replaces/extends CH-22b status rule)
Each `activas` item SHALL carry `estado` in `{ 'activa', 'pausada', 'con_falla' }`.
- `pausada` when `activo === false`.
- `con_falla` when `activo === true` AND `ultimaEjecucion !== null` AND `ultimaEjecucion.resultado === 'no-realizada'` (latest finished run was `fallo` or `omitida`).
- `activa` otherwise when `activo === true` (last run was `completada` or there is no finished run).
A paused automation SHALL never be `con_falla`. The failure state is visible only for active automations.

#### Scenario: Active automation with failed last run becomes con_falla
- **GIVEN** an automation with `activo = true` whose latest finished execution has `estado = 'fallo'` (so `resultado` is `no-realizada`)
- **WHEN** `GET /api/panel/automatizaciones` is called
- **THEN** its `estado` SHALL be `con_falla`

#### Scenario: Active automation with successful last run remains activa
- **GIVEN** an automation with `activo = true` and latest finished execution `ok` → `completada`
- **WHEN** called
- **THEN** `estado` SHALL be `activa`

#### Scenario: Active automation with only in-progress run remains activa (no finished failure)
- **GIVEN** `activo = true`, only `en-curso` executions
- **WHEN** called
- **THEN** `ultimaEjecucion` is `null` and `estado` SHALL be `activa`

#### Scenario: Paused automation with failed last run is pausada (never con_falla)
- **GIVEN** `activo = false` and latest finished execution was `fallo`
- **WHEN** called
- **THEN** its item appears in `activas` with `estado = 'pausada'` and no failure banner derived from it as "active failure"

### Requirement: Failure Banner Visible in Panel (UI)
When `estado === 'con_falla'`, the panel card SHALL show an inline error banner with business language (no technical terms/codes). The banner text is pinned by page tests and uses only glossary-compliant terms.

#### Scenario: Card shows failure banner for con_falla
- **GIVEN** response contains an active automation with `estado = 'con_falla'`
- **WHEN** the panel renders
- **THEN** the card shows a failure banner with title/body in business language (e.g. "No pudimos completar esta automatización esta vez")

### Requirement: Allow-List and No Technical Fields (unchanged)
Projection remains allow-listed (each `activas` item additionally carries the opaque `id`, see CH-23 below); response SHALL NOT contain `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`. No template SQL exposed.

### Requirement: Isolation and Auth (unchanged)
Tenant only from session; `X-Tenant-Id` ignored; 401/409 unchanged; exemption row unchanged.

### Requirement: Last Execution Semantics (unchanged)
`ultimaEjecucion` remains the latest finished execution (not `en-curso`), with `fecha = finalizadaEn ?? iniciadaEn` (ISO UTC) and `resultado` `completada`/`no-realizada`. `omitida` maps to `no-realizada`.

## ADDED Requirements (CH-23, in-place adjustment, story P2h)

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
