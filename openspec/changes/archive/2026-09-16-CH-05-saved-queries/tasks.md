# Tasks: CH-05 — Saved Queries

Derived from `design.md`. Verification tasks map to `specs/saved-queries/spec.md` and `specs/query-console/spec.md` scenarios.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800–950 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Refines design.md's own 2-slice suggestion (route module + tests as one slice, console as another): bundling the route module with its 13-case integration suite would put slice 1 near 650–700 lines, already past budget. Splitting the route module from its tests keeps PR1 near 200 lines. PR2 (the test file alone) is still likely to approach or pass 400 lines by itself — consistent with CH-03 PR3 and CH-04 PR4, which also carried a full integration suite without further fragmentation, since no project precedent splits one new test file's cases across two PRs. `stacked-to-main` matches CH-03 and CH-04's confirmed convention (both archived `tasks.md` files use it); no divergent convention found.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Route module + wiring: `src/consultas-guardadas.ts`, `src/server.ts` | PR 1 | `npm run build` (typecheck; no test file yet) | `docker compose up -d --build`, then manual `curl -X POST /consultas-guardadas` | Revert `src/consultas-guardadas.ts` and the two wiring lines in `src/server.ts` |
| 2 | Integration tests: `src/consultas-guardadas.test.ts` | PR 2 | `npm test -- src/consultas-guardadas.test.ts` | Live PostgreSQL target via `TEST_DB_*` env, `conexiones.test.ts` convention | Revert `src/consultas-guardadas.test.ts` alone; PR1's route module is unaffected |
| 3 | Console UI + smoke + docs: `src/consola.ts`, `scripts/smoke.sh` | PR 3 | `npm test -- src/consultas-guardadas.test.ts` (regression) | `docker compose up -d --build`, then `npm run smoke` | Revert `src/consola.ts`, the smoke.sh CH-05 section, and the bitácora entry |

## 1. Route Module & Wiring

- [x] 1.1 Create `src/consultas-guardadas.ts`: `registroConsultaGuardadaSchema` (nombre required non-empty, sql required non-empty, descripcion optional nullable, `additionalProperties:false`) per decision 5
- [x] 1.2 Same file: export `ConsultaGuardadaResumen`, `ConsultaGuardadaCompleta` select allowlists and `LIMITE_LISTADO = 200`
- [x] 1.3 Same file: `POST /consultas-guardadas` — `attachValidation` → `camposInvalidos()`; `sanearSql(body.sql) === ''` → `400 {campos:['/sql']}`; `descripcion` normalization; `tenant.findFirst` → `503 tenant-no-inicializado`; `create` with `select: Completa` → `201`
- [x] 1.4 Same file: `GET /consultas-guardadas` — `findMany({select: Resumen, orderBy:[{creadaEn:'desc'},{id:'asc'}], take: LIMITE_LISTADO+1})`, slice to 200, `truncado` flag
- [x] 1.5 Same file: `GET /consultas-guardadas/:id` — no params schema, `findUnique` → `404 consulta-guardada-no-encontrada` on null
- [x] 1.6 Export `registerConsultaGuardadaRoutes(app, prisma)` registering all three routes; wire into `src/server.ts` (one import, one call)

> **Deviation from design decision 5, found while applying 1.1/1.3 and measured against Fastify 5.**
> The design's stated mechanisms do not produce the behavior the spec requires, so two
> were corrected in place. Both are mechanism changes; the behavior is the one
> `design.md` and `specs/saved-queries/spec.md` already specify.
>
> 1. `additionalProperties: false` does **not** reject an unknown property. Fastify
>    configures AJV with `removeAdditional: true`, so AJV deletes the key and the
>    request succeeds: a body carrying `tenantId` returned `201`, not `400`. Fixed
>    schema-locally with `propertyNames: { enum: [...] }`, which that option does not
>    affect. (Security was never breached — the stripped `tenantId` never reached
>    Prisma and the tenant stayed server-resolved — but the spec scenario failed.)
> 2. `camposInvalidos()` collapsed every key-level violation to `['/']`, because AJV
>    reports `required`/`additionalProperties`/`propertyNames` with an empty
>    `instancePath` and puts the name in `params`. Four spec scenarios require the
>    field name. Fixed in `src/conexiones.ts` by falling back to the `params` name and
>    de-duplicating. **This widens work unit 1 beyond its planned rollback boundary
>    into a CH-03 file and changes CH-03/CH-04 `campos` output** (`/credencial`
>    instead of `/`) — strictly more informative, no existing test asserts the old
>    value, and CH-03's archived design describes `[<instancePath>…]` descriptively
>    rather than as a requirement. Flagged for verify/review to adjudicate.

## 2. Integration Tests (`specs/saved-queries/spec.md`)

- [x] 2.1 Create `src/consultas-guardadas.test.ts`: TCP `esAlcanzable()` + `tenant.findFirst()` skip preflight, `before`/`after` cleanup by created ids, mirroring `conexiones.test.ts`
- [x] 2.2 Test "Creating a valid saved query": `201` full row, readable by get-by-id, scoped to resolved tenant
- [x] 2.3 Test `descripcion` absence (omitted/null/blank) all persist `null`; and verbatim `sql` round trip (`"  SELECT 1;  "` unchanged)
- [x] 2.4 Tests "Missing nombre" / "Missing sql" / "sql that is empty after trimming": each `400` with the field path in `campos`, and `count === 0`
- [x] 2.5 Tests "Unknown property" / "tenantId supplied": `400`, no row created, tenant always server-resolved
- [x] 2.6 Test "Listing metadata-only rows" / "Listing when no saved query exists": no `sql` field on any list row; empty list is `200 []`
- [x] 2.7 Test list ordering (newest first, `truncado:false`) and list cap (`LIMITE_LISTADO+1` via `createMany` under a unique prefix → 200 rows, `truncado:true`)
- [x] 2.8 Test "Saving a query with a name already in use": both `201`, distinct ids, both listed
- [x] 2.9 Test "Retrieving an existing saved query" / "Retrieving an unknown id" / a malformed non-UUID id: `200` w/ sql, `404` legible, `404` not `500`
- [x] 2.10 Test R0 closure round trip: register `Conexion`, save `SELECT 1`, get by id, `POST /consultas/ejecutar` with that `sql` → `200 {resultado:'ok'}`

> **Partial coverage, stated rather than hidden — 2.6, "Listing when no saved query exists".**
> Reads are not tenant-scoped (decision 7), so "no saved query exists" is a claim about
> the whole table, and this suite shares its target database with whatever the
> developer has already saved. Emptying the table to observe the scenario would destroy
> that data. The test asserts the shape the empty answer depends on — `200`, always an
> array, never a `503` or an error envelope — and asserts the literal `[]` only when the
> table really is empty. The `scripts/smoke.sh` path (4.1) runs against a throwaway
> Compose database where the literal empty case is observable.
>
> **Note on 2.10.** `POST /consultas/ejecutar` blocks a superuser before sending the
> statement (DEC-08), and the Compose `POSTGRES_USER` is the database owner, so the
> round trip cannot succeed as that role. The fixture creates one plain login role
> (`ch05_lector`, no table grant, no schema `CREATE`) and drops it in `after`, the same
> approach `src/consultas.test.ts` and `scripts/smoke.sh` already take.

## 3. Console UI (DEC-12, `specs/query-console/spec.md`)

- [x] 3.1 In `src/consola.ts`, add `<section id="guardado">` (`#nombre`, `#descripcion`, `type="button"` `#guardar`, `<ul id="guardadas">`) between `</form>` and `#banner`; add the two `#guardadas` CSS rules
- [x] 3.2 Add `listarGuardadas()` — GET the list, call `renderizarGuardadas`, called at script end and after each save, try/catch → `mostrarBanner`
- [x] 3.3 Add `renderizarGuardadas(cuerpo)` — `textContent`-only `<li>` per row (nombre, creadaEn, descripcion, load button closing over `fila.id`); truncation notice when `truncado`
- [x] 3.4 Add `guardar()` — scenario "Saving the statement currently in the editor": POST `{nombre, descripcion, sql}`, disable `#guardar`, `201` clears inputs + re-lists, `400`/`503`/other failures per `ejecutar`'s branch order
- [x] 3.5 Add `cargarGuardada(id)` — scenario "Loading a saved query into the editor": GET by id, `200` sets `entradaSql.value` + focus, `404` banner + re-list

> **Three small additions the design did not name, all inside its own constraints.**
> 1. `mostrarConfirmacion()` and one `.banner.exito` CSS rule. `specs/query-console/spec.md`
>    requires that "on success the console SHALL confirm the statement was saved", and
>    `design.md` describes only clearing the inputs and re-listing. The confirmation reuses
>    `#banner` — the design's "one alert region, one message at a time" constraint is kept —
>    but a success message painted in the failure region's red would misread as an error.
> 2. Four CSS rules instead of the design's two: the two `#guardadas` rules as specified,
>    plus `#guardadas li .ayuda { margin: 0; }` (the shared `.ayuda` class carries a
>    `1.25rem` bottom margin that would inflate every flex row) and an `h2` rule for the
>    section heading, which the file had no style for.
> 3. No backtick may appear anywhere inside `DOCUMENTO_CONSOLA`: the document lives in a
>    TypeScript template literal, and a backtick in an HTML comment terminates it. Caught
>    by `npm run build`, not by reading.

## 4. Smoke, Manual & Process

- [x] 4.1 Extend `scripts/smoke.sh` with save → list → get → execute against the Compose network, asserting the saved `sql` round-trips
- [x] 4.2 Manual: console save/list/load/execute flow, and a saved `nombre` of `<script>alert(1)</script>` renders as visible text
- [x] 4.3 Add a bitácora entry at `docs/bitacora/` using `docs/_plantilla.md` (read-only) per `docs/02-mapa-de-changes.md` (read-only)

> **4.1 covers more than the task line asked for**, because the empty-list scenario and the
> rule-2 rejection are only literally observable against a throwaway database: the smoke
> now runs empty list → save → tenantId rejection → metadata-only list → verbatim get-by-id
> → `404` → execute what came back → hostile-name round trip → console controls. The
> empty-list assertion measures the table first and only asserts the literal `[]` when it
> really is empty, so it never fails on a developer's own saved rows, and cleanup deletes
> by name prefix rather than emptying the table.
>
> **4.2 was NOT a browser test and is not reported as one.** No browser exists in this
> environment. What ran instead: `/consola` was fetched from the live app, its inline
> `<script>` extracted verbatim, and *that source* executed on a minimal DOM shim against
> the live API — 19 checks covering list-on-load, save + confirmation, re-list, load into
> the editor, focus, connection left untouched, execution through the form's own submit
> path, the `404` re-list, and the hostile `nombre`. The shim supplied only an origin for
> relative URLs; every path, method and body was the shipped script's. It proves the
> script's behaviour, not a real HTML parse or paint.
>
> **That gap found a real defect anyway.** The first harness run showed none of the new
> functions existed: an explanatory comment inside the inline script contained a literal
> `</script>`, and an HTML parser ends the script element at the first such sequence even
> inside a JS comment. The page compiled, read correctly, and was broken. Fixed in
> `src/consola.ts`, and `scripts/smoke.sh` now asserts the served document carries exactly
> one closing script tag so it cannot come back.
