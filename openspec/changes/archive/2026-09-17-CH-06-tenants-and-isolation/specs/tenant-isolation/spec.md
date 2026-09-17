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

The system SHALL filter every read and write on `Conexion` and `ConsultaGuardada` by the resolved active tenant, structurally, such that a row belonging to a different tenant is treated as though it does not exist for that request.

#### Scenario: Reading another tenant's connection or saved query

- GIVEN tenants A and B, and a row belonging to B
- WHEN A's active tenant requests that row by id
- THEN the response SHALL behave as though the row does not exist
- AND SHALL NOT return or act on B's data

#### Scenario: Listing returns only the active tenant's rows

- GIVEN tenants A and B, each with saved queries
- WHEN A's active tenant requests the saved-queries listing
- THEN only A's rows SHALL appear

### Requirement: Cross-Tenant Isolation Is Proven by an Automated Test (T2)

The system SHALL include an automated test that loads two tenants, exercises every tenant-scoped route from each tenant's perspective, and asserts no operation returns, tests connectivity against, or executes a query against the other tenant's row. It SHALL run against a live database (skip, not fail, when unreachable) with no mocking, matching the existing `node:test` + `app.inject()` convention.

#### Scenario: Full two-tenant route sweep

- GIVEN two tenants, each with its own `Conexion` and `ConsultaGuardada` rows
- WHEN every tenant-scoped route is exercised from both tenants
- THEN no response SHALL contain, confirm the existence of, or act upon the other tenant's row

#### Scenario: Database unreachable

- GIVEN the live PostgreSQL database the test targets is unreachable
- WHEN the test suite runs
- THEN this test SHALL be skipped, not reported as a failure
