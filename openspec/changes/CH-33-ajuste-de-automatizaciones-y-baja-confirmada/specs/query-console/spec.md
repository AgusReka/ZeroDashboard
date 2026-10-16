# Query Console Specification (CH-33 delta)

## Purpose
The operator adjusts an active automation from the console in a pop-up, keeping its id and its runs (DEC-174), and confirms a tenant's baja by typing the tenant's name (DEC-175).

## ADDED Requirements

### Requirement: Console Adjusts an Automation in Place (DEC-174)

Each active automation in the list SHALL offer «Ajustar», next to «Desactivar»; a deactivated one SHALL NOT. «Ajustar» SHALL read `GET /automatizaciones/:id` and open a pop-up (DEC-173) titled «Ajustar automatización», showing the template's and the connection's names as read-only text, and prefilled with the stored values: one control per parameter the template currently declares, the schedule (a preset cron opens on its preset and hour; any other on «Personalizado» with the cron as stored) and the recipient. «Guardar ajustes» SHALL send `PUT /automatizaciones/:id/ajustes` with only the fields that changed: `valores` as the whole map of every declared parameter when any of them changed, `cron` when the schedule changed, and `destinatario` when the recipient changed, as `null` when it was emptied. With nothing changed, «Guardar ajustes» SHALL send nothing and say so inside the pop-up. On a `200` the pop-up SHALL close, the page notice SHALL state the next scheduled run and the zone, and the list SHALL reload. A `400` SHALL be shown inside the pop-up naming the offending field, and a `404` or `409` as a legible message inside it; the pop-up SHALL stay open with the typed values. A failed read SHALL open nothing and show a legible notice. The body SHALL NOT carry `plantillaId`, `conexionId`, `activo` or a tenant identifier.

#### Scenario: Adjust opens prefilled

- GIVEN an active automation on connection "food-store", template "Stock físico", cron `0 6 * * 1-5`, `valores` `{ "umbral": 5 }` and recipient `a@empresa.com`
- WHEN «Ajustar» is used on its row
- THEN one `GET /automatizaciones/:id` SHALL be sent with the active tenant
- AND the pop-up SHALL show "Stock físico" and "food-store" as text, `umbral` 5, «De lunes a viernes» at 06:00, and `a@empresa.com`

#### Scenario: Only the changed fields are sent

- GIVEN the adjust pop-up is open as above
- WHEN only the hour is changed to 07:30 and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be exactly `{ "cron": "30 7 * * 1-5" }`
- AND on `200` the pop-up SHALL close, the notice SHALL state the next run and the zone, and the list SHALL reload

#### Scenario: Emptying the recipient clears it

- GIVEN the adjust pop-up is open with a recipient
- WHEN the recipient field is emptied and «Guardar ajustes» is used
- THEN the `PUT` body SHALL be `{ "destinatario": null }`

#### Scenario: A custom cron opens on Personalizado

- GIVEN an active automation with cron `*/30 8-18 * * *`
- WHEN «Ajustar» is used
- THEN the frequency SHALL be «Personalizado» and the cron field SHALL hold `*/30 8-18 * * *`, editable

#### Scenario: A refusal stays inside the pop-up

- GIVEN the adjust is answered `400` naming `destinatario`, or `409 automatizacion-desactivada`
- WHEN the console handles it
- THEN a legible message SHALL be shown inside the pop-up, which stays open with the typed values

#### Scenario: Deactivated automations offer no adjust

- GIVEN a deactivated automation is listed
- THEN its row SHALL offer «Ver ejecuciones» only

## MODIFIED Requirements

### Requirement: Console Supports Deactivating an Automation (DEC-79)

The console SHALL provide a control to deactivate a listed active automation, and SHALL NOT provide a control to delete or reactivate one. Editing is «Ajustar» (DEC-174).
(Previously: the console offered no control to edit an automation.)

#### Scenario: Deactivating from the console

- GIVEN an active automation is listed
- WHEN the deactivate control is used
- THEN the console SHALL submit the deactivate action
- AND the list SHALL reflect its `activo: false` state

### Requirement: Tenants Screen
The Tenants screen SHALL list every tenant, active and deactivated, with its name, a short id, its state ("Activo" or "Dado de baja") and its creation date, written as text. «Nuevo tenant» SHALL open a pop-up with the name and two actions, «Crear tenant» and «Crear y elegir», plus «Cancelar». Both SHALL send the typed name to `POST /tenants` and, on 201, close the pop-up and reload the list and the tenant selector; «Crear y elegir» SHALL then make the new tenant the console's active tenant, exactly as "Elegir como activo" does. An empty name SHALL be refused inside the pop-up with nothing sent. An active tenant SHALL offer "Elegir como activo", which makes it the console's active tenant, and "Dar de baja", which opens a confirmation pop-up (DEC-175). The pop-up SHALL name the tenant, say that the baja cannot be undone, and hold one text field; its action «Dar de baja {nombre}» SHALL stay disabled until the field is exactly the tenant's name, and SHALL then send `POST /tenants/:id/baja` with `{ "nombre": <the typed text> }`. «Cancelar» and Escape SHALL close it without sending anything and without asking. A refusal SHALL be shown inside the pop-up. A deactivated tenant SHALL offer no action and SHALL NOT be selectable (DEC-168). When the active tenant is deactivated, the console SHALL return to "ningún tenant" and say so.
(Previously: "Dar de baja" asked for an inline confirmation «Dar de baja {nombre}» in the row and sent the baja with no body.)

#### Scenario: Create a tenant
- **WHEN** the operator creates "Almacén Don Tito" with «Crear tenant»
- **THEN** the list and the selector show it, and the active tenant does not change

#### Scenario: Create and choose a tenant
- **GIVEN** tenant A is active
- **WHEN** the operator creates "Almacén Don Tito" with «Crear y elegir»
- **THEN** the list and the selector show it, and it becomes the active tenant

#### Scenario: The baja waits for the exact name
- **GIVEN** the baja pop-up of "Almacén Don Tito" is open
- **WHEN** the operator types "almacén don tito"
- **THEN** «Dar de baja Almacén Don Tito» stays disabled
- **WHEN** the operator types "Almacén Don Tito"
- **THEN** it becomes enabled

#### Scenario: Deactivate the active tenant
- **GIVEN** tenant A is active
- **WHEN** the operator types "A" in its baja pop-up and confirms «Dar de baja A»
- **THEN** the request body is `{ "nombre": "A" }`
- **AND** A is listed as "Dado de baja" with no action, the selector no longer offers it, and the bar shows no tenant

#### Scenario: Cancel the confirmation
- **WHEN** the operator opens the baja pop-up, types part of the name and presses «Cancelar» or Escape
- **THEN** the pop-up closes without asking and no request is sent

### Requirement: Create and Edit Forms Open in a Pop-up (DEC-173)
In the console, every form that creates or modifies a record SHALL open in a pop-up over the screen (`.zd-dialog` on `.zd-dialog-backdrop`), holding every field of the record, with a title, the main action (verb + object) and «Cancelar» at its foot. This covers the query pop-up, «Nuevo tenant», «Nueva conexión», «Nuevo usuario», the automation wizard and the automation adjust. A create pop-up SHALL be opened from its screen's page header; an edit pop-up from its record's row. On opening, the focus SHALL go to its first field. «Cancelar» and the Escape key SHALL close it without sending anything; when there are unsaved changes they SHALL first ask «Descartar cambios», offering «Descartar cambios» and «Seguir editando». A switch of the active tenant SHALL close any open pop-up without asking. Such a form SHALL NOT be rendered inline above or below a table, nor in a side panel. Read-only detail (version history, template detail) stays in the side panel. Inline confirmations of destructive actions are outside this rule, except a tenant's baja, which is confirmed in its own pop-up by typing the name (DEC-175).
(Previously: did not cover the automation adjust nor the tenant baja confirmation, and every pop-up opened from the page header.)

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
