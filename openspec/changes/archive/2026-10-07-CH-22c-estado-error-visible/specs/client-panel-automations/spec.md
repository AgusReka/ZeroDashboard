# Client Panel Automations Specification (CH-22c)

## Purpose
Extend CH-22b to show a visible failure state in business language when an active automation's last finished run failed. Fulfils story **P3h**. Enforce Rules 1 and 2; no schema changes, no email notification.

## MODIFIED Requirements (overriding CH-22b where specified)

### Requirement: Business Status Includes Failure (replaces/extends CH-22b status rule)
Each `activas` item SHALL carry `estado` in `{ 'activa', 'pausada', 'con_falla' }`.
- `pausada` when `activo === false`.
- `con_falla` when `activo === true` AND `ultimaEjecucion !== null` AND `ultimaEjecucion.resultado === 'no-realizada'` (latest finished run was `fallo` or `omitida`).
- `activa` otherwise when `activo === true` (last run was `completada` or there is no finished run).
A paused automation SHALL never be `con_falla`. The failure state is visible only for active automations.

#### Scenario: Active automation with failed last run becomes con_falla
- **GIVEN** an automation with `activo = true` whose latest finished execution has `estado = 'fallo'` (so `resultado` is `no-realizada`)
- **WHEN** `GET /api/panel/automatizaciones` is called
- **THEN** its `estado` SHALL be `con_falla`

#### Scenario: Active automation with successful last run remains activa
- **GIVEN** an automation with `activo = true` and latest finished execution `ok` → `completada`
- **WHEN** called
- **THEN** `estado` SHALL be `activa`

#### Scenario: Active automation with only in-progress run remains activa (no finished failure)
- **GIVEN** `activo = true`, only `en-curso` executions
- **WHEN** called
- **THEN** `ultimaEjecucion` is `null` and `estado` SHALL be `activa`

#### Scenario: Paused automation with failed last run is pausada (never con_falla)
- **GIVEN** `activo = false` and latest finished execution was `fallo`
- **WHEN** called
- **THEN** its item appears in `activas` with `estado = 'pausada'` and no failure banner derived from it as "active failure"

### Requirement: Failure Banner Visible in Panel (UI)
When `estado === 'con_falla'`, the panel card SHALL show an inline error banner with business language (no technical terms/codes). The banner text is pinned by page tests and uses only glossary-compliant terms.

#### Scenario: Card shows failure banner for con_falla
- **GIVEN** response contains an active automation with `estado = 'con_falla'`
- **WHEN** the panel renders
- **THEN** the card shows a failure banner with title/body in business language (e.g. "No pudimos completar esta automatización esta vez")

### Requirement: Allow-List and No Technical Fields (unchanged)
Projection remains allow-listed; response SHALL NOT contain `tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`. No template SQL exposed.

### Requirement: Isolation and Auth (unchanged)
Tenant only from session; `X-Tenant-Id` ignored; 401/409 unchanged; exemption row unchanged.

### Requirement: Last Execution Semantics (unchanged)
`ultimaEjecucion` remains the latest finished execution (not `en-curso`), with `fecha = finalizadaEn ?? iniciadaEn` (ISO UTC) and `resultado` `completada`/`no-realizada`. `omitida` maps to `no-realizada`.
