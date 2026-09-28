# Proposal: CH-13 — Engine: Scheduling and Execution (X1, X2)

**Status**: ready for spec and design. Inputs: DEC-74..DEC-80.

## Intent

R1 closes with "an automation running on its own, end to end". CH-12 templates exist, but nothing runs them on a schedule (X1) or records runs (X2).

## Scope

### In Scope
- Tenant-scoped `Automatizacion`: plantilla, conexion, parameter values (JSON, CH-11 rules), cron expression, `activo` flag (DEC-74, DEC-76, DEC-79).
- Tenant-scoped `Ejecucion`: start, end, duration, row count, status, error (X2). Metadata only, never rows (D-1 leaning).
- In-process scheduler started by `src/server.ts` (DEC-75); next-fire-only cron library (DEC-76); global timezone env var (DEC-77).
- Run pipeline reuses `evaluarVistas` (DEC-71 gate, required by rule 5), `componerSentencia`, `ejecutarConsulta`. Inactive tenants and inactive automations never run (DEC-14, DEC-79).
- Tenant-scoped routes: create, list, get, deactivate automation (DEC-78, DEC-79); list an automation's runs (DEC-80).
- Minimal console: create/list/deactivate automations, view runs (DEC-78, DEC-80).

### Out of Scope
- Edit, delete, reactivate (DEC-79). Condition, email (CH-14); overlaps, retries, interrupted runs (CH-17); duplicate notification, cross-tenant failure isolation (CH-18); instantiation UX (CH-21); P2 schedule editing (CH-23).

## Capabilities

### New Capabilities
- `automation-scheduling`: `Automatizacion` model and routes, cron + timezone, scheduler, run pipeline.
- `execution-log`: one `Ejecucion` per run; runs listing route.

### Modified Capabilities
- `domain-data-model`: supersede the `Ejecucion`/`Automatizacion` prohibition (DEC-74); `Usuario` stays forbidden.
- `tenant-isolation`: both models in `MODELOS_AISLADOS`; scheduler as non-request context entry; T2 sweep covers all new routes.
- `query-console`: automation and run-log views under the active-tenant indicator.
- `project-environment`: timezone env var.

## Approach

- Per tick: read active `Tenant` rows (unscoped), enter each tenant's context, run its due active automations, write `Ejecucion`. The per-run catch only records errors (X2); it is not CH-18 isolation.
- `conTenantActivo` becomes a production entry. The tenant id comes only from own-database rows, never a request (rule 2). The fail-closed extension stays the sole filter. Design records this as a design-level resolution under DEC-13 (CH-06 precedent).
- New routes follow existing header-scoped conventions (no exemption). Conexion and plantilla are resolved on the server.
- Rules 3/4/6: unchanged read-only pipeline, driver-bound values, no branching/retries/triggers.

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma` + migration | Modified (two tables) |
| `src/aislamiento-prisma.ts`, `src/contexto-tenant.ts` | Modified |
| `src/planificador.ts`, `src/automatizaciones.ts`, `src/automatizaciones-rutas.ts` (+ tests) | New |
| `src/consola.ts`, `src/aislamiento.test.ts` | Modified |
| `src/server.ts`, `src/config.ts`, `.env.example`, `package.json` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scheduler query escapes tenant context | Med | Fail-closed extension; T2 extended |
| Console targets wrong tenant | Low | Header forwarding + T4 indicator (DEC-15) |
| Missed fires while down | Med | Accepted (DEC-75); CH-17 |
| Error text echoes tenant data | Low | Store the classified error |

## Rollback Plan

Remove the scheduler start call in `src/server.ts` to stop runs at once. Then revert slices in reverse order: the migration only adds two tables, and existing routes and console sections are untouched.

## Dependencies

- Cron library (DEC-76).

## Resolved Questions

- **OQ-E → DEC-78** Tenant-scoped API (create/list/get) plus minimal console UI.
- **OQ-F → DEC-79** `activo` flag with deactivate action; no edit or delete.
- **OQ-G → DEC-80** Tenant-scoped runs listing plus console view.

## Size Forecast

~1600–2200 lines with tests. `400-line budget risk: High`. Chained PRs recommended.

## Success Criteria

- [ ] A due active automation runs unattended at its cron time in the configured timezone.
- [ ] Every run (success, failure, gate refusal) writes one `Ejecucion` with all X2 fields.
- [ ] A deactivated automation never runs again; its runs remain listable.
- [ ] T2 green across all new routes.
