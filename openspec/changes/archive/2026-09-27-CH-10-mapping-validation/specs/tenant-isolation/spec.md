# Delta for Tenant Isolation

## MODIFIED Requirements

### Requirement: Cross-Tenant Isolation Is Proven by an Automated Test (T2)

The system SHALL include an automated test that loads two tenants, exercises every tenant-scoped route from each tenant's perspective, and asserts no operation returns, tests connectivity against, or executes a query against the other tenant's row. It SHALL run against a live database (skip, not fail, when unreachable) with no mocking, matching the existing `node:test` + `app.inject()` convention. The sweep SHALL include the mapping-validation routes: triggering validation, reading a validation result, and reading the automation-applicability report.
(Previously: the sweep covered registration, listing, and read routes for schema-mapping definitions; it did not include validation or applicability-report routes.)

#### Scenario: Full two-tenant route sweep

- GIVEN two tenants, each with its own `Conexion`, `ConsultaGuardada`, schema-mapping definition, and validation result
- WHEN every tenant-scoped route is exercised from both tenants, including validate, validation-read, and applicability-report routes
- THEN no response SHALL contain, confirm the existence of, trigger validation against, or act upon the other tenant's row
- AND a cross-tenant request naming another tenant's connection or entity SHALL receive `404`

#### Scenario: Database unreachable

- GIVEN the live PostgreSQL database the test targets is unreachable
- WHEN the test suite runs
- THEN this test SHALL be skipped, not reported as a failure
