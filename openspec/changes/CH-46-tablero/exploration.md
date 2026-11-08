# Exploration: CH-46 — Tenant dashboard

Status: **decided** (2026-11-08): 1(a), 2(a), 3(a), the recommended options, chosen by the user; registered as DEC-199 (PR #239). No research phase, chosen by the user. Store: openspec. Story R2h. Depends on CH-45, merged. CH-48 depends on this change.

DEC-183 constraints that bind this change (`docs/01-decisiones.md:3430`):
- "P1 elige, por tenant, qué reportes ve el cliente y en qué orden. El tablero se guarda como configuración del tenant, sin filas."
- Each dashboard view runs live, with no cache (DEC-93), so a dashboard with many reports is slow.
- The tenant comes only from the panel session (DEC-135, rule 2).

DEC-198 leaves to this change the rule for a report already on a dashboard (`docs/01-decisiones.md:4203`). The CH-45 exploration notes that a tenant can have several connections, so the dashboard must decide which one runs each report.

R2h (`docs/mapa-historias.md:165`): "Como P1, quiero armar el tablero de un tenant. Elegir qué reportes ve el cliente y en qué orden."

Out of scope: rendering in the panel, live execution and the period (CH-48), and Chart.js (CH-47).

## What exists (verified)

| Piece | State |
|---|---|
| Connections | `Conexion` (`prisma/schema.prisma:41-62`) only has `@@index([tenantId])`, with no unique constraint and no default flag. Every consumer passes `conexionId` explicitly: automations (`automatizaciones-rutas.ts:388-394`), report tests and console pickers. The panel never reads `Conexion`. |
| Freshness | Freshness is per tenant: `Tenant.replicaActualizadaEn` and `ventanaDesactualizacionMinutos` (`schema.prisma:23-27`). |
| Report gate | `ejecutarSobreVistas` checks that the connection is the tenant's (404), then the DEC-71 gate on that connection's views (409). |
| Tenant-scoped models | `VinculoTelegram` (`tenantId @unique`) and `Agente` (`@unique`, `onDelete: Restrict`). `MODELOS_AISLADOS` (`aislamiento-prisma.ts:55-74`) is closed, and the model list is pinned by `aislamiento.test.ts:1323-1348`. |
| Cross-tenant facts | DEC-191 adds typed methods on the raw client inside the extension (`plantillaEnUso`, `reemplazarPlantillaLibre` with `FOR UPDATE`). They return a boolean or a row, never counts or tenant ids, and reach a global registrar as a port built in `rutas.ts:94-97`. The reports registrar gets only its delegate (`rutas.ts:105`). |
| Report edit | `PUT /reportes/:id` (`reportes-rutas.ts:287-306`) has no use check. Templates in use answer 409 `plantilla-en-uso`, and the console offers «Duplicar y editar» (`consola.ts:5389-5396`, `:5838`). |
| Availability precedent | "Template Availability Is Advisory (DEC-127)" in `openspec/specs/query-console/spec.md:747`. |
| Order storage | No model has an `orden` column. Ordered lists are JSON or arrays: `Reporte.columnas`, `periodo.dias`, `Automatizacion.destinatarios String[]`. |
| Console | Tenant screens follow one pattern: a section, `cargarPantallaX`, an entry in `mostrarPantalla` and `cambiarTenant`, «Elegí un tenant…», `pedir` plus `manejarFalloDeTenant`, and `crearDialogo`. There is no ordering control (up/down or drag) anywhere in the console or the panel. |
| Panel | A single page. `RUTAS_PANEL_PUBLICAS` holds exact rows, and every handler runs inside `conTenantActivo` from the session. No reports yet. |
| Map | `docs/02-mapa-de-changes.md:21` still says the next decision is DEC-193; it is stale. |

### Specs affected

- New capability: `tenant-dashboard`.
- `report-catalog` (the in-use rule), `query-console` (screen and nav), `tenant-isolation` (scoped model and the new audited read), `domain-data-model`.

## Shape that fits

- **Routes.** `GET /tablero` and `PUT /tablero`, tenant-scoped by the console header like `/usuarios`. The body replaces the whole dashboard. No panel route: CH-48 adds `GET /api/panel/tablero`.
- **Console.** A «Tablero del cliente» screen in "Puesta en marcha", after `#usuarios`. It has a connection select, the ordered list with «Subir», «Bajar» and «Quitar», an «Agregar reporte» select over the catalog, and «Guardar». This is the console's first ordering control, built from buttons.
- **Rule 2.** The tenant comes from the header in the console and from the session in CH-48. The connection is checked against the active tenant (404). A two-tenant test proves that one tenant's dashboard never names another's connection or shows up for it.

### Defaults proposed for DEC-199, following precedent

These do not go to a separate question. They are recorded in the decision and the user can overrule them.

- **Storage.** One tenant-scoped model `Tablero`: `tenantId @unique`, `conexionId` with a relation (when decision 1 is (a)), and `reportes String[]` holding the ordered ids. It joins `MODELOS_AISLADOS`, like `VinculoTelegram`. The array keeps the order without a position column, and reports are never deleted (DEC-68), so an id cannot dangle.
- **Cap.** At most 8 reports per dashboard, as a constant in code, because every view runs them all live (DEC-183, "Se resigna").
- **No repeats.** A report appears at most once on a dashboard.
- **Empty dashboard.** Saving an empty list is allowed, and means the client sees no reports.

## Decisions (chosen by the user on 2026-11-08: 1(a), 2(a), 3(a); registered as DEC-199 (PR #239))

1. **Which connection runs the reports.** (a) One connection per dashboard, chosen with it. (b) One connection per report on the dashboard. (c) A "main connection" flag on `Conexion`, used by the dashboard and available to other features. *Recommended: (a). A tenant normally has one replica, freshness is already per tenant, and it is one select. (b) is more flexible, but complicates the form and the CH-48 freshness. (c) adds a tenant-wide concept that nothing else uses yet.*
2. **A report on a dashboard (the rule DEC-198 deferred).** (a) As templates (DEC-191): `PUT /reportes/:id` answers 409 `reporte-en-uso` when the report is on any dashboard, and the console offers «Duplicar y editar». In use is read as a boolean across tenants, with the same pattern. (b) Editing stays free, and the console only warns that the report is on dashboards. *Recommended: (a). It is the principle the user chose for templates: editing a global artifact must not change what other tenants already see (DEC-182, DEC-191). The cost is that a fix needs a copy and a swap on each dashboard. (b) propagates fixes at once, at the risk of breaking every dashboard with one edit.*
3. **Reports whose views are not approved on the chosen connection.** (a) Advisory: the screen shows which reports lack approved views, and saving is allowed. CH-48 shows the report's error state. (b) Blocking: `PUT /tablero` answers 409 `vista-canonica-no-aprobada`, naming the reports. *Recommended: (a). It follows "Template Availability Is Advisory (DEC-127)" and lets P1 prepare a dashboard before the mapping is done. A view can also stop being valid after the save, so CH-48 needs the error state anyway. (b) protects the client from a broken report on day one, at the cost of ordering the onboarding.*

## Risks

- **Size.** About 1,500 to 1,800 lines with tests and specs, judging by CH-45's catalog screen. With decision 2(a), add the in-use port and its tests. Under the single-PR strategy, a `size:exception` must be recorded before apply.
- **First ordering control.** The design skill has no ordering pattern. It must be added to the guidelines before the markup.
- **Live cost.** The cap of 8 limits it, but CH-48 still runs up to 8 queries per view against the replica.

## Ready for proposal

Yes: DEC-199 is registered in `docs/01-decisiones.md` (PR #239). No research phase: everything is internal to the repository.
