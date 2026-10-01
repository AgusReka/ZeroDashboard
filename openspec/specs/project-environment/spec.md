# Spec: project-environment

Source of truth for the `project-environment` capability. Merged from `CH-01-app-scaffolding-and-environment` on 2026-09-15 (archived at `openspec/changes/archive/2026-09-15-CH-01-app-scaffolding-and-environment/`).

## Requirements

### Requirement: Reproducible Local Environment

The system SHALL provide a Docker Compose definition that starts the application and its own database with a single command, without additional manual setup steps.

#### Scenario: Bringing the environment up from a clean checkout

- **GIVEN** a clean checkout of the repository with Docker installed, and an environment file populated from the provided example
- **WHEN** a developer runs the Compose bring-up command
- **THEN** the application container and the own-database container SHALL both reach a running state
- **AND** the application SHALL be able to connect to its own database

### Requirement: Own Database via Migrations

The own-database schema SHALL be created and changed only through migrations. Manual or ad hoc schema statements SHALL NOT be part of the setup or run process.

#### Scenario: Applying migrations to an empty database

- **GIVEN** a running own-database instance with no schema
- **WHEN** the migration command is run
- **THEN** the own database SHALL reach the expected schema state
- **AND** re-running the same migration command SHALL NOT change the schema further or produce an error

### Requirement: Environment-Variable Configuration

Application configuration values that vary between environments (at minimum: own-database connection and application port) SHALL be supplied through environment variables. The application SHALL NOT hardcode these values.

#### Scenario: Changing configuration without a code change

- **GIVEN** the application configured via environment variables
- **WHEN** an operator changes an environment variable value (for example, the own-database connection) and restarts the application
- **THEN** the application SHALL use the new value
- **AND** no source file SHALL require modification for that change to take effect

### Requirement: Secrets Excluded From the Repository

The repository MUST NOT contain real secret values. An example environment file with placeholder values MUST be committed instead, and the file holding real values MUST be excluded from version control.

#### Scenario: Inspecting a fresh clone for secrets

- **GIVEN** a fresh clone of the repository
- **WHEN** the environment file used to run the application locally is created from the committed example
- **THEN** the committed example file SHALL contain only placeholder values
- **AND** the file with real values SHALL be ignored by version control

### Requirement: Verifiable Application Skeleton

The application skeleton SHALL expose a way to verify, from outside the process, that it started successfully and can reach its own database.

#### Scenario: Checking the skeleton is alive after bring-up

- **GIVEN** the application and its own database running via Compose
- **WHEN** a readiness check is requested from the application
- **THEN** the application SHALL report a ready status
- **AND** that status SHALL reflect a successful connection to the own database
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
### Requirement: Optional SMTP Configuration From Environment Variables (rule 7, DEC-86)

The system SHALL read its SMTP settings (host, port, secure flag, user, password, sender) from environment variables. These variables SHALL be optional. SMTP is unset exactly when `SMTP_HOST` is absent or empty: in that case the application MUST start without error and SHALL treat SMTP as not configured (runs record `notificacion='no-configurada'`). WHEN `SMTP_HOST` is present, the rest of the SMTP configuration MUST be complete and valid, or the application MUST fail to start with an error that names the offending variable and never its value. Their values MUST NOT be hardcoded.

#### Scenario: Application starts with SMTP unset

- GIVEN `SMTP_HOST` is absent or empty
- WHEN the application starts
- THEN startup SHALL succeed with no error

#### Scenario: SMTP_HOST present but configuration invalid or incomplete

- GIVEN `SMTP_HOST` is set and another SMTP variable is missing or invalid (for example no `SMTP_FROM`, a non-numeric port, or only one of `SMTP_USER` and `SMTP_PASSWORD`)
- WHEN the application starts
- THEN the application SHALL fail to start with an error naming the variable
- AND the error SHALL NOT contain the variable's value

#### Scenario: Changing SMTP settings without a code change

- GIVEN SMTP variables set and an operator changes one and restarts
- WHEN the next notification is sent
- THEN the new value SHALL be used and no source file SHALL require modification

### Requirement: SMTP Variables Ship Only as Placeholders

The committed example environment file MUST document every SMTP variable with an empty or placeholder value, never a real credential, and the Compose definition SHALL forward them to the application without embedding values.

#### Scenario: Inspecting the example file and Compose definition

- GIVEN a fresh clone of the repository
- WHEN the example environment file and Compose definition are inspected
- THEN every SMTP variable SHALL appear with an empty or placeholder value only
- AND no real credential SHALL be present

### Requirement: Local Mail Catcher Under an Opt-In Compose Profile (DEC-81)

The Compose definition SHALL provide a Mailpit service under a named profile, so that it starts only when that profile is requested. The default bring-up (no profile) MUST NOT start it and MUST remain a single-command start of the application and its database.

#### Scenario: Default bring-up excludes the mail catcher

- GIVEN the Compose definition
- WHEN the default bring-up command runs with no profile
- THEN the Mailpit service SHALL NOT start
- AND the application and its database SHALL reach a running state

#### Scenario: Profile bring-up includes the mail catcher

- GIVEN the Compose definition
- WHEN the bring-up runs with the mail profile
- THEN the Mailpit service SHALL start alongside the application and database
### Requirement: Connection Retry Configuration From Environment Variables (DEC-98, DEC-105, DEC-19)

The system SHALL read two global variables: `CONNECTION_RETRY_ATTEMPTS` (total attempts, default 3) and `CONNECTION_RETRY_PAUSE_MS` (fixed pause, default 5000). Attempts MUST be an integer from 1 to 5; pause MUST be a positive integer. WHEN a value is set and invalid (non-numeric, below 1, above 5 for attempts, non-positive pause), the application MUST fail to start with an error naming the variable. Values MUST NOT be hardcoded outside the documented defaults.

#### Scenario: Defaults apply when unset

- GIVEN both variables unset
- WHEN configuration is loaded
- THEN attempts SHALL be 3 and pause SHALL be 5000 ms

#### Scenario: Valid values override the defaults

- GIVEN `CONNECTION_RETRY_ATTEMPTS=5` and `CONNECTION_RETRY_PAUSE_MS=1000`
- WHEN configuration is loaded
- THEN attempts SHALL be 5 and pause SHALL be 1000 ms

#### Scenario: Attempts of 1 disables retry

- GIVEN `CONNECTION_RETRY_ATTEMPTS=1`
- WHEN a connection fails transiently
- THEN the run SHALL make a single attempt

#### Scenario: Out-of-range or malformed value fails startup

- GIVEN `CONNECTION_RETRY_ATTEMPTS` set to `6`, `0`, or `abc`, or `CONNECTION_RETRY_PAUSE_MS` set to `0` or `abc`
- WHEN configuration is loaded at startup
- THEN it SHALL fail with an error naming the offending variable

### Requirement: Retry Variables Ship Only as Placeholders

The committed example environment file and the Compose definition MUST document and forward both retry variables with default or placeholder values only.

#### Scenario: Inspecting example and Compose files

- GIVEN a fresh clone of the repository
- WHEN `.env.example` and `docker-compose.yml` are inspected
- THEN both variables SHALL appear with default or placeholder values only
