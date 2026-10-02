# Delta for Project Environment

## ADDED Requirements

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
