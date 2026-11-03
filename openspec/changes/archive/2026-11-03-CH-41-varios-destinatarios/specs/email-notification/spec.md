# Email Notification Specification (CH-41 delta)

## Purpose
A run's message goes once to every address of its automation's list, all in «Para», and records one send outcome (N6, DEC-187). The list is validated address by address, deduplicated ignoring case and capped at 5 (DEC-194).

## MODIFIED Requirements

### Requirement: Notification Outcome Precedence Is Deterministic (DEC-83, DEC-84, DEC-86, DEC-186, DEC-187)

After a run's query finishes, the system SHALL compute exactly one `notificacion` value by evaluating these conditions in order, the first that holds winning:

| # | Condition | `notificacion` |
|---|-----------|----------------|
| 1 | The run's query failed | `null` (no notification attempted) |
| 2 | The query succeeded with zero rows | `omitida-sin-filas` |
| 3 | The query succeeded with fewer rows than the automation's `minimoFilas` and the result was not cut by the row cap | `omitida-bajo-minimo` |
| 4 | The automation's `destinatarios` list is empty | `sin-destinatario` |
| 5 | SMTP is not configured | `no-configurada` |
| 6 | Send accepted by the transport for at least one address | `enviada` |
| 7 | Send rejected for every address, failed, or timed out | `fallo-envio` |

A result is cut by the row cap when the query had more rows than the run read (`paginacion.hayMas`); such a result SHALL count as reaching the minimum. The system SHALL attempt a send only when the outcome reaches step 6 or 7. Exactly one send attempt SHALL be made per run, with one message whose «Para» holds every address of the list; there SHALL be no retry and no message per address. An address the server rejects while it accepts others SHALL NOT change the outcome and SHALL NOT be recorded separately (DEC-187).
(Previously: row 4 was a null `destinatario`, and the message had one address.)

#### Scenario: Query failed records null and sends nothing

- GIVEN a run whose query fails, with a recipient and SMTP configured
- WHEN the run closes
- THEN `notificacion` SHALL be `null` and the notifier SHALL NOT be called

#### Scenario: Zero rows never sends

- GIVEN a successful run returning zero rows, with a recipient and SMTP configured
- WHEN the run closes
- THEN `notificacion` SHALL be `omitida-sin-filas`, `estado` SHALL be `ok`, and the notifier SHALL NOT be called

#### Scenario: Zero rows wins over the minimum

- GIVEN an automation with `minimoFilas` 5 whose run returns zero rows
- WHEN the run closes
- THEN `notificacion` SHALL be `omitida-sin-filas`

#### Scenario: Rows below the minimum never send

- GIVEN an automation with `minimoFilas` 5, a recipient and SMTP configured, whose run returns 3 rows
- WHEN the run closes
- THEN `notificacion` SHALL be `omitida-bajo-minimo`, `estado` SHALL be `ok`, `filas` SHALL be 3, and the notifier SHALL NOT be called

#### Scenario: Reaching the minimum sends

- GIVEN an automation with `minimoFilas` 5, a recipient and SMTP configured, whose run returns exactly 5 rows
- WHEN the run closes
- THEN the notifier SHALL be called exactly once and `notificacion` SHALL be `enviada`

#### Scenario: A result cut by the row cap reaches the minimum

- GIVEN an automation with `minimoFilas` 50 and a row cap lowered to 20 after its creation, whose query has more than 20 rows
- WHEN the run closes
- THEN the run SHALL read 20 rows with `hayMas` true and the notifier SHALL be called

#### Scenario: The minimum wins over a missing recipient

- GIVEN an automation with `minimoFilas` 5 and `destinatarios` `[]`, whose run returns 3 rows
- WHEN the run closes
- THEN `notificacion` SHALL be `omitida-bajo-minimo`

#### Scenario: Default minimum keeps today's behavior

- GIVEN an automation with `minimoFilas` 1 whose run returns 1 row, with a recipient and SMTP configured
- WHEN the run closes
- THEN `notificacion` SHALL be `enviada`

#### Scenario: Precedence between missing recipient and unset SMTP

- GIVEN a successful run with rows reaching the minimum, `destinatarios` `[]`, and SMTP unset
- WHEN the run closes
- THEN `notificacion` SHALL be `sin-destinatario`

#### Scenario: SMTP unset with a recipient

- GIVEN a successful run with rows reaching the minimum, a recipient, and SMTP unset
- WHEN the run closes
- THEN `notificacion` SHALL be `no-configurada`, `estado` SHALL be `ok`, and the notifier SHALL NOT be called

#### Scenario: Rows with recipients and SMTP configured send one message to all of them

- GIVEN a successful run with rows reaching the minimum, `destinatarios` `["a@empresa.com", "b@empresa.com"]`, SMTP configured, and `formato` `correo-html`
- WHEN the run closes
- THEN the notifier SHALL be called exactly once, with «Para» holding both addresses in that order, and `notificacion` SHALL be `enviada`

#### Scenario: One address rejected among accepted ones

- GIVEN a run that sends to two addresses and a server that accepts the first and rejects the second
- WHEN the run closes
- THEN `notificacion` SHALL be `enviada`, `estado` SHALL be `ok`, and nothing SHALL name the rejected address

#### Scenario: Every address rejected

- GIVEN a run that sends to two addresses and a server that rejects both
- WHEN the run closes
- THEN `estado` SHALL be `fallo`, `fase` `notificacion`, `error` `envio-rechazado` and `notificacion` `fallo-envio`

### Requirement: Recipient Is Validated and Header-Safe (DEC-82, DEC-187, DEC-194)

`destinatarios` MUST be a list of at most `MAX_DESTINATARIOS` = 5 addresses after this rule, applied at creation, in the operator's adjust and in the panel's adjust:
1. Each element MUST be a string; it is trimmed of surrounding spaces and tabs, and a CR or LF anywhere stays in, so the next step refuses it.
2. Each element MUST be one syntactically valid email address (`direccionValida`): no CR, LF, comma, semicolon, whitespace or second address.
3. Elements that are equal ignoring case SHALL be kept once, with the first spelling, in the order given.
4. More than 5 elements after step 3 SHALL be refused.

A refused element SHALL be named by its position as given: `/destinatarios/<i>` in the console's routes and `destinatarios` in the panel's route, which names fields, not pointers. A list over the cap SHALL be named `/destinatarios` or `destinatarios`. A refusal SHALL be `400` and nothing SHALL persist. Every stored element has passed this rule, so the run never places an unchecked value in a message header.
(Previously: one `destinatario`, a single address validated at creation.)

#### Scenario: Invalid recipient rejected

- GIVEN a create request with `destinatarios` `["ops@x.com", "not-an-email"]`
- WHEN it is handled
- THEN the response SHALL be `400` naming `/destinatarios/1` and no `Automatizacion` SHALL persist

#### Scenario: Header injection or two addresses in one element rejected

- GIVEN a create request with `destinatarios` `["a@x.com\r\nBcc: b@y.com"]` or `["a@x.com,b@y.com"]`
- WHEN it is handled
- THEN the response SHALL be `400` naming `/destinatarios/0`

#### Scenario: Duplicates kept once, ignoring case

- GIVEN a create request with `destinatarios` `["Ops@x.com", "b@x.com", "ops@x.com"]`
- WHEN it is handled
- THEN the row SHALL persist with `destinatarios` `["Ops@x.com", "b@x.com"]`

#### Scenario: More than five addresses rejected

- GIVEN a create request with six distinct valid addresses
- WHEN it is handled
- THEN the response SHALL be `400` naming `/destinatarios` and no row SHALL persist

#### Scenario: Five addresses after removing a duplicate are accepted

- GIVEN a create request with six valid addresses, two of them equal ignoring case
- WHEN it is handled
- THEN the row SHALL persist with five addresses
