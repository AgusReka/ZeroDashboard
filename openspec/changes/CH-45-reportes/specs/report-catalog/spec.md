# Report Catalog Specification

## Purpose
A global catalog of reports written by P1 against the canonical `v_*` views (story **R1h**). A report is one query, at most one declared period and one visualization type from a closed list, with the columns each type expects assigned by role. It works for every mapped tenant without rewriting, and its rows are never stored. Decisions: DEC-183, DEC-184, DEC-198. The per-tenant dashboard (CH-46) and the panel view (CH-48) build on it.

## Requirements

### Requirement: Report Fields
A `Reporte` SHALL hold:

| Field | Rule |
|---|---|
| `nombre` | Required, 1 to 80 characters after trimming. For the operator only. |
| `titulo` | Required, 1 to 80 characters after trimming. Text for the client: it SHALL pass the panel glossary. |
| `descripcion` | Optional, at most 200 characters after trimming, and it SHALL pass the panel glossary. Blank is stored as null. |
| `sql` | Required, not blank once sanitized. |
| `entidades` | One or more distinct canonical entities. |
| `visualizacion` | One of `numero`, `tabla`, `barras`, `linea`. |
| `columnas` | The assigned columns, defined in "Columns by Role". |
| `periodo` | Null, or the declared period defined in "Declared Period". |

The value lists SHALL live in code, not in a database enum. A body with an unknown key, or with a value outside a list, SHALL be `400 solicitud-invalida` naming the field in `campos`. A glossary refusal SHALL also list the forbidden terms in `terminos`.

#### Scenario: A complete report is accepted
- **GIVEN** a body with `nombre` "Ventas por producto", `titulo` "Lo más vendido", `entidades` ["producto", "pedido"], `visualizacion` "barras", valid `columnas` and `columnasPrueba`, and `periodo` null
- **WHEN** it is sent to `POST /reportes`
- **THEN** the answer SHALL be 201 with the stored report and its id

#### Scenario: An unknown visualization
- **WHEN** `visualizacion` is "torta"
- **THEN** the answer SHALL be 400 `solicitud-invalida` with `/visualizacion` in `campos`

#### Scenario: A technical word in the client title
- **WHEN** `titulo` contains a term the panel glossary forbids
- **THEN** the answer SHALL be 400 with `/titulo` in `campos` and the term in `terminos`

### Requirement: Declared Period (DEC-198)
`periodo` SHALL be null or an object with exactly `parametro` and `dias`.
- `parametro` SHALL be a valid parameter name under the rules of saved queries (DEC-49).
- `dias` SHALL hold 1 to 6 distinct integers, each from 1 to 366. The first value is the default.

The report's parameter declaration SHALL be derived from `periodo`: empty when it is null, and otherwise one parameter named `parametro`, of type `fecha`. A report SHALL NOT declare any other parameter. The statement SHALL be checked against that derived declaration exactly as a template is (DEC-56, DEC-57, DEC-59), so a statement with an undeclared marker, a hand-written `$n`, or a declared period it never uses SHALL be refused with the same `problemas`.

At run time the value SHALL be the current day in the deployment zone (DEC-77) minus the chosen number of days, as `YYYY-MM-DD`. The server SHALL compute it and pass it as a driver parameter (rule 4). No request SHALL carry a date for a report.

#### Scenario: A period with its default
- **GIVEN** a report with `periodo` `{ "parametro": "desde", "dias": [30, 7, 90] }`
- **WHEN** it is tested without `dias`
- **THEN** 30 days SHALL be used

#### Scenario: The date follows the deployment zone
- **GIVEN** the zone `America/Argentina/Buenos_Aires` and the instant 2026-11-07T02:00:00Z, which is 2026-11-06 there
- **WHEN** a report runs with 7 days
- **THEN** the bound value SHALL be "2026-10-30"

#### Scenario: A marker the period does not declare
- **GIVEN** `periodo` with `parametro` "desde"
- **WHEN** the statement uses `:hasta`
- **THEN** the answer SHALL be 400 with a `sin-declarar` problem for `hasta`

#### Scenario: A declared period the statement never uses
- **WHEN** `periodo` names "desde" and the statement has no `:desde`
- **THEN** the answer SHALL be 400 with a `sin-usar` problem

#### Scenario: Repeated or out-of-range days
- **WHEN** `dias` is [7, 7], [0], [400] or []
- **THEN** the answer SHALL be 400 with `/periodo/dias` in `campos`

### Requirement: Columns by Role (DEC-198)
`columnas` SHALL be an ordered list of `{ rol, columna, titulo }`.
- `columna` SHALL be 1 to 63 characters.
- `titulo` SHALL be 1 to 40 characters after trimming, and it SHALL pass the panel glossary.
- No two entries SHALL name the same `columna`.

The roles SHALL depend on `visualizacion`:

| `visualizacion` | Entries |
|---|---|
| `numero` | Exactly one, with `rol` `valor`. |
| `barras`, `linea` | Exactly two: `etiqueta` first, then `valor`. |
| `tabla` | 1 to 10, every one with `rol` `columna`, in the order the table shows them. |

Any other shape SHALL be 400 with `/columnas` in `campos`.

#### Scenario: Bars need a label and a value
- **WHEN** a `barras` report assigns only `valor`
- **THEN** the answer SHALL be 400 with `/columnas` in `campos`

#### Scenario: A table keeps the declared order
- **GIVEN** a `tabla` report with columns `producto`, `unidades` and `total`, in that order
- **WHEN** it is read back
- **THEN** `columnas` SHALL list them in the same order, with their titles

#### Scenario: The same column twice
- **WHEN** a `barras` report assigns `total` to both roles
- **THEN** the answer SHALL be 400 with `/columnas` in `campos`

### Requirement: Saving Checks the Columns of the Last Test (DEC-198)
`POST /reportes` and `PUT /reportes/:id` SHALL require `columnasPrueba`, the column names of the test that preceded the save, with at most 200 names. Every assigned `columna` SHALL be in it. Otherwise the answer SHALL be 400: with `/columnasPrueba` in `campos` when the field is absent, and with `/columnas` in `campos` and the missing names in `faltantes` when a column is not in the list. `columnasPrueba` SHALL NOT be stored.

#### Scenario: A column the test did not return
- **GIVEN** `columnasPrueba` ["producto", "unidades"]
- **WHEN** the report assigns `total`
- **THEN** the answer SHALL be 400 with `faltantes` ["total"]

#### Scenario: No preceding test
- **WHEN** `columnasPrueba` is absent
- **THEN** the answer SHALL be 400 with `/columnasPrueba` in `campos`

### Requirement: Catalog Routes
The routes SHALL be:
- `GET /reportes` lists `id`, `nombre`, `titulo` and `visualizacion`, ordered by `nombre`. The list SHALL be capped by `LIMITE_LISTADO` and SHALL report `truncado`, as `GET /plantillas` does.
- `GET /reportes/:id` answers the whole report, or 404 `reporte-no-encontrado`.
- `POST /reportes` creates a report.
- `PUT /reportes/:id` replaces the whole report in place, keeping its id, or answers 404 `reporte-no-encontrado` (DEC-68).

No route SHALL delete a report. Every route SHALL require an operator session. The catalog routes SHALL NOT read or write any tenant-scoped model.

#### Scenario: Replace in place
- **GIVEN** a report with id "r-1"
- **WHEN** `PUT /reportes/r-1` changes its statement
- **THEN** `GET /reportes/r-1` SHALL answer the new statement under the same id

#### Scenario: No delete
- **WHEN** `DELETE /reportes/r-1` is sent with an operator session and a selected tenant
- **THEN** the answer SHALL be 404 and the report SHALL remain

#### Scenario: No operator session
- **WHEN** `GET /reportes` is sent without an operator session
- **THEN** the answer SHALL be 401

### Requirement: Row Cap by Visualization (DEC-198)
Every report execution SHALL use, as both page size and row ceiling, the smaller of the visualization's cap and `maxFilasPorConsulta`. The caps are `numero` 1, `barras` 20, `tabla` 50 and `linea` 100. It SHALL ask for the first page only. A result ended by the ceiling SHALL carry `corte`, as any execution does (DEC-18).

#### Scenario: Bars are cut at twenty
- **GIVEN** a `barras` report whose statement returns 35 rows
- **WHEN** it is tested
- **THEN** 20 rows SHALL be returned with a non-null `corte`

#### Scenario: A lower global ceiling wins
- **GIVEN** `maxFilasPorConsulta` is 30
- **WHEN** a `linea` report is tested
- **THEN** at most 30 rows SHALL be returned

### Requirement: Testing a Report on a Tenant Connection
`POST /reportes/:id/prueba` tests a stored report. `POST /reportes/prueba` tests an unsaved one: its body is the report body plus the test fields, with `columnas` and `columnasPrueba` optional and every other check of "Report Fields" and "Declared Period" applied. The test fields SHALL be:
- `conexionId`, required.
- `dias`, required to be one of the declared values when the report has a period. It is optional because the default applies, and it SHALL be refused when the report has no period.

Both routes SHALL run, in this order:
1. Check that the connection belongs to the active tenant (404 `conexion-no-encontrada`).
2. Apply the DEC-71 gate on the report's entities (409 `vista-canonica-no-aprobada`, listing the entities).
3. Compose the statement over the approved views, prepare it with the computed date, and resolve the credential (409 `credencial-ilegible`).
4. Execute it with the row cap of its visualization.

Every refusal SHALL answer before anything is dialed. A completed attempt SHALL be 200 with the execution verdict, as `POST /plantillas/:id/prueba` answers it, plus:
- `periodo`: `{ dias, desde }` with the value used, or null when the report has no period.
- `faltantes`: on a successful result, the assigned columns the result did not return, in assignment order. It is empty when all are present or none are assigned.

The tenant SHALL come only from the operator's selected tenant, never from the body (rule 2). No returned row SHALL be stored (DEC-93).

#### Scenario: Testing on two tenants without rewriting
- **GIVEN** a report over `producto`, and tenants A and B whose `producto` views are approved on their own connections
- **WHEN** the operator tests it on A's connection and then on B's
- **THEN** both answers SHALL be 200 `ok`, each with its own tenant's rows

#### Scenario: Another tenant's connection
- **GIVEN** tenant A selected
- **WHEN** the test names a connection of tenant B
- **THEN** the answer SHALL be 404 `conexion-no-encontrada` and nothing SHALL be dialed

#### Scenario: Views not approved
- **WHEN** the active tenant's `pedido` view is not approved
- **THEN** the answer SHALL be 409 `vista-canonica-no-aprobada` naming `pedido`

#### Scenario: A period that was not declared
- **GIVEN** a report declaring `dias` [7, 30]
- **WHEN** the test sends `dias` 15
- **THEN** the answer SHALL be 400 with `/dias` in `campos` and nothing SHALL be dialed

#### Scenario: A missing column after a rename
- **GIVEN** a stored report assigning `total` whose view no longer returns it
- **WHEN** it is tested
- **THEN** the answer SHALL be 200 `ok` with `faltantes` ["total"]

#### Scenario: Testing before assigning columns
- **GIVEN** an unsaved report with no `columnas`
- **WHEN** `POST /reportes/prueba` reaches the engine
- **THEN** the answer SHALL be 200 with the result's columns and `faltantes` []

### Requirement: Reports Are Not a Query Builder (DEC-183)
A report's statement SHALL be written only by an operator in the console. No route outside the console SHALL accept report SQL, and the period SHALL be its only variable part. The statement is not parsed (DEC-09). The application does not enforce that it reads only `v_*`: that limit of the artifact is documented, and read-only stays enforced by the execution layers (rule 3).

#### Scenario: The period is the only input
- **WHEN** a report test carries any key other than `conexionId` and `dias`, beyond the report body itself
- **THEN** the answer SHALL be 400 `solicitud-invalida`

#### Scenario: A data-modifying statement
- **WHEN** a report whose statement is a data-modifying CTE (`WITH d AS (DELETE FROM x RETURNING 1) SELECT * FROM d`) is tested
- **THEN** the answer SHALL be the usual 200 `fallo` with `categoria` "no-es-lectura"
- **AND** a bare `DELETE FROM x`, nested by the composition, SHALL fail as `error-sintaxis`, as a template does
