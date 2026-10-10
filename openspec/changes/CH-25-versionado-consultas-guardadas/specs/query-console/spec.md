# Query Console Specification (CH-25 delta)

## Purpose
Show the history of a saved query in the console, compare two versions as plain text, restore one, and save the editor's content as a new version. Decisions: DEC-146 to DEC-150. Console only (rule 2).

## ADDED Requirements

### Requirement: Versions Panel
Each entry of the saved-query list SHALL offer a "Versiones" action that opens a panel with that query's history: version number, date, note and, for the current one, a "Vigente" state shown with an icon and text, never color alone. The panel SHALL show a loading state, the text "Esta es la versión inicial" when there is a single version, and a plain-text error when the request fails. Every value SHALL be written as text. Opening the panel of another query, or switching tenant, SHALL close the previous panel and clear its content.

#### Scenario: A query with history
- **GIVEN** a saved query with three versions
- **WHEN** the operator opens "Versiones"
- **THEN** three rows appear, newest first, and only the newest says "Vigente"

#### Scenario: A query never edited
- **WHEN** the operator opens "Versiones" on a query with one version
- **THEN** the panel says "Esta es la versión inicial" and offers no restore

#### Scenario: Tenant switch
- **GIVEN** an open panel
- **WHEN** the operator switches tenant
- **THEN** the panel is closed and holds no row of the previous tenant

### Requirement: Compare With the Current Version
Each non-current row SHALL offer "Comparar con la actual", which reads that version and the current one and shows them side by side as two plain-text blocks (name, description, statement and declared parameters). No difference is computed or highlighted (DEC-149).

#### Scenario: Compare
- **WHEN** the operator compares version 2 with the current version 5
- **THEN** two blocks are shown, one titled with version 2 and one with version 5, each with its own statement as text

#### Scenario: A hostile statement
- **GIVEN** a version whose statement contains markup
- **THEN** it is shown as text and never interpreted

### Requirement: Restore With Confirmation
"Restaurar" SHALL ask for confirmation inside the panel with a button that repeats the action and the object («Restaurar versión 2») and a cancel button, never "Sí" or "Aceptar". Confirming SHALL send `POST .../versiones/<n>/restaurar` with the optional note, refresh the panel and the saved-query list, and say that a new version was created.

#### Scenario: Confirm
- **WHEN** the operator presses Restaurar on version 2 and confirms
- **THEN** exactly one restore request is sent for version 2 and the panel shows the new version as "Vigente"

#### Scenario: Cancel
- **WHEN** the operator cancels the confirmation
- **THEN** no request is sent

#### Scenario: Refusals
- **WHEN** the server answers 404, 409 `version-vigente` or any other error
- **THEN** the panel shows the reason in plain text and keeps the previous rows

### Requirement: Save as a New Version
After a saved query is loaded into the editor, the console SHALL offer "Guardar como nueva versión" with an optional note field. It SHALL send `PUT /consultas-guardadas/<id>` with the editor's name, description, statement, declared parameters and the note, exactly as the create sends them, and then refresh the list. A `409 sin-cambios` SHALL read "No hay cambios respecto de la versión vigente" and a `409 conflicto-de-edicion` SHALL ask to reload the query. The section's help text SHALL no longer say that a saved query cannot be edited, and SHALL still say it cannot be deleted.

#### Scenario: Save a change
- **GIVEN** a saved query loaded in the editor and its statement modified
- **WHEN** the operator saves it as a new version with the note "Agrega filtro"
- **THEN** one PUT request is sent for that query's id with the editor's content and the note, and the list is refreshed

#### Scenario: Nothing loaded
- **WHEN** no saved query has been loaded
- **THEN** the save-as-version action is not offered

#### Scenario: Switching tenant forgets the loaded query
- **WHEN** the operator switches tenant
- **THEN** the loaded query is forgotten and the action disappears
