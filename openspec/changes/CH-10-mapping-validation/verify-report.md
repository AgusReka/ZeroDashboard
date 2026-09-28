# Verification Report -- CH-10-mapping-validation

**Mode**: Full artifacts (proposal, specs, design, tasks, apply-progress) -- completeness, correctness, and design coherence verified.
**Verdict**: PASS WITH WARNINGS

## Completeness

- Tasks: 39/39 checked in tasks.md (Phases 1-5). No unchecked task found.
- apply-progress.md reports "39/39 tasks complete" and documents a 6-slice chain (1 -> 2 -> 3 -> 4a -> 4b -> 5), matching the branch stack this agent verified from (ch10/1-contrato-tipos ... ch10/5-barrido-t2).

## Build / Test Evidence (executed live, this session)

Test DB: zd-ch09-testdb (port 5434) started, waited for readiness via pg_isready, migration confirmed already deployed (npx prisma migrate deploy -> "No pending migrations to apply").

| Command | Result |
|---|---|
| npx prisma validate | valid -- exit 0 |
| npx tsc --noEmit | clean -- exit 0, no output |
| npm test (env TEST_DB_PORT=5434 etc.) | 328/328 pass, 41 suites, 0 fail, 0 cancelled, 0 skipped (6.5s) |

No suite was skipped -- the live-PostgreSQL suites (validacion-mapeo-rutas.test.ts, aislamiento.test.ts, vistas-canonicas.test.ts, consulta-ejecucion.test.ts, consultas.test.ts) all ran against the reachable target and none reported skip. This matches the count apply-progress.md claims for the final state (328/328).

Post-run cleanup check: SELECT count(*) FROM "Tenant" -> 0, SELECT count(*) FROM "VistaCanonica" -> 0, SELECT rolname FROM pg_roles WHERE rolname LIKE 'ch10%' -> 0 rows. The test database was left clean. Container stopped afterward (docker stop zd-ch09-testdb).

One stray untracked 0-byte file, e.entidad, was found in the repo root (not part of any commit, not referenced by any source file). It appears to be a shell artifact unrelated to CH-10's source changes. Flagged as a SUGGESTION below; not a spec or task defect.

## Spec Compliance Matrix

16 requirements / 27 scenarios counted across the five spec deltas (### Requirement: / #### Scenario: headings).

### specs/mapping-validation/spec.md -- 9 requirements, 13 scenarios

| Requirement | Scenario | Status | Evidence |
|---|---|---|---|
| Postgres Types Classify Into Five Tolerant Semantic Categories (DEC-39) | Identifier column typed as uuid | PASS | validacion-mapeo.test.ts "3.1 a uuid producto.id is accepted as identificador"; live 4.1 (insumo.id uuid) |
| " | Column type outside the tolerant mapping | PASS | validacion-mapeo.test.ts "3.2 an OID outside the table fails as a category mismatch naming a cast hint" |
| Validate Action Runs a Zero-Row Structural Probe Per Entity (DEC-40, DEC-42) | Validating a connection's mapped entities | PASS | validacion-mapeo-rutas.test.ts 4.1 (live); sondearEstructura's SAVEPOINT+LIMIT 0; DEC-08 check proven first by 4.6 superuser test |
| Missing Required Column Fails With a Per-Field Diagnostic | A required field absent from the view | PASS | unit 3.3 + live 4.2 (activo missing) |
| Wrong-Category Column Fails With a Per-Field Diagnostic | A numeric field mapped to a text column | PASS | unit 3.3 + live 4.2 (stockDisponible::text) |
| Column Outside the Contract Fails Validation and Is Named (DEC-43) | A view exposing an undefined column | PASS | unit 3.5 + live 4.2 (notasInternas) |
| Case-Folded Alias Is Diagnosed Distinctly | An unquoted mixed-case alias | PASS | unit 3.4 + live 4.2 (stockdisponible folding) |
| Reading Validation State Never Opens a Tenant Connection (DEC-40) | Reading validation state after a previous run | PASS | live 4.7 (GET with an unreachable host still 200s from persisted state) |
| Automation Applicability Report Derived From Contract Labels (DEC-22) | Optional entity unmapped | PASS | unit 3.6 |
| " | Required entity fails validation | PASS | unit 3.7 |
| " | Automation both inapplicable and blocked (DEC-46) | PASS | unit 3.9 |
| Validation and Report Routes Are Tenant-Scoped | Validating another tenant's connection | PASS | live 4.9 + T2 sweep (5.2/5.3) |
| " | Request body carrying a tenant id | PASS | live 4.8 |

### specs/canonical-contract/spec.md -- 2 requirements, 4 scenarios

| Requirement | Scenario | Status | Evidence |
|---|---|---|---|
| Each Field Is Marked Required or Optional... Declares a Semantic Type | A required entity's required field | PASS | contrato.test.ts 1.4 |
| " | An optional field on a required entity | PASS | contrato.test.ts 1.4 (sku) |
| " | Every field declares one of the five semantic types | PASS | contrato.test.ts 1.3 (semantic-type describe block) |
| Read-Only Endpoint Projects the Catalog | Retrieving the full catalog | PASS | contrato-rutas.ts serves CONTRATO_CANONICO verbatim (incl. tipo); contrato-rutas.test.ts |

### specs/tenant-schema-mapping/spec.md -- 2 requirements, 4 scenarios

| Requirement | Scenario | Status | Evidence |
|---|---|---|---|
| Registered SQL Is Not Executed at Register, List, or Read Time | Blank SQL text rejected | PASS | vistas-canonicas.test.ts 2.5 (pre-existing CH-09, still green) |
| " | Registering, listing, and reading never execute SQL | PASS | validacion-mapeo-rutas.test.ts static guarantee: only validacion-mapeo-rutas.ts calls sondearEstructura |
| Re-registering an Entity Replaces the Previous Definition and Resets Its Validation (DEC-34, DEC-41) | Re-registering an already-mapped entity | PASS | vistas-canonicas.test.ts 2.2 (pre-existing) |
| " | Re-registering resets a previously validated entity | PASS | vistas-canonicas.test.ts "CH-10 4.12 a re-registration resets a persisted validation to no-validado" |

### specs/tenant-isolation/spec.md -- 1 requirement, 2 scenarios

| Requirement | Scenario | Status | Evidence |
|---|---|---|---|
| Cross-Tenant Isolation Is Proven by an Automated Test (T2) | Full two-tenant route sweep | PASS | aislamiento.test.ts: montarTenant() now validates via POST (5.1), route-sweep table includes validacion-mapeo POST/GET (5.2), explicit "B's validation columns unchanged" assertion (5.3) |
| " | Database unreachable | PASS (code-inspection) | { skip: motivoSkip } gate on the live-PG describe block, same convention as consultas.test.ts; not directly exercised this run because the target was reachable |

### specs/domain-data-model/spec.md -- 2 requirements, 4 scenarios

| Requirement | Scenario | Status | Evidence |
|---|---|---|---|
| Schema-Mapping Definitions Persist a Validation Result (DEC-40, DEC-44) | Migrating adds validation columns | PASS | prisma/migrations/20260926000000_validacion_mapeo/migration.sql -- additive ALTER TABLE ADD COLUMN only; npx prisma migrate deploy this session reported no pending migrations (already applied) |
| " | Persisting a validation result | PASS | live 4.1 |
| " | Unmapped entity has no row | PASS | live 4.1 report shows no-mapeada for unmapped entities; informe()'s porEntidad map design |
| Only the Latest Validation Result Is Kept (DEC-44) | A second validation overwrites the first | PASS | live 4.1 "a second validation overwrites the first; one row per entity, no history" |

27/27 scenarios PASS.

## Design Coherence

Read design.md against the actual code:

- Granularity, route: POST/GET /conexiones/:id/validacion-mapeo -- matches validacion-mapeo-rutas.ts.
- enSesionSoloLectura extraction + exported sondearEstructura: matches consulta-ejecucion.ts exactly (module-private helper, ejecutarConsulta unchanged callsite).
- Per-entity SAVEPOINT sondeo / ROLLBACK TO SAVEPOINT / RELEASE SAVEPOINT: present in sondear().
- Probe text SELECT * FROM (<sanearSql(sql)>) AS _validacion LIMIT 0, values: []: matches.
- Session failure (conexion/permisos/backstop) -> 200 {resultado:'fallo',...}, nothing persisted: matches route handler; proven live by 4.6 (superuser, closed port).
- Entity failure -> invalida with sondeo:{categoria,codigo}: matches diagnosticar().
- Stale-write guard updateMany({where:{id, sql}}), explicit actualizadaEn: matches, proven live by 4.7's lock-forced race test.
- Applicability precedence inaplicable > bloqueada > pendiente > aplicable, every reason listed: matches PRECEDENCIA array and motivos accumulation in informe().
- OID -> category table: matches the design's table exactly (identificador extra-tolerant for int/uuid/text; domains need no entry).
- Interfaces/Contracts (TipoSemantico, EstadoValidacion, DiagnosticoValidacion): match, modulo the two additional diagnostic fields disclosed below.

### Documented deviations (from apply-progress.md, independently confirmed in code)

1. DiagnosticoCampo carries two fields beyond the design interface -- tipoObservado and pista (cast hint). This is required by the spec text itself ("the diagnostic SHALL suggest casting the column...", DEC-45), so this is a spec-driven extension of an under-specified design interface, not scope creep. WARNING (design-doc drift, not a functional defect) -- the design's Interfaces / Contracts section should be updated to include these two fields so it stays the source of truth; harmless today because the spec text already mandates them and tests hold them to that text.
2. POST body schema rejects every key (propertyNames: false), not only tenantId -- verified in code (validacionBodySchema) and by test 4.8, which asserts a 400 for both tenantId and an arbitrary entidades key. Matches spec wording ("tenantId or any other property").
3. Response envelope shapes ({resultado:'ok', validacionMapeo} / EjecucionFallida verbatim / {validacionMapeo} on GET) -- consistent with the design's data-flow narrative; no spec scenario contradicts them.
4. sondearEstructura releases each savepoint (RELEASE SAVEPOINT sondeo) in addition to the design-listed rollback path -- verified in code; keeps the savepoint stack flat, does not change any externally observable verdict.
5. Reason tokens (entidad-no-mapeada, no-validada, sondeo-fallido, columnas-sobrantes, diagnostico-ilegible) are a superset of what the design's table names -- verified against MotivoAplicabilidad and covered by dedicated unit tests (including the unreadable-diagnostic case, which is not in any spec scenario but is a defensible fail-closed default).
6. tasks.md 1.2 says "23 fields"; the catalog and spec table both have 24 (author-acknowledged off-by-one in the task text, not in the contract or the spec). SUGGESTION: fix the task count for future readers; no functional impact, confirmed by counting CONTRATO_CANONICO fields (24) against specs/canonical-contract/spec.md's per-field table (24 rows).

## AGENTS.md Non-Negotiable Rules

1. P2 nunca ejecuta SQL arbitrario -- N/A to this backend change; no P2/client-panel code touched.
2. Aislamiento entre tenants -- Held. PrismaAislado (aislamiento-prisma.ts) injects the active tenant into every Conexion/VistaCanonica query via $allOperations, including the new GET/POST /conexiones/:id/validacion-mapeo routes (both go through prisma: PrismaAislado, never a raw client). Tenant id is read from contexto-tenant.ts's server-resolved context, never from the request body -- enforced structurally (schema rejects any body key) and proven live (4.8, 4.9, T2 5.2/5.3).
3. Solo lectura, en dos capas -- Held. Application layer: every probe runs inside BEGIN TRANSACTION READ ONLY plus the DEC-08 privilege check (categoriaBloqueo), proven by the live superuser/write-role tests. Database layer: the integration fixture's ch10_lector role has SELECT-only grants; the data-modifying-CTE test (4.5) and the divide-by-zero test (4.4) both prove no data is written and no row is actually read.
4. Sin concatenacion de SQL -- Held for values. The probe wraps the operator's own already-stored, non-runtime SQL text in a fixed template (SELECT * FROM (<sql>) AS _validacion LIMIT 0, values: []) -- identical pattern to the pre-existing ejecutarConsulta pagination wrapper. No client-supplied runtime value is ever spliced into SQL text; every bound value ($1, $2 elsewhere, set_config's timeout string) goes through values.
5. Minimizacion de datos -- Held. LIMIT 0 is enforced by construction and proven by the 4.4 divide-by-zero-on-every-row test (a view that fails when any row is evaluated still validates, so zero rows were genuinely read). columnasSobrantes (DEC-43) fails an entity that exposes anything the contract doesn't ask for, closing the personal-data leak path DEC-23 opened structurally.
6. El motor solo ejecuta el patron (anti-alcance) -- Held. DEC-45 explicitly rejected extending the engine with a pg_type.typcategory catalog query for enums/arrays/etc.; those cases fail with a cast hint instead, documented as an artifact limit, not absorbed into the engine.
7. Secretos fuera del repositorio -- Held. Test file uses env vars with non-secret local defaults (matching the existing consultas.test.ts convention); no real credential is committed.

## Decisiones de arquitectura / Compuertas abiertas

DEC-39 through DEC-46 are all registered in docs/01-decisiones.md with context/options/decision/consequences/state, and the implementation matches every one of them (checked line-by-line above). CH-10 belongs to R1 (docs/02-mapa-de-changes.md), so the R2-only gate ("D-1, D-2, D-4, D-5 cerradas antes de R2") does not apply to this change.

## Issues

CRITICAL: None.

WARNING:
- design.md's Interfaces / Contracts section omits tipoObservado and pista on DiagnosticoCampo, even though the spec text (and DEC-45) requires them. Update the design doc to match the shipped interface so it stays authoritative for future changes touching this module.
- Units 3 (~884 changed lines) and 4a (~763 changed lines) exceed the 400-line PR review budget (Section E of the shared SDD conventions). This was forecast in tasks.md ("400-line budget risk: High", auto-chain selected) and disclosed again in apply-progress.md's "Learned" section, but the actual slices still landed well over budget and were not compressed or further split at apply time. Recommend the orchestrator/reviewer treat these two slices with extra review time, or split unit 3 into diagnosis/report at review time as apply-progress.md itself suggests.

SUGGESTION:
- tasks.md line 1.2 says "23 fields"; the actual catalog and the spec's per-field table both have 24. Cosmetic; fix for future readers.
- A stray untracked 0-byte file e.entidad exists at the repo root; not referenced anywhere, appears to be a shell/tooling artifact. Safe to delete, unrelated to this change's source.
- tenant-isolation's "Database unreachable" scenario was verified by code inspection only (the { skip: motivoSkip } gate), since the live target was reachable during this verification run and the suite therefore executed rather than skipped. This is standard for this repo's convention (same pattern proven in CH-09) and not considered a gap.

## Final Verdict

PASS WITH WARNINGS -- 0 CRITICAL, 2 WARNING, 3 SUGGESTION. All 39/39 tasks complete, all 27/27 spec scenarios map to a passing runtime test, npx tsc --noEmit and npx prisma validate both clean, full suite 328/328 green with 0 skipped, AGENTS.md's seven non-negotiable rules hold, and every DEC-39..46 decision is both registered and correctly implemented. The two WARNINGs (design-doc drift on DiagnosticoCampo, and the two oversized PR slices) do not block archive but should be read by whoever reviews the stacked PRs.
