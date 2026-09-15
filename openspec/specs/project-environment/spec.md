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
