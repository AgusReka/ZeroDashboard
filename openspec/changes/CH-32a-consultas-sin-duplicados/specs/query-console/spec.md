# Query Console Specification (CH-32a delta)

## Purpose
A saved query is created and edited in one pop-up form holding every field (name, description, connection, SQL, parameters); it is saved only after a successful test, and a loaded query is saved only as a new version (DEC-172, DEC-173).

## MODIFIED Requirements

### Requirement: Saving the Current Statement From the Console
The console SHALL save a query only from the query pop-up. With no saved query loaded, its save control «Guardar consulta» SHALL submit the name, description, SQL and parameter declaration to the saved-queries create endpoint. With a saved query loaded, the only save control SHALL be «Guardar como versión N+1», which updates that query (CH-25); no control SHALL create a separate query (DEC-172). Either control SHALL be enabled only while the last «Probar» of exactly the current connection, SQL and parameter declaration succeeded.
(Previously: the create control lived on the screen and created a new query even with a saved query loaded, and nothing required a successful run.)

#### Scenario: Saving the statement currently in the editor
- GIVEN the query pop-up is open with no saved query loaded, a name, a connection and a SQL statement
- WHEN the operator presses «Probar» and the run succeeds, then «Guardar consulta»
- THEN the console SHALL submit a create request with the entered `sql` and `nombre`
- AND on success the console SHALL confirm the statement was saved and close the pop-up

#### Scenario: A loaded query cannot be saved as a copy
- GIVEN a saved query is loaded in the pop-up
- THEN «Guardar consulta» SHALL NOT be offered and «Guardar como versión N+1» SHALL be

#### Scenario: Saving needs a passing test of the current content
- GIVEN the last «Probar» succeeded
- WHEN the operator edits the SQL, the parameters or the connection
- THEN the save control SHALL be disabled until «Probar» succeeds again

## ADDED Requirements

### Requirement: Create and Edit Forms Open in a Pop-up (DEC-173)
In the console, every form that creates or modifies a record SHALL open in a pop-up over the screen (`.zd-dialog` on `.zd-dialog-backdrop`), holding every field of the record, with a title, the main action (verb + object) and «Cancelar» at its foot. «Cancelar» and the Escape key SHALL close it without sending anything; when there are unsaved changes they SHALL first ask «Descartar cambios». Such a form SHALL NOT be rendered inline above or below a table. Read-only detail (version history, template detail) stays in the side panel; inline confirmations of destructive actions are outside this rule.

#### Scenario: Cancelling a form with no changes
- GIVEN a create or edit pop-up is open and nothing was changed
- WHEN the operator presses «Cancelar»
- THEN the pop-up closes and no request is sent

#### Scenario: Cancelling a form with changes
- GIVEN the operator changed a field
- WHEN «Cancelar» is pressed
- THEN the pop-up asks «Descartar cambios» and stays open until that is confirmed

### Requirement: Query Screen and Query Pop-up (DEC-172, DEC-173)
The Consultas screen SHALL show a page header with «Nueva consulta» and the saved queries list, each entry with «Abrir» and «Versiones». «Nueva consulta» SHALL open the query pop-up empty, titled «Nueva consulta»; «Abrir» SHALL open it with that query loaded, titled with its name and «versión N». The pop-up SHALL hold, in order: name, description, connection, SQL, parameters (declaration and test values) and, for a loaded query, the version note; and the actions «Probar», the save control and «Cancelar». «Probar» SHALL run the statement against the chosen connection and show the result, paginated, inside the pop-up. The pop-up SHALL close on a successful save and on a tenant switch. The version history SHALL open in a wide side panel.

#### Scenario: Writing and testing a new query
- WHEN the operator presses «Nueva consulta», chooses a connection, writes a statement and presses «Probar»
- THEN the result appears inside the pop-up and «Guardar consulta» becomes enabled once a name is typed

#### Scenario: Opening a saved query
- GIVEN saved query «Stock bajo» at version 3
- WHEN the operator presses «Abrir» on it
- THEN the pop-up is titled «Stock bajo · versión 3», holds its name, description, SQL and parameter declaration, keeps the last chosen connection, and offers «Guardar como versión 4»

### Requirement: Connection Picker
The connection in the query pop-up SHALL be chosen from a list of the active tenant's connections (`GET /conexiones`), each shown by its name and a short id (as in the automation wizard) with the full id as the value. It SHALL be loaded when the active tenant is set and when the Consultas screen is shown, with loading, empty (pointing to Conexiones), truncated and error («Reintentar») states. The connection is used to test and is not saved with the query (DEC-11). The last choice SHALL be kept when another query is opened. «Probar» with no connection chosen SHALL say «Elegí una conexión para ejecutar» and send nothing.

#### Scenario: Picking a connection
- GIVEN the tenant has connections "food-store" and "replica-b"
- WHEN the operator opens the query pop-up
- THEN the picker lists both by name and short id, and «Probar» sends the chosen one's id as `conexionId`

#### Scenario: No connection chosen
- WHEN the operator presses «Probar» without choosing a connection
- THEN the console says «Elegí una conexión para ejecutar» and sends no execution request
