# Automation Scheduling Specification (CH-40 delta)

## Purpose
An automation carries a minimum number of rows below which a successful run does not notify. It is set at creation and in the operator's in-place adjust, never from the panel (DEC-186, DEC-193 1(a)).

## ADDED Requirements

### Requirement: Minimum Rows Are Bounded by the Row Cap (DEC-186, DEC-19)

`minimoFilas` SHALL be an integer with `1 ≤ minimoFilas ≤ maxFilasPorConsulta`, the engine's row cap as configured for the running process (`MAX_FILAS_CONSULTA`), the same cap the scheduler reads its page with. A value out of that range or not an integer SHALL be refused with `400` and `campos` containing `/minimoFilas`, and nothing SHALL be written. The same rule SHALL apply to `POST /automatizaciones` and to the operator's `PUT /automatizaciones/:id/ajustes`. A numeric string SHALL be accepted as its integer, as for every other integer body field. The panel's adjust route SHALL NOT accept `minimoFilas`.

#### Scenario: Creating with a minimum

- GIVEN valid creation values and `minimoFilas` 5
- WHEN the automation is created
- THEN the row SHALL persist with `minimoFilas` 5
- AND the create and get responses SHALL include it

#### Scenario: Creating without a minimum

- GIVEN valid creation values and no `minimoFilas`
- WHEN the automation is created
- THEN the row SHALL persist with `minimoFilas` 1

#### Scenario: Out-of-range minimum refused

- GIVEN a row cap of 200
- WHEN an automation is created with `minimoFilas` 0, 201, or 2.5
- THEN each response SHALL be `400` naming `/minimoFilas` and no row SHALL persist

#### Scenario: The cap is the configured one

- GIVEN `MAX_FILAS_CONSULTA` set to 50
- WHEN an automation is created with `minimoFilas` 50, then another with 51
- THEN the first SHALL be created and the second SHALL be refused naming `/minimoFilas`

#### Scenario: Adjusting the minimum in place

- GIVEN an active automation of the active tenant with `minimoFilas` 1 and recorded runs
- WHEN `PUT /automatizaciones/:id/ajustes` is sent with `{ "minimoFilas": 10 }`
- THEN the same row SHALL have `minimoFilas` 10, its other columns unchanged, and its runs kept

#### Scenario: Invalid minimum in the adjust

- GIVEN an active automation
- WHEN the adjust is sent with `{ "minimoFilas": 0 }`
- THEN the response SHALL be `400` naming `/minimoFilas` and the row SHALL be unchanged

#### Scenario: Adjust stays tenant-scoped

- GIVEN an automation of tenant B
- WHEN tenant A sends the adjust with `{ "minimoFilas": 10 }` for its id
- THEN the response SHALL be `404` and tenant B's row SHALL be unchanged

## MODIFIED Requirements

### Requirement: Automatizacion Binds a Plantilla, a Tenant's Connection, Parameter Values, and a Schedule (DEC-74)

The own database SHALL have an `Automatizacion` table. Every row MUST reference exactly one `Tenant` row and exactly one `Plantilla` row through required foreign keys, MUST reference exactly one `Conexion` row belonging to the same tenant, MUST store a parameter-value map validated against the referenced `Plantilla`'s declared parameters (CH-11 rules), and MUST store a cron schedule expression and an `activo` boolean defaulting to `true`. Every row SHALL also have a nullable `destinatario` column holding a single validated email address (DEC-82), and a non-null integer `minimoFilas` column defaulting to 1 (DEC-186). Rows created before `minimoFilas` existed SHALL read 1.
(Previously: no `minimoFilas` column.)

#### Scenario: Creating an automation with valid values

- GIVEN an existing `Plantilla` and a `Conexion` belonging to the active tenant
- WHEN an `Automatizacion` is created naming both, a value for every declared parameter, and a valid cron expression
- THEN the row SHALL persist with `activo: true` and `minimoFilas: 1`

#### Scenario: Parameter values validated like CH-11

- GIVEN a `Plantilla` declaring a required parameter
- WHEN an `Automatizacion` is created with no value for it
- THEN the response SHALL be `400` naming the missing parameter

#### Scenario: Connection must belong to the same tenant

- GIVEN a `Conexion` belonging to a different tenant
- WHEN an `Automatizacion` is created naming it
- THEN the response SHALL be `404` and no row SHALL persist

#### Scenario: Creating with a valid recipient

- GIVEN valid creation values and `destinatario` `"ops@example.com"`
- WHEN the automation is created
- THEN the row SHALL persist with that `destinatario`
- AND the create and get responses SHALL include it

#### Scenario: Creating without a recipient

- GIVEN valid creation values and no `destinatario`
- WHEN the automation is created
- THEN the row SHALL persist with `destinatario` null

#### Scenario: Invalid recipient rejected

- GIVEN valid creation values and an invalid `destinatario`
- WHEN the automation is created
- THEN the response SHALL be `400` naming `destinatario` and no row SHALL persist

#### Scenario: Existing rows read the default minimum

- GIVEN an automation created before the `minimoFilas` migration
- WHEN it is read after the migration
- THEN its `minimoFilas` SHALL be 1

### Requirement: Run Pipeline Applies the Condition and Notifies After Query Success (X3, N1)

After a run's query completes and while its result rows are in memory, the run SHALL evaluate the notification condition, including the automation's `minimoFilas` as read for that run, and, when it holds, send the notification, as defined by `email-notification`. The notification step SHALL run once per run, before the `Ejecucion` row is closed, so that one `Ejecucion` row records both the query result and the `notificacion` outcome. The rows SHALL NOT be persisted or retained after the run.
(Previously: the condition had no minimum.)

#### Scenario: One run, one row, one send

- GIVEN a due automation whose query returns rows reaching its minimum, with a recipient and SMTP configured
- WHEN the scheduler runs it
- THEN exactly one `Ejecucion` row SHALL persist with `notificacion` set and the notifier SHALL have been called exactly once

#### Scenario: A run below the minimum closes without sending

- GIVEN a due automation with `minimoFilas` 5 whose query returns 2 rows, with a recipient and SMTP configured
- WHEN the scheduler runs it
- THEN exactly one `Ejecucion` row SHALL persist with `estado='ok'`, `filas=2`, `notificacion='omitida-bajo-minimo'`
- AND the notifier SHALL NOT be called

#### Scenario: Existing automation without recipient keeps running

- GIVEN an automation created before CH-14, with null `destinatario`
- WHEN it becomes due and its query returns rows
- THEN the run SHALL execute and close `estado='ok'` with `notificacion='sin-destinatario'`
- AND the notifier SHALL NOT be called
