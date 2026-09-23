# Delta for tenant-isolation

## MODIFIED Requirements

### Requirement: Every Scoped Query Is Filtered by the Active Tenant (DEC-13)

The system SHALL filter every read and write on `Conexion`, `ConsultaGuardada`, and the schema-mapping definitions added by this change by the resolved active tenant, structurally, such that a row belonging to a different tenant is treated as though it does not exist for that request.
(Previously: covered only `Conexion` and `ConsultaGuardada`.)

#### Scenario: Reading another tenant's connection, saved query, or schema-mapping definition

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
(Previously: the sweep's rows were limited to `Conexion` and `ConsultaGuardada`.)

#### Scenario: Full two-tenant route sweep

- GIVEN two tenants, each with its own `Conexion`, `ConsultaGuardada`, and schema-mapping definition rows
- WHEN every tenant-scoped route is exercised from both tenants, including the schema-mapping registration, listing, and read routes
- THEN no response SHALL contain, confirm the existence of, or act upon the other tenant's row

#### Scenario: Database unreachable

- GIVEN the live PostgreSQL database the test targets is unreachable
- WHEN the test suite runs
- THEN this test SHALL be skipped, not reported as a failure
