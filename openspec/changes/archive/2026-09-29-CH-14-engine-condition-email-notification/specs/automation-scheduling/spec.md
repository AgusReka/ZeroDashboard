# Delta for Automation Scheduling

## MODIFIED Requirements

### Requirement: Automatizacion Binds a Plantilla, a Tenant's Connection, Parameter Values, and a Schedule (DEC-74)

The own database SHALL have an `Automatizacion` table. Every row MUST reference exactly one `Tenant` row and exactly one `Plantilla` row through required foreign keys, MUST reference exactly one `Conexion` row belonging to the same tenant, MUST store a parameter-value map validated against the referenced `Plantilla`'s declared parameters (CH-11 rules), and MUST store a cron schedule expression and an `activo` boolean defaulting to `true`. Every row SHALL also have a nullable `destinatario` column holding a single validated email address (DEC-82), settable only at creation.
(Previously: no `destinatario` column.)

#### Scenario: Creating an automation with valid values

- GIVEN an existing `Plantilla` and a `Conexion` belonging to the active tenant
- WHEN an `Automatizacion` is created naming both, a value for every declared parameter, and a valid cron expression
- THEN the row SHALL persist with `activo: true`

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

### Requirement: Automation Lifecycle Is Create, List, Get, Deactivate — No Edit or Delete (DEC-78, DEC-79)

The system SHALL expose, all scoped to the active tenant: `POST /automatizaciones` (create), `GET /automatizaciones` (list), `GET /automatizaciones/:id` (get), and `POST /automatizaciones/:id/desactivar` (deactivate). It SHALL NOT expose any route that edits or deletes an existing row, including its `destinatario`; changing a recipient requires deactivating the automation and creating another (DEC-82). Deactivating sets `activo: false` and this change provides no route to reverse it.
(Previously: did not mention `destinatario`.)

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

#### Scenario: Recipient cannot be edited

- GIVEN an existing automation
- WHEN a `PUT`, `PATCH`, or `DELETE` is sent to `/automatizaciones/:id`
- THEN no such route SHALL exist (not-found or method-not-allowed response) and `destinatario` SHALL be unchanged

## ADDED Requirements

### Requirement: Run Pipeline Applies the Condition and Notifies After Query Success (X3, N1)

After a run's query completes and while its result rows are in memory, the run SHALL evaluate the notification condition and, when it holds, send the notification, as defined by `email-notification`. The notification step SHALL run once per run, before the `Ejecucion` row is closed, so that one `Ejecucion` row records both the query result and the `notificacion` outcome. The rows SHALL NOT be persisted or retained after the run.

#### Scenario: One run, one row, one send

- GIVEN a due automation whose query returns rows, with a recipient and SMTP configured
- WHEN the scheduler runs it
- THEN exactly one `Ejecucion` row SHALL persist with `notificacion` set and the notifier SHALL have been called exactly once

#### Scenario: Existing automation without recipient keeps running

- GIVEN an automation created before this change, with null `destinatario`
- WHEN it becomes due and its query returns rows
- THEN the run SHALL execute and close `estado='ok'` with `notificacion='sin-destinatario'`
- AND the notifier SHALL NOT be called
