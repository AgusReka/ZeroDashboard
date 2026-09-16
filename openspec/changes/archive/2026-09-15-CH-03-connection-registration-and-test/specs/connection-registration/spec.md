# Connection Registration Specification

## Purpose

Registering a tenant's target database connection and proving, with a legible result, whether that connection actually works — without ever exposing the stored credential.

## Requirements

### Requirement: Connection Registration Persists Against the Seeded Tenant

The system SHALL allow registering a `Conexion` record referencing the single seeded `Tenant`, capturing host, port, database name, user, credential, engine (`motor`), and a name. The system SHALL reject a registration request missing any of these fields.

#### Scenario: Registering a valid connection

- **GIVEN** the seeded `Tenant` exists and a request supplies host, port, database, user, credential, motor, and name
- **WHEN** the registration endpoint is called
- **THEN** a `Conexion` row SHALL be created referencing the seeded `Tenant`
- **AND** the response SHALL confirm the created record without echoing the credential value

#### Scenario: Rejecting an incomplete registration

- **GIVEN** a registration request missing a required field (host, port, database, user, credential, motor, or name)
- **WHEN** the registration endpoint is called
- **THEN** the request SHALL be rejected
- **AND** no `Conexion` row SHALL be created

### Requirement: Connectivity Test Uses a Fixed PostgreSQL Probe

The system SHALL test a registered connection by opening a short-lived PostgreSQL client connection (independent of the application's own database client) to the stored host, port, database, user, and credential, and executing one literal, parameterless probe statement.

#### Scenario: Testing a reachable PostgreSQL target

- **GIVEN** a registered connection pointing to a reachable PostgreSQL server with correct credentials and an existing database
- **WHEN** the test endpoint is called for that connection
- **THEN** the response SHALL report success

#### Scenario: Testing a connection with a non-PostgreSQL engine value

- **GIVEN** a registered connection whose stored `motor` is not PostgreSQL
- **WHEN** the test endpoint is called for that connection
- **THEN** the system SHALL still attempt the fixed PostgreSQL probe against the stored host and port
- **AND** the response SHALL report a legible failure result rather than hanging, crashing, or reporting false success

### Requirement: Distinguishable Failure Categories

WHEN a connectivity test fails, the system SHALL classify the failure into one of: unreachable host/port, DNS resolution failure, timeout, bad credentials, missing database, or other/generic. The response SHALL include the failure category.

#### Scenario: Unreachable host or port

- **GIVEN** a registered connection pointing to a host/port with no listener
- **WHEN** the test endpoint is called
- **THEN** the response SHALL report failure with an unreachable host/port category

#### Scenario: DNS resolution failure

- **GIVEN** a registered connection whose host does not resolve
- **WHEN** the test endpoint is called
- **THEN** the response SHALL report failure with a DNS resolution failure category

#### Scenario: Bad credentials

- **GIVEN** a registered connection with an incorrect user or credential value for an otherwise reachable server
- **WHEN** the test endpoint is called
- **THEN** the response SHALL report failure with a bad credentials category

#### Scenario: Missing database

- **GIVEN** a registered connection with correct credentials but a database name that does not exist on the target server
- **WHEN** the test endpoint is called
- **THEN** the response SHALL report failure with a missing database category

#### Scenario: Other unclassified failure

- **GIVEN** a registered connection whose failure does not match any of the other defined categories
- **WHEN** the test endpoint is called
- **THEN** the response SHALL report failure with an other/generic category rather than being left unclassified

### Requirement: Bounded Connection-Attempt Timeout

The system SHALL bound each connectivity test attempt to a fixed maximum duration. WHEN the target does not respond within that duration, the system SHALL fail the test with a timeout category instead of waiting indefinitely.

#### Scenario: Testing an unresponsive host

- **GIVEN** a registered connection pointing to a host that accepts no response
- **WHEN** the test endpoint is called
- **THEN** the response SHALL be returned within the bounded timeout
- **AND** the failure category SHALL be timeout

### Requirement: Credential Value Never Exposed

The system MUST NOT include the submitted credential value in any test response body, error message, or log line, regardless of test outcome.

#### Scenario: A failed test does not leak the credential

- **GIVEN** a registered connection tested with an incorrect credential value
- **WHEN** the test fails due to bad credentials
- **THEN** the response body SHALL NOT contain the submitted credential value
- **AND** any log line produced during the attempt SHALL NOT contain the submitted credential value

#### Scenario: A successful test does not leak the credential

- **GIVEN** a registered connection tested with the correct credential value
- **WHEN** the test succeeds
- **THEN** the response body SHALL NOT contain the credential value
