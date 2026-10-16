# Query Console Specification (CH-30e2 delta)

## Purpose
The console shows the active tenant's onboarding stages (G1) over `GET /tiempos-alta` (DEC-178).

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order, a "Global" group with `#tenants`, `#plantillas` and `#contrato`, a "Puesta en marcha" group with `#conexiones`, `#agentes`, `#mapeo`, `#usuarios` and `#tiempos`, and a "Trabajo diario" group with `#consultas`, `#automatizaciones`, `#frescura` and `#auditoria`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: "Puesta en marcha" ended with `#usuarios`.)

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#tiempos`
- **THEN** only Tiempos de alta is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

## ADDED Requirements

### Requirement: Onboarding Times Screen
The Tiempos de alta screen SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /tiempos-alta` and show one block per connection, titled with its name, holding these stages in this order:

| Stage | Mark |
|---|---|
| Alta del tenant | `altaInicio` |
| Conexión registrada | `conexionRegistrada` |
| Inicio del mapeo | `mapeoInicio` |
| Última edición del mapeo | `mapeoFin` |
| Última validación | `validacionUltima`, with «Válida», «Inválida» or the state as it comes |
| Primera automatización | `automatizacionCreada` |
| Primera ejecución | `primeraEjecucion`, with «OK» or «Falló» and the phase |
| Primera ejecución OK | `primeraEjecucionOk` |

A reached stage SHALL show its local date and time to the minute and, when the nearest earlier reached stage of the block is not later, the time elapsed since it. An unreached stage SHALL show "—" and a neutral «Pendiente». Every value SHALL be text. The screen SHALL say that the marks measure elapsed time, not effort.

With no active tenant it SHALL say «Elegí un tenant para ver sus tiempos de alta.» and send nothing. With no connections it SHALL say «Este tenant todavía no tiene conexiones.». When the answer says `truncado`, it SHALL say that only the first 200 connections are shown. Network, tenant and other HTTP failures SHALL be legible.

#### Scenario: Stages of a connection
- **GIVEN** an active tenant with connection "food-store" that was registered and mapped but never validated
- **WHEN** the hash becomes `#tiempos`
- **THEN** one `GET /tiempos-alta` is sent with the active tenant
- **AND** a block titled "food-store" shows dates for the first four stages and "—" with «Pendiente» for the other four

#### Scenario: Elapsed time
- **GIVEN** a connection registered 2 hours 5 minutes after the tenant's start
- **THEN** «Conexión registrada» shows `+2 h 5 min`

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the hash becomes `#tiempos`
- **THEN** the screen says «Elegí un tenant para ver sus tiempos de alta.» and no request is sent

#### Scenario: Markup in a name is text
- **WHEN** a connection's name contains `<b>`
- **THEN** it is shown verbatim and no element is created from it
