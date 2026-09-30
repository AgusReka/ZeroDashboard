# Delta for Tenant Isolation

## MODIFIED Requirements

### Requirement: Cross-Tenant Isolation Is Proven by an Automated Test (T2)

The system SHALL include an automated test that loads two tenants, exercises every tenant-scoped route from each tenant's perspective, and asserts no operation returns, tests connectivity against, or executes a query against the other tenant's row. It SHALL run against a live database (skip, not fail, when unreachable) with no mocking, matching the existing `node:test` + `app.inject()` convention. The sweep SHALL include the mapping-validation routes (triggering validation, reading a validation result, reading the automation-applicability report) and the routes creating, listing, getting, and deactivating an `Automatizacion` and listing an automation's `Ejecucion` rows. The suite SHALL also include a two-tenant scheduler tick asserting that each tenant's result rows are delivered only to that tenant's own automation recipient (a recording fake notifier is permitted; the database is not mocked).
(Previously: the sweep did not include notification delivery.)

#### Scenario: Full two-tenant route sweep

- GIVEN two tenants, each with its own `Conexion`, `ConsultaGuardada`, schema-mapping definition, validation result, `Automatizacion`, and `Ejecucion`
- WHEN every tenant-scoped route is exercised from both tenants, including validate, validation-read, applicability-report, automation, and runs-listing routes
- THEN no response SHALL contain, confirm the existence of, trigger validation against, or act upon the other tenant's row
- AND a cross-tenant request naming another tenant's connection, entity, or automation SHALL receive `404`

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

## ADDED Requirements

### Requirement: Notification Recipient Derives Only From the Tenant-Scoped Automation Row (rule 2)

The recipient of a notification SHALL be read only from the `destinatario` of the `Automatizacion` row loaded inside that run's tenant context. It MUST NOT be taken from any request value, environment variable, or another tenant's row.

#### Scenario: Recipient comes from the run's own automation

- GIVEN two tenants' automations with different `destinatario` values and the same plantilla
- WHEN each runs
- THEN each message's recipient SHALL equal its own automation's `destinatario`

#### Scenario: No global fallback recipient

- GIVEN an automation with null `destinatario` and any environment variable resembling a recipient
- WHEN it runs with rows
- THEN no message SHALL be sent and `notificacion` SHALL be `sin-destinatario`
