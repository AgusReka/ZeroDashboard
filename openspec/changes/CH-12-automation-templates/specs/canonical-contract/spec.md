# Delta for Canonical Contract

## ADDED Requirements

### Requirement: Automation Labels Correspond to Real Plantilla Values (Closes DEC-22)

Every automation label used across the catalog SHALL be one of the values enumerated by `AUTOMATIZACIONES`, and the `automation-templates` capability SHALL validate a `Plantilla`'s `automatizacion` field against that same enumeration. This reconciles the free-text labels DEC-22 left unattached to any real entity: they now correspond to persisted `Plantilla` rows through a single shared source (`AUTOMATIZACIONES`), not by convention.

#### Scenario: Every catalog label is a valid template value

- GIVEN the catalog module and the `automation-templates` validation for `automatizacion`
- WHEN every automation label used across all catalog fields is compared against `AUTOMATIZACIONES`
- THEN each SHALL be a value that `automation-templates` also accepts for `Plantilla.automatizacion`
