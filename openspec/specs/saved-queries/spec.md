# Saved Queries Specification

## Purpose

Persisting a named, optionally described SQL text for the tenant resolved server-side (DEC-10, DEC-11), and retrieving it by list or by id. Since CH-25 (DEC-146 to DEC-150) it can be edited, and every edit or restore keeps the previous state as a version; there is still no delete route, no version is ever deleted, and a saved query carries no relation to any specific `Conexion`.
(Previously: there was no update route; a saved query was immutable once created.) Since CH-11 it also stores its parameter declaration in the `parametros` JSON column (DEC-55, migration `20260927000000_consulta_parametros`).

## Requirements

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

### Requirement: Creation Rejects an Invalid Parameter Declaration Shape

WHEN the `parametros` field fails the `query-parameters` declaration-shape check (unknown `tipo`, missing `nombre`, or a malformed entry), the system SHALL respond `400 solicitud-invalida` naming the offending entry and SHALL create no row.

#### Scenario: Unknown tipo in a saved declaration

- GIVEN a create request whose `parametros` entry has `tipo: "identificador"`
- WHEN the request is submitted
- THEN the response SHALL be `400` naming the offending entry
- AND no row SHALL be created

## ADDED Requirements (CH-25, versioning, story B4)

### Requirement: Version Columns and History Table
`ConsultaGuardada` SHALL carry `version` (integer, 1 for a query never edited) and `nota` (text, null) describing how the current version was reached. A new tenant-scoped table SHALL hold each previous state with its `version`, `nombre`, `descripcion`, `sql`, `parametros`, `nota` and `desde` (the instant that state became current), unique per `(consultaGuardadaId, version)`. The table SHALL be registered in the isolation extension.

#### Scenario: Existing queries are valid with no backfill
- **GIVEN** a query saved before this change
- **WHEN** it is read
- **THEN** its `version` is 1 and its history is empty

### Requirement: Optional Note
A `nota` SHALL be a string of at most 500 characters. A blank or absent note SHALL be stored as null. A non-string or longer note SHALL be refused with 400 naming `/nota`.

#### Scenario: Note rules
- **WHEN** an edit sends `nota: "   "`
- **THEN** the stored note is null
- **WHEN** it sends a 501-character note or the number 5
- **THEN** the answer is 400 with `/nota` in `campos` and nothing is stored

### Requirement: Edit a Saved Query
`PUT /consultas-guardadas/:id` SHALL accept a strict JSON body equal to the create body plus an optional `nota`, with no other key, and SHALL apply the same validations as the create (non-empty statement once sanitized, parameter declaration valid and coherent with the statement). In one transaction it SHALL archive the current state into the history, update the row with the new content and note, and increment `version`. The answer SHALL be 200 `{ consultaGuardada }` including `version`. The statement SHALL be stored verbatim.

#### Scenario: A valid edit creates a version
- **GIVEN** a query at version 1
- **WHEN** `PUT` sends a different statement and the note "Agrega filtro por depósito"
- **THEN** the answer is 200 with `version` 2, the row holds the new content and note, and the history holds one entry with version 1 and the previous content

#### Scenario: An identical edit creates nothing
- **WHEN** `PUT` sends the same name, description, statement and parameters as the current ones, with or without a note
- **THEN** the answer is 409 `sin-cambios` and neither `version` nor the history changes

#### Scenario: Invalid content is refused as in the create
- **WHEN** `PUT` sends an empty statement, an undeclared `:parametro`, or an unknown parameter type
- **THEN** the answer is 400 with the same `campos` and `problemas` the create gives, and nothing is stored

#### Scenario: Forbidden keys
- **WHEN** `PUT` sends `tenantId`, `version`, `id`, `creadaEn` or an unknown key
- **THEN** the answer is 400 and nothing is stored

#### Scenario: Unknown or foreign id
- **GIVEN** a saved query of tenant B
- **WHEN** tenant A's request edits that id
- **THEN** the answer is 404 `consulta-guardada-no-encontrada`, identical to an unknown id, and tenant B's query and history are unchanged

#### Scenario: A conflicting concurrent edit forks nothing
- **GIVEN** a history entry for the query's current version already exists
- **WHEN** an edit tries to archive that same version
- **THEN** the answer is 409 `conflicto-de-edicion` and the row is unchanged

### Requirement: List the Versions
`GET /consultas-guardadas/:id/versiones` SHALL return `{ versiones, truncado }`, newest first, each item `{ version, fecha, nota, esActual }` and never the statement. The current version SHALL come from the row (`fecha` is its `actualizadaEn`) and the previous ones from the history (`fecha` is `desde`). The list SHALL be capped at `LIMITE_LISTADO`, the current version always included.

#### Scenario: A query never edited
- **WHEN** its versions are listed
- **THEN** the list has one item with `version` 1 and `esActual` true

#### Scenario: Order and flags
- **GIVEN** a query edited twice
- **THEN** the items are versions 3, 2, 1 and only version 3 has `esActual` true

#### Scenario: Foreign tenant
- **WHEN** another tenant lists the versions of this id
- **THEN** the answer is 404 `consulta-guardada-no-encontrada`

### Requirement: Read One Version
`GET /consultas-guardadas/:id/versiones/:version` SHALL return that version's full content (`nombre`, `descripcion`, `sql`, `parametros`, `nota`, `fecha`, `esActual`), the current one included. A `:version` that is not a positive integer or does not exist SHALL answer 404 `version-no-encontrada`.

#### Scenario: Unknown versions
- **WHEN** the version is `0`, `-1`, `1.5`, `abc` or higher than the current one
- **THEN** the answer is 404 `version-no-encontrada`

### Requirement: Restore a Version
`POST /consultas-guardadas/:id/versiones/:version/restaurar` SHALL accept `{ nota? }`, archive the current state, copy the chosen version's content onto the row byte for byte, increment `version` and store the note. It SHALL NOT delete or alter any history entry. Restoring the current version SHALL answer 409 `version-vigente`. There SHALL be no route that deletes a version.

#### Scenario: Restore creates a new version
- **GIVEN** a query at version 5
- **WHEN** version 2 is restored
- **THEN** the row has version 6 with the content of version 2, the history keeps versions 1 to 5, and listing shows six versions

#### Scenario: The statement is copied byte for byte
- **GIVEN** a version whose statement ends in `;` and contains tabs and CRLF
- **WHEN** it is restored
- **THEN** the stored statement equals it exactly

#### Scenario: Restoring the current version
- **WHEN** the current version is restored
- **THEN** the answer is 409 `version-vigente` and nothing changes

#### Scenario: Foreign tenant
- **WHEN** another tenant restores a version of this id
- **THEN** the answer is 404 and nothing changes

### Requirement: Tenant Scope
Every route above SHALL require the tenant header like the other saved-query routes, and the history table SHALL be reachable only through the scoped client.

#### Scenario: Missing header
- **WHEN** any of the four routes is called without `X-Tenant-Id`
- **THEN** the answer is 400 `tenant-no-indicado`
