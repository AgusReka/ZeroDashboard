# Delta for Query Execution

## ADDED Requirements

### Requirement: Connection Lookup for Execution Is Scoped to the Active Tenant

Before executing a submitted statement, the system SHALL resolve the target `Conexion` only among rows belonging to the request's active tenant. WHEN the named `conexionId` belongs to a different tenant, or does not exist, the system SHALL respond as though it does not exist and SHALL NOT execute any statement against it.

#### Scenario: Executing against another tenant's connection

- **GIVEN** tenants A and B, and a `Conexion` belonging to B
- **WHEN** A's active tenant submits an execution request naming B's `conexionId`
- **THEN** the response SHALL report the connection as not found
- **AND** no statement SHALL execute against B's target database

#### Scenario: Executing against the active tenant's own connection is unaffected

- **GIVEN** a registered, reachable `Conexion` belonging to the active tenant
- **WHEN** a valid `SELECT` statement is submitted naming that `conexionId`
- **THEN** execution SHALL proceed exactly as before this change (CH-04/CH-05 behavior preserved for a single active tenant)
