# Delta for Query Console

## MODIFIED Requirements

### Requirement: Console Displays Automations and Supports Creating One (DEC-78)

The console SHALL display the active tenant's list of `Automatizacion` rows and SHALL provide a way to create one, submitting to the tenant-scoped create route. The create form SHALL include an optional recipient email input, submitted as `destinatario`, and a rejected value SHALL be shown as a legible error naming that field.
(Previously: the create form had no recipient input.)

#### Scenario: Viewing the automations list

- GIVEN at least one automation exists for the active tenant
- WHEN the console's automations view is loaded
- THEN each automation SHALL be shown with at least its plantilla, connection, schedule, and `activo` state

#### Scenario: Creating an automation from the console

- GIVEN the automations view is loaded
- WHEN the create control is used with a plantilla, connection, parameter values, and a schedule
- THEN the console SHALL submit a create request scoped to the active tenant
- AND on success the new automation SHALL appear in the list

#### Scenario: Creating with a recipient

- GIVEN the create form is open
- WHEN a recipient is entered and the form is submitted
- THEN the create request SHALL carry it as `destinatario`

#### Scenario: Invalid recipient shown legibly

- GIVEN the create form is submitted with an invalid recipient
- WHEN the `400` response is received
- THEN the console SHALL display a legible message naming the recipient field
- AND SHALL NOT display a raw error object or stack trace

### Requirement: Console Displays an Automation's Runs (DEC-80)

The console SHALL provide a way to view a selected automation's `Ejecucion` rows, showing at least start, end, duration, row count, status, notification outcome (`notificacion`), and error when present. A null `notificacion` SHALL render as a visible placeholder, never as the text `null`.
(Previously: did not show a notification outcome.)

#### Scenario: Viewing an automation's runs

- GIVEN an automation with at least one recorded run
- WHEN its runs view is opened
- THEN each run SHALL be shown with start, end, duration, row count, status, and notification outcome
- AND a failed run SHALL show its classified error

#### Scenario: Notification outcomes are legible

- GIVEN runs with `notificacion` values `enviada`, `omitida-sin-filas`, and null
- WHEN the runs view is opened
- THEN each run SHALL show a legible label for its outcome and the null run SHALL show a placeholder

#### Scenario: Send failure visible as failure

- GIVEN a run with `estado='fallo'` and `fase='notificacion'`
- WHEN the runs view is opened
- THEN the run SHALL show its failed status and its `notificacion` outcome `fallo-envio`
