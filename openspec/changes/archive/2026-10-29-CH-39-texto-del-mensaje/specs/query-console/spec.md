# Query Console Specification (CH-39 delta)

## Purpose
The template pop-up loads the message texts, the side panel shows them, and the runs view says when a message fell back to the table (DEC-188, DEC-192). The test fingerprint does not change. Delivered in CH-39b.

## ADDED Requirements

### Requirement: Template Message Texts in the Pop-Up (DEC-188, DEC-192)

The template pop-up SHALL hold two more fields, each with a visible label and its length cap shown: «Encabezado del mensaje» (at most 200 characters) and «Línea por fila» (at most 300 characters). A hint SHALL say that `{columna}` in the line is replaced by that column's value in each row, that the header takes no columns, that both go together, and that without them the email shows the table.

The texts SHALL NOT be part of the test fingerprint: editing them SHALL NOT disable «Guardar». The pop-up SHALL keep the `columnas` of the last passing test with its fingerprint. «Guardar» SHALL send both texts and `columnasPrueba` equal to those `columnas`. The test request SHALL send both texts and no `columnasPrueba`.

A `400` with `marcadores` SHALL name the message field and say that those columns are not in the last test, listing them. «Editar» SHALL fill both texts from the template. «Duplicar y editar» SHALL copy both texts. Cancel and Escape SHALL count a change to either text as a change to discard.

#### Scenario: Saving with message texts
- **GIVEN** a passing test whose `columnas` are `producto, cantidad`
- **WHEN** the operator fills the header and the line "{producto}: quedan {cantidad}" and presses «Guardar»
- **THEN** one request is sent with both texts and `columnasPrueba` `["producto", "cantidad"]`

#### Scenario: Editing the line keeps saving enabled
- **GIVEN** a passing test in the pop-up
- **WHEN** the operator edits the line
- **THEN** «Guardar» stays enabled

#### Scenario: An unknown column
- **WHEN** «Guardar» answers `400` with `campos` `["/lineaMensaje"]` and `marcadores` `["stock"]`
- **THEN** the pop-up names «Línea por fila», says `stock` is not among the columns of the last test, and stays open

#### Scenario: Duplicating keeps the message texts
- **GIVEN** a template with `enUso: true` and both message texts
- **WHEN** the operator presses «Duplicar y editar»
- **THEN** the pop-up shows both message texts and empty client texts

### Requirement: Runs View Shows the Fallback to the Table (DEC-188, DEC-192)

In the runs view, a run with a non-null `mensajeRespaldo` SHALL show, as text, that the email was sent with the table because the result lacked the listed columns. A null `mensajeRespaldo` SHALL show nothing for it, never the text `null`. The copy MUST NOT contain a backtick.

#### Scenario: A run that fell back
- **GIVEN** a run with `mensajeRespaldo` `["stock"]`
- **WHEN** the runs are shown
- **THEN** that run says the table was sent because the column `stock` was missing

## MODIFIED Requirements

### Requirement: Templates Screen
The Plantillas screen SHALL list the template catalog (`GET /plantillas`) with name, automation, format and freshness tolerance, written as text, and say when the list was cut. "Ver" SHALL load the template (`GET /plantillas/:id`) and show, in a side panel, the entities it needs, its declared parameters, its statement, its client title and description (or that it has none, so it does not appear in the client panel), and its message header and line (or that it has none, so the email shows the table), all as text. The screen SHALL offer no way to save a template as a query (DEC-177).

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
(Previously: the side panel did not show the message texts.)

#### Scenario: Viewing a template
- **WHEN** the operator presses "Ver" on "Stock diario"
- **THEN** the panel shows its entities, parameters, statement, client texts and message texts, as text

#### Scenario: A template without message texts
- **GIVEN** a template with both message texts null
- **WHEN** the operator opens it
- **THEN** the panel says it has no message text and the email shows the table
