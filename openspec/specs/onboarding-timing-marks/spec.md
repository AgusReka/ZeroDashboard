# Onboarding Timing Marks Specification

## Purpose

Lets P4 measure how long each stage of a tenant's onboarding took (G1), using a checked-in, read-only SQL script over existing columns (DEC-87, DEC-88, DEC-89). Prospective use only. The active tenant's marks are also readable through `GET /tiempos-alta` (DEC-178), a second implementation kept equal to the script by a parity test.

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

The bitácora MUST document: the validation mark is mutable (cleared on re-register, overwritten on re-validate), so output is captured at each onboarding close; marks are elapsed time, not effort; connection is registration, not proof of a successful connection; no strict ordering across marks is assumed (database vs application clocks); no backfill and no retro-measurement of CH-16. For connections with multiple views, `validacion_ultima` returns the most recent non-null `validadaEn` across all views, with the state of that same view; it is null only when no view has a validation.

#### Scenario: Limits recorded

- GIVEN the CH-15 bitácora
- WHEN it is reviewed
- THEN each limit above is stated
- AND a dated run output appears under "Consultas ejecutadas"

#### Scenario: Clock mix

- GIVEN a validation mark earlier than the mapping end due to clock skew
- WHEN the test runs
- THEN no assertion depends on ordering between marks

#### Scenario: Multi-view validation mark

- GIVEN a connection with multiple `VistaCanonica` rows, each with a different validation date
- WHEN the script runs
- THEN `validacion_ultima` returns the most recent non-null validation across all views
- AND `validacion_estado` reflects the state of that same view
- AND the mark is null only if no view has been validated

### Requirement: Read-Only Script (rules 3, 4)

The script SHALL contain only `SELECT` statements. It takes no parameters and returns all tenants' connections, per DEC-90. SQL MUST NOT be built by string concatenation. The script MUST NOT be exposed through any route.

#### Scenario: Read-only content

- GIVEN the script file
- WHEN its statements are inspected
- THEN none is INSERT, UPDATE, DELETE, DDL, or otherwise non-read

#### Scenario: No parameters

- GIVEN the script is invoked
- WHEN it runs
- THEN it takes no parameters and returns all tenants' connections (DEC-90)

### Requirement: Tenant Identifier Never Comes From a Request (rule 2)

No request value SHALL supply a tenant identifier to the script. The script is out-of-band (P4 tool) only. It takes no parameters and returns all tenants' connections (DEC-90).

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

### Requirement: Active Tenant Marks Route (DEC-178)
`GET /tiempos-alta` SHALL answer `200` with `{ conexiones, truncado }`: one entry per `Conexion` of the header tenant, ordered by `creadaEn` then `id`, capped at `LIMITE_LISTADO` with `truncado` saying whether more exist. It SHALL read through the isolated client, so the tenant comes only from the request context (rule 2). Each entry SHALL carry:

| Field | Mark |
|---|---|
| `conexionId`, `conexionNombre` | The connection |
| `altaInicio` | `Tenant.creadoEn` |
| `conexionRegistrada` | `Conexion.creadaEn` |
| `mapeoInicio`, `mapeoFin` | min `VistaCanonica.creadaEn`, max `VistaCanonica.actualizadaEn` |
| `validacionUltima`, `validacionEstado` | the latest non-null `validadaEn` (tie-break `entidad`, `id`) and that view's `estadoValidacion` |
| `automatizacionCreada` | min `Automatizacion.creadaEn` |
| `primeraEjecucion`, `primeraEjecucionEstado`, `primeraEjecucionFase` | the earliest `Ejecucion.iniciadaEn` through the connection's automations (tie-break `id`), with its `estado` and `fase` |
| `primeraEjecucionOk` | the earliest `iniciadaEn` with `estado='ok'` |

An unreached mark SHALL be `null`. The answer MUST NOT carry a credential, host, statement or tenant id. The route SHALL NOT read or execute the script.

#### Scenario: Only the header tenant
- **GIVEN** tenants A and B, each with one connection
- **WHEN** `GET /tiempos-alta` is sent for A
- **THEN** only A's connection is listed

#### Scenario: Missing header
- **WHEN** the route is called without `X-Tenant-Id`
- **THEN** it answers `400 tenant-no-indicado`

### Requirement: Route and Script Parity
A live test SHALL load one fixture, run the checked-in script unchanged and `GET /tiempos-alta` for the fixture tenant, and require the same marks for every connection: a failed run then an ok run, a re-validation, a connection with nothing after registration, and two runs starting at the same instant. It SHALL skip, not fail, when the database is unreachable.

#### Scenario: Same marks
- **GIVEN** the fixture
- **WHEN** both run
- **THEN** every mark of every connection is equal, nulls included

### Requirement: No Schema, Route, or Engine Change
The CH-15 change MUST NOT add a migration, route, console panel, scheduler or engine change (rule 6). The route and panel added later by DEC-178 do not read the script; the script itself stays unexposed.

#### Scenario: Diff surface
- GIVEN the CH-15 diff
- WHEN reviewed
- THEN it has no `prisma/` migration, `src/server.ts` route, or engine/scheduler diff
