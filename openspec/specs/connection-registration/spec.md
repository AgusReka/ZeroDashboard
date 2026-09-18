# Connection Registration Specification

## Purpose

Registering a tenant's target database connection and proving, with a legible result, whether that connection actually works — without ever exposing the stored credential.

## Requirements

### Requirement: Connection Registration Persists Against the Active Tenant

The system SHALL allow registering a `Conexion` record referencing the active tenant resolved for the request, capturing host, port, database name, user, credential, engine (`motor`), and a name. The system SHALL reject a registration request missing any of these fields, and SHALL reject it when no active tenant can be resolved, before the request reaches any tenant-scoped query. The submitted credential SHALL be enciphered (per `credential-encryption`) before the row is persisted; the column stores the resulting envelope, never the submitted plaintext.
(Previously: the credential was persisted as submitted plaintext, with no encipher step; tenant scoping was already in place from CH-06.)

#### Scenario: Registering a valid connection

- **GIVEN** an active, resolvable tenant and a request supplying host, port, database, user, credential, motor, and name
- **WHEN** the registration endpoint is called
- **THEN** a `Conexion` row SHALL be created referencing that active tenant
- **AND** the response SHALL confirm the created record without echoing the credential value
- **AND** the persisted `credencial` value SHALL be an enciphered envelope, not the submitted plaintext

#### Scenario: Rejecting an incomplete registration

- **GIVEN** a registration request missing a required field
- **WHEN** the registration endpoint is called
- **THEN** the request SHALL be rejected
- **AND** no `Conexion` row SHALL be created

#### Scenario: No active tenant resolvable

- **GIVEN** a registration request with no resolvable active tenant
- **WHEN** the registration endpoint is called
- **THEN** the request SHALL be rejected
- **AND** no `Conexion` row SHALL be created

### Requirement: Connectivity Test Uses a Fixed PostgreSQL Probe

The system SHALL test a registered connection by opening a short-lived PostgreSQL client connection (independent of the application's own database client) to the stored host, port, database, user, and the credential deciphered in memory from the stored envelope, and executing one literal, parameterless probe statement. The deciphered credential SHALL exist only for the duration of this call and SHALL NOT be persisted or returned.
(Previously: the stored `credencial` column value was passed to the probe directly as plaintext, with no decipher step.)

#### Scenario: Testing a reachable PostgreSQL target

- **GIVEN** a registered connection pointing to a reachable PostgreSQL server with correct credentials and an existing database
- **WHEN** the test endpoint is called for that connection
- **THEN** the stored envelope SHALL be deciphered in memory
- **AND** the response SHALL report success

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

The system MUST NOT include the submitted credential value, the stored enciphered envelope's deciphered plaintext, or the master key in any test response body, error message, or log line, regardless of test outcome.
(Previously: covered only the submitted plaintext credential; now also covers the deciphered value and the master key introduced by `credential-encryption`.)

#### Scenario: A failed test does not leak the credential

- **GIVEN** a registered connection tested with an incorrect credential value
- **WHEN** the test fails due to bad credentials
- **THEN** the response body SHALL NOT contain the submitted credential value
- **AND** any log line produced during the attempt SHALL NOT contain the submitted credential value

#### Scenario: A successful test does not leak the credential

- **GIVEN** a registered connection tested with the correct credential value
- **WHEN** the test succeeds
- **THEN** the response body SHALL NOT contain the credential value

#### Scenario: A database dump never yields a readable credential

- **GIVEN** a dump of the application's own database containing a registered `Conexion` row
- **WHEN** the dump is inspected without the master key
- **THEN** no credential in it SHALL be decipherable
### Requirement: Connectivity Test Is Scoped to the Active Tenant

The connectivity test endpoint SHALL resolve the target `Conexion` only among rows belonging to the request's active tenant. WHEN the named `Conexion` id belongs to a different tenant, or does not exist, the system SHALL respond as though it does not exist and SHALL NOT attempt the probe.

#### Scenario: Testing another tenant's connection

- **GIVEN** tenants A and B, and a `Conexion` belonging to B
- **WHEN** A's active tenant calls the test endpoint naming B's `Conexion` id
- **THEN** the response SHALL report the connection as not found
- **AND** no probe SHALL be attempted against B's stored host/credential
