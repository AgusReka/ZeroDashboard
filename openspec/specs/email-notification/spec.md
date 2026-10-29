# Email Notification Specification

## Purpose

Delivering an automation run's result rows to one recipient by email (N1), only when rows exist (X3), rendered legibly even when the data is incomplete (N2). Transport is SMTP via nodemailer behind an injectable notifier (DEC-81); the recipient is one validated address on the automation (DEC-82); the body is produced by a generic columns-driven renderer (DEC-85). Since CH-39, a template that declares its message texts gets a body of the header and one line per row instead of the table (DEC-188, DEC-192). A run sends at most one message (X6, DEC-107). Retries of the send (DEC-97), content or cooldown duplicate suppression, "send when empty", per-template HTML, and multi-section reports are out of scope (documented artifact limits, rule 6).

## Requirements

### Requirement: Notification Outcome Precedence Is Deterministic (DEC-83, DEC-84, DEC-86)

After a run's query finishes, the system SHALL compute exactly one `notificacion` value by evaluating these conditions in order, the first that holds winning:

| # | Condition | `notificacion` |
|---|-----------|----------------|
| 1 | The run's query failed | `null` (no notification attempted) |
| 2 | The query succeeded with zero rows | `omitida-sin-filas` |
| 3 | The automation's `destinatario` is null | `sin-destinatario` |
| 4 | SMTP is not configured | `no-configurada` |
| 5 | Send accepted by the transport | `enviada` |
| 6 | Send rejected, failed, or timed out | `fallo-envio` |

The system SHALL attempt a send only when the outcome reaches step 5 or 6. Exactly one send attempt SHALL be made per run; there SHALL be no retry.

#### Scenario: Query failed records null and sends nothing

- GIVEN a run whose query fails, with a recipient and SMTP configured
- WHEN the run closes
- THEN `notificacion` SHALL be `null` and the notifier SHALL NOT be called

#### Scenario: Zero rows never sends

- GIVEN a successful run returning zero rows, with a recipient and SMTP configured
- WHEN the run closes
- THEN `notificacion` SHALL be `omitida-sin-filas`, `estado` SHALL be `ok`, and the notifier SHALL NOT be called

#### Scenario: Precedence between missing recipient and unset SMTP

- GIVEN a successful run with rows, a null `destinatario`, and SMTP unset
- WHEN the run closes
- THEN `notificacion` SHALL be `sin-destinatario`

#### Scenario: SMTP unset with a recipient

- GIVEN a successful run with rows, a recipient, and SMTP unset
- WHEN the run closes
- THEN `notificacion` SHALL be `no-configurada`, `estado` SHALL be `ok`, and the notifier SHALL NOT be called

#### Scenario: Rows with recipient and SMTP configured send exactly once

- GIVEN a successful run with rows, a recipient, SMTP configured, and `formato` `correo-html`
- WHEN the run closes
- THEN the notifier SHALL be called exactly once with that recipient and `notificacion` SHALL be `enviada`

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
### Requirement: Recipient Is Validated and Header-Safe (DEC-82)

The `destinatario` MUST be a single syntactically valid email address, validated at automation creation, and MUST NOT contain CR, LF, commas, semicolons, or whitespace-separated additional addresses. A creation request with an invalid value SHALL be rejected with `400` naming the `destinatario` field and no row SHALL persist.

#### Scenario: Invalid recipient rejected

- GIVEN a create request with `destinatario` `"not-an-email"`
- WHEN it is handled
- THEN the response SHALL be `400` naming `destinatario` and no `Automatizacion` SHALL persist

#### Scenario: Header injection or multiple addresses rejected

- GIVEN a create request with `destinatario` `"a@x.com\r\nBcc: b@y.com"` or `"a@x.com,b@y.com"`
- WHEN it is handled
- THEN the response SHALL be `400` naming `destinatario`

### Requirement: Message Built From the Template's Texts (DEC-188, DEC-192)

WHEN the run's template has both `encabezadoMensaje` and `lineaMensaje`, and every placeholder of `lineaMensaje` names a column of the result, the body SHALL be the header followed by one line per rendered row, in row order, instead of the table. In each line, every placeholder SHALL be replaced by that row's cell of the named column, rendered as a table cell is (the em-dash placeholder for an empty value, the cell length cap). When a column name appears more than once in the result, the first such column SHALL be used. The truncation notice, the empty-cell notice and the footer SHALL appear as they do with the table. WHEN either text is null, the body SHALL be the table, exactly as before this change.

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

