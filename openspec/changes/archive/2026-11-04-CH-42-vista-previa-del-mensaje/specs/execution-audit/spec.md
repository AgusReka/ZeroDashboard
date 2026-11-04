# Execution Audit Specification (CH-42 delta)

## Purpose
The message preview runs a query against the client's database from the console, so it is audited like the template test, under its own origin so the operator can tell it apart (A5, DEC-189, DEC-195). The row names the template, not the automation: `RegistroEjecucion` has no column for it.

## MODIFIED Requirements

### Requirement: Audit Record
The system SHALL keep a table `RegistroEjecucion`, tenant-scoped by the isolation extension and with no foreign keys, whose rows hold: `tenantId` and `tenantNombre`, `operadorId` and `operadorNombre` (copied at write time), `origen` (`consulta`, `plantilla-prueba`, `validacion-mapeo`, `conexion-prueba` or `automatizacion-vista-previa`), `conexionId`, the saved query reference (`consultaGuardadaId`, `consultaVersion`, `consultaNombre`) or `plantillaId` when they apply, `sql` (the full statement or statements executed), `resultado` (`ok` or `fallo`), `fase`, `categoria` and `codigo` when it failed, `filas` and `duracionMs` when known, and `creadoEn`. A row SHALL NOT hold parameter values nor any returned row (DEC-93, DEC-160). `origen` stays free text in the schema, so the new value needs no migration.
(Previously: `automatizacion-vista-previa` was not an origin.)

#### Scenario: An ad hoc query is recorded
- **GIVEN** operator "ana" logged in and tenant A selected
- **WHEN** she runs `SELECT 1` through `POST /consultas/ejecutar`
- **THEN** one row exists with tenant A, operator "ana", `origen` "consulta", the connection, `sql` "SELECT 1", `resultado` "ok", `filas` 1 and no saved query

#### Scenario: Bound values never reach the record
- **WHEN** a query with `:desde` runs with the value "2026-01-01"
- **THEN** the row's `sql` holds the placeholder text as sent and no column holds "2026-01-01"

### Requirement: Every Audited Path Records Its Execution
Each of `POST /consultas/ejecutar`, `POST /plantillas/:id/prueba`, `POST /plantillas/prueba`, `POST /conexiones/:id/validacion-mapeo`, `POST /conexiones/:id/prueba` and `POST /automatizaciones/:id/vista-previa` SHALL write exactly one row per request that reached the execution engine, after the engine answered, with the request's operator. A request refused before the engine runs (invalid body, unknown or deactivated automation, unknown id, stale stored values, unreadable credential, unapproved view) SHALL write nothing. The template tests SHALL record `origen` "plantilla-prueba" and the composed statement; the stored-template test SHALL record the template id and the unsaved-template test SHALL record `plantillaId` null. The message preview SHALL record `origen` "automatizacion-vista-previa", the automation's connection, the composed statement and the automation's template id, and SHALL NOT record the automation, the recipients nor any part of the message. The mapping validation SHALL record the probe statements of every entity it ran and `fallo` if any entity or the session failed; the connection probe SHALL record its fixed probe statement.
(Previously: the message preview did not exist.)

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
