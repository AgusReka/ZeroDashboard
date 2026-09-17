# Delta for Connection Registration

## MODIFIED Requirements

### Requirement: Connection Registration Persists Against the Active Tenant

The system SHALL allow registering a `Conexion` record referencing the active tenant resolved for the request, capturing host, port, database name, user, credential, engine (`motor`), and a name. The system SHALL reject a registration request missing any of these fields, and SHALL reject it when no active tenant can be resolved, before the request reaches any tenant-scoped query.
(Previously: the record was always created against the single seeded `Tenant`, resolved by `tenant.findFirst`, with no active-tenant concept.)

#### Scenario: Registering a valid connection

- **GIVEN** an active, resolvable tenant and a request supplying host, port, database, user, credential, motor, and name
- **WHEN** the registration endpoint is called
- **THEN** a `Conexion` row SHALL be created referencing that active tenant
- **AND** the response SHALL confirm the created record without echoing the credential value

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

## RENAMED Requirements

### Requirement: Connection Registration Persists Against the Seeded Tenant → Connection Registration Persists Against the Active Tenant

(Reason: this change replaces the single-seeded-tenant model with an active-tenant resolution concept, so the requirement name no longer describes the resulting behavior.)
(Migration: none — the MODIFIED block above carries the full updated requirement text and scenarios.)

## ADDED Requirements

### Requirement: Connectivity Test Is Scoped to the Active Tenant

The connectivity test endpoint SHALL resolve the target `Conexion` only among rows belonging to the request's active tenant. WHEN the named `Conexion` id belongs to a different tenant, or does not exist, the system SHALL respond as though it does not exist and SHALL NOT attempt the probe.

#### Scenario: Testing another tenant's connection

- **GIVEN** tenants A and B, and a `Conexion` belonging to B
- **WHEN** A's active tenant calls the test endpoint naming B's `Conexion` id
- **THEN** the response SHALL report the connection as not found
- **AND** no probe SHALL be attempted against B's stored host/credential
