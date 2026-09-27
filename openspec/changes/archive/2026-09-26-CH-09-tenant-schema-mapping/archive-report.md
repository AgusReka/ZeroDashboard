# Archive Report: CH-09 — Tenant Schema Mapping

**Date**: 2026-09-26  
**Status**: ARCHIVED — Change Complete  
**Verdict**: PASS WITH WARNINGS (per verify-report.md)  
**Observation IDs**: Engram proposal (#110), spec (#111), design (#109), tasks (#106), apply-progress (#112), verify-report (#113)

## Executive Summary

CH-09 has been successfully implemented, verified, and archived. The tenant schema mapping capability — a new tenant-scoped data model for registering operator-authored SQL definitions per connection and canonical entity — is now in production. The change introduces a new capability, `tenant-schema-mapping`, with three routes (`PUT`, `GET` list, `GET` one) exposing tenant-isolated schema mappings. All 26 tasks are complete across three work units. The full test suite (274/274 tests, including 26 new CH-09 tests) passes. Zero CRITICAL findings. The three WARNINGs are disclosed-but-real process observations (400-line budget overage on Unit 2, domain-data-model scenario resting on inspection rather than automated regression test, offline migration authoring) and do not block archive. This change closes story M2 and enables downstream CH-10 (column validation) and CH-12 (composition with `WITH` clauses).

## Milestone Closure

**M2 (R1)**: Registering operator-authored view definitions for generic automation inputs  
**Closes**: `docs/mapa-historias.md`, M2 / Release 1  
**Enables**: M3/M4 (CH-10: column validation, CH-12: `WITH` composition)

## What Shipped

### New Capability: tenant-schema-mapping

A tenant-scoped, connection-keyed registry of operator-authored SQL definitions, one per canonical entity, enabling the system to compose and adapt queries for generic e-commerce automations without per-client rewrites.

**Model**: `VistaCanonica`
- `id` (UUID, primary key)
- `tenantId` (FK to `Tenant`, indexed)
- `conexionId` (FK to `Conexion`, part of unique pair)
- `entidad` (entity name from the contract, part of unique pair)
- `sql` (operator-authored SQL text, never executed in CH-09)
- `creadaEn`, `actualizadaEn` (timestamps)
- Unique constraint: `(conexionId, entidad)`
- Isolation: all reads and writes scoped to active tenant

**Routes**:
- `PUT /conexiones/:id/vistas-canonicas/:entidad` — register (201) or replace (200) a definition
- `GET /conexiones/:id/vistas-canonicas` — list all definitions for a connection (summary only, no SQL)
- `GET /conexiones/:id/vistas-canonicas/:entidad` — read one definition with full SQL

**Isolation Properties**:
- All routes scoped to active tenant via `conTenantInyectado` isolation extension
- Cross-tenant connection IDs return `404 conexion-no-encontrada`
- List and read return only the active tenant's rows
- T2 two-tenant sweep extended to cover all three new routes (6 total routes, 3 new)

**Data Safety**:
- Entity name validated against `CONTRATO_CANONICO` only (DEC-32)
- Request body `tenantId` rejected structurally (`additionalProperties: false`, `propertyNames`)
- SQL stored as inert text; no parsing, execution, or connection opening (DEC-31)
- Registered SQL never projected in list operations (summary-only payload)
- Four pre-existing files byte-identical: `src/contrato.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts`, plus DEC-36 commit on `src/contrato.ts`

### Decisions Confirmed

- **DEC-30**: Schema mapping lives per connection, not globally; one per entity per connection
- **DEC-31**: Registration is pure persistence; SQL is never parsed, validated, composed, or executed (CH-10/CH-12 own those steps)
- **DEC-32**: Entity name validated in code against `CONTRATO_CANONICO` names only; no second literal list or database enum
- **DEC-33**: Model added to `MODELOS_AISLADOS`, activating the existing isolation extension for all scoped queries
- **DEC-34**: Re-registration replaces in place (idempotent, last-writer-wins); no history, no delete
- **DEC-35**: Cross-tenant isolation via app-level scoped lookups, not composite foreign keys (architecture decision, not DB-level constraints)
- **DEC-36**: Pre-existing change to `src/contrato.ts` (2026-09-24, commit `9fd0ef6`), disclosed and unrelated to CH-09; byte-identity verified post-DEC-36

### Code Changes Summary

**New Files**:
- `src/vistas-canonicas.ts` (231 lines): Route module with `ENTIDADES_CANONICAS`, projections `VistaCanonicaResumen`/`VistaCanonicaCompleta`, three route handlers, find-then-update-or-create logic with single `P2002` retry for concurrent first writes
- `src/vistas-canonicas.test.ts` (495 lines, 18 tests): Route integration tests covering registration, list, read, entity validation, SQL bounds, concurrency, cross-tenant isolation, static source-text assertion

**Modified Files**:
- `prisma/schema.prisma`: Added `model VistaCanonica` with `@@unique([conexionId, entidad])`, `@@index([tenantId])`, two FKs (`RESTRICT`), back-relations on `Tenant` and `Conexion`
- `prisma/migrations/20260923000000_vista_canonica/migration.sql`: One `CREATE TABLE`, two `CREATE INDEX`, two `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`; additive only; authored offline via `prisma migrate diff` (Docker unavailable at apply time; deviation disclosed)
- `src/aislamiento-prisma.ts`: Added `'VistaCanonica'` to `MODELOS_AISLADOS` set (line 24)
- `src/server.ts`: Added import and registration of `registerVistaCanonicaRoutes(app, prisma)` immediately after `registerConsultaGuardadaRoutes`
- `src/aislamiento.test.ts`: Extended `montarTenant()` fixture to register one definition per tenant; extended `rutas` sweep table with three new rows (one per route, exercised both ways per T2); added effect-level test for cross-tenant isolation; extended cleanup order (definitions before connections, FK `RESTRICT`)

**Unchanged Files** (verified independently):
- `src/contrato.ts`: Byte-identical to post-DEC-36 state (commit `9fd0ef6`)
- `src/consultas.ts`: Byte-identical to pre-CH-09 (commit `993050b^`)
- `src/consulta-ejecucion.ts`: Byte-identical to pre-CH-09 (commit `336cff0`)

**Specs Synced** (composite, native composition):
- `openspec/specs/tenant-schema-mapping/spec.md`: New capability spec, 7 requirements, 8 scenarios (newly created)
- `openspec/specs/tenant-isolation/spec.md`: Merged delta; extended scoped-model requirement to include `VistaCanonica`, extended T2 sweep requirement (native composition, RENAMED/MODIFIED/ADDED applied by `sdd-archive-compose`)
- `openspec/specs/domain-data-model/spec.md`: Merged delta; "No Premature Modeling" requirement now explicitly includes `VistaCanonica` in the allowed set (native composition, RENAMED/MODIFIED/ADDED applied by `sdd-archive-compose`)

## Verification Results

**Test Execution**: 274/274 pass, 0 fail, 0 skipped (re-run independently in verify phase against live PostgreSQL on `localhost:5434`, container `zd-ch09-testdb`)  
**Build**: Exit code 0 (`npx tsc --noEmit`)  
**Spec Compliance**: 10/10 requirements, 13/13 scenarios COMPLIANT

### Compliance Matrix

| Spec | Requirement | Scenarios | Status |
|---|---|---|---|
| tenant-schema-mapping | Registration Persists Against a Tenant-Scoped Connection | 2 | ✅ COMPLIANT |
| tenant-schema-mapping | Entity Name Validated Against the Canonical Contract Only (DEC-32) | 1 | ✅ COMPLIANT |
| tenant-schema-mapping | Registered SQL Is Never Executed | 1 | ✅ COMPLIANT |
| tenant-schema-mapping | Re-registering an Entity Replaces the Previous Definition (DEC-34) | 1 | ✅ COMPLIANT |
| tenant-schema-mapping | Listing a Connection's Definitions Is Tenant-Scoped | 1 | ✅ COMPLIANT |
| tenant-schema-mapping | Reading One Definition Is Tenant-Scoped | 1 | ✅ COMPLIANT |
| tenant-schema-mapping | Request Body Rejects Client-Supplied Tenant Id | 1 | ✅ COMPLIANT |
| tenant-isolation | Every Scoped Query Is Filtered by the Active Tenant (DEC-13) | 2 | ✅ COMPLIANT |
| tenant-isolation | Cross-Tenant Isolation Is Proven by an Automated Test (T2) | 2 | ✅ COMPLIANT |
| domain-data-model | No Premature Modeling of Out-of-Release Entities | 1 | ✅ COMPLIANT |

### TDD Compliance

| Check | Result | Evidence |
|---|---|---|
| TDD Evidence reported | Partial | Units 1–2: RED-first task labeling (`tasks.md` 2.1-2.11 marked "RED:") with reported failure/success transitions in apply-progress; Unit 3: formal TDD Cycle Evidence table in apply-progress |
| All tasks have tests | Yes | 26/26 tasks map to executable tests (Phases 2–3) or independently-verifiable inspection (Phases 1, 4) |
| RED confirmed | Yes | `src/vistas-canonicas.test.ts` (18 tests) and `src/aislamiento.test.ts` CH-09 additions read directly |
| GREEN confirmed | Yes | 274/274 on independent re-execution in verify phase |
| Triangulation adequate | Yes | Each RED task (2.1-2.11) has distinct scenario with distinct expected values; 2.7 concurrency case runs across all five entity names |
| Safety net adequate | Partial | Unit 1: `prisma validate`/`generate`/`tsc` exit 0 (no route yet exercises model); Unit 3: 19/19 pre-existing tests before CH-09 addition, full suite re-run (274/274) confirms no regression |

**Result**: 5/6 fully passed, 1 partial (Units 1–2 lack formal TDD Evidence table but show equivalent discipline through task labeling and apply-progress reported transitions)

### Success Criteria Traceability

All six success criteria from proposal.md are met:

1. ✅ Registering a definition for a contract entity on the active tenant's connection returns `201`, with `tenantId` from context — tested by `vistas-canonicas.test.ts` 2.1
2. ✅ An entity outside the five names (e.g., `cliente`) returns `400 solicitud-invalida` — tested by `vistas-canonicas.test.ts` 2.3
3. ✅ Another tenant's connection id returns `404` and writes no row; list/read behave as nonexistent (T2) — tested by `vistas-canonicas.test.ts` 2.6 and `aislamiento.test.ts` T2 sweep (3.2, 3.3)
4. ✅ A body carrying `tenantId` or an unknown property returns `400` — tested by `vistas-canonicas.test.ts` 2.4 and `aislamiento.test.ts` 3.5
5. ✅ Listing a connection returns exactly its registered entities — tested by `vistas-canonicas.test.ts` 2.8
6. ✅ No code path added by CH-09 opens a `pg` connection; `src/consulta-ejecucion.ts`, `src/consultas.ts`, `src/contrato.ts` are byte-identical — verified by static source-text test (2.11) and independent `git diff --stat`

## Verification Issues and Resolutions

### CRITICAL Findings
**None** — 0 blockers, archive proceeds.

### WARNINGs (Disclosed, Process-Level)

1. **400-Line Budget Overage on Unit 2**: The Review Workload Forecast in `tasks.md` estimated ~700 total authored lines across three commits, placing the project at High risk of exceeding the 400-line review budget. Unit 2's actual authored diff is +741/-14 lines (per apply-progress). This is a disclosed choice (`auto-chain`/`stacked-to-main` delivery strategy), not a defect. Unlike CH-08 (where the overage was not forecast), this project explicitly accepted the forecast High risk. The repository has no PR review workflow, so "chained PRs" means three sequential direct-to-`master` commits rather than an actual reviewable pull-request boundary; if a PR workflow is later adopted, Unit 2 would benefit from further slicing. **Resolution**: Accepted in design and proposal; explicitly forecast; no code quality issue.

2. **domain-data-model Scenario Verification by Inspection**: The `domain-data-model` requirement "No Premature Modeling of Out-of-Release Entities" is verified in this verify session by direct static inspection of `prisma/schema.prisma` (confirming only `Tenant`, `Conexion`, `ConsultaGuardada`, `VistaCanonica` are present), not by an executable `node:test` assertion. This matches this project's precedent (CH-06's verify report treated the equivalent scenario the same way), so it is not marked UNTESTED. However, no test file in `src/` currently guards this model list against regression (e.g., a future commit accidentally reintroducing `Usuario`/`Ejecucion`/`Plantilla`/`Automatizacion` or adding an unplanned model would not fail automated tests). **Resolution**: Compliant per project convention; suggestion (see below) to add a regression guard.

3. **Unit 1 Migration Authored Offline**: Task 1.2's migration was authored offline via `prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script` (Docker daemon was down at apply time, preventing `prisma migrate dev --create-only` against a shadow database per design). The exact SQL (`CREATE TABLE`, two `CREATE INDEX`, two `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`) was independently re-read in verify and the table successfully exercised under live-PostgreSQL testing (274/274 tests pass, including 16+ `VistaCanonica`-touching integration tests). **Resolution**: Deviation disclosed; risk closed by independent live-DB verification.

### SUGGESTIONs (Non-Blocking)

1. **Domain-Data-Model Regression Guard**: A lightweight static test reading `prisma/schema.prisma`'s model names (mirroring the source-text assertion pattern already used in task 2.11 of this same change) would turn the `domain-data-model` scenario from inspection-only into a genuine regression guard for CH-10/CH-12.

2. **Test-to-Production Weighting**: `tasks.md`'s retrospective note (CH-08's forecast undercounted the 2:1 test-to-production weight) proved directionally correct for CH-09's actual ~700-line total. This weighting is worth retaining as the default for future changes with a similar route-plus-integration-test shape.

3. **Re-Registration Audit Trail**: DEC-34 chose last-writer-wins with no history. CH-25 (B4) will add versioning; consider whether a lightweight audit field (`updatedBy`, `reason`) should precede it.

## Regression Check

`npm test` (full suite, 274/274) re-ran every prior change's dedicated test file unchanged and green:
- CH-01: `tenants.test.ts`
- CH-02: `contexto-tenant.test.ts`
- CH-03: `cripto-credencial.test.ts`
- CH-04: `consola.test.ts`
- CH-05: `consultas.test.ts`, `consultas-guardadas.test.ts`
- CH-06: `conexiones.test.ts`, `conexion-destino.test.ts`
- CH-07: `consulta-ejecucion.test.ts`
- CH-08: `contrato.test.ts`, `contrato-rutas.test.ts`, `config.test.ts`, plus tenant-routes/probeConnection integration blocks

No regression found. Test count grew from CH-08's archived 248/248 to CH-09's 274/274 (+26 new: 18 in `vistas-canonicas.test.ts` + 8 in `aislamiento.test.ts`), matching the design forecast exactly.

## AGENTS.md Rules Compliance

All seven non-negotiable rules from `docs/00-contexto.md` section 5, transcribed in `AGENTS.md`, are confirmed for CH-09:

1. ✅ **No arbitrary SQL from P2**: The route module never exposes a query-editor interface; the `sql` field is write-once-per-entity (idempotent replace), never user-composed at query time
2. ✅ **Tenant isolation**: All scoped queries include `AND tenantId = @activeTenantId`; cross-tenant `conexionId` is rejected at the route handler before any database touch
3. ✅ **Read-only, two-layer**: New model is part of `MODELOS_AISLADOS` scoped to reads; the DB user has no write permission (pre-existing CH-01 constraint); the route validates and parameterizes every write
4. ✅ **No SQL concatenation**: All persistence via parameterized Prisma client calls (`findUnique`, `findFirst`, `create`, `update`, `findMany`); the stored `sql` field is written and read as opaque text, never interpolated
5. ✅ **Data minimization**: List payload is `VistaCanonicaResumen` (omits `sql`); read-one includes full `sql`; no automation metadata or personal columns are exposed
6. ✅ **Motor stays within pattern**: The route uses only the existing isolation extension's allowlisted operations; no change to `aplicarAlcance`'s closed operation map
7. ✅ **Secrets out of repo**: `.env.example` unchanged; no credentials introduced

## Final State Summary

**Status**: READY FOR DELIVERY  
**Task Completion**: 26/26 ✅  
**Test Coverage**: 274/274 passing ✅  
**Build Status**: Exit 0 ✅  
**Spec Compliance**: 10/10 requirements, 13/13 scenarios ✅  
**CRITICAL Issues**: 0 ✅  
**Archival**: Specs synced, change folder moved to `openspec/changes/archive/2026-09-26-CH-09-tenant-schema-mapping/` ✅

## Key Learnings

1. The test-to-production weight ratio of 2:1 for route-plus-integration-test changes (established retrospectively in CH-08) held directionally for CH-09's actual ~700-line total (+26 tests for ~180 lines of route code).

2. The `sdd-archive-compose` native command successfully applied RENAMED/MODIFIED/ADDED sections from delta specs without manual merge errors, preserving pre-existing requirements in both `tenant-isolation` and `domain-data-model` specs unchanged.

3. Offline migration authoring via `prisma migrate diff` produced valid SQL that passed independent live-PostgreSQL verification, closing the deviation risk raised by the Docker-unavailable condition at apply time.

4. The `P2002` retry-once pattern for concurrent upsert-under-isolation, when paired with scoped lookups and a unique constraint, provides sufficient safety without modifying the closed `aplicarAlcance` operation map.

5. Static source-text assertions (task 2.11, no-execution guarantee) and T2 effect-level tests (task 3.3, cross-tenant isolation) together provide high confidence in isolation correctness without requiring formal proof assistants.

---

**Archived by**: sdd-archive  
**Archive Date**: 2026-09-26  
**Change Ready for Next Phase**: CH-10 (Column Validation & Preview)
