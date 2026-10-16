# Query Console Specification (CH-26 delta)

## Purpose
The automation wizard warns, before creation, when the active tenant's replica refreshes less often than a template tolerates (F3, DEC-180).

## ADDED Requirements

### Requirement: Freshness Warning in the Wizard (DEC-180)
In the «Nueva automatización» wizard, each template card SHALL show a warning when the active tenant's declared window (`ventanaDesactualizacionMinutos`) is greater than the template's `toleranciaFrescuraMinutos`, the same comparison the Frescura screen uses. The warning SHALL name both values and say the automation can still be created. The card SHALL stay selectable. With no declared window, or a window not greater than the tolerance, the card SHALL show no warning. The warnings SHALL reflect the tenant's current window each time the wizard opens. When a warned template is created, the creation notice SHALL repeat the warning. The check MUST be advisory: nothing about it is sent to the server and creation is never blocked by it.

#### Scenario: Window above the tolerance
- **GIVEN** the active tenant declares a window of 180 minutes and a template tolerates 60 minutes
- **WHEN** the wizard opens
- **THEN** that template's card says the replica refreshes every 3 h and the template tolerates 1 h
- **AND** the card can still be chosen

#### Scenario: Window not above the tolerance
- **GIVEN** a window of 60 minutes and a template that tolerates 60 minutes
- **WHEN** the wizard opens
- **THEN** that card shows no warning

#### Scenario: Undeclared window
- **GIVEN** the active tenant has no declared window
- **WHEN** the wizard opens
- **THEN** no card shows a warning

#### Scenario: Creating a warned template
- **GIVEN** a warned template is chosen
- **WHEN** the automation is created
- **THEN** the creation notice repeats the warning
- **AND** the request body is the same as without the warning
