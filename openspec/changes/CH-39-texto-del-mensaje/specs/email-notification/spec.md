# Email Notification Specification (CH-39 delta)

## Purpose
When the template declares its message texts, the email body is the header plus one line per row, built from the result's values (DEC-188 (b)). When it does not, or when the result lacks a column the line needs, the body is today's table. The subject, themes, row cap, cut notice, empty-cell placeholder and footer do not change.

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Message Carries a text/plain Alternative

Every message SHALL include a `text/plain` alternative alongside the HTML part, with the same columns, rows, placeholders, and truncation notice; when the body is built from the template's texts, it SHALL carry the same header and lines instead of the columns and rows.
(Previously: the text part always carried the table.)

#### Scenario: Both parts present

- GIVEN a message built for a result with rows
- WHEN it is inspected
- THEN it SHALL contain an HTML part and a non-empty `text/plain` part
