# Tasks: CH-46 — Tenant dashboard

Inputs: proposal.md, the five specs under specs/, design.md.

DEC-199 goes on `v2/dec-199` from `master`, in its own PR (#239), before the code (AGENTS.md). The code goes on a `ch46/` branch from `master` after #239 merges.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,700, without the planning artifacts |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR with `size:exception`. Units 1 and 2 stay as commit boundaries |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Delivery: one PR with `size:exception`, chosen by the user on 2026-11-08 after this forecast.

### Suggested Work Units

| Unit | Goal | Commit boundary | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Model, isolation, dashboard routes and the in-use rule, with their tests | Commit 1 | `npx tsx --test src/tablero/*.test.ts src/reportes/reportes-rutas.test.ts src/aislamiento/*.test.ts` with the `TEST_DB_*` variables | `npm run test:db` on port 5434 | The migration recipe plus reverting `src/tablero/`, the extension methods and the wiring. Reports become editable again |
| 2 | The Tablero screen, the Reportes changes, the guides and the map | Commit 2 | `npx tsx --test src/consola/consola.test.ts` | N/A: the console tests use a fake DOM, and the screen calls only the routes of unit 1 | Reverting `consola.ts`, its tests and the docs. The API stays |

## 0. Decision
- [x] 0.1 DEC-199 in `docs/01-decisiones.md` on `v2/dec-199`, committed before any code, with the map numbering line fixed. PR #239.

## 1. Model
- [x] 1.1 `prisma/schema.prisma`: the `Tablero` model with the CH-46 comment, plus `Tenant.tablero` and `Conexion.tableros` (design §1).
- [x] 1.2 Migration `20261108000000_tablero`, with `ON DELETE RESTRICT` on both keys and the rollback in its header, in the style of `prisma/migrations/20261105000000_vinculo_telegram/migration.sql` (read-only). Regenerate the Prisma client.

## 2. Isolation
- [x] 2.1 `src/aislamiento/aislamiento-prisma.ts`: `Tablero` in `MODELOS_AISLADOS`, and the `tablero` key with `reporteEnUso` and `reemplazarReporteLibre` (design §2).
- [x] 2.2 `src/aislamiento/aislamiento.test.ts`:
  - `Tablero` in the pinned model list;
  - scoped reads and writes, with a create taking the tenant from the context;
  - the two unscoped methods return only a boolean or the outcome.

## 3. Dashboard routes
- [x] 3.1 `src/tablero/tablero.ts`: `TOPE_REPORTES_TABLERO`, `tableroSchema` and `pendientesDe` (design §3).
- [x] 3.2 `src/tablero/tablero-rutas.ts`: `GET /tablero` and `PUT /tablero`. The `PUT` runs one transaction with `FOR KEY SHARE` on the named reports, the `desconocidos` check, and find then update or create. A unique-constraint race gets one retry.
- [x] 3.3 `src/app/rutas.ts`: register them with the scoped client, beside `/usuarios`.
- [x] 3.4 `src/tablero/tablero.test.ts`: 9 ids, repeats, an unknown key, and `pendientesDe`.
- [x] 3.5 `src/tablero/tablero-rutas.test.ts`:
  - no dashboard;
  - save and read in order;
  - the empty list;
  - another tenant's connection gives 404 and nothing is written;
  - unknown ids give 400 `desconocidos` and nothing is written;
  - pending views do not block;
  - two tenants stay isolated;
  - reading writes no audit row and dials nothing;
  - no tenant header gives 400 `tenant-no-indicado`.
- [x] 3.6 `src/app/rutas.test.ts` and `src/aislamiento/contexto-tenant.test.ts`: `/tablero` is under the operator guard and is not exempt.

## 4. Report in use
- [x] 4.1 `src/reportes/reportes-rutas.ts`: the `UsoDeReportes` port, `enUso` on `GET /reportes/:id`, and `PUT` through `reemplazarSiLibre`, giving 404, 409 `reporte-en-uso` or 200, with the body checks first.
- [x] 4.2 `src/app/rutas.ts`: build the port from `prisma.tablero.reporteEnUso` and `reemplazarReporteLibre`.
- [x] 4.3 `src/reportes/reportes-rutas.test.ts`:
  - `enUso` false, then true;
  - 409 for a report on another tenant's dashboard, with the report unchanged;
  - 200 after it leaves every dashboard;
  - 400 before 409;
  - a dashboard save and a report replace started together end consistent: either the report is on the dashboard and unchanged, or it was replaced before being added.

## 5. Backend verification
- [x] 5.1 `npx tsc -p tsconfig.json --noEmit` and the focused command of unit 1.

## 6. Console
- [x] 6.1 Design skill first: screen C-14 «Tablero del cliente» and the ordering pattern in `.claude/skills/zerodashboard-design/guidelines/consola.md`, and the same in `.agents/skills/zerodashboard-design/guidelines/`. Add a line to `pantallas.md` if the console screens are listed there.
- [x] 6.2 `src/consola/consola.ts`, markup: `#tablero` after `#usuarios`, and the `pantalla-tablero` section with the connection select, the list, «Agregar reporte», «Agregar» and «Guardar». No new `zd-*` token in the script.
- [x] 6.3 `src/consola/consola.ts`, script block `// ---- CH-46 (DEC-199)`:
  - load the three reads, with a stale-answer token;
  - rows with «Subir», «Bajar» and «Quitar»;
  - the cap of 8;
  - the «Guardar» state;
  - the pending lines and their clearing when the connection changes;
  - the empty and no-tenant texts;
  - `PANTALLAS`, `mostrarPantalla` and `cambiarTenant`.
- [x] 6.4 `src/consola/consola.ts`, Reportes:
  - `enUso` toggles «Editar», «Duplicar y editar» and the notice;
  - the pop-up's duplicate mode, which adds «(copia)» and saves with `POST`;
  - the 409 `reporte-en-uso` handling.
- [x] 6.5 `src/consola/consola.test.ts`:
  - `IDS`, `IDS_OCULTOS` and both `PANTALLAS` lists;
  - the nav order;
  - every scenario of "Tenant Dashboard Screen";
  - the Reportes in-use scenarios and the duplicate mode;
  - markup in a title shown as text.

## 7. Docs
- [x] 7.1 `docs/guia/09-reportes.md`: a section on the dashboard (connection, order, cap, pending views) and on why a report in use is duplicated rather than edited.
- [x] 7.2 `docs/02-mapa-de-changes.md`: the CH-46 row with DEC-199 and the PR number.

## 8. Verification
- [x] 8.1 `npm run build`, `npm run build:agente`, `npx tsc -p tsconfig.json --noEmit` and `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`.
- [x] 8.2 `npx prisma migrate status` against the test database: the new migration is applied and the schema has no drift.
