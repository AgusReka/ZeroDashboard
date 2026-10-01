# Execution Log Specification

## Purpose

Recording every run of an `Automatizacion` (X2): start, end, duration, row count, status, and a classified error when one occurs — metadata only, never the rows a run read — and a tenant-scoped route to list an automation's runs (DEC-80).

## Requirements

### Requirement: Ejecucion Records One Row Per Run (X2)

The own database SHALL have an `Ejecucion` table. Every row MUST reference exactly one `Tenant` row and exactly one `Automatizacion` row through required foreign keys, and MUST store a start timestamp, an end timestamp, a duration, a row count, a status, and an optional error.

#### Scenario: A successful run writes a complete row

- GIVEN a due active automation whose run succeeds and returns rows
- WHEN the run completes
- THEN one `Ejecucion` row SHALL persist with start, end, duration, the returned row count, a success status, and no error

### Requirement: Every Run Outcome Writes an Ejecucion, Including a Gate Refusal (DEC-71)

Every completed attempt to run an automation — success, execution failure, refusal because a required view validation is missing or failing, or an overlap skip — SHALL write exactly one `Ejecucion` row. A row closed by the boot sweep is also a recorded outcome (`interrumpida`). No attempt SHALL leave the run unrecorded.
(Previously: listed success, execution failure, and gate refusal only.)

#### Scenario: A validation-gate refusal is recorded

- GIVEN an automation whose composed views fail the DEC-71 gate
- WHEN the scheduler attempts to run it
- THEN one `Ejecucion` row SHALL persist with a failure status and an error naming the ungated entity
- AND no query SHALL have executed against the tenant's connection

#### Scenario: An execution failure is recorded

- GIVEN an automation whose composed statement fails during execution
- WHEN the run completes
- THEN one `Ejecucion` row SHALL persist with a failure status, zero or no row count, and a classified error

#### Scenario: An overlap skip writes exactly one row per tick

- GIVEN an automation with an `en-curso` row and two consecutive due ticks
- WHEN both ticks run
- THEN exactly two `omitida` rows SHALL persist, one per tick, and the `en-curso` row SHALL be unchanged

### Requirement: Execution Metadata Only — No Result Rows Persisted (D-1 leaning, minimization)

`Ejecucion` SHALL store only metadata about a run. It MUST NOT persist any row or field value the run's query returned.

#### Scenario: A run's own result data is absent from its log row

- GIVEN a run that returns rows containing tenant business data
- WHEN its `Ejecucion` row is inspected
- THEN it SHALL contain only the row count, not the row contents

### Requirement: Error Field Stores a Classified Error, Never a Raw Driver Error

WHEN a run fails or is skipped, `Ejecucion.error` SHALL store a sanitized, classified error category from a closed set: the categories `query-execution` already uses for a failed ad hoc execution, a closed set of send-failure categories used when `fase='notificacion'`, plus `solapamiento` (with `estado='omitida'`) and `interrumpida` (with `estado='fallo'`). It MUST NOT store a raw driver error object, raw SMTP server response text, a stack trace, the target connection's credential value, or SMTP credentials.
(Previously: the closed set did not include `solapamiento` or `interrumpida`.)

#### Scenario: A failed run's error is sanitized

- GIVEN a run that fails with a driver-level error
- WHEN its `Ejecucion` row is inspected
- THEN `error` SHALL contain a classified category, never the raw driver error text or a stack trace

#### Scenario: A failed send's error is a closed category

- GIVEN a run whose send fails with an SMTP error containing server text and the sender address
- WHEN its `Ejecucion` row is inspected
- THEN `error` SHALL be one of the closed send-failure categories
- AND SHALL NOT contain the server text or any SMTP credential

#### Scenario: New values appear in the runs listing

- GIVEN one `omitida`/`solapamiento` row and one `fallo`/`interrumpida` row for an automation
- WHEN `GET /automatizaciones/:id/ejecuciones` is called
- THEN both rows SHALL be listed with those `estado` and `error` values
### Requirement: Runs Listing Is Tenant-Scoped to the Automation's Owner (DEC-80)

The system SHALL expose `GET /automatizaciones/:id/ejecuciones`, scoped to the active tenant: it SHALL resolve the named `Automatizacion` only among rows belonging to the active tenant, and SHALL respond as though it does not exist otherwise.

#### Scenario: Listing runs for one's own automation

- GIVEN an `Automatizacion` belonging to the active tenant with prior runs
- WHEN `GET /automatizaciones/:id/ejecuciones` is called with its id
- THEN the response SHALL list its `Ejecucion` rows

#### Scenario: Naming another tenant's automation

- GIVEN tenants A and B, and an `Automatizacion` belonging to B
- WHEN A's active tenant requests B's automation's runs
- THEN the response SHALL be `404`
- AND no run data SHALL be returned
### Requirement: Ejecucion Records the Notification Outcome (DEC-83)

`Ejecucion` SHALL have a nullable `notificacion` column whose only permitted values are `enviada`, `omitida-sin-filas`, `fallo-envio`, `sin-destinatario`, `no-configurada`, and null. Its value SHALL follow the precedence defined in `email-notification`. It SHALL be null when the query failed and for rows written before this change. `notificacion` MUST store the outcome only, never a message body, recipient, or row content.

#### Scenario: Each outcome is recorded

- GIVEN runs that reach each of the five non-null outcomes
- WHEN their `Ejecucion` rows are inspected
- THEN each SHALL carry the matching `notificacion` value

#### Scenario: Query failure leaves notificacion null

- GIVEN a run whose query fails
- WHEN its `Ejecucion` row is inspected
- THEN `notificacion` SHALL be null

#### Scenario: Legacy rows read as null

- GIVEN an `Ejecucion` row written before this change
- WHEN it is listed
- THEN `notificacion` SHALL be null

### Requirement: A Send Failure Marks the Run Failed in Phase notificacion (DEC-83)

The set of permitted `fase` values SHALL include `notificacion`. WHEN a send fails, the run SHALL be recorded with `estado='fallo'`, `fase='notificacion'`, and `notificacion='fallo-envio'`, while its row count SHALL still reflect the rows the query returned. `estado='fallo'` therefore no longer implies the query failed; `fase` identifies what failed. WHEN the query succeeds and the send is accepted or not attempted, `fase` SHALL remain unchanged (`ejecucion`).

#### Scenario: Query succeeded, send failed

- GIVEN a run that returned 12 rows and whose send fails
- WHEN its `Ejecucion` row is inspected
- THEN `estado` SHALL be `fallo`, `fase` SHALL be `notificacion`, and the row count SHALL be 12

#### Scenario: Successful notification leaves the run ok

- GIVEN a run whose send succeeds
- WHEN its `Ejecucion` row is inspected
- THEN `estado` SHALL be `ok`, `fase` SHALL be unchanged (`ejecucion`), and `notificacion` SHALL be `enviada`

### Requirement: Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)

`GET /automatizaciones/:id/ejecuciones` SHALL include each run's `notificacion` value, remaining scoped to the active tenant's automation.

#### Scenario: Listing shows notificacion

- GIVEN an automation of the active tenant with runs of differing outcomes
- WHEN its runs are listed
- THEN each entry SHALL include its `notificacion` value
### Requirement: Estado Set Includes omitida (DEC-96)

The permitted `Ejecucion.estado` values SHALL be `en-curso`, `ok`, `fallo`, and `omitida`. `omitida` SHALL mean the run was never started because a previous run of the same automation was still `en-curso`. An `omitida` row MUST carry `error='solapamiento'`, MUST have `notificacion` null, and MUST NOT have been preceded by any query against the tenant's connection.

#### Scenario: An overlap skip is recorded as omitida

- GIVEN an automation with an `en-curso` row and a due tick
- WHEN the scheduler ticks
- THEN a new `Ejecucion` row SHALL persist with `estado='omitida'`, `error='solapamiento'`, and `notificacion` null

#### Scenario: A closed row is not an overlap

- GIVEN an automation whose previous rows are all `ok`, `fallo`, or `omitida`
- WHEN it becomes due
- THEN no `omitida` row SHALL be written for it

### Requirement: Interrupted Runs Are Closed as fallo/interrumpida (DEC-99)

A row left `en-curso` by a process stop SHALL be closed with `estado='fallo'` and `error='interrumpida'`. Its `finalizadaEn` SHALL equal the boot time of the sweep; `duracionMs`, `filas`, `fase`, and `notificacion` SHALL be null.

#### Scenario: A swept row has the interrupted shape

- GIVEN an `en-curso` row from a previous process
- WHEN the boot sweep runs
- THEN the row SHALL have `estado='fallo'`, `error='interrumpida'`, `finalizadaEn` equal to boot time, and null `duracionMs`, `filas`, `fase`, `notificacion`

#### Scenario: Closed rows are untouched by the sweep

- GIVEN rows with `estado` `ok`, `fallo`, and `omitida`
- WHEN the boot sweep runs
- THEN those rows SHALL be unchanged

