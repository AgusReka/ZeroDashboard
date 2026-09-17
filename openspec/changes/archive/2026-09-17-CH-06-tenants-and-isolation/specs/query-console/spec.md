# Delta for Query Console

## ADDED Requirements

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
