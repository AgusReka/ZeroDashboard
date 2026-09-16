# Tasks: CH-04 — Read-Only Query Execution

Derived from `design.md`. Verification tasks map to `specs/query-execution/spec.md` and `specs/query-console/spec.md` scenarios.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~850–1000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Bigger than CH-03 (already High risk, 3 PRs): this change adds a privilege-check engine, an execution engine, a route, a zero-dependency HTML console, and a wide integration/smoke matrix. `stacked-to-main` is suggested to mirror CH-03's precedent (fast iteration, independent slices); confirm or override before PR 1 merges.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Config + sanitizer extraction: `src/config.ts`, `src/pg-error.ts`, `src/db-probe.ts` import switch | PR 1 | `npm test -- src/db-probe.test.ts` | N/A — pure unit tests, no live DB | Revert `src/pg-error.ts`, the config field, the `.env.example` line, and the two import lines in `src/db-probe.ts` |
| 2 | Execution engine + unit tests: `src/consulta-ejecucion.ts`, `src/consulta-ejecucion.test.ts` | PR 2 | `npm test -- src/consulta-ejecucion.test.ts` | N/A — pure unit tests, no live DB | Revert both new files; nothing else imports them yet |
| 3 | Routes + console + wiring: `src/consultas.ts`, `src/consola.ts`, `src/server.ts` | PR 3 | `npm test -- src/consulta-ejecucion.test.ts` | `docker compose up -d --build`, then `POST /consultas/ejecutar` against a reachable target | Revert `src/consultas.ts`, `src/consola.ts`, and the two wiring lines in `src/server.ts` |
| 4 | Integration cases + smoke + docs | PR 4 | `npm test -- src/consultas.test.ts` | `docker compose up -d --build`, then `npm run smoke` | Revert the integration test file, the smoke.sh CH-04 section, the bitácora entry |

## 1. Foundation

- [x] 1.1 Add `queryTimeoutMs` to `src/config.ts` (`QUERY_TIMEOUT_MS`, default `15000`, positive-integer check mirroring `connectionTestTimeoutMs`)
- [x] 1.2 Document `QUERY_TIMEOUT_MS` (optional, default `15000`) in `.env.example`

## 2. Shared Sanitizer Extraction (highest risk — verify in isolation before Phase 3)

- [x] 2.1 Create `src/pg-error.ts`: move `leerCodigoCrudo`, `codigoPublicable`, `SQLSTATE_PATTERN`, `NODE_CODE_PATTERN` out of `src/db-probe.ts` verbatim and export both functions — pure move, no behavior change
- [x] 2.2 Update `src/db-probe.ts` to import both sanitizers from `./pg-error.js`; delete the local definitions; `classifyConnectionError` and `probeConnection` bodies stay otherwise untouched
- [x] 2.3 **Checkpoint**: run `npm test -- src/db-probe.test.ts` (read-only) unmodified and confirm it passes byte-for-byte as before the move; do not start Phase 3 until green

## 3. Execution Engine

- [x] 3.1 In `src/consulta-ejecucion.ts`, add the category types (`FaseEjecucion`, `CategoriaPermiso`, `CategoriaEjecucion`) and `ClasificacionEjecucion` interface
- [x] 3.2 Implement `classifyExecutionError(error)` as a sibling of `classifyConnectionError`, covering rows 1–7 (own-timer/`57014`→tiempo-agotado, `25006`→no-es-lectura, `42501`→permiso-denegado, other `42***`→error-sintaxis, `22***`→error-datos, fallback→error-desconocido)
- [x] 3.3 Implement `sanearSql(sql)`: `trim()` → strip exactly one trailing `;` → `trim()`
- [x] 3.4 Implement `verificarPermisosRol(client)`: the fixed 3-`EXISTS` catalog query (`values: []`) returning `{esSuperusuario, escribeEnTabla, creaEnEsquema}`
- [x] 3.5 Implement `ejecutarConsulta()`: reuse `db-probe.ts`'s discrete-field client and race-based connect budget, then `BEGIN TRANSACTION READ ONLY` → `set_config('statement_timeout', $1, true)` → privilege check (superuser → table-write → schema-CREATE precedence; `ROLLBACK` and refuse on any true leg) → wrapped statement via `rowMode:'array'` and `values` → `ROLLBACK` always → race backstop at `queryTimeoutMs + 2000`
- [x] 3.6 In the same function, apply the pagination wrapper (`SELECT * FROM (<sqlSaneado>) AS _consulta_usuario LIMIT $1 OFFSET $2`, bind `limite+1`), computing `hayMas`/`siguienteDesplazamiento` by slicing the extra row

## 4. Engine Unit Tests

- [x] 4.1 In `src/consulta-ejecucion.test.ts`, cover `classifyExecutionError` rows 1–7 plus a non-`Error` throw and an unmatched code (`codigo: null`)
- [x] 4.2 Same file: `sanearSql` cases — trailing `;`, trailing `;` plus whitespace, two trailing `;` (only one stripped), no semicolon, whitespace-only
- [x] 4.3 Same file: an error carrying `connectionParameters.password` and `stack` yields a classified summary containing neither

## 5. Routes & Console

- [x] 5.1 Create `src/consultas.ts`: `registerConsultaRoutes(app, prisma)`, `POST /consultas/ejecutar` with strict schema (`limite` 1–200 default 50, `desplazamiento` ≥0 default 0)
- [x] 5.2 Same file: fetch `Conexion` with `credencial` selected (`404` if missing), call `ejecutarConsulta`, respond `200` per the success/failure envelope, log only `app.log.warn({conexionId, fase, categoria, codigo, durationMs}, ...)`
- [x] 5.3 Create `src/consola.ts`: `registerConsolaRoute(app)`, `GET /consola` returning one HTML template-literal constant — textarea, execute control, `<table>` render, prev/next controls, one error banner; every value assigned via `textContent`, never `innerHTML`
- [x] 5.4 Wire `registerConsultaRoutes(app, prisma)` and `registerConsolaRoute(app)` into `src/server.ts` beside the existing registrations

## 6. Integration Tests

> **Apply status 2026-09-16 (batch 3) — executed against a live PostgreSQL 16 target.**
> `npx tsx --test src/consultas.test.ts` → **tests 17, pass 17, fail 0**; the full
> `npm test` → **tests 66, pass 66, fail 0, skipped 0** (both live suites ran, neither
> skipped). Two corrections were needed and are recorded below.
>
> **Correction A — the fixture now provisions its own `Tenant`.** `POST /conexiones`
> resolves the tenant server-side and answers `503 tenant-no-inicializado` when the
> `Tenant` table is empty. A freshly migrated database has no tenant (only the
> container entrypoint's seed step creates one), so the suite as authored could not
> register a single connection. `before()` now creates one when none exists and
> `after()` removes only what it created.
>
> **Correction B — a data-modifying CTE is rejected with `0A000`, not `25006`.** This
> contradicted `design.md` claim C4 / decision 4 and the `specs/query-execution/spec.md`
> scenario "A data-modifying CTE is rejected and nothing is written". **Resolved in
> batch 4 (2026-09-16)** — see the note after 6.5.

- [x] 6.1 Create `src/consultas.test.ts`, paralleling `src/conexiones.test.ts` (read-only): a plain `SELECT` returns rows; `SELECT 1; SELECT 2` is rejected with neither executed; a data-modifying CTE returns `25006` and a follow-up `SELECT count(*)` proves no row was deleted — **executed; the CTE case returns `0A000`, not `25006` (see the resolution note below — `0A000` is now classified `no-es-lectura` and the spec/design name both codes); the row-count guarantee holds unchanged**
- [x] 6.2 Same file: four roles against one database — read-only executes; a table-`INSERT` role blocks `rol-con-escritura-en-tabla`; a schema-`CREATE`-only role blocks `rol-con-create-en-esquema`; a superuser blocks `rol-superusuario` — **all four green as specified**
- [x] 6.3 Same file: `GRANT INSERT ...; GRANT escritor TO lector` — `INHERIT` membership blocks; `NOINHERIT` membership passes the check but a follow-up `SET ROLE` + `INSERT` still fails `25006` — **green; both halves of design decision 2 confirmed against the engine**
- [x] 6.4 Same file: `SELECT pg_sleep(budget*2)` returns `tiempo-agotado` at or before `queryTimeoutMs`, exercising both the `57014` path and the race backstop — **green; cut off in 2063 ms against a 2000 ms budget**
- [x] 6.5 Same file: a 3-row table with `limite:2` returns `hayMas:true`; `desplazamiento:2` returns the last row with `hayMas:false`; a trailing-`;` query executes normally — **green, plus the duplicate-column-name case**

> **RESOLVED 2026-09-16 (batch 4) — data-modifying CTE rejection mechanism.**
> Measured three ways against PostgreSQL 16, not reasoned:
>
> | Statement | Transaction | SQLSTATE |
> |---|---|---|
> | wrapped `SELECT * FROM (<CTE>) AS _consulta_usuario LIMIT $1 OFFSET $2` | `READ ONLY` | `0A000` |
> | unwrapped `WITH x AS (DELETE …) SELECT * FROM x` | `READ ONLY` | `25006` |
> | wrapped | `READ WRITE` | `0A000` |
>
> The cause is decision 6, not decision 4. The pagination wrapper demotes the CTE to a
> subquery, and PostgreSQL refuses a data-modifying CTE anywhere but the top level at
> parse-analysis time (`analyzeCTE`), which is strictly before the executor and
> therefore before the `READ ONLY` check can run. Row 3 of decision 7's table (`25006`
> → `no-es-lectura`) is unreachable for this input. `0A000` matches no row, so it falls
> to row 7 and the console shows "La ejecución falló por un motivo no reconocido.
> (SQLSTATE 0A000)" — legible but uninformative for a highly explicable rejection.
>
> **What still holds:** the rejection is engine-enforced, fails closed, and writes
> nothing. The scenario's second `AND` (no row deleted) is asserted and green in both
> the integration suite and `scripts/smoke.sh`.
>
> **Resolution (2026-09-16, batch 4 — user-authorized, applied).** The maintainer chose
> to map the code rather than to avoid the wrapper or to document the gap without fixing
> it. Two alternatives were on the table and were explicitly rejected: *avoid the
> wrapper* (would require an SQL parser or a top-level/non-top-level heuristic, which
> DEC-09 forbids, and would give up decision 6's `limite + 1` pagination) and *document
> only, do not fix* (leaves the console showing "motivo no reconocido" for the single
> most explicable rejection the system produces). What changed:
>
> - `src/consulta-ejecucion.ts` — `classifyExecutionError` matches `0A000` alongside
>   `25006` in the same branch, yielding `categoria: 'no-es-lectura'`. Matched as a
>   literal code, not by SQLSTATE class, so an unrelated future `0A***` does not inherit
>   it. No other classifier row was touched; `codigo` still reports the exact SQLSTATE,
>   so the two catch points stay distinguishable in responses and logs.
> - `src/consulta-ejecucion.test.ts` — a `0A000` unit case mirroring the `25006` one.
> - `src/consultas.test.ts` — the 6.1 live case now asserts `no-es-lectura` / `0A000`;
>   the unwrapped-CTE companion still pins `25006` and is unchanged.
> - `scripts/smoke.sh` — the CTE case additionally asserts `"categoria":"no-es-lectura"`.
> - `design.md` — claim C4 amended with the three-row measurement table and both
>   mechanisms named; decision 7's row 3 now carries both SQLSTATEs; the flow diagram
>   splits the wrapped-CTE (`0A000`) and other-write (`25006`) branches; the scope-check
>   and testing-strategy rows updated.
> - `specs/query-execution/spec.md` — the requirement and the scenario now state
>   `no-es-lectura` derived from `25006` **or** `0A000` depending on the rejection point.
>   The "no row shall have been deleted" clause is unchanged.
>
> Row 3 of decision 7's table is no longer unreachable, and the console renders its
> existing `ejecucion:no-es-lectura` message for this input. No new category was added.

## 7. Smoke & Manual Verification

> **Apply status 2026-09-16 (batch 3) — both executed against the running Compose stack.**
> `npm run smoke` → **SMOKE TEST PASSED, exit 0**, every CH-01, CH-03 and CH-04 case
> green. The CH-04 CTE assertion was corrected from `25006` to the measured `0A000`
> (see the Phase 6 resolution note), and batch 4 added `"categoria":"no-es-lectura"`
> alongside it; the row-count assertion around it is unchanged.

- [x] 7.1 Extend `scripts/smoke.sh` with success, multi-statement, `25006`, privilege-block, and timeout cases, asserting no response body contains the submitted credential — **`npm run smoke` exit 0; timeout case cut off in 15 s against the 15 s container default; no credential in any body or in `docker compose logs app`**
- [x] 7.2 Manual: `GET /consola` renders, executes a `SELECT`, pages through results, and shows a legible banner for a failed execution — **verified against the live stack, with the caveat below**

> **7.2 evidence and its limit.** `GET /consola` → `200 text/html; charset=utf-8`,
> 10262 bytes, carrying `#sql`, `#ejecutar`, `#resultados`, `#anterior`, `#siguiente`,
> `#banner` and `#estado`, with zero occurrences of `innerHTML` and five `textContent`
> assignments. Every request the page's `ejecutar(desplazamiento)` issues was then
> driven against the running stack in sequence and every render branch checked against
> the real response: submit → `limite:2, desplazamiento:0` → 2 rows, `hayMas:true`,
> `siguienteDesplazamiento:2` (enables *Página siguiente*, disables *Página anterior*);
> *Página siguiente* → `desplazamiento:2` → the last row, `hayMas:false`,
> `siguienteDesplazamiento:null`; *Página anterior* → `max(0, 2-2)=0` → back to page 1;
> a failed execution → `error-sintaxis`/`42601`, whose `ejecucion:error-sintaxis` key
> exists in the page's `MENSAJES` map, so the banner is legible and not silent; the
> `404` branch → `{"error":"conexion-no-encontrada"}`.
>
> **Not covered:** no browser engine was available in this environment, so the page's
> JavaScript was read rather than executed. A human click-through remains worth doing
> once; nothing found here suggests it would fail.

## 8. Project Process

- [x] 8.1 Add a bitácora entry at `docs/bitacora/` using `docs/_plantilla.md` (read-only) per `docs/02-mapa-de-changes.md` (read-only) (date, friction, time spent)
