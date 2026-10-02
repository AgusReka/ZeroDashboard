# Apply Progress: CH-17b — Bounded Connection Retries (X5)

**Mode**: Strict TDD (orchestrator-injected; `openspec/config.yaml` still says `strict_tdd: false` from the greenfield init, superseded by the launch instruction)
**Delivery**: auto-chain, stacked-to-main. Branches, in stack order:
- `ch17b/1-artefactos`: SDD artifacts and DEC-103 to DEC-106 (`0daa0bc`).
- `ch17b/2-config-y-regla`: slice 1 (`e05f197`).
- `ch17b/3-bucle-y-cableado`: slice 2a (`98ed360`).
- `ch17b/4-apagado-y-cableado`: slice 2b (`0b42d50`).
- `ch17b/5-listado-consola-bitacora`: slice 3 (uncommitted; the parent commits).

**Status**: Slices 1, 2 (2a + 2b) and 3 complete: 20/21 tasks. Only 3.7 (`sdd-verify`, then `sdd-archive`) remains.

### Slice 2 split (2a / 2b)

Slice 2 measured 488 changed lines in `src/` (see "Slice 2 Budget") and was cut into two stacked branches before commit:
- **2a** (`ch17b/3-bucle-y-cableado`, 397 changed lines incl. tasks.md): `PoliticaReintentos`, `SIN_REINTENTOS`, the `reintentos` dependency, `ConteoIntentos`, `conectarConReintentos` with a NON-cancellable `pausar` (`Promise<void>` over `reloj.programar`), `intentos` in the final update and on the failure warn, the retry info log; tests 2.1, 2.2 (x2), 2.3 and the 2.4 overlap test with all helpers; `server.ts` unwired. Full suite 668/668, `tsc` exit 0.
- **2b** (`ch17b/4-apagado-y-cableado`, 141 changed lines): `pausar` returning `boolean` + `cancelarPausa` + `detener()` cancel and the `|| detenido` loop exit (DEC-104), `intentos: null` in both sentinels, the `detener`-mid-pause and boot-sweep tests, the `server.ts` wiring, and ticks for 2.4-2.7. 2a + 2b is byte-identical (modulo CR) to the single slice 2 described below (670/670).

## Task Status

### Slice 1: Config, Env, Migration, Pure Rule — done
- [x] 1.1 RED `esFalloReintentable` truth table (`src/automatizaciones.test.ts`)
- [x] 1.2 GREEN `esFalloReintentable` + closed `CATEGORIAS_REINTENTABLES` beside `cierreDeResultado` (`src/automatizaciones.ts`)
- [x] 1.3 RED config cases (`src/config.test.ts`)
- [x] 1.4 GREEN `DEFAULT_CONNECTION_RETRY_ATTEMPTS`, `MAX_CONNECTION_RETRY_ATTEMPTS`, `DEFAULT_CONNECTION_RETRY_PAUSE_MS`, `enteroEnRangoOpcional`, `connectionRetryAttempts`, `connectionRetryPauseMs` (`src/config.ts`)
- [x] 1.5 `.env.example` (empty placeholders + commented defaults/ranges) and `docker-compose.yml` (`${VAR:-}` forwarding)
- [x] 1.6 `prisma/schema.prisma` `intentos Int?` + comment block; `prisma/migrations/20261001000000_ejecucion_intentos/migration.sql`; `npx prisma generate`; applied to test DB
- [x] 1.7 Checkpoint: full suite green, `npx tsc --noEmit` clean

### Slice 2: Retry Loop and Wiring — done (2a + 2b)
- [x] 2.1 RED: default policy dials once (`intentos=1` for ok and closed port; `relojFijo` proves no timer); cap 3 on the closed port gives `[5000, 5000]` pauses, one `fallo`/`host-inalcanzable` row with `intentos=3`; retry `info` logs at 1 and 2, failure `warn` with `intentos: 3`
- [x] 2.2 RED: refused attempt 1, then a `net` forwarder started in the pause callback gives `ok`/`filas=1`/`intentos=2`; refused, refused, then a stalling listener (`CONNECTION_TEST_TIMEOUT_MS=200`) gives `fallo`/`tiempo-agotado`/`intentos=3`
- [x] 2.3 RED: wrong credentials (`credenciales-invalidas`), a query-phase `tiempo-agotado` (`pg_sleep(2)` with `QUERY_TIMEOUT_MS=100`) and a failed send each give `intentos=1` with no pause; one notifier call; the gate refusal gives `intentos=null`
- [x] 2.4 RED: a held pause keeps the row `en-curso`/null, a second planner's tick writes `omitida`/`solapamiento`/null, and no second attempt starts before the pause fires; `detener()` on the timer path during the second pause (after refused, then timed out) cancels it, resolves, and closes `fallo`/`tiempo-agotado`/`intentos=2`, with timers `[[31000,false],[5000,false],[5000,true]]`; the boot sweep closes a row holding `intentos=2` with `intentos=null`
- [x] 2.5 GREEN `src/planificador.ts`: `PoliticaReintentos`, `SIN_REINTENTOS`, `reintentos` dependency (default `SIN_REINTENTOS`), private `ConteoIntentos`, `conectarConReintentos`, `pausar`, `cancelarPausa`, `detener()` cancel, `intentos` in the final update, in both sentinels and on the failure warn, the retry info log, header and `detener` doc comments
- [x] 2.6 `src/server.ts`: `reintentos: { intentos: config.connectionRetryAttempts, pausaMs: config.connectionRetryPauseMs }`
- [x] 2.7 Checkpoint: full suite green, `npx tsc --noEmit` clean, no existing assertion changed

### Slice 3: Listing, Console, Bitácora — done (3.1-3.6)
- [x] 3.1 RED `src/automatizaciones-rutas.test.ts`: the three seeded runs carry `intentos` `[1, null, 2]`; the listing must return `[2, null, 1]` newest first; the full-row `deepEqual` of the middle (legacy) run gains `intentos: null`
- [x] 3.2 GREEN `src/automatizaciones-rutas.ts`: `intentos: true` in `EjecucionListada` (the select used by the runs listing)
- [x] 3.3 RED `src/consola.test.ts`: new test `CH-17b 3.3`: headers `[5..]` are `Notificación`, `Error`, `Intentos`; every row has 8 cells; cell 7 is `3`, `1`, `—` (null), `—` (absent); Error stays in cell 6; no `null`/`undefined` text. The existing full-row `deepEqual` of the first runs-view test gains a trailing `'—'`
- [x] 3.4 GREEN `src/consola.ts`: `Intentos` appended after `Error`, rendered with `textoOpcional(fila.intentos)`
- [x] 3.5 `docs/bitacora/CH-17b-reintentos-de-conexion.md` (Spanish; no `_plantilla.md` exists, structure from CH-14 and CH-17a)
- [x] 3.6 Checkpoint: full suite green, `npx tsc --noEmit` clean, no `prisma/` diff
- [ ] 3.7 Run `sdd-verify`, then `sdd-archive` (parent)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `src/automatizaciones.test.ts` | Unit (pure) | 71/71 (config + automatizaciones) | Written; run failed: `does not provide an export named 'esFalloReintentable'` | 43/43 file | 5 tests: 3 retryable conn categories; 3 non-retryable conn categories; ejecucion `tiempo-agotado` + 3 other query categories; 3 permisos; ok/2 rechazo/excepcion | Wrapped the return expression to the file's ~100-col style; 43/43 |
| 1.3/1.4 | `src/config.test.ts` | Unit | 71/71 (same baseline) | Written; run failed: `does not provide an export named 'DEFAULT_CONNECTION_RETRY_ATTEMPTS'` | 43/43 file | 10 tests: defaults; overrides 5/1000; `1` accepted; empty fallback; `6` (range message); attempts `0`/`abc`/`12.5`; pause `0`/`abc` — every refusal names the variable and never quotes the value | Shortened three over-long titles; 86/86 both files |
| 1.5 | — | Config files | N/A | N/A (no executable behavior; spec scenario is inspection) | `docker compose config --quiet` exit 0; rendered env shows both vars `""` | Triangulation skipped: structural placeholder lines only | ➖ None needed |
| 1.6 | `src/planificador.test.ts` (existing 4.6 allowlist) | Integration (live PG) | Full suite run surfaced 1 failure: 4.6 column allowlist lacked `intentos` | Allowlist is the RED: column added → 4.6 failed with `+ 'intentos'` | Allowlist updated (+`intentos`); 663/663 | ➖ Single (schema shape) | ➖ None needed |
| 1.7 | full suite | All | — | — | `TEST_DB_PORT=5434 npm test`: tests 663, suites 96, pass 663, fail 0, skipped 0; `npx tsc --noEmit` exit 0 | — | — |
| 2.1-2.4 / 2.5 | `src/planificador.test.ts` | Integration (live PG, fake `Reloj`, real sockets) | 26/26 (file baseline) | 7 tests written; run: 7/7 failed for the intended reasons (`intentos` null instead of 1; `pausas` `[]` instead of `[5000]`; `esperarA` never saw a pause; timers `[31000,31000,31000]`, the next tick rather than a pause; the sweep kept `intentos: 2`) | 33/33 file | 7 tests across distinct paths: retry off vs cap 3; transient then ok vs last category wins; 4 non-retryable outcomes (conexion, ejecucion, notificacion, pre-dial); overlap mid-pause; `detener` mid-pause; sweep sentinel | Labelled the two loop exits with comments; 33/33, `tsc` exit 0 |
| 2.6 | — | Wiring | N/A | N/A: no test observes the planner's dependencies from a spawned server, and the design adds no boot log for the policy | `npx tsc --noEmit` exit 0 | Triangulation skipped: one structural line, values validated by the slice 1 config tests | ➖ None needed |
| 2.7 | full suite | All | — | — | `TEST_DB_PORT=5434 npm test`: tests 670, suites 96, pass 670, fail 0, cancelled 0, skipped 0 (exit 0); `npx tsc --noEmit` exit 0; the scheduler file passed 33/33 in 2 more runs | — | — |
| 3.1/3.2 | `src/automatizaciones-rutas.test.ts` | Integration (live PG, Fastify inject) | 36/36 (route + console files) | Written; run: 5.1 failed, the listing row lacked `- intentos: null` | 11/11 file | 3 values in one listing: `2`, `null` (legacy), `1`; plus the full-row shape of the null row | ➖ None needed (one select key + doc comment) |
| 3.3/3.4 | `src/consola.test.ts` | Unit (fake DOM, real served script) | 36/36 (same baseline) | Written; run: 2 failed: headers `[ 'Notificación', 'Error' ]` lacked `'Intentos'`; the first runs-view row had 7 cells, expected a trailing `'—'` | 26/26 file | 4 rows: `3`, `1`, `null` → `—`, absent → `—`; header order; cell count 8; Error unchanged in cell 6 | ➖ None needed (reuses `textoOpcional`) |
| 3.5 | — | Docs | N/A | N/A (documentation) | Structural readback | ➖ | ➖ |
| 3.6 | full suite | All | — | — | `TEST_DB_PORT=5434 npm test`: tests 671, suites 96, pass 671, fail 0, cancelled 0, skipped 0 (exit 0); `npx tsc --noEmit` exit 0; `git diff --stat -- prisma` empty | — | — |

## Work Unit Evidence (Unit 1)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx tsx --test src/config.test.ts src/automatizaciones.test.ts` → tests 86, pass 86, fail 0 |
| Runtime harness | `DATABASE_URL=postgresql://zerodashboard:change-me@localhost:5434/zerodashboard npx prisma migrate deploy` → applied `20261001000000_ejecucion_intentos`; `prisma migrate status` → "Database schema is up to date!"; `information_schema` → `intentos|integer|YES|<none>`; `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` → "No difference detected." |
| Full suite | `TEST_DB_PORT=5434 npm test` → 663/663 pass, exit 0; `npx tsc --noEmit` exit 0 |
| Rollback boundary | Revert `src/config.ts`, `src/automatizaciones.ts`, their tests, `src/planificador.test.ts` allowlist, `.env.example`, `docker-compose.yml`, `prisma/schema.prisma`. The applied migration file stays (nullable column ignored by older code); optional forward `DROP COLUMN` per the migration header. Nothing consumes the new symbols yet. |

## Work Unit Evidence (Unit 2)

| Evidence | Value |
|---|---|
| Focused test command and result | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` gave tests 33, pass 33, fail 0 (3 runs) |
| Runtime harness | Live PostgreSQL on 5434 with real sockets: the closed port `127.0.0.1:1`, a refused free port, a `net` forwarder to the live server, and an accept-and-stall listener. The fake `Reloj` drives every pause. The planner's own timer path is used for `detener()` |
| Full suite | `TEST_DB_PORT=5434 npm test` gave 670/670 pass, exit 0; `npx tsc --noEmit` exit 0 |
| Rollback boundary | Revert `src/planificador.ts`, `src/planificador.test.ts` (the slice 2 hunks) and `src/server.ts`. Slice 1 (config, rule, column) stays and nothing consumes it again |

## Work Unit Evidence (Unit 3)

| Evidence | Value |
|---|---|
| Focused test command and result | `TEST_DB_PORT=5434 npx tsx --test src/automatizaciones-rutas.test.ts src/consola.test.ts` → route 11/11, console 26/26 (37 total, 0 fail) |
| Runtime harness | Route: live PostgreSQL on 5434 through Fastify `inject` (rows written with `intentos` 1/null/2, listing returns 2/null/1). Console: the real served console script in the fake DOM renders `3`, `1`, `—`, `—` in the last column |
| Full suite | `TEST_DB_PORT=5434 npm test` → 671/671 pass, exit 0; `npx tsc --noEmit` exit 0; no `prisma/` diff |
| Rollback boundary | Revert `src/automatizaciones-rutas.ts`, `src/consola.ts`, their test hunks and the bitácora. Slices 1-2 keep writing `intentos`; only its visibility goes away |

## Slice 2 Budget

`git diff --numstat` (src only): `src/planificador.test.ts` +331/-6, `src/planificador.ts` +129/-18, `src/server.ts` +4/-0. Total **488 changed lines**, against the forecast of 270-310 and the 400 budget. Docs (this file and the tasks.md checkboxes) are extra. The test file is 337 of them: about 25 for the fixture extension (`puerto`, `clave`), about 97 for the retry helpers (`relojDePausas`, `tickDe`, `puertoLibre`, `escuchar`, `esperarA`, `conVariable`), and about 209 for the 7 tests. Nothing was compressed or dropped to fit. The parent split it into 2a and 2b (see "Slice 2 split").

## Slice 3 Budget

`git diff --numstat`: `src/automatizaciones-rutas.test.ts` +8/-0, `src/automatizaciones-rutas.ts` +2/-0, `src/consola.test.ts` +31/-1, `src/consola.ts` +4/-2 → **48 changed lines** in `src/`. Docs: the new bitácora (78 lines), tasks.md checkboxes (+6/-6) and this file. Well under 400.

## Commands Run (environment)

- `npx prisma generate` → client 7.10.0 into gitignored `src/generated/prisma`.
- Test DB: container `zd-ch09-testdb` on host port 5434 (the convention since CH-13; port 5432 belongs to another project's Postgres). Migration applied with `DATABASE_URL=...@localhost:5434/zerodashboard npx prisma migrate deploy` (same method as earlier changes). `prisma.config.ts` loads `dotenv/config`, which does not override an exported `DATABASE_URL`.

## Files Changed (slice 1)

| File | Action | Lines (+/-) |
|------|--------|-------------|
| `src/automatizaciones.ts` | Modified | +29 |
| `src/automatizaciones.test.ts` | Modified | +58 |
| `src/config.ts` | Modified | +44 |
| `src/config.test.ts` | Modified | +70 |
| `src/planificador.test.ts` | Modified (allowlist) | +2/-1 |
| `prisma/schema.prisma` | Modified | +6 |
| `prisma/migrations/20261001000000_ejecucion_intentos/migration.sql` | Created | +12 |
| `.env.example` | Modified | +11 |
| `docker-compose.yml` | Modified | +5 |
| `openspec/changes/CH-17b-reintentos-de-conexion/tasks.md` | Modified (checkboxes) | +7/-7 |

Code + tests + prisma: 222 changed lines; env/compose: 16; docs: tasks 14 + this file.

## Files Changed (slice 2)

| File | Action | Lines (+/-) |
|------|--------|-------------|
| `src/planificador.ts` | Modified | +129/-18 |
| `src/planificador.test.ts` | Modified (fixture extension, helpers, 7 tests) | +331/-6 |
| `src/server.ts` | Modified (wiring) | +4 |
| `openspec/changes/CH-17b-reintentos-de-conexion/tasks.md` | Modified (checkboxes) | +7/-7 |

## Files Changed (slice 3)

| File | Action | Lines (+/-) |
|------|--------|-------------|
| `src/automatizaciones-rutas.ts` | Modified (`intentos` in `EjecucionListada`) | +2 |
| `src/automatizaciones-rutas.test.ts` | Modified (seed `intentos`, full-row `intentos: null`, listing assert) | +8 |
| `src/consola.ts` | Modified (`Intentos` last column) | +4/-2 |
| `src/consola.test.ts` | Modified (new test; trailing `'—'` on one full-row assert) | +31/-1 |
| `docs/bitacora/CH-17b-reintentos-de-conexion.md` | Created | +78 |
| `openspec/changes/CH-17b-reintentos-de-conexion/tasks.md` | Modified (checkboxes 3.1-3.6) | +6/-6 |

## Deviations from Design (slice 3)

1. Two existing full-row assertions changed, not one. The design and DEC-103 anticipated only the route test's full-row `deepEqual` (5.1, line 342 → `intentos: null`). The console's first runs-view test (`the runs view shows each run and a classified error for a failed one`) also compares a whole row by `deepEqual`, so appending a column necessarily adds a trailing `'—'` to its expected array. That row has no `intentos` key, so the change also asserts the absent-value placeholder. All positional asserts (`hijos[5]`, `celdas[6]`, `slice(...)`) are unchanged.
2. The route test seeds `intentos` `[1, null, 2]` across the three existing rows (the spec scenario asks for 2 and null; 1 is a third value for triangulation).

## Deviations from Design (slice 2)

1. The design's case (7) and the spec's "Stop during a pause" ask for `tiempo-agotado` as the last category before the stop. The test produces it exactly: attempt 1 is refused, and attempt 2 meets a stalling listener. No relaxation was needed.
2. The spec's query-phase scenario is covered with a real query-phase `tiempo-agotado` (`57014` from `statement_timeout`), not a generic query error. This is the case DEC-97 singles out, because only the phase distinguishes it.
3. The design calls the fixture "generalizing `clienteDeBarrido`". `clienteDeBarrido(propios).cliente` was reused unchanged, since its `ejecucion` proxy only records `updateMany`. The test fixture `conexion()` gained optional `puerto`/`clave` so a role connection can dial a local listener. No existing call site or assertion changed.
4. The loop checks `resultado.resultado === 'ok'` before `esFalloReintentable` only so TypeScript narrows to `EjecucionFallida` for the log's `categoria`. The slice 1 predicate is unchanged.
5. There is no RED for the `server.ts` wiring: no test observes the policy from a spawned server, and adding a boot log would be scope the design does not list.
6. Slice 2 exceeded the 400 budget (488 `src/` lines) and was split into 2a and 2b by the parent.

## Deviations from Design (slice 1)

1. `src/planificador.test.ts` `COLUMNAS_EJECUCION` (CH-13 4.6 column allowlist) gained `intentos`. Task 1.7 says "existing tests unmodified", but this allowlist asserts the exact column set of `Ejecucion`, so any schema-adding slice must extend it (CH-14 did the same for `notificacion`). Only the list constant and its doc comment changed; no assertion logic changed. The design's file table did not list this test.
2. `.env.example` uses empty placeholders with commented defaults (the `SMTP_TIMEOUT_MS` pattern) rather than literal default values; both satisfy "default or placeholder values only".
3. Slice size: 222 code/test/prisma lines (+16 env/compose) against the ~160 forecast; still under 400.

## Issues

- Slice 1: a 0-byte untracked file named `clave.toLowerCase().includes('smtp'))` appeared in the repo root during that session. It is no longer present at the start of slice 3 (`git status` shows only the user's `docs/verificacion-tesis-2026-10-01.md`, which is never touched).
- The bitácora's time section is marked "to be completed": commit timestamps of 2a and 2b (13:33, 13:34) record when they were committed after the split, not the implementation time.
