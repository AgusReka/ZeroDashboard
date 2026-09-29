# Delta for Query Console

## ADDED Requirements

### Requirement: Console Displays Automations and Supports Creating One (DEC-78)

The console SHALL display the active tenant's list of `Automatizacion` rows and SHALL provide a way to create one, submitting to the tenant-scoped create route.

#### Scenario: Viewing the automations list

- GIVEN at least one automation exists for the active tenant
- WHEN the console's automations view is loaded
- THEN each automation SHALL be shown with at least its plantilla, connection, schedule, and `activo` state

#### Scenario: Creating an automation from the console

- GIVEN the automations view is loaded
- WHEN the create control is used with a plantilla, connection, parameter values, and a schedule
- THEN the console SHALL submit a create request scoped to the active tenant
- AND on success the new automation SHALL appear in the list

### Requirement: Console Supports Deactivating an Automation (DEC-79)

The console SHALL provide a control to deactivate a listed automation, with no control to edit or delete one.

#### Scenario: Deactivating from the console

- GIVEN an active automation is listed
- WHEN the deactivate control is used
- THEN the console SHALL submit the deactivate action
- AND the list SHALL reflect its `activo: false` state

### Requirement: Console Displays an Automation's Runs (DEC-80)

The console SHALL provide a way to view a selected automation's `Ejecucion` rows, showing at least start, end, duration, row count, status, and error when present.

#### Scenario: Viewing an automation's runs

- GIVEN an automation with at least one recorded run
- WHEN its runs view is opened
- THEN each run SHALL be shown with start, end, duration, row count, and status
- AND a failed run SHALL show its classified error

### Requirement: Automation Views Respect the Active-Tenant Indicator (T4, DEC-15)

The automations and runs views SHALL forward the currently selected active tenant explicitly on every call, per the existing active-tenant indicator and forwarding requirements.

#### Scenario: Switching tenant updates the automations view

- GIVEN the automations view is showing tenant A's automations
- WHEN the tenant selector switches to tenant B
- THEN the view SHALL refresh to show only B's automations
