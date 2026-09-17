# Delta for Saved Queries

## MODIFIED Requirements

### Requirement: Creating a Saved Query

The system SHALL persist a saved query for the active tenant resolved for the request, never from a client-supplied value, storing `nombre`, `sql`, and an optional `descripcion`. WHEN no active tenant can be resolved, the system SHALL reject the request before creating a row.
(Previously: the tenant was always resolved via `prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' } })`, with no active-tenant concept, responding `503 tenant-no-inicializado` when none existed.)

#### Scenario: Creating a valid saved query

- GIVEN an active, resolvable tenant and a request with a non-empty `nombre` and a non-empty `sql`
- WHEN the create request is submitted
- THEN the response SHALL be `201` with the persisted `id`, `nombre`, `descripcion`, `sql`, `creadaEn`, `actualizadaEn`
- AND the row SHALL be scoped to the active tenant

#### Scenario: Saving a query with a name already in use

- GIVEN a saved query already persisted with `nombre` "ventas-mes" for the active tenant
- WHEN a second, valid create request is submitted with the same `nombre`
- THEN the response SHALL be `201` and both rows SHALL persist independently

#### Scenario: No active tenant resolvable

- GIVEN a create request with no resolvable active tenant
- WHEN the request is submitted
- THEN the request SHALL be rejected
- AND no row SHALL be created

### Requirement: Listing Saved Queries Returns Metadata Only

The system SHALL return every saved query belonging to the active tenant as a list of metadata rows containing only `id`, `nombre`, `descripcion`, `creadaEn`, `actualizadaEn`. The `sql` field SHALL NOT appear in list rows. A saved query belonging to a different tenant SHALL NOT appear in the list.
(Previously: the listing returned every `ConsultaGuardada` row in the database with no tenant filter at all.)

#### Scenario: Listing metadata-only rows for the active tenant

- GIVEN two saved queries persisted for the active tenant
- WHEN the list request is submitted
- THEN the response SHALL contain one entry per saved query with `id`, `nombre`, `descripcion`, `creadaEn`, `actualizadaEn`
- AND no entry SHALL contain a `sql` field

#### Scenario: Another tenant's saved queries are excluded

- GIVEN tenants A and B, each with saved queries
- WHEN A's active tenant requests the list
- THEN none of B's saved queries SHALL appear

#### Scenario: Listing when no saved query exists

- GIVEN the active tenant has no saved query
- WHEN the list request is submitted
- THEN the response SHALL be `200` with an empty list

### Requirement: Retrieving a Saved Query by Id

The system SHALL return the full saved query for a given id belonging to the active tenant. WHEN no saved query with that id exists for the active tenant — including when the id exists but belongs to a different tenant — the system SHALL respond `404` with a legible error, not a raw driver error.
(Previously: any existing id resolved regardless of owning tenant, since no tenant filter was applied.)

#### Scenario: Retrieving an existing saved query

- GIVEN a saved query persisted for the active tenant
- WHEN a get-by-id request is submitted with its `id`
- THEN the response SHALL be `200` with the full record including `sql`

#### Scenario: Retrieving another tenant's saved query

- GIVEN tenants A and B, and a saved query belonging to B
- WHEN A's active tenant requests B's saved query id
- THEN the response SHALL be `404`
- AND the response SHALL NOT contain B's `sql` or other fields

#### Scenario: Retrieving an unknown id

- GIVEN no saved query exists with the requested `id`
- WHEN a get-by-id request is submitted
- THEN the response SHALL be `404` with a legible error body
