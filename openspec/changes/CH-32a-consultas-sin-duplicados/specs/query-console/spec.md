# Query Console Specification (CH-32a delta)

## Purpose
Saving a loaded query can no longer duplicate it (DEC-172), the editor can be emptied, and the connection is picked from a list.

## MODIFIED Requirements

### Requirement: Saving the Current Statement From the Console
With **no** saved query loaded, the console SHALL provide a control to save the currently entered SQL statement as a saved query, prompting for at least a `nombre` (and optionally a `descripcion`), and SHALL submit it to the saved-queries create endpoint. While a saved query **is** loaded, that control SHALL NOT be shown; the only save control SHALL be "Guardar como nueva versión" (CH-25), which updates the loaded query (DEC-172).
(Previously: the create control was shown, and created a new query, even with a saved query loaded.)

#### Scenario: Saving the statement currently in the editor
- GIVEN the console page is loaded, no saved query is loaded, and a SQL statement is entered in the editor
- WHEN the save control is used and a `nombre` is supplied
- THEN the console SHALL submit a create request with the entered `sql` and `nombre`
- AND on success the console SHALL confirm the statement was saved

#### Scenario: A loaded query cannot be saved as a copy by accident
- GIVEN a saved query is loaded in the editor
- THEN "Guardar consulta" SHALL NOT be shown and "Guardar como nueva versión" SHALL be shown
- AND no create request SHALL be sent for that content

## ADDED Requirements

### Requirement: New Query Action
The saved-queries section SHALL offer "Consulta nueva", which empties the SQL editor, the parameter rows, the name and the description, forgets the loaded query (hiding the version block and showing "Guardar consulta" again), and sends no request. When the editor holds edits not saved — the statement differs from the loaded query's, or with no query loaded it is not empty nor the initial `SELECT 1` — it SHALL first ask inline with «Descartar cambios», and discard only on that confirmation.

#### Scenario: Going back to an empty editor
- GIVEN a saved query is loaded and unchanged
- WHEN the operator presses "Consulta nueva"
- THEN the editor, parameters, name and description are empty, "Guardar consulta" is shown again, and no request is sent

#### Scenario: Unsaved edits are not lost silently
- GIVEN a saved query is loaded and its statement was edited
- WHEN the operator presses "Consulta nueva"
- THEN the console asks «Descartar cambios» and the editor keeps the edit until it is confirmed

### Requirement: Connection Picker
The connection to run a statement against SHALL be chosen from a list of the active tenant's connections (`GET /conexiones`), each shown by its name and a short id (as in the automation wizard) with the full id as the value; it SHALL be loaded when the active tenant is set and when the Consultas screen is shown. With no tenant, or a tenant with no connections, the list SHALL say so. Executing with no connection chosen SHALL say «Elegí una conexión para ejecutar» and send nothing. Loading a saved query SHALL NOT change the chosen connection (DEC-11).

#### Scenario: Picking a connection
- GIVEN the tenant has connections "food-store" and "replica-b"
- WHEN the operator opens Consultas
- THEN the picker lists both by name and short id, and executing sends the chosen one's id as `conexionId`

#### Scenario: No connection chosen
- WHEN the operator executes without choosing a connection
- THEN the console says «Elegí una conexión para ejecutar» and sends no execution request

#### Scenario: Loading a query keeps the connection
- GIVEN "replica-b" is chosen
- WHEN a saved query is loaded
- THEN "replica-b" is still chosen

### Requirement: Create and Edit Forms Open in a Side Panel (DEC-173)
In the console, every form that creates or modifies a record SHALL open in a side panel over the screen (`.zd-drawer`; `.zd-drawer--wide` for long ones), with a header naming the action, the main action (verb + object) and «Cancelar» at its foot. «Cancelar» SHALL close it without sending anything. Such a form SHALL NOT be rendered inline above or below a table. Editors that are the screen's main content (the Consultas SQL, the Mapeo SQL per entity) and inline confirmations of destructive actions are outside this rule.

#### Scenario: Cancelling a form
- GIVEN a create or edit side panel is open with values typed
- WHEN the operator presses «Cancelar»
- THEN the panel closes and no request is sent

### Requirement: Query Screen Path and Save Panel (DEC-172, DEC-173)
The Consultas screen SHALL present, in this order: the page header with «Consulta nueva»; a strip stating the editor's state — «Consulta sin guardar» with «Guardar consulta», or the loaded query's name and «Versión N · vigente» with «Guardar como nueva versión»; the editor (connection, SQL, parameters, «Ejecutar»); the result; and the saved queries list. «Guardar consulta» SHALL open the save side panel titled «Guardar consulta» with the name and description; «Guardar como nueva versión» SHALL open it titled «Guardar como versión N+1» with the name and description of the loaded query and the version note. The panel SHALL close on success and on «Cancelar». The version history SHALL open in a wide side panel.

#### Scenario: Saving a new query from the strip
- GIVEN no saved query is loaded
- WHEN the operator presses «Guardar consulta» in the strip, types a name and confirms in the panel
- THEN the create request is sent and the panel closes

#### Scenario: Saving a version from the strip
- GIVEN saved query «Stock bajo» at version 3 is loaded
- WHEN the operator presses «Guardar como nueva versión»
- THEN the panel is titled «Guardar como versión 4», holds «Stock bajo» in the name field, and offers no way to create a separate query
