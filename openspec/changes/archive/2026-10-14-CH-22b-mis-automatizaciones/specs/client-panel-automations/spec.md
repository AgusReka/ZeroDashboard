# Client Panel Automations Specification

## Purpose

Letting the client (P2, business administrator) see in the panel which automations the business has and which ones it could have, with status, last run and next run, in business language and without any SQL or technical term. Fulfils user story **P1h** and strictly enforces **Rule 1** (no SQL, no technical terms in P2) and **Rule 2** (tenant derived exclusively from the session). The contract is fixed by DEC-137; the tenant derivation by DEC-135; the surface by DEC-04 and DEC-136; the template copy by DEC-128; the schedule patterns by DEC-129.

## ADDED Requirements

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

The response SHALL be built by an explicit allow-list projection of named output keys, never by passing a stored row through. The serialized response SHALL NOT contain, at any depth, the keys `tenantId`, `conexionId`, `valores`, `codigoError`, `error` or `sql`. The route SHALL NOT read or reproduce the by-id template route (`GET /plantillas/:id`) nor any console projection (`AutomatizacionResumen`, `EjecucionListada`, `PlantillaResumen`). The template's console `nombre` SHALL NOT be returned.

#### Scenario: Forbidden keys are absent

- **GIVEN** a tenant with an automation that has `valores`, a `conexionId`, a failed execution with `error` and `codigoError`, and a template with `sql`
- **WHEN** the route is called
- **THEN** the parsed body, walked recursively, SHALL contain none of the keys `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`
- **AND** the raw body text SHALL NOT contain the template's SQL text or the stored error code

#### Scenario: Only allow-listed keys per item

- **GIVEN** any non-empty response
- **WHEN** the keys of each `activas` item and each `disponibles` item are listed
- **THEN** `activas` items SHALL use only `titulo`, `descripcion`, `estado`, `frecuencia`, `ultimaEjecucion`, `proximaEjecucion`
- **AND** `disponibles` items SHALL use only `titulo` and `descripcion`

### Requirement: Business Status Is Active or Paused (DEC-137)

Each `activas` item SHALL carry `estado` equal to `activa` when the stored `activo` is `true` and `pausada` when it is `false`. No other value SHALL be produced; a derived failure status ("con falla") is out of scope (CH-22c). Paused automations SHALL be listed in `activas`.

#### Scenario: Active automation

- **GIVEN** an automation with `activo = true`
- **WHEN** the route is called
- **THEN** its item SHALL have `estado: 'activa'`

#### Scenario: Paused automation is listed

- **GIVEN** an automation with `activo = false`
- **WHEN** the route is called
- **THEN** its item SHALL appear in `activas` with `estado: 'pausada'`

#### Scenario: A failed last execution does not change the status

- **GIVEN** an active automation whose latest finished execution has `estado = 'fallo'`
- **WHEN** the route is called
- **THEN** its `estado` SHALL still be `activa`

### Requirement: Available Automations Rule (DEC-137)

`disponibles` SHALL contain every global template that has a business copy entry (DEC-128) and for which the session's tenant has no automation with `activo = true`. It SHALL NOT be filtered by connection readiness. A template without business copy SHALL NOT be listed. A template for which the tenant has only paused automations SHALL be listed as available.

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

The authenticated `GET /panel` shell SHALL replace its partial "Mis automatizaciones" section with the P-02 screen, fed only by `GET /api/panel/automatizaciones`. It SHALL render: a loading skeleton while the request is pending; a card per active or paused automation (title, description, status label, frequency when present, last run, next run when present); a section of available automations (title and description); the empty state with the title "Todavía no activaste ninguna automatización" when `activas` is empty; a generic error state when the request fails; and, on `401`, a reload so the server renders the login screen. Dates SHALL be formatted in the browser with `Intl` in `es-AR`, in `zonaHoraria`. A last run of `null` SHALL read "Todavía no hubo una revisión". The page SHALL NOT render "Ajustar" or "Activar" actions nor any control that changes data.

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

#### Scenario: No actions offered

- **GIVEN** an authenticated page with active and available automations
- **THEN** the served HTML and script SHALL NOT contain the labels "Ajustar" or "Activar"

#### Scenario: Cards show the business data

- **GIVEN** an active automation with `frecuencia`, `ultimaEjecucion` and `proximaEjecucion`
- **THEN** its card SHALL show the title, the description, the "Activa" label, the frequency text, the last run date and the next run date formatted with `Intl` es-AR in `zonaHoraria`

### Requirement: No Technical Terms in the Client Surface (Rule 1, DEC-04, DEC-93)

No string shown to the client by this feature SHALL contain a term the panel glossary replaces (`lenguaje.md`): `tenant`, `cron`, `SQL`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout`, `plantilla`, nor identifiers, codes or table names. This covers the copy map, the fallback, the frequency texts, the last-run texts, and the page's static HTML and script string literals. Execution results or rows SHALL NOT be shown (DEC-93).

#### Scenario: Copy and page contain no glossary-forbidden term

- **GIVEN** every copy map value, the fallback, every frequency text and the served authenticated page's visible text and script string literals
- **WHEN** they are scanned case-insensitively for the forbidden terms
- **THEN** none SHALL be found
