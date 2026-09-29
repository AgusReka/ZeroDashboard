# Tenant Isolation Specification

## Purpose

Making tenant isolation real (T2, T4): the active tenant is declared explicitly per request (DEC-15, no server session), every scoped query against `Conexion` and `ConsultaGuardada` is filtered by it structurally (DEC-13), and no operation ever crosses tenants. Rule 2 (no client-supplied tenant id) is panel-scoped (P2, CH-22); the console (P1, DEC-04) is a distinct trust surface where an explicit per-request tenant is accepted, per DEC-15.

## Requirements

### Requirement: Active Tenant Must Be Resolvable Before Any Scoped Query

The system SHALL require an active tenant to be resolvable for any request that reads or writes tenant-scoped data. WHEN no active tenant can be resolved, or the resolved id names no tenant, the system SHALL reject the request before it reaches any tenant-scoped query.

#### Scenario: Request without a resolvable active tenant

- GIVEN a request to a tenant-scoped operation with no resolvable active-tenant indication
- WHEN the request is handled
- THEN it SHALL be rejected
- AND no tenant-scoped query SHALL execute

#### Scenario: Request naming an unknown tenant id

- GIVEN a request naming a tenant id that does not exist
- WHEN the request is handled
- THEN it SHALL be rejected
- AND no tenant-scoped query SHALL execute

### Requirement: Active Tenant Declared Explicitly Per Request (DEC-15)

The system SHALL determine the active tenant explicitly from each incoming request, without relying on server-side session state.

#### Scenario: Two sequential requests with different active tenants

- GIVEN two consecutive requests to the same route, each explicitly declaring a different active tenant
- WHEN both are handled
- THEN each SHALL be scoped only to its own declared tenant

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

### Requirement: Plantilla Is Outside the Structural Tenant Filter (DEC-61)

`Plantilla` SHALL NOT be added to the tenant-scoped model allowlist (`MODELOS_AISLADOS`, DEC-13); its reads and writes SHALL proceed without any active-tenant filter. Its catalog routes (create, list, get, replace) SHALL be added to the tenant-context exemption allowlist, matched by exact method and route pattern. The test route (`POST /plantillas/:id/prueba`) SHALL NOT be added to that exemption: it resolves a tenant-owned `Conexion` and therefore SHALL require an active tenant like any other scoped route.

#### Scenario: Catalog routes work without any tenant header

- GIVEN a request to create, list, get, or replace a `Plantilla`
- WHEN it is sent with no `x-tenant-id` header
- THEN it SHALL succeed, unaffected by the absence of a tenant

#### Scenario: Test route still requires a resolvable active tenant

- GIVEN an existing `Plantilla`
- WHEN `POST /plantillas/:id/prueba` is sent with no `x-tenant-id`
- THEN the response SHALL be `400 tenant-no-indicado`
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
