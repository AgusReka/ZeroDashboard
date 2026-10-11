# Query Execution Specification (CH-20 delta)

## Purpose
The execution request can name the saved query the editor holds, so the audit records which one ran (DEC-161).

## ADDED Requirements

### Requirement: Optional Saved Query Reference
`POST /consultas/ejecutar` SHALL accept optional `consultaGuardadaId` (string) and `version` (positive integer), both or neither; one without the other SHALL be 400 `solicitud-invalida`. When both are present and the sent `sql` is byte for byte the statement stored for that version of that saved query in the header's tenant, the audit row SHALL carry the id, the version and the saved query's current name. Otherwise (unknown id, another tenant's id, unknown version, different text) the execution SHALL proceed and answer exactly as without them, and the audit row SHALL record it as ad hoc.

#### Scenario: The loaded query runs unchanged
- **GIVEN** saved query "Stock bajo" at version 2
- **WHEN** the request sends its id, version 2 and its exact statement
- **THEN** the audit row names "Stock bajo", version 2

#### Scenario: The operator edited the text
- **WHEN** the request sends the id and version 2 but a different statement
- **THEN** the execution answers as usual and the audit row has no saved query

#### Scenario: Another tenant's saved query
- **WHEN** tenant A sends the id of a saved query of tenant B with its exact text
- **THEN** the execution answers as usual and the audit row has no saved query
