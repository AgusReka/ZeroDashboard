# Automation Scheduling Specification

## Purpose

Turning a `Plantilla` (CH-12) into something that runs unattended, per tenant, on a schedule (X1): a minimal tenant-scoped `Automatizacion` binding a plantilla, a tenant's own connection, parameter values, and a cron schedule (DEC-74); an in-process scheduler (DEC-75) that fires due, active automations for active tenants only, reusing the existing read-only composition and execution pipeline. Instantiation UX, editing, overlaps, retries, and cross-tenant failure isolation are out of scope (CH-17, CH-18, CH-21).

## Requirements

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

### Requirement: Cron Schedule Resolved by a Next-Fire-Only Library (DEC-76)

The cron expression SHALL be validated at creation time and its next fire time SHALL be computed using a library limited to next-fire-time calculation, never used to execute tasks itself.

#### Scenario: Invalid cron expression rejected

- GIVEN a syntactically invalid cron expression
- WHEN an `Automatizacion` is created with it
- THEN the response SHALL be `400` naming the schedule field

### Requirement: Schedule Interpreted in the Global Configured Timezone (DEC-77)

Every cron expression SHALL be interpreted in the single timezone configured for the whole deployment (`project-environment`); no per-tenant or per-automation timezone SHALL be accepted.

#### Scenario: Next fire time follows the configured timezone

- GIVEN the deployment's configured timezone and an automation's cron expression
- WHEN its next fire time is computed
- THEN it SHALL be resolved in that configured timezone, not in UTC or the host's local time

### Requirement: In-Process Scheduler Started With the Application (DEC-75)

The application process SHALL start exactly one scheduler when it starts, with no separate process or service. The scheduler SHALL tick on a fixed interval and, on each tick, evaluate every active `Tenant`'s active, due `Automatizacion` rows.

#### Scenario: Scheduler starts with the application

- GIVEN the application process is started
- WHEN startup completes
- THEN the scheduler SHALL be running with no additional manual step

### Requirement: Only Active Tenants' Active, Due Automations Run (DEC-14, DEC-79)

On each tick, the scheduler SHALL skip every `Tenant` row with `activo: false` entirely, and SHALL skip every `Automatizacion` row with `activo: false`. Only a due, active automation belonging to an active tenant SHALL run.

#### Scenario: Deactivated tenant's automations never run

- GIVEN a `Tenant` with `activo: false` and a due active `Automatizacion`
- WHEN the scheduler ticks
- THEN that automation SHALL NOT run

#### Scenario: Deactivated automation never runs

- GIVEN an active tenant with a due `Automatizacion` whose `activo` is `false`
- WHEN the scheduler ticks
- THEN that automation SHALL NOT run

### Requirement: Run Pipeline Reuses the Existing Read-Only Composition and Execution Chain (rule 5, DEC-71)

A run SHALL compose the automation's `Plantilla` exactly as the CH-12 test endpoint does (`evaluarVistas`, `componerSentencia`), requiring a passing saved validation for every declared entity on the automation's `Conexion` (DEC-71); it SHALL then execute the composed statement through the existing read-only pipeline (`ejecutarConsulta`). No new execution surface SHALL be introduced.

#### Scenario: Missing or failing view validation blocks the run

- GIVEN an `Automatizacion` whose `Plantilla` declares an entity with no passing saved validation on its `Conexion`
- WHEN the scheduler runs it
- THEN the run SHALL NOT execute any query against the tenant's connection
- AND the outcome SHALL be recorded (per `execution-log`) naming the ungated entity

### Requirement: A Run's Failure Does Not Stop the Tick for Other Automations (Not CH-18 Isolation)

The scheduler SHALL catch any error raised by one automation's run and continue evaluating the remaining due automations in the same tick. This is a per-run catch only; it is not the cross-tenant failure isolation guarantee of CH-18.

#### Scenario: One failing run does not block a sibling run

- GIVEN two due active automations in the same tick, one of which will fail
- WHEN the scheduler ticks
- THEN the failing automation SHALL be recorded as failed
- AND the other automation SHALL still run to completion
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
### Requirement: Overlap Check Before Creating a Run (X4, DEC-96)

Before creating an `Ejecucion` for an automation, the scheduler SHALL look up, through the tenant-scoped client, an `en-curso` row of the same automation. WHEN one exists, the scheduler SHALL NOT run the automation and SHALL write one `omitida`/`solapamiento` row (per `execution-log`) for that tick. It MUST NOT compose, execute, or notify for the skipped run.

#### Scenario: A stuck automation is skipped and recorded

- GIVEN a due automation with an `en-curso` row
- WHEN the scheduler ticks
- THEN no query SHALL execute against the tenant's connection and the notifier SHALL NOT be called
- AND one `omitida`/`solapamiento` row SHALL persist

#### Scenario: Overlap is per automation

- GIVEN two due automations of one tenant, only one of them with an `en-curso` row
- WHEN the scheduler ticks
- THEN the stuck one SHALL be skipped and recorded
- AND the other SHALL run normally

#### Scenario: Another tenant's en-curso row does not block

- GIVEN tenant B has an `en-curso` row and tenant A has a due automation with none
- WHEN the scheduler ticks
- THEN A's automation SHALL run

#### Scenario: Overlap lookup failure does not stop the tick

- GIVEN the overlap lookup throws for one automation
- WHEN the scheduler ticks
- THEN the error SHALL be caught per run and the remaining due automations SHALL still be evaluated

### Requirement: Boot Sweep Runs Before the First Tick (X7, DEC-99)

On start, and before the first tick is scheduled, the scheduler SHALL close every `en-curso` `Ejecucion` row of every tenant as defined by `execution-log` (`fallo`/`interrumpida`). The sweep SHALL be fail-open: WHEN it fails, the error SHALL be logged and the service SHALL start and schedule ticks anyway. Interrupted runs MUST NOT be re-executed. There is no per-tick reaper.

#### Scenario: Sweep completes before ticking

- GIVEN `en-curso` rows left by a previous process, including one of a due automation
- WHEN the scheduler starts
- THEN the sweep SHALL finish before the first tick evaluates anything
- AND no `en-curso` row SHALL remain

#### Scenario: Sweep failure does not block startup

- GIVEN the sweep throws
- WHEN the scheduler starts
- THEN the error SHALL be logged and ticks SHALL still be scheduled

#### Scenario: Interrupted runs are not re-executed

- GIVEN a swept row of a due automation
- WHEN the sweep completes
- THEN no query SHALL execute because of the swept row, and no new run SHALL be created by the sweep

#### Scenario: A row stuck in a live process is not reaped

- GIVEN a row that becomes `en-curso` after the boot sweep finished
- WHEN later ticks run
- THEN the row SHALL stay `en-curso` and the automation SHALL be skipped as `omitida` until the next boot

### Requirement: Signals Close the Application Gracefully (DEC-100)

The process SHALL handle `SIGTERM` and `SIGINT` by closing the application, which awaits the scheduler's `detener()`. Signal registration MUST be testable without terminating the test process.

#### Scenario: A signal triggers an orderly close

- GIVEN the signal handlers are registered for an application
- WHEN `SIGTERM` or `SIGINT` is delivered
- THEN `app.close()` SHALL be invoked and the scheduler SHALL be stopped via `detener()`

### Requirement: Missed Fires Are Not Recovered — Documented Artifact Limit (DEC-95)

The scheduler SHALL NOT catch up fires missed during downtime or a long run, and SHALL NOT record marks for coalesced fires. This SHALL be documented as a limit of the artifact, and code comments MUST NOT attribute catch-up to CH-17.

#### Scenario: Downtime leaves no catch-up

- GIVEN the service was stopped across a due fire time
- WHEN it restarts and ticks
- THEN the missed fire SHALL NOT run and no row SHALL record it

### Requirement: Single-Instance Assumption (DEC-75, DEC-99)

The sweep and overlap behavior assume exactly one running instance. Multi-instance safety is out of scope and MUST be documented as such.

#### Scenario: Limit is documented

- GIVEN the change documentation (bitacora)
- WHEN it is read
- THEN it SHALL state the single-instance assumption and that a second instance's sweep would close live runs
