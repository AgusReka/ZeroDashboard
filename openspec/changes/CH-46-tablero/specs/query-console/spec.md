# Query Console Specification (CH-46 delta)

## ADDED Requirements

### Requirement: Tenant Dashboard Screen (R2h, DEC-199)
The «Tablero del cliente» screen (`pantalla-tablero`) SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /tablero`, `GET /conexiones` and `GET /reportes`. Switching the tenant SHALL discard unsaved changes. With no active tenant it SHALL say «Elegí un tenant para armar su tablero.» and send nothing.

The screen SHALL hold:
- a connection select over the tenant's connections, starting on the dashboard's connection, or empty when the tenant has no dashboard;
- the ordered list of the dashboard's reports. Each row shows its position, client title, name and visualization, as text. When the answer names pending entities for that report, the row also says «Faltan vistas aprobadas en esta conexión:» followed by them;
- per row, «Subir» (disabled on the first row), «Bajar» (disabled on the last row) and «Quitar»;
- «Agregar reporte»: a select over the catalog reports not already on the list, and «Agregar», which appends the chosen report at the end. At 8 reports both SHALL be disabled and the screen SHALL say «El tablero llegó al máximo de 8 reportes.»;
- «Guardar».

An empty list SHALL say «El tablero no tiene reportes: el cliente no ve ninguno.» Changing the connection SHALL clear the pending-views lines and say «Guardá para ver qué reportes tienen sus vistas aprobadas en esta conexión.»

«Guardar» SHALL be enabled only when a connection is chosen and the screen differs from the last loaded or saved dashboard. It SHALL send `PUT /tablero` with the active tenant, the `conexionId` and the report ids in screen order, and render the answer. A `400` SHALL name the problem, a `404 conexion-no-encontrada` SHALL say the connection no longer exists, and network and tenant failures SHALL be legible. Pending views never disable «Guardar».

#### Scenario: Loading a tenant's dashboard
- **GIVEN** tenant A with a dashboard on "food-store" holding reports "Ventas" and "Stock", in that order
- **WHEN** the hash becomes `#tablero`
- **THEN** one `GET /tablero` is sent with tenant A, and the list shows "Ventas" first and "Stock" second, with "food-store" selected

#### Scenario: Reordering and saving
- **GIVEN** the list "Ventas", "Stock"
- **WHEN** the operator presses «Subir» on "Stock" and then «Guardar»
- **THEN** one `PUT /tablero` is sent with the reports in the order "Stock", "Ventas"

#### Scenario: Pending views are shown but do not block
- **GIVEN** the answer names `pedido` as pending for "Ventas"
- **THEN** the "Ventas" row says «Faltan vistas aprobadas en esta conexión: pedido»
- **AND** «Guardar» stays enabled once there are changes

#### Scenario: The cap
- **GIVEN** a list with 8 reports
- **THEN** «Agregar reporte» and «Agregar» are disabled and the screen says the dashboard reached its maximum

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the hash becomes `#tablero`
- **THEN** the screen says «Elegí un tenant para armar su tablero.» and no request is sent

#### Scenario: Markup in a title is text
- **WHEN** a report title contains `<b>`
- **THEN** it is shown verbatim and no element is created from it

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order:
- a "Global" group with `#tenants`, `#plantillas`, `#reportes` and `#contrato`;
- a "Puesta en marcha" group with `#conexiones`, `#agentes`, `#mapeo`, `#usuarios`, `#tablero` and `#tiempos`;
- a "Trabajo diario" group with `#consultas`, `#automatizaciones`, `#frescura` and `#auditoria`.

On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: the "Puesta en marcha" group had no `#tablero`.)

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#tiempos`
- **THEN** only Tiempos de alta is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

#### Scenario: The reports screen
- **WHEN** the hash becomes `#reportes`
- **THEN** only Reportes is visible and its link is current

#### Scenario: The dashboard screen
- **WHEN** the hash becomes `#tablero`
- **THEN** only Tablero del cliente is visible and its link is current

### Requirement: Reports Screen (R1h, DEC-183, DEC-198)
The Reportes screen (`pantalla-reportes`) SHALL be global, like Plantillas. It SHALL list the report catalog (`GET /reportes`), with name, client title and visualization written as text, and say when the list was cut. The visualization SHALL be shown as «Número», «Tabla», «Barras» or «Línea».

The header SHALL hold the primary action «Nuevo reporte». «Ver» SHALL load the report (`GET /reportes/:id`) and show, in a side panel and as text:
- its entities;
- its period: the parameter and the days, with the default marked, or «Sin período»;
- its statement;
- its client title and description;
- its visualization;
- its assigned columns, each with its role and title, in order.

The side panel SHALL hold «Editar» when the report has `enUso: false`, and «Duplicar y editar» with a line saying that it is on a client dashboard when `enUso: true`; never both. A missing `enUso` SHALL be read as in use.

The side panel SHALL also hold a «Probar en el tenant activo» block. It SHALL contain:
- a connection select filled from the active tenant's connections;
- a period select over the declared days, showing «Últimos N días» and starting on the default, or no select when the report has no period;
- «Probar».

«Probar» SHALL send `POST /reportes/:id/prueba` with the active tenant, the `conexionId` and, when there is a period, `dias`.

The answers SHALL be shown as follows, all inside the block and written as text:

| Answer | What the block shows |
|---|---|
| `200` with `resultado: "ok"` and empty `faltantes` | The assigned columns only, headed by their titles and in their order, as a table. It also shows the number of rows, the date used («Desde el 30/10/2026») and, with `corte`, that the result was cut at the visualization's cap. |
| `200` with `resultado: "ok"` and `faltantes` | That the result does not have the named columns, and no table. |
| `200` with `resultado: "fallo"` | The failure message, as the query pop-up writes it. |
| `409 vista-canonica-no-aprobada` | The entities whose views are not approved, pointing to Mapeo y validación. |
| `400`, `404`, `409 credencial-ilegible` and tenant failures | A legible message. |

With no active tenant, the block SHALL say «Elegí un tenant para probar el reporte» and send nothing. Loading another report, closing the panel or switching the active tenant SHALL clear the result.

(Previously: the side panel always offered «Editar»; a report could not be in use.)

#### Scenario: Viewing a report
- **WHEN** the operator presses «Ver» on "Ventas por producto"
- **THEN** the panel shows its entities, period, statement, client texts, visualization and assigned columns, as text

#### Scenario: Testing with a declared period
- **GIVEN** an active tenant with connection "food-store" and a report declaring `dias` [30, 7]
- **WHEN** the operator chooses "food-store" and «Últimos 7 días» and presses «Probar»
- **THEN** one `POST /reportes/:id/prueba` is sent with `conexionId` of "food-store" and `dias` 7
- **AND** the block shows only the assigned columns, under their titles

#### Scenario: A column is missing
- **WHEN** «Probar» answers `200` `ok` with `faltantes` ["total"]
- **THEN** the block names "total" as missing and shows no table

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the operator opens a report and presses «Probar»
- **THEN** the block says «Elegí un tenant para probar el reporte» and no request is sent

#### Scenario: Markup in a title is text
- **WHEN** a column title contains `<b>`
- **THEN** it is shown verbatim and no element is created from it

#### Scenario: A report in use offers only duplication
- **GIVEN** a report with `enUso: true`
- **WHEN** the operator opens it
- **THEN** the panel shows «Duplicar y editar» and says it is on a client dashboard, and shows no «Editar»

### Requirement: Report Pop-Up for Create and Edit (DEC-173, DEC-198)
One pop-up SHALL serve «Nuevo reporte», «Editar» and «Duplicar y editar». Its fields SHALL be, each with a visible label:
- name;
- client title and client description, with their length caps shown;
- entities, one checkbox per canonical entity in contract order, at least one;
- SQL, in monospace;
- period: «Sin período», or a parameter name and the days, written as a comma-separated list, with the first as the default;
- visualization, a select over «Número», «Tabla», «Barras» and «Línea»;
- the columns of the chosen visualization: one row per role, each with a column select and a title input. For «Tabla», «Agregar columna» adds a row, up to 10, and «Quitar» removes one, down to 1.

It SHALL hold a test block with:
- a connection select of the active tenant;
- a period select over the days typed in the form;
- «Probar».

«Probar» SHALL send `POST /reportes/prueba` with the form's report without `columnas` (the test is what produces them), the active tenant, the `conexionId` and `dias`, and SHALL show the returned columns and rows as a table. After a passing test, each column select SHALL offer the test's columns. Before one, the selects SHALL be empty and the pop-up SHALL say «Probá el reporte para elegir sus columnas».

«Guardar» SHALL be enabled only when the last test answered `200` with `resultado: "ok"` and its fingerprint equals the form's current one. The fingerprint SHALL be the SQL, the period, the entities and the connection. Changing the name, the client texts, the visualization or the columns SHALL NOT clear it. While «Guardar» is disabled, the pop-up SHALL say why: no test yet, the last test failed, or the report changed since the last test.

«Guardar» SHALL send `POST /reportes` for a new report or a duplicate and `PUT /reportes/:id` for an edit, with `columnasPrueba` holding the last test's columns. Changing the visualization SHALL keep the rows whose role still exists and empty the rest.

How the answers are shown:
- A `400` SHALL be shown in the pop-up, naming the offending fields («Revisá estos campos»), with the glossary terms and the missing columns when present.
- On success, the pop-up SHALL close, the list SHALL reload and the side panel SHALL show the saved report.

How the pop-up closes:
- With no active tenant, the test block SHALL say «Elegí un tenant para probar el reporte» and «Guardar» SHALL stay disabled.
- Cancel and Escape SHALL ask before discarding changes.
- Switching the active tenant SHALL close the pop-up.

«Duplicar y editar» SHALL open the pop-up with the original's name followed by « (copia)» and every other field of the original. Nothing SHALL be written until «Guardar», and the copy SHALL need its own passing test like a new report. A `409 reporte-en-uso` on an edit SHALL say that the report is now on a client dashboard and offer «Duplicar y editar», keeping the pop-up open.
(Previously: the pop-up served only create and edit, and an edit could not be refused for use.)

#### Scenario: Creating a bar report after a passing test
- **GIVEN** an active tenant with connection "food-store" whose views are approved
- **WHEN** the operator fills the form with «Barras», presses «Probar», and the test answers `200` `ok` with columns `producto` and `unidades`
- **AND** chooses `producto` as the label and `unidades` as the value, with their titles
- **THEN** «Guardar» is enabled, and pressing it sends one `POST /reportes` with the assigned columns and `columnasPrueba` ["producto", "unidades"]

#### Scenario: Changing the SQL after a test disables saving
- **GIVEN** a passing test in the pop-up
- **WHEN** the operator edits the SQL
- **THEN** «Guardar» is disabled and the pop-up says the report changed since the last test

#### Scenario: Changing the visualization keeps saving enabled
- **GIVEN** a passing test and a «Barras» report
- **WHEN** the operator switches to «Línea»
- **THEN** «Guardar» stays enabled and both column rows keep their choices

#### Scenario: A table with too many columns
- **GIVEN** a «Tabla» report with 10 column rows
- **THEN** «Agregar columna» is disabled

#### Scenario: Duplicating a report in use
- **GIVEN** a report "Ventas por producto" with `enUso: true`
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the pop-up opens with name "Ventas por producto (copia)" and the original's fields
- **AND** no request that writes is sent until «Guardar», which sends `POST /reportes`

#### Scenario: The report became in use while editing
- **GIVEN** the operator edits a report that was free
- **WHEN** «Guardar» answers `409 reporte-en-uso`
- **THEN** the pop-up says the report is now on a client dashboard and offers «Duplicar y editar», and stays open
