# Query Console Specification (CH-41 delta)

## Purpose
The operator types several recipients in one field, when creating an automation and when adjusting it in place; the script splits them into the list the routes take (N6, DEC-187, DEC-194 1(a)).

## MODIFIED Requirements

### Requirement: Console Displays Automations and Supports Creating One (DEC-78)

The console SHALL display the active tenant's list of `Automatizacion` rows and SHALL provide a way to create one, submitting to the tenant-scoped create route. Creation SHALL be a two-step wizard in a wide pop-up (DEC-173) opened by «Nueva automatización» in the screen's page header, with a stepper showing the current step. Step 1 SHALL present a connection dropdown, filled from `GET /conexiones` when the wizard opens, above a template picker of cards. Step 2 SHALL present the template's parameters, the schedule presets, one optional recipients field, «Correos de los destinatarios (opcional)», where addresses are separated by commas, semicolons, spaces or line breaks and which is submitted as the `destinatarios` list of its non-empty pieces, one number input «Mínimo de filas para avisar» holding 1 by default and submitted as `minimoFilas`, a read-only email preview whose «Para» lists the typed addresses and that states the minimum the email needs, a Volver control and a "Crear automatización" control. «Cancelar» and Escape SHALL behave as in every create pop-up. The create request body MUST carry `plantillaId`, `conexionId`, `valores`, `cron` and `minimoFilas`, and `destinatarios` when at least one address was typed. The console SHALL NOT judge an address: the server's rule decides, and a `400` naming `/destinatarios/<i>` SHALL be told naming the address typed at that position. On a 201 the console SHALL close the pop-up, show a success banner stating the first scheduled run and the time zone from the response, and reload the list. A rejected value SHALL be shown inside the pop-up as a legible error naming that field, without a raw error object or stack trace, and the pop-up SHALL stay open.
In the list, the connection SHALL be shown by its name, from `GET /conexiones` loaded with the list, or by its short id when it is not among the tenant's connections. The schedule SHALL be shown in words followed by the cron expression in monospace when it matches one of the DEC-129 presets (for example «Todos los días a las 06:00» and `0 6 * * *`), and as the cron expression alone otherwise.
(Previously: one recipient input submitted as `destinatario`.)

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

#### Scenario: Creating with several recipients

- **GIVEN** the wizard is on step 2
- **WHEN** «ops@empresa.com, dueña@empresa.com;
ventas@empresa.com» is typed in the recipients field and the form is submitted
- **THEN** the create request SHALL carry `"destinatarios": ["ops@empresa.com", "dueña@empresa.com", "ventas@empresa.com"]`
- **AND** the preview «Para» SHALL list the three addresses

#### Scenario: Creating without recipients

- **GIVEN** the wizard is on step 2 with the recipients field blank or holding only separators
- **WHEN** the form is submitted
- **THEN** the create request SHALL carry no `destinatarios` key

#### Scenario: Creating with a minimum

- **GIVEN** the wizard is on step 2
- **WHEN** the minimum is set to 5 and the form is submitted
- **THEN** the create request SHALL carry `"minimoFilas": 5` as a number
- **AND** the email preview SHALL state that the email is sent with 5 rows or more

#### Scenario: Default minimum

- **GIVEN** the wizard is on step 2 and the minimum is left at 1
- **WHEN** the form is submitted
- **THEN** the create request SHALL carry `"minimoFilas": 1`

#### Scenario: Invalid recipient shown legibly

- **GIVEN** the create form is submitted with «ops@empresa.com, no-es-un-correo»
- **WHEN** the `400` response naming `/destinatarios/1` is received
- **THEN** the console SHALL display a legible message inside the pop-up naming «no-es-un-correo» as the address that is not valid
- **AND** SHALL NOT display a raw error object or stack trace

#### Scenario: Invalid minimum shown legibly

- **GIVEN** the create request returns `400` naming `/minimoFilas`
- **WHEN** the response is received
- **THEN** the pop-up SHALL show a legible message naming the minimum field and saying it is a whole number from 1 up to the row cap
- **AND** the pop-up SHALL stay open on step 2 with its values kept

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

#### Scenario: POST body keys

- **GIVEN** a completed wizard
- **WHEN** Crear automatización is used
- **THEN** the POST body keys SHALL be a subset of `plantillaId`, `conexionId`, `valores`, `cron`, `destinatarios`, `minimoFilas`
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

### Requirement: Console Adjusts an Automation in Place (DEC-174)

Each active automation in the list SHALL offer «Ajustar», next to «Desactivar»; a deactivated one SHALL NOT. «Ajustar» SHALL read `GET /automatizaciones/:id` and open a pop-up (DEC-173) titled «Ajustar automatización», showing the template's and the connection's names as read-only text, and prefilled with the stored values: one control per parameter the template currently declares, the schedule (a preset cron opens on its preset and hour; any other on «Personalizado» with the cron as stored), the recipients joined by «, », and the minimum rows. «Guardar ajustes» SHALL send `PUT /automatizaciones/:id/ajustes` with only the fields that changed: `valores` as the whole map of every declared parameter when any of them changed, `cron` when the schedule changed, `destinatarios` as the split list when the recipients field changed, as `[]` when it was emptied, and `minimoFilas` as a number when the minimum changed. With nothing changed, «Guardar ajustes» SHALL send nothing and say so inside the pop-up. On a `200` the pop-up SHALL close, the page notice SHALL state the next scheduled run and the zone, and the list SHALL reload. A `400` SHALL be shown inside the pop-up naming the offending field, and a `404` or `409` as a legible message inside it; the pop-up SHALL stay open with the typed values. A failed read SHALL open nothing and show a legible notice. The body SHALL NOT carry `plantillaId`, `conexionId`, `activo` or a tenant identifier.
(Previously: one `destinatario`, sent as `null` when it was emptied.)

#### Scenario: Adjust opens prefilled

- GIVEN an active automation on connection "food-store", template "Stock físico", cron `0 6 * * 1-5`, `valores` `{ "umbral": 5 }`, `destinatarios` `["a@empresa.com", "b@empresa.com"]` and `minimoFilas` 3
- WHEN «Ajustar» is used on its row
- THEN one `GET /automatizaciones/:id` SHALL be sent with the active tenant
- AND the pop-up SHALL show "Stock físico" and "food-store" as text, `umbral` 5, «De lunes a viernes» at 06:00, «a@empresa.com, b@empresa.com», and a minimum of 3

#### Scenario: Only the changed fields are sent

- GIVEN the adjust pop-up is open as above
- WHEN only the hour is changed to 07:30 and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be exactly `{ "cron": "30 7 * * 1-5" }`
- AND on `200` the pop-up SHALL close, the notice SHALL state the next run and the zone, and the list SHALL reload

#### Scenario: Changing only the minimum

- GIVEN the adjust pop-up is open as above
- WHEN only the minimum is changed to 10 and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be exactly `{ "minimoFilas": 10 }`

#### Scenario: Emptying the recipients clears them

- GIVEN the adjust pop-up is open with recipients
- WHEN the recipients field is emptied and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be `{ "destinatarios": [] }`

#### Scenario: Only a changed list is sent

- GIVEN the adjust pop-up is open with «a@empresa.com, b@empresa.com»
- WHEN the field is rewritten as «a@empresa.com;b@empresa.com» and «Guardar ajustes» is used
- THEN nothing SHALL be sent, because the list did not change
- WHEN «c@empresa.com» is added and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be `{ "destinatarios": ["a@empresa.com", "b@empresa.com", "c@empresa.com"] }`

#### Scenario: A custom cron opens on Personalizado

- GIVEN an active automation with cron `*/30 8-18 * * *`
- WHEN «Ajustar» is used
- THEN the frequency SHALL be «Personalizado» and the cron field SHALL hold `*/30 8-18 * * *`, editable

#### Scenario: A refusal stays inside the pop-up

- GIVEN the adjust is answered `400` naming `/destinatarios/1`, `/destinatarios` or `/minimoFilas`, or `409 automatizacion-desactivada`
- WHEN the console handles it
- THEN a legible message SHALL be shown inside the pop-up, which stays open with the typed values

#### Scenario: Deactivated automations offer no adjust

- GIVEN a deactivated automation is listed
- THEN its row SHALL offer «Ver ejecuciones» only
