# Report Catalog Specification (CH-48 delta)

## ADDED Requirements

### Requirement: Report Runs Share One Path (CH-48, DEC-198, DEC-201)
The console test (`POST /reportes/:id/prueba`, `POST /reportes/prueba`) and the panel run (`client-panel-dashboard`) SHALL execute a report through one shared function. Given a report, a connection, an optional number of days, the deployment zone and `maxFilasPorConsulta`, it SHALL:
- choose the days: the requested value when declared, the first declared when none is requested, and a refusal when the value is not declared or the report has no period;
- compute the date as "Declared Period" says and bind it as a driver parameter (rule 4);
- use the visualization's ceiling ("Row Cap by Visualization"), ask for one row more and the first page only;
- run through the engine path with the DEC-71 gate, unchanged;
- answer the engine's verdict and the `periodo` used (`{ dias, desde }` or null).

Each caller SHALL keep its own answer shape and its own audit choice: the console test records `reporte-prueba` as "Every Audited Path Records Its Execution" says, and the panel run records no audit row (DEC-202). The console test's routes, checks and answers SHALL NOT change.

#### Scenario: The console test is unchanged
- **GIVEN** the existing tests of `POST /reportes/:id/prueba` and `POST /reportes/prueba`
- **WHEN** they run after the extraction
- **THEN** they pass without changes

#### Scenario: The same date on both paths
- **GIVEN** a report declaring days [7, 30] and a fixed clock
- **WHEN** the console test and the panel run it with 7 days
- **THEN** both bind the same date and ask for the same ceiling plus one
