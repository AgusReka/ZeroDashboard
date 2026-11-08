# Tasks: CH-45 — Reports: model, global catalog and console screen

Inputs: proposal.md, the five specs under specs/, design.md.

DEC-198 goes on `v2/dec-198` from `master`, in its own PR (#236), before the code (AGENTS.md). The code goes on a `ch45/` branch from `master` after #236 merges.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,950, without the planning artifacts |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR with `size:exception`. Units 1 and 2 stay as commit boundaries |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Delivery: one PR with `size:exception`, chosen by the user on 2026-11-07 after this forecast.

### Suggested Work Units

| Unit | Goal | Commit boundary | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Model, rules, catalog and test routes, extraction, audit and isolation, with their tests | Commit 1 | `npx tsx --test src/reportes/*.test.ts src/plantillas/plantilla-prueba.test.ts` with the `TEST_DB_*` variables | `npm run test:db` on port 5434 | The migration recipe plus reverting `src/reportes/`, the extraction and the wiring. The console does not depend on it yet |
| 2 | The Reportes screen, the audit labels, the guides and the map | Commit 2 | `npx tsx --test src/consola/consola.test.ts` | N/A: the console tests use a fake DOM, and the screen calls only the routes of unit 1 | Reverting `consola.ts`, its tests and the docs. The API stays |

## 0. Decision
- [x] 0.1 DEC-198 in `docs/01-decisiones.md` on `v2/dec-198`, committed before any code. PR #236.

## 1. Model
- [x] 1.1 `prisma/schema.prisma`: the `Reporte` model and `RegistroEjecucion.reporteId`, with the CH-45 comment (design §1).
- [x] 1.2 Migration `20261107000000_reportes`, with the rollback in its header. Follow the id column of `prisma/migrations/20260927100000_plantilla/migration.sql` (read-only), then regenerate the Prisma client.

## 2. Pure rules
- [x] 2.1 `src/reportes/reportes.ts`: `VISUALIZACIONES`, `TOPE_FILAS`, the role types, `rechazoDeColumnas`, `declaracionDelPeriodo`, `fechaDelPeriodo`, `faltantesEn` and `leerReporte` (design §2).
- [x] 2.2 `src/reportes/reportes.test.ts`:
  - every role shape per type, and the repeated column;
  - the derived declaration with and without a period;
  - `fechaDelPeriodo` when the zone's day differs from UTC's, and across a month boundary;
  - `faltantesEn` in assignment order;
  - `leerReporte` throwing on corrupt JSON;
  - the effective cap against a lower `maxFilasPorConsulta`.

## 3. Shared run step
- [x] 3.1 `src/ejecucion/ejecucion-sobre-vistas.ts`: `ejecutarSobreVistas`, moved from `src/plantillas/plantilla-prueba.ts`, with the same order and bodies, returning `{ codigo, cuerpo }` (design §3).
- [x] 3.2 `src/plantillas/plantilla-prueba.ts`: both routes call it and send its answer, passing `origen` `plantilla-prueba`, `reporteId` null and the existing `warn` message.
- [x] 3.3 Run `src/plantillas/plantilla-prueba.test.ts` unchanged. It must pass before going on.

## 4. Audit
- [x] 4.1 `src/auditoria/auditoria.ts`: `reporte-prueba` in `OrigenEjecucion`, an optional `reporteId` in `ContextoAuditado` written as `?? null`, and `reporteId` in the `GET /auditoria` select.
- [x] 4.2 `src/auditoria/auditoria.test.ts` and `src/auditoria/auditoria-registro.test.ts`: the new origin, `reporteId` written, null when omitted, and older rows read null.

## 5. Catalog routes
- [x] 5.1 `src/reportes/reportes-rutas.ts`: `registroReporteSchema`, `rechazoDeReporte` in the seven-step order, and `GET /reportes`, `GET /reportes/:id`, `POST /reportes` and `PUT /reportes/:id` over the `reporte` delegate (design §4).
- [x] 5.2 `src/aislamiento/contexto-tenant.ts`: `REPORTES_EXENTOS`, with the four exact rows, checked beside `PLANTILLAS_EXENTAS`.
- [x] 5.3 `src/app/rutas.ts`: register the catalog with `prisma.reporte` alone, beside the template catalog.
- [x] 5.4 `src/reportes/reportes-rutas.test.ts`:
  - create, list (with `truncado`), get and replace in place, with no tenant header;
  - one case for each refusal of the check order, including `terminos`, `/periodo/dias`, `/columnas`, `faltantes`, `/columnasPrueba` and the `sin-declarar` and `sin-usar` problems;
  - 404 `reporte-no-encontrado`;
  - `DELETE` answers 404 and the report remains;
  - 401 without an operator session.
- [x] 5.5 `src/aislamiento/contexto-tenant.test.ts` and `src/aislamiento/aislamiento.test.ts`: the four exempt rows, the look-alikes staying scoped, and `Reporte` absent from `MODELOS_AISLADOS`.

## 6. Test routes
- [x] 6.1 `src/reportes/reporte-prueba.ts`: `POST /reportes/prueba` and `POST /reportes/:id/prueba`, covering the `dias` check, the computed date, the effective cap, the call to `ejecutarSobreVistas` with `reporte-prueba`, and `periodo` and `faltantes` on a 200 `ok` (design §4).
- [x] 6.2 `src/app/rutas.ts`: register them scoped, with `zonaHoraria`, `topeFilas` and the agent registry.
- [x] 6.3 `src/reportes/reporte-prueba.test.ts`, with two tenants:
  - one report on each tenant's connection;
  - another tenant's connection gives 404 and nothing is dialed;
  - 409 `vista-canonica-no-aprobada` names the entities;
  - an undeclared `dias` gives 400 and nothing is dialed;
  - `dias` on a report with no period gives 400;
  - the default period applies;
  - the bound date;
  - 20 rows and `corte` for bars;
  - `faltantes` after a renamed column;
  - the unsaved test with no columns;
  - a write statement gives `no-es-lectura`;
  - one audit row with `reporteId` and without the date, and nothing written on each refusal.
- [x] 6.4 `src/app/rutas.test.ts`: the six new routes are under the operator guard.

## 7. Console
- [x] 7.1 Design skill first: the Reportes screen and its pop-up in `.claude/skills/zerodashboard-design/guidelines/consola.md` and `guidelines/pantallas.md`, and the same in `.agents/skills/zerodashboard-design/guidelines/`.
- [x] 7.2 `src/consola/consola.ts`, markup: `#reportes` in "Global" after `#plantillas`, the `pantalla-reportes` section with the list, the side panel and its test block, and the pop-up with the column rows. No new `zd-*` token in the script.
- [x] 7.3 `src/consola/consola.ts`, script block `// ---- CH-45 (DEC-183, DEC-198)`:
  - the list and the side panel;
  - the side-panel test, showing the assigned columns under their titles, the date used, `corte` and `faltantes`;
  - the pop-up, with `ultimaPruebaReporte`, its fingerprint and the «Guardar» reasons;
  - the column selects filled from the last test, and the table rows from 1 to 10;
  - `columnasPrueba` in the save;
  - `PANTALLAS` and `mostrarPantalla`.
- [x] 7.4 `src/consola/consola.ts`, audit: «Prueba de reporte» in `ORIGENES_AUDITORIA`, and «Reporte <id>» in the Consulta cell when `reporteId` is set.
- [x] 7.5 `src/consola/consola.test.ts`:
  - `IDS`, `IDS_OCULTOS` and both `PANTALLAS` lists;
  - nav order;
  - the side panel and every test-block state;
  - the pop-up fingerprint and its three «Guardar» reasons;
  - changing the visualization keeps the rows whose role exists;
  - the table limit of 10;
  - the audit labels for a saved and an unsaved test;
  - markup in a title shown as text.

## 8. Docs
- [x] 8.1 `docs/guia/09-reportes.md`: how to write a report over `v_*`, the period, the columns by role, the caps, testing, and the limit that nothing stops reading a replica table. Link it from `docs/guia/README.md`.
- [x] 8.2 `docs/02-mapa-de-changes.md`: the CH-45 row with DEC-198 and the PR numbers.

## 9. Verification
- [x] 9.1 `npm run build`, `npm run build:agente`, `npx tsc -p tsconfig.json --noEmit` and `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`.
- [x] 9.2 `npx prisma migrate status` against the test database: the new migration is applied and the schema has no drift.
