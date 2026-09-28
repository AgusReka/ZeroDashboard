# Tasks: CH-12 — Automation Templates (D1)

Derived from `design.md`. Verification tasks map to scenarios in `specs/automation-templates/spec.md`,
`specs/domain-data-model/spec.md`, `specs/tenant-isolation/spec.md`, `specs/canonical-contract/spec.md`,
`specs/tenant-schema-mapping/spec.md`, and `specs/query-parameters/spec.md`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,300–1,500 total including tests (schema+migration+exemption ~220, pure `plantillas.ts` ~330, create/list/get ~380, replace+`contrato.ts` comment ~200, test route ~390) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema+exemption) → PR 2 (`plantillas.ts`) → PR 3 (create/list/get) → PR 4 (replace) → PR 5 (test route, 5a/5b fallback) → PR 6 (checkpoint, verify, archive) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR 5 (the test route) is the largest single unit at ~390 lines; per design "Migration / Rollout", if it
goes over budget it splits at the RED/GREEN boundary into 5a (gate and 4xx checks) and 5b (execution and
rule-4 tests). Threat Matrix rows carried as RED tests below: an unlisted route reaching a scoped model
(1.4), tenant B composing tenant A's views (5.8/T2), a request value reaching SQL text (5.4), stored
`entidades` corrupted into `x) ; DROP` (2.2). The generic Shell/VCS/PR row is `N/A` per design and is
omitted. PR 6 has no production code: full-suite checkpoint, `sdd-verify`, `sdd-archive` (mirrors CH-11's
verify-report-then-archive pair on one branch).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `Plantilla` model, migration, `esExenta` exemption rows | `ch12/1-esquema-exencion` (base `ch11/8-verify-archivo`) | `npm test -- src/aislamiento.test.ts src/contexto-tenant.test.ts` | N/A — schema/routing only, no live query yet | `DROP TABLE "Plantilla"`; revert the four exemption rows |
| 2 | Pure `src/plantillas.ts`: gate, composition, save checks | `ch12/2-plantillas-puro` (base unit 1) | `npm test -- src/plantillas.test.ts` | N/A — pure functions, no database | Delete `src/plantillas.ts` and its test; nothing consumes it yet |
| 3 | Catalog create/list/get in `src/plantillas-rutas.ts` | `ch12/3-catalogo-crud` (base unit 2) | `npm test -- src/plantillas-rutas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert `src/plantillas-rutas.ts`/test; units 1–2 stay correct unconsumed |
| 4 | Replace (`PUT`) + `src/contrato.ts` doc comment | `ch12/4-reemplazo` (base unit 3) | `npm test -- src/plantillas-rutas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert the `PUT` handler and the comment; create/list/get unaffected |
| 5 | Test route `src/plantilla-prueba.ts` | `ch12/5-ruta-prueba` (base unit 4; fallback `5a`/`5b`) | `npm test -- src/plantilla-prueba.test.ts src/aislamiento.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert `src/plantilla-prueba.ts`/test and its `server.ts` registration |
| 6 | Full-suite checkpoint, verify report, archive | `ch12/6-verify-archivo` (base unit 5) | `npm test` (full suite) | N/A — docs/verification only | Revert the archive move and bitácora entry |

## 1. Schema, Migration, Exemption & Pass-Through (`prisma/schema.prisma`, migration, `src/contexto-tenant.ts`)

- [x] 1.1 Modify `prisma/schema.prisma`: add `model Plantilla` — `nombre`, `sql`, `parametros Json @default("[]")`, `entidades Json`, `automatizacion String`, `formato String`, `toleranciaFrescuraMinutos Int`; no `tenantId`, no relations (DEC-61, DEC-73; spec `domain-data-model` "Plantilla carries no tenant reference")
- [x] 1.2 Create `prisma/migrations/20260927100000_plantilla/migration.sql`: additive `CREATE TABLE "Plantilla"`, no FK, no index beyond the PK
- [x] 1.3 RED extend `src/aislamiento.test.ts`: `Plantilla` reads/writes pass through with no active tenant and no filter applied (spec `domain-data-model` "Inspecting the schema after this change"; `tenant-isolation` "Catalog routes work without any tenant header")
- [x] 1.4 RED extend `src/contexto-tenant.test.ts`: exact rows `GET`/`POST /plantillas` and `GET`/`PUT /plantillas/:id` pass; `DELETE`/`PATCH /plantillas/:id` and `/plantillas-falsas` are rejected `400`; `POST /plantillas/:id/prueba` is rejected `400 tenant-no-indicado` (Threat Matrix "DELETE/PATCH /plantillas/:id, /plantillas-falsas"; spec `tenant-isolation` "Test route still requires a resolvable active tenant")
- [x] 1.5 GREEN: modify `src/contexto-tenant.ts` `esExenta` — add the four exact rows; update the doc comment — satisfies 1.4
- [x] 1.6 Checkpoint: `npx prisma validate`; `npx tsc --noEmit` clean; `npm test -- src/aislamiento.test.ts src/contexto-tenant.test.ts` green

## 2. Pure Composition Module (`src/plantillas.ts`)

- [x] 2.1 RED `src/plantillas.test.ts`: `evaluarVistas` returns `ok:true` with vistas in contract order when every entity is `valida`; returns `ok:false` listing every failing entity (`no-mapeada`/`no-validado`/`invalida`) when any fails (DEC-71; spec "Missing registered view", "Registered but failing validation")
- [x] 2.2 RED extend: a stored `entidades` name outside `CONTRATO_CANONICO` makes `evaluarVistas` throw (design "Stored JSON on read"; Threat Matrix "Stored entidades corrupted into x) ; DROP")
- [x] 2.3 RED extend: `componerSentencia` opens `WITH v_<entidad> AS (...)` per entity in contract order, aliasing from `CONTRATO_CANONICO` (never the stored string), and nests the template `sql` as an outer subquery so its own `WITH` stays usable (DEC-70; spec "Two entities compose as CTEs")
- [x] 2.4 RED extend: `componerSentencia` applies `sanearSql` exactly once to each stored piece and wraps each body in newlines, so a trailing `-- comment` in a view or template cannot swallow the next clause (design "Piece sanitizing")
- [x] 2.5 RED extend: `problemasDePlantilla` reuses CH-11 rules — a declared-but-unused parameter, an undeclared `:marker`, and a hand-written `$n` are each rejected (DEC-56/57/59; spec `query-parameters` "Undeclared marker rejected at template save time")
- [x] 2.6 Implement `FORMATOS`, `VALORES_AUTOMATIZACION`, `FilaVista`, `VistaAComponer`, `EstadoNoAprobado`, `Compuerta`, `evaluarVistas`, `componerSentencia`, `problemasDePlantilla` in `src/plantillas.ts` (pure — no Fastify, no Prisma, no pg) — satisfies 2.1–2.5
- [x] 2.7 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/plantillas.test.ts` green

## 3. Catalog Routes — Create, List, Get (`src/plantillas-rutas.ts`)

- [x] 3.1 RED `src/plantillas-rutas.test.ts`: `POST /plantillas` with no `x-tenant-id` persists, `201`; `nombre`/`sql` required; `entidades` `minItems:1`/`uniqueItems`/enum of `CONTRATO_CANONICO` names; `automatizacion` enum of `AUTOMATIZACIONES`; `formato` enum `['correo-html']`; `toleranciaFrescuraMinutos` integer `minimum:0` — each violation `400` naming it (spec "Creating a template without a tenant header", "Unknown entity rejected", "Invalid automatizacion rejected", "Valid automatizacion accepted", "Unsupported formato rejected")
- [x] 3.2 RED extend: `sql` containing `WHERE id = $1` is rejected `400` regardless of `parametros`; a declared-but-unused parameter is rejected naming it (spec "Hand-written positional bind always rejected", "Declared parameter unused in sql")
- [x] 3.3 RED extend: `GET /plantillas` lists with no tenant header, capped at `LIMITE_LISTADO + 1` plus `truncado`, summary omitting `sql`/`parametros`/`entidades`; `GET /plantillas/:id` returns full fields; unknown id is `404` (spec "Round-trip create, get, replace", "Unknown id")
- [x] 3.4 Implement `registerPlantillaRoutes(app, plantillas: PrismaAislado['plantilla'])` in `src/plantillas-rutas.ts`: strict AJV schema with `propertyNames`, `sanearSql` → `problemasDePlantilla` → `create`; `findMany` with the list cap; `findUnique` — satisfies 3.1–3.3
- [x] 3.5 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/plantillas-rutas.test.ts` green

## 4. Replace + `contrato.ts` Comment (`src/plantillas-rutas.ts`, `src/contrato.ts`, `src/server.ts`)

- [x] 4.1 RED extend `src/plantillas-rutas.test.ts`: `PUT /plantillas/:id` replaces `sql`/fields in place, `200` with the same id and new `sql`, exactly one row persisted; unknown id is `404` (`P2025`); no tenant header required (spec "Round-trip create, get, replace")
- [x] 4.2 Implement the `PUT /plantillas/:id` handler in `src/plantillas-rutas.ts`: same body schema and save-time checks as create; `update` catching `P2025` → 404 — satisfies 4.1
- [x] 4.3 Modify `src/contrato.ts`: update the doc comment noting DEC-22 is closed by DEC-67 (spec `canonical-contract` "Every catalog label is a valid template value")
- [x] 4.4 Modify `src/server.ts`: register `registerPlantillaRoutes` after `registrarContextoTenant` (done in unit 3, with the create/list/get routes)
- [x] 4.5 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/plantillas-rutas.test.ts` green

## 5. Test Route (`src/plantilla-prueba.ts`)

- [x] 5.1 RED `src/plantilla-prueba.test.ts`: `POST /plantillas/:id/prueba` with no `x-tenant-id` is `400 tenant-no-indicado`, nothing executes (spec "Test endpoint without a tenant header is rejected")
- [x] 5.2 RED extend: unknown `id` → `404 plantilla-no-encontrada`; a `conexionId` outside the active tenant → `404`, nothing dialed (spec "Naming another tenant's connection")
- [x] 5.3 RED extend: an entity with no registered mapping, or a registered mapping whose validation is not `valida`, → `4xx` naming the entity, nothing executes; every failing entity listed in contract order (DEC-71; spec "Missing registered view", "Registered but failing validation")
- [x] 5.4 RED extend: rows return over the composed views; an `O'Brien`/`; DROP` value comes back as data, never spliced into SQL text; a template referencing an undeclared `v_x` executes and returns `200 fallo error-sintaxis 42P01` (spec "Successful test execution", "Template references an undeclared alias"; Threat Matrix "A request value reaching the SQL text")
- [x] 5.5 RED extend: a closed-port connection still returns its `4xx` — proof nothing was dialed before every check passed (design "Data Flow — Test Route")
- [x] 5.6 Implement `src/plantilla-prueba.ts`: AJV body `{conexionId, valores={}, limite=50, desplazamiento=0}`; `plantilla.findUnique` → `conexion.findUnique` [+tenantId] → `vistaCanonica.findMany` [+tenantId] → `evaluarVistas` → `componerSentencia` → `prepararSentencia` → `destinoDeConexion` → `ejecutarConsulta` — satisfies 5.1–5.5 (5a: gate part done — body schema, template lookup, tenant-scoped connection lookup, view lookup, DEC-71 gate `409`; composition, preparation, destination and execution remain for 5b behind the `ejecutarPrueba` seam, which answers `501` until then; 5b: seam replaced by the real execution — `400 {campos, problemas}` from `prepararSentencia`, `409 credencial-ilegible`, `200 ok|fallo`)
- [x] 5.7 Modify `src/server.ts`: register the test route
- [x] 5.8 RED/GREEN extend `src/aislamiento.test.ts` (T2): tenant B cannot compose tenant A's views through the test route — 404, nothing read (Threat Matrix "Tenant B composing tenant A's views")
- [x] 5.9 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/plantilla-prueba.test.ts src/aislamiento.test.ts` green
- [x] 5.10 Contingency: if this phase exceeds the 400-line budget, split at the RED/GREEN boundary before 5.4 into `5a` (5.1–5.3: gate and 4xx checks) and `5b` (5.4–5.9: execution and rule-4 tests), per design "Migration / Rollout" (applied up-front: 5a `ch12/5a-compuerta-prueba`, 5b `ch12/5b-ejecucion-prueba`)

## 6. Full-Suite Checkpoint, Verify & Archive

- [ ] 6.1 Full-suite checkpoint: `npm test` green; `npx tsc --noEmit` clean; `npx prisma validate` clean
- [ ] 6.2 Run `sdd-verify` against `specs/automation-templates/spec.md`, `specs/domain-data-model/spec.md`, `specs/tenant-isolation/spec.md`, `specs/canonical-contract/spec.md`, `specs/tenant-schema-mapping/spec.md`, `specs/query-parameters/spec.md`; produce the verify report
- [ ] 6.3 Run `sdd-archive`: merge each delta spec into its main spec; move `openspec/changes/CH-12-automation-templates/` to `openspec/changes/archive/`; add `docs/bitacora/CH-12-plantillas-de-automatizacion.md` (mirroring CH-11's bitácora) and record the change in `docs/01-decisiones.md`'s bitácora

## Key Success-Criteria Traceability

- Template round-trips create/get/replace without `x-tenant-id` → Phase 1 (1.5), Phase 3 (3.4), Phase 4 (4.2)
- Test endpoint returns rows over composed views, values bound only as driver parameters → Phase 2 (2.3–2.4), Phase 5 (5.4)
- Missing view or undeclared entity returns a legible `4xx` → Phase 2 (2.1), Phase 5 (5.2–5.3)
- Invalid `automatizacion` rejected; DEC-22 closed → Phase 3 (3.1), Phase 4 (4.3)
