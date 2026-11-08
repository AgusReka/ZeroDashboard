# Tenant Isolation Specification (CH-45 delta)

## ADDED Requirements

### Requirement: Reporte Is Outside the Structural Tenant Filter (DEC-183)

`Reporte` SHALL NOT be added to `MODELOS_AISLADOS` (DEC-13), so its reads and writes proceed without an active-tenant filter. Its catalog routes (`GET /reportes`, `POST /reportes`, `GET /reportes/:id`, `PUT /reportes/:id`) SHALL be added to the tenant-context exemption, matched by exact method and route pattern. Their registrar SHALL receive only the `reporte` delegate. The test routes (`POST /reportes/prueba`, `POST /reportes/:id/prueba`) SHALL NOT be exempt: they resolve a tenant-owned `Conexion` and SHALL require an active tenant.

#### Scenario: Catalog routes work without a tenant header
- GIVEN a request to list, get, create or replace a `Reporte`
- WHEN it is sent with no `x-tenant-id` header
- THEN it SHALL succeed, unaffected by the absence of a tenant

#### Scenario: Test routes require an active tenant
- GIVEN an existing `Reporte`
- WHEN `POST /reportes/:id/prueba` is sent with no `x-tenant-id`
- THEN the response SHALL be `400 tenant-no-indicado`

#### Scenario: A look-alike route is not exempt
- WHEN `DELETE /reportes/:id` or `GET /reportes/x/y` is sent with no `x-tenant-id`
- THEN it SHALL be treated as a scoped route

#### Scenario: A report test reads only the active tenant
- GIVEN tenants A and B, each with a connection and approved views
- WHEN the operator, with tenant A selected, tests a report on A's connection
- THEN the rows SHALL come only from A's connection, and B's connection SHALL NOT be dialed
- AND naming B's connection with tenant A selected SHALL answer 404 `conexion-no-encontrada`
