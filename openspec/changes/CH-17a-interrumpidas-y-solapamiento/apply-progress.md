# Apply Progress: CH-17a — Interrupted Runs and Overlap (X7, X4)

**Mode**: Strict TDD (injected by the orchestrator; `openspec/config.yaml` still says `strict_tdd: false` from the greenfield init)
**Branch**: `ch17a/1-barrido-y-apagado` (stacked on `ch17a/0-artefactos`)
**Delivery**: single-pr per slice, stacked. This batch is slice 1 only.

## Status

Slice 1: 9/9 tasks done (1.1–1.9). Slice 2: 0/8 (2.1–2.8 pending, separate PR).

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

## Files Changed

| File | Action | What |
|---|---|---|
| `src/planificador.ts` | Modified | `CIERRE_INTERRUMPIDA` row shape; `barrerInterrumpidas()` (one `reloj.ahora()`, all tenants, `conTenantActivo` + `async () => await prisma.ejecucion.updateMany`, per-tenant catch, outer catch, logs `{ cerradas }`); `arrancar()`; `Planificador` interface; DEC-95 comments (header, first-window comment, `correrVencidas` catch) |
| `src/apagado.ts` | Created | `registrarApagado({ proceso, cerrar, log, salir? })`: `on` for SIGTERM/SIGINT, memoized close, second signal logged and ignored, `salir(0)` / `salir(1)` |
| `src/server.ts` | Modified | `registrarApagado({ proceso: process, cerrar: () => app.close(), log: app.log })` before `listen`; `listen().then(() => planificador.arrancar())` |
| `src/automatizaciones.ts` | Comment | `estaVencida` doc: no catch-up (DEC-95), overlap is the scheduler's concern (DEC-96) |
| `src/contexto-tenant.ts` | Comment | `conTenantActivo` doc: the boot sweep also enters deactivated tenants, only to close rows |
| `src/planificador.test.ts` | Modified | `registro()` log helper; `clienteDeBarrido()` Proxy (narrowed `tenant.findMany`, recording/failing `ejecucion.updateMany`); `atascada()`; 3 live + 4 unit tests; line-271 comment |
| `src/apagado.test.ts` | Created | 5 tests (EventEmitter as process; real Fastify `onClose` → `detener()`) |

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

### Test Summary

- Tests written: 12 (7 in `planificador.test.ts`, 5 in `apagado.test.ts`)
- Tests passing: 645/645 in the full suite
- Layers: Unit 8, Integration 4 (live PG 3, real Fastify 1)
- Approval tests: none (no refactor of existing behavior)
- Pure functions created: 0

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` → 24/24 pass; `npx tsx --test src/apagado.test.ts` → 5/5 pass |
| Runtime harness | `TEST_DB_PORT=5434 npm test` → exit 0, tests 645, pass 645, fail 0 (includes `src/server.test.ts` booting `src/server.ts` as a child process with `arrancar()` and the signal handler wired); `npx tsc --noEmit` → exit 0 |
| Rollback boundary | Revert `src/apagado.ts`, `src/apagado.test.ts`, the `server.ts` hunk, and `barrerInterrumpidas`/`arrancar`/`CIERRE_INTERRUMPIDA` plus their tests in `planificador*.ts`. Comment edits are independent |

## Deviations from Design

1. Task 1.3 "a row created after the sweep is not reaped" is a live-PG test, not a `clienteControlado` unit test: a fake client would make the assertion trivially true. The test places the row on a non-due automation with a due sibling, so it stays valid when slice 2 adds the overlap guard.
2. The interrupted shape also nulls `corte` and `codigoError` (spec names `duracionMs`, `filas`, `fase`, `notificacion`; the task says "other columns null"). It does not change any `en-curso` row in practice, because those columns are never set before the close.
3. The 4.7 test bodies are unmodified. The shared `planificador()` helper in that describe gained an optional `lineas` parameter (logger via the new `registro()` helper).
4. `detener()` does not wait for an in-flight sweep. This matches the design ("detener during the sweep leads to no timer"); the process may exit mid-sweep, and the next boot sweep closes the rest.

## Issues Found

- **Review budget exceeded**: slice 1 is 465 changed lines (tracked files 274+/14-, new files `apagado.ts` 57 and `apagado.test.ts` 120). The forecast was 230–280. Tests account for ~308 lines. Code was not compressed to fit. Options: accept `size:exception` for this PR, or split slice 1 into PR 1a (sweep + `arrancar` + comments, ~288) and PR 1b (`apagado.ts` + tests + `server.ts` signal line, ~180).
- `openspec/config.yaml` still declares `strict_tdd: false` and an empty `testing` section from the greenfield init; strict TDD came from the orchestrator.

## Remaining Tasks

- [ ] 2.1–2.8 (slice 2: overlap guard, console, bitácora, checkpoint, verify/archive)
