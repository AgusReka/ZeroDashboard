# Project Environment Specification (CH-43 delta)

## Purpose
The global Telegram bot's token comes from one optional environment variable, with the same criterion as SMTP (DEC-185, DEC-86, rule 7).

## ADDED Requirements

### Requirement: Optional Telegram Bot Token From the Environment (rule 7, DEC-185)
The system SHALL read the bot token from `TELEGRAM_BOT_TOKEN`. The variable SHALL be optional: absent or empty, the application MUST start without error, SHALL NOT start the Telegram poller, and the panel SHALL report Telegram as not available. The token MUST NOT be hardcoded, MUST NOT be part of the application config object, and MUST NOT appear in any log, error message or HTTP response. At startup the application SHALL log only whether Telegram is `configurado` or `no-configurado`.

#### Scenario: Application starts with the token unset
- **GIVEN** `TELEGRAM_BOT_TOKEN` absent or empty
- **WHEN** the application starts
- **THEN** startup succeeds, the log says `no-configurado`, and no request to Telegram is made

#### Scenario: A wrong token does not stop the application
- **GIVEN** `TELEGRAM_BOT_TOKEN` set to a value Telegram refuses
- **WHEN** the application starts
- **THEN** it serves requests, the poller backs off on `getMe`, and no log carries the value

### Requirement: Telegram Variable Ships Only as a Placeholder
The committed example environment file MUST document `TELEGRAM_BOT_TOKEN` with an empty value, the README variable table SHALL describe it, and the Compose definition SHALL forward it as `${TELEGRAM_BOT_TOKEN:-}` without embedding a value.

#### Scenario: Inspecting the example file and Compose definition
- **GIVEN** a fresh clone of the repository
- **WHEN** the example environment file and Compose definition are inspected
- **THEN** `TELEGRAM_BOT_TOKEN` appears with an empty value only
