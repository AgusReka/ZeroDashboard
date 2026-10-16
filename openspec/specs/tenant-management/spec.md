# Tenant Management Specification

## Purpose

Creating, listing, and logically deactivating a `Tenant` (T1). Deactivation freezes a tenant completely (DEC-14): hidden from the active listing, every subsequent operation naming it rejected, existing rows preserved for audit. No reactivation and no tenant editing are provided.

## Requirements

### Requirement: Tenant Registration (Alta)

The system SHALL allow creating a `Tenant` record capturing at least a `nombre`. A newly created tenant SHALL be active (`activo: true`) by default. The system SHALL reject a request missing `nombre`.

#### Scenario: Registering a valid tenant

- GIVEN a request with a non-empty `nombre`
- WHEN the tenant creation endpoint is called
- THEN a `Tenant` row SHALL be created with `activo: true`
- AND the response SHALL confirm the created record

#### Scenario: Rejecting an incomplete registration

- GIVEN a request missing `nombre`
- WHEN the creation endpoint is called
- THEN the request SHALL be rejected
- AND no `Tenant` row SHALL be created

### Requirement: Listing Active Tenants

The system SHALL list tenants, returning only active (`activo: true`) tenants by default.

#### Scenario: Listing existing active tenants

- GIVEN two active tenants exist
- WHEN the listing endpoint is called
- THEN both SHALL appear in the response

#### Scenario: Deactivated tenant excluded from the default listing

- GIVEN a tenant that has been deactivated
- WHEN the listing endpoint is called
- THEN that tenant SHALL NOT appear in the default listing

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

### Requirement: No Reactivation or Editing

The system SHALL NOT provide a mechanism to reactivate a deactivated tenant, and SHALL NOT provide tenant-editing beyond deactivation.

#### Scenario: No reactivation endpoint exists

- GIVEN a deactivated tenant
- WHEN the available tenant routes are inspected
- THEN none of them SHALL set `activo` back to `true`
