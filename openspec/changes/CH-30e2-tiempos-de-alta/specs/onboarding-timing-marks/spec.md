# Onboarding Timing Marks Specification (CH-30e2 delta)

## Purpose
The marks of the active tenant are also readable from the application, through a route of its own (DEC-178). The script stays the cross-tenant P4 tool (DEC-90).

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: No Schema, Route, or Engine Change
The CH-15 change MUST NOT add a migration, route, console panel, scheduler or engine change (rule 6). The route and panel added later by DEC-178 do not read the script; the script itself stays unexposed.
(Previously: no exception for DEC-178.)

#### Scenario: Diff surface
- GIVEN the CH-15 diff
- WHEN reviewed
- THEN it has no `prisma/` migration, `src/server.ts` route, or engine/scheduler diff
