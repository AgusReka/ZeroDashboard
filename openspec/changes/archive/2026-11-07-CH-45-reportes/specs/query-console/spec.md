# Query Console Specification (CH-45 delta)

## ADDED Requirements

### Requirement: Reports Screen (R1h, DEC-183, DEC-198)
The Reportes screen (`pantalla-reportes`) SHALL be global, like Plantillas. It SHALL list the report catalog (`GET /reportes`), with name, client title and visualization written as text, and say when the list was cut. The visualization SHALL be shown as «Número», «Tabla», «Barras» or «Línea».

The header SHALL hold the primary action «Nuevo reporte». «Ver» SHALL load the report (`GET /reportes/:id`) and show, in a side panel and as text:
- its entities;
- its period: the parameter and the days, with the default marked, or «Sin período»;
- its statement;
- its client title and description;
- its visualization;
- its assigned columns, each with its role and title, in order.

The side panel SHALL hold «Editar».

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

### Requirement: Report Pop-Up for Create and Edit (DEC-173, DEC-198)
One pop-up SHALL serve «Nuevo reporte» and «Editar». Its fields SHALL be, each with a visible label:
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

«Guardar» SHALL send `POST /reportes` for a new report and `PUT /reportes/:id` for an edit, with `columnasPrueba` holding the last test's columns. Changing the visualization SHALL keep the rows whose role still exists and empty the rest.

How the answers are shown:
- A `400` SHALL be shown in the pop-up, naming the offending fields («Revisá estos campos»), with the glossary terms and the missing columns when present.
- On success, the pop-up SHALL close, the list SHALL reload and the side panel SHALL show the saved report.

How the pop-up closes:
- With no active tenant, the test block SHALL say «Elegí un tenant para probar el reporte» and «Guardar» SHALL stay disabled.
- Cancel and Escape SHALL ask before discarding changes.
- Switching the active tenant SHALL close the pop-up.

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

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order:
- a "Global" group with `#tenants`, `#plantillas`, `#reportes` and `#contrato`;
- a "Puesta en marcha" group with `#conexiones`, `#agentes`, `#mapeo`, `#usuarios` and `#tiempos`;
- a "Trabajo diario" group with `#consultas`, `#automatizaciones`, `#frescura` and `#auditoria`.

On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: the "Global" group had no `#reportes`.)

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

### Requirement: Audit Screen
The Auditoría screen SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /auditoria` with the current filters and list the rows newest first. With no active tenant it SHALL say «Elegí un tenant para ver su auditoría.» and send nothing.

The filters SHALL be «Desde» and «Hasta» (dates) and «Resultado» (Todos, OK, Falló); «Filtrar» SHALL reload the list with them. A date SHALL mean the operator's local day: «Desde» is sent as the instant the local day starts, «Hasta» as the last millisecond of the local day, both in ISO form. An empty filter SHALL not be sent. «Desde» later than «Hasta» SHALL be refused on screen with nothing sent.

Each row SHALL show, as text:

| Column | Content |
|---|---|
| Fecha y hora | `creadoEn`, local date and time to the second |
| Operador | `operadorNombre` |
| Origen | Consulta, Prueba de plantilla, Validación de mapeo, Prueba de conexión, Vista previa de automatización or Prueba de reporte |
| Conexión | The connection's name from `GET /conexiones`; an unknown id shows its first eight characters |
| Consulta | The saved query's name and version («Stock v3»), the template id for a template test or a message preview, the report id for a report test («Reporte r-1»), else «Ad hoc» |
| SQL | The statement cut to 80 characters, with the full statement available on demand |
| Filas | `filas`, or empty when null |
| Duración | `duracionMs`, in ms below one second and in seconds above |
| Resultado | «OK», or «Falló» followed by the console's failure message for `fase`, `categoria` and `codigo` |

The screen SHALL offer no way to change or delete a row. When the answer says `truncado`, the screen SHALL say that only the most recent 200 rows are shown and suggest narrowing the dates. An empty list SHALL say «No hay ejecuciones registradas con estos filtros.». A `400` SHALL say to check the dates; network, tenant and other HTTP failures SHALL be legible.
(Previously: the Origen column had no «Prueba de reporte» and the Consulta cell did not name a report.)

#### Scenario: Listing the audit
- **GIVEN** an active tenant whose audit holds one failed run of the saved query "Stock" version 3 on connection "food-store" by operator "Ana"
- **WHEN** the hash becomes `#auditoria`
- **THEN** one `GET /auditoria` is sent with the active tenant
- **AND** the row shows "Ana", "Consulta", "food-store", "Stock v3" and "Falló" with the failure message, all as text

#### Scenario: A message preview row
- **GIVEN** an audit row with `origen` "automatizacion-vista-previa" and `plantillaId` "p-1"
- **WHEN** the audit is listed
- **THEN** its Origen cell shows «Vista previa de automatización» and its Consulta cell shows «Plantilla p-1»

#### Scenario: A report test row
- **GIVEN** an audit row with `origen` "reporte-prueba" and `reporteId` "r-1"
- **WHEN** the audit is listed
- **THEN** its Origen cell shows «Prueba de reporte» and its Consulta cell shows «Reporte r-1»

#### Scenario: An unsaved report test row
- **GIVEN** an audit row with `origen` "reporte-prueba" and `reporteId` null
- **WHEN** the audit is listed
- **THEN** its Consulta cell shows «Ad hoc»

#### Scenario: Filtering by local day and result
- **WHEN** the operator sets «Desde» and «Hasta» to the same day, «Resultado» to OK, and presses «Filtrar»
- **THEN** the request carries `desde` at that local day's start, `hasta` at its last millisecond, and `resultado=ok`

#### Scenario: Inverted dates
- **WHEN** «Desde» is later than «Hasta» and the operator presses «Filtrar»
- **THEN** the screen says so and no request is sent

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the hash becomes `#auditoria`
- **THEN** the screen says «Elegí un tenant para ver su auditoría.» and no request is sent

#### Scenario: Cut list
- **WHEN** the answer has `truncado: true`
- **THEN** the screen says only the most recent 200 rows are shown

#### Scenario: Markup in a statement is text
- **WHEN** a row's `sql` contains `<b>`
- **THEN** it is shown verbatim and no element is created from it
