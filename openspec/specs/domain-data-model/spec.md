# Spec: domain-data-model

Source of truth for the `domain-data-model` capability. Merged from `CH-02-initial-data-model` on 2026-09-15 (archived at `openspec/changes/archive/2026-09-15-CH-02-initial-data-model/`).

## Requirements

### Requirement: Tenant Table With an Active Flag

The own database SHALL have a `Tenant` table with an `activo` boolean field defaulting to `true`. The table MAY contain zero, one, or more rows after migrations run; the migration process SHALL NOT enforce or assume a fixed row count.
(Previously: exactly one `Tenant` row was required to exist after migrations run, seeded by the migration process itself.)

#### Scenario: Migrating a fresh own database

- **GIVEN** an own database with only CH-01's schema (no domain tables)
- **WHEN** the migration command is run
- **THEN** a `Tenant` table SHALL exist with an `activo` column defaulting to `true`

#### Scenario: Re-running migrations over an already-seeded database

- **GIVEN** an own database already migrated by CH-02, containing its previously seeded `Tenant` row
- **WHEN** this change's migration command is run
- **THEN** existing `Tenant` rows SHALL be backfilled with `activo: true`
- **AND** no existing row SHALL be dropped or altered otherwise
- **AND** no error SHALL occur

### Requirement: Connection Records Scoped to a Tenant

The own database SHALL have a `Conexion` table. Every `Conexion` row MUST reference exactly one `Tenant` row through a required (non-nullable) foreign key.

#### Scenario: Inserting a connection record

- **GIVEN** the seeded `Tenant` row exists
- **WHEN** a `Conexion` row is inserted referencing that tenant's id
- **THEN** the insert SHALL succeed

#### Scenario: Rejecting a connection without a tenant

- **GIVEN** the `Conexion` table
- **WHEN** an insert is attempted with a null or non-existent tenant reference
- **THEN** the database SHALL reject the insert

### Requirement: Saved Query Records Scoped to a Tenant

The own database SHALL have a `ConsultaGuardada` table, storing at minimum a name, an optional description, and the query text. Every `ConsultaGuardada` row MUST reference exactly one `Tenant` row through a required (non-nullable) foreign key.

#### Scenario: Saving a query

- **GIVEN** the seeded `Tenant` row exists
- **WHEN** a `ConsultaGuardada` row is inserted with a name and query text, referencing that tenant's id
- **THEN** the insert SHALL succeed
- **AND** the description field MAY be left empty

#### Scenario: Rejecting a saved query without a tenant

- **GIVEN** the `ConsultaGuardada` table
- **WHEN** an insert is attempted with a null or non-existent tenant reference
- **THEN** the database SHALL reject the insert

### Requirement: No Premature Modeling of Out-of-Release Entities

The schema introduced by this change SHALL NOT include a table for `usuario`. It MAY include exactly one additional tenant-scoped model representing a tenant's registered schema-mapping definition, scoped to a `Conexion` and a canonical entity name (DEC-30 through DEC-34). It MAY additionally include exactly one global model, `Plantilla`, carrying no `tenantId` column and no foreign key to `Tenant` (DEC-61). It MAY additionally include exactly two tenant-scoped models: `Automatizacion`, binding a `Plantilla` to a tenant's `Conexion`, parameter values, and a schedule (DEC-74); and `Ejecucion`, recording one run of an `Automatizacion` (X2). It MAY additionally include exactly one tenant-scoped model, `Agente`, holding a tenant's agent token hash and revocation state, one row per tenant (DEC-115, DEC-121).
(Previously: allowed the schema-mapping model, `Plantilla`, `Automatizacion`, and `Ejecucion`; `Agente` was not allowed. `Usuario` remains forbidden, unchanged.)

#### Scenario: Inspecting the schema after this change

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** it SHALL contain `Tenant`, `Conexion`, `ConsultaGuardada`, the schema-mapping definition model, `Plantilla`, `Automatizacion`, `Ejecucion`, and `Agente`
- **AND** it SHALL NOT contain `Usuario`

#### Scenario: Plantilla carries no tenant reference

- **GIVEN** the `Plantilla` model
- **WHEN** its columns are inspected
- **THEN** it SHALL have no `tenantId` column and no foreign key to `Tenant`

#### Scenario: Agente is tenant-scoped

- **GIVEN** the `Agente` model
- **WHEN** its columns are inspected
- **THEN** it SHALL have a required `tenantId` with a foreign key to `Tenant` and a unique index on it

#### Scenario: Usuario stays forbidden

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** no `Usuario` table SHALL exist
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
### Requirement: Client User Model (Usuario) (DEC-133)

The application database SHALL include a `Usuario` table for client users (P2). Each row MUST belong to exactly one `Tenant` via a foreign key `tenantId`, MUST have a unique `correo` (email), a `claveHash` string containing the scrypt salt and hash, an optional `nombre` string, an `activo` boolean defaulting to `true`, and timestamps `creadoEn` and `actualizadoEn`.

#### Scenario: Creating a client user

- **GIVEN** an active `Tenant`
- **WHEN** a `Usuario` is created with a valid email and hashed password
- **THEN** the record SHALL persist linked to that `tenantId`

#### Scenario: Unique email constraint

- **GIVEN** an existing `Usuario` with email `"admin@tienda.com"`
- **WHEN** attempting to create another `Usuario` with the same email
- **THEN** the database SHALL reject the duplicate

### Requirement: Panel Session Model (SesionPanel) (DEC-134)

The application database SHALL include a `SesionPanel` table. Each row MUST reference a `Usuario` and a `Tenant`, MUST store a SHA-256 `tokenHash` of the session token, an `expiraEn` expiration timestamp, and `creadaEn`.

#### Scenario: Creating a session record

- **GIVEN** an authenticated `Usuario`
- **WHEN** a session is issued
- **THEN** the `SesionPanel` record SHALL persist with the token hash and expiration timestamp
