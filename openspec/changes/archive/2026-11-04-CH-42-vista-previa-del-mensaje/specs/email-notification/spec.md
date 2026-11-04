# Email Notification Specification (CH-42 delta)

## Purpose
The preview shows the message a run would send, built by the same function and the same renderer, and says whether a run would send it and to whom, without sending (X10, DEC-189, DEC-195).

## ADDED Requirements

### Requirement: Preview Builds the Run's Message and Never Sends It (X10, DEC-189, DEC-195)

The message preview SHALL apply `decidirNotificacion` to its result with the automation's stored `destinatarios` and `minimoFilas` and whether SMTP is configured, read from the same signal the scheduler uses: a notifier exists exactly when `SMTP_HOST` is set at boot. Its answer SHALL carry:

- `decision`: `enviar` when a run would reach precedence row 6 or 7; otherwise the omission value of rows 2 to 5 (`omitida-sin-filas`, `omitida-bajo-minimo`, `sin-destinatario`, `no-configurada`); `null` when the query failed (row 1).
- `para`: the automation's stored `destinatarios`, in order, `[]` when empty.
- `correo`: `{ asunto, texto, html }` from `componerCorreo`, with the input a run builds for the same template and result (see "Message Built From the Template's Texts"), the preview's own instant as `fecha` and the deployment zone as `zona`; `null` when no message can be built.

A message can be built when a run would reach the delivery rows:

| `decision` | `correo` |
|------------|----------|
| `null` (query failed) | `null` |
| `omitida-sin-filas` | `null` |
| `omitida-bajo-minimo` | `null` |
| `sin-destinatario` | built |
| `no-configurada` | built |
| `enviar` | built |

The preview SHALL hold no notifier, SHALL NOT write any `notificacion` value or the `enviando` marker, and SHALL NOT send any message whatever the decision.

#### Scenario: A run would send

- GIVEN an automation with `destinatarios` `["ops@empresa.com", "ventas@empresa.com"]`, SMTP configured, and a result reaching its minimum
- WHEN it is previewed
- THEN `decision` SHALL be `enviar`, `para` SHALL be both addresses in order, and `correo` SHALL be set
- AND no message SHALL be sent

#### Scenario: Without recipients the message is still shown

- GIVEN an automation with `destinatarios` `[]` and a result reaching its minimum
- WHEN it is previewed
- THEN `decision` SHALL be `sin-destinatario`, `para` SHALL be `[]` and `correo` SHALL be set

#### Scenario: Without SMTP the message is still shown

- GIVEN an automation with a recipient, SMTP not configured, and a result reaching its minimum
- WHEN it is previewed
- THEN `decision` SHALL be `no-configurada` and `correo` SHALL be set

#### Scenario: Below the minimum there is no message

- GIVEN an automation with `minimoFilas` 5 whose query returns 3 rows and is not cut by the row cap
- WHEN it is previewed
- THEN `decision` SHALL be `omitida-bajo-minimo` and `correo` SHALL be null

#### Scenario: Zero rows have no message

- GIVEN an automation whose query returns zero rows
- WHEN it is previewed
- THEN `decision` SHALL be `omitida-sin-filas` and `correo` SHALL be null

#### Scenario: The preview's message equals the run's

- GIVEN a template, a successful result, an instant and a zone
- WHEN the preview's `correo` and the message a run composes for the same four are compared
- THEN their `asunto`, `texto` and `html` SHALL be identical

#### Scenario: A missing column shows the table, as in a run

- GIVEN a template whose line names `{stock}` and a result without that column, reaching the minimum
- WHEN it is previewed
- THEN `correo` SHALL hold the table, as the run would send it

## MODIFIED Requirements

### Requirement: Message Built From the Template's Texts (DEC-188, DEC-192)

WHEN the run's template has both `encabezadoMensaje` and `lineaMensaje`, and every placeholder of `lineaMensaje` names a column of the result, the body SHALL be the header followed by one line per rendered row, in row order, instead of the table. In each line, every placeholder SHALL be replaced by that row's cell of the named column, rendered as a table cell is (the em-dash placeholder for an empty value, the cell length cap). When a column name appears more than once in the result, the first such column SHALL be used. The truncation notice, the empty-cell notice and the footer SHALL appear as they do with the table. WHEN either text is null, the body SHALL be the table, exactly as before this change. The renderer's input (the template's name and label, the result's columns, rows and `hayMas`, the date and the zone, and the two texts when both are set) SHALL be built by one function shared by the run and the message preview, so the two cannot drift.
(Previously: the input was built inside the scheduler only.)

#### Scenario: Lines per row

- GIVEN a template with header "Productos con poco stock" and line "{producto}: quedan {cantidad} unidades"
- AND a result with columns `producto, cantidad, deposito` and rows `["Harina 000", 3, "Central"]`, `["Azúcar", 0, "Central"]`
- WHEN the message is rendered
- THEN both parts SHALL contain the header, "Harina 000: quedan 3 unidades" and "Azúcar: quedan 0 unidades", in that order
- AND neither part SHALL contain a table or the value "Central"

#### Scenario: Empty value in a line

- GIVEN the line "{producto}: {cantidad}" and a row whose `cantidad` is null
- WHEN the message is rendered
- THEN that line SHALL show the em-dash placeholder and not the text `null`

#### Scenario: Truncated result with lines

- GIVEN a template with both texts and a result with `hayMas: true`
- WHEN the message is rendered
- THEN both parts SHALL carry the truncation notice

#### Scenario: Template without texts

- GIVEN a template with both texts null
- WHEN the message is rendered
- THEN it SHALL be identical to the message rendered before this change for the same result

#### Scenario: One input for the run and the preview

- GIVEN a template with both texts and a successful result
- WHEN the input is built for a run and for a preview, at the same instant and in the same zone
- THEN the two inputs SHALL be equal, including `mensaje`
- AND with either text null, both SHALL carry `mensaje` null
