# Apply Progress: CH-15 — Onboarding (alta) Timing Instrumentation (G1)

**Mode**: Standard (`strict_tdd: false`)
**Delivery**: single-pr; chain strategy n/a
**Branch**: `ch15/1-instrumentacion-de-tiempos-de-alta`, created from `6c729dc` (tip of `ch14/7-verify-archivo`). Nothing is committed: the user did not ask for commits.
**Batch**: 1 of 1 (first apply; no earlier progress existed)
**Status**: 12/13 tasks done. 3.4 (sdd-verify, then sdd-archive) belongs to later phases.

## Tasks

- [x] 1.1 Branch created and carries the uncommitted `docs/01-decisiones.md` (DEC-87..92). **Deviation**: the planning artifacts were not committed, because the user said no commits. The stray `0` and `run` files were not touched.
- [x] 1.2 Verified:
  - node-pg 8.23.0 `Query.requiresPreparation()` returns true when `name` is set, so a named query always uses Parse. Proven live: the file plus a `DELETE` is refused with SQLSTATE 42601.
  - Prisma 7.10.0 keeps an explicit `actualizadaEn` on `create` despite `@updatedAt`. Proven live by a test, so the admin `UPDATE` fallback was not needed.
- [x] 1.3 `scripts/marcas-alta.sql`:
  - a Spanish header (DEC-87..92, the columns, the limits, a one-line psql command);
  - one `WITH … SELECT` with per-source CTEs keyed by `conexionId`, `LEFT JOIN`ed to `Conexion`;
  - `DISTINCT ON` for the latest validation (`validadaEn DESC, entidad, id`, only rows with non-null `validadaEn`) and for the first run (`iniciadaEn, id`, via `Automatizacion.conexionId`);
  - no `$n`, no backslash, ends with `;`.
- [x] 2.1 Static tests: no non-test `src/*.ts` mentions `marcas-alta`; no `$n` and no `\`; one read-only statement (comments stripped, starts with WITH/SELECT, one `;`, no write/DDL keyword); the grant list excludes `credencial`, `host` and `sql`.
- [x] 2.2 Live setup:
  - TCP-probe skip, same convention as the other live suites;
  - `ch15_lector` gets `GRANT SELECT (cols)` on exactly the columns the script reads;
  - `SQL_LIMPIEZA` runs in `before` and `after`;
  - an OID 1114 UTC parser is set on the reader client only.
- [x] 2.3 Fixture, written with raw Prisma, fixed 2020 UTC timestamps and the `CH-15 marcas <ts>` marker:
  - A/A1 has two views. `producto` is validated `valida` and then re-validated `invalida` through `updateMany`, keeping `actualizadaEn` the way the route does. `insumo` is validated `invalida` earlier, and its `actualizadaEn` comes after its validation (clock mix).
  - A1 has two automations and runs `fallo/preparacion`, `fallo/ejecucion`, `ok`, `ok`.
  - A2 is bare.
  - B is deactivated: B1's view was re-registered (validation cleared) and its automation never ran.
- [x] 2.4 Assertions:
  - The file is read unchanged and run as a named query inside `BEGIN READ ONLY`; `SHOW transaction_read_only` is `on`.
  - A second statement is refused with 42601.
  - Reading `credencial`, `host` or `sql` fails with 42501.
  - Rows are indexed by `conexion_id` and filtered to the fixture tenants, with one row per connection.
  - A1 and A2 share the tenant mark.
  - Mapping start and end, the latest validation (`invalida`), and first run / first `ok` are correct.
  - A2's later marks are all null. B1 is present with `tenant_activo=false`, and its validation and run marks are null.
  - No assertion depends on order between marks.
- [x] 2.5 GREEN on the first run. To prove the tests can fail, three mutations were applied and then reverted, and each was caught: `validadaEn ASC`, the `ok` filter removed, and an inner `JOIN` on the views.
- [x] 2.6 `after` deletes per tenant in FK order (ejecucion, automatizacion, vistaCanonica, conexion, tenant), then plantillas by the `MARCA` prefix, then the role. Afterwards the test DB was checked: 0 `ch15_lector` roles, 0 fixture tenants, 0 fixture plantillas.
- [x] 3.1 Bitácora `docs/bitacora/CH-15-instrumentacion-de-tiempos-del-alta.md` in Spanish, built from `docs/_plantilla.md` (the task text says `docs/bitacora/_plantilla.md`, which does not exist). It has the script path, the commit (pending), the exact psql command and a dated raw block. **Caveat**: on the own DB (`zerodashboard-db-1`) the run fails with `relation "VistaCanonica" does not exist`, because that DB has only 2 of 8 migrations applied. The raw error is recorded honestly, together with a labeled control run on the local test DB (0 rows). A citable capture needs the own DB migrated first, which is a user decision.
- [x] 3.2 "Límites del artefacto" lists the mutable validation mark, elapsed time rather than effort, connection meaning registration, clock mix, no backfill or CH-16 retro-measurement, the Food Store `creadoEn` being the seed time (checked in `prisma/seed.ts`), one DB read-only layer in manual runs (DEC-92), and the cross-tenant output (DEC-90).
- [x] 3.3 Checkpoint:
  - `TEST_DB_PORT=5434 npm test`: 633 pass, 0 fail.
  - `npx tsc --noEmit`: exit 0.
  - The diff has no `prisma/`, `src/server.ts`, engine or scheduler change.
- [ ] 3.4 sdd-verify, then sdd-archive (later phases).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/marcas-alta.test.ts` → tests 13, pass 13, fail 0, skipped 0 |
| Full suite | `TEST_DB_PORT=5434 npm test` → tests 633, suites 93, pass 633, fail 0, cancelled 0, skipped 0 (CH-14 baseline 620 + 13). As in CH-14, the Mailpit suite is skipped at suite level and not counted |
| Typecheck | `npx tsc --noEmit` → exit 0 |
| Runtime harness | `docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" <db> psql -X -v ON_ERROR_STOP=1 -P pager=off -U zerodashboard -d zerodashboard < scripts/marcas-alta.sql`: exit 0 with 0 rows on `zd-ch09-testdb`; exit 3 on `zerodashboard-db-1` (missing relation, own DB not migrated). With the same `PGOPTIONS`, a `DELETE` is refused with `cannot execute DELETE in a read-only transaction` |
| Rollback boundary | Delete `scripts/marcas-alta.sql`, `src/marcas-alta.test.ts` and `docs/bitacora/CH-15-instrumentacion-de-tiempos-del-alta.md`. Nothing consumes them |

## Environment notes

- Docker Desktop was off. It was started locally, and it auto-started other projects' containers (Saleor, Food Store) that have restart policies.
- `saleor-platform-db-1` now holds port 5432, so the default `TEST_DB_PORT` would reach Saleor's database. All runs used `TEST_DB_PORT=5434` (`zd-ch09-testdb`, all 8 migrations applied).
- `zd-ch09-testdb` and `zerodashboard-db-1` were started with `docker start`. Nothing ran against remote hosts.

## Deviations / Issues

- No commits (user instruction), so task 1.1's "commit planning artifacts first" was not done, and the bitácora's script commit reads "pendiente".
- The size forecast was exceeded: the authored lines are about 586 (SQL 101, test 391, bitácora 94), plus 98 lines of DEC text, against a forecast of 250-350 and a budget of 400. Nothing was compressed. Recommend `size:exception` for a single PR, or splitting the bitácora into its own docs commit. The code and test are one cohesive unit.
- The own DB lags the migrations (2/8), so no citable capture exists yet. Needs a user decision: bring up the stack (`docker compose up --build`, which runs `prisma migrate deploy`), then re-run the script and replace the dated block.
- Semantics note (inside DEC-89, not a new decision): `validacion_ultima` is the most recent non-null `validadaEn` across the connection's views, so one re-registered view does not null the connection's mark while another view is still validated. This is documented in the limits.
