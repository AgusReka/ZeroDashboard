# Query Console Specification (CH-20 delta)

## Purpose
The console tells the server which saved query it is running, when the editor still holds it unchanged (DEC-161).

## ADDED Requirements

### Requirement: Execution Names the Loaded Saved Query
When a saved query is loaded and the editor's statement is still exactly the loaded one, every `POST /consultas/ejecutar` the console sends SHALL include that query's `consultaGuardadaId` and `version`. When no query is loaded, or the operator changed the statement, or the tenant changed, the request SHALL include neither.

#### Scenario: Running the loaded query
- **GIVEN** saved query q-1 at version 3 loaded in the editor
- **WHEN** the operator runs it without editing
- **THEN** the request body carries `consultaGuardadaId` "q-1" and `version` 3

#### Scenario: Running after an edit
- **WHEN** the operator changes the statement and runs it
- **THEN** the request body carries neither field
