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

Every completed attempt to run an automation — success, execution failure, or refusal because a required view validation is missing or failing — SHALL write exactly one `Ejecucion` row. No attempt SHALL leave the run unrecorded.

#### Scenario: A validation-gate refusal is recorded

- GIVEN an automation whose composed views fail the DEC-71 gate
- WHEN the scheduler attempts to run it
- THEN one `Ejecucion` row SHALL persist with a failure status and an error naming the ungated entity
- AND no query SHALL have executed against the tenant's connection

#### Scenario: An execution failure is recorded

- GIVEN an automation whose composed statement fails during execution
- WHEN the run completes
- THEN one `Ejecucion` row SHALL persist with a failure status, zero or no row count, and a classified error

### Requirement: Execution Metadata Only — No Result Rows Persisted (D-1 leaning, minimization)

`Ejecucion` SHALL store only metadata about a run. It MUST NOT persist any row or field value the run's query returned.

#### Scenario: A run's own result data is absent from its log row

- GIVEN a run that returns rows containing tenant business data
- WHEN its `Ejecucion` row is inspected
- THEN it SHALL contain only the row count, not the row contents

### Requirement: Error Field Stores a Classified Error, Never a Raw Driver Error

WHEN a run fails, `Ejecucion.error` SHALL store the same kind of sanitized, classified error category `query-execution` already uses for a failed ad hoc execution. It MUST NOT store a raw driver error object, a stack trace, or the target connection's credential value.

#### Scenario: A failed run's error is sanitized

- GIVEN a run that fails with a driver-level error
- WHEN its `Ejecucion` row is inspected
- THEN `error` SHALL contain a classified category, never the raw driver error text or a stack trace

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
