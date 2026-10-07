# Proposal: CH-22b — Panel "My Automations" (P1h)

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-137 (firm, 2026-10-06), DEC-135, DEC-136, DEC-128, DEC-129.

## Intent

- Let the client (P2) see, in the panel, which automations they have and which ones they could have, with status, last run and next run (story **P1h**).
- Keep the panel read-only, tenant-scoped from the session (Rule 2), free of SQL and technical terms (Rule 1, DEC-04, DEC-93).

## Scope

### In Scope
- **Route**: `GET /api/panel/automatizaciones`, guarded by `levantarSesionPanel`, queries wrapped in `conTenantActivo`. Response `{ activas, disponibles, zonaHoraria, truncado }`.
  - `activas`: the tenant's automations with a business `titulo`, `descripcion`, `estado` (`activa` | `pausada`), `frecuencia` (only for the three DEC-129 patterns, otherwise omitted), `ultimaEjecucion` (latest non-`en-curso` execution: ISO date plus a neutral business outcome, or `null`) and `proximaEjecucion` (ISO UTC via `proximaEjecucion(cron, ahora, zona)`, `null` when paused).
  - `disponibles`: global templates that have business copy and no active automation of the tenant, with `titulo` and `descripcion`.
  - Explicit allow-list projection: no `conexionId`, `valores`, `codigoError`, raw `error`, `sql` or `tenantId`. The by-id template route is never used.
  - Truncation follows the `LIMITE_LISTADO` + `truncado` pattern.
- **Business copy map** (`automatizacion` slug to `{ titulo, descripcion }`) kept in the panel module, following the `TEMAS` precedent (DEC-128); neutral fallback for unknown slugs; unmapped templates are not listed as available.
- **Panel page**: replace the partial `<main>` of `src/panel.ts` with the automations screen (P-02): cards for active and available, loading skeleton, empty state ("Todavía no activaste ninguna automatización"), generic error, session-expired handling. No Ajustar / Activar buttons. Client formatting with `Intl` es-AR in the tenant zone.
- **Wiring**: new registrar in `src/server.ts`; new exact row in `RUTAS_PANEL_PUBLICAS` (`src/contexto-tenant.ts`).
- **Tests**: route tests (401 no cookie, 401 expired, 409 deactivated tenant, shape and allow-list), copy and frequency mapping unit tests, page test, and a two-tenant isolation test (A sees only A, foreign `X-Tenant-Id` ignored).

### Out of Scope
- "Con falla" status and failure notice (CH-22c).
- Adjusting thresholds or schedules, activating a template (CH-23, CH-21c).
- Execution results or rows (DEC-93).
- New models, migrations or template columns (DEC-128).

## Capabilities

### New Capabilities
- `client-panel-automations`: tenant-scoped read of the client's active and available automations with business-language status, last run and next run.

### Modified Capabilities
- `client-panel-auth`: ADDED requirement that the automations route resolves tenant only from the session (shell now hosts the screen).
- `tenant-isolation`: MODIFIED isolation test coverage to include the panel automations route.

## Approach

Single read route, one query for the tenant's automations with their template, one grouped query for the latest terminal execution per automation, one query for global templates. Pure functions for copy lookup, frequency text and projection, so they are unit-testable without a database. Next run computed on request with an injectable clock.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/panel-automatizaciones.ts`, `.test.ts` | New route, projection, copy map, frequency text |
| `src/panel.ts`, `src/panel.test.ts` | Automations screen replaces the partial shell |
| `src/contexto-tenant.ts`, `src/server.ts` | Exemption row and registrar |
| `src/aislamiento-panel.test.ts` | Two-tenant cases for the new route |
| `docs/01-decisiones.md` | DEC-137 (already registered) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Leaking technical fields through the projection | Medium | Allow-list builder plus a test asserting forbidden keys are absent |
| Route missing from `RUTAS_PANEL_PUBLICAS` returns 400 | Medium | Wiring task plus route test without `X-Tenant-Id` |
| Inline panel script breaks inside the TS template literal | Medium | Use string concatenation only, cover with the page test |
| A template with only a paused automation shows as available | Low | Documented consequence of DEC-137 option (a) |
| N+1 queries for last execution | Low | One grouped query for all automations |
| Size above 400 lines | Medium | Tasks forecast; split route and page if needed |

## Rollback Plan

Revert the PR. No migration or data change, so nothing else needs undoing; the previous partial shell returns.
