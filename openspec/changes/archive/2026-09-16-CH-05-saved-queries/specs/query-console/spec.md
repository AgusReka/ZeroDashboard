# Delta for Query Console

## ADDED Requirements

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
