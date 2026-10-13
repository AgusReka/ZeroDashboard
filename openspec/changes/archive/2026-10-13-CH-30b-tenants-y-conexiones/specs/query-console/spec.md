# Query Console Specification (CH-30b delta)

## Purpose
The console gains the Tenants and Conexiones screens (T1, A1), in the navigation order of DEC-165.

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order, a "Global" group with `#tenants`, a "Puesta en marcha" group with `#conexiones`, and a "Trabajo diario" group with `#consultas`, `#automatizaciones` and `#frescura`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: only the three "Trabajo diario" screens.)

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#tenants`
- **THEN** only Tenants is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

## ADDED Requirements

### Requirement: Tenants Screen
The Tenants screen SHALL list every tenant, active and deactivated, with its name, a short id, its state ("Activo" or "Dado de baja") and its creation date, written as text. "Nuevo tenant" SHALL send the typed name to `POST /tenants` and, on 201, reload the list and the tenant selector. An active tenant SHALL offer "Elegir como activo", which makes it the console's active tenant, and "Dar de baja", which asks for an inline confirmation «Dar de baja {nombre}» before `POST /tenants/:id/baja`. A deactivated tenant SHALL offer no action and SHALL NOT be selectable (DEC-168). When the active tenant is deactivated, the console SHALL return to "ningún tenant" and say so.

#### Scenario: Create a tenant
- **WHEN** the operator creates "Almacén Don Tito"
- **THEN** the list and the selector show it

#### Scenario: Deactivate the active tenant
- **GIVEN** tenant A is active
- **WHEN** the operator confirms «Dar de baja A»
- **THEN** A is listed as "Dado de baja" with no action, the selector no longer offers it, and the bar shows no tenant

#### Scenario: Cancel the confirmation
- **WHEN** the operator presses "Dar de baja" and then cancels
- **THEN** no request is sent

### Requirement: Connections Screen
The Conexiones screen SHALL list the active tenant's connections with name, engine, host and port, database and user, written as text; with no tenant it SHALL say to choose one. "Nueva conexión" SHALL open a side panel with name, host, port, database, user and password; "Guardar y probar" SHALL send `POST /conexiones` with engine `postgres`, then, on 201, `POST /conexiones/:id/prueba`, show the test result in the panel and reload the list. The password field SHALL be emptied after sending, and no password SHALL ever be written to the page. Each listed connection SHALL offer "Probar", whose result appears next to it: "OK" with the duration, or the failure's category and code.

#### Scenario: Register and test
- **WHEN** the operator fills the panel and presses "Guardar y probar"
- **THEN** the connection is created, tested, the result is shown in the panel, the password field is empty and the list shows the new connection

#### Scenario: A failed test
- **WHEN** "Probar" answers `fallo` with category `credenciales-invalidas`
- **THEN** the row shows the failure with that category, and no password appears anywhere in the page
