# Delta for Execution Log

## MODIFIED Requirements

### Requirement: Ejecucion Records the Notification Outcome (DEC-83)

`Ejecucion` SHALL have a nullable `notificacion` column whose only permitted values are `enviada`, `omitida-sin-filas`, `fallo-envio`, `sin-destinatario`, `no-configurada`, `enviando`, `incierta`, and null (DEC-83, DEC-108). Its final value SHALL follow the precedence defined in `email-notification`. `enviando` is transient: it SHALL appear only on an `en-curso` row whose send is pending. `incierta` SHALL be written only by the boot sweep and means it is unknown whether the message left. `notificacion` SHALL be null when the query failed and for rows written before this change. `notificacion` MUST store the outcome only, never a message body, recipient, or row content.
(Previously: the set had no `enviando` or `incierta`.)

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

#### Scenario: A completed run never ends as enviando

- GIVEN a run whose send completes, accepted or failed
- WHEN the run closes
- THEN `notificacion` SHALL be `enviada` or `fallo-envio`, never `enviando`

#### Scenario: Listing shows the new values

- GIVEN one `en-curso`/`enviando` row and one `fallo`/`interrumpida`/`incierta` row
- WHEN `GET /automatizaciones/:id/ejecuciones` is called
- THEN both rows SHALL be listed with those values

### Requirement: Interrupted Runs Are Closed as fallo/interrumpida (DEC-99)

A row left `en-curso` by a process stop SHALL be closed with `estado='fallo'` and `error='interrumpida'`. Its `finalizadaEn` SHALL equal the boot time of the sweep; `duracionMs`, `filas`, `fase`, and `intentos` SHALL be null. WHEN the row's `notificacion` was `enviando`, the sweep SHALL set `notificacion='incierta'`; for every other swept row `notificacion` SHALL stay null.
(Previously: `notificacion` was always null on swept rows.)

#### Scenario: A swept row has the interrupted shape

- GIVEN an `en-curso` row from a previous process with null `notificacion`
- WHEN the boot sweep runs
- THEN the row SHALL have `estado='fallo'`, `error='interrumpida'`, `finalizadaEn` equal to boot time, and null `duracionMs`, `filas`, `fase`, `notificacion`

#### Scenario: A row interrupted mid-send becomes incierta

- GIVEN an `en-curso` row with `notificacion='enviando'` from a previous process
- WHEN the boot sweep runs
- THEN the row SHALL be `fallo`, `error='interrumpida'`, `notificacion='incierta'`
- AND the notifier SHALL NOT be called

#### Scenario: Closed rows are untouched by the sweep

- GIVEN rows with `estado` `ok`, `fallo`, and `omitida`, including one `fallo-envio`
- WHEN the boot sweep runs
- THEN those rows SHALL be unchanged
