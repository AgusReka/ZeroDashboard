# Delta for Execution Log

## ADDED Requirements

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

## MODIFIED Requirements

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
