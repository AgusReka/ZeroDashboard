# Client Panel Automations Specification

## Purpose

Letting the client (P2, business administrator) see in the panel which automations the business has and which ones it could have, with status, last run and next run, in business language and without any SQL or technical term (story **P1h**, CH-22b); showing a visible failure state when an active automation's last finished run failed (story **P3h**, CH-22c); and adjusting an automation in place (story **P2h**, CH-23). Strictly enforces **Rule 1** (no SQL, no technical terms in P2) and **Rule 2** (tenant derived exclusively from the session). The contract is fixed by DEC-137 and DEC-138; the tenant derivation by DEC-135; the surface by DEC-04 and DEC-136; the template copy by DEC-128; the schedule patterns by DEC-129.

## Requirements

### Requirement: Automations Read Route and Response Shape (DEC-137)

The system SHALL expose `GET /api/panel/automatizaciones`, a read-only route that answers `200` with exactly the keys `activas`, `disponibles`, `zonaHoraria` and `truncado`. `activas` SHALL be an array of the tenant's automations, each with exactly `titulo`, `descripcion`, `estado`, `ultimaEjecucion`, `proximaEjecucion` and, only when applicable, `frecuencia`. `disponibles` SHALL be an array of items with exactly `titulo` and `descripcion`. `zonaHoraria` SHALL be the deployment-wide IANA zone (DEC-77) that the schedules are resolved in. `truncado` SHALL be a boolean. The route SHALL NOT accept a body, a query parameter or a path parameter that influences its result.

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

### Requirement: Session Guard and Status Codes (DEC-135, DEC-137)

The route SHALL run behind `levantarSesionPanel` and SHALL execute every query inside `conTenantActivo` entered from the resolved session. A request without a session cookie or with an unknown token SHALL be answered `401 { error: 'sesion-invalida' }`; a request whose session has expired SHALL be answered `401 { error: 'sesion-expirada' }`; a request whose tenant is deactivated SHALL be answered `409 { error: 'tenant-desactivado' }`. None of these answers SHALL carry automation data, and no query SHALL run before the session resolves.

#### Scenario: No cookie

- **GIVEN** a request without a `Cookie` header
- **WHEN** `GET /api/panel/automatizaciones` is called
- **THEN** the response SHALL be `401` with `{ error: 'sesion-invalida' }`

#### Scenario: Expired session

- **GIVEN** a session whose `expiraEn` has passed
- **WHEN** the route is called with its cookie
- **THEN** the response SHALL be `401` with `{ error: 'sesion-expirada' }`
- **AND** the body SHALL NOT contain `activas` or `disponibles`

#### Scenario: Deactivated tenant

- **GIVEN** a valid, unexpired session whose tenant has `activo = false`
- **WHEN** the route is called
- **THEN** the response SHALL be `409` with `{ error: 'tenant-desactivado' }`
- **AND** no automation or next-run value SHALL be computed or returned

### Requirement: Tenant Derives Only From the Session and Isolation Holds (Rule 2, DEC-135)

The route SHALL return only rows of the session's tenant. A client-supplied `X-Tenant-Id` header SHALL have no effect on the result (the route is exempt from the header hooks by an exact row, so the header is never read). Any query parameter or body naming a tenant SHALL be ignored.

#### Scenario: Foreign X-Tenant-Id is ignored

- **GIVEN** an active session for Tenant A and a request carrying `X-Tenant-Id: <id-de-tenant-b>`
- **WHEN** the route is called
- **THEN** the response SHALL contain only Tenant A's automations
- **AND** no title, date or entry derived from Tenant B's rows SHALL appear

#### Scenario: Two tenants see only their own automations

- **GIVEN** Tenant A with an active `stock-fisico` automation and an execution, and Tenant B with an active `stock-producible` automation and an execution
- **WHEN** each tenant's user calls the route
- **THEN** A's `activas` SHALL contain only the `stock-fisico` entry and A's `disponibles` SHALL contain only the `stock-producible` entry
- **AND** B's response SHALL be the mirror image
- **AND** neither response SHALL contain the other tenant's execution date

### Requirement: Allow-List Projection Without Technical Fields (Rule 1, DEC-137)

The response SHALL be built by an explicit allow-list projection of named output keys, never by passing a stored row through. The serialized response SHALL NOT contain, at any depth, the keys `tenantId`, `conexionId`, `valores`, `codigoError`, `error` or `sql`. The route SHALL NOT read or reproduce the by-id template route (`GET /plantillas/:id`) nor any console projection (`AutomatizacionResumen`, `EjecucionListada`, `PlantillaResumen`). The template's console `nombre` SHALL NOT be returned. Each `activas` item also carries the opaque `id` (CH-23, "List Items Carry an Opaque Id").

#### Scenario: Forbidden keys are absent

- **GIVEN** a tenant with an automation that has `valores`, a `conexionId`, a failed execution with `error` and `codigoError`, and a template with `sql`
- **WHEN** the route is called
- **THEN** the parsed body, walked recursively, SHALL contain none of the keys `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`
- **AND** the raw body text SHALL NOT contain the template's SQL text or the stored error code

#### Scenario: Only allow-listed keys per item

- **GIVEN** any non-empty response
- **WHEN** the keys of each `activas` item and each `disponibles` item are listed
- **THEN** `activas` items SHALL use only `id`, `titulo`, `descripcion`, `estado`, `frecuencia`, `ultimaEjecucion`, `proximaEjecucion`
- **AND** `disponibles` items SHALL use only `titulo` and `descripcion`

### Requirement: Business Status Includes Failure (DEC-137, CH-22c)
Each `activas` item SHALL carry `estado` in `{ 'activa', 'pausada', 'con_falla' }`.
- `pausada` when `activo === false`.
- `con_falla` when `activo === true` AND `ultimaEjecucion !== null` AND `ultimaEjecucion.resultado === 'no-realizada'` (latest finished run was `fallo` or `omitida`).
- `activa` otherwise when `activo === true` (last run was `completada` or there is no finished run).
A paused automation SHALL never be `con_falla`. The failure state is visible only for active automations.
(Previously, in CH-22b: only `activa` or `pausada`, and a failed last execution did not change the status.)

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

### Requirement: Available Automations Rule (DEC-137)

`disponibles` SHALL contain every global template that has a business copy entry (DEC-128) and for which the session's tenant has no automation with `activo = true`. It SHALL NOT be filtered by connection readiness. A template without business copy SHALL NOT be listed. A template for which the tenant has only paused automations SHALL be listed as available. Templates sharing an `automatizacion` slug SHALL be listed once, and none of them SHALL be listed when any of them has an active automation of the tenant.

#### Scenario: Template with an active automation is not available

- **GIVEN** a tenant with an active automation of the `stock-fisico` template
- **WHEN** the route is called
- **THEN** `disponibles` SHALL NOT contain the `stock-fisico` entry

#### Scenario: Template with only a paused automation is available

- **GIVEN** a tenant whose only automation of the `stock-fisico` template has `activo = false`
- **WHEN** the route is called
- **THEN** `disponibles` SHALL contain the `stock-fisico` entry

#### Scenario: Template without business copy is hidden

- **GIVEN** a global template whose `automatizacion` slug has no business copy entry
- **WHEN** the route is called
- **THEN** `disponibles` SHALL NOT contain it

#### Scenario: Another tenant's automation does not hide a template

- **GIVEN** Tenant B has an active automation of `stock-fisico` and Tenant A has none
- **WHEN** Tenant A calls the route
- **THEN** A's `disponibles` SHALL contain the `stock-fisico` entry

#### Scenario: Twin templates are listed once and hidden together

- **GIVEN** two global templates with the slug `stock-fisico`, and a tenant with an active automation of one of them
- **WHEN** the route is called
- **THEN** `disponibles` SHALL NOT contain the `stock-fisico` entry
- **AND** without that automation it SHALL contain the entry exactly once

### Requirement: Last Execution Is the Latest Finished One (DEC-137)

`ultimaEjecucion` SHALL be `null` when the automation has no execution whose `estado` differs from `en-curso`. Otherwise it SHALL be the object `{ fecha, resultado }` for the execution with the greatest `iniciadaEn` among those whose `estado` is not `en-curso`. `fecha` SHALL be an ISO 8601 UTC string (`finalizadaEn`, or `iniciadaEn` when the former is null). `resultado` SHALL be one neutral business value, `completada` for `ok` and `no-realizada` for every other finished state. Row counts, durations, error categories and codes SHALL NOT be exposed.

#### Scenario: No execution yet

- **GIVEN** an automation with no `Ejecucion` rows
- **WHEN** the route is called
- **THEN** its `ultimaEjecucion` SHALL be `null`

#### Scenario: Only an in-progress execution

- **GIVEN** an automation whose only execution has `estado = 'en-curso'`
- **WHEN** the route is called
- **THEN** its `ultimaEjecucion` SHALL be `null`

#### Scenario: In-progress run is skipped for the latest finished one

- **GIVEN** an automation with a finished `ok` execution at 08:00 and a newer `en-curso` execution at 09:00
- **WHEN** the route is called
- **THEN** its `ultimaEjecucion.fecha` SHALL be the 08:00 execution's instant
- **AND** `resultado` SHALL be `completada`

#### Scenario: Latest per automation, not global

- **GIVEN** two automations of the tenant with different latest finished executions
- **WHEN** the route is called
- **THEN** each item's `ultimaEjecucion` SHALL come from its own automation's executions only

#### Scenario: Failed execution is neutral

- **GIVEN** an automation whose latest finished execution has `estado = 'fallo'`, `error` and `codigoError`
- **WHEN** the route is called
- **THEN** `resultado` SHALL be `no-realizada`
- **AND** the item SHALL contain no error text or code

### Requirement: Next Execution Is Computed on Request From an Injectable Clock (DEC-129, DEC-137)

`proximaEjecucion` SHALL be the ISO 8601 UTC string of `proximaEjecucion(cron, ahora, zonaHoraria)` (`src/automatizaciones.ts`), where `ahora` is read once per request from an injectable clock whose production default is the system time. It SHALL be `null` when the automation is paused (`estado: 'pausada'`). It SHALL NOT be persisted. A stored schedule that is not valid standard cron SHALL yield `null`, never a failed request.

#### Scenario: Next run from a fixed clock

- **GIVEN** a clock fixed at `2026-10-07T10:00:00Z`, zone `UTC` and an active automation with cron `0 8 * * *`
- **WHEN** the route is called
- **THEN** its `proximaEjecucion` SHALL be `2026-10-08T08:00:00.000Z`

#### Scenario: Zone changes the instant

- **GIVEN** the same clock and cron with zone `America/Argentina/Buenos_Aires` (UTC-3)
- **WHEN** the route is called
- **THEN** its `proximaEjecucion` SHALL be `2026-10-07T11:00:00.000Z`

#### Scenario: Paused automation has no next run

- **GIVEN** an automation with `activo = false`
- **WHEN** the route is called
- **THEN** its `proximaEjecucion` SHALL be `null`

#### Scenario: Corrupt stored schedule

- **GIVEN** an active automation whose stored `cron` is not standard five-field cron
- **WHEN** the route is called
- **THEN** the response SHALL still be `200`
- **AND** that item's `proximaEjecucion` SHALL be `null` and `frecuencia` SHALL be omitted

### Requirement: Frequency Text Only for the Three DEC-129 Patterns (DEC-129, DEC-137)

`frecuencia` SHALL be present only when the stored cron has the exact shape `M H * * D` with `M` an integer 0 to 59, `H` an integer 0 to 23 and `D` one of `*`, `1-5`, `1-6`. The text SHALL be `Todos los días a las HH:MM` for `*`, `De lunes a viernes a las HH:MM` for `1-5` and `De lunes a sábado a las HH:MM` for `1-6`, with `HH:MM` zero-padded, 24-hour, in the deployment zone. For any other cron the key SHALL be omitted (not `null`, not a translation of the expression). A cron expression SHALL NOT appear in the response.

#### Scenario: Daily pattern

- **GIVEN** an automation with cron `30 8 * * *`
- **WHEN** the route is called
- **THEN** `frecuencia` SHALL be `Todos los días a las 08:30`

#### Scenario: Weekdays pattern

- **GIVEN** an automation with cron `0 9 * * 1-5`
- **THEN** `frecuencia` SHALL be `De lunes a viernes a las 09:00`

#### Scenario: Monday to Saturday pattern

- **GIVEN** an automation with cron `0 18 * * 1-6`
- **THEN** `frecuencia` SHALL be `De lunes a sábado a las 18:00`

#### Scenario: Any other cron omits the key

- **GIVEN** automations with cron `*/15 * * * *`, `0 8 1 * *`, `0 8 * * 0-6` and `0 8 * * 1`
- **WHEN** the route is called
- **THEN** none of their items SHALL have a `frecuencia` key
- **AND** no response text SHALL contain the cron string

### Requirement: Listing Is Bounded With the truncado Pattern (LIMITE_LISTADO)

`activas` SHALL contain at most `LIMITE_LISTADO` items (`src/listados.ts`), ordered newest first by `creadaEn` then `id`. The route SHALL read `LIMITE_LISTADO + 1` rows to decide `truncado`, which SHALL be `true` only when more than `LIMITE_LISTADO` automations exist. The truncation SHALL NOT change which templates are reported as available.

#### Scenario: Within the limit

- **GIVEN** a tenant with fewer than `LIMITE_LISTADO` automations
- **THEN** `truncado` SHALL be `false` and every automation SHALL be listed

#### Scenario: Over the limit

- **GIVEN** a tenant with `LIMITE_LISTADO + 1` automations
- **THEN** `activas` SHALL contain exactly `LIMITE_LISTADO` items and `truncado` SHALL be `true`

### Requirement: Business Copy Map With Neutral Fallback (DEC-128, DEC-137)

Titles and descriptions SHALL come from a map kept in the panel module, keyed by the template's `automatizacion` slug (the `TEMAS` precedent of `src/correo.ts`), and SHALL be written in business language per the panel glossary (`lenguaje.md`). For an automation whose template slug is not in the map, the item SHALL use a neutral fallback title and description and SHALL NOT throw. The stored template `nombre` (console text) SHALL NOT be used as a fallback.

#### Scenario: Mapped slug

- **GIVEN** an automation of the `stock-fisico` template
- **THEN** its `titulo` and `descripcion` SHALL be the map's entry for `stock-fisico`

#### Scenario: Unmapped slug on an existing automation

- **GIVEN** an automation whose template slug is `reporte-semanal`, absent from the map
- **WHEN** the route is called
- **THEN** the item SHALL appear in `activas` with the neutral fallback `titulo` and `descripcion`
- **AND** the template's `nombre` SHALL NOT appear in the response

### Requirement: Panel Page Shows the Automations Screen in Defined States (P-02, DEC-137)

The authenticated `GET /panel` shell SHALL replace its partial "Mis automatizaciones" section with the P-02 screen, fed only by `GET /api/panel/automatizaciones`. It SHALL render: a loading skeleton while the request is pending; a card per active or paused automation (title, description, status label, frequency when present, last run, next run when present); a section of available automations (title and description); the empty state with the title "Todavía no activaste ninguna automatización" when `activas` is empty; a generic error state when the request fails; and, on `401`, a reload so the server renders the login screen. Dates SHALL be formatted in the browser with `Intl` in `es-AR`, in `zonaHoraria`. A last run of `null` SHALL read "Todavía no hubo una revisión". The page SHALL NOT render an "Activar" action. The only control that changes data is "Ajustar" (CH-23, "Adjust Form (P-04)").
(Previously, in CH-22b: no "Ajustar" either.)

#### Scenario: Loading state

- **GIVEN** an authenticated panel page whose request has not resolved
- **THEN** the screen SHALL show a skeleton of cards and no empty or error state

#### Scenario: Empty state

- **GIVEN** a response with `activas: []`
- **THEN** the screen SHALL show the title "Todavía no activaste ninguna automatización"
- **AND** SHALL NOT show the loading skeleton

#### Scenario: Error state

- **GIVEN** the request fails with a network error or a `5xx`
- **THEN** the screen SHALL show a generic error message in business language with no status code or technical detail

#### Scenario: Session expired

- **GIVEN** the route answers `401`
- **THEN** the page SHALL reload so `GET /panel` serves the login screen

#### Scenario: Activation is not offered

- **GIVEN** an authenticated page with active and available automations
- **THEN** the served HTML and script SHALL NOT contain the label "Activar"

#### Scenario: Cards show the business data

- **GIVEN** an active automation with `frecuencia`, `ultimaEjecucion` and `proximaEjecucion`
- **THEN** its card SHALL show the title, the description, the "Activa" label, the frequency text, the last run date and the next run date formatted with `Intl` es-AR in `zonaHoraria`

### Requirement: No Technical Terms in the Client Surface (Rule 1, DEC-04, DEC-93)

No string shown to the client by this feature SHALL contain a term the panel glossary replaces (`lenguaje.md`): `tenant`, `cron`, `SQL`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout`, `plantilla`, nor identifiers, codes or table names. This covers the copy map, the fallback, the frequency texts, the last-run texts, and the page's static HTML and script string literals. Execution results or rows SHALL NOT be shown (DEC-93).

#### Scenario: Copy and page contain no glossary-forbidden term

- **GIVEN** every copy map value, the fallback, every frequency text and the served authenticated page's visible text and script string literals
- **WHEN** they are scanned case-insensitively for the forbidden terms
- **THEN** none SHALL be found

### Requirement: Failure Banner Visible in Panel (UI)
When `estado === 'con_falla'`, the panel card SHALL show an inline error banner with business language (no technical terms/codes). The banner text is pinned by page tests and uses only glossary-compliant terms.

#### Scenario: Card shows failure banner for con_falla
- **GIVEN** response contains an active automation with `estado = 'con_falla'`
- **WHEN** the panel renders
- **THEN** the card shows a failure banner with title/body in business language (e.g. "No pudimos completar esta automatización esta vez")

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
