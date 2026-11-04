# Email Notification Specification

## Purpose

Delivering an automation run's result rows by email to its automation's recipients, up to 5 in one message with all of them in «Para» (N1, N6, DEC-187, DEC-194), only when rows exist (X3) and reach the automation's minimum (X9, DEC-186, DEC-193), rendered legibly even when the data is incomplete (N2). Transport is SMTP via nodemailer behind an injectable notifier (DEC-81); the recipients are a validated, deduplicated list on the automation (DEC-82, DEC-187, DEC-194); the body is produced by a generic columns-driven renderer (DEC-85). Since CH-39, a template that declares its message texts gets a body of the header and one line per row instead of the table (DEC-188, DEC-192). A run sends at most one message (X6, DEC-107). Retries of the send (DEC-97), content or cooldown duplicate suppression, "send when empty", per-template HTML, and multi-section reports are out of scope (documented artifact limits, rule 6).

## Requirements

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

### Requirement: Send Failure Fails the Run Without Crashing the Tick (DEC-83)

WHEN the send fails (rejection, connection failure, or timeout), the run SHALL be recorded with `notificacion='fallo-envio'`, `estado='fallo'`, `fase='notificacion'`, and an `error` from a closed category set. The `error` MUST NOT contain raw SMTP server text, a stack trace, or SMTP credentials. The failure SHALL NOT propagate out of the run or stop sibling automations in the same tick.

#### Scenario: SMTP rejects the message

- GIVEN a run with rows and a notifier that raises an error containing server response text
- WHEN the run closes
- THEN `estado` SHALL be `fallo`, `fase` SHALL be `notificacion`, `notificacion` SHALL be `fallo-envio`
- AND `error` SHALL be a closed category and SHALL NOT contain the server text

#### Scenario: A failed send does not block a sibling

- GIVEN two due automations in one tick, the first with a failing send
- WHEN the scheduler ticks
- THEN the second automation SHALL still run to completion

### Requirement: Send Is Bounded by a Configured Timeout

The transport SHALL bound every send attempt by a configured timeout, so that an unresponsive SMTP server cannot block the sequential tick indefinitely. A send exceeding the timeout SHALL be treated as a send failure (`fallo-envio`). Because the server may already have accepted the message, the system MUST NOT retry it and MUST NOT state that the message was not delivered.
(Previously: no statement that a timed-out message may have been delivered.)

#### Scenario: Unresponsive SMTP server

- GIVEN a transport whose server never answers
- WHEN a send is attempted
- THEN the attempt SHALL end no later than the configured timeout
- AND the run SHALL record `fallo-envio`

#### Scenario: Timed-out send is not repeated

- GIVEN a send that ends by timeout
- WHEN the run closes
- THEN the notifier SHALL have been called exactly once
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

### Requirement: Missing Column Falls Back to the Table (DEC-188)

WHEN the template has both texts and at least one placeholder of `lineaMensaje` names no column of the result, the body SHALL be the table, as for a template without texts, and the renderer SHALL report the missing names, each once, in order of first appearance. The message MUST NOT contain a line with an unreplaced placeholder or an empty gap. WHEN the body is built from the texts or the template has no texts, the renderer SHALL report no missing name.

#### Scenario: A column disappeared from the query

- GIVEN the line "{producto}: {stock}" and a result with columns `producto, cantidad`
- WHEN the message is rendered
- THEN both parts SHALL be the table
- AND the renderer SHALL report `["stock"]`

### Requirement: Body Contains Only Query Result Columns (rule 5, DEC-71)

The email body (HTML and text) SHALL contain only the column names and cell values the run's query returned, plus static template text (title, notice, footer) and the template's `encabezadoMensaje` and `lineaMensaje` with their placeholders replaced. It MUST NOT contain the SQL statement, parameter values, connection data, credentials, error text, or the recipient address.
(Previously: the template's message texts did not exist.)

#### Scenario: Body excludes internals

- GIVEN a run whose statement, parameter values, and connection host are known to the test
- WHEN the message is rendered
- THEN neither body part SHALL contain the SQL text, any parameter value that is not also a returned cell, the connection host or credentials, or the recipient address

### Requirement: Renderer Escapes Cells and Column Names

The renderer SHALL escape `&`, `<`, `>`, `"`, and `'` in every cell value, every column name, the header and the literal text of the line in the HTML part. A placeholder's value SHALL be escaped on its own, before it is placed in the line; the substituted line SHALL NOT be escaped again. Cell content and template text MUST NOT be interpreted as markup. In the text part, CR and LF SHALL be removed from every value placed in a line, so each row stays on one line.
(Previously: only cells and column names were rendered.)

#### Scenario: Markup in a cell is neutralized

- GIVEN a row with a cell value `<script>alert(1)</script>` and a column named `a<b`
- WHEN the HTML is rendered
- THEN the output SHALL contain the escaped forms and SHALL NOT contain a literal `<script>` tag or an unescaped `a<b`

#### Scenario: Markup in a line value is escaped once

- GIVEN the line "{producto} & más" and a row whose `producto` is `A<B & C`
- WHEN the HTML is rendered
- THEN it SHALL contain `A&lt;B &amp; C &amp; más` and no `&amp;amp;`

#### Scenario: A newline in a line value

- GIVEN the line "{producto}: {cantidad}" and a row whose `producto` is `"Harina\r\n000"`
- WHEN the text part is rendered
- THEN that row SHALL occupy one line

### Requirement: Gracefully Degraded Rendering of Incomplete Data (N2, DEC-84)

A cell whose value is null, undefined, the empty string, or `NaN` SHALL render as a fixed placeholder (an em dash) and never as the literal text `null`, `undefined`, or `NaN`. The renderer MUST NOT emit an empty broken cell or a malformed table for any result. An object cell is rendered as its JSON text verbatim, so nested values inside it (for example `{"a":null}`) may contain the text `null`; this is a documented artifact limit. Numeric zeros SHALL render as `0`, not as a placeholder. The renderer SHALL NOT require any specific column set.

#### Scenario: Null, undefined, and empty cells

- GIVEN a row `[null, undefined, "", 0]`
- WHEN the HTML and text parts are rendered
- THEN the first three cells SHALL show the placeholder and the last SHALL show `0`
- AND neither part SHALL contain `null` or `undefined`

#### Scenario: Aggregate row of zeros

- GIVEN a single row whose cells are all `0`
- WHEN it is rendered
- THEN every cell SHALL display `0` inside a well-formed table

### Requirement: Truncated Results Show a Notice

WHEN the run's result reports `paginacion.hayMas` as true, the rendered message SHALL include a visible notice stating that only the first N rows are shown, where N is the number of rows rendered. WHEN `hayMas` is false, the notice MUST NOT appear.

#### Scenario: Truncation notice

- GIVEN a result with 500 rows and `hayMas: true`
- WHEN it is rendered
- THEN the HTML and text parts SHALL state that the first 500 rows are shown

#### Scenario: No notice for a complete result

- GIVEN a result with `hayMas: false`
- WHEN it is rendered
- THEN no truncation notice SHALL appear

### Requirement: Subject Is Header-Safe and Label-Themed (DEC-85)

The subject SHALL derive from the `Plantilla.nombre` and an emoji selected by the `Plantilla.automatizacion` label; the message accent colour SHALL be selected by the same label (documented palette `#f59e0b`, `#dc2626`, `#2563eb`). Any CR or LF character in the subject source MUST be removed before use.

#### Scenario: CR/LF stripped from subject

- GIVEN a `Plantilla.nombre` containing `"Report\r\nBcc: x@y.com"`
- WHEN the subject is built
- THEN the subject SHALL contain no CR or LF character

#### Scenario: Label selects accent and emoji

- GIVEN two plantillas with different `automatizacion` labels
- WHEN each message is rendered
- THEN each SHALL use the accent colour and subject emoji mapped to its own label

### Requirement: Message Carries a text/plain Alternative

Every message SHALL include a `text/plain` alternative alongside the HTML part, with the same columns, rows, placeholders, and truncation notice; when the body is built from the template's texts, it SHALL carry the same header and lines instead of the columns and rows.
(Previously: the text part always carried the table.)

#### Scenario: Both parts present

- GIVEN a message built for a result with rows
- WHEN it is inspected
- THEN it SHALL contain an HTML part and a non-empty `text/plain` part

### Requirement: SMTP Secrets Stay in the Environment and Out of Logs (rule 7, DEC-86)

The SMTP settings (host, port, secure flag, user, password, sender) SHALL be read from environment variables only. The SMTP password, user, and the recipient address MUST NOT be written to any log, response, `Ejecucion` row, or error message.

#### Scenario: Failure log carries no secrets

- GIVEN a send that fails with SMTP credentials and a recipient configured
- WHEN every log line and persisted row of the run is inspected
- THEN none SHALL contain the SMTP password, user, or the recipient address

### Requirement: Transport Sits Behind an Injectable Notifier (DEC-81)

The scheduler SHALL send only through a notifier interface that can be replaced in tests; the default implementation SHALL deliver via SMTP. Existing scheduler construction without a notifier SHALL continue to work.

#### Scenario: Scheduler runs with a fake notifier

- GIVEN a scheduler built with a recording fake notifier
- WHEN a run with rows completes
- THEN the fake SHALL have received exactly one message and no network call SHALL have occurred
### Requirement: A Run Sends at Most One Message (X6, DEC-107)

One run SHALL call the notifier at most once. This MUST hold across a connection retry (DEC-97/98), an overlap skip, the boot sweep, and `detener()`. "Same event" means one run: two consecutive runs with identical rows MAY each send (documented limit).

#### Scenario: Retried connection sends once

- GIVEN a policy of 3 attempts, a connection failing once then succeeding, rows, a recipient, and SMTP configured
- WHEN the run completes
- THEN the notifier SHALL have been called exactly once

#### Scenario: Overlap skip never sends

- GIVEN an automation with an `en-curso` row and a due tick
- WHEN the scheduler ticks
- THEN the notifier SHALL NOT be called

#### Scenario: Sweep never sends

- GIVEN an `en-curso` row left by a previous process
- WHEN the boot sweep runs
- THEN the notifier SHALL NOT be called and the run SHALL NOT be re-executed

#### Scenario: Stopping during a send causes no second send

- GIVEN a run whose send is in flight
- WHEN `detener()` is called
- THEN the notifier SHALL have been called exactly once for that run

### Requirement: A Marker Is Written Before the Send (X6, DEC-108)

Immediately before calling the notifier, and only on the path that reaches the send, the run SHALL set `notificacion='enviando'` on its `en-curso` row through the tenant-scoped client. The marker MUST NOT be written when no send is attempted. The close path overwrites it with the outcome of the precedence table.

#### Scenario: Marker is visible while the send is pending

- GIVEN a run with rows, a recipient, SMTP configured, and a notifier that has not resolved
- WHEN the row is read
- THEN it SHALL be `en-curso` with `notificacion='enviando'`

#### Scenario: No marker when no send happens

- GIVEN a run with zero rows, a null recipient, or SMTP unset
- WHEN the run closes
- THEN the row SHALL never have carried `enviando` and the notifier SHALL NOT be called

