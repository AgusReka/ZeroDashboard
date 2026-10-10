# Saved Queries Specification (CH-25 delta)

## Purpose
Edit a saved query keeping every previous state, list the history and go back to any version. Fulfils story **B4**. Decisions: DEC-146 to DEC-150. Amends DEC-10 for the edit only; there is still no delete.

## ADDED Requirements

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
