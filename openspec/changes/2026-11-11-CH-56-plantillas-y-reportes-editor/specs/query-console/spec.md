# Query Console Specification (CH-56 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-56. `automation-templates` and `report-catalog` specify the API, which does not change. DEC-208 amends DEC-173 for the editors with SQL. This delta applies it to Plantillas (slice 56a) and Reportes (slice 56b).

It is written against the spec as left by CH-53, which archives first. Fields, the test fingerprint, the save gate and every answer keep their current rules; only the container, the layout and the closing behaviour change. Pattern ids refer to `.claude/skills/zerodashboard-design/guidelines/admin.md`.

## ADDED Requirements

### Requirement: Template and Report Editor Subview (DEC-208, F1, F4, F7, K3)
The template and report editors SHALL be subviews of their screens, at these addresses:
- `#plantillas/nueva`, `#plantillas/{id}` and `#plantillas/{id}/duplicar`;
- `#reportes/nuevo`, `#reportes/{id}` and `#reportes/{id}/duplicar`.

**Breadcrumb.** Each editor SHALL show a breadcrumb back to its list: «Plantillas › Nueva plantilla», «Plantillas › {nombre}» or «Plantillas › Copia de {nombre}», and the same for Reportes.

**Sections.** Each editor SHALL hold four numbered sections, in this order, each with a title and a one-line purpose:

| # | Section | Plantillas | Reportes |
|---|---|---|---|
| 1 | Qué es | name, automation tag, format, freshness tolerance, client title and description | name, client title and description |
| 2 | Datos | entities, SQL, parameter declaration | entities, SQL, period |
| 3 | Salida | message header and line per row | visualization and columns by role |
| 4 | Prueba | the test block | the test block |

**Footer.** A footer fixed at the bottom of the subview SHALL hold:
- «Cancelar»;
- the save gate's reason line;
- «Guardar plantilla» or «Guardar reporte».

After a passing test, the reason line SHALL read «Última prueba: OK · {hora} · {n} filas».

**In-use copy banner.** When a copy is opened from an original with `enUso: true`, a neutral banner at the top SHALL name the original:
- for a template, that it has active automations and that the copy will not appear in the client panel until it has its own title and description;
- for a report, that it is on a client dashboard.

**Leaving.** Leaving an editor with unsaved changes, by the breadcrumb, «Cancelar» or a change of address, SHALL ask «¿Descartar los cambios?» with «Descartar cambios» and «Seguir editando», as in Leaving the Query Editor With Unsaved Changes. A tenant switch SHALL return to the list, after the tenant pop-up's unsaved-changes warning names the screen.

**Not found.** An address whose id is not in the catalog SHALL show «No encontramos esa plantilla.» or «No encontramos ese reporte.» with a link to the list.

#### Scenario: Opening a new template
- **WHEN** the operator presses «Nueva plantilla»
- **THEN** the hash becomes `#plantillas/nueva`, the four sections are shown in order, and no pop-up opens

#### Scenario: Same skeleton
- **WHEN** the template and report editors are compared
- **THEN** both show sections 1, 2, 3 and 4 with the same titles, and only section 3's fields differ

#### Scenario: Footer after a passing test
- **GIVEN** the last test passed with 12 rows at 14:02
- **THEN** the footer says «Última prueba: OK · 14:02 · 12 filas» and «Guardar plantilla» is enabled

#### Scenario: Copy of an in-use template
- **GIVEN** «Stock diario» has `enUso: true`
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the hash becomes `#plantillas/{id}/duplicar`, and the top banner names «Stock diario», says it has active automations, and says the copy needs its own client title and description

#### Scenario: Leaving with changes
- **GIVEN** the operator edited the SQL of a new report
- **WHEN** the operator presses the «Reportes» breadcrumb
- **THEN** the discard confirmation opens, and «Seguir editando» keeps the editor and its values

## MODIFIED Requirements

### Requirement: Create and Edit Forms Open in a Pop-up (DEC-173, DEC-208)
In the console, every form that creates or modifies a record SHALL open in a pop-up over the screen (`.zd-dialog` on `.zd-dialog-backdrop`). The pop-up holds every field of the record, a title, and at its foot the main action (verb + object) and «Cancelar».

**Coverage.**
- The rule covers «Nuevo tenant», «Nueva conexión», «Nuevo usuario», the automation wizard and the automation adjust.
- **Exception (DEC-208):** the query, template and report editors are subviews of their screens (Query Editor Subview; Template and Report Editor Subview), not pop-ups.

**Opening.**
- A create pop-up SHALL be opened from its screen's page header; an edit pop-up from its record's row.
- On opening, the focus SHALL go to its first field.

**Closing.**
- «Cancelar» and the Escape key SHALL close it without sending anything.
- When there are unsaved changes, they SHALL first ask «Descartar cambios», offering «Descartar cambios» and «Seguir editando».
- A switch of the active tenant SHALL close any open pop-up without asking.

**Placement.** Such a form SHALL NOT be rendered inline above or below a table, nor in a side panel. Read-only detail (version history, template detail, report detail) stays in the side panel.

Destructive actions confirm in the graded confirmation pop-up. A tenant's baja is confirmed in its own pop-up by typing the name (DEC-175).

(Previously: the template and report pop-ups were covered by this rule.)

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

### Requirement: Template Pop-Up for Create, Edit and Duplicate (DEC-173, DEC-191, DEC-208)
One editor subview SHALL serve «Nueva plantilla», «Editar» and «Duplicar y editar».

**Fields.** Each has a visible label and sits in the section given in Template and Report Editor Subview:
- name, SQL (monospace) and the parameter declaration, with the same editor and rules as the query editor;
- entities, one checkbox per canonical entity in contract order, at least one;
- automation tag, a select over the closed list;
- format, a select over the closed list;
- freshness tolerance in minutes, an integer of 0 or more;
- client title and client description, with their length caps shown.

**Test block** (section 4):
- a connection select of the active tenant;
- one input per declared parameter;
- «Probar».

«Probar» sends `POST /plantillas/prueba` with the form's template, the active tenant, the `conexionId` and the `valores`, and shows the answers as the side-panel block does.

**Save gate.**
- «Guardar plantilla» SHALL be enabled only when the last test answered `200` with `resultado: "ok"` and its fingerprint equals the form's current one.
- The fingerprint SHALL be the SQL, the parameter declaration, the entities and the connection.
- Changing the name, the automation tag, the format, the tolerance or the client texts SHALL NOT clear it.
- While «Guardar plantilla» is disabled, the footer SHALL say why: no test yet, the last test failed, or the template changed since the last test.

**Saving.**
- «Guardar plantilla» SHALL send `POST /plantillas` for a new template or a duplicate and `PUT /plantillas/:id` for an edit, always with both client texts.
- A `400` SHALL be shown in the editor, naming the offending fields («Revisá estos campos»), with the glossary terms when present.
- A `409 plantilla-en-uso` SHALL say that the template now has active automations and offer «Duplicar y editar».
- On success, the console SHALL return to the list, reload it, and show the saved template in the side panel.

**Duplicating.** «Duplicar y editar» SHALL open `#plantillas/{id}/duplicar` with:
- the original's name followed by « (copia)»;
- its SQL, parameters, entities, automation tag, format and tolerance;
- empty client texts.

The editor SHALL say that the copy will not appear in the client panel until it has its own title and description. Nothing SHALL be written until «Guardar plantilla».

**Without an active tenant**, the test block SHALL say «Elegí un tenant para probar la plantilla» and «Guardar plantilla» SHALL stay disabled.

(Previously: a pop-up, closed on success; Cancel and Escape asked before discarding; a tenant switch closed it.)

#### Scenario: Creating a template after a passing test
- **GIVEN** an active tenant with connection "food-store" whose views are approved
- **WHEN** the operator presses «Nueva plantilla», fills every field, chooses "food-store" and presses «Probar», and the test answers `200` with `resultado: "ok"`
- **THEN** «Guardar plantilla» is enabled
- **AND** pressing it sends one `POST /plantillas` with the form's template and both client texts, and the list is shown

#### Scenario: Changing the SQL after a test disables saving
- **GIVEN** a passing test in the editor
- **WHEN** the operator edits the SQL
- **THEN** «Guardar plantilla» is disabled and the footer says the template changed since the last test

#### Scenario: Changing the client title keeps saving enabled
- **GIVEN** a passing test in the editor
- **WHEN** the operator edits the client title
- **THEN** «Guardar plantilla» stays enabled

#### Scenario: Duplicating a template in use
- **GIVEN** a template "Stock diario" with `enUso: true` and client texts
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the editor opens with name "Stock diario (copia)", the original's SQL, parameters, entities, tag, format and tolerance, and empty client texts
- **AND** no request that writes is sent until «Guardar plantilla»

#### Scenario: The template became in use while editing
- **GIVEN** the operator edits a template that was free
- **WHEN** «Guardar plantilla» answers `409 plantilla-en-uso`
- **THEN** the editor says the template now has active automations, offers «Duplicar y editar», and stays open

#### Scenario: A forbidden term in the client description
- **WHEN** «Guardar plantilla» answers `400` with `campos` `["/descripcion"]` and `terminos` `["consulta"]`
- **THEN** the editor names the description field and the term "consulta", and stays open

### Requirement: Template Message Texts in the Pop-Up (DEC-188, DEC-192)
Section 3 of the template editor SHALL hold two fields, each with a visible label and its length cap shown:
- «Encabezado del mensaje», at most 200 characters;
- «Línea por fila», at most 300 characters.

A hint SHALL say that:
- `{columna}` in the line is replaced by that column's value in each row;
- the header takes no columns;
- both go together;
- without them, the email shows the table.

**Fingerprint.** The texts SHALL NOT be part of the test fingerprint: editing them SHALL NOT disable «Guardar plantilla». The editor SHALL keep the `columnas` of the last passing test with its fingerprint.

**Requests.**
- «Guardar plantilla» SHALL send both texts and `columnasPrueba` equal to those `columnas`.
- The test request SHALL send both texts and no `columnasPrueba`.

**Answers and copies.**
- A `400` with `marcadores` SHALL name the message field and say that those columns are not in the last test, listing them.
- «Editar» SHALL fill both texts from the template.
- «Duplicar y editar» SHALL copy both texts.
- Leaving the editor SHALL count a change to either text as a change to discard.

(Previously: the fields lived in the template pop-up.)

#### Scenario: Saving with message texts
- **GIVEN** a passing test whose `columnas` are `producto, cantidad`
- **WHEN** the operator fills the header and the line "{producto}: quedan {cantidad}" and presses «Guardar plantilla»
- **THEN** one request is sent with both texts and `columnasPrueba` `["producto", "cantidad"]`

#### Scenario: Editing the line keeps saving enabled
- **GIVEN** a passing test in the editor
- **WHEN** the operator edits the line
- **THEN** «Guardar plantilla» stays enabled

#### Scenario: An unknown column
- **WHEN** «Guardar plantilla» answers `400` with `campos` `["/lineaMensaje"]` and `marcadores` `["stock"]`
- **THEN** the editor names «Línea por fila», says `stock` is not among the columns of the last test, and stays open

#### Scenario: Duplicating keeps the message texts
- **GIVEN** a template with `enUso: true` and both message texts
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the editor shows both message texts and empty client texts

### Requirement: Report Pop-Up for Create and Edit (DEC-173, DEC-198, DEC-208)
One editor subview SHALL serve «Nuevo reporte», «Editar» and «Duplicar y editar».

**Fields.** Each has a visible label and sits in the section given in Template and Report Editor Subview:
- name;
- client title and client description, with their length caps shown;
- entities, one checkbox per canonical entity in contract order, at least one;
- SQL, in monospace;
- period: «Sin período», or a parameter name and the days, written as a comma-separated list, with the first as the default;
- visualization, a select over «Número», «Tabla», «Barras» and «Línea»;
- the columns of the chosen visualization: one row per role, each with a column select and a title input. For «Tabla», «Agregar columna» adds a row, up to 10, and «Quitar» removes one, down to 1.

**Test block** (section 4):
- a connection select of the active tenant;
- a period select over the days typed in the form;
- «Probar».

«Probar» SHALL send `POST /reportes/prueba` with the form's report without `columnas` (the test is what produces them), the active tenant, the `conexionId` and `dias`. It SHALL show the returned columns and rows as a table.

**Column selects.** After a passing test, each column select SHALL offer the test's columns. Before one, the selects SHALL be empty and the editor SHALL say «Probá el reporte para elegir sus columnas».

**Save gate.**
- «Guardar reporte» SHALL be enabled only when the last test answered `200` with `resultado: "ok"` and its fingerprint equals the form's current one.
- The fingerprint SHALL be the SQL, the period, the entities and the connection.
- Changing the name, the client texts, the visualization or the columns SHALL NOT clear it.
- While «Guardar reporte» is disabled, the footer SHALL say why: no test yet, the last test failed, or the report changed since the last test.

**Saving.**
- «Guardar reporte» SHALL send `POST /reportes` for a new report or a duplicate and `PUT /reportes/:id` for an edit, with `columnasPrueba` holding the last test's columns.
- Changing the visualization SHALL keep the rows whose role still exists and empty the rest.
- A `400` SHALL be shown in the editor, naming the offending fields («Revisá estos campos»), with the glossary terms and the missing columns when present.
- On success, the console SHALL return to the list, reload it, and show the saved report in the side panel.

**Without an active tenant**, the test block SHALL say «Elegí un tenant para probar el reporte» and «Guardar reporte» SHALL stay disabled.

**Duplicating.** «Duplicar y editar» SHALL open `#reportes/{id}/duplicar` with the original's name followed by « (copia)» and every other field of the original.
- Nothing SHALL be written until «Guardar reporte».
- A copy opened from the side panel SHALL need its own passing test, like a new report.

**In-use refusal.** A `409 reporte-en-uso` on an edit SHALL say that the report is now on a client dashboard and offer «Duplicar y editar», keeping the editor open. Choosing it there SHALL turn the open editor into a copy of what was just tested, so a passing test whose fingerprint still matches keeps «Guardar reporte» enabled, as for templates (CH-38).

(Previously: a pop-up, closed on success; Cancel and Escape asked before discarding; a tenant switch closed it.)

#### Scenario: Creating a bar report after a passing test
- **GIVEN** an active tenant with connection "food-store" whose views are approved
- **WHEN** the operator fills the form with «Barras», presses «Probar», and the test answers `200` `ok` with columns `producto` and `unidades`
- **AND** chooses `producto` as the label and `unidades` as the value, with their titles
- **THEN** «Guardar reporte» is enabled, and pressing it sends one `POST /reportes` with the assigned columns and `columnasPrueba` ["producto", "unidades"]

#### Scenario: Changing the SQL after a test disables saving
- **GIVEN** a passing test in the editor
- **WHEN** the operator edits the SQL
- **THEN** «Guardar reporte» is disabled and the footer says the report changed since the last test

#### Scenario: Changing the visualization keeps saving enabled
- **GIVEN** a passing test and a «Barras» report
- **WHEN** the operator switches to «Línea»
- **THEN** «Guardar reporte» stays enabled and both column rows keep their choices

#### Scenario: A table with too many columns
- **GIVEN** a «Tabla» report with 10 column rows
- **THEN** «Agregar columna» is disabled

#### Scenario: Duplicating a report in use
- **GIVEN** a report "Ventas por producto" with `enUso: true`
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the editor opens with name "Ventas por producto (copia)" and the original's fields
- **AND** no request that writes is sent until «Guardar reporte», which sends `POST /reportes`

#### Scenario: The report became in use while editing
- **GIVEN** the operator edits a report that was free
- **WHEN** «Guardar reporte» answers `409 reporte-en-uso`
- **THEN** the editor says the report is now on a client dashboard, offers «Duplicar y editar», and stays open
