# Delta for Domain Data Model

## ADDED Requirements

### Requirement: Client User Model (Usuario) (DEC-133)

The application database SHALL include a `Usuario` table for client users (P2). Each row MUST belong to exactly one `Tenant` via a foreign key `tenantId`, MUST have a unique `correo` (email), a `claveHash` string containing the scrypt salt and hash, an optional `nombre` string, an `activo` boolean defaulting to `true`, and timestamps `creadoEn` and `actualizadoEn`.

#### Scenario: Creating a client user

- **GIVEN** an active `Tenant`
- **WHEN** a `Usuario` is created with a valid email and hashed password
- **THEN** the record SHALL persist linked to that `tenantId`

#### Scenario: Unique email constraint

- **GIVEN** an existing `Usuario` with email `"admin@tienda.com"`
- **WHEN** attempting to create another `Usuario` with the same email
- **THEN** the database SHALL reject the duplicate

### Requirement: Panel Session Model (SesionPanel) (DEC-134)

The application database SHALL include a `SesionPanel` table. Each row MUST reference a `Usuario` and a `Tenant`, MUST store a SHA-256 `tokenHash` of the session token, an `expiraEn` expiration timestamp, and `creadaEn`.

#### Scenario: Creating a session record

- **GIVEN** an authenticated `Usuario`
- **WHEN** a session is issued
- **THEN** the `SesionPanel` record SHALL persist with the token hash and expiration timestamp
