# Query Console Specification (CH-38 delta)

## Purpose
The Plantillas screen stops being read-only. P1 creates a template, tests it against a connection of the active tenant before saving, edits a template that is not in use, and duplicates one that is (D4, D5, DEC-182, DEC-191). Forms go in a pop-up (DEC-173). The «Probar en el tenant activo» block of the side panel does not change.

## MODIFIED Requirements

### Requirement: Templates Screen
The Plantillas screen SHALL list the template catalog (`GET /plantillas`) with name, automation, format and freshness tolerance, written as text, and say when the list was cut. "Ver" SHALL load the template (`GET /plantillas/:id`) and show, in a side panel, the entities it needs, its declared parameters, its statement, and its client title and description (or that it has none, so it does not appear in the client panel), all as text. The screen SHALL offer no way to save a template as a query (DEC-177).

The header SHALL hold the screen's primary action, «Nueva plantilla». The side panel SHALL hold «Editar» when the template has `enUso: false`, and «Duplicar y editar» with a line saying that it has active automations when `enUso: true`; never both.

The side panel SHALL hold a «Probar en el tenant activo» block, the one tenant-scoped part of the panel. It SHALL contain:
- a connection select filled from the active tenant's connections;
- one input per parameter the template declares;
- «Probar».

«Probar» SHALL send `POST /plantillas/:id/prueba` with the active tenant, the chosen `conexionId`, and `valores` holding every declared parameter. It SHALL request the first page only.

The answers SHALL be shown as follows, all inside the block and written as text:

| Answer | What the block shows |
|---|---|
| `200` with `resultado: "ok"` | The columns and rows as a table, the number of rows shown, and whether there are more. |
| `200` with `resultado: "fallo"` | The failure message, as the query pop-up writes it. |
| `409 vista-canonica-no-aprobada` | The entities whose views are not approved, pointing to Mapeo y validación. |
| `400` | The offending parameters. |
| `404`, `409 credencial-ilegible` and tenant failures | A legible message. |

With no active tenant, the block SHALL say «Elegí un tenant para probar la plantilla» and send nothing. With no connection chosen, it SHALL say so and send nothing. Loading another template, closing the panel or switching the active tenant SHALL clear the result.
(Previously: the screen offered no way to create or change a template, and the panel did not show the client texts.)

#### Scenario: Viewing a template
- **WHEN** the operator presses "Ver" on "Stock diario"
- **THEN** the panel shows its entities, parameters, statement and client texts, as text

#### Scenario: A template in use offers only duplication
- **GIVEN** a template with `enUso: true`
- **WHEN** the operator opens it
- **THEN** the panel shows «Duplicar y editar» and says it has active automations, and shows no «Editar»

#### Scenario: Testing a template on a connection
- **GIVEN** an active tenant with connection "food-store" and a template declaring `umbral` (numero)
- **WHEN** the operator chooses "food-store", types 5 in `umbral` and presses «Probar»
- **THEN** one `POST /plantillas/:id/prueba` is sent with the active tenant, `conexionId` of "food-store" and `valores` `{ "umbral": 5 }`
- **AND** the block shows the returned columns and rows as text

#### Scenario: The views are not approved
- **WHEN** «Probar» answers `409 vista-canonica-no-aprobada` with entities `producto` and `insumo`
- **THEN** the block names `producto` and `insumo` and points to Mapeo y validación, and shows no table

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the operator opens a template and presses «Probar»
- **THEN** the block says «Elegí un tenant para probar la plantilla» and no request is sent

#### Scenario: Another template clears the result
- **GIVEN** a result is shown for one template
- **WHEN** the operator presses "Ver" on another template
- **THEN** the block shows no result

## ADDED Requirements

### Requirement: Template Pop-Up for Create, Edit and Duplicate (DEC-173, DEC-191)
One pop-up SHALL serve «Nueva plantilla», «Editar» and «Duplicar y editar». Its fields SHALL be, each with a visible label:
- name, SQL (monospace) and the parameter declaration, with the same editor and rules as the query pop-up;
- entities, one checkbox per canonical entity in contract order, at least one;
- automation tag, a select over the closed list;
- format, a select over the closed list;
- freshness tolerance in minutes, an integer of 0 or more;
- client title and client description, with their length caps shown.

It SHALL hold a test block with a connection select of the active tenant, one input per declared parameter and «Probar», which sends `POST /plantillas/prueba` with the form's template, the active tenant, the `conexionId` and the `valores`, and shows the answers as the side-panel block does.

«Guardar» SHALL be enabled only when the last test answered `200` with `resultado: "ok"` and its fingerprint equals the form's current one. The fingerprint SHALL be the SQL, the parameter declaration, the entities and the connection. Changing the name, the automation tag, the format, the tolerance or the client texts SHALL NOT clear it. While «Guardar» is disabled, the pop-up SHALL say why: no test yet, the last test failed, or the template changed since the last test. «Guardar» SHALL send `POST /plantillas` for a new template or a duplicate and `PUT /plantillas/:id` for an edit, always with both client texts. A `400` SHALL be shown in the pop-up naming the offending fields («Revisá estos campos»), with the glossary terms when present. A `409 plantilla-en-uso` SHALL say that the template now has active automations and offer «Duplicar y editar». On success the pop-up SHALL close, the list SHALL reload and the side panel SHALL show the saved template.

«Duplicar y editar» SHALL open the pop-up with the original's name followed by « (copia)», its SQL, parameters, entities, automation tag, format and tolerance, and empty client texts. The pop-up SHALL say that the copy will not appear in the client panel until it has its own title and description. Nothing SHALL be written until «Guardar». With no active tenant, the test block SHALL say «Elegí un tenant para probar la plantilla» and «Guardar» SHALL stay disabled. Cancel and Escape SHALL ask before discarding changes, and switching the active tenant SHALL close the pop-up.

#### Scenario: Creating a template after a passing test
- **GIVEN** an active tenant with connection "food-store" whose views are approved
- **WHEN** the operator presses «Nueva plantilla», fills every field, chooses "food-store" and presses «Probar», and the test answers `200` with `resultado: "ok"`
- **THEN** «Guardar» is enabled
- **AND** pressing it sends one `POST /plantillas` with the form's template and both client texts

#### Scenario: Changing the SQL after a test disables saving
- **GIVEN** a passing test in the pop-up
- **WHEN** the operator edits the SQL
- **THEN** «Guardar» is disabled and the pop-up says the template changed since the last test

#### Scenario: Changing the client title keeps saving enabled
- **GIVEN** a passing test in the pop-up
- **WHEN** the operator edits the client title
- **THEN** «Guardar» stays enabled

#### Scenario: Duplicating a template in use
- **GIVEN** a template "Stock diario" with `enUso: true` and client texts
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the pop-up opens with name "Stock diario (copia)", the original's SQL, parameters, entities, tag, format and tolerance, and empty client texts
- **AND** no request that writes is sent until «Guardar»

#### Scenario: The template became in use while editing
- **GIVEN** the operator edits a template that was free
- **WHEN** «Guardar» answers `409 plantilla-en-uso`
- **THEN** the pop-up says the template now has active automations and offers «Duplicar y editar», and stays open

#### Scenario: A forbidden term in the client description
- **WHEN** «Guardar» answers `400` with `campos` `["/descripcion"]` and `terminos` `["consulta"]`
- **THEN** the pop-up names the description field and the term "consulta", and stays open
