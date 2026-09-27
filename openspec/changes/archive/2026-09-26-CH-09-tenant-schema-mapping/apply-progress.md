# Apply Progress — CH-09-tenant-schema-mapping

Delivery: auto-chain, stacked-to-main (one commit per work unit). Units 1–2 ran in Standard mode
(tasks written RED-first); Unit 3 ran in Strict TDD mode. State: 26/26 tasks complete.

## Unit 1 — commit 993050b "CH-09: modelo VistaCanonica, migracion y aislamiento"
- [x] 1.1–1.4 `VistaCanonica` model + back-relations, additive migration
  `20260923000000_vista_canonica`, `'VistaCanonica'` in `MODELOS_AISLADOS`.
- Evidence: `prisma validate`/`generate` exit 0; `tsc` exit 0. Runtime harness N/A (no route yet).
- Deviation: migration SQL authored with offline `prisma migrate diff` (Docker down at the time).
- Rollback: revert model/back-relations, drop the migration, remove the `MODELOS_AISLADOS` entry.

## Unit 2 — commit 336cff0 "CH-09: rutas de vistas canonicas por conexion"
- [x] 2.1–2.14 `src/vistas-canonicas.ts`, `src/vistas-canonicas.test.ts` (18 tests), `server.ts` wiring.
- Evidence: RED `ERR_MODULE_NOT_FOUND`; focused 18/18; `npm test` 266/266; P2002 retry branch
  exercised (instrumentation removed). Diff +741/-14, over the 400 budget, not compressed.
- Rollback: delete the two new files; revert the two `server.ts` lines.

## Unit 3 — T2 sweep extension and final checks
- [x] 3.1 Fixture registers `PUT .../vistas-canonicas/producto` per tenant (`entidadVista`, `sqlVista`).
- [x] 3.2 Three sweep rows (PUT, GET list, GET one): `404 conexion-no-encontrada` both ways; owner
  controls `200` (the PUT control re-registers the fixture statement verbatim, a DEC-34 replace).
- [x] 3.3 Effect test: A's `PUT` on B's connection/entity leaves B's row (id, tenantId, sql,
  actualizadaEn) unchanged, stores the intruder statement nowhere, A still owns exactly one row.
- [x] 3.4 `after()` deletes `vistaCanonica` before `conexion` (RESTRICT FK).
- [x] 3.5 Focused suite green; also extended `3.4` (fixture row tenant) and `3.5` (`tenantId` in PUT body → 400).
- [x] 4.1 Byte identity: `git diff --stat 993050b^ -- src/consultas.ts src/consulta-ejecucion.ts` empty;
  `git diff --stat 336cff0 -- (same)` empty; `git diff --stat 9fd0ef6 -- src/contrato.ts` empty
  (9fd0ef6 = DEC-36, the only commit touching it since 993050b^).
- [x] 4.2 Migration additive: CREATE TABLE, 2 CREATE INDEX, 2 `ALTER TABLE "VistaCanonica" ADD
  CONSTRAINT ... FOREIGN KEY`; nothing targets `Tenant` or `Conexion`.
- [x] 4.3 `npm test` 274/274, 0 skipped; `tsc` exit 0.

### TDD Cycle Evidence (Unit 3)
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1–3.4 | `src/aislamiento.test.ts` | Integration (live PG) | 19/19 | Written; fixture PUT `404 Route not found`, 20 cancelled | 27/27 after registering the routes in the test app | Mutation: ownership lookup unscoped → exactly the 4 new cross-tenant tests fail, controls pass | None needed |

### Work Unit Evidence (Unit 3)
| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/aislamiento.test.ts` → 27 tests, 27 pass, 0 fail, 0 skipped |
| Runtime harness | Fastify `app.inject()` against live PostgreSQL (localhost:5434) with the real isolation extension |
| Full suite | `npm test` → 274 tests, 274 pass, 0 fail, 0 skipped |
| DB hygiene | 0 CH-06/CH-09 tenants and 0 `VistaCanonica` rows left (two RED/mutation leftovers deleted by hand) |
| Rollback boundary | Revert the `src/aislamiento.test.ts` additions only; Units 1–2 stay correct |

### Notes
- Production code untouched in Unit 3. A failing `montarTenant` leaves partial rows, because
  `after()` only sees fully built fixtures (pre-existing behavior, not changed here).
