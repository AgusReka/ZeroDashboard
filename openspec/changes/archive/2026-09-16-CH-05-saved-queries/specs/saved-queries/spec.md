# Saved Queries Specification

## Purpose

Persisting a named, optionally described SQL text for the tenant resolved server-side (DEC-10, DEC-11), and retrieving it by list or by id. There is no update or delete route; a saved query is immutable once created and carries no relation to any specific `Conexion` — CH-02's schema is used as-is, with no migration.

## Requirements

### Requirement: Creating a Saved Query

The system SHALL persist a saved query for the tenant resolved server-side (`prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' } })`), never from a client-supplied value, storing `nombre`, `sql`, and an optional `descripcion`. WHEN no tenant exists, the system SHALL respond `503 tenant-no-inicializado` instead of creating a row.

#### Scenario: Creating a valid saved query

- GIVEN a seeded tenant and a request with a non-empty `nombre` and a non-empty `sql`
- WHEN the create request is submitted
- THEN the response SHALL be `201` with the persisted `id`, `nombre`, `descripcion`, `sql`, `creadaEn`, `actualizadaEn`
- AND the row SHALL be scoped to the resolved tenant

#### Scenario: Saving a query with a name already in use

- GIVEN a saved query already persisted with `nombre` "ventas-mes"
- WHEN a second, valid create request is submitted with the same `nombre` "ventas-mes"
- THEN the response SHALL be `201` and both rows SHALL persist independently
- AND the system SHALL NOT reject the request for name duplication, matching the unenforced `Conexion.nombre` precedent (no uniqueness constraint anywhere in the schema)

### Requirement: Creation Rejects Invalid Input

The system SHALL validate the create request body against a strict JSON Schema (`additionalProperties:false`), requiring a non-empty `nombre` and a `sql` that is non-empty after trimming leading/trailing whitespace, and an optional nullable `descripcion`. WHEN validation fails, the system SHALL respond `400 solicitud-invalida` with the field paths (`campos`) that failed, per the `camposInvalidos()` convention, and SHALL create no row.

#### Scenario: Missing nombre

- GIVEN a create request body with `sql` but no `nombre`
- WHEN the request is submitted
- THEN the response SHALL be `400` with `error: 'solicitud-invalida'` and `campos` including the `nombre` path
- AND no row SHALL be created

#### Scenario: Missing sql

- GIVEN a create request body with `nombre` but no `sql`
- WHEN the request is submitted
- THEN the response SHALL be `400` with `campos` including the `sql` path
- AND no row SHALL be created

#### Scenario: sql that is empty after trimming

- GIVEN a create request body with `sql` consisting only of whitespace characters
- WHEN the request is submitted
- THEN the response SHALL be `400` with `campos` including the `sql` path
- AND no row SHALL be created

#### Scenario: Unknown property in the request body

- GIVEN a create request body containing a property not defined by the schema
- WHEN the request is submitted
- THEN the response SHALL be `400` with `campos` including the unknown property's path
- AND no row SHALL be created

#### Scenario: tenantId supplied in the request body

- GIVEN a create request body that includes a `tenantId` property
- WHEN the request is submitted
- THEN the response SHALL be `400` with `campos` including the `tenantId` path, because `tenantId` is not an accepted schema property
- AND the persisted tenant SHALL always be the one resolved server-side, never a submitted value

### Requirement: Listing Saved Queries Returns Metadata Only

The system SHALL return every saved query belonging to the resolved tenant as a list of metadata rows containing only `id`, `nombre`, `descripcion`, `creadaEn`, and `actualizadaEn`. The `sql` field SHALL NOT appear in list rows; retrieving a specific row's `sql` requires the get-by-id request below.

#### Scenario: Listing metadata-only rows

- GIVEN two saved queries persisted for the resolved tenant
- WHEN the list request is submitted
- THEN the response SHALL contain one entry per saved query with `id`, `nombre`, `descripcion`, `creadaEn`, `actualizadaEn`
- AND no entry SHALL contain a `sql` field

#### Scenario: Listing when no saved query exists

- GIVEN the resolved tenant has no saved query
- WHEN the list request is submitted
- THEN the response SHALL be `200` with an empty list

### Requirement: Retrieving a Saved Query by Id

The system SHALL return the full saved query — `id`, `nombre`, `descripcion`, `sql`, `creadaEn`, `actualizadaEn` — for a given id belonging to the resolved tenant. WHEN no saved query with that id exists, the system SHALL respond `404` with a legible error, not a raw driver error.

#### Scenario: Retrieving an existing saved query

- GIVEN a saved query persisted for the resolved tenant
- WHEN a get-by-id request is submitted with its `id`
- THEN the response SHALL be `200` with the full record including `sql`

#### Scenario: Retrieving an unknown id

- GIVEN no saved query exists with the requested `id`
- WHEN a get-by-id request is submitted
- THEN the response SHALL be `404` with a legible error body
- AND the response SHALL NOT contain a raw driver error or stack trace
