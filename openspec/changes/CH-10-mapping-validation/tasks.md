# Tasks: CH-10 — Mapping Validation

Derived from `design.md`. Verification tasks map to scenarios in `specs/mapping-validation/spec.md`,
`specs/canonical-contract/spec.md`, `specs/tenant-schema-mapping/spec.md`, `specs/tenant-isolation/spec.md`,
and `specs/domain-data-model/spec.md`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1500 total (contrato ~100, schema/migration/consulta-ejecucion ~180, validacion-mapeo pure+tests ~450, validacion-mapeo-rutas+integration+wiring+reset ~700, T2 sweep ~100) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Unit 1 (contract types) → Unit 2 (session primitive + model) → Unit 3 (validation logic, pure) → Unit 4 (validation routes + wiring + reset) → Unit 5 (T2 sweep) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

This change is larger than CH-09's ~700-line precedent: it adds a fifth semantic-type dimension across every
contract field, a session-primitive refactor of `consulta-ejecucion.ts`, a wholly new pure validation/report
module, and an integration route file whose scenario count (missing/wrong-type/extra/alias columns, per-entity
`SAVEPOINT` isolation, the zero-row proof, a data-modifying CTE, permission/connection failure, and a
stale-write race) exceeds CH-09's route file. Unit 4 is expected to be the largest single slice; if it grows
past ~500 changed lines at apply time, split its RED tests into a first PR (routes + core register/read
scenarios) and a second (edge-case scenarios), both still ahead of the T2 sweep. `Chain strategy: pending`
because the orchestrator has not yet chosen stacked-to-main vs. feature-branch-chain; `auto-chain` resolves
`Decision needed before apply` to `No` regardless.

Threat Matrix rows carried as RED tests below: foreign `conexionId` (4.9, 5.2), stored-SQL write-disguised-as-
read (4.5), data exposure via rows/personal columns (4.4, 4.2). The Shell/VCS/PR/file-classification row is
`N/A` per design and is omitted.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `TipoSemantico` + `tipo` per field in `src/contrato.ts` | PR 1 | `npm test -- src/contrato.test.ts` | N/A — static catalog, no route change | Revert `tipo` fields and the type export in `src/contrato.ts`; revert its tests |
| 2 | 3 migration columns on `VistaCanonica`; `enSesionSoloLectura`/`sondearEstructura` in `src/consulta-ejecucion.ts` | PR 2 | `npx prisma validate && npm test -- src/consulta-ejecucion.test.ts src/consultas.test.ts` | N/A — no caller of `sondearEstructura` yet | Revert the schema/migration and the refactor; `ejecutarConsulta`'s existing behavior is pinned by its unedited regression suite |
| 3 | `src/validacion-mapeo.ts` (OID table, diagnosis, report) + unit tests | PR 3 | `npm test -- src/validacion-mapeo.test.ts` | N/A — pure functions, no database | Delete `src/validacion-mapeo.ts` and its test; nothing references it yet |
| 4 | `src/validacion-mapeo-rutas.ts`, `server.ts` wiring, `vistas-canonicas.ts` reset | PR 4 | `npm test -- src/validacion-mapeo-rutas.test.ts src/vistas-canonicas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Delete the routes module and its test; revert `server.ts`'s import/registration line and the reset in `vistas-canonicas.ts`'s `reemplazar()` |
| 5 | T2 sweep extension in `src/aislamiento.test.ts` | PR 5 | `npm test -- src/aislamiento.test.ts` | Same live-PostgreSQL skip convention, full two-tenant sweep | Revert the fixture/sweep/effect additions only; Units 1–4 stay correct without this evidence |

## 1. Contract Type Foundation (`src/contrato.ts`)

- [x] 1.1 Modify `src/contrato.ts`: add `export type TipoSemantico = 'texto'|'numero'|'booleano'|'fecha'|'identificador'` and `tipo: TipoSemantico` on `CampoCanonico` (spec `canonical-contract` "Each Field... Declares a Semantic Type", DEC-39)
- [x] 1.2 Set `tipo` on all 23 fields per the design's per-field table; `id`/`pedidoId`/`productoId`/`insumoId`/`pedido.numero` are `identificador`
- [x] 1.3 RED: `src/contrato.test.ts` — every field across all five entities declares exactly one of the five types; the identifier fields listed above are `identificador` (spec scenario "Every field declares one of the five semantic types")
- [x] 1.4 RED: `src/contrato-rutas.test.ts` — `GET /contrato` projects `tipo` verbatim per field (spec "Read-Only Endpoint Projects the Catalog")
- [x] 1.5 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/contrato.test.ts src/contrato-rutas.test.ts` green

## 2. Read-Only Session Primitive & Domain Model (`prisma/`, `src/consulta-ejecucion.ts`)

- [x] 2.1 Modify `prisma/schema.prisma`: add `estadoValidacion String @default("no-validado")`, `diagnosticoValidacion Json?`, `validadaEn DateTime?` to `VistaCanonica` (spec `domain-data-model` "Persists a Validation Result", DEC-44)
- [x] 2.2 Generate additive migration `prisma/migrations/20260926000000_validacion_mapeo`; verify it is `ALTER TABLE ADD COLUMN` only, existing rows keep `sql` unchanged with new columns unset
- [x] 2.3 Refactor `src/consulta-ejecucion.ts`: extract module-private `enSesionSoloLectura(destino, presupuestos, cuerpo)` from `correrTransaccion` (connect race, backstop, `BEGIN READ ONLY`, `set_config`, DEC-08, `ROLLBACK`, close); `ejecutarConsulta` passes today's pagination body unchanged (design "Reuse of `correrTransaccion`")
- [x] 2.4 Add exported `sondearEstructura(destino, entidades)`: one transaction, per entity `SAVEPOINT sondeo` → `SELECT * FROM (<sanearSql(sql)>) AS _validacion LIMIT 0` (`values: []`, `fields` only) → `ROLLBACK TO SAVEPOINT sondeo` on error, classified via `classifyExecutionError`
- [x] 2.5 Checkpoint: `npx prisma validate && npx tsc --noEmit`; `npm test -- src/consulta-ejecucion.test.ts src/consultas.test.ts` green, both files unedited (regression)

## 3. Validation Module — Pure Logic (`src/validacion-mapeo.ts`)

- [ ] 3.1 RED: `src/validacion-mapeo.test.ts` — OID→category rows: identificador (int2/4/8, uuid, text, varchar, bpchar), numero, texto, booleano, fecha (spec "Postgres Types Classify Into Five Tolerant Semantic Categories")
- [ ] 3.2 RED: extend — an OID outside the table fails with a category-mismatch diagnostic naming a cast hint (spec "Column type outside the tolerant mapping", DEC-45)
- [ ] 3.3 RED: extend — verdicts `ok`, `ausente` (fails only when `obligatorio`), `tipo-incorrecto` (fails whatever the obligatoriedad) (spec "Missing Required Column...", "Wrong-Category Column...")
- [ ] 3.4 RED: extend — `alias-sin-comillas` distinct from `ausente` when a column matches `nombre.toLowerCase()` (spec "Case-Folded Alias Is Diagnosed Distinctly")
- [ ] 3.5 RED: extend — `duplicada` verdict; extra columns land in `columnasSobrantes`, named (spec "Column Outside the Contract...", DEC-43)
- [ ] 3.6 RED: extend — applicability: unmapped optional entity → `inaplicable`, reason "entity not mapped", never `bloqueada` (spec "Optional entity unmapped")
- [ ] 3.7 RED: extend — unmapped/failing required entity or field → `bloqueada`, naming the entity/field (spec "Required entity fails validation")
- [ ] 3.8 RED: extend — mapped but `no-validado` → `pendiente`
- [ ] 3.9 RED: extend — an automation both inapplicable and blocked reports `inaplicable` with every reason listed (spec "Automation both inapplicable and blocked", DEC-46)
- [ ] 3.10 Create `src/validacion-mapeo.ts`: OID table, `diagnosticar()`, `informe()` satisfying 3.1–3.9 (design Interfaces/Contracts)
- [ ] 3.11 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/validacion-mapeo.test.ts` green

## 4. Validation Routes, Wiring, Re-Register Reset

- [ ] 4.1 RED: `src/validacion-mapeo-rutas.test.ts` — `POST /conexiones/:id/validacion-mapeo` probes every mapped entity `LIMIT 0` inside `READ ONLY`, DEC-08 check runs first, no row read (spec "Validate Action Runs a Zero-Row Structural Probe Per Entity")
- [ ] 4.2 RED: extend — missing, wrong-type, extra, and case-folded-alias columns against a live view each produce their diagnosed verdict
- [ ] 4.3 RED: extend — `42P01` on one entity leaves a sibling entity `valida` (per-entity `SAVEPOINT` isolation)
- [ ] 4.4 RED: extend — `1/(id-id)` over populated rows still resolves `valida` (proves zero rows are read, rule 5)
- [ ] 4.5 RED: extend — a data-modifying CTE gives `no-es-lectura`, target table unchanged
- [ ] 4.6 RED: extend — superuser role and closed-port target both answer `200` with `fase` `permisos`/`conexion`, nothing persisted (design "Session failure")
- [ ] 4.7 RED: extend — `GET` still `200`s with the host unreachable (no `pg` connection); the stale-write `updateMany` guard writes nothing when the SQL changed mid-probe (spec "Reading Validation State Never Opens a Tenant Connection")
- [ ] 4.8 RED: extend — a `POST` body carrying `tenantId` or any other property is `400 solicitud-invalida` (spec "Request body carrying a tenant id")
- [ ] 4.9 RED: extend — `POST`/`GET` naming a foreign `conexionId` is `404`, no probe runs (spec "Validating another tenant's connection")
- [ ] 4.10 Create `src/validacion-mapeo-rutas.ts`: `registerValidacionMapeoRoutes(app, prisma)` — `POST`/`GET /conexiones/:id/validacion-mapeo`, empty-body schema (`propertyNames` rejects `tenantId`), `updateMany({id, sql})` stale guard, `informe()` on `GET` — satisfies 4.1–4.9
- [ ] 4.11 Modify `src/server.ts`: import and register `registerValidacionMapeoRoutes(app, prisma)` after `registerVistaCanonicaRoutes`
- [ ] 4.12 RED: `src/vistas-canonicas.test.ts` — re-`PUT` after a persisted validation resets `estadoValidacion`/`diagnosticoValidacion`/`validadaEn` (spec `tenant-schema-mapping` "Re-registering resets a previously validated entity", DEC-41)
- [ ] 4.13 Modify `src/vistas-canonicas.ts`: `reemplazar()` resets the three columns (`'no-validado'`, `Prisma.DbNull`, `null`) in the same `update`
- [ ] 4.14 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/validacion-mapeo-rutas.test.ts src/vistas-canonicas.test.ts` green

## 5. Tenant Isolation Sweep & Full-Suite Checkpoint (`src/aislamiento.test.ts`)

- [ ] 5.1 RED: extend `montarTenant()` — each tenant validates its mapped entity via `POST`, storing the result on `Fixture`
- [ ] 5.2 RED: extend the `rutas` sweep — `POST`/`GET` validation, `GET` applicability report, each against the other tenant's `conexionId`; `404` both ways (spec `tenant-isolation` "Full two-tenant route sweep")
- [ ] 5.3 RED: extend — A's `POST` naming B's `conexionId` leaves B's validation columns unchanged, writes nothing for A
- [ ] 5.4 Full-suite checkpoint: `npm test` green across the full suite; `npx tsc --noEmit` clean

## Key Success-Criteria Traceability

- Missing/wrong-category column fails with a per-field diagnostic → Phase 3 (3.3) and Phase 4 (4.2)
- The probe fetches zero rows inside a `READ ONLY` transaction → Phase 2 (2.4) and Phase 4 (4.4)
- Reads open no `pg` connection → Phase 4 (4.7)
- Re-registration yields "not validated" → Phase 4 (4.12–4.13)
- A column outside the contract fails and is named → Phase 3 (3.5) and Phase 4 (4.2)
- Unmapped `insumo` marks `stock-producible` inapplicable, not failed → Phase 3 (3.6)
- T2 sweep: another tenant's connection returns `404` → Phase 5 (5.2, 5.3)
