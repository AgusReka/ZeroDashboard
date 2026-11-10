# Client Panel Dashboard Specification

## Purpose
The client's dashboard in the panel (stories **R3h**, **R4h**, **R5h**): the reports P1 put on the tenant's dashboard (`tenant-dashboard`), each run live on the dashboard's connection, with a period chosen among the days P1 declared, the freshness of the business's data as information, and an accessible table for every chart. No row is stored (DEC-93). Decisions: DEC-183, DEC-184, DEC-198, DEC-199, DEC-200, DEC-201, DEC-202.

## Requirements

### Requirement: Dashboard Routes Are Session-Locked Panel Rows (DEC-135, DEC-201)
`GET /api/panel/tablero` and `GET /api/panel/tablero/:reporteId/resultado` SHALL be exact rows of `RUTAS_PANEL_PUBLICAS`, SHALL run behind the panel session hook, and SHALL act only inside the session tenant's context (`tenant-isolation`, "Panel Tenant Derivation Is Session-Locked"). Without a valid session they SHALL answer `401 sesion-invalida` and run nothing. Both answers SHALL carry `Cache-Control: no-store`. The rows SHALL be exact: another method or a longer path SHALL stay scoped and fail closed.

#### Scenario: No session
- **WHEN** either route is called with no cookie
- **THEN** the answer is 401 `sesion-invalida`, nothing is read and nothing is dialed

#### Scenario: The rows are exact
- **WHEN** `POST /api/panel/tablero` or `GET /api/panel/tablero/r-1/resultado/extra` is sent without `X-Tenant-Id`
- **THEN** it is not exempt from the header hooks

#### Scenario: Nothing is cached
- **WHEN** either route answers 200
- **THEN** the answer carries `Cache-Control: no-store`

### Requirement: Read the Dashboard Configuration (DEC-201)
`GET /api/panel/tablero` SHALL answer, for the session tenant:
- `reportes`: the dashboard's reports in dashboard order, each with `id`, `titulo`, `descripcion` (or null), `visualizacion` (`numero`, `tabla`, `barras` or `linea`) and `periodo`: `{ dias, predeterminado }` with the declared days and the first of them, or null when the report has no period;
- `datos`: `{ actualizadosEn }`, the tenant's `replicaActualizadaEn` as an ISO instant, or null when it was never declared;
- `zonaHoraria`: the deployment zone (DEC-77), used by the page to format dates.

A tenant with no dashboard, or with an empty one, SHALL answer `reportes: []`. The route SHALL NOT run anything against the client's database and SHALL write nothing. The answer SHALL NOT contain a report's `nombre`, SQL, entities, assigned column names, `conexionId`, nor any tenant id.

A stored report whose fields are out of the rules SHALL still be listed, with its title, a null `periodo`, and its stored visualization when that is one of the four (otherwise `tabla`). Its run then answers `no-disponible`. The configuration SHALL NOT fail because of it.

#### Scenario: Reports in dashboard order
- **GIVEN** tenant A's dashboard holds "Ventas" (bars, days [30, 7]) and "Stock" (table, no period), in that order
- **WHEN** A's session reads `GET /api/panel/tablero`
- **THEN** `reportes` holds "Ventas" with `periodo` `{ dias: [30, 7], predeterminado: 30 }` first and "Stock" with `periodo` null second

#### Scenario: No dashboard
- **GIVEN** tenant A has no dashboard
- **WHEN** the configuration is read
- **THEN** the answer is 200 with `reportes` []

#### Scenario: No technical field
- **WHEN** the configuration is answered
- **THEN** no key `nombre`, `sql`, `entidades`, `columnas` or `conexionId` appears, and no assigned column name appears in any value

#### Scenario: Freshness never declared
- **GIVEN** tenant A with `replicaActualizadaEn` null
- **THEN** `datos.actualizadosEn` is null

#### Scenario: Reading runs nothing
- **WHEN** the configuration is answered
- **THEN** nothing is dialed and no audit row is written

### Requirement: Run One Report of the Session Tenant's Dashboard (DEC-198, DEC-201)
`GET /api/panel/tablero/:reporteId/resultado` SHALL run one report. Its only inputs SHALL be `:reporteId` and an optional query key `dias`. The checks SHALL run in this order, and each refusal SHALL answer before anything is dialed:
1. `:reporteId` SHALL be one of the ids on the session tenant's dashboard. Otherwise the answer is `404 reporte-no-encontrado`, the same answer for an unknown id and for a report on another tenant's dashboard only.
2. `dias`, when present, SHALL be a string of digits and SHALL be one of the report's declared days. A report without a period SHALL accept no `dias`. Otherwise the answer is `400 solicitud-invalida` with `campos` ["/dias"]. Any other query key SHALL also be `400 solicitud-invalida`.
3. The run SHALL pass the per-tenant gate ("Per-Tenant Run Gate and Single-Flight"), or the answer is `429 demasiadas-solicitudes`.

Without `dias`, the first declared day SHALL be used. The connection SHALL be the dashboard's `conexionId`, never a request value. The run SHALL go through the shared report run of `report-catalog` ("Report Runs Share One Path"): the date computed by the server and bound as a driver parameter (rule 4), the row cap of the visualization, the first page only.

#### Scenario: Another tenant's report
- **GIVEN** report "r-b" is on tenant B's dashboard only
- **WHEN** tenant A's session requests `/api/panel/tablero/r-b/resultado`
- **THEN** the answer is 404 `reporte-no-encontrado` and nothing is dialed

#### Scenario: A report of the catalog not on the dashboard
- **GIVEN** report "r-x" exists in the catalog and is on no dashboard of tenant A
- **WHEN** A requests it
- **THEN** the answer is 404 `reporte-no-encontrado`

#### Scenario: An undeclared period
- **GIVEN** a report on A's dashboard declaring days [7, 30]
- **WHEN** A requests it with `dias=15`, `dias=7.0` or `dias=-7`
- **THEN** the answer is 400 with `/dias` in `campos` and nothing is dialed

#### Scenario: The default period
- **GIVEN** a report declaring days [30, 7]
- **WHEN** it is requested with no `dias`
- **THEN** it runs with 30 days, and the answer's `periodo.dias` is 30

#### Scenario: A period on a report without one
- **WHEN** a report with no period is requested with `dias=7`
- **THEN** the answer is 400 with `/dias` in `campos`

### Requirement: Closed Result States Without Technical Detail (DEC-137, DEC-201)
Once the report is resolved and admitted, the answer SHALL be 200 with one `estado`:

| `estado` | When |
|---|---|
| `ok` | The run succeeded with at least one row, every assigned column is present, and for `numero`, `barras` and `linea` every `valor` is a number |
| `sin-datos` | The run succeeded with zero rows and every assigned column is present |
| `no-disponible` | The DEC-71 gate refused, the credential is unreadable, the dashboard's connection is gone, the stored report is out of the rules, an assigned column is missing, or a `valor` is not a number |
| `tiempo-agotado` | The run failed with category `tiempo-agotado`, in any phase |
| `sin-conexion` | The run failed in the connection phase for any other reason |
| `error` | Any other failure |

With `ok` the answer SHALL also hold `columnas` (`[{ rol, titulo }]` in assignment order), `filas` (positional, projected as "Projection to the Assigned Columns"), `corte` (boolean) and `periodo` (`{ dias, desde }` or null). Every other state SHALL hold only `estado`. No answer SHALL contain a category, a code, a phase, a column name, an entity, a view, a connection or SQL text.

#### Scenario: Unapproved views
- **GIVEN** the dashboard's connection has the report's `pedido` view unapproved
- **WHEN** the report is requested
- **THEN** the answer is 200 `{ estado: "no-disponible" }` and does not name `pedido`

#### Scenario: A renamed column
- **GIVEN** a report assigning `total`, whose result no longer has it
- **WHEN** it is requested
- **THEN** the answer is 200 `{ estado: "no-disponible" }` and does not contain "total"

#### Scenario: A slow store
- **GIVEN** the run fails with category `tiempo-agotado`
- **THEN** the answer is 200 `{ estado: "tiempo-agotado" }`

#### Scenario: The store cannot be reached
- **GIVEN** the run fails in the connection phase with category `host-inalcanzable`
- **THEN** the answer is 200 `{ estado: "sin-conexion" }`

#### Scenario: Zero rows
- **GIVEN** the run succeeds with no rows and every assigned column present
- **THEN** the answer is 200 `{ estado: "sin-datos" }`

#### Scenario: A corrupt stored report
- **GIVEN** a report on the dashboard whose stored `columnas` are out of the rules
- **WHEN** it is requested
- **THEN** the answer is 200 `{ estado: "no-disponible" }`, an `error` line is logged, and nothing is dialed

### Requirement: Projection to the Assigned Columns (Rule 5, DEC-93, DEC-198)
For `ok`, the server SHALL find the index of each assigned column in the result's columns and SHALL build each answer row from those indexes only, in assignment order. Every other value SHALL be dropped in memory and SHALL NOT be serialized, logged or stored. Values SHALL be normalized:
- a date or timestamp at midnight UTC as `YYYY-MM-DD`, any other instant as its ISO string;
- for the `valor` role of `numero`, `barras` and `linea`, a finite number, or a string of a finite decimal number converted to a number. Anything else makes the state `no-disponible`;
- for `tabla` and for `etiqueta`, strings, numbers, booleans and null as returned, and any other value as its string.

`corte` SHALL be true when the engine reported a cut at the visualization's cap.

#### Scenario: Unassigned columns never leave
- **GIVEN** a bar report assigning `producto` (label) and `unidades` (value), whose statement also returns `email`
- **WHEN** it runs
- **THEN** each row of the answer has exactly two values, `producto` then `unidades`, and no value of `email` appears in the answer

#### Scenario: A numeric string becomes a number
- **GIVEN** a `numero` report whose `valor` arrives as the string "1520.50"
- **THEN** the answer's row is [1520.5]

#### Scenario: A non-numeric value in a chart
- **GIVEN** a `linea` report whose `valor` is "n/a" in one row
- **THEN** the answer is `{ estado: "no-disponible" }`

#### Scenario: A date label
- **GIVEN** a `linea` report whose `etiqueta` is the date 2026-11-03
- **THEN** the label in the answer is "2026-11-03"

#### Scenario: The cap
- **GIVEN** a `barras` report whose statement returns 35 rows
- **THEN** the answer holds 20 rows and `corte` true

### Requirement: Per-Tenant Run Gate and Single-Flight (DEC-201)
The server SHALL admit at most 3 report runs in flight per tenant. Further runs SHALL wait in a FIFO queue of at most 8 per tenant. A request beyond that SHALL answer `429 demasiadas-solicitudes` without running. Both numbers SHALL be constants in the code.

A request for the same `(tenant, report, days)` as a run already queued or in flight SHALL share that run's answer and SHALL NOT take another place. The shared entry SHALL be removed when the run ends, whatever its result, so no result outlives its run. A queued run whose every request has closed SHALL be dropped without running. A slot SHALL be released when its run ends, also when it throws. The gate SHALL hold nothing of a tenant once its runs end.

#### Scenario: A fourth run waits
- **GIVEN** three runs of tenant A in flight
- **WHEN** a fourth distinct run of A arrives
- **THEN** it starts only after one of the three ends

#### Scenario: Another tenant is not delayed
- **GIVEN** three runs of tenant A in flight
- **WHEN** a run of tenant B arrives
- **THEN** it starts at once

#### Scenario: Beyond the queue
- **GIVEN** three runs of A in flight and eight queued
- **WHEN** another distinct run of A arrives
- **THEN** the answer is 429 `demasiadas-solicitudes` and nothing runs for it

#### Scenario: Identical requests share one run
- **GIVEN** a run of report "r-1" with 30 days in flight for A
- **WHEN** a second request for "r-1" with 30 days arrives from A
- **THEN** the engine is called once and both requests receive the same answer

#### Scenario: Nothing is kept after a run
- **GIVEN** a run of "r-1" with 30 days for A has ended
- **WHEN** the same request arrives again
- **THEN** the engine is called again

#### Scenario: A closed request is dropped
- **GIVEN** a queued run of A whose only request has closed
- **WHEN** a slot frees
- **THEN** that run does not reach the engine

#### Scenario: A failing run frees its slot
- **GIVEN** a run that throws
- **THEN** its slot is released and the next queued run starts

### Requirement: Panel Runs Leave a Closed Log Line (DEC-202)
Each run that reached the engine SHALL log one `info` line with exactly `tenantId`, `reporteId`, `conexionId`, `estado`, `filas` (row count, or null) and `duracionMs`. No line SHALL hold SQL text, the computed date, a value or a returned row. A run that failed SHALL also log the sanitized `warn` line the engine path logs today. The panel run SHALL NOT log the "audit skipped: no operator" line.

#### Scenario: One closed line per run
- **WHEN** a panel run answers `ok` with 12 rows
- **THEN** one `info` line is logged with the six fields, `filas` 12, and no other key carrying data

#### Scenario: No missing-operator error
- **WHEN** a panel run completes
- **THEN** no `error` line is logged

### Requirement: Freshness Line Is Information Only (R5h, DEC-142, DEC-183)
The dashboard section SHALL show one line from `datos.actualizadosEn`:
- with a date: «Datos de tu negocio actualizados hace N h» (or minutes, or days), followed by the absolute `dd/mm, HH:mm` in `zonaHoraria`;
- with null: «Todavía no tenemos la fecha de actualización de tus datos.»

Null SHALL never read as current. The line SHALL NOT block, delay or change any run, and SHALL show while the reports load.

#### Scenario: A known update
- **GIVEN** `actualizadosEn` three hours before now
- **THEN** the line reads «Datos de tu negocio actualizados hace 3 h» with the absolute time

#### Scenario: An unknown update
- **GIVEN** `actualizadosEn` null
- **THEN** the line reads «Todavía no tenemos la fecha de actualización de tus datos.»

### Requirement: Dashboard Section of the Panel Page (P-08, R3h)
When the configuration answers at least one report, the authenticated panel page SHALL show a navigation with «Tablero» (`#tablero`) and «Avisos» (`#avisos`), as links whose current one carries `aria-current="page"`. «Tablero» SHALL be the default when the hash names neither. «Avisos» holds «Mis automatizaciones» and the Telegram card. With no reports, or when the configuration fails, the page SHALL show no navigation and only the «Avisos» content, as today.

The «Tablero» section SHALL hold the freshness line, «Actualizar», and one card per report in dashboard order, each with the report's title, its description when present, and its body:
- `numero`: the value formatted with `Intl.NumberFormat('es-AR')`, labeled with the column title;
- `tabla`: a table with a `<caption>`, one `<th scope="col">` per column title, and the rows. A column is right-aligned and formatted `es-AR` only when it has a value and every non-empty value in it is a number or a decimal number as text without a leading zero (a `COUNT` or `SUM` the driver returns as "26"); any other column, labels and codes included, stays text;
- `barras` and `linea`: the chart of "Charts and Their Accessible Table".

The page SHALL ask for the configuration first, then the runs, at most 3 at a time, in dashboard order. Each card SHALL show its own loading skeleton, and then its state:

| State | What the card shows |
|---|---|
| `ok` | The body. With `corte`, «Mostramos solo los primeros N resultados.» with N the cap of the visualization. With `periodo`, «Desde el dd/mm», or «Desde el dd/mm/aaaa» when that year is not the current one in the tenant's time zone. |
| `sin-datos` | «No hay datos para este período.» |
| `no-disponible` | That the report cannot be shown for now and that the team is told, with no action for the client |
| `tiempo-agotado` | «Tu tienda tardó demasiado en responder.» and «Reintentar» |
| `sin-conexion` | That the business's data could not be reached right now, and «Reintentar» |
| `error`, `429`, a network failure or a `5xx` | A generic message in business language and «Reintentar» |
| `401` | The page reloads, so the server renders the login |

«Reintentar» SHALL re-run only its card. «Actualizar» SHALL re-read the configuration and re-run every card, and SHALL be disabled while any request of the section is pending. The page SHALL have no timer that refreshes the dashboard.

Every value SHALL enter the page through `textContent` or Chart.js. No copy SHALL contain a glossary-forbidden term (`client-panel-automations`, "No Technical Terms in the Client Surface"). The page script SHALL send no tenant identifier in any header, query or body.

#### Scenario: Navigation appears only with reports
- **GIVEN** a configuration with `reportes` []
- **THEN** no navigation is shown and «Mis automatizaciones» is visible as today

#### Scenario: Default section
- **GIVEN** a configuration with two reports and no hash
- **THEN** «Tablero» is visible, its link carries `aria-current="page"`, and «Avisos» is hidden

#### Scenario: At most three runs at a time
- **GIVEN** a configuration with five reports
- **WHEN** the page loads and no run has answered
- **THEN** exactly three run requests have been sent, for the first three reports

#### Scenario: One slow card does not block the others
- **GIVEN** the first report has not answered and the second answered `ok`
- **THEN** the second card shows its body and the first its skeleton

#### Scenario: A failing card
- **GIVEN** a run answers `{ estado: "tiempo-agotado" }`
- **THEN** that card shows «Tu tienda tardó demasiado en responder.» and «Reintentar», and the other cards are unaffected

#### Scenario: A number card
- **GIVEN** a `numero` run answering `ok` with `columnas` [{ rol: "valor", titulo: "Ventas del mes" }] and `filas` [[1520.5]]
- **THEN** the card shows «1.520,5» labeled «Ventas del mes»

#### Scenario: Markup in a value is text
- **WHEN** a table value or a title contains `<b>`
- **THEN** it is shown verbatim and no element is created from it

#### Scenario: No automatic refresh
- **WHEN** the page has loaded every card
- **THEN** no further request is sent until the client presses «Actualizar», «Reintentar» or changes a period

### Requirement: Period Select per Report (R4h, DEC-198, DEC-201)
A card whose report has a `periodo` SHALL show a select, labeled «Período», with one option per declared day in declared order, each reading «Últimos N días», starting on `predeterminado`. Changing it SHALL re-run only that card with `dias` set to the chosen value. The choice SHALL NOT be stored: a reload starts on `predeterminado`. A card without `periodo` SHALL show no select and SHALL send no `dias`.

#### Scenario: Changing the period re-runs one card
- **GIVEN** two cards, the first declaring days [30, 7]
- **WHEN** the client chooses «Últimos 7 días» on the first
- **THEN** one request is sent, for the first report with `dias=7`, and the second card is not re-run

#### Scenario: A report without a period
- **GIVEN** a card whose report has `periodo` null
- **THEN** it shows no select and its request carries no `dias`

### Requirement: Charts and Their Accessible Table (DEC-184, DEC-200)
`barras` and `linea` cards SHALL draw with the vendored Chart.js, loaded by `<script src="/ui/vendor/chart.umd.js">` in the authenticated shell only, before the dashboard script. Each chart SHALL:
- sit on a `<canvas role="img">` whose `aria-label` names the report title and the lowest and highest values;
- use one series, colored from the design tokens read with `getComputedStyle` (`--accent` for the series, `--text-2` for ticks and legend, `--border-1` for the grid, `--font-sans` for text), never a Chart.js palette;
- re-read the tokens and update when `prefers-color-scheme` changes or when `data-theme` on the document changes;
- be destroyed before its card re-runs or its period changes.

Each chart card SHALL also hold a `<details>` whose summary reads «Ver los datos en una tabla», collapsed by default, with a table of the same rows, a `<caption>` and `<th scope="col">` headers. When Chart.js is not available (`typeof Chart === 'undefined'`), the card SHALL show that table open, with no technical message.

#### Scenario: A bar chart with its table
- **GIVEN** a `barras` run answering `ok` with three rows
- **THEN** the card holds a `canvas` with `role="img"` and an `aria-label` naming the title, and a collapsed «Ver los datos en una tabla» whose table has three body rows

#### Scenario: The library did not load
- **GIVEN** `Chart` is undefined
- **WHEN** a `linea` card answers `ok`
- **THEN** the card shows the table, open, and no canvas

#### Scenario: Theme change
- **GIVEN** a drawn chart
- **WHEN** `data-theme` flips to `dark`
- **THEN** the chart's colors are re-read from the tokens and the chart is updated

#### Scenario: Re-running destroys the old chart
- **GIVEN** a drawn chart
- **WHEN** its period changes
- **THEN** the previous chart instance is destroyed before the new one is drawn
