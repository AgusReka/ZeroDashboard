# Exploration: CH-30e — Audit and onboarding-times screens (2026-10-16)

Status: **decided** (2026-10-16): option 1, registered as DEC-178, cut into CH-30e1 (Auditoría) and CH-30e2 (Tiempos de alta). Store: openspec. Stories: A5, G1. Umbrella: `openspec/changes/archive/2026-10-16-CH-30-rediseno-de-la-consola/`. **Closed** 2026-10-16: both cuts archived.

## Why

DEC-165 put "Tiempos de alta" (Puesta en marcha) and "Auditoría" (Trabajo diario) in the console navigation. They are the last two screens of CH-30 (DEC-166). The audit of 2026-10-13 (F3) flagged the asymmetry: Auditoría has a route, Tiempos de alta does not.

## What exists (verified)

| Piece | State |
|---|---|
| `GET /auditoria` (`src/auditoria.ts`, DEC-163) | Header tenant's rows through the isolated client, newest first, filters `desde`, `hasta` (date-only = whole UTC day) and `resultado` (`ok`/`fallo`), capped at `LIMITE_LISTADO` with `truncado`. Columns: `id`, `creadoEn`, `tenantNombre`, `operadorId`, `operadorNombre` (CH-29), `origen`, `conexionId`, `consultaGuardadaId/Version/Nombre`, `plantillaId`, `sql`, `resultado`, `fase`, `categoria`, `codigo`, `filas`, `duracionMs`. No write or delete route (DEC-162). |
| Console | No audit or times section in `src/consola.ts`. |
| `scripts/marcas-alta.sql` (CH-15) | One SELECT, one row per `Conexion`, all tenants including deactivated ones, no parameter. Marks per DEC-89: `alta_inicio`, `conexion_registrada`, `mapeo_inicio/fin`, `validacion_ultima/estado`, `automatizacion_creada`, `primera_ejecucion` (+ estado, fase), `primera_ejecucion_ok`. Run by hand outside the app; a static test asserts no `src/` module references it. |
| Decisions on G1 | DEC-87: SQL script, **"sin ruta, sin panel de consola"**; it gave up in-app visibility on purpose. DEC-90: no tenant parameter, bypasses tenant isolation as a P4 research tool. DEC-88: the connection mark is the registration, not a successful test. DEC-119 extends the pattern for agents. |
| Design guide | C-12 Auditoría: date-time, tenant, connection, query (name or "ad hoc"), SQL summary (mono, truncated), rows, duration, result, operator; read-only, filters by date and result. C-07 Tiempos de alta: one stage list with `KeyValueList`, unreached stage "—" with a neutral "Pendiente" badge. The guide labels C-07 "API", which is wrong: there is no route. Its stage "conexión probada" does not exist (DEC-88). |

## Decision needed (not mine to take)

**Tiempos de alta has no data source the console may call.** DEC-87 rules out a route and a console panel; DEC-165 later put the screen in the navigation. One of them has to be amended.

1. **New read-only route for the active tenant** (e.g. `GET /tiempos-alta`), through the isolated client, returning the DEC-89 marks per connection of the header tenant; the screen renders C-07 from it. The script stays as the cross-tenant P4 tool. Amends DEC-87 (route and panel) for the active tenant only; DEC-90 stays for the script. Cost: the marks get a second implementation that can drift from the SQL; mitigated by one test running both on the same fixtures. Needs its own cut (route + screen).
2. **Drop the screen.** Tiempos de alta leaves the navigation (amends DEC-165) and stays a script, as DEC-87 intended. CH-30e is Auditoría only, and CH-30 closes with it.
3. **Screen built from existing routes** (tenant, connections, mapping validation, automations and their runs), no new route. Rejected as a recommendation: many requests per view, the mark logic moves into the browser script, and `Ejecucion` per connection is not exposed in one call.

Recommendation: (1), because DEC-165 is the later, explicit product choice and the stage list is what P1 needs while onboarding a tenant.

## Cuts and size

Auditoría does not depend on the decision. Estimated (tests × 1.7):

| Cut | Content | Code | Tests | Total |
|---|---|---|---|---|
| CH-30e1 | Auditoría screen over `GET /auditoria`: nav item, filters, table, truncated notice, empty and error states | ~160 | ~150 | ~310 |
| CH-30e2 (if 1) | `GET /tiempos-alta` + Tiempos de alta screen | ~180 | ~220 | ~400 |

One PR for both would be ~710 lines: over the 400 budget, so the change is cut in two, each one PR.

## Risks

- Ids are a contract (DEC-164) and guard G3' forbids `zd-*` classes in the script; new ids go in `IDS`.
- Audit `sql` can be long: the table shows a truncated summary; the full text needs a detail view (the guide does not define one).
- Option 1 is the first console data source that duplicates a versioned research script.
