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

The schema introduced by this change SHALL NOT include tables for `usuario`, `ejecucion`, `plantilla`, `automatizacion`, or `mapeo`.

#### Scenario: Inspecting the schema after this change

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** it SHALL contain exactly `Tenant`, `Conexion`, and `ConsultaGuardada`
- **AND** it SHALL NOT contain any of `Usuario`, `Ejecucion`, `Plantilla`, `Automatizacion`, or `Mapeo`
