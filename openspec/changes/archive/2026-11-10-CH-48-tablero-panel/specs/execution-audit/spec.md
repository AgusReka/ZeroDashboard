# Execution Audit Specification (CH-48 delta)

## ADDED Requirements

### Requirement: Panel Report Runs Are Not Audited (DEC-202)
A report run from the client panel (`GET /api/panel/tablero/:reporteId/resultado`) SHALL NOT write a `RegistroEjecucion` row, whatever its result. The shared engine path SHALL accept an explicit "no audit" option, used only by the panel run. With it, the path SHALL write nothing and SHALL NOT log the missing-operator `error` line. Every console path listed in "Every Audited Path Records Its Execution" SHALL keep recording exactly as before. The panel run's trace is the closed `info` line of `client-panel-dashboard` ("Panel Runs Leave a Closed Log Line").

#### Scenario: A panel run writes no row
- **GIVEN** tenant A's session and a report on A's dashboard
- **WHEN** the report runs from the panel and the engine answers
- **THEN** the count of A's `RegistroEjecucion` rows is unchanged and no `error` line is logged

#### Scenario: The console test still records
- **WHEN** an operator tests the same report through `POST /reportes/:id/prueba`
- **THEN** exactly one row with `origen` "reporte-prueba" is written, as before
