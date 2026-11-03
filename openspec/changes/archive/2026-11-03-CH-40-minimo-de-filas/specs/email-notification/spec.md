# Email Notification Specification (CH-40 delta)

## Purpose
A run with rows but fewer than its automation's minimum sends nothing and records why, apart from the zero-row skip (DEC-186, DEC-193 2(a)).

## MODIFIED Requirements

### Requirement: Notification Outcome Precedence Is Deterministic (DEC-83, DEC-84, DEC-86, DEC-186)

After a run's query finishes, the system SHALL compute exactly one `notificacion` value by evaluating these conditions in order, the first that holds winning:

| # | Condition | `notificacion` |
|---|-----------|----------------|
| 1 | The run's query failed | `null` (no notification attempted) |
| 2 | The query succeeded with zero rows | `omitida-sin-filas` |
| 3 | The query succeeded with fewer rows than the automation's `minimoFilas` and the result was not cut by the row cap | `omitida-bajo-minimo` |
| 4 | The automation's `destinatario` is null | `sin-destinatario` |
| 5 | SMTP is not configured | `no-configurada` |
| 6 | Send accepted by the transport | `enviada` |
| 7 | Send rejected, failed, or timed out | `fallo-envio` |

A result is cut by the row cap when the query had more rows than the run read (`paginacion.hayMas`); such a result SHALL count as reaching the minimum. The system SHALL attempt a send only when the outcome reaches step 6 or 7. Exactly one send attempt SHALL be made per run; there SHALL be no retry.
(Previously: there was no minimum row; today's rows 4 to 7 were rows 3 to 6.)

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

- GIVEN an automation with `minimoFilas` 5 and null `destinatario`, whose run returns 3 rows
- WHEN the run closes
- THEN `notificacion` SHALL be `omitida-bajo-minimo`

#### Scenario: Default minimum keeps today's behavior

- GIVEN an automation with `minimoFilas` 1 whose run returns 1 row, with a recipient and SMTP configured
- WHEN the run closes
- THEN `notificacion` SHALL be `enviada`

#### Scenario: Precedence between missing recipient and unset SMTP

- GIVEN a successful run with rows reaching the minimum, a null `destinatario`, and SMTP unset
- WHEN the run closes
- THEN `notificacion` SHALL be `sin-destinatario`

#### Scenario: SMTP unset with a recipient

- GIVEN a successful run with rows reaching the minimum, a recipient, and SMTP unset
- WHEN the run closes
- THEN `notificacion` SHALL be `no-configurada`, `estado` SHALL be `ok`, and the notifier SHALL NOT be called

#### Scenario: Rows with recipient and SMTP configured send exactly once

- GIVEN a successful run with rows reaching the minimum, a recipient, SMTP configured, and `formato` `correo-html`
- WHEN the run closes
- THEN the notifier SHALL be called exactly once with that recipient and `notificacion` SHALL be `enviada`
