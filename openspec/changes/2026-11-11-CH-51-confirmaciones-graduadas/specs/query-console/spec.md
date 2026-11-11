# Query Console Specification (CH-51 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-51. The specs `automation-scheduling`, `agent-registration`, `panel-user-management` and `saved-queries` specify the API, which does not change. Levels C0–C3 and T4 refer to `.claude/skills/zerodashboard-design/guidelines/admin.md` §8 and §6.

## ADDED Requirements

### Requirement: Graded Confirmation Pop-up (C0–C3)
The console SHALL confirm destructive or impactful actions in one confirmation pop-up (`confirmacion-dialogo`), never inline in a row or panel.

The pop-up SHALL hold:
- a title that asks the action over the named object ("¿{Acción} {objeto}?");
- one line with the consequence;
- an optional short list of further consequences;
- «Cancelar» on the left;
- one action button on the right, whose text repeats the verb and the object. It is never "Sí" or "Aceptar".

Two levels SHALL be used:
- **C1** (reversible with impact): primary action button. The focus starts on it.
- **C2** (irreversible): the line "No se puede deshacer." is included, and the action button is danger. The focus starts on «Cancelar».

«Cancelar» and Escape SHALL close the pop-up without sending anything. Actions that are reversible and harmless (test, execute, duplicate, preview: C0) SHALL NOT ask. A tenant's baja keeps its own pop-up with the typed name (C3, DEC-175), with a danger action button and the focus starting on «Cancelar».

#### Scenario: Cancel sends nothing
- **GIVEN** the confirmation pop-up is open for any action
- **WHEN** the operator presses «Cancelar» or Escape
- **THEN** the pop-up closes and no request is sent

#### Scenario: Irreversible starts safe
- **WHEN** a C2 confirmation opens
- **THEN** it says "No se puede deshacer.", its action button is the danger variant, and the focus is on «Cancelar»

### Requirement: Destructive Row Actions Look Destructive (T4)
Every row action that deactivates, revokes or gives a baja SHALL be the last control of its row and SHALL carry `data-tono="error"`, which the console's bridge style renders in the error tone with an icon. Harmless row actions SHALL NOT carry it.

#### Scenario: Automation row
- **WHEN** the automations list renders an active automation
- **THEN** «Desactivar» is the last button of the row and carries `data-tono="error"`, and «Ver ejecuciones», «Vista previa» and «Ajustar» do not

### Requirement: Pop-ups Keep and Return the Focus
While any console pop-up is open, Tab and Shift+Tab SHALL move the focus only among its controls. When the pop-up closes, by its action, «Cancelar», Escape or a tenant switch, the focus SHALL return to the control that opened it, if that control is still in the document. Escape and the other closing rules of DEC-173 do not change.

#### Scenario: Focus returns to the opener
- **GIVEN** the operator opened «Nuevo usuario» from its button
- **WHEN** the pop-up is cancelled
- **THEN** the focus is on «Nuevo usuario»

#### Scenario: Tab stays inside
- **GIVEN** a pop-up is open and the focus is on its last control
- **WHEN** the operator presses Tab
- **THEN** the focus moves to its first control

## MODIFIED Requirements

### Requirement: Console Supports Deactivating an Automation (DEC-79)
The console SHALL provide a control to deactivate a listed active automation. It SHALL NOT provide a control to delete or reactivate one. Editing is «Ajustar» (DEC-174).

The deactivate control SHALL open a C2 confirmation:
- title "¿Desactivar {plantilla} · {conexión}?";
- the line "No se puede deshacer: una automatización desactivada no se reactiva.";
- the list item "Sus ejecuciones pasadas siguen disponibles.";
- the danger button «Desactivar automatización».

Only that button SHALL submit the deactivate action.
(Previously: the deactivate control submitted the action on the first click.)

#### Scenario: Deactivating from the console
- **GIVEN** an active automation is listed
- **WHEN** the deactivate control is used and «Desactivar automatización» is pressed
- **THEN** the console SHALL submit the deactivate action exactly once
- **AND** the list SHALL reflect its `activo: false` state

#### Scenario: Changing one's mind
- **GIVEN** the deactivate confirmation is open
- **WHEN** the operator presses «Cancelar»
- **THEN** no request is sent and the automation stays active

### Requirement: Agents Screen
The Agentes screen SHALL show the active tenant's agent, if any, with its state ("Activo" or "Revocado"), creation date and last token emission date. With no tenant it SHALL say to choose one.
- With no agent, it SHALL offer "Crear agente".
- With a revoked one, it SHALL offer "Emitir un token nuevo".
- Both send `POST /agentes` and show the token once.

An active agent SHALL offer "Revocar". It opens a C2 confirmation saying that the agent and its connections stop working until a new token is emitted, with the danger button «Revocar token». Only that button sends `POST /agentes/:id/revocar`.
(Previously: "Revocar" asked for an inline confirmation.)

#### Scenario: Create an agent
- **GIVEN** the tenant has no agent
- **WHEN** the operator presses "Crear agente"
- **THEN** the token is shown once and the agent is listed as active

#### Scenario: Revoke
- **WHEN** the operator presses "Revocar" and confirms «Revocar token»
- **THEN** the agent is listed as revoked and offers "Emitir un token nuevo"

### Requirement: Panel Users Screen
The Usuarios del panel screen SHALL list the active tenant's panel users with email, name, state ("Activo" or "Desactivado") and creation date. With no tenant it SHALL say to choose one.

**Creation:**
- «Nuevo usuario» SHALL open a pop-up with the email and the optional name.
- «Crear usuario» SHALL send them to `POST /usuarios` and, on 201, close the pop-up and show the generated password once in the screen's notice.
- A `409 correo-en-uso` SHALL say, inside the pop-up, that the email is already in use.

**Row actions:**
- Each active user SHALL offer «Reponer clave» and "Desactivar"; each deactivated user, "Reactivar" and «Reponer clave».
- «Reponer clave» SHALL open a C1 confirmation «¿Reponer la clave de {correo}?» saying that the current password stops working and the user's open sessions are closed. Only «Reponer clave» in it sends `POST /usuarios/:id/clave`, and the new password is then shown once.
- "Desactivar" SHALL open a C1 confirmation «¿Desactivar a {correo}?» saying the user cannot enter the panel until reactivated. Only «Desactivar usuario» in it sends the deactivation.

(Previously: «Reponer clave» and "Desactivar" asked for inline confirmations in the row.)

#### Scenario: Create a user
- **WHEN** the operator creates "ana@negocio.com"
- **THEN** the pop-up closes, the generated password is shown once and the user is listed as active

#### Scenario: Email in use
- **WHEN** the creation answers `409 correo-en-uso`
- **THEN** the pop-up stays open, says the email is already in use and shows no password

#### Scenario: Reset a password after confirming
- **WHEN** the operator presses «Reponer clave» on "ana@negocio.com"
- **THEN** nothing is sent and the confirmation pop-up asks «¿Reponer la clave de ana@negocio.com?»
- **AND** confirming sends `POST /usuarios/:id/clave` and shows the new password once

#### Scenario: Cancel the reset
- **WHEN** the operator presses «Reponer clave» and then «Cancelar»
- **THEN** no request is sent

### Requirement: Restore With Confirmation
"Restaurar" SHALL open a C1 confirmation:
- title «¿Restaurar la versión {n}?»;
- the line «Se crea la versión {n+1} con el contenido de la versión {n}. No se borra nada.»;
- the optional note field;
- the button «Restaurar versión {n}». It is never "Sí" or "Aceptar".

Confirming SHALL send `POST .../versiones/<n>/restaurar` with the optional note, refresh the versions panel and the saved-query list, and say that a new version was created.
(Previously: the confirmation was shown inside the versions panel.)

#### Scenario: Confirm
- **WHEN** the operator presses Restaurar on version 2 and confirms
- **THEN** exactly one restore request is sent for version 2 and the panel shows the new version as "Vigente"

#### Scenario: Cancel
- **WHEN** the operator cancels the confirmation
- **THEN** no request is sent

#### Scenario: Refusals
- **WHEN** the server answers 404, 409 `version-vigente` or any other error
- **THEN** the reason is shown in plain text and the panel keeps the previous rows
