# Automation Scheduling Specification (CH-41 delta)

## Purpose
An automation holds a list of up to 5 recipient addresses instead of one, set at creation and in the operator's in-place adjust (N6, DEC-187, DEC-194). A row that had one address keeps it as a list of one.

## MODIFIED Requirements

### Requirement: Automatizacion Binds a Plantilla, a Tenant's Connection, Parameter Values, and a Schedule (DEC-74)

The own database SHALL have an `Automatizacion` table. Every row MUST reference exactly one `Tenant` row and exactly one `Plantilla` row through required foreign keys, MUST reference exactly one `Conexion` row belonging to the same tenant, MUST store a parameter-value map validated against the referenced `Plantilla`'s declared parameters (CH-11 rules), and MUST store a cron schedule expression and an `activo` boolean defaulting to `true`. Every row SHALL also have a non-null `destinatarios` list of text, empty by default, holding at most 5 validated email addresses as defined by `email-notification` (DEC-187), and a non-null integer `minimoFilas` column defaulting to 1 (DEC-186). Rows created before `minimoFilas` existed SHALL read 1. A row whose single `destinatario` was set before `destinatarios` existed SHALL read a list holding exactly that address; a row whose `destinatario` was null SHALL read an empty list.
(Previously: a nullable `destinatario` column held one address.)

#### Scenario: Creating an automation with valid values

- GIVEN an existing `Plantilla` and a `Conexion` belonging to the active tenant
- WHEN an `Automatizacion` is created naming both, a value for every declared parameter, and a valid cron expression
- THEN the row SHALL persist with `activo: true`, `minimoFilas: 1` and `destinatarios: []`

#### Scenario: Parameter values validated like CH-11

- GIVEN a `Plantilla` declaring a required parameter
- WHEN an `Automatizacion` is created with no value for it
- THEN the response SHALL be `400` naming the missing parameter

#### Scenario: Connection must belong to the same tenant

- GIVEN a `Conexion` belonging to a different tenant
- WHEN an `Automatizacion` is created naming it
- THEN the response SHALL be `404` and no row SHALL persist

#### Scenario: Creating with several recipients

- GIVEN valid creation values and `destinatarios` `[" ops@example.com", "duena@example.com "]` (trimmed by the server)
- WHEN the automation is created
- THEN the row SHALL persist with `destinatarios` `["ops@example.com", "duena@example.com"]` in that order
- AND the create and get responses SHALL include it

#### Scenario: Creating without recipients

- GIVEN valid creation values and no `destinatarios`
- WHEN the automation is created
- THEN the row SHALL persist with `destinatarios` `[]`

#### Scenario: Invalid recipient rejected

- GIVEN valid creation values and `destinatarios` whose second element is not a valid address
- WHEN the automation is created
- THEN the response SHALL be `400` naming `/destinatarios/1` and no row SHALL persist

#### Scenario: Existing rows read the default minimum

- GIVEN an automation created before the `minimoFilas` migration
- WHEN it is read after the migration
- THEN its `minimoFilas` SHALL be 1

#### Scenario: Existing recipients become a list

- GIVEN one automation with `destinatario` `"a@empresa.com"` and one with `destinatario` null, both created before the `destinatarios` migration
- WHEN they are read after the migration
- THEN the first SHALL have `destinatarios` `["a@empresa.com"]` and the second `[]`

### Requirement: Automation Lifecycle Is Create, List, Get, Deactivate — No Edit or Delete (DEC-78, DEC-79)

The system SHALL expose, all scoped to the active tenant: `POST /automatizaciones` (create), `GET /automatizaciones` (list), `GET /automatizaciones/:id` (get), `PUT /automatizaciones/:id/ajustes` (adjust, DEC-174) and `POST /automatizaciones/:id/desactivar` (deactivate). The adjust route SHALL update only `valores`, `cron`, `destinatarios` and `minimoFilas` of the same row, and SHALL NOT change `plantillaId`, `conexionId`, `activo` or `tenantId`. It SHALL NOT expose any route that deletes a row or reactivates it. Deactivating sets `activo: false` and no route sets it back to `true`.

The adjust body SHALL be a non-empty subset of `valores`, `cron`, `destinatarios` and `minimoFilas`; any other key, including `tenantId`, `plantillaId`, `conexionId`, `activo` or the former `destinatario`, SHALL be refused with `400 solicitud-invalida`, never silently dropped. Each sent field SHALL be checked with the same rules as the create route: `cron` with `cronValido` in the configured zone; `destinatarios` with the list rule of `email-notification`, where `[]` empties it; `minimoFilas` as defined by "Minimum Rows Are Bounded by the Row Cap"; `valores` with `prepararSentencia` against the stored row's template. A sent `valores` or `destinatarios` SHALL replace the stored value as a whole. Every offending field SHALL be named in `campos`. An unknown id, or another tenant's, SHALL answer `404 automatizacion-no-encontrada`; a deactivated automation SHALL answer `409 automatizacion-desactivada`; in both cases nothing is written. A `200` SHALL carry the updated row (`AutomatizacionCompleta`), `proximaEjecucion` computed from the new schedule and `zonaHoraria`. The scheduler SHALL apply the change from its next tick, with no reprogramming.
(Previously: the adjust took one `destinatario`, with `null` to clear it.)

#### Scenario: Deactivating an automation

- GIVEN an active `Automatizacion` belonging to the active tenant
- WHEN `POST /automatizaciones/:id/desactivar` is called
- THEN its `activo` SHALL become `false`
- AND no route SHALL exist to set it back to `true`

#### Scenario: Deactivated automation is excluded from future runs but stays listed

- GIVEN a deactivated `Automatizacion` with prior runs
- WHEN `GET /automatizaciones` is called
- THEN the row SHALL still appear
- AND its past `Ejecucion` rows SHALL remain listable

#### Scenario: Adjusting keeps the id and the history

- GIVEN an active automation with prior runs, cron `0 8 * * *` and `destinatarios` `["a@empresa.com"]`
- WHEN `PUT /automatizaciones/:id/ajustes` is called with `{ "cron": "30 6 * * 1-5", "destinatarios": ["b@empresa.com", "c@empresa.com"] }`
- THEN the response SHALL be `200` with the same `id`, the new `cron` and `destinatarios`, and a `proximaEjecucion` matching the new schedule
- AND its prior `Ejecucion` rows SHALL remain listed under the same id

#### Scenario: Values are checked against the stored template and replaced whole

- GIVEN an active automation whose template declares `umbral` as `numero`
- WHEN the adjust is called with `{ "valores": { "umbral": "diez" } }`
- THEN the response SHALL be `400 solicitud-invalida` naming `umbral`, and the row SHALL be unchanged
- WHEN it is called with `{ "valores": { "umbral": 10 } }`
- THEN the stored `valores` SHALL be exactly `{ "umbral": 10 }`

#### Scenario: Emptying the recipients

- GIVEN an active automation with recipients
- WHEN the adjust is called with `{ "destinatarios": [] }`
- THEN its `destinatarios` SHALL become `[]` and its next runs SHALL send no email

#### Scenario: Template, connection and state cannot be adjusted

- GIVEN an active automation
- WHEN the adjust body carries `plantillaId`, `conexionId`, `activo`, `tenantId` or `destinatario`
- THEN the response SHALL be `400 solicitud-invalida` and the row SHALL be unchanged

#### Scenario: Empty body, invalid cron and invalid recipients

- WHEN the adjust body is `{}`
- THEN the response SHALL be `400 solicitud-invalida`
- WHEN it is `{ "cron": "cada día" }` or `{ "destinatarios": ["a@b.com", "c@d.com, e@f.com"] }`
- THEN the response SHALL be `400` naming `/cron` or `/destinatarios/1`, and nothing SHALL be written

#### Scenario: A deactivated automation cannot be adjusted

- GIVEN a deactivated automation
- WHEN the adjust is called with a valid body
- THEN the response SHALL be `409 automatizacion-desactivada` and the row SHALL be unchanged

#### Scenario: Another tenant's automation is not found

- GIVEN tenant A is active and an automation belongs to tenant B
- WHEN the adjust is called with B's automation id
- THEN the response SHALL be `404 automatizacion-no-encontrada`, the same as for an unknown id, and B's row SHALL be unchanged

#### Scenario: Delete and reactivation do not exist

- GIVEN an existing automation
- WHEN a `DELETE` is sent to `/automatizaciones/:id`
- THEN no such route SHALL exist (not-found or method-not-allowed response)

### Requirement: Run Pipeline Applies the Condition and Notifies After Query Success (X3, N1)

After a run's query completes and while its result rows are in memory, the run SHALL evaluate the notification condition, including the automation's `minimoFilas` and `destinatarios` as read for that run, and, when it holds, send the notification, as defined by `email-notification`. The notification step SHALL run once per run, before the `Ejecucion` row is closed, so that one `Ejecucion` row records both the query result and the `notificacion` outcome. The rows SHALL NOT be persisted or retained after the run.
(Previously: the run read one `destinatario`.)

#### Scenario: One run, one row, one send

- GIVEN a due automation whose query returns rows reaching its minimum, with two recipients and SMTP configured
- WHEN the scheduler runs it
- THEN exactly one `Ejecucion` row SHALL persist with `notificacion` set and the notifier SHALL have been called exactly once, with both addresses

#### Scenario: A run below the minimum closes without sending

- GIVEN a due automation with `minimoFilas` 5 whose query returns 2 rows, with a recipient and SMTP configured
- WHEN the scheduler runs it
- THEN exactly one `Ejecucion` row SHALL persist with `estado='ok'`, `filas=2`, `notificacion='omitida-bajo-minimo'`
- AND the notifier SHALL NOT be called

#### Scenario: Automation without recipients keeps running

- GIVEN an automation with `destinatarios` `[]`
- WHEN it becomes due and its query returns rows
- THEN the run SHALL execute and close `estado='ok'` with `notificacion='sin-destinatario'`
- AND the notifier SHALL NOT be called
