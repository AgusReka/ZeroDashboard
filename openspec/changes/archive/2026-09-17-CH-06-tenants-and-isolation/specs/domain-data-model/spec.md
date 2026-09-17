# Delta for Domain Data Model

## MODIFIED Requirements

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

## RENAMED Requirements

### Requirement: Tenant Table With a Single Seeded Row → Tenant Table With an Active Flag

(Reason: this change adds an `activo` boolean to the `Tenant` table and drops the "exactly one seeded row" invariant, so the requirement name no longer describes the resulting behavior.)
(Migration: none — the MODIFIED block above carries the full updated requirement text and scenarios.)
