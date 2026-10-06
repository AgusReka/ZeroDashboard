# Connection Registration Specification

## Purpose

Registering a tenant's target database connection and proving, with a legible result, whether that connection actually works — without ever exposing the stored credential.

## Requirements

### Requirement: Connection Registration Persists Against the Active Tenant

The system SHALL allow registering a `Conexion` record referencing the active tenant resolved for the request, capturing host, port, database name, user, credential, engine (`motor`), and a name, and optionally an `agenteId`. The system SHALL reject a registration request missing any of the required fields, and SHALL reject it when no active tenant can be resolved, before the request reaches any tenant-scoped query. The submitted credential SHALL be enciphered (per `credential-encryption`) before the row is persisted; the column stores the resulting envelope, never the submitted plaintext. WHEN `agenteId` is supplied, it SHALL be persisted on the row and the response SHALL NOT expose any agent secret; WHEN omitted, `agenteId` SHALL be null (direct connection, DEC-115).
(Previously: no `agenteId` field existed; every `Conexion` was a direct connection.)

#### Scenario: Registering a valid connection

- **GIVEN** an active, resolvable tenant and a request supplying host, port, database, user, credential, motor, and name
- **WHEN** the registration endpoint is called
- **THEN** a `Conexion` row SHALL be created referencing that active tenant
- **AND** the response SHALL confirm the created record without echoing the credential value
- **AND** the persisted `credencial` value SHALL be an enciphered envelope, not the submitted plaintext
- **AND** `agenteId` SHALL be null

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

#### Scenario: Registering with the tenant's own agent

- **GIVEN** an active tenant owning an agent
- **WHEN** registration is called with that agent's `agenteId`
- **THEN** the row SHALL be created with that `agenteId`

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

The system MUST NOT include the submitted credential value, the stored enciphered envelope's deciphered plaintext, the stored envelope, or the master key in any test response body, listing response body, error message, or log line, regardless of outcome.
(Previously: covered only test responses, errors and logs; now also covers the `GET /conexiones` listing.)

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

#### Scenario: The listing never exposes the credential

- **GIVEN** a registered connection with a known credential value
- **WHEN** `GET /conexiones` is requested for its tenant
- **THEN** the response body SHALL NOT contain a `credencial` key, the credential value or its envelope
### Requirement: Connectivity Test Is Scoped to the Active Tenant

The connectivity test endpoint SHALL resolve the target `Conexion` only among rows belonging to the request's active tenant. WHEN the named `Conexion` id belongs to a different tenant, or does not exist, the system SHALL respond as though it does not exist and SHALL NOT attempt the probe.

#### Scenario: Testing another tenant's connection

- **GIVEN** tenants A and B, and a `Conexion` belonging to B
- **WHEN** A's active tenant calls the test endpoint naming B's `Conexion` id
- **THEN** the response SHALL report the connection as not found
- **AND** no probe SHALL be attempted against B's stored host/credential
### Requirement: The Agent Reference Is Checked Within the Active Tenant

WHEN `agenteId` is supplied, the system SHALL resolve it only among agents of the active tenant, before creating the row. WHEN it belongs to another tenant or does not exist, the system SHALL respond `404 agente-no-encontrado` and MUST NOT create the row. The check MUST NOT filter on `revocadoEn`, so a revoked agent of the tenant remains bindable and the binding survives re-issue.

#### Scenario: Another tenant's agent

- **GIVEN** tenants A and B, and an agent of B
- **WHEN** A registers a connection with B's `agenteId`
- **THEN** the response SHALL be `404 agente-no-encontrado`
- **AND** no `Conexion` row SHALL be created

#### Scenario: Nonexistent agent

- **GIVEN** an `agenteId` matching no row
- **WHEN** registration is called with it
- **THEN** the response SHALL be `404 agente-no-encontrado`

#### Scenario: Revoked agent of the same tenant

- **GIVEN** an active tenant whose agent is revoked
- **WHEN** registration is called with that `agenteId`
- **THEN** the row SHALL be created

### Requirement: The Agent Foreign Key Restricts Deletion

`Conexion.agenteId` SHALL be a nullable foreign key to `Agente` with explicit `ON DELETE RESTRICT`.

#### Scenario: Deleting a bound agent

- **GIVEN** a `Conexion` referencing an `Agente`
- **WHEN** the `Agente` row is deleted
- **THEN** the database SHALL reject the delete

### Requirement: Listing the Active Tenant's Connections (DEC-132)

The system SHALL expose `GET /conexiones`, scoped to the active tenant, returning only the tenant's connections, each with exactly `id` and `nombre`. The route MUST require `X-Tenant-Id` and MUST NOT be added to the tenant-context exemption allowlist. The result SHALL be capped to a fixed maximum number of rows, with cap value and ordering fixed by design. No other field, including `credencial`, MUST appear in the response.

#### Scenario: Listing own connections

- **GIVEN** tenant A with two connections
- **WHEN** `GET /conexiones` is sent with A's `X-Tenant-Id`
- **THEN** the response SHALL list exactly those two, each with only `id` and `nombre`

#### Scenario: Two tenants

- **GIVEN** tenants A and B, each with connections
- **WHEN** A requests the listing
- **THEN** no row of B SHALL appear

#### Scenario: Missing tenant

- **GIVEN** a request with no `X-Tenant-Id`
- **WHEN** `GET /conexiones` is handled
- **THEN** the response SHALL be `400 tenant-no-indicado`

#### Scenario: Tenant without connections

- **GIVEN** an active tenant with no connections
- **WHEN** the listing is requested
- **THEN** the response SHALL be successful with an empty list

#### Scenario: Row cap

- **GIVEN** a tenant with more connections than the cap
- **WHEN** the listing is requested
- **THEN** no more than the cap SHALL be returned

