# Domain Data Model Specification (CH-44 delta)

## ADDED Requirements

### Requirement: Channel Columns Are Text With Their Values in Code (DEC-185, DEC-197)
`Automatizacion.canal` SHALL be `TEXT NOT NULL DEFAULT 'correo'` and `Ejecucion.canal` SHALL be nullable `TEXT` with no default. There SHALL be no database enum or CHECK: the allowed values live in code, like `notificacion`. One additive migration SHALL add both, with no data copy and with its rollback recipe in a comment. No migration SHALL add a chat id, a username or a channel-specific recipient to either table (rule 5).

#### Scenario: Migrating existing rows
- **GIVEN** existing `Automatizacion` and `Ejecucion` rows
- **WHEN** the migration runs
- **THEN** every `Automatizacion` SHALL read `canal='correo'`, every existing `Ejecucion` SHALL read `canal` null, and no other column SHALL change
