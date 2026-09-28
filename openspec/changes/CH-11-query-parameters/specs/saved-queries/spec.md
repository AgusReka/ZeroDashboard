# Delta for Saved Queries

## Note on Purpose

The main spec's Purpose statement currently reads "CH-02's schema is used as-is, with no migration." This stops being true: `ConsultaGuardada` gains a JSON column `parametros` (DEC-55), an additive migration with a down path. `sdd-archive` MUST update the Purpose statement to drop the "no migration" claim when merging this delta.

## MODIFIED Requirements

### Requirement: Creating a Saved Query

The system SHALL persist a saved query for the active tenant resolved for the request, never from a client-supplied value, storing `nombre`, `sql`, an optional `descripcion`, and `parametros` — a JSON column holding the `query-parameters` declaration, defaulting to `[]`, validated in the application against the declaration shape and against the `sql` text (unused/undeclared checks apply at create time). WHEN no active tenant can be resolved, the system SHALL reject the request before creating a row.
(Previously: persisted `nombre`, `sql`, and an optional `descripcion` only, with no parameter declaration and no active-tenant concept before that; the tenant was resolved via `prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' } })`, responding `503 tenant-no-inicializado` when none existed.)

#### Scenario: Creating a valid saved query

- GIVEN an active, resolvable tenant and a request with a non-empty `nombre` and a non-empty `sql`
- WHEN the create request is submitted
- THEN the response SHALL be `201` with the persisted `id`, `nombre`, `descripcion`, `sql`, `parametros`, `creadaEn`, `actualizadaEn`
- AND the row SHALL be scoped to the active tenant

#### Scenario: Creating a saved query with a valid declaration

- GIVEN a request whose `sql` contains `:desde` and whose `parametros` declares `desde` as `fecha`
- WHEN the create request is submitted
- THEN the response SHALL be `201` with `parametros` persisted as submitted

#### Scenario: Creating a saved query with an unused or undeclared parameter

- GIVEN a request whose `parametros` and `sql` markers do not match (per `query-parameters`)
- WHEN the create request is submitted
- THEN the response SHALL be `400` naming the offending parameter
- AND no row SHALL be created

#### Scenario: Saving a query with a name already in use

- GIVEN a saved query already persisted with `nombre` "ventas-mes" for the active tenant
- WHEN a second, valid create request is submitted with the same `nombre`
- THEN the response SHALL be `201` and both rows SHALL persist independently

#### Scenario: No active tenant resolvable

- GIVEN a create request with no resolvable active tenant
- WHEN the request is submitted
- THEN the request SHALL be rejected
- AND no row SHALL be created

### Requirement: Retrieving a Saved Query by Id

The system SHALL return the full saved query for a given id belonging to the active tenant, including `parametros`. WHEN no saved query with that id exists for the active tenant — including when the id exists but belongs to a different tenant — the system SHALL respond `404` with a legible error, not a raw driver error.
(Previously: returned the full record without `parametros`; any existing id resolved regardless of owning tenant, since no tenant filter was applied.)

#### Scenario: Retrieving an existing saved query

- GIVEN a saved query persisted for the active tenant with a non-empty `parametros`
- WHEN a get-by-id request is submitted with its `id`
- THEN the response SHALL be `200` with the full record including `sql` and `parametros`

#### Scenario: Retrieving another tenant's saved query

- GIVEN tenants A and B, and a saved query belonging to B
- WHEN A's active tenant requests B's saved query id
- THEN the response SHALL be `404`
- AND the response SHALL NOT contain B's `sql`, `parametros`, or other fields

#### Scenario: Retrieving an unknown id

- GIVEN no saved query exists with the requested `id`
- WHEN a get-by-id request is submitted
- THEN the response SHALL be `404` with a legible error body

## ADDED Requirements

### Requirement: Creation Rejects an Invalid Parameter Declaration Shape

WHEN the `parametros` field fails the `query-parameters` declaration-shape check (unknown `tipo`, missing `nombre`, or a malformed entry), the system SHALL respond `400 solicitud-invalida` naming the offending entry and SHALL create no row.

#### Scenario: Unknown tipo in a saved declaration

- GIVEN a create request whose `parametros` entry has `tipo: "identificador"`
- WHEN the request is submitted
- THEN the response SHALL be `400` naming the offending entry
- AND no row SHALL be created
