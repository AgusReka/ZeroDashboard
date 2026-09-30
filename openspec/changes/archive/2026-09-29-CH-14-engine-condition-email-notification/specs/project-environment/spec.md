# Delta for Project Environment

## ADDED Requirements

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
