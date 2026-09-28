# Delta for Tenant Isolation

## ADDED Requirements

### Requirement: Plantilla Is Outside the Structural Tenant Filter (DEC-61)

`Plantilla` SHALL NOT be added to the tenant-scoped model allowlist (`MODELOS_AISLADOS`, DEC-13); its reads and writes SHALL proceed without any active-tenant filter. Its catalog routes (create, list, get, replace) SHALL be added to the tenant-context exemption allowlist, matched by exact method and route pattern. The test route (`POST /plantillas/:id/prueba`) SHALL NOT be added to that exemption: it resolves a tenant-owned `Conexion` and therefore SHALL require an active tenant like any other scoped route.

#### Scenario: Catalog routes work without any tenant header

- GIVEN a request to create, list, get, or replace a `Plantilla`
- WHEN it is sent with no `x-tenant-id` header
- THEN it SHALL succeed, unaffected by the absence of a tenant

#### Scenario: Test route still requires a resolvable active tenant

- GIVEN an existing `Plantilla`
- WHEN `POST /plantillas/:id/prueba` is sent with no `x-tenant-id`
- THEN the response SHALL be `400 tenant-no-indicado`
