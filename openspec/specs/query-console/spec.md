# Query Console Specification

## Purpose

The minimal P1 web console (DEC-07): the first visual surface of the project, letting an implementer write a query, trigger its execution against a registered connection, and see a paginated result or a legible error — without exposing raw driver errors, stack traces, or credential values.

## Requirements

### Requirement: Console Page Is Servable

The system SHALL serve a console page, reachable by a request, that presents a SQL input control and a way to trigger execution of the entered statement against a registered connection. The page MUST link the shared stylesheet `/ui/styles.css` and MUST NOT carry the former inline `<style>` block of the full console styling; any residual console-specific stylesheet location is a design-level concern. The page MUST keep every guarded element id, the page MUST contain exactly one closing script tag, and neither the page nor its script MUST contain a backtick character. The inline script MUST NOT use markup-assigning properties (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`). The inline script MAY use `zd-` class names. The exact markup is otherwise a design-level concern.
(Previously: the inline script had to be byte-identical to the script before CH-21a, and the script could not contain `zd-`; both clauses are dropped because CH-21c rewrites the automations part of the script.)

#### Scenario: Requesting the console page

- **GIVEN** the application is running
- **WHEN** a request for the console page is made
- **THEN** the response SHALL be a page containing a SQL input control
- **AND** the page SHALL provide a way to trigger execution of the entered statement

#### Scenario: Page links the shared stylesheet

- **GIVEN** the application is running
- **WHEN** the console page is requested
- **THEN** it SHALL contain a `<link rel="stylesheet" href="/ui/styles.css">`
- **AND** it SHALL NOT contain the former inline full-console `<style>` rules

#### Scenario: Script hazards stay out of the page

- **GIVEN** the served console page after this change
- **WHEN** the page and its script are scanned
- **THEN** the page SHALL contain exactly one closing script tag and no backtick
- **AND** neither page nor script SHALL contain `innerHTML`

#### Scenario: Script may reference the shared classes

- **GIVEN** the script builds picker cards and the preview
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

The console SHALL provide a control to save the currently entered SQL statement as a saved query, prompting for at least a `nombre` (and optionally a `descripcion`), and SHALL submit it to the saved-queries create endpoint.

#### Scenario: Saving the statement currently in the editor

- GIVEN the console page is loaded and a SQL statement is entered in the editor
- WHEN the save control is used and a `nombre` is supplied
- THEN the console SHALL submit a create request with the entered `sql` and `nombre`
- AND on success the console SHALL confirm the statement was saved

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

The console SHALL display the active tenant's list of `Automatizacion` rows and SHALL provide a way to create one, submitting to the tenant-scoped create route. Creation SHALL be a two-step wizard revealed by a "Nueva automatización" control, with a stepper showing the current step. Step 1 SHALL present a connection dropdown, filled from `GET /conexiones` when the wizard opens, above a template picker of cards. Step 2 SHALL present the template's parameters, the schedule presets, one optional recipient email input submitted as `destinatario`, a read-only email preview, a Volver control and a "Crear automatización" control. The create request body MUST keep its existing keys (`plantillaId`, `conexionId`, `valores`, `cron`, optional `destinatario`). On a 201 the console SHALL show a success banner stating the first scheduled run and the time zone from the response, and reload the list. A rejected value SHALL be shown as a legible error naming that field in the banner, without a raw error object or stack trace.
(Previously: one flat form with a template select, a free-text connection UUID, a raw cron field and an optional recipient; the banner only confirmed creation.)

#### Scenario: Viewing the automations list

- **GIVEN** at least one automation exists for the active tenant
- **WHEN** the console's automations view is loaded
- **THEN** each automation SHALL be shown with at least its plantilla, connection, schedule, and `activo` state

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
- **THEN** the console SHALL display a legible message naming the recipient field in the banner
- **AND** SHALL NOT display a raw error object or stack trace

#### Scenario: Wizard opens on step 1

- **GIVEN** the automations view is loaded and the wizard is hidden
- **WHEN** "Nueva automatización" is used
- **THEN** the wizard SHALL show step 1 with the stepper marking step 1 as current
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

#### Scenario: Server 400 shown in the banner

- **GIVEN** the create request returns `400` for an invalid schedule or a parameter problem
- **WHEN** the response is received
- **THEN** the banner SHALL show a legible message naming the offending field
- **AND** the wizard SHALL remain on step 2 with its values kept

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

The console SHALL provide a control to deactivate a listed automation, with no control to edit or delete one.

#### Scenario: Deactivating from the console

- GIVEN an active automation is listed
- WHEN the deactivate control is used
- THEN the console SHALL submit the deactivate action
- AND the list SHALL reflect its `activo: false` state

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

The automations and runs views SHALL forward the currently selected active tenant explicitly on every call, per the existing active-tenant indicator and forwarding requirements. The wizard's calls (`GET /conexiones`, template detail, validation-mapping reads, create) MUST carry the tenant header. WHEN the active tenant changes, the console SHALL discard all wizard state (step, connection, chosen template, parameter values, schedule, recipient, validation results, preview) and SHALL ignore any response that started before the switch. The tenant load SHALL still issue exactly three requests (saved queries, templates, automations).
(Previously: only required forwarding the tenant and refreshing the automations view; no wizard state existed.)

#### Scenario: Switching tenant updates the automations view

- **GIVEN** the automations view is showing tenant A's automations
- **WHEN** the tenant selector switches to tenant B
- **THEN** the view SHALL refresh to show only B's automations

#### Scenario: Tenant switch wipes the wizard

- **GIVEN** the wizard is on step 2 for tenant A with a template, a connection, values and a recipient
- **WHEN** the tenant selector switches to tenant B
- **THEN** the wizard SHALL be hidden and every wizard field SHALL be empty
- **AND** no connection or template of A SHALL remain selectable

#### Scenario: Late response after a tenant switch is ignored

- **GIVEN** a `GET /conexiones`, template-detail or validation request was issued for tenant A
- **WHEN** its response arrives after the switch to tenant B
- **THEN** the console SHALL NOT use it to change the wizard or the dropdown

#### Scenario: Tenant load keeps three requests

- **GIVEN** a tenant is selected
- **WHEN** the tenant load runs
- **THEN** exactly three requests SHALL be issued and none to `GET /conexiones`
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
After a saved query is loaded into the editor, the console SHALL offer "Guardar como nueva versión" with an optional note field. It SHALL send `PUT /consultas-guardadas/<id>` with the editor's name, description, statement, declared parameters and the note, exactly as the create sends them, and then refresh the list. A `409 sin-cambios` SHALL read "No hay cambios respecto de la versión vigente" and a `409 conflicto-de-edicion` SHALL ask to reload the query. The section's help text SHALL no longer say that a saved query cannot be edited, and SHALL still say it cannot be deleted.

#### Scenario: Save a change
- **GIVEN** a saved query loaded in the editor and its statement modified
- **WHEN** the operator saves it as a new version with the note "Agrega filtro"
- **THEN** one PUT request is sent for that query's id with the editor's content and the note, and the list is refreshed

#### Scenario: Nothing loaded
- **WHEN** no saved query has been loaded
- **THEN** the save-as-version action is not offered

#### Scenario: Switching tenant forgets the loaded query
- **WHEN** the operator switches tenant
- **THEN** the loaded query is forgotten and the action disappears
