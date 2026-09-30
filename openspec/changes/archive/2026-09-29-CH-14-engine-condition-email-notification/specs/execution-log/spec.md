# Delta for Execution Log

## MODIFIED Requirements

### Requirement: Error Field Stores a Classified Error, Never a Raw Driver Error

WHEN a run fails, `Ejecucion.error` SHALL store a sanitized, classified error category from a closed set: the categories `query-execution` already uses for a failed ad hoc execution, plus a closed set of send-failure categories used when `fase='notificacion'`. It MUST NOT store a raw driver error object, raw SMTP server response text, a stack trace, the target connection's credential value, or SMTP credentials.
(Previously: covered only query-execution categories and driver errors.)

#### Scenario: A failed run's error is sanitized

- GIVEN a run that fails with a driver-level error
- WHEN its `Ejecucion` row is inspected
- THEN `error` SHALL contain a classified category, never the raw driver error text or a stack trace

#### Scenario: A failed send's error is a closed category

- GIVEN a run whose send fails with an SMTP error containing server text and the sender address
- WHEN its `Ejecucion` row is inspected
- THEN `error` SHALL be one of the closed send-failure categories
- AND SHALL NOT contain the server text or any SMTP credential

## ADDED Requirements

### Requirement: Ejecucion Records the Notification Outcome (DEC-83)

`Ejecucion` SHALL have a nullable `notificacion` column whose only permitted values are `enviada`, `omitida-sin-filas`, `fallo-envio`, `sin-destinatario`, `no-configurada`, and null. Its value SHALL follow the precedence defined in `email-notification`. It SHALL be null when the query failed and for rows written before this change. `notificacion` MUST store the outcome only, never a message body, recipient, or row content.

#### Scenario: Each outcome is recorded

- GIVEN runs that reach each of the five non-null outcomes
- WHEN their `Ejecucion` rows are inspected
- THEN each SHALL carry the matching `notificacion` value

#### Scenario: Query failure leaves notificacion null

- GIVEN a run whose query fails
- WHEN its `Ejecucion` row is inspected
- THEN `notificacion` SHALL be null

#### Scenario: Legacy rows read as null

- GIVEN an `Ejecucion` row written before this change
- WHEN it is listed
- THEN `notificacion` SHALL be null

### Requirement: A Send Failure Marks the Run Failed in Phase notificacion (DEC-83)

The set of permitted `fase` values SHALL include `notificacion`. WHEN a send fails, the run SHALL be recorded with `estado='fallo'`, `fase='notificacion'`, and `notificacion='fallo-envio'`, while its row count SHALL still reflect the rows the query returned. `estado='fallo'` therefore no longer implies the query failed; `fase` identifies what failed. WHEN the query succeeds and the send is accepted or not attempted, `fase` SHALL remain unchanged (`ejecucion`).

#### Scenario: Query succeeded, send failed

- GIVEN a run that returned 12 rows and whose send fails
- WHEN its `Ejecucion` row is inspected
- THEN `estado` SHALL be `fallo`, `fase` SHALL be `notificacion`, and the row count SHALL be 12

#### Scenario: Successful notification leaves the run ok

- GIVEN a run whose send succeeds
- WHEN its `Ejecucion` row is inspected
- THEN `estado` SHALL be `ok`, `fase` SHALL be unchanged (`ejecucion`), and `notificacion` SHALL be `enviada`

### Requirement: Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)

`GET /automatizaciones/:id/ejecuciones` SHALL include each run's `notificacion` value, remaining scoped to the active tenant's automation.

#### Scenario: Listing shows notificacion

- GIVEN an automation of the active tenant with runs of differing outcomes
- WHEN its runs are listed
- THEN each entry SHALL include its `notificacion` value
