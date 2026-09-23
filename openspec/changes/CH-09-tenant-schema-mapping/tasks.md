# Tasks: CH-09 — Tenant Schema Mapping

Derived from `design.md`. Verification tasks map to scenarios in `specs/tenant-schema-mapping/spec.md`,
`specs/tenant-isolation/spec.md`, and `specs/domain-data-model/spec.md`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 total (`schema.prisma` ~16, migration SQL ~30, `aislamiento-prisma.ts` ~1, `vistas-canonicas.ts` ~180, `vistas-canonicas.test.ts` ~380, `server.ts` ~2, `aislamiento.test.ts` ~90) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Unit 1 (model + migration + isolation registration) → Unit 2 (route module + tests + wiring) → Unit 3 (T2 sweep extension) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

The proposal's own estimate (~470, Medium) undercounts the test surface the same way CH-08's forecast did:
`vistas-canonicas.test.ts` alone carries eleven RED scenarios plus a concurrency case and a static
no-execution assertion, and CH-08's retrospective note puts real test-to-production weight near 2:1, not
1:1. Weighting the ~180-line route module against it lands the test file near ~380 lines on its own, which
is what moves the total from ~470 to ~700 and the risk from Medium to High. `stacked-to-main` is chosen
because this repository has no PR review workflow — every prior CH lands as a sequence of direct commits to
`master` (see recent `git log`) — so "chained PRs" here means three independently landable, independently
green commits in order, not a tracker/child-branch structure. `auto-chain` resolves `Decision needed before
apply` to `No`: the first slice (Unit 1) proceeds without an extra approval gate.

Threat Matrix rows are carried as explicit RED tests below rather than separate tasks: tenant-via-body
(2.4), foreign `conexionId` (2.6, 3.2, 3.3), path-param `entidad` (2.3), and stored-SQL non-execution
(2.11). The Shell/VCS/PR/file-classification row is `N/A` per design and is omitted.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `VistaCanonica` model, additive migration, `MODELOS_AISLADOS` entry | Commit 1 (direct to `master`) | `npx prisma validate && npx tsc --noEmit` | N/A — no route reads the model yet, so there is no server behavior to exercise | Revert the `VistaCanonica` model + back-relations in `prisma/schema.prisma`, delete the new migration directory (or apply a drop-table migration if already run against a shared DB), and remove `'VistaCanonica'` from `MODELOS_AISLADOS` |
| 2 | Route module (`src/vistas-canonicas.ts`), its tests, `server.ts` wiring | Commit 2 (direct to `master`) | `npm test -- src/vistas-canonicas.test.ts` | Fastify `app.inject()` against live PostgreSQL, skipped when unreachable (existing preflight convention) | Delete `src/vistas-canonicas.ts` and `src/vistas-canonicas.test.ts`; revert the `server.ts` import + registration line. Unit 1's model stays in place, unused |
| 3 | T2 sweep extension (`src/aislamiento.test.ts`) + full-suite checkpoint | Commit 3 (direct to `master`) | `npm test -- src/aislamiento.test.ts` | Same live-PostgreSQL skip convention, exercising the full two-tenant sweep including the new routes | Revert `src/aislamiento.test.ts`'s fixture/sweep/cleanup additions only; Units 1–2 stay independently correct, only the T2 evidence for the new routes is lost |

## 1. Data Model & Isolation Registration (`prisma/schema.prisma`, migration, `src/aislamiento-prisma.ts`)

- [x] 1.1 Modify `prisma/schema.prisma`: add model `VistaCanonica` (`id`, `tenantId`, `tenant` relation, `conexionId`, `conexion` relation, `entidad String`, `sql String`, `creadaEn`, `actualizadaEn`) with `@@unique([conexionId, entidad])` and `@@index([tenantId])`; add back-relations `Tenant.vistasCanonicas VistaCanonica[]` and `Conexion.vistasCanonicas VistaCanonica[]` (design Interfaces/Contracts; `domain-data-model` spec "No Premature Modeling of Out-of-Release Entities")
- [x] 1.2 Generate the migration: `npx prisma migrate dev --create-only --name vista_canonica`, review the emitted SQL for `CREATE TABLE "VistaCanonica"`, the two `RESTRICT` foreign keys, `@@unique([conexionId, entidad])` and `@@index([tenantId])`; add a header comment marking it additive, matching the existing `tenant_activo` migration (design File Changes, Migration/Rollout) — applied note: dev DB unreachable at apply time (Docker daemon down), so `migrate dev --create-only` could not run; the SQL is Prisma-authored via the offline `prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script`, under the round-timestamp directory `20260923000000_vista_canonica` (same convention as `tenant_activo`), not yet applied to any database
- [x] 1.3 Modify `src/aislamiento-prisma.ts`: add `'VistaCanonica'` to the `MODELOS_AISLADOS` set (design File Changes; DEC-33; `tenant-isolation` spec "Every Scoped Query Is Filtered by the Active Tenant (DEC-13)")
- [x] 1.4 Checkpoint: `npx prisma validate && npx prisma generate` succeed; `npx tsc --noEmit` clean (no route yet references the model, so no behavior test applies at this phase)

## 2. Route Module & Server Registration (`src/vistas-canonicas.ts`, `server.ts`)

- [x] 2.1 RED: create `src/vistas-canonicas.test.ts` — first `PUT /conexiones/:id/vistas-canonicas/producto` with `{sql:'SELECT 1'}` returns `201`, the DB row's `tenantId` equals the header tenant and `entidad` is `'producto'` (spec `tenant-schema-mapping` "Registration Persists Against a Tenant-Scoped Connection", scenario "Registering a valid definition")
- [x] 2.2 RED: extend — a second `PUT` to the same connection/entity pair with different `sql` returns `200` (not `201`), exactly one row exists for that pair afterward, `sql` is the new value, `actualizadaEn` advances, `id` is unchanged (spec "Re-registering an Entity Replaces the Previous Definition (DEC-34)", scenario "Re-registering an already-mapped entity")
- [x] 2.3 RED: extend — `PUT .../vistas-canonicas/cliente` returns `400 solicitud-invalida` with `campos: ['/entidad']` (spec "Entity Name Validated Against the Canonical Contract Only (DEC-32)", scenario "Unknown entity name")
- [x] 2.4 RED: extend — a `PUT` body carrying `tenantId` or any unknown property returns `400 solicitud-invalida` (spec "Request Body Rejects Client-Supplied Tenant Id", scenario "tenantId supplied in the request body")
- [x] 2.5 RED: extend — `sql` consisting only of whitespace, and `sql: ';'` (empty after `sanearSql`), both return `400 solicitud-invalida` with `campos: ['/sql']`, and no row is created (spec "Registered SQL Is Never Executed", scenario "Blank SQL text rejected")
- [x] 2.6 RED: extend — `PUT` naming a nonexistent `conexionId` returns `404 conexion-no-encontrada`, zero rows created (spec "Registration Persists Against a Tenant-Scoped Connection"; full cross-tenant case is covered by T2 in Phase 3)
- [x] 2.7 RED: extend — two concurrent first `PUT`s to the same new connection/entity pair (`Promise.all`) both resolve `2xx` and exactly one row exists afterward (design Architecture Decisions "Upsert under isolation", `P2002` retry-once)
- [x] 2.8 RED: extend — `GET /conexiones/:id/vistas-canonicas` on a connection with two registered definitions returns exactly those two in `vistasCanonicas`, summary shape only (no `sql`), ordered by `entidad` asc (spec "Listing a Connection's Definitions Is Tenant-Scoped", scenario "Listing returns exactly the owned definitions")
- [x] 2.9 RED: extend — `GET .../vistas-canonicas` on a nonexistent `conexionId` returns `404` (same requirement, second scenario clause)
- [x] 2.10 RED: extend — `GET .../vistas-canonicas/:entidad` returns `200` with the full record including `sql` for an existing pair, and `404 vista-canonica-no-encontrada` for a valid connection with no definition for that entity (spec "Reading One Definition Is Tenant-Scoped")
- [x] 2.11 RED: extend — a source-text assertion on `src/vistas-canonicas.ts`'s raw file contents confirms it never references `destinoDeConexion`, `probeConnection`, `ejecutarConsulta`, or `credencial` (design Testing Strategy "Static" row; DEC-31 no-execution guarantee)
- [x] 2.12 Create `src/vistas-canonicas.ts`: `ENTIDADES_CANONICAS` derived locally as `CONTRATO_CANONICO.map(e => e.nombre)` (imports only `CONTRATO_CANONICO` from `./contrato.js`; `contrato.ts` stays byte-identical); `VistaCanonicaResumen`/`VistaCanonicaCompleta` projections; body schema `{sql}` and params schema `{entidad: enum}`; `registerVistaCanonicaRoutes(app, prisma)` implementing find-then-update-or-create with `P2002` retry-once on `PUT`, `GET` list ordered by `entidad` asc, `GET` one — satisfies 2.1–2.11 (design Interfaces/Contracts, Data Flow)
- [x] 2.13 Modify `src/server.ts`: add `import { registerVistaCanonicaRoutes } from './vistas-canonicas.js';` and `registerVistaCanonicaRoutes(app, prisma);` immediately after the existing `registerConsultaGuardadaRoutes(app, prisma);` line (design File Changes, Data Flow)
- [x] 2.14 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/vistas-canonicas.test.ts` green

## 3. Tenant Isolation Sweep Extension (`src/aislamiento.test.ts`)

- [ ] 3.1 RED: extend the `montarTenant()` fixture — register one `VistaCanonica` per tenant via `PUT .../vistas-canonicas/producto` through the API, storing its `entidad` and `sql` on the `Fixture` interface (mirrors the existing `conexion`/`guardada` fixture construction)
- [ ] 3.2 RED: add three rows to the `rutas` sweep table — `PUT .../vistas-canonicas/producto`, `GET .../vistas-canonicas`, `GET .../vistas-canonicas/producto` — each run against the other tenant's `conexionId`, asserting `404 conexion-no-encontrada` both ways and `200`/`201` for the caller's own id (spec `tenant-isolation` "Cross-Tenant Isolation Is Proven by an Automated Test (T2)", scenario "Full two-tenant route sweep")
- [ ] 3.3 RED: add an effect-level test — a `PUT` from A naming B's `conexionId` and B's already-registered `entidad` leaves B's stored `sql` unchanged in the database and creates no row for A (design Testing Strategy T2 row "PUT against B leaves B's sql unchanged and writes nothing for A"; first exercise of the `update`-by-id branch of `aplicarAlcance` on a scoped model)
- [ ] 3.4 Modify `src/aislamiento.test.ts`'s `after()` cleanup: delete `vistaCanonica` rows before `conexion` rows (FK `RESTRICT`, same ordering rationale as the existing `consultaGuardada`-before-`conexion` delete)
- [ ] 3.5 Checkpoint: `npm test -- src/aislamiento.test.ts` green (skips cleanly with no live PostgreSQL target, per the file's existing preflight)

## 4. Full-Suite Checkpoint

- [ ] 4.1 Verify by inspection: `src/contrato.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts` are byte-identical to their pre-CH-09 state (`git diff --stat` shows no change for the three) — proposal Success Criterion "byte-identical"
- [ ] 4.2 Verify by inspection: the new migration under `prisma/migrations/` is additive only — `CREATE TABLE` plus two FKs, no `ALTER`/`DROP` on `Conexion` or `Tenant` — proposal Success Criterion "the migration is additive only"
- [ ] 4.3 Full-suite checkpoint: `npm test` green across `src/vistas-canonicas.test.ts`, `src/aislamiento.test.ts`, and the full pre-existing suite together; `npx tsc --noEmit` clean

## Key Success-Criteria Traceability

- Registering a definition on the active tenant's connection returns `201` with `tenantId` from context → Phase 2 (2.1, 2.12)
- An entity outside the five names returns `400 solicitud-invalida` → Phase 2 (2.3)
- Another tenant's connection id returns `404` and writes no row; list/read of another tenant's rows behave as nonexistent (T2) → Phase 2 (2.6) and Phase 3 (3.2, 3.3)
- A body carrying `tenantId` or an unknown property returns `400` → Phase 2 (2.4)
- Listing a connection returns exactly its registered entities → Phase 2 (2.8)
- Re-registering replaces in place, `200` not `201`, one row per pair (DEC-34) → Phase 2 (2.2)
- No code path added by CH-09 opens a `pg` connection; `consulta-ejecucion.ts`/`consultas.ts`/`contrato.ts` byte-identical → Phase 2 (2.11) and Phase 4 (4.1)
- The migration is additive only → Phase 1 (1.2) and Phase 4 (4.2)
