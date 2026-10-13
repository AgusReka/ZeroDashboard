# Query Console Specification (CH-30c delta)

## Purpose
The console gains the Agentes and Usuarios del panel screens (C1, T3) and lets a connection go through the tenant's agent. Every secret is shown once.

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order, a "Global" group with `#tenants`, a "Puesta en marcha" group with `#conexiones`, `#agentes` and `#usuarios`, and a "Trabajo diario" group with `#consultas`, `#automatizaciones` and `#frescura`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: "Puesta en marcha" held only `#conexiones`.)

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#agentes`
- **THEN** only Agentes is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

## ADDED Requirements

### Requirement: Secrets Are Shown Once
An agent token or a generated panel password SHALL appear only in the notice of the action that produced it, with "Copiar" and "Ya lo guardé". The notice SHALL be emptied when the operator presses "Ya lo guardé", when the screen is left and when the active tenant changes; the secret SHALL NOT be written to any other node.

#### Scenario: Dismissing a secret
- **GIVEN** a token is shown
- **WHEN** the operator presses "Ya lo guardé"
- **THEN** no node of the page contains the token

#### Scenario: Leaving the screen
- **GIVEN** a password is shown
- **WHEN** the hash changes to another screen
- **THEN** no node of the page contains the password

### Requirement: Agents Screen
The Agentes screen SHALL show the active tenant's agent, if any, with its state ("Activo" or "Revocado"), creation date and last token emission date; with no tenant it SHALL say to choose one. With no agent it SHALL offer "Crear agente"; with a revoked one, "Emitir un token nuevo"; both send `POST /agentes` and show the token once. An active agent SHALL offer "Revocar", which asks for an inline confirmation saying the agent's connections stop working until a new token is emitted, before `POST /agentes/:id/revocar`.

#### Scenario: Create an agent
- **GIVEN** the tenant has no agent
- **WHEN** the operator presses "Crear agente"
- **THEN** the token is shown once and the agent is listed as active

#### Scenario: Revoke
- **WHEN** the operator presses "Revocar" and confirms
- **THEN** the agent is listed as revoked and offers "Emitir un token nuevo"

### Requirement: Connection Through the Agent
The new-connection panel SHALL offer how the connection reaches the replica: direct, or through the tenant's agent when it has an active one. Choosing the agent SHALL send its `agenteId` with the registration.

#### Scenario: Register through the agent
- **GIVEN** the tenant has an active agent
- **WHEN** the operator chooses it and saves
- **THEN** the registration carries that `agenteId`

### Requirement: Panel Users Screen
The Usuarios del panel screen SHALL list the active tenant's panel users with email, name, state ("Activo" or "Desactivado") and creation date; with no tenant it SHALL say to choose one. "Nuevo usuario" SHALL send the email and the optional name to `POST /usuarios` and show the generated password once. Each active user SHALL offer "Reponer clave" (the new password shown once) and "Desactivar" (inline confirmation); each deactivated user, "Reactivar" and "Reponer clave". A `409 correo-en-uso` SHALL say the email is already in use.

#### Scenario: Create a user
- **WHEN** the operator creates "ana@negocio.com"
- **THEN** the generated password is shown once and the user is listed as active

#### Scenario: Email in use
- **WHEN** the creation answers `409 correo-en-uso`
- **THEN** the screen says the email is already in use and shows no password
