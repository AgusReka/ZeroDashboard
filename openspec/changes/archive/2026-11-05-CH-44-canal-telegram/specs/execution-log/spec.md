# Execution Log Specification (CH-44 delta)

## ADDED Requirements

### Requirement: Ejecucion Records Its Channel (DEC-197)
`Ejecucion` SHALL have a nullable text `canal` column, written from the automation's `canal` when the row is created, on every row a run creates, including an `omitida` row, and never changed afterwards. Null SHALL mean a row written before this column, and reads as `correo`. `canal` holds the closed value only: no run row SHALL hold a chat id, username or recipient.

#### Scenario: A run records the channel
- **GIVEN** a Telegram automation
- **WHEN** a run's row is created
- **THEN** it SHALL have `canal: "telegram"` while `en-curso` and after closing

#### Scenario: An overlap skip records the channel
- **GIVEN** a Telegram automation with a previous run still `en-curso`
- **WHEN** its next fire writes an `omitida` row
- **THEN** that row SHALL have `canal: "telegram"`

#### Scenario: Changing the channel leaves history alone
- **GIVEN** an automation with closed runs on `correo`
- **WHEN** it is adjusted to `telegram`
- **THEN** those rows SHALL keep `canal: "correo"`

#### Scenario: Older rows
- **GIVEN** a row written before this column existed
- **WHEN** it is listed
- **THEN** `canal` SHALL be null

#### Scenario: No chat id in the row
- **GIVEN** a Telegram run linked to chat 42 that sends
- **WHEN** its row is read
- **THEN** no column SHALL contain the chat id

## MODIFIED Requirements

### Requirement: Ejecucion Records the Notification Outcome (DEC-83)

`Ejecucion` SHALL have a nullable `notificacion` column whose only permitted values are `enviada`, `omitida-sin-filas`, `omitida-bajo-minimo`, `fallo-envio`, `sin-destinatario`, `sin-vinculo`, `no-configurada`, `enviando`, `incierta`, and null (DEC-83, DEC-108, DEC-186, DEC-185). Its final value SHALL follow the precedence defined in `email-notification` for `correo` and in `telegram-notification` for `telegram`. `enviando` is transient: it SHALL appear only on an `en-curso` row whose send is pending. `incierta` SHALL be written only by the boot sweep and means it is unknown whether the message left. `notificacion` SHALL be null when the query failed and for rows written before this change. `notificacion` MUST store the outcome only, never a message body, recipient, or row content. Adding a value SHALL NOT require a migration: the column is text whose permitted values live in code.
(Previously: the set had no `sin-vinculo`, and the precedence came only from `email-notification`.)

#### Scenario: Each outcome is recorded

- GIVEN runs that reach each of the seven non-null closing outcomes
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

#### Scenario: A run with no link is recorded

- GIVEN a Telegram automation with no link whose run returns 3 rows
- WHEN its `Ejecucion` row is inspected
- THEN it SHALL have `estado: "ok"`, `filas: 3`, and `notificacion: "sin-vinculo"`

### Requirement: Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)

`GET /automatizaciones/:id/ejecuciones` SHALL include each run's `notificacion` value, `omitida-bajo-minimo` and `sin-vinculo` included, its `mensajeRespaldo` (array or null) and its `canal` (`correo`, `telegram` or null), remaining scoped to the active tenant's automation.
(Previously: the listed values had no `sin-vinculo`, and the entries had no `canal`.)

#### Scenario: Listing shows notificacion

- GIVEN an automation of the active tenant with runs of differing outcomes, one of them `omitida-bajo-minimo`
- WHEN its runs are listed
- THEN each entry SHALL include its `notificacion` value

#### Scenario: Listing shows the fallback

- GIVEN a run with `mensajeRespaldo: ["stock"]` and a run with it null
- WHEN the runs are listed
- THEN the entries SHALL carry `["stock"]` and `null`

#### Scenario: Listing shows the channel

- GIVEN runs with `canal` `telegram`, `correo` and null
- WHEN the runs are listed
- THEN the entries SHALL carry those values
