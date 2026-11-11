# Query Console Specification (CH-55 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-55. `onboarding-timing-marks` specifies `GET /tiempos-alta`, which this change does not use. Pattern ids refer to `.claude/skills/zerodashboard-design/guidelines/admin.md` (G1–G5, N5, N6).

## ADDED Requirements

### Requirement: Setup Strip (G1)
Agentes, Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente SHALL show, under their page header, a setup strip for the active tenant.

**Stages.** The strip lists, in order:

| Stage | Done when | Read from |
|---|---|---|
| Conexión | at least one connection | `GET /conexiones` |
| Mapeo | at least one connection has every obligatory entity "Válida" | `GET /conexiones/:id/validacion-mapeo` |
| Usuarios del panel | at least one active panel user | `GET /usuarios` |
| Tablero | the dashboard holds at least one report | `GET /tablero` |
| Primera automatización | at least one active automation | `GET /automatizaciones` |

**Each stage** SHALL be shown as icon and text: «Hecho» or «Pendiente».

**The current screen's stage** SHALL be marked «estás acá». Agentes is not a stage, and its screen marks none.

**The next step.** The strip SHALL end with «Siguiente: {primera etapa pendiente}», linking to its screen, or with «Puesta en marcha completa» when every stage is done.

**The guide never blocks.** It SHALL NOT disable, hide or reorder any control or screen.

**Without a tenant**, the strip is hidden and the screens keep their existing empty state.

**Reads.**
- The strip's data SHALL be read once per tenant, and refreshed after a connection test, a validation, a user creation, a dashboard save, an automation creation, and a tenant change.
- It SHALL NOT use any endpoint other than the five above.

#### Scenario: Strip on the mapping screen
- **GIVEN** tenant A has one connection, no valid mapping and nothing else
- **WHEN** the hash becomes `#mapeo`
- **THEN** the strip shows Conexión «Hecho», Mapeo «Pendiente» with «estás acá», the other stages «Pendiente», and «Siguiente: Mapeo y validación»

#### Scenario: A mapping validated once but now invalid
- **GIVEN** the only connection's report has an obligatory entity "Inválida"
- **THEN** the Mapeo stage reads «Pendiente»

#### Scenario: Everything done
- **GIVEN** every stage is done
- **THEN** the strip says «Puesta en marcha completa»

#### Scenario: The guide does not block
- **GIVEN** no connection exists
- **WHEN** the operator opens Tablero del cliente
- **THEN** every control of that screen has the same enabled state it had before this change

### Requirement: Setup Marks in the Navigation (N6)
With an active tenant, the navigation items Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente SHALL each carry a mark, «Hecho» or «Pendiente», as icon and text, from the same data as the setup strip. Agentes SHALL carry none. The marks SHALL NOT change whether an item is usable (N5). Without a tenant the marks are hidden.

#### Scenario: Marks follow the data
- **GIVEN** tenant A has a connection and nothing else
- **THEN** Conexiones is marked «Hecho» and Mapeo y validación «Pendiente»

### Requirement: Next Step After Completing a Stage (G2)
When an action completes a stage that was pending, its success notice SHALL offer a link to the next pending stage:
- a successful connection test → «Siguiente: Mapeo y validación»;
- a validation that leaves the mapping valid → «Siguiente: Usuarios del panel»;
- the first active user created → «Siguiente: Tablero del cliente»;
- a dashboard saved with at least one report → «Siguiente: Automatizaciones».

When the next pending stage is a different one, the link SHALL name that one instead. The link after creating a tenant SHALL stay as it is.

#### Scenario: First user
- **GIVEN** the tenant has a valid mapping and no users
- **WHEN** the operator creates the first panel user
- **THEN** the success notice offers «Siguiente: Tablero del cliente»

### Requirement: One Connection Comes Preselected (G3)
In Mapeo y validación, Tablero del cliente (for a tenant with no dashboard yet) and step 1 of the automation wizard:
- when the active tenant has exactly one connection, it SHALL come selected;
- with two or more, none SHALL be preselected.

The Tablero screen SHALL keep starting on the dashboard's own connection when it has one.

#### Scenario: One connection
- **GIVEN** tenant A has only "food-store"
- **WHEN** the operator opens Mapeo y validación
- **THEN** "food-store" is selected and its report is requested

#### Scenario: Two connections
- **GIVEN** tenant A has "food-store" and "replica-b"
- **WHEN** the operator opens step 1 of the automation wizard
- **THEN** no connection is selected

### Requirement: Setup Screens State Their Step (M1)
The purpose line of Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente SHALL start with «Paso {n} de la puesta en marcha.», numbered in the order of the setup strip. Agentes' purpose line SHALL say it is optional and only needed for private networks.

#### Scenario: Mapping step
- **WHEN** the hash becomes `#mapeo`
- **THEN** the purpose line starts with «Paso 2 de la puesta en marcha.»
