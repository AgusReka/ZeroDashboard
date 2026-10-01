# Delta for Query Console

## MODIFIED Requirements

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
