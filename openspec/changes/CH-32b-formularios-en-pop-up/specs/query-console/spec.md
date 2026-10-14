# Query Console Specification (CH-32b delta)

## Purpose
Every create form of the console opens in a pop-up (DEC-173): «Nuevo tenant», «Nueva conexión», «Nuevo usuario» and the automation wizard join the query pop-up of CH-32a. A tenant can be chosen as it is created, «Reponer clave» is confirmed before it closes a user's sessions, and the automations list shows the connection's name and the schedule in words.

## MODIFIED Requirements

### Requirement: Create and Edit Forms Open in a Pop-up (DEC-173)
In the console, every form that creates or modifies a record SHALL open in a pop-up over the screen (`.zd-dialog` on `.zd-dialog-backdrop`), holding every field of the record, with a title, the main action (verb + object) and «Cancelar» at its foot. This covers the query pop-up, «Nuevo tenant», «Nueva conexión», «Nuevo usuario» and the automation wizard. Each pop-up SHALL be opened from its screen's page header, and on opening the focus SHALL go to its first field. «Cancelar» and the Escape key SHALL close it without sending anything; when there are unsaved changes they SHALL first ask «Descartar cambios», offering «Descartar cambios» and «Seguir editando». A switch of the active tenant SHALL close any open pop-up without asking. Such a form SHALL NOT be rendered inline above or below a table, nor in a side panel. Read-only detail (version history, template detail) stays in the side panel; inline confirmations of destructive actions are outside this rule.
(Previously: applied to the query pop-up only; «Nuevo tenant» and «Nuevo usuario» were inline forms, «Nueva conexión» a side panel and the automation wizard an inline card.)

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

### Requirement: Tenants Screen
The Tenants screen SHALL list every tenant, active and deactivated, with its name, a short id, its state ("Activo" or "Dado de baja") and its creation date, written as text. «Nuevo tenant» SHALL open a pop-up with the name and two actions, «Crear tenant» and «Crear y elegir», plus «Cancelar». Both SHALL send the typed name to `POST /tenants` and, on 201, close the pop-up and reload the list and the tenant selector; «Crear y elegir» SHALL then make the new tenant the console's active tenant, exactly as "Elegir como activo" does. An empty name SHALL be refused inside the pop-up with nothing sent. An active tenant SHALL offer "Elegir como activo", which makes it the console's active tenant, and "Dar de baja", which asks for an inline confirmation «Dar de baja {nombre}» before `POST /tenants/:id/baja`. A deactivated tenant SHALL offer no action and SHALL NOT be selectable (DEC-168). When the active tenant is deactivated, the console SHALL return to "ningún tenant" and say so.
(Previously: "Nuevo tenant" was an inline form above the list and never chose the tenant it created.)

#### Scenario: Create a tenant
- **WHEN** the operator creates "Almacén Don Tito" with «Crear tenant»
- **THEN** the list and the selector show it, and the active tenant does not change

#### Scenario: Create and choose a tenant
- **GIVEN** tenant A is active
- **WHEN** the operator creates "Almacén Don Tito" with «Crear y elegir»
- **THEN** the list and the selector show it, and it becomes the active tenant

#### Scenario: Deactivate the active tenant
- **GIVEN** tenant A is active
- **WHEN** the operator confirms «Dar de baja A»
- **THEN** A is listed as "Dado de baja" with no action, the selector no longer offers it, and the bar shows no tenant

#### Scenario: Cancel the confirmation
- **WHEN** the operator presses "Dar de baja" and then cancels
- **THEN** no request is sent

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
