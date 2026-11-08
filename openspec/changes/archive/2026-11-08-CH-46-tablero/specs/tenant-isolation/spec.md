# Tenant Isolation Specification (CH-46 delta)

## ADDED Requirements

### Requirement: Tablero Is Tenant-Scoped (DEC-199)
`Tablero` SHALL be in `MODELOS_AISLADOS` (DEC-13), so every read and write is filtered by the active tenant and a create takes it from the context. `GET /tablero` and `PUT /tablero` SHALL NOT be exempt from the tenant context, and the tenant SHALL never come from the body.

#### Scenario: Two tenants never see each other's dashboard
- GIVEN tenants A and B, each with its own dashboard and connection
- WHEN `GET /tablero` is sent with tenant A
- THEN only A's connection and reports SHALL be answered
- AND a `PUT /tablero` with tenant A SHALL leave B's dashboard unchanged

#### Scenario: Another tenant's connection is refused
- GIVEN tenant A selected
- WHEN `PUT /tablero` names B's connection
- THEN the answer SHALL be 404 `conexion-no-encontrada`

#### Scenario: Dashboard routes require a tenant
- WHEN `GET /tablero` is sent with no `x-tenant-id`
- THEN the answer SHALL be `400 tenant-no-indicado`

### Requirement: Report Use Is the Single Audited Unscoped Read of Tablero (DEC-199)
Exactly two operations SHALL read `Tablero` without a tenant: whether a report is on any dashboard, and the replace of a report only if it is on none. They SHALL be typed methods of the isolation extension over the raw client, like the template use of DEC-191. They SHALL return a boolean, `'no-encontrado'`, `'en-uso'` or the replaced report: never a dashboard, a tenant id, a connection or a count. The report catalog routes SHALL reach them only through a port built in `src/app/rutas.ts`.

#### Scenario: The answer reveals only a boolean
- GIVEN report "r-1" on tenant B's dashboard
- WHEN the use read runs for "r-1"
- THEN it SHALL return `true` and nothing else

#### Scenario: No other unscoped access
- WHEN the code base is searched for unscoped access to `Tablero`
- THEN only those two operations SHALL be found
