# Delta for Tenant Isolation

## MODIFIED Requirements

### Requirement: Every Scoped Query Is Filtered by the Active Tenant (DEC-13)

The system SHALL filter every read and write on `Conexion`, `ConsultaGuardada`, the schema-mapping definitions, `Automatizacion`, and `Ejecucion` by the resolved active tenant, structurally, such that a row belonging to a different tenant is treated as though it does not exist for that request or run.
(Previously: covered `Conexion`, `ConsultaGuardada`, and the schema-mapping definitions; did not cover `Automatizacion` or `Ejecucion`, which did not yet exist.)

#### Scenario: Reading another tenant's connection, saved query, schema-mapping definition, automation, or execution record

- GIVEN tenants A and B, and a row belonging to B
- WHEN A's active tenant requests that row by id
- THEN the response SHALL behave as though the row does not exist
- AND SHALL NOT return or act on B's data

#### Scenario: Listing returns only the active tenant's rows

- GIVEN tenants A and B, each with saved queries
- WHEN A's active tenant requests the saved-queries listing
- THEN only A's rows SHALL appear

### Requirement: Cross-Tenant Isolation Is Proven by an Automated Test (T2)

The system SHALL include an automated test that loads two tenants, exercises every tenant-scoped route from each tenant's perspective, and asserts no operation returns, tests connectivity against, or executes a query against the other tenant's row. It SHALL run against a live database (skip, not fail, when unreachable) with no mocking, matching the existing `node:test` + `app.inject()` convention. The sweep SHALL include the mapping-validation routes (triggering validation, reading a validation result, reading the automation-applicability report) and this change's routes: creating, listing, getting, and deactivating an `Automatizacion`, and listing an automation's `Ejecucion` rows.
(Previously: the sweep did not include this change's automation and execution-log routes, which did not yet exist.)

#### Scenario: Full two-tenant route sweep

- GIVEN two tenants, each with its own `Conexion`, `ConsultaGuardada`, schema-mapping definition, validation result, `Automatizacion`, and `Ejecucion`
- WHEN every tenant-scoped route is exercised from both tenants, including validate, validation-read, applicability-report, automation, and runs-listing routes
- THEN no response SHALL contain, confirm the existence of, trigger validation against, or act upon the other tenant's row
- AND a cross-tenant request naming another tenant's connection, entity, or automation SHALL receive `404`

#### Scenario: Database unreachable

- GIVEN the live PostgreSQL database the test targets is unreachable
- WHEN the test suite runs
- THEN this test SHALL be skipped, not reported as a failure

## ADDED Requirements

### Requirement: Scheduler-Entered Tenant Context Derives Identity Only From Own-Database Rows

The scheduler SHALL enter each tenant's context using the same fail-closed, structural extension applied to request handling (DEC-13); it SHALL derive the tenant identity used to enter that context only from `Tenant` rows read from the own database, never from any externally supplied value. No scheduler-initiated query against a tenant-scoped model SHALL bypass that structural filter.

#### Scenario: Scheduler tick enters a tenant's context from its own Tenant row

- GIVEN an active `Tenant` row with a due active `Automatizacion`
- WHEN the scheduler ticks
- THEN the run SHALL execute inside a context whose tenant id is read from that `Tenant` row
- AND every query the run issues against a tenant-scoped model SHALL be filtered by that same tenant id

#### Scenario: A scheduler-run query outside any context fails closed

- GIVEN the scheduler's tenant-context entry mechanism
- WHEN a query against a tenant-scoped model is attempted with no context entered
- THEN it SHALL throw rather than execute unfiltered, same as a request-time query
