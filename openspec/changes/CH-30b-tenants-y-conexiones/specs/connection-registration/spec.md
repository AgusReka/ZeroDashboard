# Connection Registration Specification (CH-30b delta)

## Purpose
The console's Conexiones screen lists a tenant's connections with their public fields (DEC-167).

## MODIFIED Requirements

### Requirement: Listing the Active Tenant's Connections (DEC-132)

The system SHALL expose `GET /conexiones`, scoped to the active tenant, returning only the tenant's connections, each with exactly the public connection fields the registration answers: `id`, `nombre`, `motor`, `host`, `puerto`, `baseDeDatos`, `usuarioDb`, `soloLectura`, `agenteId`, `creadaEn` and `actualizadaEn`. The route MUST require `X-Tenant-Id` and MUST NOT be added to the tenant-context exemption allowlist. The result SHALL be capped to a fixed maximum number of rows, with cap value and ordering fixed by design. No other field, including `credencial`, MUST appear in the response.
(Previously: each entry had exactly `id` and `nombre`.)

#### Scenario: Listing own connections

- **GIVEN** tenant A with two connections
- **WHEN** `GET /conexiones` is sent with A's `X-Tenant-Id`
- **THEN** the response SHALL list exactly those two, each with exactly the public fields and no `credencial`

#### Scenario: Two tenants

- **GIVEN** tenants A and B, each with connections
- **WHEN** A requests the listing
- **THEN** no row of B SHALL appear

#### Scenario: Missing tenant

- **GIVEN** a request with no `X-Tenant-Id`
- **WHEN** `GET /conexiones` is handled
- **THEN** the response SHALL be `400 tenant-no-indicado`
