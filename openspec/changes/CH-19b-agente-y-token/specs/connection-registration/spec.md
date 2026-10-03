# Delta for Connection Registration

## MODIFIED Requirements

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

## ADDED Requirements

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
