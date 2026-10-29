# Execution Log Specification (CH-39 delta)

## Purpose
A run whose message fell back to the table records which columns were missing, apart from the send outcome (DEC-188, DEC-192 2(a)).

## ADDED Requirements

### Requirement: Ejecucion Records the Fallback to the Table (DEC-188, DEC-192)

`Ejecucion` SHALL have a nullable `mensajeRespaldo` column holding an array of strings. It SHALL be set, in the same write that sets `notificacion`, to the names the renderer reported missing when a message was composed and fell back to the table. It SHALL be null when no message was composed, when the message was built from the template's texts, when the template has no texts, and for rows written before this change. It MUST hold column names only, never cell values. `notificacion` SHALL follow its own precedence regardless of `mensajeRespaldo`.

#### Scenario: A run falls back

- GIVEN an automation whose template line names `{stock}` and whose query returns no `stock` column
- WHEN the run sends its message
- THEN its `Ejecucion` row SHALL have `notificacion: "enviada"` and `mensajeRespaldo: ["stock"]`

#### Scenario: A run uses the texts

- GIVEN an automation whose template line names only returned columns
- WHEN the run sends its message
- THEN its `Ejecucion` row SHALL have `mensajeRespaldo` null

#### Scenario: A send failure after a fallback

- GIVEN a run that falls back to the table and whose send fails
- WHEN its row is inspected
- THEN it SHALL have `notificacion: "fallo-envio"` and `mensajeRespaldo` set

## MODIFIED Requirements

### Requirement: Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)

`GET /automatizaciones/:id/ejecuciones` SHALL include each run's `notificacion` value and its `mensajeRespaldo` (array or null), remaining scoped to the active tenant's automation.
(Previously: the listing had no `mensajeRespaldo`.)

#### Scenario: Listing shows notificacion

- GIVEN an automation of the active tenant with runs of differing outcomes
- WHEN its runs are listed
- THEN each entry SHALL include its `notificacion` value

#### Scenario: Listing shows the fallback

- GIVEN a run with `mensajeRespaldo: ["stock"]` and a run with it null
- WHEN the runs are listed
- THEN the entries SHALL carry `["stock"]` and `null`
