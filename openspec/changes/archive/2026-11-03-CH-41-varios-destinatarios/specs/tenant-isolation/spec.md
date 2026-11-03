# Tenant Isolation Specification (CH-41 delta)

## Purpose
The recipients of a notification are the whole `destinatarios` list of the run's own tenant-scoped automation, never another tenant's or a global fallback (rule 2, DEC-187).

## MODIFIED Requirements

### Requirement: Cross-Tenant Isolation Is Proven by an Automated Test (T2)

The system SHALL include an automated test that loads two tenants, exercises every tenant-scoped route from each tenant's perspective, and asserts no operation returns, tests connectivity against, or executes a query against the other tenant's row. It SHALL run against a live database (skip, not fail, when unreachable) with no mocking, matching the existing `node:test` + `app.inject()` convention. The sweep SHALL include the mapping-validation routes (triggering validation, reading a validation result, reading the automation-applicability report), the routes creating, listing, getting, and deactivating an `Automatizacion` and listing an automation's `Ejecucion` rows, and `GET /conexiones`. The suite SHALL also include a two-tenant scheduler tick asserting that each tenant's result rows are delivered only to that tenant's own automation recipient (a recording fake notifier is permitted; the database is not mocked). The panel two-tenant suite (`src/aislamiento-panel.test.ts`) SHALL additionally exercise `GET /api/panel/automatizaciones` from each tenant's session, including with the other tenant's `X-Tenant-Id` header, and SHALL assert that neither response contains the other tenant's automations, execution dates or availability.
(Previously: the tick scenario named one `destinatario` per tenant.)

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

- GIVEN tenants A and B, each with a due automation returning distinct, identifiable rows, and distinct `destinatarios` lists, A's with two addresses
- WHEN the scheduler ticks once
- THEN the notifier SHALL have received exactly two messages
- AND the message addressed to A's recipients SHALL carry exactly A's two addresses and only A's rows, none of B's
- AND the message addressed to B's recipients SHALL carry only B's addresses and only B's rows, none of A's

#### Scenario: Panel automations route sweep row

- GIVEN tenant A with an active `stock-fisico` automation and a finished execution at a known instant, and tenant B with an active `stock-producible` automation and a finished execution at a different known instant
- WHEN each tenant's user calls `GET /api/panel/automatizaciones` with their own session, and again with `X-Tenant-Id` naming the other tenant
- THEN each response SHALL contain only its own tenant's `activas` entry and its own execution instant
- AND the `disponibles` of each SHALL list the template the other tenant uses and SHALL NOT list its own
- AND the response with the foreign `X-Tenant-Id` SHALL equal the response without it
- AND neither response SHALL contain the other tenant's id, automation title or execution instant

### Requirement: Notification Recipient Derives Only From the Tenant-Scoped Automation Row (rule 2)

The recipients of a notification SHALL be read only from the `destinatarios` of the `Automatizacion` row loaded inside that run's tenant context, all of them and nothing else. They MUST NOT be taken from any request value, environment variable, or another tenant's row.
(Previously: one `destinatario`.)

#### Scenario: Recipient comes from the run's own automation

- GIVEN two tenants' automations with different `destinatarios` lists and the same plantilla
- WHEN each runs
- THEN each message's «Para» SHALL equal its own automation's `destinatarios`, in order

#### Scenario: No global fallback recipient

- GIVEN an automation with `destinatarios` `[]` and any environment variable resembling a recipient
- WHEN it runs with rows
- THEN no message SHALL be sent and `notificacion` SHALL be `sin-destinatario`
