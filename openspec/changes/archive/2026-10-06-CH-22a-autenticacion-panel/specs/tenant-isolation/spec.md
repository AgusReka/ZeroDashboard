# Delta for Tenant Isolation

## ADDED Requirements

### Requirement: Panel Tenant Derivation Is Session-Locked (Rule 2, DEC-135)

All panel routes (`/panel/*`, `/api/panel/*`) MUST derive the active tenant exclusively from the validated `SesionPanel` row. The server MUST NOT accept, inspect, or use any client-provided `X-Tenant-Id` header or URL parameter to determine tenant identity on panel routes. Downstream queries on panel routes MUST execute within `AsyncLocalStorage` entered with the session's `tenantId`.

#### Scenario: Panel requests never use X-Tenant-Id

- **GIVEN** an active session for Tenant A and a request to `/api/panel/auth/sesion` sending header `X-Tenant-Id: <id-de-tenant-b>`
- **WHEN** the request is handled
- **THEN** the returned tenant SHALL be Tenant A
- **AND** no data from Tenant B SHALL be accessible

#### Scenario: Two-tenant panel authentication isolation

- **GIVEN** Tenant A with User A and Tenant B with User B
- **WHEN** User A logs in
- **THEN** User A's session SHALL be bound to Tenant A only
- **AND** cannot read or modify any row belonging to Tenant B
