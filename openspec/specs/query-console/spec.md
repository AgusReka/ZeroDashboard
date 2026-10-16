# Query Console Specification

## Purpose

The minimal P1 web console (DEC-07): the first visual surface of the project, letting an implementer write a query, trigger its execution against a registered connection, and see a paginated result or a legible error — without exposing raw driver errors, stack traces, or credential values.

## Requirements

### Requirement: Console Page Is Servable
The system SHALL serve a console page at `GET /consola`, without a session and without `X-Tenant-Id`. With a valid console session the page SHALL present a SQL input control and a way to trigger execution of the entered statement against a registered connection. Without a valid session it SHALL instead present the login screen and SHALL NOT contain the SQL input control. Both documents MUST link the shared stylesheet `/ui/styles.css` and MUST NOT carry the former inline `<style>` block of the full console styling. Both MUST contain exactly one closing script tag, no backtick, and no markup-assigning properties (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`) in their scripts. The console document MUST keep every guarded element id. The scripts MAY use `zd-` class names. The exact markup is otherwise a design-level concern.
(Previously: the page was served the same way to every request, with no session.)

#### Scenario: Requesting the console page with a session
- **GIVEN** a valid console session
- **WHEN** the console page is requested
- **THEN** the response SHALL be a page containing a SQL input control and a way to trigger execution

#### Scenario: Requesting the console page without a session
- **GIVEN** no cookie, or an expired or unknown session
- **WHEN** the console page is requested
- **THEN** the response SHALL be 200 with the login screen and SHALL NOT contain `<textarea id="sql"`

#### Scenario: Page links the shared stylesheet
- **WHEN** the console page is requested, with or without a session
- **THEN** it SHALL contain a `<link rel="stylesheet" href="/ui/styles.css">`
- **AND** it SHALL NOT contain the former inline full-console `<style>` rules

#### Scenario: Script hazards stay out of the page
- **WHEN** either document and its script are scanned
- **THEN** each SHALL contain exactly one closing script tag and no backtick
- **AND** neither SHALL contain `innerHTML`

#### Scenario: Script may reference the shared classes
- **WHEN** the script text is scanned for `zd-`
- **THEN** the scan SHALL NOT fail the page

### Requirement: Results Render as a Paginated Table

WHEN a query executes successfully, the console SHALL render the returned rows as a table and SHALL provide a way to move between pages of results.

#### Scenario: Viewing a page of results

- **GIVEN** the console page is loaded and a `SELECT` statement has been submitted against a registered, reachable connection
- **WHEN** execution succeeds
- **THEN** the returned rows SHALL be rendered as a table in the console
- **AND** the console SHALL provide a control to request another page of results when more rows exist

### Requirement: Failed Execution Surfaces a Legible Error

WHEN a submitted query fails to execute (for any reason, including rejection, a privilege block, a syntax error, or a timeout), the console SHALL display a legible error message and MUST NOT display a raw driver error, a stack trace, or fail silently.

#### Scenario: A failed execution is shown legibly

- **GIVEN** the console page is loaded and a statement is submitted that fails to execute
- **WHEN** the failure response is received by the console
- **THEN** the console SHALL display a legible error message describing the failure
- **AND** the console SHALL NOT display a raw driver error object or a stack trace
- **AND** the console SHALL NOT remain silent about the failure
### Requirement: Saving the Current Statement From the Console
The console SHALL save a query only from the query pop-up. With no saved query loaded, its save control «Guardar consulta» SHALL submit the name, description, SQL and parameter declaration to the saved-queries create endpoint. With a saved query loaded, the only save control SHALL be «Guardar como versión N+1», which updates that query (CH-25); no control SHALL create a separate query (DEC-172). Either control SHALL be enabled only while the last «Probar» of exactly the current connection, SQL and parameter declaration succeeded. While it is disabled, a line next to it SHALL say why in words (not tested yet, the last test failed, the content changed after the test, or no name).
(Previously: the create control lived on the screen and created a new query even with a saved query loaded, and nothing required a successful run.)

#### Scenario: Saving the statement currently in the editor
- GIVEN the query pop-up is open with no saved query loaded, a name, a connection and a SQL statement
- WHEN the operator presses «Probar» and the run succeeds, then «Guardar consulta»
- THEN the console SHALL submit a create request with the entered `sql` and `nombre`
- AND on success the console SHALL confirm the statement was saved and close the pop-up

#### Scenario: A loaded query cannot be saved as a copy
- GIVEN a saved query is loaded in the pop-up
- THEN «Guardar consulta» SHALL NOT be offered and «Guardar como versión N+1» SHALL be

#### Scenario: Saving needs a passing test of the current content
- GIVEN the last «Probar» succeeded
- WHEN the operator edits the SQL, the parameters or the connection
- THEN the save control SHALL be disabled until «Probar» succeeds again

### Requirement: Console Displays the List of Saved Queries

The console SHALL display the list of saved queries belonging to the tenant, showing at least each entry's `nombre`, using the metadata-only list endpoint.

#### Scenario: Viewing the saved queries list

- GIVEN at least one saved query exists for the tenant
- WHEN the console page is loaded or the list is refreshed
- THEN the console SHALL display each saved query's `nombre`
- AND the console SHALL NOT need to fetch each row's `sql` to render the list

### Requirement: Loading a Saved Query Into the Editor

The console SHALL provide a way to select a saved query from the displayed list and load its full `sql` into the editor, ready for execution, retrieving the full record via the get-by-id endpoint.

#### Scenario: Loading a saved query into the editor

- GIVEN the saved queries list is displayed and includes an entry
- WHEN that entry is selected to load
- THEN the console SHALL retrieve the full saved query including `sql`
- AND the editor SHALL be populated with that `sql`, ready to execute
### Requirement: Permanent Active-Tenant Indicator (T4)

The console SHALL display, at all times and without ambiguity, which tenant it is currently operating against. The no-active-tenant state MUST remain visually distinct from the active state and MUST still state in text that no tenant is selected.
(Previously: no requirement on the no-tenant state surviving restyling.)

#### Scenario: Indicator is always visible

- GIVEN the console page is loaded with an active tenant selected
- WHEN any part of the console is viewed
- THEN the active tenant SHALL be identifiable on screen without further action

#### Scenario: No-tenant state stays distinct

- GIVEN the console page is loaded with no active tenant
- WHEN the tenant bar is rendered with the shared stylesheet
- THEN it SHALL carry text stating no tenant is selected
- AND its style SHALL differ from the active-tenant state

## Resolved in design

- Console bridge CSS: a reduced inline `<style>` in `src/consola.ts` (a sixth file in `public/ui/` would break DEC-124 A2 and A3).
- Cache policy: `Cache-Control: no-cache` plus an ETag computed at boot (see the `shared-visual-system` Response Headers requirement).
- Unmatched `GET` paths: all give `400 tenant-no-indicado` (DEC-124 accepts this instead of 404).
- The registrar list and the exemption rows share one exported constant; a missing file stops boot (see `design.md`).
### Requirement: Tenant Selector

The console SHALL provide a control to select the active tenant from the tenants known to it.

#### Scenario: Switching the active tenant

- GIVEN the console page is loaded and more than one tenant exists
- WHEN the tenant selector is used to choose a different tenant
- THEN the indicator SHALL update to reflect the newly selected tenant

### Requirement: Active Tenant Forwarded on Every API Call (DEC-15)

The console SHALL forward the currently selected active tenant explicitly on every API call it makes, per DEC-15's explicit-per-request model.

#### Scenario: Selection carries through to a query action

- GIVEN a tenant is selected in the console
- WHEN the console executes a query, saves a query, or loads the saved-queries list
- THEN the request SHALL carry the selected tenant explicitly
- AND the response SHALL reflect only that tenant's data
### Requirement: Row-Cap Cutoff Is Surfaced Legibly

WHEN an execution response reports the row-cap cutoff verdict (per `query-execution`), the console SHALL display a legible message stating that the result was capped at the configured row limit, and this message SHALL be visually and textually distinguishable from the "load more" control the console shows when `hayMas` indicates further pages are available. The distinction MUST survive the shared stylesheet: the cutoff message and the "load more" control MUST NOT share one visual treatment.
(Previously: the distinction was required but not stated against the shared visual system.)

#### Scenario: Viewing a capped result

- **GIVEN** the console page is loaded and a statement is submitted whose execution is stopped by the row cap
- **WHEN** the response is received by the console
- **THEN** the console SHALL display a legible message stating the result was capped at the configured limit
- **AND** the console SHALL NOT present a "load more" control for that response

#### Scenario: A capped result is not mistaken for a partial page

- **GIVEN** the console page is loaded and a statement's execution returns the row-cap cutoff verdict
- **WHEN** the result is rendered
- **THEN** the cutoff message SHALL be distinguishable on screen from the ordinary pagination control used for `hayMas`

#### Scenario: Distinct styling after the restyle

- **GIVEN** the console styled by the shared stylesheet and its bridge rules
- **WHEN** the cutoff message and the pagination control are each rendered
- **THEN** their style classes SHALL differ and the cutoff message SHALL remain visible with its text intact

### Requirement: Per-Parameter Input Rendering

WHEN the statement currently in the editor declares parameters (inline, or loaded from a saved query's `parametros`), the console SHALL render one input control per declared parameter, labeled with its `nombre`, using an input appropriate to its `tipo` (`texto`, `numero`, `booleano`, `fecha`), and SHALL submit the collected values as a name→value map alongside the execution request. Saving submits the declaration only, never values (DEC-48).

#### Scenario: Rendering inputs for a declared parameter

- GIVEN the editor contains SQL with `:desde` and a declaration for `desde` as `fecha`
- WHEN the console detects the declaration
- THEN it SHALL render one input labeled `desde` appropriate for a date value

#### Scenario: Submitting collected parameter values

- GIVEN the console renders inputs for two declared parameters with values entered
- WHEN the execution control is used
- THEN the console SHALL submit a name→value map with both entered values alongside the execution request

### Requirement: Saving and Loading the Parameter Declaration With a Query

The console SHALL submit the current parameter declaration together with `sql` and `nombre` when saving a query, and SHALL render the saved declaration's inputs when a saved query is loaded into the editor (per `saved-queries`' `parametros`).

#### Scenario: Declaration saved with the query

- GIVEN the editor holds SQL with declared parameters
- WHEN the save control is used
- THEN the console SHALL submit the declaration in the create request's `parametros`

#### Scenario: Declaration loaded with the query

- GIVEN a saved query with a non-empty `parametros` is loaded into the editor
- WHEN the load completes
- THEN the console SHALL render one input per entry in the loaded `parametros`

### Requirement: Parameter Validation Error Surfaced Legibly

WHEN an execution or save request fails because of a parameter validation error (per `query-parameters` / `query-execution`), the console SHALL display a legible error naming the offending parameter, consistent with the existing legible-error requirement, and MUST NOT display a raw driver error or stack trace.

#### Scenario: A parameter error is shown legibly

- GIVEN a parametrized statement is submitted with a value that fails shape validation
- WHEN the `400` response is received
- THEN the console SHALL display a legible message naming the offending parameter
- AND the console SHALL NOT display a raw driver error object or a stack trace
### Requirement: Console Displays Automations and Supports Creating One (DEC-78)

The console SHALL display the active tenant's list of `Automatizacion` rows and SHALL provide a way to create one, submitting to the tenant-scoped create route. Creation SHALL be a two-step wizard in a wide pop-up (DEC-173) opened by «Nueva automatización» in the screen's page header, with a stepper showing the current step. Step 1 SHALL present a connection dropdown, filled from `GET /conexiones` when the wizard opens, above a template picker of cards. Step 2 SHALL present the template's parameters, the schedule presets, one optional recipient email input submitted as `destinatario`, a read-only email preview, a Volver control and a "Crear automatización" control. «Cancelar» and Escape SHALL behave as in every create pop-up. The create request body MUST keep its existing keys (`plantillaId`, `conexionId`, `valores`, `cron`, optional `destinatario`). On a 201 the console SHALL close the pop-up, show a success banner stating the first scheduled run and the time zone from the response, and reload the list. A rejected value SHALL be shown inside the pop-up as a legible error naming that field, without a raw error object or stack trace, and the pop-up SHALL stay open.
In the list, the connection SHALL be shown by its name, from `GET /conexiones` loaded with the list, or by its short id when it is not among the tenant's connections. The schedule SHALL be shown in words followed by the cron expression in monospace when it matches one of the DEC-129 presets (for example «Todos los días a las 06:00» and `0 6 * * *`), and as the cron expression alone otherwise.
(Previously: the wizard was revealed inline in the screen's body, and the list showed the raw `conexionId` and the raw cron. Before that: one flat form with a template select, a free-text connection UUID, a raw cron field and an optional recipient; the banner only confirmed creation.)

#### Scenario: Viewing the automations list

- **GIVEN** at least one automation exists for the active tenant
- **WHEN** the console's automations view is loaded
- **THEN** each automation SHALL be shown with at least its plantilla, connection, schedule, and `activo` state

#### Scenario: Connection and schedule in words

- **GIVEN** an automation on connection "food-store" with cron `0 6 * * 1-5`
- **WHEN** the list is shown
- **THEN** its row SHALL show "food-store" and «De lunes a viernes a las 06:00» followed by `0 6 * * 1-5`, and SHALL NOT show the connection's id

#### Scenario: Custom schedule and unknown connection

- **GIVEN** an automation with cron `*/30 8-18 * * *` whose connection is not among the tenant's connections
- **WHEN** the list is shown
- **THEN** its row SHALL show the connection's short id and the cron expression alone

#### Scenario: Creating an automation from the console

- **GIVEN** the automations view is loaded
- **WHEN** the wizard is completed with a connection, a template, parameter values, and a schedule and Crear automatización is used
- **THEN** the console SHALL submit a create request scoped to the active tenant
- **AND** on success the new automation SHALL appear in the list

#### Scenario: Creating with a recipient

- **GIVEN** the wizard is on step 2
- **WHEN** a recipient is entered and the form is submitted
- **THEN** the create request SHALL carry it as `destinatario`

#### Scenario: Invalid recipient shown legibly

- **GIVEN** the create form is submitted with an invalid recipient
- **WHEN** the `400` response is received
- **THEN** the console SHALL display a legible message naming the recipient field inside the pop-up
- **AND** SHALL NOT display a raw error object or stack trace

#### Scenario: Wizard opens on step 1

- **GIVEN** the automations view is loaded and the wizard is closed
- **WHEN** «Nueva automatización» is used
- **THEN** the wizard pop-up SHALL open on step 1 with the stepper marking step 1 as current
- **AND** one `GET /conexiones` request SHALL be issued with the active tenant

#### Scenario: Step navigation

- **GIVEN** the wizard is on step 1 with a connection and a template chosen
- **WHEN** Siguiente is used, then Volver
- **THEN** step 2 SHALL be shown with the stepper marking step 2 as current, then step 1 again with the earlier choices kept

#### Scenario: Parameters of the chosen template

- **GIVEN** a template declaring parameters is chosen
- **WHEN** step 2 is shown
- **THEN** one control per declared parameter SHALL be rendered, as before this change

#### Scenario: POST body is unchanged

- **GIVEN** a completed wizard
- **WHEN** Crear automatización is used
- **THEN** the POST body keys SHALL be a subset of `plantillaId`, `conexionId`, `valores`, `cron`, `destinatario`
- **AND** no tenant identifier SHALL appear in the body

#### Scenario: Success banner shows first run and zone

- **GIVEN** a `201` carrying `proximaEjecucion` and `zonaHoraria`
- **WHEN** the console handles it
- **THEN** the banner SHALL state the first scheduled run and the zone
- **AND** its wording SHALL frame the run as scheduled, not guaranteed

#### Scenario: Server 400 shown inside the pop-up

- **GIVEN** the create request returns `400` for an invalid schedule or a parameter problem
- **WHEN** the response is received
- **THEN** the pop-up SHALL show a legible message naming the offending field
- **AND** the pop-up SHALL stay open on step 2 with its values kept

#### Scenario: Tenant has no connections

- **GIVEN** `GET /conexiones` returns an empty list
- **WHEN** the wizard opens
- **THEN** the dropdown SHALL show a legible notice that there are no connections
- **AND** the console SHALL NOT fail or show a raw error

#### Scenario: Connections fetch fails

- **GIVEN** `GET /conexiones` fails
- **WHEN** the wizard opens
- **THEN** a legible notice SHALL be shown and the rest of the console SHALL keep working

### Requirement: Console Supports Deactivating an Automation (DEC-79)

The console SHALL provide a control to deactivate a listed active automation, and SHALL NOT provide a control to delete or reactivate one. Editing is «Ajustar» (DEC-174).
(Previously: the console offered no control to edit an automation.)

#### Scenario: Deactivating from the console

- GIVEN an active automation is listed
- WHEN the deactivate control is used
- THEN the console SHALL submit the deactivate action
- AND the list SHALL reflect its `activo: false` state

### Requirement: Console Adjusts an Automation in Place (DEC-174)

Each active automation in the list SHALL offer «Ajustar», next to «Desactivar»; a deactivated one SHALL NOT. «Ajustar» SHALL read `GET /automatizaciones/:id` and open a pop-up (DEC-173) titled «Ajustar automatización», showing the template's and the connection's names as read-only text, and prefilled with the stored values: one control per parameter the template currently declares, the schedule (a preset cron opens on its preset and hour; any other on «Personalizado» with the cron as stored) and the recipient. «Guardar ajustes» SHALL send `PUT /automatizaciones/:id/ajustes` with only the fields that changed: `valores` as the whole map of every declared parameter when any of them changed, `cron` when the schedule changed, and `destinatario` when the recipient changed, as `null` when it was emptied. With nothing changed, «Guardar ajustes» SHALL send nothing and say so inside the pop-up. On a `200` the pop-up SHALL close, the page notice SHALL state the next scheduled run and the zone, and the list SHALL reload. A `400` SHALL be shown inside the pop-up naming the offending field, and a `404` or `409` as a legible message inside it; the pop-up SHALL stay open with the typed values. A failed read SHALL open nothing and show a legible notice. The body SHALL NOT carry `plantillaId`, `conexionId`, `activo` or a tenant identifier.

#### Scenario: Adjust opens prefilled

- GIVEN an active automation on connection "food-store", template "Stock físico", cron `0 6 * * 1-5`, `valores` `{ "umbral": 5 }` and recipient `a@empresa.com`
- WHEN «Ajustar» is used on its row
- THEN one `GET /automatizaciones/:id` SHALL be sent with the active tenant
- AND the pop-up SHALL show "Stock físico" and "food-store" as text, `umbral` 5, «De lunes a viernes» at 06:00, and `a@empresa.com`

#### Scenario: Only the changed fields are sent

- GIVEN the adjust pop-up is open as above
- WHEN only the hour is changed to 07:30 and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be exactly `{ "cron": "30 7 * * 1-5" }`
- AND on `200` the pop-up SHALL close, the notice SHALL state the next run and the zone, and the list SHALL reload

#### Scenario: Emptying the recipient clears it

- GIVEN the adjust pop-up is open with a recipient
- WHEN the recipient field is emptied and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be `{ "destinatario": null }`

#### Scenario: A custom cron opens on Personalizado

- GIVEN an active automation with cron `*/30 8-18 * * *`
- WHEN «Ajustar» is used
- THEN the frequency SHALL be «Personalizado» and the cron field SHALL hold `*/30 8-18 * * *`, editable

#### Scenario: A refusal stays inside the pop-up

- GIVEN the adjust is answered `400` naming `destinatario`, or `409 automatizacion-desactivada`
- WHEN the console handles it
- THEN a legible message SHALL be shown inside the pop-up, which stays open with the typed values

#### Scenario: Deactivated automations offer no adjust

- GIVEN a deactivated automation is listed
- THEN its row SHALL offer «Ver ejecuciones» only

### Requirement: Console Displays an Automation's Runs (DEC-80)

The console SHALL provide a way to view a selected automation's `Ejecucion` rows, showing at least start, end, duration, row count, status, notification outcome (`notificacion`), attempts (`intentos`), and error when present. A null `notificacion` or null `intentos` SHALL render as a visible placeholder, never as the text `null`.
(Previously: did not show `intentos`.)

#### Scenario: Viewing an automation's runs

- GIVEN an automation with at least one recorded run
- WHEN its runs view is opened
- THEN each run SHALL be shown with start, end, duration, row count, status, notification outcome, and attempts
- AND a failed run SHALL show its classified error

#### Scenario: Notification outcomes are legible

- GIVEN runs with `notificacion` values `enviada`, `omitida-sin-filas`, and null
- WHEN the runs view is opened
- THEN each run SHALL show a legible label for its outcome and the null run SHALL show a placeholder

#### Scenario: Send failure visible as failure

- GIVEN a run with `estado='fallo'` and `fase='notificacion'`
- WHEN the runs view is opened
- THEN the run SHALL show its failed status and its `notificacion` outcome `fallo-envio`

#### Scenario: Attempts are shown, null is a placeholder

- GIVEN a run with `intentos=3` and an `omitida` run with null `intentos`
- WHEN the runs view is opened
- THEN the first SHALL show 3 and the second SHALL show a placeholder, not the text `null`
### Requirement: Automation Views Respect the Active-Tenant Indicator (T4, DEC-15)

The automations and runs views SHALL forward the currently selected active tenant explicitly on every call, per the existing active-tenant indicator and forwarding requirements. The wizard's calls (`GET /conexiones`, template detail, validation-mapping reads, create) MUST carry the tenant header. WHEN the active tenant changes, the console SHALL discard all wizard state (step, connection, chosen template, parameter values, schedule, recipient, validation results, preview), close the wizard pop-up, and SHALL ignore any response that started before the switch, including the connection names of the automations list. The tenant load SHALL issue, in order: the saved queries, the query pop-up's connections (CH-32a), the templates, the automations list's connection names and the automations.
(Previously: the tenant load issued exactly three requests and none to `GET /conexiones`; CH-32a added the query pop-up's connections and CH-32b the list's connection names.)

#### Scenario: Switching tenant updates the automations view

- **GIVEN** the automations view is showing tenant A's automations
- **WHEN** the tenant selector switches to tenant B
- **THEN** the view SHALL refresh to show only B's automations

#### Scenario: Tenant switch wipes the wizard

- **GIVEN** the wizard is on step 2 for tenant A with a template, a connection, values and a recipient
- **WHEN** the tenant selector switches to tenant B
- **THEN** the wizard pop-up SHALL be closed and every wizard field SHALL be empty
- **AND** no connection or template of A SHALL remain selectable

#### Scenario: Late response after a tenant switch is ignored

- **GIVEN** a `GET /conexiones`, template-detail or validation request was issued for tenant A
- **WHEN** its response arrives after the switch to tenant B
- **THEN** the console SHALL NOT use it to change the wizard, the dropdown or the automations list

#### Scenario: Tenant load requests

- **GIVEN** a tenant is selected
- **WHEN** the tenant load runs
- **THEN** it SHALL request, in order, `/consultas-guardadas`, `/conexiones`, `/plantillas`, `/conexiones` and `/automatizaciones`, each with that tenant
### Requirement: Runs View Shows Readable Messages for solapamiento and interrumpida (DEC-96, DEC-99)

In the runs view, a run with `error='solapamiento'` SHALL show a legible message stating that the run was skipped because the previous run was still in progress, and a run with `error='interrumpida'` SHALL show a legible message stating that the run was interrupted by a service restart. An `omitida` status SHALL render with a legible label. A `notificacion` of `enviando` SHALL render a legible "sending" label and `incierta` SHALL render a legible label stating it is unknown whether the email was sent. A run with `fase='notificacion'` and `error='tiempo-agotado'` SHALL show copy stating the email may have been delivered ("puede haberse entregado"), and MUST NOT state that the email was not sent; other send failures keep their existing copy. The raw values MUST NOT be the only text shown, and `null` MUST NOT be rendered as text. New label and copy strings MUST NOT contain a backtick, because the page script is embedded in a template literal.
(Previously: no labels for `enviando` or `incierta`; a timed-out send was shown as not sent.)

#### Scenario: Overlap skip is legible

- GIVEN a run with `estado='omitida'` and `error='solapamiento'`
- WHEN the runs view is opened
- THEN it SHALL show a legible skipped label and the overlap message

#### Scenario: Interrupted run is legible

- GIVEN a run with `estado='fallo'` and `error='interrumpida'`
- WHEN the runs view is opened
- THEN it SHALL show a failed status and the interruption message
- AND null `duracionMs`, `filas`, and `notificacion` SHALL render as placeholders

#### Scenario: Unknown error values still render

- GIVEN a run whose `error` is not a known value
- WHEN the runs view is opened
- THEN the view SHALL render without failing and without showing a stack trace

#### Scenario: Interrupted mid-send shows uncertainty

- GIVEN a run with `error='interrumpida'` and `notificacion='incierta'`
- WHEN the runs view is opened
- THEN it SHALL show the interruption message and a label stating it is unknown whether the email was sent

#### Scenario: Pending send is labelled

- GIVEN an `en-curso` run with `notificacion='enviando'`
- WHEN the runs view is opened
- THEN it SHALL show a legible sending label, not the raw value alone

#### Scenario: Timed-out send does not claim non-delivery

- GIVEN a run with `fase='notificacion'`, `notificacion='fallo-envio'`, and `error='tiempo-agotado'`
- WHEN the runs view is opened
- THEN it SHALL state the email may have been delivered
- AND SHALL NOT state that the email was not sent

#### Scenario: Console page stays servable

- GIVEN the new labels and copy
- WHEN the console page is requested
- THEN the response SHALL be a servable page and no new string SHALL contain a backtick
### Requirement: Console Markup Ids Are Guarded

A test MUST assert that the served console page keeps every identifier the inline script depends on: the existing `IDS` list plus `barra-tenant`, `resultados`, `guardado`, `automatizaciones`, and the wizard identifiers fixed by design (stepper, the two step panels, the new-automation control, the connection dropdown, the picker container, Siguiente, Volver, the frequency, hour, schedule-summary and preview containers). `auto-plantilla` MUST appear only if design keeps it. `banner` keeps its `role` and `hidden` attributes; `limite` keeps `min="1"` and has no `max`. Each id MUST appear exactly once.
(Previously: the id list had no wizard identifiers and `auto-plantilla` was a template select.)

#### Scenario: All ids present once

- **GIVEN** the served console page
- **WHEN** the guard test scans the markup
- **THEN** every guarded id occurs exactly once

#### Scenario: A renamed id fails the guard

- **GIVEN** markup in which one guarded id is renamed or duplicated
- **WHEN** the guard test runs
- **THEN** it fails naming the id

#### Scenario: Limit attributes preserved

- **GIVEN** the served console page
- **WHEN** the `limite` input is inspected
- **THEN** it has `min="1"` and no `max` attribute

### Requirement: Schedule Presets Translate to Cron (DEC-129)

Step 2 SHALL offer the frequencies `diaria`, `lun-vie`, `lun-sab` and `personalizado`, plus an hour. The script SHALL translate `diaria` to `M H * * *`, `lun-vie` to `M H * * 1-5` and `lun-sab` to `M H * * 1-6`, with `H` and `M` taken from the hour without leading zeros. The raw cron field SHALL always be visible: read-only and showing the translated cron while a preset is selected, editable only when `personalizado` is selected, whose value is submitted unchanged. Before creation the copy SHALL say the time is in the deployment's configured time zone, without naming a zone. An invalid hour MUST block submission with a legible message and send no request.

#### Scenario: Preset vectors

- **GIVEN** the hour `08:30`
- **WHEN** each preset is chosen and the form is submitted
- **THEN** the submitted `cron` SHALL be `30 8 * * *` for `diaria`, `30 8 * * 1-5` for `lun-vie` and `30 8 * * 1-6` for `lun-sab`

#### Scenario: Cron field shows the translation read-only

- **GIVEN** the hour `08:30` and the preset `lun-vie` selected
- **WHEN** step 2 is shown
- **THEN** the cron field SHALL be visible, read-only and show `30 8 * * 1-5`

#### Scenario: Personalizado makes the cron field editable and passes through

- **GIVEN** `personalizado` is chosen, the cron field is editable and holds `0 */2 * * *`
- **WHEN** the form is submitted
- **THEN** the submitted `cron` SHALL be exactly `0 */2 * * *`

#### Scenario: Invalid hour

- **GIVEN** a preset is chosen and the hour is empty or not a valid time
- **WHEN** Crear automatización is used
- **THEN** no create request SHALL be sent
- **AND** a legible message about the hour SHALL be shown

### Requirement: Template Availability Is Advisory (DEC-127)

Once a connection is chosen, the console SHALL read that connection's mapping validation and SHALL compare each template's own `entidades` against it, mirroring the run-time gate: a template is available only when every entity it declares is `valida`. A template that is not available SHALL render disabled with a legible reason naming the first blocking state (`no-mapeada`, `no-validado` or `invalida`). The check MUST be advisory: it SHALL NOT be sent to the server, and creation MUST NOT be gated by it on the server. WHEN the validation read fails, templates SHALL stay enabled and a legible notice SHALL be shown.

#### Scenario: Template with a non-valid entity is disabled

- **GIVEN** a connection whose entity `ventas` is `no-validado` and a template declaring `ventas`
- **WHEN** the connection is chosen
- **THEN** that template card SHALL be disabled and SHALL show a reason naming the unvalidated mapping

#### Scenario: Template with all entities valid stays enabled

- **GIVEN** a connection whose declared entities are all `valida`
- **WHEN** the connection is chosen
- **THEN** the template card SHALL be selectable

#### Scenario: Validation fetch fails

- **GIVEN** the validation read returns an error
- **WHEN** the connection is chosen
- **THEN** every template SHALL stay enabled
- **AND** a legible notice SHALL say availability could not be checked

#### Scenario: Late validation response is discarded

- **GIVEN** a validation request for connection X is pending
- **WHEN** the user chooses connection Y before it returns and X's response then arrives
- **THEN** the console SHALL NOT apply X's result

### Requirement: Read-Only Email Preview (DEC-131)

Step 2 SHALL show a read-only schematic of the notification email for the chosen template: the subject, a title bar in the accent colour of the template's `automatizacion` label, and a note that the columns are the query's column names. The preview MUST be built from DOM nodes and `textContent` only, MUST NOT show any row content, and MUST NOT be editable. The subject text MUST equal what the server's `asuntoCorreo` produces for the same label and name once the count placeholder `(n)` is substituted for the real count, for each known label and for an unknown label. The client subject does not reproduce the server's single-line normalization or the 200-character cut for unusual names; parity is required only for ordinary names.

#### Scenario: Preview parity with the server subject

- **GIVEN** each known label and one unknown label
- **WHEN** the preview subject is compared with `asuntoCorreo` output for the same label and name, with `(n)` substituted for the count
- **THEN** they SHALL be equal

#### Scenario: Preview is text-only and read-only

- **GIVEN** the preview is shown
- **WHEN** its nodes are inspected
- **THEN** it SHALL contain no input control and no markup-assigned content
- **AND** it SHALL contain no data from any query result

### Requirement: Template Cards Show a Description by Label (DEC-131)

Each template card SHALL show the template's `nombre` and a description chosen from a console-side map keyed by the `automatizacion` label. An unknown label SHALL render a neutral description and MUST NOT throw. Cards MUST NOT show an icon or the tolerance value.

#### Scenario: Known label

- **GIVEN** a template whose label is in the map
- **WHEN** step 1 renders
- **THEN** its card SHALL show its `nombre` and the mapped description

#### Scenario: Unknown label

- **GIVEN** a template with a label absent from the map
- **WHEN** step 1 renders
- **THEN** its card SHALL show a neutral description and the picker SHALL still render



## ADDED Requirements (CH-25, versions in the console, story B4)

### Requirement: Versions Panel
Each entry of the saved-query list SHALL offer a "Versiones" action that opens a panel with that query's history: version number, date, note and, for the current one, a "Vigente" state shown with an icon and text, never color alone. The panel SHALL show a loading state, the text "Esta es la versión inicial" when there is a single version, and a plain-text error when the request fails. Every value SHALL be written as text. Opening the panel of another query, or switching tenant, SHALL close the previous panel and clear its content.

#### Scenario: A query with history
- **GIVEN** a saved query with three versions
- **WHEN** the operator opens "Versiones"
- **THEN** three rows appear, newest first, and only the newest says "Vigente"

#### Scenario: A query never edited
- **WHEN** the operator opens "Versiones" on a query with one version
- **THEN** the panel says "Esta es la versión inicial" and offers no restore

#### Scenario: Tenant switch
- **GIVEN** an open panel
- **WHEN** the operator switches tenant
- **THEN** the panel is closed and holds no row of the previous tenant

### Requirement: Compare With the Current Version
Each non-current row SHALL offer "Comparar con la actual", which reads that version and the current one and shows them side by side as two plain-text blocks (name, description, statement and declared parameters). No difference is computed or highlighted (DEC-149).

#### Scenario: Compare
- **WHEN** the operator compares version 2 with the current version 5
- **THEN** two blocks are shown, one titled with version 2 and one with version 5, each with its own statement as text

#### Scenario: A hostile statement
- **GIVEN** a version whose statement contains markup
- **THEN** it is shown as text and never interpreted

### Requirement: Restore With Confirmation
"Restaurar" SHALL ask for confirmation inside the panel with a button that repeats the action and the object («Restaurar versión 2») and a cancel button, never "Sí" or "Aceptar". Confirming SHALL send `POST .../versiones/<n>/restaurar` with the optional note, refresh the panel and the saved-query list, and say that a new version was created.

#### Scenario: Confirm
- **WHEN** the operator presses Restaurar on version 2 and confirms
- **THEN** exactly one restore request is sent for version 2 and the panel shows the new version as "Vigente"

#### Scenario: Cancel
- **WHEN** the operator cancels the confirmation
- **THEN** no request is sent

#### Scenario: Refusals
- **WHEN** the server answers 404, 409 `version-vigente` or any other error
- **THEN** the panel shows the reason in plain text and keeps the previous rows

### Requirement: Save as a New Version
With a saved query loaded in the query pop-up, the console SHALL offer «Guardar como versión N+1» (N being the loaded version) with an optional note field, enabled under the same test gate as «Guardar consulta». It SHALL send `PUT /consultas-guardadas/<id>` with the pop-up's name, description, statement, declared parameters and the note, exactly as the create sends them, then close the pop-up and refresh the list. A `409 sin-cambios` SHALL read "No hay cambios respecto de la versión vigente" and a `409 conflicto-de-edicion` SHALL ask to reload the query, both inside the pop-up, which stays open. The saved-queries help text SHALL still say that a saved query cannot be deleted.
(Previously: «Guardar como nueva versión» below the list, with no test gate.)

#### Scenario: Save a change
- **GIVEN** a saved query opened in the pop-up, its statement modified and tested
- **WHEN** the operator saves it as a new version with the note "Agrega filtro"
- **THEN** one PUT request is sent for that query's id with the pop-up's content and the note, the pop-up closes and the list is refreshed

#### Scenario: Nothing loaded
- **WHEN** no saved query has been loaded
- **THEN** the save-as-version action is not offered

#### Scenario: Switching tenant forgets the loaded query
- **WHEN** the operator switches tenant
- **THEN** the loaded query is forgotten, the pop-up closes and the action disappears

### Requirement: Console Login Screen
The login screen SHALL ask for the operator's name and password, send them to `POST /consola/ingresar`, and reload the page on 200. On 401 it SHALL say "Nombre o clave incorrectos." and keep the name typed; on any other failure it SHALL say the console could not be reached. It SHALL follow the project design skill.

#### Scenario: Wrong password
- **WHEN** the operator submits a wrong password
- **THEN** the screen shows "Nombre o clave incorrectos." and does not reload

### Requirement: Operator Shown in the Header
With a session, the console header SHALL show the operator's name, inserted as text (escaped by the server), next to a "Salir" action that calls `POST /consola/salir` and reloads the page.

#### Scenario: A name with markup is shown as text
- **GIVEN** an operator named `<b>ana</b>`
- **WHEN** the console page is served
- **THEN** the header contains `&lt;b&gt;ana&lt;/b&gt;` and no `<b>` element

### Requirement: A 401 Returns to the Login Screen
Every API call the console page makes, the tenant list included, SHALL reload the page when the answer is 401, so the server serves the login screen.

#### Scenario: Session expires while working
- **GIVEN** the console is open and the session expires
- **WHEN** the operator runs any action
- **THEN** the page reloads and shows the login screen

### Requirement: Execution Names the Loaded Saved Query
When a saved query is loaded and the editor's statement is still exactly the loaded one, every `POST /consultas/ejecutar` the console sends SHALL include that query's `consultaGuardadaId` and `version`. When no query is loaded, or the operator changed the statement, or the tenant changed, the request SHALL include neither.

#### Scenario: Running the loaded query
- **GIVEN** saved query q-1 at version 3 loaded in the editor
- **WHEN** the operator runs it without editing
- **THEN** the request body carries `consultaGuardadaId` "q-1" and `version` 3

#### Scenario: Running after an edit
- **WHEN** the operator changes the statement and runs it
- **THEN** the request body carries neither field

### Requirement: Console Shell and Screens
Below the tenant bar, the console document SHALL hold a shell with a side navigation and a main area. The main area SHALL hold the alert banner, always visible, and one `section` per screen: `pantalla-consultas`, `pantalla-automatizaciones` and `pantalla-frescura`, each with a page header naming the screen and its scope ("Del tenant activo"). Every id the console had before this change SHALL appear exactly once, unchanged.

#### Scenario: Every guarded id survives the move
- **WHEN** the console document is served
- **THEN** each guarded id appears exactly once, and the three screen sections and their navigation links exist

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order, a "Global" group with `#tenants`, `#plantillas` and `#contrato`, a "Puesta en marcha" group with `#conexiones`, `#agentes`, `#mapeo`, `#usuarios` and `#tiempos`, and a "Trabajo diario" group with `#consultas`, `#automatizaciones`, `#frescura` and `#auditoria`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#tiempos`
- **THEN** only Tiempos de alta is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

### Requirement: Result Next to the Execute Button
Inside the query pop-up, the status line, the results table and the pager SHALL come right after the query form and before the pop-up's actions («Probar» and the save control); the pop-up comes before the saved queries section in the document.
(Previously: on the Consultas screen, right after the execute button and before the saved queries.)

#### Scenario: Result placement
- **WHEN** the console document is served
- **THEN** the results table appears after the query form and before «Probar», inside the query pop-up, and the pop-up appears before the saved queries section, all inside the Consultas screen

### Requirement: Tenants Screen
The Tenants screen SHALL list every tenant, active and deactivated, with its name, a short id, its state ("Activo" or "Dado de baja") and its creation date, written as text. «Nuevo tenant» SHALL open a pop-up with the name and two actions, «Crear tenant» and «Crear y elegir», plus «Cancelar». Both SHALL send the typed name to `POST /tenants` and, on 201, close the pop-up and reload the list and the tenant selector; «Crear y elegir» SHALL then make the new tenant the console's active tenant, exactly as "Elegir como activo" does. An empty name SHALL be refused inside the pop-up with nothing sent. An active tenant SHALL offer "Elegir como activo", which makes it the console's active tenant, and "Dar de baja", which opens a confirmation pop-up (DEC-175). The pop-up SHALL name the tenant, say that the baja cannot be undone, and hold one text field; its action «Dar de baja {nombre}» SHALL stay disabled until the field is exactly the tenant's name, and SHALL then send `POST /tenants/:id/baja` with `{ "nombre": <the typed text> }`. «Cancelar» and Escape SHALL close it without sending anything and without asking. A refusal SHALL be shown inside the pop-up. A deactivated tenant SHALL offer no action and SHALL NOT be selectable (DEC-168). When the active tenant is deactivated, the console SHALL return to "ningún tenant" and say so.
(Previously: "Dar de baja" asked for an inline confirmation «Dar de baja {nombre}» in the row and sent the baja with no body.)

#### Scenario: Create a tenant
- **WHEN** the operator creates "Almacén Don Tito" with «Crear tenant»
- **THEN** the list and the selector show it, and the active tenant does not change

#### Scenario: Create and choose a tenant
- **GIVEN** tenant A is active
- **WHEN** the operator creates "Almacén Don Tito" with «Crear y elegir»
- **THEN** the list and the selector show it, and it becomes the active tenant

#### Scenario: The baja waits for the exact name
- **GIVEN** the baja pop-up of "Almacén Don Tito" is open
- **WHEN** the operator types "almacén don tito"
- **THEN** «Dar de baja Almacén Don Tito» stays disabled
- **WHEN** the operator types "Almacén Don Tito"
- **THEN** it becomes enabled

#### Scenario: Deactivate the active tenant
- **GIVEN** tenant A is active
- **WHEN** the operator types "A" in its baja pop-up and confirms «Dar de baja A»
- **THEN** the request body is `{ "nombre": "A" }`
- **AND** A is listed as "Dado de baja" with no action, the selector no longer offers it, and the bar shows no tenant

#### Scenario: Cancel the confirmation
- **WHEN** the operator opens the baja pop-up, types part of the name and presses «Cancelar» or Escape
- **THEN** the pop-up closes without asking and no request is sent

### Requirement: Connections Screen
The Conexiones screen SHALL list the active tenant's connections with name, engine, host and port, database and user, written as text; with no tenant it SHALL say to choose one. «Nueva conexión» SHALL open a pop-up with name, host, port, database, user, the way it reaches the replica and password; «Guardar y probar» SHALL send `POST /conexiones` with engine `postgres`, then, on 201, `POST /conexiones/:id/prueba`, close the pop-up, report «Guardada.» with the test result in the screen's notice (also when the test fails, since the connection is saved) and reload the list. A rejected registration SHALL keep the pop-up open with the message inside it. The password field SHALL be emptied after sending, and no password SHALL ever be written to the page. Each listed connection SHALL offer "Probar", whose result appears next to it: "OK" with the duration, or the failure's category and code.
(Previously: "Nueva conexión" opened a side panel that stayed open showing the test result.)

#### Scenario: Register and test
- **WHEN** the operator fills the pop-up and presses «Guardar y probar»
- **THEN** the connection is created and tested, the pop-up closes, the notice shows the test result, no password appears in the page and the list shows the new connection

#### Scenario: Saved but the test fails
- **WHEN** the registration answers 201 and the test answers `fallo` with category `red`
- **THEN** the pop-up closes and the notice says the connection was saved and the test failed with that category

#### Scenario: Rejected registration
- **WHEN** the registration answers 400 naming `host`
- **THEN** the pop-up stays open, names the field and the password field is empty

#### Scenario: A failed test
- **WHEN** "Probar" answers `fallo` with category `credenciales-invalidas`
- **THEN** the row shows the failure with that category, and no password appears anywhere in the page

### Requirement: Secrets Are Shown Once
An agent token or a generated panel password SHALL appear only in the notice of the action that produced it, with "Copiar" and "Ya lo guardé". The notice SHALL be emptied when the operator presses "Ya lo guardé", when the screen is left and when the active tenant changes; the secret SHALL NOT be written to any other node.

#### Scenario: Dismissing a secret
- **GIVEN** a token is shown
- **WHEN** the operator presses "Ya lo guardé"
- **THEN** no node of the page contains the token

#### Scenario: Leaving the screen
- **GIVEN** a password is shown
- **WHEN** the hash changes to another screen
- **THEN** no node of the page contains the password

### Requirement: Agents Screen
The Agentes screen SHALL show the active tenant's agent, if any, with its state ("Activo" or "Revocado"), creation date and last token emission date; with no tenant it SHALL say to choose one. With no agent it SHALL offer "Crear agente"; with a revoked one, "Emitir un token nuevo"; both send `POST /agentes` and show the token once. An active agent SHALL offer "Revocar", which asks for an inline confirmation saying the agent's connections stop working until a new token is emitted, before `POST /agentes/:id/revocar`.

#### Scenario: Create an agent
- **GIVEN** the tenant has no agent
- **WHEN** the operator presses "Crear agente"
- **THEN** the token is shown once and the agent is listed as active

#### Scenario: Revoke
- **WHEN** the operator presses "Revocar" and confirms
- **THEN** the agent is listed as revoked and offers "Emitir un token nuevo"

### Requirement: Connection Through the Agent
The new-connection pop-up SHALL offer how the connection reaches the replica: direct, or through the tenant's agent when it has an active one. Choosing the agent SHALL send its `agenteId` with the registration.
(Previously: the new-connection panel.)

#### Scenario: Register through the agent
- **GIVEN** the tenant has an active agent
- **WHEN** the operator chooses it and saves
- **THEN** the registration carries that `agenteId`

### Requirement: Panel Users Screen
The Usuarios del panel screen SHALL list the active tenant's panel users with email, name, state ("Activo" or "Desactivado") and creation date; with no tenant it SHALL say to choose one. «Nuevo usuario» SHALL open a pop-up with the email and the optional name; «Crear usuario» SHALL send them to `POST /usuarios` and, on 201, close the pop-up and show the generated password once in the screen's notice. Each active user SHALL offer «Reponer clave» and "Desactivar"; each deactivated user, "Reactivar" and «Reponer clave». «Reponer clave» SHALL ask for an inline confirmation «Reponer clave de {correo}», saying that the user's open sessions will be closed, before `POST /usuarios/:id/clave`; the new password is then shown once. "Desactivar" SHALL ask for an inline confirmation. A `409 correo-en-uso` SHALL say, inside the pop-up, that the email is already in use.
(Previously: "Nuevo usuario" was an inline form and «Reponer clave» was sent on the first click.)

#### Scenario: Create a user
- **WHEN** the operator creates "ana@negocio.com"
- **THEN** the pop-up closes, the generated password is shown once and the user is listed as active

#### Scenario: Email in use
- **WHEN** the creation answers `409 correo-en-uso`
- **THEN** the pop-up stays open, says the email is already in use and shows no password

#### Scenario: Reset a password after confirming
- **WHEN** the operator presses «Reponer clave» on "ana@negocio.com"
- **THEN** nothing is sent and the row asks «Reponer clave de ana@negocio.com», saying that the user's sessions will be closed
- **AND** confirming sends `POST /usuarios/:id/clave` and shows the new password once

#### Scenario: Cancel the reset
- **WHEN** the operator presses «Reponer clave» and then «Cancelar»
- **THEN** no request is sent

### Requirement: Templates Screen
The Plantillas screen SHALL list the template catalog (`GET /plantillas`) with name, automation, format and freshness tolerance, written as text, and say when the list was cut. "Ver" SHALL load the template (`GET /plantillas/:id`) and show, in a side panel, the entities it needs, its declared parameters and its statement as text. The screen SHALL offer no way to create or change a template, nor to save it as a query (DEC-177).

The side panel SHALL hold a «Probar en el tenant activo» block, the one tenant-scoped part of the screen. It SHALL contain:
- a connection select filled from the active tenant's connections;
- one input per parameter the template declares;
- «Probar».

«Probar» SHALL send `POST /plantillas/:id/prueba` with the active tenant, the chosen `conexionId`, and `valores` holding every declared parameter. It SHALL request the first page only.

The answers SHALL be shown as follows, all inside the block and written as text:

| Answer | What the block shows |
|---|---|
| `200` with `resultado: "ok"` | The columns and rows as a table, the number of rows shown, and whether there are more. |
| `200` with `resultado: "fallo"` | The failure message, as the query pop-up writes it. |
| `409 vista-canonica-no-aprobada` | The entities whose views are not approved, pointing to Mapeo y validación. |
| `400` | The offending parameters. |
| `404`, `409 credencial-ilegible` and tenant failures | A legible message. |

With no active tenant, the block SHALL say «Elegí un tenant para probar la plantilla» and send nothing. With no connection chosen, it SHALL say so and send nothing. Loading another template, closing the panel or switching the active tenant SHALL clear the result.
(Previously: the panel was read-only and nothing in the console called the test route.)

#### Scenario: Viewing a template
- **WHEN** the operator presses "Ver" on "Stock diario"
- **THEN** the panel shows its entities, parameters and statement, as text

#### Scenario: Testing a template on a connection
- **GIVEN** an active tenant with connection "food-store" and a template declaring `umbral` (numero)
- **WHEN** the operator chooses "food-store", types 5 in `umbral` and presses «Probar»
- **THEN** one `POST /plantillas/:id/prueba` is sent with the active tenant, `conexionId` of "food-store" and `valores` `{ "umbral": 5 }`
- **AND** the block shows the returned columns and rows as text

#### Scenario: The views are not approved
- **WHEN** «Probar» answers `409 vista-canonica-no-aprobada` with entities `producto` and `insumo`
- **THEN** the block names `producto` and `insumo` and points to Mapeo y validación, and shows no table

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the operator opens a template and presses «Probar»
- **THEN** the block says «Elegí un tenant para probar la plantilla» and no request is sent

#### Scenario: Another template clears the result
- **GIVEN** a result is shown for one template
- **WHEN** the operator presses "Ver" on another template
- **THEN** the block shows no result

### Requirement: Contract Screen
The Contrato screen SHALL show the canonical contract (`GET /contrato`): one block per entity with its name and whether it is obligatory, and under it each field with its name, type, whether it is obligatory and the automations that use it.

#### Scenario: Reading the contract
- **WHEN** the operator opens Contrato
- **THEN** the five entities appear in contract order, each with its fields

### Requirement: Mapping and Validation Screen
The Mapeo y validación screen SHALL, for the active tenant, let the operator choose one of its connections and then show, for each of the five contract entities in contract order: its obligatoriness, its state ("Sin mapear", "Sin validar", "Válida" or "Inválida"), its SQL in an editor, an example, and its last diagnostics per field (verdict, column, observed type and cast hint). "Guardar" SHALL send the entity's SQL to `PUT /conexiones/:id/vistas-canonicas/:entidad` and then show the entity as "Sin validar". "Validar" SHALL send `POST /conexiones/:id/validacion-mapeo` and show the new report; when the answer is a session failure (`resultado: "fallo"`), it SHALL show the phase, category and code apart and keep showing the last stored report. The three automations SHALL appear with their state and every reason. With no tenant, or no connection chosen, the screen SHALL say what to choose and send nothing. Every SQL statement, example and diagnostic SHALL be written as text.

Above the entities, the screen SHALL show a collapsible step-by-step guide, «Cómo mapear», in the static markup, stating in order: choose the connection; per entity, write one SELECT over the client's replica whose columns are named exactly like the contract fields, camelCase names in double quotes, with the contract's types; «Guardar» each entity; «Validar mapeo» and read each field's verdict and cast hint; the automations table says which automations the mapping enables. It SHALL say that optional entities can stay unmapped.

Each entity block SHALL show, collapsed, that entity's fixed example over the food_store demo replica (DEC-176), labelled as an example over the demo schema, and a «Usar de punto de partida» action. The action SHALL copy the example into that entity's editor only when the editor is empty or holds only whitespace. Otherwise it SHALL leave the editor unchanged and say that the editor already has SQL. The action SHALL NOT send any request nor change the entity's state. Each example SHALL name every field of its entity in the contract as a column alias, quoted when camelCase, and no other alias.
(Previously: no guide and no example; editors started empty with no help beyond the page description.)

#### Scenario: Saving an entity
- **WHEN** the operator edits the SQL of `producto` and presses "Guardar"
- **THEN** the statement is sent to `PUT …/vistas-canonicas/producto` and the entity shows "Sin validar"

#### Scenario: A session failure
- **WHEN** "Validar" answers `resultado: "fallo"` with category `credenciales-invalidas`
- **THEN** the screen says so, and the entities keep their previous states

#### Scenario: An invalid field
- **GIVEN** the report says `stockDisponible` has verdict `tipo-incorrecto` with the hint `::numeric`
- **THEN** the entity shows that field, its verdict and the hint

#### Scenario: The guide is part of the screen
- **WHEN** the operator opens Mapeo y validación
- **THEN** the «Cómo mapear» guide is present above the entities, in the static markup

#### Scenario: Copying the example into an empty editor
- **GIVEN** the editor of `insumo` is empty
- **WHEN** the operator presses «Usar de punto de partida» in the `insumo` block
- **THEN** the editor holds the `insumo` example
- **AND** no request is sent and the entity keeps its state

#### Scenario: The example never overwrites SQL
- **GIVEN** the editor of `producto` holds the stored SQL
- **WHEN** the operator presses «Usar de punto de partida» in the `producto` block
- **THEN** the editor is unchanged and the screen says the editor already has SQL
- **AND** no request is sent

#### Scenario: Each example matches the contract
- **WHEN** the aliases of each example are compared with its entity's fields in `CONTRATO_CANONICO`
- **THEN** they are the same set, camelCase names quoted

### Requirement: Create and Edit Forms Open in a Pop-up (DEC-173)
In the console, every form that creates or modifies a record SHALL open in a pop-up over the screen (`.zd-dialog` on `.zd-dialog-backdrop`), holding every field of the record, with a title, the main action (verb + object) and «Cancelar» at its foot. This covers the query pop-up, «Nuevo tenant», «Nueva conexión», «Nuevo usuario», the automation wizard and the automation adjust. A create pop-up SHALL be opened from its screen's page header; an edit pop-up from its record's row. On opening, the focus SHALL go to its first field. «Cancelar» and the Escape key SHALL close it without sending anything; when there are unsaved changes they SHALL first ask «Descartar cambios», offering «Descartar cambios» and «Seguir editando». A switch of the active tenant SHALL close any open pop-up without asking. Such a form SHALL NOT be rendered inline above or below a table, nor in a side panel. Read-only detail (version history, template detail) stays in the side panel. Inline confirmations of destructive actions are outside this rule, except a tenant's baja, which is confirmed in its own pop-up by typing the name (DEC-175).
(Previously: did not cover the automation adjust nor the tenant baja confirmation, and every pop-up opened from the page header.)

#### Scenario: Cancelling a form with no changes
- GIVEN a create or edit pop-up is open and nothing was changed
- WHEN the operator presses «Cancelar» or Escape
- THEN the pop-up closes and no request is sent

#### Scenario: Cancelling a form with changes
- GIVEN the operator changed a field
- WHEN «Cancelar» or Escape is pressed
- THEN the pop-up asks «Descartar cambios» and stays open until that is confirmed
- AND «Seguir editando» keeps the pop-up open with the typed values

#### Scenario: Opening puts the focus on the first field
- WHEN the operator presses «Nuevo usuario»
- THEN the pop-up opens and the focus is on the email field

#### Scenario: A tenant switch closes an open pop-up
- GIVEN the «Nueva conexión» pop-up is open with a host typed
- WHEN the operator switches the active tenant
- THEN the pop-up closes without asking and nothing is sent

### Requirement: Query Screen and Query Pop-up (DEC-172, DEC-173)
The Consultas screen SHALL show a page header with «Nueva consulta» and the saved queries list, each entry with «Abrir» and «Versiones». «Nueva consulta» SHALL open the query pop-up empty, titled «Nueva consulta»; «Abrir» SHALL open it with that query loaded, titled with its name and «versión N». The pop-up SHALL hold, in order: name, description, connection, SQL, parameters (declaration and test values) and, for a loaded query, the version note; and the actions «Probar», the save control and «Cancelar». «Probar» SHALL run the statement against the chosen connection and show the result, paginated, inside the pop-up. The pop-up SHALL close on a successful save and on a tenant switch. The version history SHALL open in a wide side panel.

#### Scenario: Writing and testing a new query
- WHEN the operator presses «Nueva consulta», chooses a connection, writes a statement and presses «Probar»
- THEN the result appears inside the pop-up and «Guardar consulta» becomes enabled once a name is typed

#### Scenario: Opening a saved query
- GIVEN saved query «Stock bajo» at version 3
- WHEN the operator presses «Abrir» on it
- THEN the pop-up is titled «Stock bajo · versión 3», holds its name, description, SQL and parameter declaration, keeps the last chosen connection, and offers «Guardar como versión 4»

### Requirement: Connection Picker
The connection in the query pop-up SHALL be chosen from a list of the active tenant's connections (`GET /conexiones`), each shown by its name and a short id (as in the automation wizard) with the full id as the value. It SHALL be loaded when the active tenant is set and when the Consultas screen is shown, with loading, empty (pointing to Conexiones), truncated and error («Reintentar») states. The connection is used to test and is not saved with the query (DEC-11). The last choice SHALL be kept when another query is opened. «Probar» with no connection chosen SHALL say «Elegí una conexión para ejecutar» and send nothing.

#### Scenario: Picking a connection
- GIVEN the tenant has connections "food-store" and "replica-b"
- WHEN the operator opens the query pop-up
- THEN the picker lists both by name and short id, and «Probar» sends the chosen one's id as `conexionId`

#### Scenario: No connection chosen
- WHEN the operator presses «Probar» without choosing a connection
- THEN the console says «Elegí una conexión para ejecutar» and sends no execution request

### Requirement: Audit Screen
The Auditoría screen SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /auditoria` with the current filters and list the rows newest first. With no active tenant it SHALL say «Elegí un tenant para ver su auditoría.» and send nothing.

The filters SHALL be «Desde» and «Hasta» (dates) and «Resultado» (Todos, OK, Falló); «Filtrar» SHALL reload the list with them. A date SHALL mean the operator's local day: «Desde» is sent as the instant the local day starts, «Hasta» as the last millisecond of the local day, both in ISO form. An empty filter SHALL not be sent. «Desde» later than «Hasta» SHALL be refused on screen with nothing sent.

Each row SHALL show, as text:

| Column | Content |
|---|---|
| Fecha y hora | `creadoEn`, local date and time to the second |
| Operador | `operadorNombre` |
| Origen | Consulta, Prueba de plantilla, Validación de mapeo or Prueba de conexión |
| Conexión | The connection's name from `GET /conexiones`; an unknown id shows its first eight characters |
| Consulta | The saved query's name and version («Stock v3»), the template id for a template test, else «Ad hoc» |
| SQL | The statement cut to 80 characters, with the full statement available on demand |
| Filas | `filas`, or empty when null |
| Duración | `duracionMs`, in ms below one second and in seconds above |
| Resultado | «OK», or «Falló» followed by the console's failure message for `fase`, `categoria` and `codigo` |

The screen SHALL offer no way to change or delete a row. When the answer says `truncado`, the screen SHALL say that only the most recent 200 rows are shown and suggest narrowing the dates. An empty list SHALL say «No hay ejecuciones registradas con estos filtros.». A `400` SHALL say to check the dates; network, tenant and other HTTP failures SHALL be legible.

#### Scenario: Listing the audit
- **GIVEN** an active tenant whose audit holds one failed run of the saved query "Stock" version 3 on connection "food-store" by operator "Ana"
- **WHEN** the hash becomes `#auditoria`
- **THEN** one `GET /auditoria` is sent with the active tenant
- **AND** the row shows "Ana", "Consulta", "food-store", "Stock v3" and "Falló" with the failure message, all as text

#### Scenario: Filtering by local day and result
- **WHEN** the operator sets «Desde» and «Hasta» to the same day, «Resultado» to OK, and presses «Filtrar»
- **THEN** the request carries `desde` at that local day's start, `hasta` at its last millisecond, and `resultado=ok`

#### Scenario: Inverted dates
- **WHEN** «Desde» is later than «Hasta» and the operator presses «Filtrar»
- **THEN** the screen says so and no request is sent

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the hash becomes `#auditoria`
- **THEN** the screen says «Elegí un tenant para ver su auditoría.» and no request is sent

#### Scenario: Cut list
- **WHEN** the answer has `truncado: true`
- **THEN** the screen says only the most recent 200 rows are shown

#### Scenario: Markup in a statement is text
- **WHEN** a row's `sql` contains `<b>`
- **THEN** it is shown verbatim and no element is created from it

### Requirement: Onboarding Times Screen
The Tiempos de alta screen SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /tiempos-alta` and show one block per connection, titled with its name, holding these stages in this order:

| Stage | Mark |
|---|---|
| Alta del tenant | `altaInicio` |
| Conexión registrada | `conexionRegistrada` |
| Inicio del mapeo | `mapeoInicio` |
| Última edición del mapeo | `mapeoFin` |
| Última validación | `validacionUltima`, with «Válida», «Inválida» or the state as it comes |
| Primera automatización | `automatizacionCreada` |
| Primera ejecución | `primeraEjecucion`, with «OK» or «Falló» and the phase |
| Primera ejecución OK | `primeraEjecucionOk` |

A reached stage SHALL show its local date and time to the minute and, when the nearest earlier reached stage of the block is not later, the time elapsed since it. An unreached stage SHALL show "—" and a neutral «Pendiente». Every value SHALL be text. The screen SHALL say that the marks measure elapsed time, not effort.

With no active tenant it SHALL say «Elegí un tenant para ver sus tiempos de alta.» and send nothing. With no connections it SHALL say «Este tenant todavía no tiene conexiones.». When the answer says `truncado`, it SHALL say that only the first 200 connections are shown. Network, tenant and other HTTP failures SHALL be legible.

#### Scenario: Stages of a connection
- **GIVEN** an active tenant with connection "food-store" that was registered and mapped but never validated
- **WHEN** the hash becomes `#tiempos`
- **THEN** one `GET /tiempos-alta` is sent with the active tenant
- **AND** a block titled "food-store" shows dates for the first four stages and "—" with «Pendiente» for the other four

#### Scenario: Elapsed time
- **GIVEN** a connection registered 2 hours 5 minutes after the tenant's start
- **THEN** «Conexión registrada» shows `+2 h 5 min`

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the hash becomes `#tiempos`
- **THEN** the screen says «Elegí un tenant para ver sus tiempos de alta.» and no request is sent

#### Scenario: Markup in a name is text
- **WHEN** a connection's name contains `<b>`
- **THEN** it is shown verbatim and no element is created from it
