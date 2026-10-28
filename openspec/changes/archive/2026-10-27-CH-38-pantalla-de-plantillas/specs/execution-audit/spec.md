# Execution Audit Specification (CH-38 delta)

## Purpose
The unsaved-template test of DEC-191 is a console path that executes SQL against a client database, so it is audited like the stored-template test (DEC-159), with no template id.

## MODIFIED Requirements

### Requirement: Every Audited Path Records Its Execution
Each of `POST /consultas/ejecutar`, `POST /plantillas/:id/prueba`, `POST /plantillas/prueba`, `POST /conexiones/:id/validacion-mapeo` and `POST /conexiones/:id/prueba` SHALL write exactly one row per request that reached the execution engine, after the engine answered, with the request's operator. A request refused before the engine runs (invalid body, unknown id, unreadable credential, unapproved view) SHALL write nothing. The template tests SHALL record `origen` "plantilla-prueba" and the composed statement; the stored-template test SHALL record the template id and the unsaved-template test SHALL record `plantillaId` null. The mapping validation SHALL record the probe statements of every entity it ran and `fallo` if any entity or the session failed; the connection probe SHALL record its fixed probe statement.
(Previously: `POST /plantillas/prueba` did not exist and every template test carried a template id.)

#### Scenario: A read-only rejection is recorded as a failure
- **WHEN** an operator runs `UPDATE x SET y = 1`
- **THEN** the answer is the usual `fallo` with `categoria` "no-es-lectura", and the row says `resultado` "fallo", `fase` "ejecucion", `categoria` "no-es-lectura"

#### Scenario: A refused request records nothing
- **WHEN** `POST /consultas/ejecutar` names an unknown connection
- **THEN** the answer is 404 and no row is written

#### Scenario: An unsaved template test is recorded without a template id
- **WHEN** `POST /plantillas/prueba` reaches the engine
- **THEN** one row is written with `origen` "plantilla-prueba", the composed statement and `plantillaId` null, and no parameter value
