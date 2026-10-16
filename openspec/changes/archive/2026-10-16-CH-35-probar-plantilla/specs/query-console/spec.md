# Query Console Specification (CH-35 delta)

## Purpose
From the template panel, the operator tests a template against a connection of the active tenant and sees what it returns. The template does not become a saved query (DEC-177).

## MODIFIED Requirements

### Requirement: Templates Screen
The Plantillas screen SHALL list the template catalog (`GET /plantillas`) with name, automation, format and freshness tolerance, written as text, and say when the list was cut. "Ver" SHALL load the template (`GET /plantillas/:id`) and show, in a side panel, the entities it needs, its declared parameters and its statement as text. The screen SHALL offer no way to create or change a template, nor to save it as a query (DEC-177).

The side panel SHALL hold a «Probar en el tenant activo» block, the one tenant-scoped part of the screen. It SHALL contain:
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
(Previously: the panel was read-only and nothing in the console called the test route.)

#### Scenario: Viewing a template
- **WHEN** the operator presses "Ver" on "Stock diario"
- **THEN** the panel shows its entities, parameters and statement, as text

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
