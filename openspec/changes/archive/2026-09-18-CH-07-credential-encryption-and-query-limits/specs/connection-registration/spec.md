# Delta for Connection Registration

## MODIFIED Requirements

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
