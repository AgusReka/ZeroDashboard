```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:10b8c14a37b02ad58c417692a6767301cb46dbc580eaa5494cb3322d81f49fc3
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 18/18
scenarios: 35/35
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:23989b61092de6ad9c273a4c54bafe56a02e5ea155a5423ec6026d54125c8c89
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:cdab4d00374babb80b5108285b4b859731dcfcb446f462822a095eba9a576a8e
```

## Verification Report

**Change**: CH-06-tenants-and-isolation
**Version**: N/A (no spec-version scheme in this project)
**Mode**: Standard (Strict TDD not active)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 39 |
| Tasks complete | 39 |
| Tasks incomplete | 0 |

Every task in `tasks.md` (1.1-1.8, 2.1-2.15, 3.1-3.7, 4.1-4.9) is checked [x]. Cross-checked against the actual source tree: the artifacts each task claims (migration, src/tenants.ts, src/contexto-tenant.ts, src/aislamiento-prisma.ts, src/tenants.test.ts, src/aislamiento.test.ts, retyped route files, console edits, scripts/smoke.sh, docs/01-decisiones.md resolutions, bitacora entry) all exist and match the described content. No discrepancy found between checked-off tasks and code state.

### Build and Tests Execution

**Build**: PASSED (exit 0)
```text
npm run build
tsc -p tsconfig.json
(no errors, exit 0)
```

**Tests**: 129 passed / 0 failed / 0 skipped (re-executed independently in this verify session, live PostgreSQL 16 via Docker Compose, TEST_DB_HOST=localhost TEST_DB_PORT=5432)
```text
npm test
tests 129
suites 16
pass 129
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 4311.1067
```
Ran twice in this session: once immediately after docker compose up -d db with the port unpublished, which correctly surfaced the DB as unreachable from the host rather than a false pass; and once after publishing port 5432 via a temporary Compose override, where all 129 ran and passed. src/aislamiento.test.ts alone was also run in isolation (19/19 pass), confirming the T2 sweep and the aplicarAlcance unit tests independently of suite-parallelism effects.

**Smoke**: PASSED. npm run smoke executed the full Docker Compose stack end to end (fresh build, fresh containers) and printed SMOKE TEST PASSED, covering CH-01/03/04/05 regression sections plus new CH-06 sections: tenant alta/listado, header envelopes (400/404), the T2 second-tenant sweep (empty list and 404 on get-by-id/prueba/ejecutar), and DEC-14 baja freezing every scoped route with 409. The Compose stack was torn down by the script on completion by design; the db container was restored afterward to leave the environment as found.

**Coverage**: Not applicable. This project has no configured coverage threshold or tool; test evidence is scenario-level (node:test plus app.inject() against live Postgres, no mocking), matching the standing project convention.

### Spec Compliance Matrix

**tenant-management** (4 requirements / 8 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Tenant Registration (Alta) | Registering a valid tenant | tenants.test.ts: 3.1 a valid alta creates an active tenant and echoes the record | COMPLIANT |
| Tenant Registration (Alta) | Rejecting an incomplete registration | tenants.test.ts: 3.1 an alta without nombre is rejected and creates no row | COMPLIANT |
| Listing Active Tenants | Listing existing active tenants | tenants.test.ts: 3.1 the listing returns the active tenants that exist | COMPLIANT |
| Listing Active Tenants | Deactivated tenant excluded from default listing | tenants.test.ts: 3.1 a deactivated tenant leaves the default listing and returns with the flag | COMPLIANT |
| Logical Deactivation Fully Freezes a Tenant | Deactivating an active tenant preserves its rows | tenants.test.ts: 3.1 a baja flips activo to false and preserves the tenant rows | COMPLIANT |
| Logical Deactivation Fully Freezes a Tenant | An operation naming a deactivated tenant is rejected | tenants.test.ts: 3.1 every operation naming a deactivated tenant is rejected before its query; smoke section baja to 409 on every scoped route | COMPLIANT |
| Logical Deactivation Fully Freezes a Tenant | Deactivating an already-inactive tenant is safe | tenants.test.ts: 3.1 repeating the baja answers 409 tenant-desactivado, with no second transition | COMPLIANT |
| No Reactivation or Editing | No reactivation endpoint exists | tenants.test.ts: 3.1 no route reactivates a tenant | COMPLIANT |

**tenant-isolation** (4 requirements / 7 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Active Tenant Must Be Resolvable Before Any Scoped Query | Request without a resolvable active tenant | contexto-tenant.test.ts: 2.1 a scoped route with no X-Tenant-Id answers 400 tenant-no-indicado | COMPLIANT |
| Active Tenant Must Be Resolvable Before Any Scoped Query | Request naming an unknown tenant id | contexto-tenant.test.ts: 2.1 an unknown tenant id answers 404 tenant-no-encontrado | COMPLIANT |
| Active Tenant Declared Explicitly Per Request (DEC-15) | Two sequential requests with different active tenants | contexto-tenant.test.ts: 2.1 two sequential requests with different tenants stay scoped to their own (DEC-15) | COMPLIANT |
| Every Scoped Query Is Filtered by the Active Tenant (DEC-13) | Reading another tenant connection or saved query | aislamiento.test.ts: 3.3 GET /consultas-guardadas/:id answers 404 for the other tenant id, both ways; 3.3 POST /conexiones/:id/prueba answers 404 for the other tenant id, both ways | COMPLIANT |
| Every Scoped Query Is Filtered by the Active Tenant (DEC-13) | Listing returns only the active tenant rows | aislamiento.test.ts: 3.3 the listing never shows the other tenant saved queries | COMPLIANT |
| Cross-Tenant Isolation Is Proven by an Automated Test (T2) | Full two-tenant route sweep | aislamiento.test.ts full suite, 12 tests, route by tenant sweep table | COMPLIANT |
| Cross-Tenant Isolation Is Proven by an Automated Test (T2) | Database unreachable | aislamiento.test.ts TCP preflight via net.connect driving describe with skip motivoSkip | COMPLIANT |

**domain-data-model** (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Tenant Table With an Active Flag | Migrating a fresh own database | prisma/schema.prisma adds activo Boolean default true, plus prisma/migrations/20260917000000_tenant_activo/migration.sql applied cleanly in this session, prisma migrate deploy reported no pending migrations, confirming a prior clean apply | COMPLIANT |
| Tenant Table With an Active Flag | Re-running migrations over an already-seeded database | Bitacora V-1: psql confirmed the pre-existing seeded Tenant row backfilled activo=t, no row dropped, no error | COMPLIANT |

**connection-registration** (2 requirements / 4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Connection Registration Persists Against the Active Tenant | Registering a valid connection | conexiones.test.ts, updated with X-Tenant-Id header, all passing | COMPLIANT |
| Connection Registration Persists Against the Active Tenant | Rejecting an incomplete registration | conexiones.test.ts existing coverage, unchanged behavior | COMPLIANT |
| Connection Registration Persists Against the Active Tenant | No active tenant resolvable | contexto-tenant.test.ts header-envelope tests reject before the handler runs, all routes including POST /conexiones | COMPLIANT |
| Connectivity Test Is Scoped to the Active Tenant | Testing another tenant connection | aislamiento.test.ts: 3.3 POST /conexiones/:id/prueba answers 404 for the other tenant id, both ways | COMPLIANT |

**saved-queries** (3 requirements / 9 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Creating a Saved Query | Creating a valid saved query | consultas-guardadas.test.ts: 2.2 a valid create persists the full row, readable by get-by-id | COMPLIANT |
| Creating a Saved Query | Saving a query with a name already in use | consultas-guardadas.test.ts: 2.8 two saved queries may share a nombre, and both persist independently | COMPLIANT |
| Creating a Saved Query | No active tenant resolvable | contexto-tenant.test.ts header-envelope rejection covers POST /consultas-guardadas | COMPLIANT |
| Listing Saved Queries Returns Metadata Only | Listing metadata-only rows for the active tenant | consultas-guardadas.test.ts: 2.6 no list row carries sql, and the stored statement is not in the payload | COMPLIANT |
| Listing Saved Queries Returns Metadata Only | Another tenant saved queries are excluded | aislamiento.test.ts: 3.3 the listing never shows the other tenant saved queries | COMPLIANT |
| Listing Saved Queries Returns Metadata Only | Listing when no saved query exists | consultas-guardadas.test.ts: 2.6 an empty listing is 200 with an empty array, never an error | COMPLIANT |
| Retrieving a Saved Query by Id | Retrieving an existing saved query | consultas-guardadas.test.ts: 2.2 a valid create persists the full row, readable by get-by-id | COMPLIANT |
| Retrieving a Saved Query by Id | Retrieving another tenant saved query | aislamiento.test.ts: 3.3 GET /consultas-guardadas/:id answers 404 for the other tenant id, both ways | COMPLIANT |
| Retrieving a Saved Query by Id | Retrieving an unknown id | consultas-guardadas.test.ts: 2.9 an unknown id answers a legible 404, with no driver error or stack | COMPLIANT |

**query-execution** (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Connection Lookup for Execution Is Scoped to the Active Tenant | Executing against another tenant connection | aislamiento.test.ts: 3.3 POST /consultas/ejecutar answers 404 for the other tenant id, both ways; 3.3 executing against the other tenant sends no statement to its target | COMPLIANT |
| Connection Lookup for Execution Is Scoped to the Active Tenant | Executing against the active tenant own connection is unaffected | aislamiento.test.ts: 3.3 POST /consultas/ejecutar still works against the caller own id; full consultas.test.ts suite unchanged and green | COMPLIANT |

**query-console** (3 requirements / 3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Permanent Active-Tenant Indicator (T4) | Indicator is always visible | Bitacora V-7: /consola embedded script extracted byte for byte and executed against a minimal DOM stub, indicator never left blank | PARTIAL |
| Tenant Selector | Switching the active tenant | Bitacora V-7 same DOM-stub run, selector change updates the indicator and clears the results table and list | PARTIAL |
| Active Tenant Forwarded on Every API Call (DEC-15) | Selection carries through to a query action | Bitacora V-7 DOM-stub pedir wrapper check plus npm run smoke CH-06 sections, which exercise the same header-forwarding contract via direct curl calls | COMPLIANT |

**Compliance summary**: 35/35 scenarios have covering evidence and passed. 33/35 via executable node:test assertions re-run live in this session, 2/35 (console indicator-visibility and selector-switch scenarios) via a documented DOM-stub script execution rather than a real browser, the same pattern CH-05 used, not a gap unique to this change. Marked PARTIAL rather than UNTESTED or FAILING because real code executes and the claims are verifiably true against a DOM stub, but real HTML parsing and layout are out of this environment reach, no browser available, which is the residual limitation task 4.8 itself declares.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Fail-closed extension: no context means throw, never unfiltered | Implemented | Read src/aislamiento-prisma.ts directly: exigirTenantActivo() is called and can throw before query(args) is ever reached inside allOperations. Confirmed by test 3.6 a scoped query outside any tenant context rejects and runs nothing, re-run and passing in this session |
| Closed operation allowlist rejects unlisted ops such as upsert | Implemented | aplicarAlcance() ends in throw new ErrorAislamientoNoSoportado(operacion) for anything not in the filter set, the unique set, create, createMany or createManyAndReturn. Confirmed by unit test an unlisted operation throws instead of passing through, re-run and passing |
| AND-wrapping, not spreading, on filter operations | Implemented | The filter branch returns where: AND of the existing where and a tenantId object, so a caller tenantId or OR cannot displace the injected predicate. Confirmed by unit test a caller tenantId or OR cannot displace the injected predicate |
| POST /conexiones propertyNames guard, the real bug found during apply | Implemented | src/conexiones.ts registroConexionSchema now carries the same propertyNames enum CH-05 already had on registroConsultaGuardadaSchema. Confirmed by test 3.5 a body carrying tenantId is still 400 on both create routes, and by the smoke section covering rule 2 on both create routes |
| 503 tenant-no-inicializado removed, not aliased | Implemented | Searching src/conexiones.ts and src/consultas-guardadas.ts finds tenant-no-inicializado only inside explanatory comments, never as a live response code |
| tenant.findFirst placeholder removed | Implemented | No findFirst call remains in either route file |
| Registration order, registrarContextoTenant before route registration | Implemented | src/server.ts calls it first, per design.md decision 2 |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| DEC-13/14/15 design-level resolutions: header transport, exemption allowlist, failure envelopes, allowlist mechanics | Yes | Recorded verbatim under Resoluciones de nivel diseno bajo DEC-13, DEC-14 y DEC-15 (CH-06) in docs/01-decisiones.md, matching design.md and the shipped code |
| X-Tenant-Id header, closed exemption list matched on route pattern | Yes | src/contexto-tenant.ts esExenta() matches request.routeOptions.url exactly, not a raw prefix; tested explicitly by the exemption matches the route pattern, not a URL prefix |
| Extended client type propagated as PrismaAislado, no raw client kept in scope | Yes | src/server.ts holds only the extended client; src/health.ts and src/tenants.ts were also retyped, undocumented in tasks.md but required to compile, disclosed transparently in the apply-progress record |
| conTenantInyectado() type-only helper, a design gap resolution | Yes, disclosed deviation | Not in the original design.md; a reasonable resolution to a real Prisma typing limitation where the extension rewrites args at runtime but not the generated input types, documented in the apply-progress record and bitacora friction 1 |
| Testing convention: raw client for fixtures and cleanup, extended client for the app under test | Yes | Confirmed by reading aislamiento.test.ts |
| POST /tenants/:id/baja, not DELETE, no reactivation route | Yes | src/tenants.ts matches design.md decision 5 exactly |

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. Task 4.8, the query-console T4 manual and visual verification, was completed via a DOM-stub script execution against the extracted /consola inline script, not a real browser. This is a genuine, disclosed, and reasonable substitute given no browser is available in this environment, the same pattern CH-05 already established as project precedent, and the three specific T4 claims, indicator never blank, tenant switch clears state, hostile name renders as text, were all verifiably exercised. It does not cover real HTML parsing, CSS layout, or actual DOM rendering. Recommendation: acceptable residual gap for archive, not a blocker, but it should remain flagged as an open item in the bitacora, where it already is as friction 6, so a future change with real browser tooling available can close it properly rather than being silently forgotten.
2. Three implementation deviations from design.md were necessary and are disclosed in the apply-progress record and bitacora: the conTenantInyectado() type-only helper, registrarContextoTenant taking PrismaAislado instead of PrismaClient, and src/health.ts plus src/tenants.ts needing retyping. None break any spec requirement, all are mechanical consequences of Prisma's type system rather than scope or behavior changes, but design.md itself was not updated to reflect them. Low risk, purely a documentation-completeness note.

**SUGGESTION**:
1. Consider adding a lightweight headless-DOM dependency such as jsdom in a future change so T4-style console assertions can become part of the automated npm test run rather than an ad-hoc apply-time verification step repeated by hand each time.
2. The default docker compose up -d db command, which publishes no host port, versus the host-side TEST_DB_* defaults of localhost:5432, is a friction point this verify session hit directly: the first npm test run in this session showed the whole live-database suite reporting the database as unreachable at localhost:5432 until a port-publishing override was applied. Documenting the required override command, or adding it to docker-compose.yml for local development gated by an env flag, would remove this trap for the next contributor or verifier.

### Regression Check (CH-03/CH-04/CH-05, single active tenant)

Read src/conexiones.ts, src/consultas-guardadas.ts and src/consultas.ts end to end: every CH-03/04/05 handler's business logic is unchanged (probe logic, SQL sanitization, pagination, error classification, credential redaction). The only changes are the parameter retype from PrismaClient to PrismaAislado, deletion of the tenant.findFirst and 503 placeholder block, and the new propertyNames bug fix on POST /conexiones. All three existing suites, conexiones.test.ts, consultas-guardadas.test.ts and consultas.test.ts, pass unchanged in this session's npm test run, with only a header addition, X-Tenant-Id, at the test-harness level, exactly matching the proposal's own success criterion that CH-03/CH-04/CH-05 behavior is unchanged for a single active tenant.

### Verdict

PASS WITH WARNINGS

All 18 requirements and 35 scenarios across the 7 spec deltas have covering evidence; 129/129 tests pass against live PostgreSQL, independently re-executed twice in this session; the build is clean; and npm run smoke passes end to end on the real Docker Compose stack. Zero CRITICAL findings. The two WARNINGs, T4's DOM-stub-only console verification and undocumented-in-design.md but disclosed and necessary implementation deviations, are residual, previously-acknowledged, non-blocking gaps that do not represent unmet spec requirements or code/task mismatches. Recommended for sdd-archive.
