# Automation Scheduling Specification

## Purpose

Turning a `Plantilla` (CH-12) into something that runs unattended, per tenant, on a schedule (X1): a minimal tenant-scoped `Automatizacion` binding a plantilla, a tenant's own connection, parameter values, and a cron schedule (DEC-74); an in-process scheduler (DEC-75) that fires due, active automations for active tenants only, reusing the existing read-only composition and execution pipeline. Instantiation UX and editing are out of scope (CH-21). Retries (CH-17b), overlap handling (CH-17a), and per-tenant error isolation within a serial tick (CH-18) are covered. Per-tenant lanes, concurrency, and circuit breakers are documented artifact limits (rule 6, DEC-110).

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

### Requirement: A Failure Does Not Stop the Tick for Other Automations or Tenants (X8, DEC-109)

The scheduler SHALL catch any error raised by one automation's run and continue evaluating the remaining due automations in the same tick. It SHALL also catch any error raised while processing one tenant (including one thrown outside a run) and continue with the remaining tenants in the same tick. A tenant-level failure SHALL be written to the log using closed fields only (the tenant identifier from the own-database `Tenant` row and a classified error name) and MUST NOT include raw error text, stack trace, connection data, credentials, SMTP settings, or a recipient address. A tenant-level failure writes no `Ejecucion` row, and the failed tenant's window for that tick is not recovered (DEC-95).
(Previously: per-run catch only, explicitly not the cross-tenant isolation of CH-18.)

#### Scenario: One failing run does not block a sibling run

- GIVEN two due active automations in the same tick, one of which will fail
- WHEN the scheduler ticks
- THEN the failing automation SHALL be recorded as failed
- AND the other automation SHALL still run to completion

#### Scenario: A tenant-level throw does not stop later tenants

- GIVEN tenants A, B, and C in order, each with a due automation, and processing of B throws outside any run
- WHEN the scheduler ticks
- THEN A's and C's automations SHALL still run to completion
- AND the tick SHALL complete and the next tick SHALL be scheduled

#### Scenario: Tenant failure log carries closed fields only

- GIVEN a tenant-level failure whose error message contains a connection string and a recipient address
- WHEN every log line of the tick is inspected
- THEN none SHALL contain that text, a stack trace, credentials, or the recipient
- AND the failed tenant's identifier SHALL appear

#### Scenario: The failed tenant's window is not recovered

- GIVEN tenant B failed in tick N and recovers before tick N+1
- WHEN tick N+1 runs
- THEN fires of B that fell inside tick N's window SHALL NOT run and no row SHALL record them

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
### Requirement: Retry Applies Only to Transient Connection Failures (X5, DEC-97)

A run SHALL be retried only WHEN an attempt fails with `fase='conexion'` and category `host-inalcanzable`, `dns-no-resuelve`, or `tiempo-agotado`. Every other failure MUST end the run after the attempt that produced it: invalid credentials, nonexistent database, permissions, preparation, syntax, data, `no-es-lectura`, query-phase `tiempo-agotado`, `error-desconocido`, `error-interno`, and any `fase='notificacion'` failure. The notification step MUST NOT be retried and `email-notification` is unchanged (exactly one send attempt).

#### Scenario: Transient connection failure is retried

- GIVEN a retry policy of 3 attempts and a connection failing with `host-inalcanzable`, `dns-no-resuelve`, or `tiempo-agotado` (connection phase)
- WHEN the run executes
- THEN a further attempt SHALL be made after the pause

#### Scenario: Non-retryable failures make exactly one attempt

- GIVEN a retry policy of 3 attempts and a failure in any non-retryable category above
- WHEN the run executes
- THEN exactly one connection attempt SHALL be made and no pause SHALL be scheduled

#### Scenario: Query-phase timeout is not retried

- GIVEN a connection that succeeds and a query failing with `tiempo-agotado` in the execution phase
- WHEN the run executes
- THEN the query SHALL run once and the run SHALL close `fallo`

#### Scenario: Notification failure is not retried

- GIVEN a run whose query succeeds and whose send fails
- WHEN the run executes
- THEN the notifier SHALL be called exactly once and no connection attempt SHALL be repeated

### Requirement: Bounded In-Run Retry Loop With Fixed Pause (X5, DEC-98)

The retry SHALL happen inside the single run: one `Ejecucion` row is created before the first attempt and closed once after the last. Attempts SHALL be capped by the injected policy's total attempts, separated by the policy's fixed pause, scheduled only through the injected `Reloj`. The default policy SHALL be "no retry" (one attempt). WHEN the cap is exhausted, the run SHALL close `estado='fallo'` with `fase='conexion'` and the category of the last attempt.

#### Scenario: Transient failure then success

- GIVEN a policy of 3 attempts and a connection failing once with `host-inalcanzable`, then succeeding
- WHEN the run executes and the fake `Reloj` fires the pause
- THEN exactly one `Ejecucion` row SHALL persist with `estado='ok'` and `intentos=2`

#### Scenario: Cap exhausted

- GIVEN a policy of 3 attempts and a connection failing every attempt, the last with `tiempo-agotado`
- WHEN the run executes with the pause fired twice
- THEN one row SHALL persist with `estado='fallo'`, `error='tiempo-agotado'`, `intentos=3`
- AND no fourth attempt SHALL be made

#### Scenario: Pause is fixed and clock-driven

- GIVEN a policy with a 5000 ms pause and a failed first attempt
- WHEN the first attempt fails
- THEN exactly one timer of 5000 ms SHALL be requested from the fake `Reloj` and no second attempt SHALL start before it fires

#### Scenario: Default policy performs no retry

- GIVEN a scheduler built without a retry policy and a connection failing with `host-inalcanzable`
- WHEN the run executes
- THEN one attempt SHALL be made, no timer SHALL be requested, and the row SHALL be `fallo` with `intentos=1`

### Requirement: Overlap Guard Covers a Run Mid-Retry (X4, X5)

The row SHALL stay `en-curso` across attempts and pauses, so the overlap check (DEC-96) MUST treat a run in pause or retry as running.

#### Scenario: Tick during a pause is skipped

- GIVEN a run of an automation waiting in a retry pause
- WHEN a later tick finds that automation due
- THEN no connection attempt SHALL start and one `omitida`/`solapamiento` row SHALL persist

### Requirement: Stopping the Scheduler Cancels a Pending Retry Pause (DEC-104)

`detener()` SHALL cancel any pending retry pause, make no further attempt, and close the row `fallo` with the last attempt's category and the `intentos` reached, so shutdown does not wait for remaining retries.

#### Scenario: Stop during a pause

- GIVEN a run waiting in a pause after its second failed attempt (category `tiempo-agotado`)
- WHEN `detener()` is called
- THEN the pending timer SHALL be cancelled and `detener()` SHALL resolve without further attempts
- AND the row SHALL be `fallo`, `error='tiempo-agotado'`, `intentos=2`, not `en-curso`

#### Scenario: Stop with no run in a pause

- GIVEN no run is in a pause
- WHEN `detener()` is called
- THEN behavior SHALL be unchanged from CH-17a
### Requirement: The Tick Stays Serial (DEC-110)

The scheduler SHALL process tenants one at a time within a tick, and the next tick SHALL NOT start before the previous tick finishes. This change MUST NOT add per-tenant lanes, concurrency limits, independent loops, or a circuit breaker; a dead connection continues to delay later tenants up to the bound of DEC-98 (documented artifact limit, rule 6).

#### Scenario: Tenants never run concurrently

- GIVEN two tenants with due automations, the first blocked on a deferred query
- WHEN the scheduler ticks
- THEN the second tenant's automation SHALL NOT start until the first completes

### Requirement: A Dead Agent Connection Must Not Terminate the Process (DEC-111, conditional)

This requirement applies ONLY IF an automated test (a socket-destroying forwarder) proves that a connection dying after login terminates the process. WHEN proven, the agent connection SHALL handle connection-level errors so the process keeps running and the run fails with its existing classified category. WHEN the test refutes the crash, nothing SHALL be added and this requirement is void.

#### Scenario: Connection dies after login (only if the crash is proven)

- GIVEN an established agent connection whose socket is destroyed mid-session
- WHEN the error is emitted
- THEN the process SHALL stay alive and the run SHALL close `fallo` with a classified category

### Requirement: Create Response Reports the First Scheduled Run (DEC-129)

The `POST /automatizaciones` 201 body SHALL include, in addition to its existing fields, `proximaEjecucion` and `zonaHoraria`. `proximaEjecucion` SHALL be an ISO 8601 instant equal to the first fire of the automation's cron strictly after `creadaEn`, resolved in the deployment's configured zone (DEC-77). `zonaHoraria` SHALL be that configured zone. The computation MUST be read-side only: it MUST NOT change what is persisted or how runs are selected. The value is a schedule, not a promise (DEC-95). Existing fields and their values MUST remain unchanged.

#### Scenario: First run after creation

- **GIVEN** the configured zone `UTC` and a cron `30 8 * * *` created at 10:00 UTC
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be 08:30 UTC of the next day
- **AND** `zonaHoraria` SHALL be `UTC`

#### Scenario: Weekday range across a weekend

- **GIVEN** cron `30 8 * * 1-5` and a Friday creation after 08:30
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be the following Monday at 08:30

#### Scenario: Saturday range

- **GIVEN** cron `30 8 * * 1-6` and a Saturday creation after 08:30
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be the following Monday at 08:30

#### Scenario: Non-UTC zone

- **GIVEN** the configured zone `America/Argentina/Buenos_Aires` and cron `0 8 * * *`
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be 08:00 in that zone expressed as an ISO instant
- **AND** `zonaHoraria` SHALL be that zone

#### Scenario: Strictly after creation

- **GIVEN** a creation at exactly a cron fire minute
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be later than `creadaEn`

#### Scenario: Additive and unchanged

- **GIVEN** any valid creation
- **WHEN** the 201 body is read
- **THEN** `automatizacion` and its existing fields SHALL be unchanged
- **AND** an invalid request SHALL still fail with the same `400` or `404` and no row SHALL persist

## Not Changed

`tenant-isolation` needs tests only, no spec change: tenant context entry, closed-field logs, and recipient derivation already hold; isolation tests assert them across a tenant failure.

