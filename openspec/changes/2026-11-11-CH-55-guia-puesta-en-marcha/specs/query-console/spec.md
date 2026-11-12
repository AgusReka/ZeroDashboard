# Query Console Specification (CH-55 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-55. `onboarding-timing-marks` specifies `GET /tiempos-alta`, which this change does not use. Pattern ids refer to `.claude/skills/zerodashboard-design/guidelines/admin.md` (G1–G5, N5, N6).

**Data source (user's decision, 2026-11-11, at apply).** The guide reads nothing of its own. Each stage is known from data the console already reads:
- the connections and automations, when the tenant is chosen;
- Mapeo, Usuarios del panel and Tablero del cliente, when their screen is shown.

Until a stage has been checked in the visit, it reads «Sin revisar».

## ADDED Requirements

### Requirement: Setup Strip (G1)
Agentes, Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente SHALL show, under their page header, a setup strip for the active tenant.

**Stages.** The strip lists, in order:

| Stage | Done when | Known from |
|---|---|---|
| Conexión | at least one connection | the connection lists the console already reads (Consultas picker, Conexiones, Mapeo) |
| Mapeo | a connection's report has every obligatory entity "Válida" | the Mapeo screen's report and validation |
| Usuarios del panel | at least one active panel user | the Usuarios del panel screen |
| Tablero | the dashboard holds at least one report | the Tablero del cliente screen and its save |
| Primera automatización | at least one active automation | the automations list read with the tenant |

**Each stage** SHALL be shown as a mark and text: «✓ Hecho», «○ Pendiente», or «? Sin revisar» when it has not been checked yet in this visit.

**The current screen's stage** SHALL be marked «(estás acá)». Agentes is not a stage, and its screen marks none.

**The next step.** The strip SHALL end with «Siguiente: {first stage not done} →», linking to its screen, or with «Puesta en marcha completa» when every stage is done.

**The guide never blocks and never asks.** It SHALL NOT disable, hide or reorder any control or screen, and it SHALL NOT send any request of its own.

**Without a tenant**, the strip is hidden.

**On a tenant change**, the state starts over.

#### Scenario: Strip after choosing a tenant
- **GIVEN** tenant A has one connection and no automations
- **WHEN** the operator opens Agentes
- **THEN** the strip shows Conexión «✓ Hecho», Mapeo, Usuarios del panel and Tablero «? Sin revisar», Primera automatización «○ Pendiente», and «Siguiente: Mapeo →»

#### Scenario: A mapping becomes valid
- **GIVEN** the Mapeo screen shows a report with an obligatory entity "Inválida"
- **THEN** its strip reads «Mapeo ○ Pendiente (estás acá)»
- **WHEN** a validation answers every obligatory entity "Válida"
- **THEN** it reads «Mapeo ✓ Hecho (estás acá)»

#### Scenario: The guide sends nothing
- **WHEN** the operator chooses a tenant and opens a setup screen
- **THEN** the only requests are the ones the tenant change and that screen already sent before this change

### Requirement: Setup Marks in the Navigation (N6)
With an active tenant, the navigation items Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente SHALL each carry a mark, «✓ Hecho» or «○ Pendiente», from the same state as the setup strip.
- A stage not checked yet shows no mark.
- Agentes carries none.
- The marks SHALL NOT change whether an item is usable (N5).
- Without a tenant the marks are hidden.

#### Scenario: Marks follow the strip
- **GIVEN** tenant A has a connection and Mapeo was not visited
- **THEN** Conexiones is marked «✓ Hecho» and Mapeo y validación has no mark

### Requirement: Next Step After Completing a Stage (G2)
When an action completes a stage, the setup strip of the screen the operator is on SHALL update at once, and its «Siguiente» link SHALL name the next stage that is not done.

#### Scenario: First user
- **GIVEN** the operator is on Usuarios del panel with no active user
- **WHEN** the list shows an active user
- **THEN** the strip reads «Usuarios del panel ✓ Hecho (estás acá)» and «Siguiente» names the first stage still open

### Requirement: One Connection Comes Preselected (G3)
In Mapeo y validación, when the active tenant has exactly one connection, it SHALL come selected and its report SHALL be read. With two or more, none SHALL be preselected. (Consultas does the same since CH-53.)

#### Scenario: One connection
- **GIVEN** tenant A has only "food-store"
- **WHEN** the operator opens Mapeo y validación
- **THEN** "food-store" is selected and its report is requested

#### Scenario: Two connections
- **GIVEN** tenant A has "food-store" and "replica-b"
- **WHEN** the operator opens Mapeo y validación
- **THEN** no connection is selected

### Requirement: Setup Screens State Their Step (M1)
The purpose line of Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente SHALL start with «Paso {n} de la puesta en marcha.», numbered in the order of the setup strip. Agentes' purpose line SHALL start with «Opcional: solo hace falta si la réplica está en una red privada.»

#### Scenario: Mapping step
- **WHEN** the hash becomes `#mapeo`
- **THEN** the purpose line starts with «Paso 2 de la puesta en marcha.»
