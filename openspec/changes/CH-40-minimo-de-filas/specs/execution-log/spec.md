# Execution Log Specification (CH-40 delta)

## Purpose
A run skipped because its rows did not reach the automation's minimum is recorded with its own outcome, distinct from the zero-row skip (DEC-186).

## MODIFIED Requirements

### Requirement: Ejecucion Records the Notification Outcome (DEC-83)

`Ejecucion` SHALL have a nullable `notificacion` column whose only permitted values are `enviada`, `omitida-sin-filas`, `omitida-bajo-minimo`, `fallo-envio`, `sin-destinatario`, `no-configurada`, `enviando`, `incierta`, and null (DEC-83, DEC-108, DEC-186). Its final value SHALL follow the precedence defined in `email-notification`. `enviando` is transient: it SHALL appear only on an `en-curso` row whose send is pending. `incierta` SHALL be written only by the boot sweep and means it is unknown whether the message left. `notificacion` SHALL be null when the query failed and for rows written before this change. `notificacion` MUST store the outcome only, never a message body, recipient, or row content. Adding a value SHALL NOT require a migration: the column is text whose permitted values live in code.
(Previously: the set had no `omitida-bajo-minimo`.)

#### Scenario: Each outcome is recorded

- GIVEN runs that reach each of the six non-null closing outcomes
- WHEN their `Ejecucion` rows are inspected
- THEN each SHALL carry the matching `notificacion` value

#### Scenario: A run below the minimum is recorded

- GIVEN an automation with `minimoFilas` 5 whose run returns 3 rows
- WHEN its `Ejecucion` row is inspected
- THEN it SHALL have `estado: "ok"`, `filas: 3`, and `notificacion: "omitida-bajo-minimo"`

#### Scenario: Query failure leaves notificacion null

- GIVEN a run whose query fails
- WHEN its `Ejecucion` row is inspected
- THEN `notificacion` SHALL be null

#### Scenario: Legacy rows read as null

- GIVEN an `Ejecucion` row written before CH-14
- WHEN it is listed
- THEN `notificacion` SHALL be null

#### Scenario: A completed run never ends as enviando

- GIVEN a run whose send completes, accepted or failed
- WHEN the run closes
- THEN `notificacion` SHALL be `enviada` or `fallo-envio`, never `enviando`

#### Scenario: Listing shows the new values

- GIVEN one `en-curso`/`enviando` row and one `fallo`/`interrumpida`/`incierta` row
- WHEN `GET /automatizaciones/:id/ejecuciones` is called
- THEN both rows SHALL be listed with those values

### Requirement: Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)

`GET /automatizaciones/:id/ejecuciones` SHALL include each run's `notificacion` value, `omitida-bajo-minimo` included, and its `mensajeRespaldo` (array or null), remaining scoped to the active tenant's automation.
(Previously: the listed values had no `omitida-bajo-minimo`.)

#### Scenario: Listing shows notificacion

- GIVEN an automation of the active tenant with runs of differing outcomes, one of them `omitida-bajo-minimo`
- WHEN its runs are listed
- THEN each entry SHALL include its `notificacion` value

#### Scenario: Listing shows the fallback

- GIVEN a run with `mensajeRespaldo: ["stock"]` and a run with it null
- WHEN the runs are listed
- THEN the entries SHALL carry `["stock"]` and `null`
