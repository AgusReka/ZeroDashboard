# Query Console Specification (CH-53 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-53. `saved-queries` specifies the API, which does not change. DEC-208 amends DEC-173 for the editors with SQL; this delta applies it to Consultas only. CH-56 applies it to Plantillas and Reportes. Pattern ids refer to `.claude/skills/zerodashboard-design/guidelines/admin.md`.

This delta is written against the spec as left by CH-51 and CH-52, which archive first.

## MODIFIED Requirements

### Requirement: Create and Edit Forms Open in a Pop-up (DEC-173, DEC-208)
In the console, every form that creates or modifies a record SHALL open in a pop-up over the screen (`.zd-dialog` on `.zd-dialog-backdrop`). The pop-up holds every field of the record, a title, and at its foot the main action (verb + object) and «Cancelar».

**Coverage.**
- The rule covers «Nuevo tenant», «Nueva conexión», «Nuevo usuario», the automation wizard and the automation adjust.
- **Exception (DEC-208):** the query editor is a subview of the Consultas screen (Query Editor Subview), not a pop-up.

**Opening.**
- A create pop-up SHALL be opened from its screen's page header; an edit pop-up from its record's row.
- On opening, the focus SHALL go to its first field.

**Closing.**
- «Cancelar» and the Escape key SHALL close it without sending anything.
- When there are unsaved changes, they SHALL first ask «Descartar cambios», offering «Descartar cambios» and «Seguir editando».
- A switch of the active tenant SHALL close any open pop-up without asking.

**Placement.** Such a form SHALL NOT be rendered inline above or below a table, nor in a side panel. Read-only detail (version history, template detail) stays in the side panel.

Destructive actions confirm in the graded confirmation pop-up (Graded Confirmation Pop-up). A tenant's baja is confirmed in its own pop-up by typing the name (DEC-175).

(Previously: the query pop-up was covered by this rule.)

#### Scenario: Cancelling a form with no changes
- **GIVEN** a create or edit pop-up is open and nothing was changed
- **WHEN** the operator presses «Cancelar» or Escape
- **THEN** the pop-up closes and no request is sent

#### Scenario: Cancelling a form with changes
- **GIVEN** the operator changed a field
- **WHEN** «Cancelar» or Escape is pressed
- **THEN** the pop-up asks «Descartar cambios» and stays open until that is confirmed
- **AND** «Seguir editando» keeps the pop-up open with the typed values

#### Scenario: Opening puts the focus on the first field
- **WHEN** the operator presses «Nuevo usuario»
- **THEN** the pop-up opens and the focus is on the email field

#### Scenario: A tenant switch closes an open pop-up
- **GIVEN** the «Nueva conexión» pop-up is open with a host typed
- **WHEN** the operator switches the active tenant
- **THEN** the pop-up closes without asking and nothing is sent

### Requirement: Query Screen and Query Pop-up (DEC-172, DEC-208)
The Consultas screen SHALL have two views under one section.

**The list (`#consultas`):** a page header with «Nueva consulta», and the saved queries list (Console Displays the List of Saved Queries).

**The editor (Query Editor Subview):**
- «Nueva consulta» SHALL navigate to `#consultas/nueva`, with the editor empty and the breadcrumb «Consultas › Nueva consulta».
- «Abrir» SHALL navigate to `#consultas/{id}`, with that query loaded and the breadcrumb «Consultas › {nombre} · versión N».
- An address whose id is not a saved query of the active tenant SHALL show «No encontramos esa consulta.» with a link to the list.

**The version history** SHALL open in a wide side panel, from the list and from the editor's header.

(Previously: «Nueva consulta» and «Abrir» opened a query pop-up, titled «Nueva consulta» or «{nombre} · versión N».)

#### Scenario: Opening a saved query
- **GIVEN** saved query «Stock bajo» at version 3
- **WHEN** the operator presses «Abrir» on it
- **THEN** the hash becomes `#consultas/{id}`, the breadcrumb reads «Consultas › Stock bajo · versión 3», the editor holds its name, description, SQL and parameter declaration, keeps the last chosen connection, and offers «Guardar como versión 4»

#### Scenario: An unknown query address
- **WHEN** the hash is `#consultas/no-existe`
- **THEN** the screen says «No encontramos esa consulta.» with a link to the list, and no execution is possible

### Requirement: Result Next to the Execute Button
In the query editor, the status line, the result area and the pager SHALL come right after the editor and «Ejecutar consulta», and before the save controls' reason line. The reference panel SHALL be beside them, not between them.
(Previously: inside the query pop-up, after the query form and before «Probar» and the save control.)

#### Scenario: Result placement
- **WHEN** the console document is served
- **THEN** inside the Consultas section, the editor subview holds the editor, «Ejecutar consulta», the status line and the results table in that order

### Requirement: Saving the Current Statement From the Console
The console SHALL save a query only from the query editor.
- **No saved query loaded:** its save control «Guardar consulta» SHALL submit the name, description, SQL and parameter declaration to the saved-queries create endpoint.
- **A saved query loaded:** the only save control SHALL be «Guardar como versión N+1», which updates that query (CH-25). No control SHALL create a separate query (DEC-172).

Either control SHALL be enabled only while the last «Ejecutar consulta» of exactly the current connection, SQL and parameter declaration succeeded.
- **While disabled:** a line next to it SHALL say why in words (not executed yet, the last run failed, the content changed after the run, or no name).
- **When enabled:** that line SHALL read «Última ejecución: OK · {hora} · {n} filas».

On a successful save, the console SHALL return to the list (`#consultas`) and confirm that the statement was saved.
(Previously: the save lived in the query pop-up, the gate was «Probar», and a successful save closed the pop-up.)

#### Scenario: Saving the statement currently in the editor
- **GIVEN** the editor at `#consultas/nueva` holds a name, a connection and a SQL statement
- **WHEN** the operator presses «Ejecutar consulta» and the run succeeds, then «Guardar consulta»
- **THEN** the console SHALL submit a create request with the entered `sql` and `nombre`
- **AND** on success it SHALL show the list and confirm the statement was saved

#### Scenario: A loaded query cannot be saved as a copy
- **GIVEN** a saved query is loaded in the editor
- **THEN** «Guardar consulta» SHALL NOT be offered and «Guardar como versión N+1» SHALL be

#### Scenario: Saving needs a passing run of the current content
- **GIVEN** the last «Ejecutar consulta» succeeded
- **WHEN** the operator edits the SQL, the parameters or the connection
- **THEN** the save control SHALL be disabled until a run succeeds again

### Requirement: Connection Picker
The connection in the query editor's context bar SHALL be chosen from a list of the active tenant's connections (`GET /conexiones`). Each is shown by its name and a short id, with the full id as the value.

**Loading.** The list SHALL be loaded when the active tenant is set and when the Consultas screen is shown. It SHALL have loading, empty (pointing to Conexiones), truncated and error («Reintentar») states.

**Behaviour.**
- The connection is used to execute and is not saved with the query (DEC-11).
- The last choice SHALL be kept when another query is opened.
- When the tenant has exactly one connection, it SHALL come preselected.
- «Ejecutar consulta» with no connection chosen SHALL say «Elegí una conexión para ejecutar» and send nothing.

(Previously: the picker lived in the query pop-up, and nothing was preselected.)

#### Scenario: Picking a connection
- **GIVEN** the tenant has connections "food-store" and "replica-b"
- **WHEN** the operator opens the editor
- **THEN** the context bar lists both by name and short id, and «Ejecutar consulta» sends the chosen one's id as `conexionId`

#### Scenario: No connection chosen
- **WHEN** the operator presses «Ejecutar consulta» without choosing a connection
- **THEN** the console says «Elegí una conexión para ejecutar» and sends no execution request

### Requirement: Save as a New Version
With a saved query loaded in the editor, the console SHALL offer «Guardar como versión N+1» (N being the loaded version) with an optional note field. It is enabled under the same execution gate as «Guardar consulta».

**Request.** It SHALL send `PUT /consultas-guardadas/<id>` with the editor's name, description, statement, declared parameters and the note, exactly as the create sends them. It SHALL then return to the list and refresh it.

**Refusals.** These answers SHALL appear in the editor, which stays open:
- `409 sin-cambios` SHALL read «No hay cambios respecto de la versión vigente»;
- `409 conflicto-de-edicion` SHALL ask to reload the query.

**Help text.** The saved-queries help text SHALL still say that a saved query cannot be deleted.

(Previously: the action lived in the query pop-up, which closed on success.)

#### Scenario: Save a change
- **GIVEN** a saved query open in the editor, its statement modified and executed
- **WHEN** the operator saves it as a new version with the note «Agrega filtro»
- **THEN** one PUT request is sent for that query's id with the editor's content and the note, the list is shown and refreshed

#### Scenario: Nothing loaded
- **WHEN** the editor is at `#consultas/nueva`
- **THEN** the save-as-version action is not offered

#### Scenario: Switching tenant forgets the loaded query
- **WHEN** the operator switches tenant
- **THEN** the loaded query is forgotten, the list of the new tenant is shown and the action disappears

### Requirement: Console Displays the List of Saved Queries
The console SHALL display the tenant's saved queries in a table, using the metadata-only list endpoint. Each row shows:
- `nombre` and `descripcion`;
- `actualizadaEn` as «Última edición»;
- «Abrir» and «Versiones».

**Search.** Above the table, a search field SHALL filter the loaded rows by name and description as the operator types, without a request, with a counter of the visible rows.

**States.**
- No saved queries: «Todavía no hay consultas guardadas. Ejecutá una y guardala para volver a usarla.»
- A search with no match: «Ninguna consulta coincide con "{texto}"» and «Limpiar búsqueda».
- A failed load: the error with «Reintentar».

(Previously: a plain list showing at least each name.)

#### Scenario: Viewing the saved queries list
- **GIVEN** at least one saved query exists for the tenant
- **WHEN** the list is shown or refreshed
- **THEN** each row shows its name, description and last edit
- **AND** the console SHALL NOT fetch any row's `sql` to render the list

#### Scenario: Searching
- **GIVEN** the list holds «Stock bajo» and «Ventas del mes»
- **WHEN** the operator types «stock»
- **THEN** only «Stock bajo» is shown, the counter says 1, and no request is sent

#### Scenario: No match
- **WHEN** the operator types «xyz»
- **THEN** the list says «Ninguna consulta coincide con "xyz"» and offers «Limpiar búsqueda»

## ADDED Requirements

### Requirement: Query Editor Subview (W, DEC-208)
The query editor SHALL be laid out in this order.

**1. Header.** The breadcrumb, the version history action for a loaded query, and the save control.

**2. Context bar**, above the editor:
- the connection picker;
- one test-value field per declared parameter, labelled with `:nombre` in mono;
- «Filas por página».

**3. The SQL editor**, at least 8 lines tall, then:
- «Ejecutar consulta», with the text «Ctrl + Enter» next to it;
- the collapsible parameter declaration (name, type).

**4. Below the editor:**
- the status line with rows, duration and connection, plus the existing cap notice when the result was cut;
- the result area with the table and the pager.

**5. Beside them, the reference panel:**
- the canonical contract (entities and fields) embedded in the page;
- the declared parameters;
- the line «Consultas lee las tablas propias de la réplica; las plantillas y los reportes leen las vistas canónicas que arma el mapeo.»;
- the links «Ir a Mapeo y validación» and «Ir a Plantillas».

It SHALL NOT read or list replica metadata.

**Keyboard.** Ctrl + Enter or Cmd + Enter in the editor SHALL run the query; Enter alone SHALL insert a newline.

**Result states.**
- Before the first run: «Ejecutá la consulta para ver el resultado acá (Ctrl + Enter).»
- While running: the previous result keeps its place with `aria-busy="true"`.
- A failed run: the error replaces the result, with the engine code and message in a mono block.

#### Scenario: Keyboard run
- **GIVEN** the editor holds `SELECT 1` and a connection is chosen
- **WHEN** the operator presses Ctrl + Enter in the editor
- **THEN** exactly one execution request is sent

#### Scenario: Plain Enter
- **WHEN** the operator presses Enter in the editor
- **THEN** no request is sent

#### Scenario: Empty state before running
- **WHEN** the editor opens at `#consultas/nueva`
- **THEN** the result area says «Ejecutá la consulta para ver el resultado acá (Ctrl + Enter).»

#### Scenario: Reference panel uses no new data
- **WHEN** the editor is shown
- **THEN** the reference panel lists the contract's entities and fields, and no request other than the existing ones is sent

### Requirement: Leaving the Query Editor With Unsaved Changes (DEC-208)
The editor has unsaved changes when its name, description, SQL, parameter declaration or note differ from the loaded or empty state.

**Leaving by address.** Leaving with unsaved changes, by the breadcrumb or by any change of address, SHALL put the editor's address back and show the editor's own unsaved-changes line «Hay cambios sin guardar.» with «Descartar cambios» and «Seguir editando» (the same one «Cancelar» and Escape show).
- «Descartar cambios» SHALL close the editor and go on to the address the operator asked for.
- «Seguir editando» SHALL keep the editor, its address and every typed value.

**Leaving by tenant switch.** The «Cambiar tenant» pop-up SHALL include Consultas in its unsaved-changes warning. Confirming the switch discards the changes.

#### Scenario: Breadcrumb with changes
- **GIVEN** the operator typed SQL at `#consultas/nueva`
- **WHEN** the operator presses the «Consultas» breadcrumb
- **THEN** the address stays `#consultas/nueva`, the editor says «Hay cambios sin guardar.», and «Seguir editando» keeps the SQL

#### Scenario: Tenant switch with changes
- **GIVEN** the editor has unsaved changes
- **WHEN** the «Cambiar tenant» pop-up opens
- **THEN** it warns that Consultas has unsaved changes
