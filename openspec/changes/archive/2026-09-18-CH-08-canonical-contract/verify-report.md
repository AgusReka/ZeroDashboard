```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:509d5d0bb9abd82f2af8281aec703a0a0f263a566779570341d72939ed985c41
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 7/7
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:fc70be42b837dcea4d444d0192cf13b250bcc7392505453b594ae178a8b18546
build_command: npx tsc -p tsconfig.json --noEmit
build_exit_code: 0
build_output_hash: sha256:19eaf43821a7660ec323a87c8457bf74823beb296c39f5e01aa8a683aa50f061
```

## Verification Report

**Change**: CH-08-canonical-contract
**Version**: N/A (no spec-version scheme in this project)
**Mode**: Standard (Strict TDD not active per `openspec/config.yaml`; the apply session ran under Strict TDD by its own internal discipline per apply-progress, but verify mode itself is Standard)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 25 |
| Tasks complete | 25 |
| Tasks incomplete | 0 |

Every task in `tasks.md` (1.1-1.8, 2.1-2.7, 3.1-3.7, 4.1-4.3) is checked `[x]`. Cross-checked against the actual source tree in this session, task by task, not spot-checked, and against Engram `sdd/CH-08/apply-progress` (observation #93):

- **1.1-1.8**: `src/contrato.ts` (258 lines) defines `AUTOMATIZACIONES` as an `as const` object, the derived `Automatizacion` union, `Obligatoriedad`, `CampoCanonico`/`EntidadCanonica` interfaces, and the frozen `CONTRATO_CANONICO` literal for exactly the five entities the proposal's table names. Read directly: every `automatizaciones` entry in every one of the 24 fields references `AUTOMATIZACIONES.STOCK_FISICO` / `.STOCK_PRODUCIBLE` / `.REPORTE_DIARIO` -- no inline string literal appears anywhere in the catalog body (confirms task 1.7 by inspection, independent of the source-grep test in `contrato-rutas.test.ts` 2.6 which checks the route module, not the catalog module). `src/contrato.test.ts` (314 lines) carries the five-entity closed-list check, both entity-level mark checks, the field-mark/automation-membership sweep, the `producto` literal cases, and the personal-field/customer-entity regex sweep (three tests, including a triangulation test that proves the patterns actually fire).
- **2.1-2.7**: `src/contrato-rutas.ts` (33 lines) exports `registerContratoRoutes(app: FastifyInstance): void`, registering only `app.get('/contrato', ...)`, handler body `reply.code(200).send({ contrato: { entidades: CONTRATO_CANONICO } })`, no schema. `src/server.ts` imports it and calls `registerContratoRoutes(app);` immediately after `registerConsolaRoute(app);`, matching the design's data-flow diagram exactly. `src/contrato-rutas.test.ts` (186 lines) covers the full projection, the five-entity/24-field wire shape, `producto`'s literal marks/labels, `POST`/`PUT`/`PATCH`/`DELETE` -> `404`, a request body on `GET` being ignored, and (task 2.6, promoted from inspection to a real test) both `registerContratoRoutes.length === 1` and a source-text sweep of `contrato-rutas.ts` for `aislamiento-prisma`/`PrismaAislado`/`PrismaClient`/`prisma` -- none present.
- **3.1-3.7**: `src/contexto-tenant.ts`'s `esExenta` is widened to the design's exact literal (`metodo === 'GET' && (patron === '/health' || patron === '/consola' || patron === '/contrato')`), and its doc comment is updated with the three-route enumeration plus the DEC-24 paragraph. `src/contexto-tenant.test.ts` adds a dedicated `describe` block (headerless `GET /contrato`, arbitrary-tenant-header `GET /contrato`, byte-equal bodies, `/contrato-falso` negative control, `POST /contrato` negative control) built against a Prisma stub whose `tenant.findUnique` throws -- turning "the handler never resolves a tenant" from an unobservable absence into a failing assertion if it ever happened. A sixth case, "GET /contrato answers the same body with a valid tenant header as with none," lives in the live-PostgreSQL block lower in the same file, closing the spec's third leg (equality against a genuinely valid header) that the DB-free block cannot reach.
- **4.1-4.3**: `git diff --stat 47e493f HEAD -- prisma/ src/aislamiento-prisma.ts` (re-run independently in this session, not trusted from the apply record) returns empty -- `prisma/schema.prisma` is untouched and `MODELOS_AISLADOS` is still `new Set(['Conexion', 'ConsultaGuardada'])`. Full suite re-run in this session: 248/248 pass, 0 fail, 0 skipped.

No discrepancy found between checked-off tasks and code state.

### Build and Tests Execution

**Build**: PASSED (exit 0)
```text
npx tsc -p tsconfig.json --noEmit
(no errors, exit 0)
```

**Tests**: 248 passed / 0 failed / 0 skipped (re-executed independently in this verify session, live PostgreSQL reachable on localhost:5432)
```text
npm test
tests 248
suites 33
pass 248
fail 0
cancelled 0
skipped 0
todo 0
```
This matches the 248/248 figure apply-progress reported at the close of the apply session (observation #93, task 4.3). No live-DB test was skipped in this run, so the full spec compliance matrix below rests on executed assertions, including the DB-dependent third leg of the tenant-exemption requirement (test "3.2 GET /contrato answers the same body with a valid tenant header as with none").

**Smoke**: Not run. This project has no `scripts/smoke.sh` section specific to CH-08 (the change adds no console UI, no migration, and no credential/connection surface for the existing Compose smoke script to exercise), and CH-08's own testing strategy names `node:test` plus Fastify `inject()` as the complete verification surface -- no design or task document names a Docker/Compose smoke run as required evidence for this change, unlike CH-07's row-cap/credential scenarios. Not a gap: nothing in this change's surface (a static module and a database-free route) is reachable only through the Compose stack.

**Coverage**: Not applicable, `coverage_threshold: 0` in `openspec/config.yaml`; test evidence is scenario-level (`node:test` plus Fastify `inject()`, no mocking of the module under test), matching the standing project convention from CH-04 through CH-07.

### Spec Compliance Matrix

**canonical-contract** (5 requirements / 7 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Static Catalog Is the Source of Truth | Inspecting the catalog module | `contrato.test.ts`: "1.1 the catalog contains exactly the five canonical entities, no more and no fewer" (order-asserted); "1.2 producto, pedido and item_pedido are marked obligatorio at the entity level"; "1.2 insumo and receta_componente are marked opcional at the entity level" | COMPLIANT |
| Each Field Is Marked Required or Optional and Names Its Automation | A required entity's required field | `contrato.test.ts`: "1.3 every field across every entity is marked obligatorio or opcional" (24 fields counted); "1.3 every field names at least one automation, and every label is an AUTOMATIZACIONES value"; "1.4 producto.id, producto.nombre and producto.stockDisponible are obligatorio with >=1 automation" | COMPLIANT |
| Each Field Is Marked Required or Optional and Names Its Automation | An optional field on a required entity | `contrato.test.ts`: "1.4 producto.sku and producto.activo are opcional with >=1 automation"; "1.4 an optional entity still carries required fields" (the independence of the two dimensions, both directions) | COMPLIANT |
| Personal Fields Are Structurally Absent | Automated absence check over the catalog | `contrato.test.ts`: "1.5 no entity or field name is named or means domicilio, telefono or correo" (29 names swept: 5 entities + 24 fields); "1.5 no entity is reasonably interpretable as a customer or buyer"; "1.5 the sweep would actually catch a personal field" (triangulation against the two sweeps above) | COMPLIANT |
| Read-Only Endpoint Projects the Catalog | Retrieving the full catalog | `contrato-rutas.test.ts`: "2.1 answers 200 with { contrato: { entidades } } equal to CONTRATO_CANONICO" (deep-equal against the module, not a copied literal); "2.2 lists the five entities, each marked, with every field marked and traced" (24 fields counted over the wire); "2.3 no method other than GET is routed on /contrato" (404 for POST/PUT/PATCH/DELETE); "2.3 a request body on the GET is ignored" | COMPLIANT |
| `GET /contrato` Is Exempt From the Tenant-Context Header | Requesting the catalog without a tenant header | `contexto-tenant.test.ts`: "3.1 GET /contrato answers headerless" (200, five entities, against a throwing-stub Prisma client); "3.3 /contrato-falso with no header is refused, never let through as exempt" (400, proves exact-match discipline) | COMPLIANT |
| `GET /contrato` Is Exempt From the Tenant-Context Header | Requesting the catalog with an arbitrary tenant header | `contexto-tenant.test.ts`: "3.1 GET /contrato answers 200 with a header naming a nonexistent tenant"; "3.2 both answers are byte-for-byte the same body" (headerless vs. nonexistent-tenant-header, raw-text comparison); "3.2 GET /contrato answers the same body with a valid tenant header as with none" (live-DB block, genuinely existing active tenant) -- closes the spec's third leg the DB-free block cannot reach | COMPLIANT |

**Compliance summary**: 7/7 scenarios have covering evidence and passed, all via executable `node:test` assertions re-run live in this session (248/248 including 3 live-PostgreSQL-dependent tests specific to this change's exemption requirement). No PARTIAL or UNTESTED scenario -- unlike CH-07's console-rendering scenarios, this change has no browser-facing surface to disclose a DOM-stub limitation against.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Exactly five entities, correct entity-level marks | Implemented | `CONTRATO_CANONICO` read directly: `producto`/`pedido`/`item_pedido` = `obligatorio`, `insumo`/`receta_componente` = `opcional`, in the proposal's exact order |
| Automation labels are exported constants, never inline literals | Implemented | Every `automatizaciones` entry across all 24 fields references `AUTOMATIZACIONES.*`; no inline `stock-fisico`-style literal appears in `contrato.ts`'s catalog body, confirmed by direct read (DEC-22) |
| Field/entity naming convention (Spanish camelCase fields, snake_case entities, `<entidad>Id` references) | Implemented | `stockDisponible`, `fechaCreacion`, `precioUnitario`, `unidadMedida`, `cantidadPorUnidad`, `pedidoId`, `productoId`, `insumoId` (camelCase); `item_pedido`, `receta_componente` (snake_case) -- matches design's naming decision literally |
| Route registrar takes `app` only, no Prisma parameter | Implemented | `registerContratoRoutes(app: FastifyInstance): void` -- arity 1, confirmed by `contrato-rutas.test.ts` 2.6's `registerContratoRoutes.length === 1` assertion plus a source-text sweep for `aislamiento-prisma`/`PrismaAislado`/`PrismaClient`/`prisma`, none found |
| Payload shape `{ contrato: { entidades } }` | Implemented | `contrato-rutas.ts` handler body matches design's Interfaces/Contracts section verbatim; no `truncado`, no per-request reshaping |
| Exact `esExenta` edit and doc-comment update | Implemented | `src/contexto-tenant.ts` lines 95-113 match design's exact literal; doc comment above `esExenta` enumerates the three routes and states the tenant-agnostic/no-Prisma-client rationale (DEC-24) |
| No schema/migration change | Confirmed | `git diff --stat 47e493f HEAD -- prisma/` is empty, re-run independently in this session |
| `MODELOS_AISLADOS` unchanged | Confirmed | `git diff --stat 47e493f HEAD -- src/aislamiento-prisma.ts` is empty; the set still reads `new Set(['Conexion', 'ConsultaGuardada'])` |
| No personal field, no customer entity, anywhere in the catalog | Confirmed | Direct read of all 5 entity names and 24 field names in `contrato.ts` plus the automated regex sweep in `contrato.test.ts` (1.5, three tests including triangulation) |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Two independent optionality dimensions, one shared `Obligatoriedad` union | Yes | `CampoCanonico.obligatoriedad` and `EntidadCanonica.obligatoriedad` are independently set; `insumo` (optional entity) carries required fields (`nombre`, `stockDisponible`, `unidadMedida`) and one optional field (`codigo`); `producto` (required entity) carries two optional fields (`sku`, `activo`) -- both directions asserted by `contrato.test.ts` 1.4 |
| Automation labels as exported constants, never inline literals | Yes | `AUTOMATIZACIONES` as-const object in `contrato.ts`; `Automatizacion` derived via `(typeof AUTOMATIZACIONES)[keyof typeof AUTOMATIZACIONES]`; every catalog entry references it |
| Field/entity naming convention | Yes | Matches design's stated convention exactly, no deviation found |
| Route signature takes `app` only | Yes | `registerContratoRoutes(app: FastifyInstance): void`, structurally proven by 2.6's arity and source-sweep assertions |
| Exact `esExenta` edit (DEC-24) | Yes | `src/contexto-tenant.ts` condition matches design's exact snippet byte for byte; doc comment updated in the same edit per design's requirement |
| Handler body: `reply.code(200).send({ contrato: { entidades: CONTRATO_CANONICO } })`, no schema | Yes | Matches design's Interfaces/Contracts section; no body/params schema declared |
| Capability boundary: new `canonical-contract` spec, `domain-data-model` untouched | Yes | No delta exists against `domain-data-model`; `openspec/changes/CH-08-canonical-contract/specs/canonical-contract/spec.md` is the sole spec artifact for this change |

### DEC-21 through DEC-24 Compliance (`docs/01-decisiones.md`)

| Decision | Status | Evidence |
|---|---|---|
| DEC-21 -- static code, no DB/migration | Confirmed | `prisma/schema.prisma` byte-identical to pre-CH-08 (`47e493f`); `CONTRATO_CANONICO` is a frozen as-const TypeScript literal, never a Prisma model |
| DEC-22 -- automation labels as exported constants, not inline literals | Confirmed | `AUTOMATIZACIONES` object plus derived union type; zero inline automation-string literals anywhere in `contrato.ts`'s catalog body |
| DEC-23 -- personal fields structurally absent | Confirmed | No domicilio/telefono/correo-meaning field and no customer/buyer entity anywhere in `CONTRATO_CANONICO`'s 5 entities / 24 fields, confirmed by direct read and by the automated regex sweep |
| DEC-24 -- `GET /contrato` exempt from `x-tenant-id`, `MODELOS_AISLADOS` untouched | Confirmed | `esExenta` widened to include `GET /contrato`; `MODELOS_AISLADOS` still reads `new Set(['Conexion', 'ConsultaGuardada'])`, git-diff-confirmed empty against pre-CH-08 |

### Proposal Success Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | `GET /contrato` returns every canonical entity with its fields, each field marked required/optional, and each field naming its automation(s) | Met -- `contrato-rutas.test.ts` 2.1/2.2 |
| 2 | The response contains no field named or meaning domicilio, telefono, or correo, and no customer entity, verified by an automated test | Met -- `contrato.test.ts` 1.5 (structural, not read-only verification) |
| 3 | `prisma/schema.prisma` is byte-identical to its pre-CH-08 state, no migration added | Met -- `git diff --stat 47e493f HEAD -- prisma/` empty |
| 4 | `MODELOS_AISLADOS` is unchanged | Met -- `git diff --stat 47e493f HEAD -- src/aislamiento-prisma.ts` empty |
| 5 | `GET /contrato` answers identically with and without an `x-tenant-id` header | Met -- `contexto-tenant.test.ts` 3.1-3.2, including the live-DB valid-tenant leg |
| 6 | Every entity and field in the catalog is traceable to at least one of stock-fisico, stock-producible, reporte-diario | Met -- `contrato.test.ts` 1.3, by construction of `CampoCanonico.automatizaciones` as a non-empty tuple type, and by the exhaustive per-entity automation-set check |

`proposal.md`'s own checklist retains its unchecked boxes, consistent with this project's convention observed in the archived CH-07 proposal (success-criteria checkboxes are not edited post-hoc; satisfaction is established here, in the verify report, not by editing the proposal).

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. The authored diff (production code + tests, excluding OpenSpec artifacts and `docs/01-decisiones.md`) totals roughly 932 lines across the three commits (`src/contrato.ts` 258, `src/contrato-rutas.ts` 33, `src/server.ts` +5, `src/contexto-tenant.ts` +18/-4, `src/contrato.test.ts` 314, `src/contrato-rutas.test.ts` 186, `src/contexto-tenant.test.ts` +113/-1), exceeding both the 400-line review-workload budget and `tasks.md`'s own forecast (approximately 355 total, "Chained PRs recommended: No", "400-line budget risk: Low"). The forecast undercounted the two catalog/route test files by roughly 145 lines combined. This is a process/forecasting observation, not a code-quality or spec-compliance defect: the three commits are already cut along the three independent rollback boundaries `tasks.md` names (catalog, route, exemption), so a later chained-PR slice remains straightforward if this repository ever routes through PR review. No size-exception was recorded because none was needed for a repository committing directly without an active PR review workflow.
2. The apply session record (Engram `sdd/CH-08/apply-progress`) discloses two prior native attempt-ledger resets, both maintainer-authorized and attributed to the ledger's candidate-wide (not per-attempt) changed-line accounting rather than to any code-quality issue. This verify session found nothing in the shipped code, tests, or commit history suggesting otherwise -- the resets are process history, not a residual risk in the artifact under review, and are recorded here only for traceability against the prior record, matching CH-07's verify-report convention of surfacing such notes rather than silently omitting them.

**SUGGESTION**:
1. `tasks.md`'s line-count forecasting method could weight test files more heavily for future changes with a similar test-to-production ratio (roughly 2:1 here), since both budget overruns in this change's apply history trace to the ledger and the PR-budget forecast undercounting test-file growth, not to production-code scope creep.
2. When CH-12 (Plantilla) lands, the reconciliation DEC-22 anticipates could add a dedicated cross-check test (comparing `AUTOMATIZACIONES` values against real Plantilla rows) rather than relying on manual review alone, closing the drift risk both DEC-22 and this change's own risk table name.

### Regression Check (CH-01 through CH-07)

`npm test` (full suite, 248/248) re-ran every prior change's dedicated test file unchanged and green in this session: `tenants.test.ts`, `contexto-tenant.test.ts` (its pre-CH-08 CH-06 cases plus the new CH-08 block), `consultas-guardadas.test.ts`, `cripto-credencial.test.ts`, `consulta-ejecucion.test.ts`, `consola.test.ts`, `conexiones.test.ts`, `consultas.test.ts`, `config.test.ts`, `conexion-destino.test.ts`, and the tenant-routes live-PostgreSQL integration block. No regression found; the count grew from CH-07's archived 223/223 to 248/248, consistent with CH-08 adding two new test files plus the `contexto-tenant.test.ts` extension.

### Verdict

PASS WITH WARNINGS

All 5 requirements and 7 scenarios in `specs/canonical-contract/spec.md` have covering evidence and passed, re-executed independently in this verify session against live PostgreSQL (248/248 tests, 0 fail, 0 skipped; `tsc --noEmit` exit 0). Every one of DEC-21 through DEC-24's firm constraints is independently confirmed against the actual code and an independent `git diff` against the pre-CH-08 commit `47e493f`, not merely trusted from the apply record. Design's five resolutions (optionality independence, `AUTOMATIZACIONES` const pattern, payload shape, naming convention, the exact `esExenta` edit) and all six of the proposal's Success Criteria are met. Zero CRITICAL findings. The two WARNINGs -- the authored diff exceeding the 400-line review budget and `tasks.md`'s own forecast, and the two maintainer-authorized ledger resets disclosed in the apply record -- are process/traceability observations, not spec-compliance or code-quality defects, and neither blocks archive. Recommended for `sdd-archive`.
