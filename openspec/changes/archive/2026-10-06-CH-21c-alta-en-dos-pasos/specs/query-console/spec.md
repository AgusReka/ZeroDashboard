# Delta for Query Console

## MODIFIED Requirements

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

## ADDED Requirements

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

## Open points for design

- Wizard ids, and whether `auto-plantilla` is reused as the picker container or retired.
- `GET /conexiones` row cap and ordering (as seen by the dropdown).
- Exact behaviour on validation failure or no connections beyond the notices required above (for example, whether the dropdown is disabled).
- Whether Siguiente requires a chosen template and connection, or only blocks creation.
- The hour control (`type="time"` or selects) and its validation strings.
- Sample name used by the preview subject (the count is the `(n)` placeholder).
