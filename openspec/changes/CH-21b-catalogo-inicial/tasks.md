# Tasks: CH-21b — Initial Template Catalog (stock fisico, stock producible; D3)

From `design.md`, `specs/initial-template-catalog/spec.md` and `proposal.md`. Where they differ, the SPEC wins. No task edits `docs/01-decisiones.md` (DEC-125 to DEC-128 are already registered). Test ids (U1-U5, L1-L4, C1, C2) are the design's. Unit tests: `npm test -- src/catalogo-inicial.test.ts`; types and build: `npm run build` (and `npx tsc --noEmit`). Apply never commits; commits, PRs, verify and archive belong to the orchestrator. No schema, migration, route, dependency or engine change (rule 6): `src/plantillas*.ts`, `parametros.ts`, `consulta-ejecucion.ts`, `planificador.ts`, `correo.ts` and `docker-entrypoint.sh` are not modified.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR0 docs only (~80-100 plus planning docs); PR1 ~386 authored (module ~118, tests ~225, seed +20/-6, smoke +16/-1) |
| 400-line budget risk | Medium (PR1 only; ~386 forecast is under 400 but tight) |
| Chained PRs recommended | Yes |
| Suggested split | PR0 (docs) -> PR1 (code). Do not split PR1 in advance; if the authored count exceeds 400, split before opening the PR (task 1.9) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Line-count checkpoint (task 1.9): `git diff --stat` plus `git status --porcelain` with the line count of each `??` file. Docs (`docs/**`, `openspec/**`) are excluded from the authored count. If over 400, STOP and report before opening the PR. If the test file grows past ~235 lines, first merge U-cases into shared loops and trim fixture comments (design).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 0 | Exploration, DEC-125..128, proposal, specs, design, tasks (docs) | PR0, branch `ch21b/exploracion` | N/A (docs only) | N/A, no runtime change | Revert docs commits |
| 1 | Catalog module, seed wiring, tests, smoke | PR1, branch `ch21b/catalogo-semilla`, base `master` once PR0 merges (until then the orchestrator stacks it on `ch21b/exploracion`) | `npm test -- src/catalogo-inicial.test.ts` | `bash scripts/smoke.sh` after `docker compose restart app` | Revert PR1; seeded rows persist (DEC-68), remove them with the design's rollback SQL only after the revert |

## PR0: Docs (done)

- [x] 0.1 Exploration (`docs/` and change folder) and DEC-125 to DEC-128 in `docs/01-decisiones.md` (commits 1eecad2, 5651c93), on `ch21b/exploracion`.
- [x] 0.2 `proposal.md`, `specs/initial-template-catalog/spec.md` and `design.md` written.
- [x] 0.3 `tasks.md` written (this file).
- [ ] 0.4 One docs commit with the artifacts of 0.2 and 0.3 on `ch21b/exploracion`, before PR1 starts. Orchestrator-owned.

## PR1: Catalog seed (~386 authored)

Branch `ch21b/catalogo-semilla`. Tests first where natural: tasks 1.1 and 1.2 are RED (the module does not exist yet, so the file fails to compile or import), task 1.3 makes them GREEN.

### Tests

- [x] 1.1 RED U1-U5 (no database). Create `src/catalogo-inicial.test.ts` (`node:test`, no env needed) with the unit block:
  - U1 closed list: exactly 2 entries, fixed ids `21b00000-0000-4000-8000-000000000001` / `...0002`, names, `entidades`, `parametros`, `formato`, tolerances 60/120; no `reporte-diario`; each entry's keys equal the `PlantillaCompleta` keys (no `tenantId`); every `v_<x>` in `sql` is declared in `entidades`; each `sql` has no `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`CREATE` (word boundary, case-insensitive), no `;`, no `/\$\d/`, no `/<=\s*\d/`, and contains `<= :umbral`; `rechazoDeEntrada` rejects a copy with an extra `tenantId` key (`campos: ['/tenantId']`) and a copy without `nombre`.
  - U2 POST parity: `registerPlantillaRoutes` with a delegate whose `create` captures `data`; each entry body (without `id`) gets 201 and the data deep-equals `datosDePlantilla(entry)`; two broken copies (`sql` with `$1`; `entidades: ['producto','cliente']`) get 400, `rechazoDeEntrada` returns the same `campos`/`rechazados`, and `sembrarCatalogoInicial` throws naming the id; a delegate that throws on any call proves nothing was written.
  - U3 fake delegate: exactly one `createMany` call, `data` ids are the fixed ids in list order, `skipDuplicates === true`, returns `count`; a list with a duplicated id throws before the call.
  - U4 composition: `componerSentencia` + `prepararSentencia(..., { umbral: 5 })` is `ok` for both entries, `texto` has no `:umbral`, `valores` deep-equals `[5]`, `texto` equals the composed text with `:umbral` replaced by `$1`; DEC-71 gate for `stock-fisico` via `evaluarVistas` (producto only -> `receta_componente` `no-mapeada`; `no-validado` -> named with that state; `valida` with an empty-view SQL -> `ok: true`, both views in contract order).
  - U5 signature pin `firmaAceptaDelegado(p: PrismaClient) { sembrarCatalogoInicial(p.plantilla) }`, never called.
  - Spec scenarios: Seeding an empty catalog (content half), No daily report row (U1 half), Entries validate with the route's rules, Entry violating a rule is not seeded, Composition with a sample threshold, Declared entities, Declared tolerance, Tolerance has no execution effect (no code path reads it: U1 asserts the values, U2 shows the route stores them only), Aliases match declared entities, No write statements or literal values, No personal data or secrets (U1: only the aliases and columns in the design's SQL), Seeding needs no tenant, Seeded content is tenant-neutral (U1 key set and U3 `data` without `tenantId`), Connection without a valid receta_componente view and Tenant without recipes using an empty view (U4 gate half), Existing shape is unchanged (U2: the route is used unmodified).
  - Design ids: U1, U2, U3, U4, U5.
  - Verify: `npm test -- src/catalogo-inicial.test.ts` fails before 1.3 (module missing), passes after.
- [x] 1.2 RED L1-L4, C1, C2 (live PostgreSQL) in the same `src/catalogo-inicial.test.ts`, reusing the `TEST_DB_*` / `esAlcanzable` gating pattern of `plantillas-rutas.test.ts:157-185` (skipped when no server is reachable). Use per-run `randomUUID()` ids with a `CH-21b test <ts>` name prefix and delete only those in `after`; never write the real fixed ids.
  - L1: first seed returns 2, second returns 0; `count({ id: { in } })` is 2 both times.
  - L2: `PUT` through the route with different `sql`/`nombre`, then seed again; `findUnique` deep-equals the PUT response. Unrelated template created via `POST /plantillas` (`automatizacion: 'stock-fisico'`, prefixed name) is deep-equal after the seed and no extra prefixed row exists.
  - L3: delete one test row, seed again returns 1, the row is back with its content, the other row is unchanged; `GET /plantillas/:id` answers 200 per test id (not the list route).
  - C1: `stock-fisico` through `sentenciaPaginada(preparada, 50, 0)` with `pg` `rowMode: 'array'` inside `BEGIN READ ONLY` over `VALUES`-list fixture views; columns `['Producto','Stock disponible']`; `umbral: 5` -> Alfajor 2, Chipa 2, Budin 4 (inactive product and `Empanada`, which has a recipe, excluded); `umbral: 2.5` -> Alfajor, Chipa; empty `receta_componente` view -> `Empanada 1` first.
  - C2: `stock-producible`: Empanada (Harina 10/2, Huevo 3/1), Fugazza (Harina 10/1); `umbral: 5` -> `[['Empanada','3','Huevo',3]]`; `umbral: 10` -> Empanada then Fugazza.
  - L4: `sentenciaPaginada(preparada, 2, 0)` returns the 2 lowest rows in order plus the probe row; distinct ASCII initials.
  - Spec scenarios: Seeding an empty catalog (row-count half), Seeding twice is idempotent, Operator edit survives a second seed, Absent row is recreated by id only, Unrelated templates are untouched, Execution on a miniature fixture, Result order is not asserted unless verified (L4 verifies it, so order is documented as observed behavior), Products with a recipe are excluded, Threshold applies to producible units, Tolerance has no execution effect (C1/C2 run identically for both tolerances), Fresh install lists both templates (route half: `GET /plantillas/:id` per id; the headerless list is task 1.7), Seeding needs no tenant (L1 runs with no tenant argument).
  - Design ids: L1, L2, L3, L4, C1, C2.
  - Verify: see task 1.8 (live run); without a reachable database these tests are reported as skipped, not passed.

### Implementation

- [x] 1.3 GREEN `src/catalogo-inicial.ts` (~118 lines): `ID_STOCK_FISICO`, `ID_STOCK_PRODUCIBLE`, `EntradaCatalogo`, frozen `CATALOGO_INICIAL` (2 entries; names `Alerta de stock físico` / `Alerta de stock producible`; SQL exactly as in design "Template Contents", no trailing `;`, no comments), `FilaCatalogo`, `DelegadoSiembra`, `rechazoDeEntrada` (strict key set at runtime, enum/shape checks against `ENTIDADES_CANONICAS`/`VALORES_AUTOMATIZACION`/`FORMATOS`, then `rechazoDePlantilla(undefined, entrada)`, route envelope `campos`/`rechazados`/`problemas`), `sembrarCatalogoInicial(plantillas, catalogo = CATALOGO_INICIAL)` (validate all, throw `Error('catálogo inicial: <id> rechazada: <envelope JSON>')` and write nothing on failure, throw on duplicate ids, then one `createMany({ data, skipDuplicates: true })` returning `count`; never read, update or delete). Header comment: rule 6, ORDER BY note (observed planner behavior, pinned by L4; fallback is documenting "order not guaranteed", never an engine change), SQL deltas vs `04_`/`11_`, DEC-125..128 refs. Imports only `plantillas-rutas.js`, `plantillas.js`, `vistas-canonicas.js`. Spec: Catalog Contains Exactly Two Initial Templates, Create-If-Absent by Fixed Id, Every Entry Passes the Save-Time Checks, stock-fisico Keeps the Recipe Exclusion, stock-producible Carries the Threshold in HAVING, Provisional Tolerances, Catalog Is Global. Verify: `npm test -- src/catalogo-inicial.test.ts` (U1-U5 green) and `npm run build`.
- [x] 1.4 GREEN `prisma/seed.ts` (+20/-6): extract `sembrarTenant()` with its body and early return unchanged; add the catalog step after it, importing `{ CATALOGO_INICIAL, sembrarCatalogoInicial }` from `'../dist/catalogo-inicial.js'`; `main()` calls both in sequence on every boot; log `Seed: template catalog, <count> of 2 created; existing rows left as they are.`; any rejection keeps the `Seed failed:` path and `exitCode = 1` (the entrypoint is unchanged and `set -e` stops the container); update the header comment. Spec: Catalog Seeding Is Independent of the Tenant Seed (Existing tenant does not skip, Seed failure: not swallowed; container start aborts via the existing contract). Verify: `npm run build`, then the checks of 1.6 and the smoke in 1.5. `seed.ts` has no unit test (outside `tsconfig`; design).
- [x] 1.5 `scripts/smoke.sh` (+16/-1), in the block after `docker compose restart app` and `wait_for_app`: capture `INICIO_APP=$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q app)")`; change the existing `No pending migrations to apply.` check (line ~54) from `tail -20` to `docker compose logs --since "$INICIO_APP" app`; add headerless `GET /plantillas` asserting 200 and both ids `21b00000-0000-4000-8000-000000000001` and `...0002` in the body; assert `Seed skipped:` and `Seed: template catalog` both appear in the same window. Spec: Fresh install lists both templates, Existing tenant does not skip catalog seeding. Verify: `bash -n scripts/smoke.sh` here; the full run is in 1.8.

### Apply checklist (from design)

- [x] 1.6 Boot-environment check: grep the import graph of `dist/catalogo-inicial.js` (`plantillas-rutas`, `conexiones`, `consulta-ejecucion`, `vistas-canonicas`, and what they import) for top-level `loadConfig(` and `process.env`; run `npx tsx prisma/seed.ts` once with only `DATABASE_URL` set. If a module reads required env at import, import from a leaner module or move the read inside a function; never add env to the entrypoint. Report the grep and the run output.
- [x] 1.7 U5 pin and driver-adapter check: confirm `npm run build` accepts `p.plantilla` as `DelegadoSiembra` (if Prisma 7's generic `createMany` does not assign, adjust only the interface types, per design; no call-site cast, no widening to the full client). L1 (task 1.8) proves `createMany({ skipDuplicates: true })` works with `@prisma/adapter-pg`.

### Verification

- [ ] 1.8 Verify with observed results only. Run `npm test` (full), `npm run build`, `npx tsc --noEmit`, and `bash scripts/smoke.sh`. The live blocks (L1-L4, C1, C2) need a PostgreSQL the project user can log in to. On the author's machine another PostgreSQL (Saleor) holds port 5432, so do not point `TEST_DB_*` at it: run them against the project's own Compose `db` through `TEST_DB_*` set to a published port, or an equivalent the orchestrator provides. Report exactly which tests ran, which were skipped, the `TEST_DB_*` target used (host and port, no secrets) and the counts. Never claim a pass that was not observed; if the live blocks were skipped or only run elsewhere, say so and mark 1.2 as not proven.
- [ ] 1.9 Line-count checkpoint (method above): authored at most 400 excluding docs (forecast ~386). If over 400, STOP, report, and split before the PR.

## Spec Traceability

| Spec scenario | Task(s) / test id |
|---|---|
| Seeding an empty catalog | 1.1 U1, 1.2 L1 |
| No daily report row | 1.1 U1, 1.5 |
| Seeding twice is idempotent | 1.2 L1 |
| Operator edit survives a second seed | 1.2 L2 |
| Absent row is recreated by id only | 1.2 L3 |
| Unrelated templates are untouched | 1.2 L2 |
| Existing tenant does not skip catalog seeding | 1.4, 1.5 |
| Fresh install lists both templates | 1.5, 1.2 L3 |
| Seed failure | 1.1 U2 (throws, nothing written), 1.4 (`exitCode = 1`) |
| Entries validate with the route's rules | 1.1 U2 |
| Entry violating a rule is not seeded | 1.1 U2 |
| Composition with a sample threshold | 1.1 U4 |
| Execution on a miniature fixture | 1.2 C1, C2 |
| Result order is not asserted unless verified | 1.2 L4 |
| Declared entities | 1.1 U1 |
| Products with a recipe are excluded | 1.2 C1 |
| Connection without a valid receta_componente view | 1.1 U4 |
| Tenant without recipes using an empty view | 1.1 U4, 1.2 C1 |
| Threshold applies to producible units | 1.2 C2 |
| Declared tolerance | 1.1 U1 |
| Tolerance has no execution effect | 1.1 U1/U2, 1.2 C1/C2 |
| Aliases match declared entities | 1.1 U1 |
| No write statements or literal values | 1.1 U1 |
| No personal data or secrets | 1.1 U1 |
| Seeding needs no tenant | 1.2 L1, 1.3 |
| Seeded content is tenant-neutral | 1.1 U1/U3 |
| Existing shape is unchanged | 1.1 U2, 1.9 (no schema/migration/engine diff) |

## Closure

- [ ] 2.1 Verify (`sdd-verify`): re-check each spec scenario against the observed results of 1.8, the empty `git diff --stat` for the schema, migrations and engine files, and the DEC-125..128 constraints. Orchestrator-owned.
- [ ] 2.2 Archive (`sdd-archive`) after PR1 merges: sync the `initial-template-catalog` spec to `openspec/specs/` and move the change folder to `openspec/changes/archive/`. Orchestrator-owned.
