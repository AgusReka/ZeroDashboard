# Delta for Project Environment

## ADDED Requirements

### Requirement: Global Timezone Configuration for Schedule Interpretation (DEC-77)

The system SHALL read a single, deployment-wide timezone from an environment variable, used to interpret every `Automatizacion`'s cron schedule. WHEN unset, it SHALL default to a documented value. No per-tenant or per-automation timezone SHALL be read from any other source.

#### Scenario: Changing the timezone without a code change

- **GIVEN** the application configured with a timezone environment variable
- **WHEN** an operator changes its value and restarts the application
- **THEN** subsequently computed next-fire times SHALL use the new timezone
- **AND** no source file SHALL require modification

#### Scenario: Unset timezone falls back to the documented default

- **GIVEN** the timezone environment variable is unset
- **WHEN** the application starts
- **THEN** it SHALL use the documented default timezone with no startup error

### Requirement: Timezone Variable Ships Only as a Placeholder Example

The committed example environment file MUST document the timezone variable with a placeholder or default value, never a real deployment-specific value.

#### Scenario: Inspecting the example file

- **GIVEN** a fresh clone of the repository
- **WHEN** the committed example environment file is inspected
- **THEN** it SHALL document the timezone variable with a placeholder or default value only
