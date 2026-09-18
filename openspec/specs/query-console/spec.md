# Query Console Specification

## Purpose

The minimal P1 web console (DEC-07): the first visual surface of the project, letting an implementer write a query, trigger its execution against a registered connection, and see a paginated result or a legible error — without exposing raw driver errors, stack traces, or credential values.

## Requirements

### Requirement: Console Page Is Servable

The system SHALL serve a console page, reachable by a request, that presents a SQL input control and a way to trigger execution of the entered statement against a registered connection. The exact markup and client-side structure are a design-level concern; this requirement covers only that the page exists and is servable.

#### Scenario: Requesting the console page

- **GIVEN** the application is running
- **WHEN** a request for the console page is made
- **THEN** the response SHALL be a page containing a SQL input control
- **AND** the page SHALL provide a way to trigger execution of the entered statement

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

The console SHALL display, at all times and without ambiguity, which tenant it is currently operating against.

#### Scenario: Indicator is always visible

- GIVEN the console page is loaded with an active tenant selected
- WHEN any part of the console is viewed
- THEN the active tenant SHALL be identifiable on screen without further action

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

WHEN an execution response reports the row-cap cutoff verdict (per `query-execution`), the console SHALL display a legible message stating that the result was capped at the configured row limit, and this message SHALL be visually and textually distinguishable from the "load more" control the console shows when `hayMas` indicates further pages are available.

#### Scenario: Viewing a capped result

- **GIVEN** the console page is loaded and a statement is submitted whose execution is stopped by the row cap
- **WHEN** the response is received by the console
- **THEN** the console SHALL display a legible message stating the result was capped at the configured limit
- **AND** the console SHALL NOT present a "load more" control for that response

#### Scenario: A capped result is not mistaken for a partial page

- **GIVEN** the console page is loaded and a statement's execution returns the row-cap cutoff verdict
- **WHEN** the result is rendered
- **THEN** the cutoff message SHALL be distinguishable on screen from the ordinary pagination control used for `hayMas`
