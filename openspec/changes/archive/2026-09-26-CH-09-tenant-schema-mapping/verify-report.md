```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:7d851249c94d2fea2cf2f04e36d2e8b5a9bb51413f8d74a6e24859367547f220
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 13/13
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:507a794149bc0a13e321f9f760a80ac0d4a5b49c725596ed892898424a6717b6
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-09-tenant-schema-mapping
**Version**: N/A (no spec-version scheme in this project)
**Mode**: Strict TDD (session-declared for this verify pass). The apply session itself ran mixed: Units 1-2 (commits `993050b`, `336cff0`) followed Standard mode with tasks written RED-first (`tasks.md` 2.1-2.11 are explicit "RED:" tasks preceding the 2.12 implementation task); Unit 3 (commit `c1ac5f6`) ran full Strict TDD with a reported TDD Cycle Evidence table. Both are cross-checked below against actual test execution in this session, not trusted from the apply record.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 26 |
| Tasks complete | 26 |
| Tasks incomplete | 0 |

Every task in `tasks.md` (1.1-1.4, 2.1-2.14, 3.1-3.5, 4.1-4.3) is checked `[x]`. Cross-checked against the actual source tree and git history in this session, not spot-checked, and against Engram `sdd/CH-09-tenant-schema-mapping/apply-progress` (observation #112):

- **1.1-1.4**: `prisma/schema.prisma` defines `model VistaCanonica` with `id`, `tenantId`+`tenant` relation, `conexionId`+`conexion` relation, `entidad String`, `sql String`, `creadaEn`, `actualizadaEn`, `@@unique([conexionId, entidad])`, `@@index([tenantId])`; back-relations `Tenant.vistasCanonicas` and `Conexion.vistasCanonicas` are present. `src/aislamiento-prisma.ts` line 24 reads `new Set(['Conexion', 'ConsultaGuardada', 'VistaCanonica'])`. `npx prisma validate`/`generate` are implied clean by a successful `npx tsc --noEmit` and passing Prisma-client-backed tests re-run in this session.
- **1.2**: the migration under `prisma/migrations/20260923000000_vista_canonica/migration.sql` was authored offline via `prisma migrate diff` (documented deviation: Docker was down at apply time). Independently re-read in this session: `CREATE TABLE "VistaCanonica"`, two `CREATE INDEX` (`tenantId` index, unique `conexionId,entidad` index), two `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` both `RESTRICT`. The deviation is closed in practice: this session's live-database test run exercised the table under this exact migration successfully (274/274 passing, including 16+ `VistaCanonica`-touching integration tests), proving the migration applies and behaves correctly against the live target.
- **2.1-2.14**: `src/vistas-canonicas.ts` (231 lines) exports `ENTIDADES_CANONICAS` (derived from `CONTRATO_CANONICO`, never a second literal list), `VistaCanonicaResumen`/`VistaCanonicaCompleta` projections, and `registerVistaCanonicaRoutes(app, prisma)` registering `PUT`/`GET`(list)/`GET`(one) on `/conexiones/:id/vistas-canonicas[/:entidad]`. Read directly: ownership is checked via a scoped `conexion.findUnique({where:{id}, select:{id:true}})` before any read or write; the upsert path is `findFirst` then `update`-by-id or `create`, with a single `P2002`-triggered retry, never `upsert`. `src/server.ts` imports and registers it immediately after `registerConsultaGuardadaRoutes`. `src/vistas-canonicas.test.ts` (495 lines, 18 tests) covers every RED task (2.1-2.11) with real behavioral assertions - no tautologies, no smoke tests, no ghost loops; every assertion calls the route through `app.inject()` or reads the row back through the raw Prisma client and asserts a specific value.
- **3.1-3.5**: `src/aislamiento.test.ts`'s `montarTenant()` fixture registers one `VistaCanonica` per tenant through the real `PUT` route (lines 172-191, `entidadVista`/`sqlVista` on `Fixture`). The `rutas` sweep table (lines 268-304) adds the three new routes, each generating a "404 both ways" test and an "own id still works" control, re-run independently in this session. An effect-level test (lines 394-431) proves a `PUT` from A naming B's connection and B's already-registered entity leaves B's row (`id`, `tenantId`, `sql`, `actualizadaEn`) byte-for-byte unchanged, stores the intruder statement nowhere, and leaves A owning exactly its own fixture row. `3.5` adds a `tenantId`-in-body 400 test specific to the canonical-view route.
- **4.1**: re-run independently in this session (not trusted from the apply record): `git diff --stat 993050b^ -- src/consultas.ts src/consulta-ejecucion.ts` is empty; `git diff --stat 336cff0 -- src/consultas.ts src/consulta-ejecucion.ts` is empty; `git log 993050b^..HEAD -- src/contrato.ts` lists only `9fd0ef6` (the disclosed DEC-36 commit, unrelated to CH-09) and `git diff --stat 9fd0ef6 -- src/contrato.ts` is empty. All three files are confirmed byte-identical to their pre-CH-09 state.
- **4.2**: the migration's statements were independently re-read in this session (see 1.2 above): one `CREATE TABLE`, two `CREATE INDEX`, two `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. No statement targets `Tenant` or `Conexion`. Additive confirmed.
- **4.3**: `npm test` re-run independently in this verify session: 274/274 pass, 0 fail, 0 skipped, against live PostgreSQL on `localhost:5434`. `npx tsc --noEmit` exit 0. Matches the apply record's reported figures exactly.

No discrepancy found between checked-off tasks and code state.

### Build and Tests Execution

**Build**: PASSED (exit 0)
```text
npx tsc --noEmit
(no output, exit 0)
```

**Tests**: 274 passed / 0 failed / 0 skipped (re-executed independently in this verify session, live PostgreSQL reachable on `localhost:5434`, container `zd-ch09-testdb`)
```text
npm test
tests 274
suites 35
pass 274
fail 0
cancelled 0
skipped 0
todo 0
```
This matches the 274/274 figure apply-progress reported at the close of Unit 3 (observation #112, task 4.3: "266 + 8 new"). No live-DB test was skipped in this run, so the full spec compliance matrix below rests on executed assertions.

**DB hygiene**: read-only `psql` query against `zd-ch09-testdb` after the run: `Tenant=0, VistaCanonica=0, Conexion=0, ConsultaGuardada=0`. Clean.

**Coverage**: Not applicable, `coverage_threshold: 0` in `openspec/config.yaml`; test evidence is scenario-level (`node:test` plus Fastify `inject()` against a live database, no mocking of the module under test), matching the standing project convention from CH-04 through CH-08.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Partial | Unit 3 (tasks 3.1-3.4) has a formal TDD Cycle Evidence table in apply-progress; Units 1-2 do not, but their tasks are written RED-first (`tasks.md` 2.1-2.11 explicitly labeled "RED:", followed by the 2.12 implementation task and 2.14 GREEN checkpoint) and apply-progress's Unit 2 evidence line names the actual RED failure mode (`ERR_MODULE_NOT_FOUND`, because the module did not exist yet) and the GREEN result (18/18 focused, 266/266 full) |
| All tasks have tests | Yes | 26/26 tasks map to either a test file (Phases 2-3) or independently-verifiable inspection evidence (Phases 1, 4) |
| RED confirmed (tests exist) | Yes | `src/vistas-canonicas.test.ts` (18 tests) and `src/aislamiento.test.ts`'s CH-09 additions exist and were read directly in this session, not merely trusted |
| GREEN confirmed (tests pass) | Yes | 274/274 on independent re-execution, including every test named above |
| Triangulation adequate | Yes | Each RED task (2.1-2.11) has a distinct scenario with distinct expected values (e.g. 2.4 covers both `tenantId` and an unrelated unknown key as two separate cases; 2.10 covers four distinct response shapes); 2.7's concurrency case is run over all five canonical entities per run |
| Safety Net for modified files | Partial | Unit 1's evidence is `prisma validate`/`generate`/`tsc` exit 0 (no route yet exercises the model, so no pre-existing test suite applied); Unit 3's safety net is explicitly reported as 19/19 pre-existing `aislamiento.test.ts` tests before the extension, and this session's full-suite re-run (274/274) confirms nothing broke |

**TDD Compliance**: 5/6 checks fully passed, 1 partial (Units 1-2 lack the formal evidence table format but show equivalent RED/GREEN discipline through task labeling and reported failure/pass evidence)

---

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Integration | 24 | `vistas-canonicas.test.ts` (16), `aislamiento.test.ts` (8 new: 6 sweep + 1 effect + 1 body-tenantId) | `node:test` + Fastify `app.inject()` against live PostgreSQL |
| Static (source-text / array) | 2 | `vistas-canonicas.test.ts` | `node:test` + `node:fs/promises` |
| **Total new tests attributable to CH-09** | **26** | 2 files (1 new, 1 modified) | |

No unit-only or E2E layer is used; this matches the project's established convention (CH-04 through CH-08) of route-level integration testing with no mocking of the module under test.

---

### Assertion Quality

No trivial assertions found across the CH-09 test surface. Specifically checked and confirmed absent: tautologies, orphan empty-collection assertions without a companion non-empty case (2.8's empty-array test is paired with 2.8's two-definition test), type-only assertions used alone, ghost loops, ratio-imbalanced mocking (zero manual mocks - this project mocks nothing, testing against a real database), and CSS/implementation-detail coupling (not applicable, no UI). Every assertion reviewed calls a production route or reads the actual database row and compares against a specific expected value.

**Assertion quality**: All assertions verify real behavior.

---

### Quality Metrics

**Linter**: Not available in cached capabilities - skipped, not a failure.
**Type Checker**: No errors (`npx tsc --noEmit` exit 0).

### Spec Compliance Matrix

**tenant-schema-mapping** (7 requirements / 8 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Registration Persists Against a Tenant-Scoped Connection | Registering a valid definition | `vistas-canonicas.test.ts`: "2.1 a first registration answers 201 and persists on the declared tenant" | COMPLIANT |
| Registration Persists Against a Tenant-Scoped Connection | Registering against another tenant's connection | `aislamiento.test.ts`: T2 sweep row "PUT /conexiones/:id/vistas-canonicas/:entidad answers 404 for the other tenant's id, both ways"; "3.3 registering against the other tenant's connection leaves its definition untouched" (effect-level) | COMPLIANT |
| Entity Name Validated Against the Canonical Contract Only (DEC-32) | Unknown entity name | `vistas-canonicas.test.ts`: "2.3 an entity outside the canonical contract is rejected and creates no row" | COMPLIANT |
| Registered SQL Is Never Executed | Blank SQL text rejected | `vistas-canonicas.test.ts`: "2.5 a statement that is empty after trimming is rejected and creates no row"; "2.11 the route module never names a target-database entry point or the secret column" (static, no-execution guarantee) | COMPLIANT |
| Re-registering an Entity Replaces the Previous Definition (DEC-34) | Re-registering an already-mapped entity | `vistas-canonicas.test.ts`: "2.2 a second registration of the same pair answers 200 and replaces in place" | COMPLIANT |
| Listing a Connection's Definitions Is Tenant-Scoped | Listing returns exactly the owned definitions | `vistas-canonicas.test.ts`: "2.8 the listing returns exactly the connection's definitions, summary only, by entidad"; `aislamiento.test.ts` T2 sweep row "GET /conexiones/:id/vistas-canonicas answers 404 for the other tenant's id, both ways" | COMPLIANT |
| Reading One Definition Is Tenant-Scoped | Reading another tenant's definition | `aislamiento.test.ts` T2 sweep row "GET /conexiones/:id/vistas-canonicas/:entidad answers 404 for the other tenant's id, both ways" | COMPLIANT |
| Request Body Rejects Client-Supplied Tenant Id | tenantId supplied in the request body | `vistas-canonicas.test.ts`: "2.4 a body carrying tenantId is rejected, and the tenant stays server-resolved"; `aislamiento.test.ts`: "3.5 a body carrying tenantId is 400 on the canonical-view registration too" | COMPLIANT |

**tenant-isolation** (2 requirements / 4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Every Scoped Query Is Filtered by the Active Tenant (DEC-13) | Reading another tenant's connection, saved query, or schema-mapping definition | `aislamiento.test.ts`: all three `VistaCanonica` sweep rows (404 both ways, no leak of `sqlVista`/`tenantId` in the response body); "3.3 registering against the other tenant's connection leaves its definition untouched" | COMPLIANT |
| Every Scoped Query Is Filtered by the Active Tenant (DEC-13) | Listing returns only the active tenant's rows | `aislamiento.test.ts`: "3.3 the listing never shows the other tenant's saved queries" (pre-existing CH-06 coverage, scenario text unmodified by this change) | COMPLIANT |
| Cross-Tenant Isolation Is Proven by an Automated Test (T2) | Full two-tenant route sweep | `aislamiento.test.ts`'s `rutas` sweep table, now 6 routes including the 3 new `VistaCanonica` routes, each exercised both ways with a leak-check assertion | COMPLIANT |
| Cross-Tenant Isolation Is Proven by an Automated Test (T2) | Database unreachable | `aislamiento.test.ts`'s `esAlcanzable()` TCP preflight driving `describe(..., {skip: motivoSkip})` - read directly, present and unchanged in structure by this change | COMPLIANT |

**domain-data-model** (1 requirement / 1 scenario)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| No Premature Modeling of Out-of-Release Entities | Inspecting the schema after this change | Direct inspection in this session: model declarations in `prisma/schema.prisma` are exactly `Tenant`, `Conexion`, `ConsultaGuardada`, `VistaCanonica`; none of `Usuario`/`Ejecucion`/`Plantilla`/`Automatizacion` present anywhere in the file | COMPLIANT (see WARNING 2 below) |

**Compliance summary**: 13/13 scenarios have covering evidence and passed.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| `VistaCanonica` model shape matches design's Interfaces/Contracts | Implemented | Fields, relations, `@@unique([conexionId, entidad])`, `@@index([tenantId])` match `design.md` verbatim |
| Migration additive only | Confirmed | One `CREATE TABLE`, two `CREATE INDEX`, two `RESTRICT` FK `ADD CONSTRAINT`; no statement targets `Tenant` or `Conexion` |
| `MODELOS_AISLADOS` entry | Confirmed | `new Set(['Conexion', 'ConsultaGuardada', 'VistaCanonica'])` |
| Route registrar signature and wiring | Implemented | `registerVistaCanonicaRoutes(app: FastifyInstance, prisma: PrismaAislado): void`, registered in `server.ts` immediately after `registerConsultaGuardadaRoutes` |
| Body schema rejects `tenantId`/unknown keys | Implemented | `additionalProperties:false` + `propertyNames:{enum:['sql']}` - the latter is what actually rejects an unknown key under Fastify's `removeAdditional` default, per the module's own doc comment and 2.4's test |
| `entidad` validated as a params `enum` derived from the contract | Implemented | `ENTIDADES_CANONICAS = CONTRATO_CANONICO.map(e => e.nombre)`, no second literal list |
| Ownership check precedes any read/write | Implemented | `conexionPropia()` scoped `findUnique` runs before `buscarPar`/`create` in every route handler |
| Upsert-under-isolation without `upsert` | Implemented | `findFirst` then `update`-by-id or `create`, single `P2002` retry; `aplicarAlcance`'s closed operation map is untouched |
| No composite FK on `VistaCanonica` (DEC-35) | Confirmed | Schema shows two independent simple FKs (`tenantId` to `Tenant`, `conexionId` to `Conexion`), no composite key |
| `src/contrato.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts` byte-identical to pre-CH-09 | Confirmed | Independent `git diff --stat` against `993050b^`/`336cff0`/`9fd0ef6`, all empty |
| Registered SQL never executed, no `pg` connection opened by this module | Confirmed | Static source-text test (2.11) plus direct read: the module imports only `Prisma`, `PrismaAislado`/`conTenantInyectado`, `camposInvalidos`, `sanearSql` (a pure trim predicate, not an executor), and `CONTRATO_CANONICO`; no `pg`/`Client`/connection import anywhere |
| No SQL concatenation anywhere in this change | Confirmed | All persistence goes through parameterized Prisma client calls (`findUnique`, `findFirst`, `update`, `create`, `findMany`); the stored `sql` field is written and read as an opaque string value, never interpolated into a query string |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Naming: model `VistaCanonica`, module `vistas-canonicas.ts`, routes `/conexiones/:id/vistas-canonicas[/:entidad]`, keys `vistaCanonica`/`vistasCanonicas` | Yes | Matches exactly |
| Replace verb: `PUT`, `201` first time / `200` on replace | Yes | Confirmed by 2.1/2.2 tests |
| Upsert under isolation: `findFirst` then `update`-by-id or `create`, single `P2002` retry | Yes | No `upsert` added to `aplicarAlcance`; 2.7's concurrency test exercises the retry path |
| Cross-tenant `conexionId`: scoped `findUnique` before any read/write, no composite FK (DEC-35) | Yes | `conexionPropia()`; schema has two independent simple FKs |
| `entidad` storage: `TEXT`, app-validated against `CONTRATO_CANONICO` | Yes | No Prisma enum, no `CHECK` |
| SQL bounds: `minLength:1` plus `sanearSql` predicate only, no `maxLength` | Yes | Matches `consultas-guardadas.ts`/`conexiones.ts` convention |
| List payload: summary without `sql`, `orderBy:{entidad:'asc'}`, no `truncado` | Yes | Confirmed by 2.8's key-set assertion and ordering assertion |

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. The Review Workload Forecast in `tasks.md` estimated ~700 authored lines against the 400-line budget ("High" risk) and chose `auto-chain`/`stacked-to-main`. The actual authored diff across the three commits is well over that budget on Unit 2 alone (+741/-14, per apply-progress, not compressed to fit). This is disclosed and was a deliberate, forecast-anticipated choice (unlike CH-08, where the same overage was not forecast) - not a defect, but worth naming because this repository still has no PR review workflow, so "chained PRs" here means three sequential direct-to-`master` commits rather than an actual reviewable PR boundary; if a PR workflow is adopted later, Unit 2 would need to be sliced further.
2. The `domain-data-model` scenario ("Inspecting the schema after this change") is verified in this session by direct static inspection of `prisma/schema.prisma`, not by a dedicated executable `node:test` assertion. This matches this project's own precedent (CH-06's archived verify report treated the equivalent domain-data-model scenario as COMPLIANT via migration/psql inspection rather than a `node:test` file), so it is not treated as UNTESTED here, but no test file in `src/` currently guards the model list against regression (e.g. a future change accidentally reintroducing `Usuario`/`Ejecucion`/`Plantilla`/`Automatizacion`, or adding a second unplanned model, would not fail any automated test).
3. Unit 1's migration was authored offline (`prisma migrate diff`, Docker unavailable at apply time) rather than through `prisma migrate dev --create-only` against a live shadow database, per `tasks.md` 1.2's own applied note. This is closed in practice - this session's live-database test run exercised the exact emitted SQL successfully - but the deviation from the design's stated generation method is recorded here for traceability, matching this project's convention of surfacing such notes (see CH-08's verify report, WARNING 2) rather than omitting them.

**SUGGESTION**:
1. A lightweight static test reading `prisma/schema.prisma`'s model names (mirroring 2.11's source-text assertion pattern already used in this same change) would turn the `domain-data-model` scenario from inspection-only into a genuine regression guard for CH-10/CH-12, when those changes next touch the schema.
2. `tasks.md`'s own retrospective note (that CH-08's forecast undercounted the test-to-production weight near 2:1) proved directionally correct for CH-09's actual ~700-line total; this weighting method is worth keeping as the default assumption for future changes with a similar route-plus-integration-test shape.

### Regression Check (CH-01 through CH-08)

`npm test` (full suite, 274/274) re-ran every prior change's dedicated test file unchanged and green in this session, including `tenants.test.ts`, `contexto-tenant.test.ts`, `consultas-guardadas.test.ts`, `cripto-credencial.test.ts`, `consulta-ejecucion.test.ts`, `consola.test.ts`, `conexiones.test.ts`, `consultas.test.ts`, `contrato.test.ts`, `contrato-rutas.test.ts`, `config.test.ts`, `conexion-destino.test.ts`, and the tenant-routes/probeConnection live-PostgreSQL integration blocks. No regression found; the count grew from CH-08's archived 248/248 to 274/274, consistent with CH-09 adding the 18-test `vistas-canonicas.test.ts` file plus 8 new tests in `aislamiento.test.ts`.

### Verdict

PASS WITH WARNINGS

All 10 requirements and 13 scenarios across `specs/tenant-schema-mapping/spec.md`, `specs/tenant-isolation/spec.md`, and `specs/domain-data-model/spec.md` have covering evidence and passed, re-executed independently in this verify session against live PostgreSQL (274/274 tests, 0 fail, 0 skipped; `tsc --noEmit` exit 0; DB left clean at 0 rows across `Tenant`/`Conexion`/`ConsultaGuardada`/`VistaCanonica`). Every AGENTS.md non-negotiable rule relevant to this change is independently confirmed: the active tenant is never taken from the client-supplied body or params (rejected structurally by `additionalProperties:false` plus `propertyNames`, proven by test), no SQL concatenation exists anywhere in the new module (parameterized Prisma calls only), the registered SQL is never executed (static test plus source-level absence of any execution/connection entry point), and no secret is introduced. `design.md`'s seven Architecture Decisions and DEC-30 through DEC-36 are all independently confirmed against the actual code, not merely trusted from the apply record; task 4.1's byte-identity claim and task 4.2's additive-migration claim were both independently re-verified with fresh `git diff` and source reads in this session. Zero CRITICAL findings. The three WARNINGs - the disclosed-but-still-real 400-line budget overage on Unit 2, the domain-data-model scenario resting on inspection rather than an executable regression test, and the disclosed offline-migration-authoring deviation on Unit 1 - are process/traceability observations, not spec-compliance or code-quality defects, and none blocks archive. Recommended for `sdd-archive`.
