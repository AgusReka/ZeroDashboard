# Report Catalog Specification (CH-46 delta)

## MODIFIED Requirements

### Requirement: Catalog Routes
The routes SHALL be:
- `GET /reportes` lists `id`, `nombre`, `titulo` and `visualizacion`, ordered by `nombre`. The list SHALL be capped by `LIMITE_LISTADO` and SHALL report `truncado`, as `GET /plantillas` does.
- `GET /reportes/:id` answers the whole report with `enUso`, or 404 `reporte-no-encontrado`.
- `POST /reportes` creates a report.
- `PUT /reportes/:id` replaces the whole report in place, keeping its id, or answers 404 `reporte-no-encontrado` (DEC-68). It answers 409 `reporte-en-uso` when the report is on any tenant's dashboard (DEC-199, see `tenant-dashboard`).

No route SHALL delete a report. Every route SHALL require an operator session. The catalog routes SHALL NOT read or write any tenant-scoped model, except through the audited use port defined in `tenant-isolation`.
(Previously: a report could always be replaced, and `GET /reportes/:id` had no `enUso`.)

#### Scenario: Replace in place
- **GIVEN** a report with id "r-1" on no dashboard
- **WHEN** `PUT /reportes/r-1` changes its statement
- **THEN** `GET /reportes/r-1` SHALL answer the new statement under the same id, with `enUso: false`

#### Scenario: A report in use is not replaced
- **GIVEN** report "r-1" on a tenant's dashboard
- **WHEN** `PUT /reportes/r-1` is sent with a valid body
- **THEN** the answer SHALL be 409 `reporte-en-uso` and the report SHALL be unchanged

#### Scenario: No delete
- **WHEN** `DELETE /reportes/r-1` is sent with an operator session and a selected tenant
- **THEN** the answer SHALL be 404 and the report SHALL remain

#### Scenario: No operator session
- **WHEN** `GET /reportes` is sent without an operator session
- **THEN** the answer SHALL be 401
