# Apply Progress: CH-17a — Interrupted Runs and Overlap (X7, X4)

**Mode**: Strict TDD (injected by the orchestrator; `openspec/config.yaml` still says `strict_tdd: false` from the greenfield init)
**Branches**: slice 1 on `ch17a/1-barrido-y-apagado`, later delivered as `ch17a/1a-barrido-al-arrancar` and `ch17a/1b-apagado-ordenado` (stacked on `ch17a/0-artefactos`). Slice 2 on `ch17a/2-solapamiento-y-consola` (stacked on `ch17a/1b-apagado-ordenado`).
**Delivery**: single-pr per slice, stacked. Slice 1 was split into 1a and 1b to stay under 400 lines. Slice 2 is its own PR.

## Status

Slice 1: 9/9 tasks done (1.1–1.9). Slice 2: 7/8 done (2.1–2.7). Remaining: 2.8 (`sdd-verify`, then `sdd-archive`; not an apply task).

## Completed Tasks

- [x] 1.1 RED live sweep test: active and deactivated tenants swept to `fallo`/`interrumpida`, shape, boot time, closed rows unchanged, no new row
- [x] 1.2 RED per-tenant context and failure isolation (live), failed tenant list (unit), `updateMany` outside a context throws
- [x] 1.3 RED `arrancar` ordering (unit, three cases) and a post-sweep `en-curso` row not reaped (live)
- [x] 1.4 GREEN `barrerInterrumpidas()` and `arrancar()` in `src/planificador.ts`
- [x] 1.5 RED `src/apagado.test.ts`
- [x] 1.6 GREEN `src/apagado.ts`
- [x] 1.7 `src/server.ts` wiring
- [x] 1.8 DEC-95 / DEC-99 comment fixes
- [x] 1.9 Checkpoint
- [x] 2.1 RED live: a stuck automation gets two `omitida`/`solapamiento` rows over two ticks (`finalizadaEn = iniciadaEn` under a clock that moves on every read, other columns null), the `en-curso` row unchanged, no query, no notification, one closed-fields `warn` line; after a sweep closes the stuck row, the next tick runs normally (`ok`/`enviada`)
- [x] 2.2 RED live: overlap is per automation (sibling runs), an `en-curso` row in tenant B that names A's automation does not block A (scoped lookup), a Proxy `findFirst` throw for one automation records it through the per-run catch, the run does not start, and the later sibling still runs
- [x] 2.3 GREEN `src/planificador.ts`: `CIERRE_OMITIDA`; overlap lookup as the first step of `correr()`
- [x] 2.4 RED `src/consola.test.ts`: `omitida` renders `Omitida`; `solapamiento` and `interrumpida` messages legible; nulls render `—`; unknown `estado` raw, unknown `error` generic; no raw code or `null` on the page
- [x] 2.5 GREEN `src/consola.ts`: two `MENSAJES_CORRIDA` entries, `ETIQUETAS_ESTADO`, `etiquetaEstado()`
- [x] 2.6 Bitácora `docs/bitacora/CH-17a-interrumpidas-y-solapamiento.md`
- [x] 2.7 Checkpoint

## Files Changed

| File | Action | What |
|---|---|---|
| `src/planificador.ts` | Modified | Slice 1: `CIERRE_INTERRUMPIDA` row shape; `barrerInterrumpidas()` (one `reloj.ahora()`, all tenants, `conTenantActivo` + `async () => await prisma.ejecucion.updateMany`, per-tenant catch, outer catch, logs `{ cerradas }`); `arrancar()`; `Planificador` interface; DEC-95 comments. Slice 2: `CIERRE_OMITIDA`; overlap check at the start of `correr()` (scoped `ejecucion.findFirst` on `automatizacionId` + `en-curso`; if found, `create` the `omitida` row with `finalizadaEn = iniciadaEn`, `warn` with `{ automatizacionId, error }`, return); header and `correrVencidas` catch comments |
| `src/apagado.ts` | Created (slice 1) | `registrarApagado({ proceso, cerrar, log, salir? })`: `on` for SIGTERM/SIGINT, memoized close, second signal logged and ignored, `salir(0)` / `salir(1)` |
| `src/server.ts` | Modified (slice 1) | `registrarApagado({ proceso: process, cerrar: () => app.close(), log: app.log })` before `listen`; `listen().then(() => planificador.arrancar())` |
| `src/automatizaciones.ts` | Comment (slice 1) | `estaVencida` doc: no catch-up (DEC-95), overlap is the scheduler's concern (DEC-96) |
| `src/contexto-tenant.ts` | Comment (slice 1) | `conTenantActivo` doc: the boot sweep also enters deactivated tenants, only to close rows |
| `src/planificador.test.ts` | Modified | Slice 1: `registro()` log helper; `clienteDeBarrido()` Proxy; `atascada()`; 3 live + 4 unit tests; line-271 comment. Slice 2: 2 live tests (2.1, 2.2) |
| `src/apagado.test.ts` | Created (slice 1) | 5 tests (EventEmitter as process; real Fastify `onClose` → `detener()`) |
| `src/consola.ts` | Modified (slice 2) | `MENSAJES_CORRIDA` gains `solapamiento` and `interrumpida`; `ETIQUETAS_ESTADO = { omitida: 'Omitida' }`; `etiquetaEstado()` used for the runs view's Estado cell |
| `src/consola.test.ts` | Modified (slice 2) | 1 test (2.4) on the existing fake DOM |
| `docs/bitacora/CH-17a-interrumpidas-y-solapamiento.md` | Created (slice 2) | Spanish bitácora: what was built, decisions, frictions, artifact limits (no catch-up, single instance, live-stuck row, race window, second signal), spec changes, verification |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/planificador.test.ts` | Integration (live PG) | 17/17 | Written; failed (`barrerInterrumpidas` not a function) | Passed 24/24 | Active + deactivated tenant; advancing clock forces a single boot read; ok/fallo/omitida rows unchanged | None needed |
| 1.2 | `src/planificador.test.ts` | Integration (live PG) + Unit | 17/17 | Written; 2 tests failed | Passed | Failing tenant vs. no failure (both tenants swept, own context each); tenant-list failure (unit); out-of-context throw | None needed |
| 1.3 | `src/planificador.test.ts` | Unit (`relojManual`, `clienteControlado`) + Integration | 17/17 | Written; 4 tests failed | Passed | Sweep resolves / sweep fails / `detener()` during sweep; live post-sweep row with a due sibling | None needed |
| 1.4 | (GREEN for 1.1–1.3) | — | 17/17 | — | 24/24 pass | — | Clean |
| 1.5 | `src/apagado.test.ts` | Unit + Integration (real Fastify) | N/A (new) | Written; failed (`ERR_MODULE_NOT_FOUND`) | Passed 5/5 | SIGTERM, SIGINT, second and third signal, rejection → 1, real `app.close()` | None needed |
| 1.6 | (GREEN for 1.5) | — | N/A (new) | — | 5/5 pass | — | Clean |
| 1.7 | covered by `src/server.test.ts` (child-process boot) | Runtime | 3/3 in full run | N/A (wiring) | Full suite green | — | — |
| 1.8 | comments only | — | — | N/A | Full suite green | — | — |
| 1.9 | full suite | All | — | — | 645/645 | — | — |
| 2.1 | `src/planificador.test.ts` | Integration (live PG) | 24/24 (+24/24 console) | Written; failed: the stuck automation ran (`estado: 'ok'`, `notificacion: 'enviada'`) instead of `omitida` | Passed 26/26 | Two ticks → two rows; moving clock proves one read; then sweep + third tick → normal `ok` run (closed and `omitida` rows are not an overlap) | Header and `correrVencidas` catch comments updated; 26/26 still pass |
| 2.2 | `src/planificador.test.ts` | Integration (live PG) | 24/24 | Written; failed: `['en-curso/null', 'fallo/conexion']` instead of `omitida` | Passed 26/26 | Sibling runs; cross-tenant row on A's automation id is invisible; lookup throw for a middle automation → no row, logged, later sibling runs | Same as 2.1 |
| 2.3 | (GREEN for 2.1–2.2) | — | 24/24 | — | 26/26 pass; `tsc` exit 0 | — | Clean |
| 2.4 | `src/consola.test.ts` | Unit (existing fake DOM) | 24/24 | Written; failed: Estado cell `'omitida'` instead of `'Omitida'` | Passed 25/25 (CH-14 6.5 still green) | Three rows: `omitida`/`solapamiento`, `fallo`/`interrumpida`, unknown estado and error (raw estado, generic message) | None needed |
| 2.5 | (GREEN for 2.4) | — | 24/24 | — | 25/25 pass | — | Clean |
| 2.6 | docs only | — | — | N/A | — | — | — |
| 2.7 | full suite | All | — | — | 648/648; `tsc` exit 0; no `prisma/` diff | — | — |

### Test Summary

- Tests written: 15 (slice 1: 7 in `planificador.test.ts`, 5 in `apagado.test.ts`; slice 2: 2 in `planificador.test.ts`, 1 in `consola.test.ts`)
- Tests passing: 648/648 in the full suite
- Layers: Unit 9, Integration 6 (live PG 5, real Fastify 1)
- Approval tests: none (no refactor of existing behavior)
- Pure functions created: 0 (`etiquetaEstado` is a pure helper inside the console's inline script)

## Work Unit Evidence

### Slice 1

| Evidence | Value |
|---|---|
| Focused test command | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` → 24/24 pass; `npx tsx --test src/apagado.test.ts` → 5/5 pass |
| Runtime harness | `TEST_DB_PORT=5434 npm test` → exit 0, tests 645, pass 645, fail 0 (includes `src/server.test.ts` booting `src/server.ts` as a child process with `arrancar()` and the signal handler wired); `npx tsc --noEmit` → exit 0 |
| Rollback boundary | Revert `src/apagado.ts`, `src/apagado.test.ts`, the `server.ts` hunk, and `barrerInterrumpidas`/`arrancar`/`CIERRE_INTERRUMPIDA` plus their tests in `planificador*.ts`. Comment edits are independent |

### Slice 2

| Evidence | Value |
|---|---|
| Focused test command | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` → tests 26, pass 26, fail 0; `npx tsx --test src/consola.test.ts` → tests 25, pass 25, fail 0 |
| Runtime harness | Live PG in the focused run above: two real ticks write two `omitida` rows through the extended client. `TEST_DB_PORT=5434 npm test` → tests 648, suites 94, pass 648, fail 0; `npx tsc --noEmit` → exit 0; `git diff --stat -- prisma/` → empty |
| Rollback boundary | Revert the `CIERRE_OMITIDA` constant and the overlap block at the top of `correr()` (plus the two comment hunks) in `src/planificador.ts`, tests 2.1/2.2, the `src/consola.ts` hunks and test 2.4, and the bitácora. Slice 1 stays intact |
| Changed lines (slice 2) | src + tests: 179 added, 5 deleted (184): `planificador.ts` +46/-3, `planificador.test.ts` +83, `consola.ts` +15/-2, `consola.test.ts` +35. Docs (bitácora, `tasks.md`, this file) are separate |

## Deviations from Design

1. Task 1.3 "a row created after the sweep is not reaped" is a live-PG test, not a `clienteControlado` unit test: a fake client would make the assertion trivially true. The test places the row on a non-due automation with a due sibling, so it stays valid with the overlap guard.
2. The interrupted shape also nulls `corte` and `codigoError` (spec names `duracionMs`, `filas`, `fase`, `notificacion`; the task says "other columns null"). It does not change any `en-curso` row in practice, because those columns are never set before the close. The `omitida` shape (slice 2) nulls the same columns.
3. The 4.7 test bodies are unmodified. The shared `planificador()` helper in that describe gained an optional `lineas` parameter (logger via the new `registro()` helper).
4. `detener()` does not wait for an in-flight sweep. This matches the design ("detener during the sweep leads to no timer"); the process may exit mid-sweep, and the next boot sweep closes the rest.
5. Slice 2: the overlap check runs after the `iniciadaEn` clock read (the one read reused as `finalizadaEn`), and before any write. It also runs for a run with a `previo` failure (unreadable cron), so a stuck automation with a corrupt cron is skipped as `omitida` rather than recorded as `error-interno`. The design places the check "first in `correr()`" without an exception, so this follows it.
6. Slice 2: the cross-tenant scenario uses an `en-curso` row in tenant B that names A's automation (no composite FK prevents it). A row on a B automation would make the scenario trivially true with a per-automation lookup; this version fails if the lookup were not tenant-scoped.

## Issues Found

- **Slice 1 review budget**: 465 changed lines against a 230–280 forecast; resolved by delivering it as stacked PRs 1a and 1b.
- `openspec/config.yaml` still declares `strict_tdd: false` and an empty `testing` section from the greenfield init; strict TDD came from the orchestrator.
- `tasks.md` 2.6 cites `docs/bitacora/_plantilla.md`, which does not exist; the bitácora follows the CH-14/CH-15 structure.
- The bitácora's time-spent line is bounded by commit timestamps and asks for the real perceived time before it is cited in the thesis (same convention as CH-14/CH-15).

## Remaining Tasks

- [ ] 2.8 Run `sdd-verify`, then `sdd-archive` (orchestrator phase, not apply)
