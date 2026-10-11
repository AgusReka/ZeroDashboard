# Execution Audit Specification (CH-20, new capability)

## Purpose
A queryable record of what the console executed against a client's database, when, against which tenant and by whom (story **A5**), that the interface cannot delete. Decisions: DEC-159 to DEC-163. Scheduled runs stay in `Ejecucion`.

## ADDED Requirements

### Requirement: Audit Record
The system SHALL keep a table `RegistroEjecucion`, tenant-scoped by the isolation extension and with no foreign keys, whose rows hold: `tenantId` and `tenantNombre`, `operadorId` and `operadorNombre` (copied at write time), `origen` (`consulta`, `plantilla-prueba`, `validacion-mapeo` or `conexion-prueba`), `conexionId`, the saved query reference (`consultaGuardadaId`, `consultaVersion`, `consultaNombre`) or `plantillaId` when they apply, `sql` (the full statement or statements executed), `resultado` (`ok` or `fallo`), `fase`, `categoria` and `codigo` when it failed, `filas` and `duracionMs` when known, and `creadoEn`. A row SHALL NOT hold parameter values nor any returned row (DEC-93, DEC-160).

#### Scenario: An ad hoc query is recorded
- **GIVEN** operator "ana" logged in and tenant A selected
- **WHEN** she runs `SELECT 1` through `POST /consultas/ejecutar`
- **THEN** one row exists with tenant A, operator "ana", `origen` "consulta", the connection, `sql` "SELECT 1", `resultado` "ok", `filas` 1 and no saved query

#### Scenario: Bound values never reach the record
- **WHEN** a query with `:desde` runs with the value "2026-01-01"
- **THEN** the row's `sql` holds the placeholder text as sent and no column holds "2026-01-01"

### Requirement: Every Audited Path Records Its Execution
Each of `POST /consultas/ejecutar`, `POST /plantillas/:id/prueba`, `POST /conexiones/:id/validacion-mapeo` and `POST /conexiones/:id/prueba` SHALL write exactly one row per request that reached the execution engine, after the engine answered, with the request's operator. A request refused before the engine runs (invalid body, unknown id, unreadable credential, unapproved view) SHALL write nothing. The template test SHALL record the composed statement and the template id; the mapping validation SHALL record the probe statements of every entity it ran and `fallo` if any entity or the session failed; the connection probe SHALL record its fixed probe statement.

#### Scenario: A read-only rejection is recorded as a failure
- **WHEN** an operator runs `UPDATE x SET y = 1`
- **THEN** the answer is the usual `fallo` with `categoria` "no-es-lectura", and the row says `resultado` "fallo", `fase` "ejecucion", `categoria` "no-es-lectura"

#### Scenario: A refused request records nothing
- **WHEN** `POST /consultas/ejecutar` names an unknown connection
- **THEN** the answer is 404 and no row is written

### Requirement: Recording Never Breaks an Execution
A failure to write the audit row SHALL be logged at `error` level, without the statement text, and the execution SHALL answer exactly as it would have.

#### Scenario: The audit write fails
- **GIVEN** the audit write is made to fail
- **WHEN** an operator runs a query
- **THEN** the answer is the normal 200 verdict and an `error` line is logged

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
