# Execution Audit Specification

## Purpose
A queryable record of what the console executed against a client's database, when, against which tenant and by whom (story **A5**), that the interface cannot delete. Decisions: DEC-159 to DEC-163. Scheduled runs stay in `Ejecucion`.

## Requirements

### Requirement: Audit Record
The system SHALL keep a table `RegistroEjecucion`, tenant-scoped by the isolation extension and with no foreign keys. Its rows hold:
- `tenantId` and `tenantNombre`, and `operadorId` and `operadorNombre`, copied at write time.
- `origen`: `consulta`, `plantilla-prueba`, `validacion-mapeo`, `conexion-prueba`, `automatizacion-vista-previa` or `reporte-prueba`.
- `conexionId`.
- When they apply: the saved query reference (`consultaGuardadaId`, `consultaVersion`, `consultaNombre`), `plantillaId`, or `reporteId`.
- `sql`: the full statement or statements executed.
- `resultado` (`ok` or `fallo`), plus `fase`, `categoria` and `codigo` when it failed.
- `filas` and `duracionMs` when known, and `creadoEn`.

A row SHALL NOT hold parameter values nor any returned row (DEC-93, DEC-160). `origen` stays free text in the schema, so a new value needs no migration.
(Previously: `reporte-prueba` was not an origin and there was no `reporteId`.)

#### Scenario: An ad hoc query is recorded
- **GIVEN** operator "ana" logged in and tenant A selected
- **WHEN** she runs `SELECT 1` through `POST /consultas/ejecutar`
- **THEN** one row exists with tenant A, operator "ana", `origen` "consulta", the connection, `sql` "SELECT 1", `resultado` "ok", `filas` 1 and no saved query

#### Scenario: Bound values never reach the record
- **WHEN** a query with `:desde` runs with the value "2026-01-01"
- **THEN** the row's `sql` holds the placeholder text as sent and no column holds "2026-01-01"

### Requirement: Every Audited Path Records Its Execution
Each of these routes SHALL write exactly one row per request that reached the execution engine, after the engine answered, with the request's operator:
- `POST /consultas/ejecutar`
- `POST /plantillas/:id/prueba` and `POST /plantillas/prueba`
- `POST /conexiones/:id/validacion-mapeo` and `POST /conexiones/:id/prueba`
- `POST /automatizaciones/:id/vista-previa`
- `POST /reportes/:id/prueba` and `POST /reportes/prueba`

A request refused before the engine runs SHALL write nothing. That covers an invalid body, an unknown or deactivated automation, an unknown id, stale stored values, an unreadable credential, an unapproved view and an undeclared period.

What each path records:
- **Template tests:** `origen` "plantilla-prueba" and the composed statement. The stored-template test SHALL record the template id, and the unsaved-template test SHALL record `plantillaId` null.
- **Report tests:** `origen` "reporte-prueba", the composed statement, `plantillaId` null and the report id. The unsaved-report test SHALL record `reporteId` null. Neither SHALL record the computed date.
- **Message preview:** `origen` "automatizacion-vista-previa", the automation's connection, the composed statement and the automation's template id. It SHALL NOT record the automation, the recipients nor any part of the message.
- **Mapping validation:** the probe statements of every entity it ran, and `fallo` if any entity or the session failed.
- **Connection probe:** its fixed probe statement.
(Previously: the report tests did not exist.)

#### Scenario: A read-only rejection is recorded as a failure
- **WHEN** an operator runs `UPDATE x SET y = 1`
- **THEN** the answer is the usual `fallo` with `categoria` "no-es-lectura", and the row says `resultado` "fallo", `fase` "ejecucion", `categoria` "no-es-lectura"

#### Scenario: A refused request records nothing
- **WHEN** `POST /consultas/ejecutar` names an unknown connection
- **THEN** the answer is 404 and no row is written

#### Scenario: An unsaved template test is recorded without a template id
- **WHEN** `POST /plantillas/prueba` reaches the engine
- **THEN** one row is written with `origen` "plantilla-prueba", the composed statement and `plantillaId` null, and no parameter value

#### Scenario: A message preview is recorded under its own origin
- **GIVEN** operator "ana" and an active automation of tenant A on connection "food-store" whose template is "p-1"
- **WHEN** she previews it and the engine answers
- **THEN** exactly one row is written with operator "ana", `origen` "automatizacion-vista-previa", the connection, the composed statement and `plantillaId` "p-1"
- **AND** no column holds a parameter value, a recipient address, the subject or a returned cell

#### Scenario: A refused preview records nothing
- **WHEN** the preview answers 409 for an unapproved view or a deactivated automation, or 404 for another tenant's automation
- **THEN** no row is written

#### Scenario: A report test is recorded under its own origin
- **GIVEN** operator "ana", tenant A, and report "r-1" with a period on `:desde`
- **WHEN** she tests it with 7 days and the engine answers
- **THEN** exactly one row is written with `origen` "reporte-prueba", `reporteId` "r-1", `plantillaId` null and the composed statement holding `:desde`
- **AND** no column holds the computed date or a returned cell

#### Scenario: A refused report test records nothing
- **WHEN** the report test answers 400 for an undeclared period, 404 for another tenant's connection, or 409 for an unapproved view
- **THEN** no row is written

### Requirement: Recording Never Breaks an Execution
A failure to write the audit row SHALL be logged at `error` level, without the statement text, and the execution SHALL answer exactly as it would have.

#### Scenario: The audit write fails
- **GIVEN** the audit write is made to fail
- **WHEN** an operator runs a query
- **THEN** the answer is the normal 200 verdict and an `error` line is logged

#### Scenario: The preview's audit write fails
- **GIVEN** the audit write is made to fail
- **WHEN** an operator previews an automation
- **THEN** the answer is the normal 200 preview, with its decision and message, and an `error` line is logged

### Requirement: The Record Cannot Be Changed
No route SHALL update or delete an audit row. The database SHALL refuse `UPDATE`, `DELETE` and `TRUNCATE` on `RegistroEjecucion` through a trigger created by the migration.

#### Scenario: A direct delete is refused
- **WHEN** code or a direct SQL statement tries to delete or update an audit row
- **THEN** the database raises an error and the row is unchanged

### Requirement: List the Audit
`GET /auditoria` SHALL answer the header tenant's rows, newest first, capped by `LIMITE_LISTADO` with `truncado`, accepting optional query filters `desde` and `hasta` (ISO date-times, inclusive bounds on `creadoEn`) and `resultado` (`ok` or `fallo`). An invalid filter SHALL be 400 `solicitud-invalida` naming it. The route requires an operator session and the tenant header like every console route.

#### Scenario: Only the tenant's rows, filtered
- **GIVEN** rows of tenants A and B, some failed
- **WHEN** tenant A lists with `resultado=fallo`
- **THEN** only A's failed rows appear, newest first

#### Scenario: An invalid filter
- **WHEN** `desde` is "ayer" or `resultado` is "quizas"
- **THEN** the answer is 400 `solicitud-invalida` with the filter in `campos`

### Requirement: The Demo Seed's Validation Is Audited
When the demo seed validates the mapping, it SHALL write exactly one `RegistroEjecucion` row with the tenant "Food Store", the operator `demo`, `origen` `validacion-mapeo`, the connection, the probe statements of every entity in contract order, and the result, exactly as `POST /conexiones/:id/validacion-mapeo` would record it.

#### Scenario: Auditing the seed's probe
- **WHEN** the demo seed validates the five entities
- **THEN** one row exists with operator `demo`, `origen` "validacion-mapeo", the five probe statements and `resultado` "ok"
