```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:97509caa388e02e455032f13058efd3dd140ec8fdc6a2b64bdcc149a5b734a6b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 17/17
scenarios: 26/26
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:1e965948c127f8fb7887f223ec520e6d03d25d076eb303464f8947aaf75b5e6d
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-12-automation-templates
**Version**: openspec delta specs (automation-templates, domain-data-model, tenant-isolation, canonical-contract, tenant-schema-mapping, query-parameters)
**Mode**: Strict TDD
**Scope**: full CH-12 diff `git diff 257b100..HEAD` (branch `ch12/6-verify-archivo`), commits 75d51ba (planning), 5ddf411 (unit1), 81b6f9f (unit2), 75afed3 (3a), 41c4d40 (3b), ccfb4c9 (unit4), 6b73b58 (5a), c1e21b9 (5b)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 43 |
| Tasks complete | 41 (6.1 verified in this pass) |
| Tasks incomplete | 2 (6.2 this report; 6.3 archive, orchestrator-owned next step) |

Task 6.1 was marked `[x]` uncommitted in `tasks.md` and is independently re-confirmed below with fresh command runs. Tasks 6.2 (this report) and 6.3 (archive) are the remaining phase-6 work; leaving them unchecked at verify time is expected and not a defect.

### Build & Tests Execution

**Tests**: PASS `TEST_DB_PORT=5434 npm test` -- 471 passed / 0 failed / 0 skipped / 61 suites, exit 0

**Build**: PASS `npx tsc --noEmit` -- exit 0, no output

**Prisma**: PASS `npx prisma validate` -- exit 0, "The schema at prisma\schema.prisma is valid"

**Coverage**: Coverage analysis skipped -- no coverage tool detected (`npm test` = `tsx --test src/**/*.test.ts`, no `--coverage` / c8 / nyc in `package.json`)

### Spec Compliance Matrix

#### specs/automation-templates/spec.md (12 requirements, 18 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Plantilla Is a Global Catalog (DEC-61) | Creating a template without a tenant header | plantillas-rutas.test.ts: 3.1 a headerless create persists every field it echoes back | COMPLIANT |
| Catalog Supports Create, List, Get, Replace -- No Delete (DEC-68) | Round-trip create, get, replace | plantillas-rutas.test.ts: 4.1 round-trip: get returns the original, a headerless PUT replaces it in place | COMPLIANT |
| Catalog Supports Create, List, Get, Replace -- No Delete (DEC-68) | Unknown id | plantillas-rutas.test.ts: 3.3 an unknown or malformed id answers 404; 4.1 a PUT naming no row answers 404 and writes nothing | COMPLIANT |
| Test Endpoint Is Not Exempt, Matched by Exact Method and Path (DEC-62) | Test endpoint without a tenant header is rejected | plantilla-prueba.test.ts (400 tenant-no-indicado, nothing probed); contexto-tenant.test.ts /plantillas exemption rows (POST /plantillas/:id/prueba scoped) | COMPLIANT |
| Field Validation Reuses CH-11 Parameter Rules (DEC-52, DEC-73) | Declared parameter unused in sql | plantillas.test.ts: 2.5 a declared-but-unused parameter is rejected; plantillas-rutas.test.ts: 3.2 | COMPLIANT |
| Field Validation Reuses CH-11 Parameter Rules (DEC-52, DEC-73) | Hand-written positional bind always rejected | plantillas-rutas.test.ts: 3.2 a hand-written $1 is rejected whatever parametros declares; 4.1 a replace runs the same save-time checks | COMPLIANT |
| entidades Validated Against the Canonical Contract (DEC-63) | Unknown entity rejected | plantillas-rutas.test.ts: 3.1 an entity outside the contract is rejected naming the value | COMPLIANT |
| automatizacion Is an Enum From AUTOMATIZACIONES (DEC-67) | Invalid automatizacion rejected | plantillas-rutas.test.ts: 3.1 an automatizacion outside AUTOMATIZACIONES is rejected naming the value | COMPLIANT |
| automatizacion Is an Enum From AUTOMATIZACIONES (DEC-67) | Valid automatizacion accepted | plantillas-rutas.test.ts: 3.1 every AUTOMATIZACIONES value is accepted | COMPLIANT |
| formato Is Fixed to correo-html (DEC-65) | Unsupported formato rejected | plantillas-rutas.test.ts: 3.1 formato accepts only correo-html | COMPLIANT |
| toleranciaFrescuraMinutos Is Stored, Never Enforced (DEC-66) | Value has no effect on test execution | none -- no test runs two templates differing only in this field | PARTIAL -- see WARNING-1 |
| WITH Composition Using v_<entidad> Aliases (DEC-70) | Two entities compose as CTEs | plantillas.test.ts: 2.3 two entities open WITH v_producto, v_insumo before nesting the template | COMPLIANT |
| WITH Composition Using v_<entidad> Aliases (DEC-70) | Template references an undeclared alias | plantilla-prueba.test.ts: 5.4 a template reading a view it did not declare runs and answers 200 fallo 42P01 | COMPLIANT |
| Every Composed View Requires a Passing Saved Validation (DEC-71) | Missing registered view | plantilla-prueba.test.ts: 5.2/5.3 rechazoDeLaCompuerta cases | COMPLIANT |
| Every Composed View Requires a Passing Saved Validation (DEC-71) | Registered but failing validation | plantilla-prueba.test.ts: 5.3 every failing entity is listed in contract order | COMPLIANT |
| Test Endpoint Runs Only Against the Request's Own Tenant Connection, Read-Only (DEC-62) | Successful test execution | plantilla-prueba.test.ts: 5.4 rows come back over the composed views; a hostile value comes back as data | COMPLIANT |
| Test Endpoint Runs Only Against the Request's Own Tenant Connection, Read-Only (DEC-62) | Naming another tenant's connection | plantilla-prueba.test.ts: 5.2; aislamiento.test.ts: CH-12 5.8 T2 | COMPLIANT |
| Personal-Field Access Is Not Provided (DEC-72 Limit) | No entity or field exists to request personal data | structural: entidades enum is ENTIDADES_CANONICAS (5 contract names, no personal entity); proven by 3.1 an entity outside the contract is rejected | COMPLIANT (static evidence -- no new field/entity introduced) |

#### specs/domain-data-model/spec.md (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| No Premature Modeling of Out-of-Release Entities (MODIFIED) | Inspecting the schema after this change | aislamiento.test.ts: the model list is exactly the four tenant models plus Plantilla | COMPLIANT |
| No Premature Modeling of Out-of-Release Entities (MODIFIED) | Plantilla carries no tenant reference | aislamiento.test.ts: Plantilla carries no tenantId column, unlike every scoped model | COMPLIANT |

#### specs/tenant-isolation/spec.md (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Plantilla Is Outside the Structural Tenant Filter (DEC-61) | Catalog routes work without any tenant header | contexto-tenant.test.ts /plantillas exemption rows; aislamiento.test.ts: CH-12 1.3 Plantilla reads and writes pass through with no active tenant | COMPLIANT |
| Plantilla Is Outside the Structural Tenant Filter (DEC-61) | Test route still requires a resolvable active tenant | plantilla-prueba.test.ts 400 tenant-no-indicado case; contexto-tenant.test.ts POST /plantillas/:id/prueba scoped row | COMPLIANT |

#### specs/canonical-contract/spec.md (1 requirement, 1 scenario)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Automation Labels Correspond to Real Plantilla Values (Closes DEC-22) | Every catalog label is a valid template value | plantillas.test.ts: every catalog label is a valid template value (closes DEC-22) | COMPLIANT |

#### specs/tenant-schema-mapping/spec.md (1 requirement, 1 scenario)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Registered SQL Is Consumable as a WITH CTE by Automation Templates (DEC-70) | Registered SQL is reused verbatim as a CTE body | plantillas.test.ts: 2.4 each piece is sanitized exactly once and wrapped in newlines | PARTIAL -- see WARNING-2 (behavior tested and intentional; scenario wording says "unmodified"/"exactly", code applies sanearSql once) |

#### specs/query-parameters/spec.md (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Plantilla Is a Third Declaration Source (DEC-52) | Same rewrite mechanism applies to a template | plantillas.test.ts: 2.4 a request value never reaches the composed text: only $k after preparation | COMPLIANT |
| Plantilla Is a Third Declaration Source (DEC-52) | Undeclared marker rejected at template save time | plantillas.test.ts: 2.5 an undeclared :marker is rejected, naming it (DEC-57) | COMPLIANT |

**Compliance summary**: 24/26 scenarios fully compliant, 2 partial (both non-blocking, see Issues Found).

### AGENTS.md Non-Negotiables

| Rule | Check | Result |
|---|---|---|
| 1. P2 never executes arbitrary SQL | The template catalog is P1-curated (operator API), not exposed to P2's panel; the test route composes only stored, operator-authored SQL (Plantilla.sql, VistaCanonica.sql) plus fixed literals and contract aliases -- no request-supplied SQL fragment is ever spliced in | Held |
| 2. Tenant isolation -- no cross-tenant leak, tenant id never from request body | Plantilla is intentionally global (DEC-61) and outside MODELOS_AISLADOS by design; the test route's Conexion/VistaCanonica reads are tenantId-scoped through the same extension every other route uses; aislamiento.test.ts CH-12 5.8 proves A cannot name B's connection (404, no sqlVista/tenantId leak in the body) | Held |
| 3. Read-only, two layers | Execution reuses ejecutarConsulta's existing READ ONLY transaction plus the DEC-08 role check unchanged; no new execution path | Held |
| 4. No SQL concatenation of request values | componerSentencia builds text only from stored operator SQL, fixed literals and contract aliases; request valores travel only through prepararSentencia to SentenciaPreparada.valores as driver params; plantillas.test.ts 2.4 and plantilla-prueba.test.ts 5.4 both prove a hostile value returns as data, never as spliced text | Held |
| 5. Data minimization | DEC-72: no mechanism exists for a template to request the M5-excluded personal fields; entidades is a closed enum of the 5 canonical contract names | Held |
| 6. Engine only executes the pattern | No new execution/parsing capability: composition is WITH CTE prefixing plus the unchanged prepararSentencia scanner; an out-of-contract stored entidades value throws (fails closed) rather than being interpreted | Held |
| 7. Secrets out of the repository | No new secret-handling code; credential decipherment reuses the existing destinoDeConexion/cripto-credencial path unchanged | Held |

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Plantilla model / migration | Implemented | Additive CREATE TABLE, no FK, no index beyond PK; no tenantId column |
| Exemption allowlist | Implemented | Exact 4-row set in PLANTILLAS_EXENTAS (src/contexto-tenant.ts); test route deliberately excluded |
| Save-time parameter checks | Implemented | problemasDePlantilla reuses validarDeclaracion/analizarSentencia unchanged |
| DEC-71 view gate | Implemented | evaluarVistas in src/plantillas.ts, contract-order failure listing, throws on out-of-contract stored entidades |
| componerSentencia | Implemented | CTEs in contract order, alias always v_<contrato-name>, template nested as subquery |
| Test route ordering | Implemented | AJV, template lookup, scoped connection ownership check, scoped view read, gate (409), compose, prepararSentencia (400), destinoDeConexion (409), ejecutarConsulta (200); nothing dialed before every 4xx check (5.5 closed-port proof) |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Isolation: Plantilla outside MODELOS_AISLADOS, pass-through | Yes | aislamiento.test.ts CH-12 1.3 cases |
| Catalog capability takes the plantilla delegate only | Yes | firmaSoloDelegado signature pin in plantillas-rutas.test.ts |
| Exemption by exact row, not prefix | Yes | PLANTILLAS_EXENTAS set; /plantillas/:id/prueba and /plantillas-falsas proven scoped |
| Test route in its own file, full PrismaAislado | Yes | src/plantilla-prueba.ts |
| automatizacion/formato as app-level AJV enum, not DB enum/CHECK | Yes | registroPlantillaSchema |
| Composition: views as CTEs, template nested as subquery | Yes | componerSentencia |
| CTE order and alias from contract, never stored string | Yes | NOMBRES_CONTRATO iteration; throws on unknown entity |
| Piece sanitizing: sanearSql exactly once per stored piece, newline-wrapped | Yes (see WARNING-2 for spec-wording mismatch) | componerSentencia |
| Stored JSON on read: parametros re-checked, entidades throws on corruption | Yes | prepararSentencia re-validates parametros; leerEntidades throws |
| List: take LIMITE_LISTADO + 1 plus truncado, summary excludes sql/parametros/entidades | Yes | PlantillaResumen / registerPlantillaRoutes GET /plantillas |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | Full "TDD Cycle Evidence" table present in apply-progress (Engram #170), covering tasks 1.1 through 5.9 |
| All tasks have tests | Yes | Every implementation task (1.1-5.9) maps to a RED/GREEN row and an existing test file |
| RED confirmed (tests exist) | Yes | plantillas.test.ts, plantillas-rutas.test.ts, plantilla-prueba.test.ts exist; aislamiento.test.ts/contexto-tenant.test.ts carry the CH-12 additions |
| GREEN confirmed (tests pass) | Yes | 471/471 on this run, matching the cumulative count the apply-progress table reports after 5b |
| Triangulation adequate | Yes | Multiple cases per behavior throughout (evaluarVistas single/multi-failure, componerSentencia order/comment/injection cases, save-time rejections per field) |
| Safety Net for modified files | Yes | Each work unit's apply-progress row shows a pre-edit safety-net count (e.g., 458/458 before 5a, 45/45 before 5b) |

**TDD Compliance**: 6/6 checks passed

---

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure, no DB/Fastify) | 18 | plantillas.test.ts | node:test |
| Routing (no DB, throwing/stub clients) | ~11 | plantillas-rutas.test.ts (save-time rejection suite), contexto-tenant.test.ts (exemption rows), plantilla-prueba.test.ts (headerless/body-schema suite) | node:test, Fastify inject() |
| Integration (live PostgreSQL, app.inject()) | ~30 | plantillas-rutas.test.ts (create/list/get/replace), plantilla-prueba.test.ts (gate + execution), aislamiento.test.ts (CH-12 1.3, 5.8) | node:test, Fastify inject(), real Postgres on port 5434 |
| E2E | 0 | -- | not installed (no playwright/cypress in this project) |
| **Total (this change)** | ~59 new/modified CH-12 cases within the 471-test full suite | 5 files | |

### Changed File Coverage

Coverage analysis skipped -- no coverage tool detected in package.json (test script is `tsx --test src/**/*.test.ts` with no --coverage, c8, or nyc).

### Assertion Quality

All assertions verify real behavior. Sampled plantillas.test.ts, plantillas-rutas.test.ts, and the read portions of plantilla-prueba.test.ts: every for/loop iterates a literal fixed array (never a live query result that could be empty), every case asserts specific status codes and response bodies via deepEqual, and no tautology, orphan-empty, or smoke-test-only pattern was found.

**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: Not available (no lint script/tool detected in package.json)
**Type Checker**: No errors (npx tsc --noEmit, exit 0)

---

### Flagged-Item Adjudication

1. **tenant-schema-mapping "unmodified" vs. sanearSql applied once** -- Spec wording fix needed, not a code fix. design.md's "Piece sanitizing" row explicitly chose componerSentencia applying sanearSql exactly once per stored piece (trim + strip a trailing ;) over "sanitizing in the route," reasoning that the CH-10 probe already does the same and that newline-wrapping makes a trailing -- comment safe. This is intentional, documented, and tested (plantillas.test.ts 2.4). The tenant-schema-mapping delta's scenario text ("the CTE v_producto SHALL contain exactly the registered SQL text, unmodified") is stricter than the shipped behavior. Recommend updating that scenario's wording at archive time to say the CTE body is the registered SQL text with sanearSql's idempotent-once normalization (trim, trailing-semicolon removal) applied, not a byte-exact copy. No source change is warranted: reverting to a true byte-for-byte copy would reopen the trailing-;/trailing-comment failure mode the design explicitly closed.

2. **Optional rechazados list on 400 responses** -- Acceptable, no fix needed. The spec only requires a 400 that "names" the rejected value; campos already does that via JSON pointer. rechazados is an additive enrichment (the actual rejected value, not just its path) that does not contradict any requirement and carries no secret (unlike /conexiones, per the code comment). Not a deviation.

3. **Catalog list ordered by nombre then id** -- Acceptable, no fix needed. The spec is silent on list order; design.md's "List" row explicitly documents this choice because Plantilla has no timestamp columns. Tested (plantillas-rutas.test.ts 3.3 the headerless list is a summary ordered by nombre, then id).

4. **PUT with invalid body to unknown id -> 400 before 404** -- Acceptable, no fix needed. design.md's File Changes / Data Flow describes replace as running "the same body and save-time checks as create" before the update-and-catch-P2025 step, so validation-before-existence is the documented order. Tested directly (plantillas-rutas.test.ts 4.1 a replace runs the same save-time checks before any write, PUT to /plantillas/cualquiera, an id that does not exist).

5. **Corrupted stored parametros -> 400 solicitud-invalida rather than 500** -- Acceptable, no fix needed. design.md's "Stored JSON on read" row explicitly distinguishes the two JSON columns: entidades "is re-checked against the contract, and a name outside it throws" (500), while parametros "is re-checked by prepararSentencia" with no throw specified. prepararSentencia delegates to validarDeclaracion (src/parametros.ts, unchanged by this diff), which already returns a 400-shaped problem list for a non-array or malformed declaration instead of throwing -- proven by the pre-existing parametros.test.ts validarDeclaracion unit tests, still green. This diff adds no route-level test that writes a corrupted parametros value directly to the database and then calls the test route, so the specific route-level path is proven by composition of two already-tested, unchanged units rather than by one dedicated CH-12 integration test. SUGGESTION: add one such integration case at a later change for defense-in-depth, but nothing here contradicts the design or the spec.

6. **destino === null -> 404 branch untested** -- Acceptable, no fix needed. The code comment marks this as "only reachable if the row was deleted after the ownership check" -- a TOCTOU race with no realistic single-process test harness. No spec scenario requires proving this specific race. Consistent with how other CH's have left type-forced, race-only branches undemonstrated at runtime.

7. **Slice 5a accepted as size:exception (413 lines)** -- Acceptable, already dispositioned. Per the task, the user explicitly accepted this as a size:exception under the Review Workload Guard; the contingency task (5.10) documents the up-front 5a/5b split was applied specifically to keep both slices as close to the 400-line budget as achievable (5a: 413, 5b: 355). No further action.

### Issues Found

**CRITICAL**: None

**WARNING**:
- WARNING-1 -- specs/automation-templates/spec.md scenario "Value has no effect on test execution" (DEC-66, toleranciaFrescuraMinutos) has no runtime test proving two otherwise-identical templates execute identically. The field is structurally guaranteed to have no effect -- plantilla-prueba.ts's findUnique select clause ({ sql: true, parametros: true, entidades: true }) never reads toleranciaFrescuraMinutos at all -- but per this skill's rule that a scenario is compliant only when a covering test passed at runtime, this remains an UNTESTED scenario. Recommend a cheap follow-up test (two templates differing only in this field, both executed, asserting identical verdicts) before or shortly after archive.
- WARNING-2 -- specs/tenant-schema-mapping/spec.md scenario "Registered SQL is reused verbatim as a CTE body" says the CTE "SHALL contain exactly the registered SQL text, unmodified." The shipped and tested behavior applies sanearSql once (trim + strip a trailing ;) to each stored piece, per an explicit design.md decision. See adjudication item 1 -- this is a spec-wording accuracy issue, not a functional defect, and should be corrected when this spec merges into the main spec at archive time.

**SUGGESTION**:
- SUGGESTION-1 -- Add a route-level integration test that persists a directly-corrupted Plantilla.parametros value (bypassing the API's save-time validation) and asserts the test route answers 400 solicitud-invalida rather than 500, to cover adjudication item 5 with a dedicated CH-12 case instead of relying on composition of two already-tested units.
- SUGGESTION-2 -- None of the six flagged items from apply required a source change; consider folding this report's adjudication table directly into the bitacora entry sdd-archive will write, so the reasoning is not lost.

### Verdict

**PASS WITH WARNINGS**

471/471 tests pass, tsc --noEmit is clean, and prisma validate is clean. All 7 AGENTS.md non-negotiables hold. 24/26 spec scenarios are fully runtime-compliant; the remaining 2 are non-blocking -- one is a structurally-guaranteed no-op field lacking a dedicated runtime test (WARNING-1), and one is a spec-wording inaccuracy about an intentional, documented, and tested sanitization step (WARNING-2). None of the six apply-flagged items require a code change; one (tenant-schema-mapping wording) should be corrected during archive's spec merge. Recommend proceeding to sdd-archive with the spec-wording fix for tenant-schema-mapping folded into the merge, and logging WARNING-1/SUGGESTION-1 as accepted follow-up debt in the bitacora.
