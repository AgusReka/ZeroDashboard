# Exploration: CH-22b — Panel "mis automatizaciones"

Story P1h. Tenant-scoped read route for the client panel, separate from the console (DEC-04). No SQL, no technical terms in the UI.

## Current state

- Session hook: `levantarSesionPanel(prisma, { opcional? })` (`src/panel-auth.ts:185`) sets `request.sesionPanel` with `tenantId` and `tenantNombre`. Handlers wrap queries in `conTenantActivo({ id, nombre }, ...)` (`src/panel-auth.ts:268-272`).
- New `/api/panel/*` routes must be added as exact rows to `RUTAS_PANEL_PUBLICAS` (`src/contexto-tenant.ts:141`), otherwise the header hooks demand `X-Tenant-Id` and answer 400.
- Registration point: `src/server.ts` (~109-115), next to `registerPanelAuthRoutes` / `registerPanelRoutes`.
- Data: `Automatizacion` and `Ejecucion` are tenant-isolated models; `Plantilla` is global (no `tenantId`). Next run is not persisted: `proximaEjecucion(cron, desde, zona)` (`src/automatizaciones.ts:118`). `Ejecucion.estado` can be `en-curso`, `ok`, `fallo`, `omitida`.
- Panel page is a TS string in `src/panel.ts`; `<main>` (line 210) already holds the "Mis automatizaciones" title marked `data-estado="parcial"`. Inline script cannot use JS template literals.
- No business-language copy exists for templates (DEC-128 deferred it to the first consumer). Precedent: `TEMAS` map keyed by `automatizacion` in `src/correo.ts:123`.
- Console projections (`AutomatizacionResumen`, `EjecucionListada`, `PlantillaResumen`) must not be reused: they expose `conexionId`, `codigoError`, raw `error`.
- Never call `GET /plantillas/:id` from the panel (returns `sql`; rule 1).
- Isolation test model: `src/aislamiento-panel.test.ts` (two tenants, ignored `X-Tenant-Id`).

## Gaps

- Template title/description (business copy).
- Cron to business frequency text.
- "Available" derivation (global templates minus tenant usage).
- Last execution per automation in one query.

## Open decisions (must be confirmed by the user and registered in `docs/01-decisiones.md` before implementation)

- D1 Status meaning: `activa`/`pausada` only (recommended) vs. also derived "con falla" (overlaps CH-22c).
- D2 "Available": templates with business copy and no active automation of the tenant (recommended); informational only, no filter by connection readiness.
- D3 Last run: latest terminal execution (excludes `en-curso`), shown with a neutral business text; empty copy when none.
- D4 Next run: API returns ISO UTC plus `zonaHoraria`; browser formats with `Intl` es-AR (as CH-21c / DEC-129). None for inactive.
- D5 Frequency text: map only the three DEC-129 patterns; omit otherwise.
- D6 API shape: single `GET /api/panel/automatizaciones` returning `{ activas, disponibles, zonaHoraria, truncado }` with an explicit allow-list projection; "Ajustar"/"Activar" actions omitted (belong to CH-23/CH-21c).
- D7 Loading / empty / error copy per `pantallas.md` P-02 plus a generic network error and 401 handling.

## Test plan outline

Two-tenant isolation (A sees only A, foreign `X-Tenant-Id` ignored), 401 without cookie, 401 expired, 409 deactivated tenant, response contains no `tenantId`, `conexionId`, `sql`, `codigoError`.
