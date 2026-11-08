# Tenant Dashboard Specification

## Purpose
Each tenant's dashboard: which reports of the global catalog the client sees, in what order, and on which connection they run (story **R2h**). It is tenant configuration with no rows (DEC-93). Decisions: DEC-183, DEC-199. CH-48 renders it in the panel.

## Requirements

### Requirement: One Dashboard per Tenant (DEC-199)
A tenant SHALL have at most one dashboard. A dashboard holds:
- `conexionId`: one of the tenant's connections;
- `reportes`: an ordered list of 0 to 8 distinct report ids from the catalog.

The order of `reportes` is the order the client sees. An empty list SHALL be valid and means the client sees no reports. A tenant with no dashboard SHALL read as no connection and no reports.

#### Scenario: A tenant with no dashboard
- **GIVEN** tenant A has never saved a dashboard
- **WHEN** `GET /tablero` is sent with tenant A
- **THEN** the answer SHALL be 200 with `conexionId` null and `reportes` []

#### Scenario: An empty dashboard is kept
- **WHEN** tenant A saves a dashboard with no reports
- **THEN** `GET /tablero` SHALL answer its connection and `reportes` []

### Requirement: Read the Dashboard
`GET /tablero` SHALL answer the active tenant's dashboard. It requires an operator session and the tenant header, like every console route. The answer SHALL be `conexionId` and `reportes`. Each report entry SHALL hold:
- `id`, `nombre`, `titulo` and `visualizacion`;
- `pendientes`: the report's entities whose views are not approved on the dashboard's connection, in contract order. It is empty when all are approved.

`pendientes` SHALL be computed from the connection's mapping rows with the DEC-71 rule. It SHALL be informative only and SHALL NOT run anything against the replica.

#### Scenario: Pending views
- **GIVEN** tenant A's dashboard on "food-store" holds a report over `producto` and `pedido`, and only `producto` is approved there
- **WHEN** `GET /tablero` is sent
- **THEN** that report SHALL have `pendientes` ["pedido"]

#### Scenario: Nothing is executed
- **WHEN** `GET /tablero` is answered
- **THEN** no query SHALL be sent to the replica and no audit row SHALL be written

### Requirement: Save the Dashboard (DEC-199)
`PUT /tablero` SHALL replace the active tenant's whole dashboard, creating it if there is none. The body SHALL be exactly `conexionId` (required) and `reportes` (required, an array of strings).

The checks SHALL run in this order, and the first refusal wins:
1. Shape: an unknown key, a missing field, more than 8 reports or a repeated report is `400 solicitud-invalida`, naming the field in `campos`.
2. The connection SHALL belong to the active tenant, or the answer is `404 conexion-no-encontrada`.
3. Every report SHALL exist in the catalog, or the answer is `400 solicitud-invalida` with `/reportes` in `campos` and the unknown ids in `desconocidos`.

Reports whose views are not approved SHALL NOT be refused. On success the answer SHALL be 200 with the same body as `GET /tablero`.

The write SHALL lock the named reports against a concurrent replace (the lock `Report Use Blocks Its Edit` takes) and write the dashboard in one transaction, so a report cannot be edited between the check of the dashboard and its write.

#### Scenario: Saving an ordered dashboard
- **GIVEN** reports "r-1" and "r-2" in the catalog and connection "c-a" of tenant A
- **WHEN** `PUT /tablero` is sent with tenant A, `conexionId` "c-a" and `reportes` ["r-2", "r-1"]
- **THEN** the answer SHALL be 200, and `GET /tablero` SHALL answer "r-2" before "r-1"

#### Scenario: Too many reports
- **WHEN** `reportes` has 9 ids
- **THEN** the answer SHALL be 400 with `/reportes` in `campos`

#### Scenario: A repeated report
- **WHEN** `reportes` is ["r-1", "r-1"]
- **THEN** the answer SHALL be 400 with `/reportes` in `campos`

#### Scenario: Another tenant's connection
- **GIVEN** tenant A selected
- **WHEN** `conexionId` names a connection of tenant B
- **THEN** the answer SHALL be 404 `conexion-no-encontrada` and nothing SHALL be written

#### Scenario: An unknown report
- **WHEN** `reportes` holds "no-existe"
- **THEN** the answer SHALL be 400 with `desconocidos` ["no-existe"] and nothing SHALL be written

#### Scenario: Unapproved views do not block
- **GIVEN** a report whose `pedido` view is not approved on the connection
- **WHEN** it is saved on the dashboard
- **THEN** the answer SHALL be 200, with `pendientes` ["pedido"] for it

### Requirement: Report Use Blocks Its Edit (DEC-199)
A report SHALL be in use when it is on the dashboard of any tenant. `GET /reportes/:id` SHALL return `enUso` as a boolean. `PUT /reportes/:id` SHALL answer `409 reporte-en-uso` for a report in use, after its body checks and before writing.

The check and the write SHALL run in one transaction that locks the report's row, so no dashboard can add the report between them. Use SHALL be read across tenants and SHALL reveal only a boolean: no tenant, dashboard, connection or count.

#### Scenario: A report on another tenant's dashboard
- **GIVEN** report "r-1" is on tenant B's dashboard only
- **WHEN** the operator, with tenant A or no tenant selected, sends `PUT /reportes/r-1`
- **THEN** the answer SHALL be 409 `reporte-en-uso` and the report SHALL be unchanged

#### Scenario: A report that left every dashboard
- **GIVEN** report "r-1" was removed from the only dashboard that held it
- **WHEN** `PUT /reportes/r-1` is sent with a valid body
- **THEN** the answer SHALL be 200

#### Scenario: The flag on read
- **WHEN** `GET /reportes/r-1` is sent for a report on some dashboard
- **THEN** the answer SHALL include `enUso: true`

#### Scenario: An invalid body is refused first
- **GIVEN** report "r-1" in use
- **WHEN** `PUT /reportes/r-1` is sent with an unknown visualization
- **THEN** the answer SHALL be 400, not 409
