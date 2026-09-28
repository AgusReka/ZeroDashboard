# Delta for Domain Data Model

## ADDED Requirements

### Requirement: Schema-Mapping Definitions Persist a Validation Result (DEC-40, DEC-44)

The schema-mapping definition model (added by CH-09) SHALL carry three additional columns: a validation status, a per-field diagnostic (JSON), and a validation timestamp. A row with no validation performed yet SHALL have these columns unset. An entity with no registered mapping SHALL have no row at all; its validation state SHALL be derived by the `mapping-validation` capability from the canonical contract at read time, not stored. No new model SHALL be introduced; the model list stays exactly `Tenant`, `Conexion`, `ConsultaGuardada`, and the one schema-mapping definition model, now carrying these columns.

#### Scenario: Migrating adds validation columns

- **GIVEN** an own database already migrated through CH-09
- **WHEN** this change's migration is run
- **THEN** the schema-mapping definition table SHALL gain a validation-status column, a diagnostic column, and a validation-timestamp column
- **AND** existing rows SHALL keep their SQL text unchanged, with the new columns unset

#### Scenario: Persisting a validation result

- **GIVEN** a registered mapping definition for the `producto` entity
- **WHEN** the validate action runs and completes for that entity
- **THEN** its row SHALL be updated with a validation status, a diagnostic value, and a validation timestamp

#### Scenario: Unmapped entity has no row

- **GIVEN** a `Conexion` with no registered definition for `insumo`
- **WHEN** the schema-mapping definitions for that connection are inspected
- **THEN** no row SHALL exist for `insumo`

### Requirement: Only the Latest Validation Result Is Kept (DEC-44)

The system SHALL retain only the most recent validation result per schema-mapping definition row; no separate history model SHALL be introduced.

#### Scenario: A second validation overwrites the first

- **GIVEN** an entity with a persisted validation result from an earlier run
- **WHEN** the validate action runs again for that entity
- **THEN** the row's validation status, diagnostic, and timestamp SHALL be overwritten with the new result
- **AND** no additional row or history record SHALL be created
