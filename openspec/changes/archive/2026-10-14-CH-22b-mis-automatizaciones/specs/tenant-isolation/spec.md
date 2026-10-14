# Delta for Tenant Isolation

## MODIFIED Requirements

### Requirement: Cross-Tenant Isolation Is Proven by an Automated Test (T2)

The system SHALL include an automated test that loads two tenants, exercises every tenant-scoped route from each tenant's perspective, and asserts no operation returns, tests connectivity against, or executes a query against the other tenant's row. It SHALL run against a live database (skip, not fail, when unreachable) with no mocking, matching the existing `node:test` + `app.inject()` convention. The sweep SHALL include the mapping-validation routes (triggering validation, reading a validation result, reading the automation-applicability report), the routes creating, listing, getting, and deactivating an `Automatizacion` and listing an automation's `Ejecucion` rows, and `GET /conexiones`. The suite SHALL also include a two-tenant scheduler tick asserting that each tenant's result rows are delivered only to that tenant's own automation recipient (a recording fake notifier is permitted; the database is not mocked). The panel two-tenant suite (`src/aislamiento-panel.test.ts`) SHALL additionally exercise `GET /api/panel/automatizaciones` from each tenant's session, including with the other tenant's `X-Tenant-Id` header, and SHALL assert that neither response contains the other tenant's automations, execution dates or availability.
(Previously: the sweep did not include `GET /conexiones`; the suite did not cover the panel automations route.)

#### Scenario: Full two-tenant route sweep

- GIVEN two tenants, each with its own `Conexion`, `ConsultaGuardada`, schema-mapping definition, validation result, `Automatizacion`, and `Ejecucion`
- WHEN every tenant-scoped route is exercised from both tenants, including validate, validation-read, applicability-report, automation, runs-listing, and connection-listing routes
- THEN no response SHALL contain, confirm the existence of, trigger validation against, or act upon the other tenant's row
- AND a cross-tenant request naming another tenant's connection, entity, or automation SHALL receive `404`

#### Scenario: Connection listing sweep row

- GIVEN tenants A and B, each with a connection
- WHEN each tenant calls `GET /conexiones`
- THEN each response SHALL contain only its own connection's `id` and `nombre`
- AND neither response SHALL contain the other tenant's connection id NOR its name

#### Scenario: Database unreachable

- GIVEN the live PostgreSQL database the test targets is unreachable
- WHEN the test suite runs
- THEN this test SHALL be skipped, not reported as a failure

#### Scenario: Two-tenant tick delivers each tenant's rows only to its own recipient

- GIVEN tenants A and B, each with a due automation returning distinct, identifiable rows, and distinct `destinatario` values
- WHEN the scheduler ticks once
- THEN the notifier SHALL have received exactly two messages
- AND the message addressed to A's recipient SHALL contain only A's rows and none of B's
- AND the message addressed to B's recipient SHALL contain only B's rows and none of A's

#### Scenario: Panel automations route sweep row

- GIVEN tenant A with an active `stock-fisico` automation and a finished execution at a known instant, and tenant B with an active `stock-producible` automation and a finished execution at a different known instant
- WHEN each tenant's user calls `GET /api/panel/automatizaciones` with their own session, and again with `X-Tenant-Id` naming the other tenant
- THEN each response SHALL contain only its own tenant's `activas` entry and its own execution instant
- AND the `disponibles` of each SHALL list the template the other tenant uses and SHALL NOT list its own
- AND the response with the foreign `X-Tenant-Id` SHALL equal the response without it
- AND neither response SHALL contain the other tenant's id, automation title or execution instant
