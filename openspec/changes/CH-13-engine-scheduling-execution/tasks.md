# Tasks: CH-13 — Engine: Scheduling and Execution (X1, X2)

Derived from `design.md`. Verification tasks map to scenarios in
`specs/automation-scheduling/spec.md`, `specs/execution-log/spec.md`,
`specs/domain-data-model/spec.md`, `specs/tenant-isolation/spec.md`,
`specs/project-environment/spec.md`, and `specs/query-console/spec.md`.

**Route-naming note:** `design.md` originally named the deactivate route `/automatizaciones/:id/baja` (now aligned to `desactivar`)
(CH-06 precedent); `specs/automation-scheduling/spec.md` and DEC-79 both say "desactivar".
Tasks below use `/automatizaciones/:id/desactivar` as canonical, since the spec drives
`sdd-verify`. The `409 automatizacion-desactivada` response shape from design is kept.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,700–2,050 total including tests (schema+isolation+config+dep ~230, pure `automatizaciones.ts` ~280, create/list/get/desactivar routes ~380, planificador+server wiring ~420, ejecuciones route+T2 ~280, console ~330) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema+isolation+config+dep) → PR 2 (`automatizaciones.ts`, delivered as 2a + 2b) → PR 3 (automation routes, delivered as 3a + 3b) → PR 4 (planificador+wiring) → PR 5 (runs route+T2) → PR 6 (console) → PR 7 (checkpoint, verify, archive) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR 4 (planificador+wiring) is the largest single unit at ~420 lines; per design "Migration /
Rollout", if it goes over budget it splits into 4a (tick loop, due-check, `Reloj`, unit tests) and
4b (server wiring, `onClose`/`detener`, live-PG scheduler tests). Threat Matrix rows carried as RED
tests below: a new route without the header (3.1/5.1), `tenantId` in the body (3.1), tenant B
reaching A's automation/runs/connection (5.6/T2), a scheduler query outside any context (4.6), a
deactivated tenant or automation never running (4.4), driver/error text reaching `Ejecucion` only
as closed categories (2.3/4.7). The generic Shell/VCS/PR row is `N/A` per design and is omitted.
PR 7 has no production code: full-suite checkpoint, `sdd-verify`, `sdd-archive`, bitácora (mirrors
CH-12's verify-then-archive close).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema, isolation, config, `cron-parser` dependency | `ch13/1-esquema-aislamiento-config` (base `master`) | `npm test -- src/aislamiento.test.ts src/config.test.ts` | N/A — schema/config only, no scheduler yet | `DROP TABLE "Ejecucion"; DROP TABLE "Automatizacion"`; revert `MODELOS_AISLADOS` entries and `zonaHoraria` config |
| 2a | Pure `src/automatizaciones.ts`: cron validity and due-window (DEC-76, DEC-77) | `ch13/2a-cron-ventana` (base unit 1) | `npm test -- src/automatizaciones.test.ts` | N/A — pure functions, no database | Revert `85e4b87`; nothing consumes it yet |
| 2b | Pure `src/automatizaciones.ts`: close-of-run mapping (X2) | `ch13/2b-cierre-ejecucion` (base unit 2a) | `npm test -- src/automatizaciones.test.ts` | N/A — pure functions, no database | Revert `b6f7f42` and `52e1e8b`; nothing consumes it yet |
| 3a | Automation routes: create + `server.ts` registration (3.1–3.3, 3.7) | `ch13/3a-alta-automatizacion` (base unit 2b) | `npm test -- src/automatizaciones-rutas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert `src/automatizaciones-rutas.ts`/test and its `server.ts` registration |
| 3b | Automation routes: list, get, `desactivar` (3.4, 3.5, rest of 3.6, 3.8) | `ch13/3b-consulta-desactivar` (base unit 3a) | `npm test -- src/automatizaciones-rutas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert the list/get/`desactivar` handlers and their tests; the create route stays |
| 4 | Scheduler loop + server wiring (`src/planificador.ts`) | `ch13/4-planificador` (base unit 3; fallback `4a`/`4b`) | `npm test -- src/planificador.test.ts` | Fake `Reloj` + live PostgreSQL, skipped when unreachable | Remove the `iniciar()` call in `server.ts` and revert `src/planificador.ts`/test; routes stay correct unconsumed |
| 5 | Runs route (`GET .../ejecuciones`) + T2 sweep extension | `ch13/5-rutas-ejecuciones-t2` (base unit 4) | `npm test -- src/automatizaciones-rutas.test.ts src/aislamiento.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert the runs handler and T2 additions; prior units unaffected |
| 6 | Console "Automatizaciones" section | `ch13/6-consola` (base unit 5) | `npm test -- src/consola.test.ts` | Manual: load console, create/deactivate an automation, view runs | Revert `src/consola.ts`/test section; API stays usable without it |
| 7 | Full-suite checkpoint, verify report, archive, bitácora | `ch13/7-verify-archivo` (base unit 6) | `npm test` (full suite) | N/A — docs/verification only | Revert the archive move and bitácora entry |

## 1. Schema, Isolation, Config & Dependency (`prisma/schema.prisma`, migration, `src/aislamiento-prisma.ts`, `src/config.ts`, `.env.example`, `package.json`)

- [x] 1.1 Run `npm view cron-parser version` and confirm the installed/pinned API is `CronExpressionParser.parse(expr, { currentDate, tz }).next().toDate()`; pin the exact version (`5.10.1` per orchestrator note) in `package.json`, no caret (DEC-76 design resolution)
- [x] 1.2 Modify `prisma/schema.prisma`: add `model Automatizacion` (`tenantId`, `plantillaId`, `conexionId` FKs RESTRICT; `valores Json @default("{}")`; `cron String`; `activo Boolean @default(true)`; `creadaEn`; `@@index([tenantId])`) and `model Ejecucion` (`tenantId`, `automatizacionId` FKs; `estado`; `iniciadaEn`; `finalizadaEn`; `duracionMs`; `filas`; `corte`; `fase`; `error`; `codigoError`; `@@index([tenantId])`, `@@index([automatizacionId, iniciadaEn])`) (DEC-74; spec `domain-data-model` "Inspecting the schema after this change")
- [x] 1.3 Create `prisma/migrations/20260928000000_automatizacion_ejecucion/migration.sql`: additive `CREATE TABLE` for both, FKs, indexes
- [x] 1.4 RED extend `src/aislamiento.test.ts`: `Automatizacion` and `Ejecucion` reads/writes with no active tenant throw `ErrorSinTenantActivo` (spec `tenant-isolation` "Every Scoped Query Is Filtered by the Active Tenant")
- [x] 1.5 GREEN: modify `src/aislamiento-prisma.ts` — add `Automatizacion` and `Ejecucion` to `MODELOS_AISLADOS` — satisfies 1.4
- [x] 1.6 Modify `src/contexto-tenant.ts`: update the `conTenantActivo` doc comment noting the scheduler as a second production entry (design-level resolution under DEC-13/DEC-14, already registered in `docs/01-decisiones.md` — comment update only, no new decision)
- [x] 1.7 RED extend `src/config.test.ts`: `ZONA_HORARIA_AUTOMATIZACIONES` unset defaults to `UTC`; an invalid IANA zone (checked via `Intl.DateTimeFormat`) stops the process at boot (spec `project-environment` "Unset timezone falls back to the documented default")
- [x] 1.8 Implement `zonaHoraria` in `src/config.ts` — satisfies 1.7; add `ZONA_HORARIA_AUTOMATIZACIONES=UTC` placeholder to `.env.example` (spec "Inspecting the example file")
- [x] 1.9 Checkpoint: `npx prisma validate`; `npx tsc --noEmit` clean; `npm test -- src/aislamiento.test.ts src/config.test.ts` green

## 2. Pure Scheduling Module (`src/automatizaciones.ts`)

- [x] 2.1 RED `src/automatizaciones.test.ts`: `cronValido` accepts exactly 5 fields, rejects `@daily`/aliases/a seconds field/malformed input (spec `automation-scheduling` "Invalid cron expression rejected")
- [x] 2.2 RED extend: `estaVencida(cron, desde, hasta, zona)` — window edges (`<=` boundary), the `creadaEn` lower bound never fires before creation, and a timezone offset changes the computed next fire (spec "Next fire time follows the configured timezone")
- [x] 2.3 RED extend: `cierreDeResultado` maps every `ResultadoEjecucion` category (ok, gate refusal, `valores-invalidos`, execution failure, unexpected throw) to a closed category and a publishable `codigoError`, never a raw driver message or stack trace (spec `execution-log` "A failed run's error is sanitized"; Threat Matrix "Driver or error text reaching Ejecucion")
- [x] 2.4 Implement `cronValido`, `estaVencida`, `cierreDeResultado` in `src/automatizaciones.ts` (pure — no Fastify, no Prisma, no pg) — satisfies 2.1–2.3
- [x] 2.5 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/automatizaciones.test.ts` green

## 3. Automation Routes — Create, List, Get, Deactivate (`src/automatizaciones-rutas.ts`)

- [x] 3.1 RED `src/automatizaciones-rutas.test.ts`: `POST /automatizaciones` without `x-tenant-id` is `400 tenant-no-indicado`; strict AJV schema (`propertyNames`, no `tenantId` in body) rejects an extra `tenantId` field `400` (Threat Matrix "A new route called without the header", "tenantId in the body")
- [x] 3.2 RED extend: valid create persists `activo: true` with every declared parameter value validated like CH-11; a missing required parameter is `400` naming it; a `conexionId` belonging to another tenant is `404`, no row persists (spec "Creating an automation with valid values", "Parameter values validated like CH-11", "Connection must belong to the same tenant")
- [x] 3.3 RED extend: an invalid cron expression at create is `400` naming the schedule field (spec "Invalid cron expression rejected")
- [x] 3.4 RED extend: `GET /automatizaciones` lists own rows including deactivated ones; `GET /automatizaciones/:id` returns full fields; unknown id is `404` (spec "Deactivated automation is excluded from future runs but stays listed")
- [x] 3.5 RED extend: `POST /automatizaciones/:id/desactivar` sets `activo: false`, `200`; unknown id `404`; already-inactive `409 automatizacion-desactivada`; no route exists to reverse it (spec "Deactivating an automation")
- [x] 3.6 Implement `registerAutomatizacionRoutes` in `src/automatizaciones-rutas.ts`: strict AJV body, `prepararSentencia`-style parameter check against the referenced `Plantilla`, scoped `conexion.findUnique`, `cronValido` gate, `create`/`findMany`/`findUnique`/`update` — satisfies 3.1–3.5 (create done in unit 3a; list, get, `desactivar` done in unit 3b)
- [x] 3.7 Modify `src/server.ts`: register `registerAutomatizacionRoutes` after existing route registrations
- [x] 3.8 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/automatizaciones-rutas.test.ts` green

## 4. Scheduler Loop & Server Wiring (`src/planificador.ts`, `src/server.ts`)

- [ ] 4.1 RED `src/planificador.test.ts` (fake `Reloj`): `ejecutarTick` runs a due active automation exactly once per tick (spec `automation-scheduling` "Scheduler starts with the application")
- [ ] 4.2 RED extend: a deactivated tenant's due automation never runs; a deactivated automation on an active tenant never runs (spec "Deactivated tenant's automations never run", "Deactivated automation never runs"; Threat Matrix "A deactivated tenant or automation")
- [ ] 4.3 RED extend: a `Plantilla` entity with no passing saved validation blocks the run — no query dials the tenant connection, and the outcome records the ungated entity (spec "Missing or failing view validation blocks the run")
- [ ] 4.4 RED extend: the scheduler enters each tenant's context using only that tenant's own `Tenant` row; a query against a tenant-scoped model with no context entered throws `ErrorSinTenantActivo` (spec `tenant-isolation` "Scheduler tick enters a tenant's context from its own Tenant row", "A scheduler-run query outside any context fails closed"; Threat Matrix "A scheduler query outside any context")
- [ ] 4.5 RED extend: two due automations in one tick, one failing — the failing one is recorded failed and the sibling still completes; an unexpected throw closes as `error-interno`, loop continues (spec "One failing run does not block a sibling run")
- [ ] 4.6 RED extend: every outcome (success, gate refusal, execution failure, unexpected throw) writes exactly one `Ejecucion` with start/end/duration/row-count/status, and a failure stores only a classified `error`/`codigoError`, never raw driver text (spec `execution-log` "A successful run writes a complete row", "A validation-gate refusal is recorded", "An execution failure is recorded", "A run's own result data is absent from its log row")
- [ ] 4.7 RED extend: `detener()` clears the pending timer and awaits an in-flight tick before resolving
- [ ] 4.8 Implement `Reloj`, `crearPlanificador` (`iniciar`, `detener`, `ejecutarTick`) in `src/planificador.ts`: self-rescheduling `setTimeout` aligned to the next whole minute + 1s, window `(previous tick, now]`, sequential tenant-by-tenant/automation-by-automation, pipeline `evaluarVistas → componerSentencia → prepararSentencia → destinoDeConexion → ejecutarConsulta` with `limite = maxFilasPorConsulta`, `desplazamiento = 0` — satisfies 4.1–4.7
- [ ] 4.9 Modify `src/server.ts`: build `crearPlanificador` next to `prisma`; `app.addHook('onClose', detener)`; `iniciar()` inside `listen().then` (DEC-75)
- [ ] 4.10 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/planificador.test.ts` green
- [ ] 4.11 Contingency: if this phase exceeds the 400-line budget, split at the RED/GREEN boundary before 4.6 into `4a` (4.1–4.4: tick loop, due-check, tenant-context isolation) and `4b` (4.5–4.10: failure isolation, `Ejecucion` writes, server wiring), per design "Migration / Rollout"

## 5. Runs Route & T2 Sweep Extension (`src/automatizaciones-rutas.ts`, `src/aislamiento.test.ts`)

- [ ] 5.1 RED extend `src/automatizaciones-rutas.test.ts`: `GET /automatizaciones/:id/ejecuciones` lists own automation's runs newest-first; naming another tenant's automation is `404`, no run data returned (spec `execution-log` "Listing runs for one's own automation", "Naming another tenant's automation")
- [ ] 5.2 Implement the `GET /automatizaciones/:id/ejecuciones` handler in `src/automatizaciones-rutas.ts`: scoped `automatizacion.findUnique` [+tenantId] → `ejecucion.findMany` ordered by `iniciadaEn desc` — satisfies 5.1
- [ ] 5.3 RED/GREEN extend `src/aislamiento.test.ts` (T2): full two-tenant sweep now includes create/list/get/desactivar automation routes and the runs-listing route; tenant B reaching A's automation, runs, or connection is `404`, nothing leaks (spec `tenant-isolation` "Full two-tenant route sweep"; Threat Matrix "Tenant B reaching A's automation, runs, or connection")
- [ ] 5.4 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/automatizaciones-rutas.test.ts src/aislamiento.test.ts` green

## 6. Minimal Console (`src/consola.ts`)

- [ ] 6.1 RED extend `src/consola.test.ts`: the automations view lists plantilla, connection, schedule, and `activo` state for the active tenant; a create control reuses `controlDeValor` for parameter values and submits scoped to the active tenant; on success the new row appears in the list (spec `query-console` "Viewing the automations list", "Creating an automation from the console")
- [ ] 6.2 RED extend: a deactivate control submits the deactivate action and the list reflects `activo: false`, with no edit/delete control present (spec "Deactivating from the console")
- [ ] 6.3 RED extend: a runs view shows start, end, duration, row count, status, and a classified error for failed runs (spec "Viewing an automation's runs")
- [ ] 6.4 RED extend: switching the active-tenant selector refreshes the automations view to the newly selected tenant, every call going through `pedir()` (spec "Switching tenant updates the automations view"; T4, DEC-15)
- [ ] 6.5 Implement the "Automatizaciones" section in `src/consola.ts`: create form, list table, deactivate action, runs table — satisfies 6.1–6.4
- [ ] 6.6 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/consola.test.ts` green

## 7. Full-Suite Checkpoint, Verify & Archive

- [ ] 7.1 Full-suite checkpoint: `npm test` green; `npx tsc --noEmit` clean; `npx prisma validate` clean
- [ ] 7.2 Run `sdd-verify` against `specs/automation-scheduling/spec.md`, `specs/execution-log/spec.md`, `specs/domain-data-model/spec.md`, `specs/tenant-isolation/spec.md`, `specs/project-environment/spec.md`, `specs/query-console/spec.md`; produce the verify report
- [ ] 7.3 Run `sdd-archive`: merge each delta spec into its main spec; move `openspec/changes/CH-13-engine-scheduling-execution/` to `openspec/changes/archive/`; add `docs/bitacora/CH-13-motor-planificacion-y-ejecucion.md` (mirroring CH-12's bitácora) and record the change in `docs/01-decisiones.md`'s bitácora

## Key Success-Criteria Traceability

- A due active automation runs unattended at its cron time in the configured timezone → Phase 2 (2.2), Phase 4 (4.1, 4.8)
- Every run writes one `Ejecucion` with all X2 fields → Phase 4 (4.6), Phase 2 (2.3)
- A deactivated automation never runs again; its runs remain listable → Phase 3 (3.5), Phase 4 (4.2), Phase 5 (5.1)
- T2 green across all new routes → Phase 5 (5.3)
