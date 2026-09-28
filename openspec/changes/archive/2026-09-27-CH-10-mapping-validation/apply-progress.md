# Apply Progress — CH-10-mapping-validation

Mode: Standard (`strict_tdd: false`), with RED-first tests as `tasks.md` orders. The RED evidence for each unit is in the table below.
Delivery: auto-chain, stacked-to-main, one commit per work unit, no `size:exception` recorded. Nothing is pushed and no PRs are open.
State: 39/39 tasks complete. Unit 4 exceeded ~500 changed lines and was split into 4a and 4b, as the `tasks.md` forecast allowed.

## Chain

| Unit | Branch | Commit | Changed lines (vs previous tip) | Tasks |
|---|---|---|---|---|
| 1 | `ch10/1-contrato-tipos` (on top of planning commit 69e399a) | 6d1e4be | +172/−7 (179) | 1.1–1.5 |
| 2 | `ch10/2-sesion-y-columnas` | c3886a4 | +268/−81 (349) | 2.1–2.5 |
| 3 | `ch10/3-logica-validacion` | 5959f0b | +873/−11 (884) | 3.1–3.11 |
| 4a | `ch10/4a-rutas-validacion` | 0b0f099 | +753/−10 (763) | 4.1, 4.2, 4.8–4.13 |
| 4b | `ch10/4b-casos-borde` | 2ff90db | +152/−6 (158) | 4.3–4.7, 4.14 |
| 5 | `ch10/5-barrido-t2` | see `git log` (this file ships in it) | ~+250 (T2 sweep plus this file) | 5.1–5.4 |

## Test environment (read before re-running)

- Port 5432 on this machine belongs to `saleor-platform-db-1`. With the default `TEST_DB_*` values, every live-PostgreSQL suite reaches that server, fails authentication and **fails** (it does not skip). This failure predates CH-10 and also affects the base branch.
- The live test database is the project container `zd-ch09-testdb` on port 5434. Run the suites with:
  `TEST_DB_HOST=localhost TEST_DB_PORT=5434 TEST_DB_USER=zerodashboard TEST_DB_PASSWORD=change-me TEST_DB_NAME=zerodashboard`.
  The CH-10 migration was applied to it with `prisma migrate deploy`.
- `npm test -- <file>` still expands `src/**/*.test.ts`, so it runs the full suite. For focused runs, use `npx tsx --test <file>`.
- Base run on master+planning (69e399a), with the 5434 env: `npm test` → 274/274, 0 skipped.

## Work Unit Evidence

| Unit | Focused test | Runtime harness | Rollback boundary |
|---|---|---|---|
| 1 | RED: 3 failing (tipo undefined). GREEN: `npx tsx --test src/contrato.test.ts src/contrato-rutas.test.ts` → 22/22. `npm test -- src/contrato.test.ts` → 277/277, 0 skipped. `tsc` exit 0 | N/A: static catalog, no route change | Revert `tipo`/`TipoSemantico` in `src/contrato.ts` and the two test additions |
| 2 | `npx prisma validate` valid. `npx tsx --test src/consulta-ejecucion.test.ts src/consultas.test.ts` → 64/64 live (files unedited). `npm test -- …` → 277/277. `tsc` exit 0 | Scratch smoke run of `sondearEstructura` against live PG (not committed): the savepoint kept a 42P01 on one entity from affecting its siblings, `1/(id-id)` returned OK with zero rows, the CTE returned 0A000 no-es-lectura, the superuser was refused with `permisos`, and the table was unchanged. Migration backfill checked in a rolled-back transaction: a pre-existing row kept its `sql`, got `no-validado`, and had NULL diag/fecha | Revert the schema, delete the migration directory, and revert `consulta-ejecucion.ts`. The unedited regression suites pin `ejecutarConsulta` |
| 3 | RED: ERR_MODULE_NOT_FOUND. GREEN: `npx tsx --test src/validacion-mapeo.test.ts` → 28/28. Three mutations were caught: the precedence flip, extra columns tolerated, and alias folding removed | N/A: pure functions | Delete `src/validacion-mapeo.ts` and its test |
| 4a | RED: ERR_MODULE_NOT_FOUND for the routes, and 4.12 failed with the reset reverted. GREEN: `npx tsx --test src/validacion-mapeo-rutas.test.ts src/vistas-canonicas.test.ts` → 29/29 live. `npm test -- …` → 316/316 | `app.inject()` against live PG on 5434 with the real isolation extension | Delete the routes module and its test, revert the 2 lines in `server.ts`, and revert the `reemplazar()` reset and its test |
| 4b | `npx tsx --test src/validacion-mapeo-rutas.test.ts src/vistas-canonicas.test.ts` → 35/35 live. `npm test -- …` → 322/322. Mutations: removing the stale guard fails 4.7, and removing the explicit `actualizadaEn` fails 4.1 | Live PG: a lock-held probe races a PUT deterministically, a closed port, and a superuser role | Revert the edge-case block and `puertoCerrado` in the route test |
| 5 | RED: before() failed at the fixture POST with 404 (26 cancelled). GREEN: `npx tsx --test src/aislamiento.test.ts` → 33/33. `npm test -- src/aislamiento.test.ts` → 328/328 | Full two-tenant sweep on live PG | Revert the `aislamiento.test.ts` additions. Units 1–4 stay correct |

Final: `npm test` → 328/328, 41 suites, 0 fail, 0 skipped (live PG on 5434). `npx tsc --noEmit` exit 0. After the runs, the test database has 0 tenants, 0 VistaCanonica rows and 0 ch10 roles.

## Design verification items resolved

- Prisma 7 accepts an explicit `actualizadaEn` on an `@updatedAt` field in `updateMany`. Without it Prisma bumps the field, and the 4.1 assertion catches that.
- `Prisma.DbNull` clears the `Json?` column to SQL NULL, which the 4.12 test covers.

## Deviations from design

- `DiagnosticoCampo` gained two fields beyond the design interface: `tipoObservado: TipoSemantico | null` and `pista: { accion: 'castear-en-la-vista', sugerencia } | null`. The spec requires the diagnostic to name the observed category and to suggest a cast (DEC-45). The design listed only `oid`/`tipoPostgres`. The cast suggestion follows the expected type (`::text`, `::numeric`, `::boolean`, `::timestamptz`).
- The POST body schema uses `type: ['object','null']` + `additionalProperties: false` + `propertyNames: false`. This rejects every key, not only `tenantId`, which matches "tenantId or any other property → 400". A missing body is accepted. This was measured with Fastify 5.
- On success, the POST response is `{ resultado: 'ok', validacionMapeo }`. A session failure returns the `EjecucionFallida` verbatim (`{ resultado: 'fallo', fase, categoria, codigo, duracionMs }`). GET returns `{ validacionMapeo }`.
- `sondearEstructura` releases each savepoint after the probe (`RELEASE SAVEPOINT sondeo`, after `ROLLBACK TO` on error), so the savepoint stack stays flat.
- Report reason tokens: `entidad-no-mapeada`, `no-validada`, `sondeo-fallido`, `columnas-sobrantes`, `diagnostico-ilegible`, or the failing field verdict. An unreadable persisted diagnostic on an `invalida` row blocks the automation and never lets it pass.
- tasks.md 1.2 says "23 fields". The catalog and the spec table have 24, and 24 were typed.

## Learned

- A failed `montarTenant` in `aislamiento.test.ts` (the RED run) leaves partial fixture rows. The same happened in CH-09. They were cleaned by hand with `docker exec psql`.
- Unit 3 (884 lines) and unit 4a (763 lines) are over the 400-line budget. Neither was compressed to fit. Unit 3 could be split further into diagnosis and report at PR time if the reviewer wants that.
