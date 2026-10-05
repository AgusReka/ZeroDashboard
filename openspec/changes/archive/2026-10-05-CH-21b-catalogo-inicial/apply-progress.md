# Apply Progress: CH-21b — Initial Template Catalog

Mode: Standard (`strict_tdd: false`); tests written first where the tasks say (1.1 and 1.2 RED, then 1.3).
Branch: `ch21b/catalogo-semilla` (stacked on `ch21b/exploracion`). Delivery: auto-chain, stacked-to-main.

## Status

PR1 tasks 1.1-1.7 are complete. Task 1.8 is partially done: the smoke run belongs to the orchestrator. Task 1.9 **failed**: the authored count is 473 lines, over the 400 budget (forecast ~386). Per the tasks file, the next step is to split before any PR is opened. The commits are already cut at a clean split boundary (see "Line count and split").

| Task | State | Evidence |
|---|---|---|
| 1.1 RED U1-U5 | done | The first run failed with `ERR_MODULE_NOT_FOUND` for `src/catalogo-inicial.js`. All four unit tests pass after 1.3 |
| 1.2 RED L1-L4, C1, C2 | done, proven live | 6/6 pass against the Compose `db` at `localhost:5434` |
| 1.3 module | done | `src/catalogo-inicial.ts` |
| 1.4 seed | done | `prisma/seed.ts` |
| 1.5 smoke | done (syntax only) | `sh -n` and `bash -n` pass. The full run is not done here |
| 1.6 boot env | done | See "Boot-environment check" |
| 1.7 U5 pin and adapter | done | `npx tsc --noEmit` and `npm run build` exit 0 with `sembrarCatalogoInicial(p.plantilla)` and no interface change. L1 proves `createMany({ skipDuplicates: true })` on `@prisma/adapter-pg` |
| 1.8 verification | partial | `npm test`, `npm run build` and `npx tsc --noEmit` were run. `bash scripts/smoke.sh` is orchestrator-owned |
| 1.9 line count | **over budget** | 473 authored lines. Stopped and reported |

## Commits

| Commit | Unit | Files |
|---|---|---|
| f427938 | feat: module + unit tests U1-U5 | `src/catalogo-inicial.ts`, `src/catalogo-inicial.test.ts` (unit block only) |
| de54ceb | feat: seed wiring | `prisma/seed.ts` |
| bc170dc | test: live L1-L4, C1, C2 | `src/catalogo-inicial.test.ts` (live block and its imports) |
| 281473a | test: smoke after restart | `scripts/smoke.sh` |

## Line Count and Split

`git diff --stat ch21b/exploracion...HEAD` (code only; docs excluded):

| File | + / − |
|---|---|
| `src/catalogo-inicial.ts` | +153 |
| `src/catalogo-inicial.test.ts` | +281 |
| `prisma/seed.ts` | +20 / −1 |
| `scripts/smoke.sh` | +17 / −1 |
| **Total** | **471 / −2 = 473** |

Why the count exceeds the forecast:

- The module is +35 lines over the ~118 estimate. The SQL takes 22 lines, the header comment the design requires takes 21, and the runtime key-set and enum checks take ~35.
- The tests are +56 lines over the ~225 estimate. The repository convention duplicates the `TEST_DB_*`/`esAlcanzable` gate (~28 lines), and the imports take 23 lines.

One redundant U1 assertion was merged (−3). No further shrinking was done: the remaining cuts would only compress or restyle code, or drop tests.

Proposed split (the commits are already in this order):

- **PR1a** = f427938 + de54ceb: module, unit tests and seed. **305 lines** (+304/−1).
- **PR1b** = bc170dc + 281473a: live tests and smoke. **170 lines** (+168/−2).

The orchestrator or user decides between the split and a `size:exception`.

## Commands and Observed Results

| Command | Result |
|---|---|
| `npx tsx --test src/catalogo-inicial.test.ts` before the module existed | fail: `ERR_MODULE_NOT_FOUND` (RED) |
| `npx tsc --noEmit` (final) | exit 0 |
| `npm run build` | exit 0 |
| `sh -n scripts/smoke.sh`, `bash -n scripts/smoke.sh` | both OK |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=*** npx tsx --test src/catalogo-inicial.test.ts` | tests 10, pass 10, fail 0, skipped 0 (U1-U4, L1-L3, C1, C2, L4) |
| `npx tsx --test src/catalogo-inicial.test.ts` with no `TEST_DB_*` (default 5432 = Saleor) | U1, U3 and U4 pass; U2 failed on a test bug, since fixed. The live suites failed with P1000 (authentication) on the unrelated Saleor server, and nothing was written there |
| Full `npm test` against 5434, run 1 | tests 856, pass 855, fail 1. The failure was `aislamiento.test.ts` "CH-14 5.11 a tick over A and B mails each tenant's rows only to its own recipient": one of two mails was missing under parallel load. The file passes alone (59/59) |
| Full `npm test` against 5434, run 2 | tests 856, pass 856, fail 0, exit 0 |
| Suite-level skips in both full runs | "automation routes — create, list, get, deactivate, runs (CH-13 ...)": its 1 s TCP probe to `localhost:5434` failed under load. "notificador — live delivery to the correo-profile Mailpit": Mailpit is not running. Neither touches CH-21b |
| `SELECT count(*) FROM "Plantilla"` (compose db) | 0 before, 0 after every run |

## Boot-environment Check (1.6)

- Grep: `loadConfig(` and `process.env` appear at module top level only in `src/server.ts` and in `src/canal-agente-apoyo.ts` (a test helper). Neither is in the import graph of `catalogo-inicial` (`plantillas-rutas`, `conexiones`, `consulta-ejecucion`, `consultas-guardadas`, `parametros`, `plantillas`, `vistas-canonicas`, `contrato`, `aislamiento-prisma`, `contexto-tenant`, `estilos-rutas`, `canal-agente`, `conexion-destino`, `cripto-credencial`, `db-probe`, `config`, `pg-error`). All other reads are inside functions.
- Dry import: `env -i PATH SYSTEMROOT node -e "import('./dist/catalogo-inicial.js')"` gives `imported OK, entries: 2`.
- Seed with only `DATABASE_URL`, pointed at an unreachable `127.0.0.1:1` so no database was touched: the whole import graph loads, `Seed failed: PrismaClientKnownRequestError ... prisma.tenant.count()` is printed, and the exit code is 1. This proves the failure path is not swallowed. The seed was not executed against the Compose db; the smoke covers the success path.

## Deviations from Design

1. `rechazoDeEntrada` checks the AJV-owned fields and turns each failure into an AJV-shaped detail (`keyword`, `instancePath`, `params.additionalProperty` / `params.missingProperty`). It then passes those details to the unchanged `rechazoDePlantilla({ validation }, entrada)`, so the route's own `camposInvalidos` and `valoresRechazados` build `campos` and `rechazados`. With no detail, it calls `rechazoDePlantilla(undefined, entrada)` as the design says. U2 proves full envelope deep-equality with the real route on both broken samples. The key-set and value checks are what the design specifies; only the envelope builder is reused more directly. It also checks that `nombre` and `sql` are non-empty strings, as the schema's `minLength` does.
2. `sembrarCatalogoInicial` checks for duplicate ids inside the same validation loop. The error message is `catálogo inicial: id duplicado <id>`.
3. U1 adds two scans: every `FROM`/`JOIN` target must be a `v_<x>` alias, and there must be no personal-data or credential terms. These cover the spec scenarios "no physical table" and "No personal data or secrets".
4. The smoke writes the restart's log window to `/tmp/smoke-arranque.log` once, and all three checks read that file. The design specified the same `--since "$INICIO_APP"` window. The spec scenario "No daily report row" is not checked in the smoke: a developer's database can hold operator-created rows, so U1 covers it.
5. The line count exceeds the budget. See above.

## Spec Scenario Coverage

| Scenario | Test |
|---|---|
| Seeding an empty catalog | U1 (content), L1 (2 rows created, content equals `datosDePlantilla` + id) |
| No daily report row | U1 |
| Seeding twice is idempotent | L1 (second seed returns 0, rows deep-equal) |
| Operator edit survives a second seed | L2 (PUT, seed, `findUnique` deep-equals the PUT response) |
| Absent row is recreated by id only | L3 |
| Unrelated templates are untouched | L2 (POST `stock-fisico` template unchanged; exactly 3 prefixed rows) |
| Existing tenant does not skip catalog seeding | `seed.ts` structure; smoke (`Seed skipped:` and `Seed: template catalog` in one window), not yet run |
| Fresh install lists both templates | L3 (`GET /plantillas/:id` 200 per id); smoke headerless list, not yet run |
| Seed failure | U2 (throws naming the id and rule, `createMany` never called); dry seed run (exit 1) |
| Entries validate with the route's rules | U2 (201 through the real route; `rechazoDeEntrada` returns null) |
| Entry violating a rule is not seeded | U2 (`$1` and `cliente` copies: 400 parity, the seeder throws, nothing is written) |
| Composition with a sample threshold | U4 |
| Execution on a miniature fixture | C1, C2 (`BEGIN READ ONLY`) |
| Result order is not asserted unless verified | L4 verifies it; the module header documents it as observed behavior |
| Declared entities | U1 |
| Products with a recipe are excluded | C1 (Empanada excluded; it appears with an empty recipe view) |
| Connection without a valid receta_componente view | U4 (`no-mapeada`, `no-validado`) |
| Tenant without recipes using an empty view | U4 (gate `ok`), C1 (empty view run) |
| Threshold applies to producible units | C2 |
| Declared tolerance | U1 |
| Tolerance has no execution effect | C1 (tolerance 0 copy gives identical result), U1/U2 |
| Aliases match declared entities | U1 |
| No write statements or literal values | U1, U4 (no literal `5` in the text) |
| No personal data or secrets | U1 |
| Seeding needs no tenant | L1 (no tenant argument exists), U3 |
| Seeded content is tenant-neutral | U1 (key set), U3 (`data` deep-equal, no `tenantId`) |
| Existing shape is unchanged | U2 (route unmodified); no schema, migration or engine file in the diff |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 TEST_DB_PASSWORD=*** npx tsx --test src/catalogo-inicial.test.ts`: 10/10 pass |
| Runtime harness | `bash scripts/smoke.sh`: pending, orchestrator-owned (needs the app container and a free db) |
| Rollback boundary | Revert the four commits. Seeded rows (none in the compose db yet) are removed only with the design's rollback SQL, after the revert |

## Verification addendum (orchestrator, 2026-10-05)

- Split: PR1 was 473 authored lines, so it ships as PR1a (`ch21b/semilla-modulo`: module, unit tests, seed, 305) and PR1b (`ch21b/catalogo-semilla`: live tests and smoke, 170). Final tree identical to the single-branch result (kept locally as `ch21b/respaldo-pr1-completo`).
- `bash scripts/smoke.sh` on the PR1b tip against the project's Compose stack: SMOKE TEST PASSED (37 OK lines), including "both catalog templates listed headerless; the catalog step ran although the tenant step was skipped". This closes the scenarios "Existing tenant does not skip catalog seeding" and "Fresh install lists both templates".
- Independent verifier: PASS WITH WARNINGS, 0 CRITICAL. W3 (live tests default to 5432 where another PostgreSQL may live) is inherited from `plantillas-rutas.test.ts`; set `TEST_DB_PORT` explicitly. Suggestions S1-S3 (fixed /tmp paths in the smoke, tolerance assertion only in C1, compact-JSON grep) are recorded, not applied.
- Side effect of the smoke: the project's Compose database now holds the two seeded catalog rows (the smoke exercises the real seed); the stack was brought down afterwards without removing volumes.
