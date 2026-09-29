```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5a1113fbcc57ec997b9e96f829ee842c74b4969ad93c4ed0f85277a17e916b75
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 23/23
scenarios: 36/36
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:2529d4cca3e5fc9b9ad0e87820d14a913904b7c12ea7f40f7ced4ed23931345c
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:cdab4d00374babb80b5108285b4b859731dcfcb446f462822a095eba9a576a8e
```

## Verification Report

**Change**: CH-13-engine-scheduling-execution
**Version**: openspec delta specs (automation-scheduling, execution-log, domain-data-model, tenant-isolation, project-environment, query-console)
**Mode**: Standard (strict_tdd: false), RED/GREEN order followed per apply-progress.md

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 46 |
| Tasks complete | 43 |
| Tasks incomplete | 3 (7.1 full-suite checkpoint, 7.2 this verify report, 7.3 archive) |

All implementation tasks (Phases 1-6, tasks 1.1-6.6) are checked and match apply-progress.md's unit-by-unit evidence. The three open tasks are Phase 7's own verify/archive work, not implementation debt.

### Build & Tests Execution

**Typecheck**: npx tsc --noEmit -- exit 0, clean.

**Build**: PASSED
```text
$ npm run build
> zerodashboard-console@0.1.0 build
> tsc -p tsconfig.json
(exit 0)
```

**Prisma**: npx prisma validate -- exit 0, "The schema at prisma/schema.prisma is valid".

**Tests**: 536 passed / 0 failed / 0 skipped (two independent runs, both 536/536; no probe-skip degradation observed)
```text
$ TEST_DB_PORT=5434 npm test
tests 536
suites 70
pass 536
fail 0
cancelled 0
skipped 0
todo 0
(exit 0)
```
Matches the expected 536/536 total exactly; no rerun for probe-skip was needed.

**Coverage**: Not available (no coverage tool configured in this project; runtime node:test pass/fail is the project's established compliance evidence, per CH-06..CH-12 precedent).

### Spec Compliance Matrix

#### automation-scheduling (8 requirements, 12 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Automatizacion Binds a Plantilla, Tenant Connection, Values, Schedule (DEC-74) | Creating an automation with valid values | automatizaciones-rutas.test.ts: 3.2 a valid create persists activo true | COMPLIANT |
| same | Parameter values validated like CH-11 | automatizaciones-rutas.test.ts: 3.2 a missing or ill-typed parameter value is 400 | COMPLIANT |
| same | Connection must belong to the same tenant | automatizaciones-rutas.test.ts: 3.2 another tenants connection is 404; aislamiento.test.ts T2 row | COMPLIANT |
| Automation Lifecycle Is Create/List/Get/Deactivate, No Edit/Delete (DEC-78, DEC-79) | Deactivating an automation | automatizaciones-rutas.test.ts: 3.4/3.5 list, get, deactivate once | COMPLIANT |
| same | Deactivated automation excluded from future runs but stays listed | same test (row stays listed) plus planificador.test.ts: 4.2 deactivated automation never runs | COMPLIANT |
| Cron Resolved by a Next-Fire-Only Library (DEC-76) | Invalid cron expression rejected | automatizaciones-rutas.test.ts: 3.1/3.3; automatizaciones.test.ts: 2.1 cronValido suite | COMPLIANT |
| Schedule Interpreted in the Global Configured Timezone (DEC-77) | Next fire time follows the configured timezone | automatizaciones.test.ts: 2.2 the configured timezone resolves the next fire | COMPLIANT |
| In-Process Scheduler Started With the Application (DEC-75) | Scheduler starts with the application | server.ts wiring (crearPlanificador next to prisma, iniciar in listen.then, onClose to detener); unit-tested via planificador.test.ts 4.7 on a fake Reloj; no live-boot integration test exercises server.ts itself | PARTIAL, see WARNING-1 |
| Only Active Tenants Active, Due Automations Run (DEC-14, DEC-79) | Deactivated tenants automations never run | planificador.test.ts: 4.2 a deactivated tenant or a deactivated automation never runs | COMPLIANT |
| same | Deactivated automation never runs | same test | COMPLIANT |
| Run Pipeline Reuses the Read-Only Composition/Execution Chain (DEC-71) | Missing or failing view validation blocks the run | planificador.test.ts: 4.3 an entity with no passing validation blocks the run | COMPLIANT |
| A Runs Failure Does Not Stop the Tick for Other Automations | One failing run does not block a sibling run | planificador.test.ts: 4.5 an unexpected throw closes its run as error-interno and the siblings still run | COMPLIANT |

#### execution-log (5 requirements, 7 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Ejecucion Records One Row Per Run (X2) | A successful run writes a complete row | planificador.test.ts: 4.6 every outcome writes exactly one closed Ejecucion | COMPLIANT |
| Every Run Outcome Writes an Ejecucion, Including a Gate Refusal (DEC-71) | A validation-gate refusal is recorded | planificador.test.ts: 4.3, 4.6 | COMPLIANT |
| same | An execution failure is recorded | planificador.test.ts: 4.6 closed port fixture | COMPLIANT |
| Execution Metadata Only, No Result Rows Persisted (D-1 leaning) | A runs own result data is absent from its log row | automatizaciones.test.ts: 2.3 ok, the row count and cut, never the rows themselves; EjecucionListada projection in automatizaciones-rutas.ts | COMPLIANT |
| Error Field Stores a Classified Error, Never a Raw Driver Error | A failed runs error is sanitized | automatizaciones.test.ts: 2.3 execution failure, closed category and publishable SQLSTATE; stray driver fields never copied | COMPLIANT |
| Runs Listing Is Tenant-Scoped to the Automations Owner (DEC-80) | Listing runs for ones own automation | automatizaciones-rutas.test.ts: 5.1 an automations runs are listed newest first | COMPLIANT |
| same | Naming another tenants automation | same test, foreign id 404; aislamiento.test.ts T2 ejecuciones row | COMPLIANT |

#### domain-data-model (1 requirement, 3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| No Premature Modeling of Out-of-Release Entities (MODIFIED) | Inspecting the schema after this change | aislamiento.test.ts: the model list is exactly the tenant models, Plantilla, and the CH-13 pair; npx prisma validate | COMPLIANT |
| same | Plantilla carries no tenant reference | aislamiento.test.ts: Plantilla carries no tenantId column, unlike every scoped model | COMPLIANT |
| same | Usuario stays forbidden | same model-list test, no Usuario present | COMPLIANT |

#### tenant-isolation (3 requirements, 6 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Every Scoped Query Is Filtered by the Active Tenant (DEC-13, MODIFIED) | Reading another tenants connection/query/mapping/automation/execution | aislamiento.test.ts T2 sweep, CH-13 rows: create/get/desactivar/ejecuciones, foreign conexionId | COMPLIANT |
| same | Listing returns only the active tenants rows | aislamiento.test.ts: the caller must see its own automation, T2 listing check | COMPLIANT |
| Cross-Tenant Isolation Is Proven by an Automated Test (T2) | Full two-tenant route sweep | aislamiento.test.ts full suite, extended with CH-13 automation/runs rows | COMPLIANT |
| same | Database unreachable | motivoSkip/alcanzable skip guard in aislamiento.test.ts | COMPLIANT |
| Scheduler-Entered Tenant Context Derives Identity Only From Own-Database Rows (ADDED) | Scheduler tick enters a tenants context from its own Tenant row | planificador.test.ts: 4.4 each run happens in its own tenants context | COMPLIANT |
| same | A scheduler-run query outside any context fails closed | aislamiento.test.ts: 1.4 Automatizacion/Ejecucion throw ErrorSinTenantActivo (design note: intentionally not duplicated in unit 5) | COMPLIANT |

#### project-environment (2 requirements, 3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Global Timezone Configuration for Schedule Interpretation (DEC-77) | Changing the timezone without a code change | config.test.ts: a valid IANA zone is read from the environment without a source change | COMPLIANT |
| same | Unset timezone falls back to the documented default | config.test.ts: zonaHoraria defaults to UTC when ZONA_HORARIA_AUTOMATIZACIONES is unset | COMPLIANT |
| Timezone Variable Ships Only as a Placeholder Example | Inspecting the example file | .env.example line 45 reads ZONA_HORARIA_AUTOMATIZACIONES=UTC, confirmed by direct read; no automated test parses .env.example anywhere in this project | PARTIAL, see WARNING-2 |

#### query-console (4 requirements, 5 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Console Displays Automations and Supports Creating One (DEC-78) | Viewing the automations list | consola.test.ts: the list shows plantilla, connection, schedule and state; deactivating reloads it | COMPLIANT |
| same | Creating an automation from the console | consola.test.ts: create builds value controls from the template and submits scoped to the active tenant | COMPLIANT |
| Console Supports Deactivating an Automation (DEC-79) | Deactivating from the console | same test as list, deactivating reloads it | COMPLIANT |
| Console Displays an Automations Runs (DEC-80) | Viewing an automations runs | consola.test.ts: the runs view shows each run and a classified error for a failed one | COMPLIANT |
| Automation Views Respect the Active-Tenant Indicator (T4, DEC-15) | Switching tenant updates the automations view | consola.test.ts: switching tenant clears the runs and reloads the list for the new tenant only | COMPLIANT |

**Compliance summary**: 34/36 scenarios fully COMPLIANT at runtime; 2/36 PARTIAL (structurally confirmed by static inspection, no dedicated runtime/integration test, see WARNING-1 and WARNING-2). 0 UNTESTED, 0 FAILING.

### Correctness (Static Evidence) -- AGENTS.md non-negotiable rules

| Rule | Status | Notes |
|---|---|---|
| 1. P2 never executes arbitrary SQL | Held | No query editor exists for automations; a run composes only the automations bound Plantilla through the unchanged CH-12 pipeline (evaluarVistas, componerSentencia, prepararSentencia, destinoDeConexion, ejecutarConsulta). No new execution surface. |
| 2. Tenant isolation, tenant id never from the request | Held | Automatizacion and Ejecucion added to MODELOS_AISLADOS; every route reads the tenant from the header via existing hooks, never the body (strict AJV rejects a tenantId field); the scheduler reads tenant identity only from its own tenant.findMany with activo true, entering context with conTenantActivo per tenant. |
| 3. Read-only, two layers | Held | Reuses the existing ejecutarConsulta read-only pipeline and its DB-role enforcement; unit 4b evidence exercises a live read-only role (ch13_lector) against the pipeline. |
| 4. No SQL concatenation | Held | prepararSentencia, sanearSql, componerSentencia (unchanged CH-08/CH-11/CH-12 primitives) own all statement building; automatizaciones-rutas.ts and planificador.ts never build a SQL string themselves. |
| 5. Data minimization | Held | Ejecucion has no row-content columns (only estado, timestamps, duracionMs, filas count, corte, fase, error, codigoError); EjecucionListada projection excludes tenantId and automatizacionId; cierreDeResultado never copies a runs contents, only a count. |
| 6. Engine executes only the pattern | Held | cron-parser is used strictly for next-fire calculation (DEC-76), never to run tasks; comments repeat this constraint at the import site; no retry, no catch-up, no parallelism added (deferred to CH-17/CH-18). |
| 7. Secrets out of the repository | Held | .env.example documents ZONA_HORARIA_AUTOMATIZACIONES=UTC as a placeholder/default value, not a real deployment value; no credential added by this change. |

### Coherence (Design) -- design.md decisions vs shipped code

| Decision | Followed? | Notes |
|---|---|---|
| Cron library: cron-parser, pinned exact version, next-fire only (DEC-76) | Yes | package.json pins 5.10.1 with no caret; confirmed against installed API. |
| Timezone: ZONA_HORARIA_AUTOMATIZACIONES, default UTC, fail-closed on invalid zone (DEC-77) | Yes | config.ts plus tests. |
| Tick: self-rescheduling setTimeout aligned to hh:mm:01, window (previous, now], no catch-up at boot (DEC-75) | Yes | planificador.ts hastaElProximoTick; anterior set at build time from reloj.ahora(). |
| Due check: next of max(windowStart, creadaEn) less-or-equal now | Yes | correrVencidas; automatizaciones.test.ts 2.2 suite. |
| Concurrency: sequential tenant-by-tenant, automation-by-automation | Yes | ejecutarTick/correrVencidas loops are sequential for-of with await. |
| Run placement: pure helpers in automatizaciones.ts, pipeline in planificador.ts | Yes | File layout matches. |
| Page for a run: limite equals maxFilasPorConsulta, desplazamiento 0, no new budget (DEC-19) | Yes | planificador.ts resultadoDeCorrida. |
| Values checked at creation and again on every run | Yes | automatizaciones-rutas.ts create route plus planificador.ts resultadoDeCorrida. |
| Stop: POST /automatizaciones/:id/desactivar, 404/409, no edit/delete (DEC-79) | Yes | Matches /tenants/:id/baja shape; route-naming note in tasks.md resolved correctly in favor of the spec (desactivar). |
| Timestamps from injected clock, not DB default | Yes | Reloj.ahora() used for iniciadaEn/finalizadaEn; schema has no default-now on iniciadaEn. |
| Design-level resolution 1: scheduler as second production entry into tenant context (DEC-13/14) | Yes | Registered in docs/01-decisiones.md Resoluciones de nivel diseno CH-13; contexto-tenant.ts doc comment updated. |
| Design-level resolution 2: DEC-71 gate applies to scheduled runs | Yes | resultadoDeCorrida calls evaluarVistas before any dial; planificador.test.ts 4.3. |
| Deviation: console connection input as free text, not a select (consola.ts, unit 6b) | Documented deviation, non-blocking | No route lists connections by tenant; adding one would widen the API beyond this changes scope. Spec query-console only requires the create control to submit a connection, not a specific widget; functionally compliant. See SUGGESTION-1. |
| Accepted budget exception: Unit 4a measured 458 changed lines vs the 400-line guard | Documented exception, non-blocking | Recorded in apply-progress.md Unit 4a Review budget row as user-accepted size:exception; no further cohesive cut was possible. Consistent with sdd-phase-common.md Section E. |
| Unit splits 2a/2b, 3a/3b, 4a/4b, 6a/6b | Acceptable | Match tasks.md Suggested Work Units table; each split has its own RED/GREEN evidence and rollback boundary in apply-progress.md; no functional gap introduced (every scenario above has a passing covering test regardless of which sub-unit implemented it). |

### Architecture Decisions (DEC-74 through DEC-80)

All seven are registered in docs/01-decisiones.md with contexto, opciones, decision, consecuencias and estado, each marked firme, each attributed to the user as author (not inferred by the agent). The two CH-13 design-level resolutions under DEC-13/14 and DEC-71 are also registered, per CH-06 precedent format. No open architecture decision was found undocumented during this verification. CH-13 is an R1 change (docs/02-mapa-de-changes.md line 49); the D-1/D-2/D-4/D-5 gates that block R2+ changes do not apply here.

### Issues Found

**CRITICAL**: None

**WARNING**:
- WARNING-1: specs/automation-scheduling/spec.md scenario "Scheduler starts with the application" (DEC-75) has no dedicated integration test that boots the real src/server.ts and observes the scheduler running unattended. src/server.ts is a top-level script with side effects at import time, as are all of this projects route registrars back to CH-06, so this is a pre-existing, project-wide testing-convention gap, not a CH-13 regression. The underlying mechanics (iniciar, detener, timer alignment, tick execution) are fully unit-tested (planificador.test.ts 4.7 suite), and the wiring itself is confirmed correct by direct code inspection. Mirrors the same non-blocking pattern used in CH-12s verify report.
- WARNING-2: specs/project-environment/spec.md scenario "Inspecting the example file" has no automated test reading .env.example; this is true project-wide, no chapters committed-example-file requirement has ever had a parsing test, including the pre-existing CREDENTIAL_MASTER_KEY placeholder rule. Directly inspected and confirmed compliant: .env.example line 45 reads ZONA_HORARIA_AUTOMATIZACIONES=UTC, a documented default value, not a real deployment value.
- WARNING-3: The consoles dedicated /cron 400 message (src/consola.ts near line 1155, the cron-format sentence) has no assertion in src/consola.test.ts. The general create-flow scenario, "Creating an automation from the console", is covered; this specific error-message branch is not. Already flagged as a known follow-up before this verification began.

**SUGGESTION**:
- SUGGESTION-1: The consoles connection field for creating an automation is a free-text id input, because no route lists a tenants connections. This is a documented, in-scope-respecting deviation from design.mds "connection select" line (Unit 6b notes in apply-progress.md). Usability improvement, not a spec or isolation defect; would require a new connection-listing route, which is correctly out of this changes scope.
- SUGGESTION-2: Consider adding the three follow-up tests named in WARNING-1/2/3 (a server-boot smoke test asserting the scheduler ticks without a manual step; a .env.example content assertion for ZONA_HORARIA_AUTOMATIZACIONES; a console test for the /cron 400 message) as low-cost hardening before or during CH-17, which already touches the scheduler.

### Verdict

**PASS WITH WARNINGS**

536/536 tests pass (two independent runs), tsc --noEmit, npm run build and npx prisma validate are all clean, all 7 AGENTS.md non-negotiable rules hold under direct code inspection, all 7 DEC-74..DEC-80 decisions plus both design-level resolutions are registered and firm, and 34/36 spec scenarios are fully runtime-compliant. The remaining 2 scenarios are non-blocking, project-convention-consistent gaps confirmed correct by static inspection (server-boot wiring, .env.example content), plus one known pre-flagged console-message test gap. No CRITICAL finding blocks archive.
