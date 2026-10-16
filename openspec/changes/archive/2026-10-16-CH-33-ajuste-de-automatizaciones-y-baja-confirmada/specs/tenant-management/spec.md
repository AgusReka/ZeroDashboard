# Tenant Management Specification (CH-33 delta)

## Purpose
A tenant's baja cannot be undone (DEC-14), so the API requires the tenant's name with it (DEC-175): a script or a direct call cannot deactivate the wrong tenant by mistake.

## MODIFIED Requirements

### Requirement: Logical Deactivation Fully Freezes a Tenant (DEC-14)

The system SHALL allow deactivating a tenant, setting `activo` to `false`, through `POST /tenants/:id/baja` with the body `{ "nombre": <the tenant's name> }`. A body without `nombre`, with a non-string `nombre`, or with any other key SHALL be refused with `400 solicitud-invalida` before any read. An unknown id SHALL answer `404 tenant-no-encontrado` and an already-inactive tenant `409 tenant-desactivado`, both before the name is compared. A `nombre` that is not exactly the stored name (no trimming, no case folding) SHALL answer `409 confirmacion-no-coincide` and change nothing. Deactivation SHALL NOT delete or alter the tenant's existing `Conexion` or `ConsultaGuardada` rows. WHEN any subsequent request resolves to a deactivated tenant, the system SHALL reject it before any handler logic that would read or write that tenant's data executes.
(Previously: the route took no body; any call on an active tenant deactivated it.)

#### Scenario: Deactivating an active tenant preserves its rows

- GIVEN an active tenant named "Almacén Don Tito" with existing `Conexion` and `ConsultaGuardada` rows
- WHEN `POST /tenants/:id/baja` is called with `{ "nombre": "Almacén Don Tito" }`
- THEN its `activo` flag SHALL become `false`
- AND its existing rows SHALL remain unchanged in the database

#### Scenario: A name that does not match deactivates nothing

- GIVEN an active tenant named "Almacén Don Tito"
- WHEN the baja is called with `{ "nombre": "almacén don tito" }` or `{ "nombre": "Almacén Don Tito " }`
- THEN the response SHALL be `409 confirmacion-no-coincide`
- AND the tenant SHALL stay active and its agent sockets SHALL stay open

#### Scenario: A baja without the name is refused

- GIVEN an active tenant
- WHEN the baja is called with no body, with `{}`, or with `{ "nombre": "…", "activo": false }`
- THEN the response SHALL be `400 solicitud-invalida` and the tenant SHALL stay active

#### Scenario: An operation naming a deactivated tenant is rejected

- GIVEN a deactivated tenant
- WHEN a request resolves that tenant as its operation target or active tenant
- THEN the request SHALL be rejected before reaching any tenant-scoped read or write

#### Scenario: Deactivating an already-inactive tenant is safe

- GIVEN a tenant already deactivated
- WHEN the deactivation endpoint is called again for it, with its name
- THEN the system SHALL respond `409 tenant-desactivado` without creating a duplicate or contradictory state
