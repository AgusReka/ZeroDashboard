# Onboarding Timing Marks Specification

## Purpose

Lets P4 measure how long each stage of a tenant's onboarding took (G1), using a checked-in, read-only SQL script over existing columns (DEC-87, DEC-88, DEC-89). Prospective use only.

## Requirements

### Requirement: One Row per Conexion

The script SHALL return exactly one row per `Conexion`, repeating the tenant start mark (`Tenant.creadoEn`) on each row. It MUST NOT return a per-tenant aggregate.

#### Scenario: Two connections in one tenant

- GIVEN a tenant with two `Conexion` rows
- WHEN the script runs
- THEN it returns two rows, one per connection
- AND both rows carry the same tenant start mark

### Requirement: Mark Sources and Definitions

| Mark | Source |
|------|--------|
| Tenant start | `Tenant.creadoEn` |
| Connection | `Conexion.creadaEn` (registration, DEC-88) |
| Mapping start / end | min `VistaCanonica.creadaEn` / max `VistaCanonica.actualizadaEn` |
| Latest validation + state | `VistaCanonica.validadaEn` + `estadoValidacion` |
| First execution + `estado`/`fase` | earliest `Ejecucion.iniciadaEn` |
| First `ok` execution | earliest `Ejecucion.iniciadaEn` where `estado='ok'` |
| Automation created (informational) | `Automatizacion.creadaEn` |

The script SHALL return every mark above under a distinct column.

#### Scenario: Failed run then ok run

- GIVEN a connection whose first `Ejecucion` has `estado='fallo'`, `fase='preparacion'`, and a later one has `estado='ok'`
- WHEN the script runs
- THEN first execution equals the failed run's start with its `estado` and `fase`
- AND the first-`ok` mark equals the later run's start

#### Scenario: Re-validation

- GIVEN a mapping validated twice, the second result `invalida`
- WHEN the script runs
- THEN the validation mark and state reflect the latest validation, including `invalida`

### Requirement: Null When a Stage Has Not Happened

An unreached stage MUST yield null for its mark (and state/phase columns). It MUST NOT be omitted, zero-filled, or inferred.

#### Scenario: No runs yet

- GIVEN a connection with a mapping and automation but no `Ejecucion`
- WHEN the script runs
- THEN first-execution, its `estado`/`fase`, and first-`ok` are null
- AND the row is still returned

#### Scenario: Never validated

- GIVEN a connection whose mapping was re-registered (validation cleared)
- WHEN the script runs
- THEN the validation mark and state are null

### Requirement: Documented Limits

The bitácora MUST document: the validation mark is mutable (cleared on re-register, overwritten on re-validate), so output is captured at each onboarding close; marks are elapsed time, not effort; connection is registration, not proof of a successful connection; no strict ordering across marks is assumed (database vs application clocks); no backfill and no retro-measurement of CH-16.

#### Scenario: Limits recorded

- GIVEN the CH-15 bitácora
- WHEN it is reviewed
- THEN each limit above is stated
- AND a dated run output appears under "Consultas ejecutadas"

#### Scenario: Clock mix

- GIVEN a validation mark earlier than the mapping end due to clock skew
- WHEN the test runs
- THEN no assertion depends on ordering between marks

### Requirement: Read-Only, Parameterized Script (rules 3, 4)

The script SHALL contain only `SELECT` statements. Any filter value MUST be bound as a driver parameter; SQL MUST NOT be built by string concatenation. The script MUST NOT be exposed through any route.

#### Scenario: Read-only content

- GIVEN the script file
- WHEN its statements are inspected
- THEN none is INSERT, UPDATE, DELETE, DDL, or otherwise non-read

#### Scenario: Bound filter

- GIVEN a tenant filter is supplied
- WHEN the script runs
- THEN the value reaches the database only as a driver parameter

### Requirement: Tenant Identifier Never Comes From a Request (rule 2)

No request value SHALL supply a tenant identifier to the script. The script is out-of-band (P4 tool) only. Whether it takes a tenant filter or lists all tenants is PENDING DESIGN and not decided here.

#### Scenario: No route exposure

- GIVEN the application routes
- WHEN the script's consumers are searched
- THEN no HTTP route reads or executes it

### Requirement: Fixture Test Runs the Script Unchanged

A `node:test` fixture test SHALL execute the checked-in script file as-is against a live database, asserting marks, nulls, and one row per connection (fixtures: failed then ok runs, re-validation, two connections). It SHALL skip, not fail, when the database is unreachable.

#### Scenario: Database unreachable

- GIVEN the database is unreachable
- WHEN the suite runs
- THEN the test is skipped, not failed

### Requirement: No Schema, Route, or Engine Change

The change MUST NOT add a migration, route, console panel, scheduler or engine change (rule 6).

#### Scenario: Diff surface

- GIVEN the CH-15 diff
- WHEN reviewed
- THEN it has no `prisma/` migration, `src/server.ts` route, or engine/scheduler diff
