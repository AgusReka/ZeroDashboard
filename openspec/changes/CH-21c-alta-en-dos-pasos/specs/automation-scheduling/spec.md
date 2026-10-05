# Delta for Automation Scheduling

## ADDED Requirements

### Requirement: Create Response Reports the First Scheduled Run (DEC-129)

The `POST /automatizaciones` 201 body SHALL include, in addition to its existing fields, `proximaEjecucion` and `zonaHoraria`. `proximaEjecucion` SHALL be an ISO 8601 instant equal to the first fire of the automation's cron strictly after `creadaEn`, resolved in the deployment's configured zone (DEC-77). `zonaHoraria` SHALL be that configured zone. The computation MUST be read-side only: it MUST NOT change what is persisted or how runs are selected. The value is a schedule, not a promise (DEC-95). Existing fields and their values MUST remain unchanged.

#### Scenario: First run after creation

- **GIVEN** the configured zone `UTC` and a cron `30 8 * * *` created at 10:00 UTC
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be 08:30 UTC of the next day
- **AND** `zonaHoraria` SHALL be `UTC`

#### Scenario: Weekday range across a weekend

- **GIVEN** cron `30 8 * * 1-5` and a Friday creation after 08:30
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be the following Monday at 08:30

#### Scenario: Saturday range

- **GIVEN** cron `30 8 * * 1-6` and a Saturday creation after 08:30
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be the following Monday at 08:30

#### Scenario: Non-UTC zone

- **GIVEN** the configured zone `America/Argentina/Buenos_Aires` and cron `0 8 * * *`
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be 08:00 in that zone expressed as an ISO instant
- **AND** `zonaHoraria` SHALL be that zone

#### Scenario: Strictly after creation

- **GIVEN** a creation at exactly a cron fire minute
- **WHEN** the automation is created
- **THEN** `proximaEjecucion` SHALL be later than `creadaEn`

#### Scenario: Additive and unchanged

- **GIVEN** any valid creation
- **WHEN** the 201 body is read
- **THEN** `automatizacion` and its existing fields SHALL be unchanged
- **AND** an invalid request SHALL still fail with the same `400` or `404` and no row SHALL persist
