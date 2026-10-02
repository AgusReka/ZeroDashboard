# Apply Progress: CH-19a — Connection Channel Seam and Protocol Types

**Mode**: Strict TDD (requested by `tasks.md` and the orchestrator; `openspec/config.yaml` still says `strict_tdd: false` from the greenfield init)
**Status**: partial. 18 of 21 tasks complete. Stopped at the budget checkpoint 4.4.
**Commits**: none. The orchestrator instructed apply not to commit, so every "commit" step in the checkpoints is deferred.

## Stop Reason: Budget Checkpoint 4.4 Failed

| Measure | Value |
|---|---|
| Changed lines (additions + deletions), new files included | **547** (518 + 29) |
| Budget | 400 |
| Plain `git diff --stat` (tracked files only, omits the three new files) | 108 (79 + 29). Not used as the measure, because it hides most of the review load |

Per-file (numstat; new files counted as additions):

| File | + | - | Design estimate |
|---|---|---|---|
| `src/agente-protocolo.ts` (new) | 52 | 0 | 40 |
| `src/agente-protocolo.test.ts` (new) | 48 | 0 | 25 |
| `src/db-probe.ts` | 28 | 2 | 35 |
| `src/conexion-destino.ts` | 16 | 0 | 14 |
| `src/conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts`, `planificador.ts` | 8 | 26 | 32 |
| `src/conexion-destino.test.ts` | 27 | 1 | 12 |
| `src/db-probe-canal.test.ts` (new) | 339 | 0 | 200 |
| **Total** | **518** | **29** | **~358** |

Production code is about 132 changed lines; the remaining ~415 are tests. The overrun is in the spike suite (339 vs 200 estimated): the fake duplex contract alone (relay, silent and refused modes, `_final`, `_destroy`) plus the PostgreSQL fixture take about 150 lines.

The fallback split in `tasks.md` does **not** bring PR A under budget: unit 4 accounts for about 55 lines (D1, D2, Q2-Q4 and the `alAbrir` hook), so PR A (units 1-3 with C1-C5 and Q1) would still be about 492 lines. Per the task rule, no `size:exception` was requested and the code was not compressed. The chain strategy is the user's decision.

## Spike Gate (C2, Q1)

Both pass. The stream seam is **not** refuted, so DEC-112 does not go back to the user on these grounds.

## Task Status

| Task | Status |
|---|---|
| 1.1-1.3 | Done |
| 1.4 | Done (tsc clean; commit deferred) |
| 2.1-2.6 | Done |
| 2.7 | Done (suite and tsc green; commit deferred) |
| 3.1-3.3 | Done |
| 3.4 | Done (suite and tsc green; grep clean; commit deferred) |
| 4.1-4.3 | Done |
| 4.4 | **Failed**: 547 > 400. Stop |
| 4.5 | Not run as a task (blocked by 4.4). The verification it names was still executed and is recorded below |
| 4.6 | Not run (orchestrator phase) |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1-1.3 | `src/agente-protocolo.test.ts` | Unit + type-level | 687/687 baseline | Written: P1 failed (`ERR_MODULE_NOT_FOUND`); tsc failed (TS2307, and the exhaustiveness check TS2322) | 2/2 pass, tsc exit 0 | Mutation: adding `tenantId` to `AperturaSesion` makes tsc fail (TS2322 at the tenant guard); reverted | None needed |
| 2.1-2.4 | `src/db-probe-canal.test.ts` | Integration (live PG via fake relay) | 687/687 | Written before the seam: C2, C3, C4, C5, Q1 failed (5 of 6); C1 passed (pre-existing direct-mode guard); tsc TS2305/TS2353 | 6/6 pass, tsc exit 0 | Mutation: dropping `ssl: false` makes C2 fail; reverted | C3 timing assertion tightened to one 2500 ms ceiling per attempt; `assert.ok` narrowing in C3 and Q1 |
| 2.5 | same | Unit (no PG) | — | Written before the seam (see 2.1-2.4): C3-C5 failed | Pass | C3 covers probe and engine; C4 the refused path; C5 the close | — |
| 2.6 | same | Integration | — | Written before the seam: Q1 failed | Pass (2 of 3 rows, `hayMas: true`) | — | — |
| 3.1-3.3 | `src/conexion-destino.test.ts` | Unit (no PG) + one live assertion | 7/7 in file | Written: `camposDeDestino` missing export, file failed to load; tsc TS2305 | 9/9 pass | Two cases: with a channel (same reference, `id` dropped) and without one (`canal: undefined`) | None needed |
| 4.1 | `src/db-probe-canal.test.ts` | Integration | 697/697 | Passed on first run (the design expects GREEN: the DEC-111 listener already exists). Discrimination proven by mutation: with the seam disabled D1 fails; with the `'error'` listener removed D1 fails | Pass | — | — |
| 4.2 | same | Integration | — | Passed on first run; fails with the seam disabled | Pass (destroy at ~300 ms into `pg_sleep(2)`, total ~381 ms) | — | — |
| 4.3 | same | Integration | — | Passed on first run; Q2, Q3, Q4 all fail with the seam disabled | Pass | — | — |

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness | Rollback boundary |
|---|---|---|---|
| 1 | `npx tsx --test src/agente-protocolo.test.ts`: tests 2, pass 2, fail 0. `npx tsc --noEmit`: exit 0 | N/A: types only | Delete `src/agente-protocolo.ts` and `src/agente-protocolo.test.ts` |
| 2 | `TEST_DB_PORT=5434 npx tsx --test src/db-probe-canal.test.ts`: tests 6, pass 6, fail 0, skipped 0 (at the unit 2 checkpoint) | Live PG on `localhost:5434` (container `zd-ch09-testdb`) through the in-memory fake relay | Revert `src/db-probe.ts`; delete `src/db-probe-canal.test.ts` |
| 3 | `TEST_DB_PORT=5434 npx tsx --test src/conexion-destino.test.ts`: tests 9, pass 9, fail 0 | N/A: pure function; existing suites prove direct mode | Revert `src/conexion-destino.ts`, `src/conexion-destino.test.ts` and the four callers |
| 4 | `TEST_DB_PORT=5434 npx tsx --test src/db-probe-canal.test.ts`: tests 11, pass 11, fail 0, skipped 0 | Live PG: fake destroyed idle (D1) and mid-statement (D2); `ch19a_escritor` role (Q2) | Revert the D1, D2, Q2-Q4 tests and the `alAbrir` hook in the spike file |

## Full Verification (final working tree)

| Command | Observed result |
|---|---|
| `TEST_DB_PORT=5434 npm test` (baseline, before any edit) | tests 687, suites 98, pass 687, fail 0, cancelled 0, skipped 0 |
| `npx tsc --noEmit` (baseline) | exit 0 |
| `TEST_DB_PORT=5434 npm test` (after unit 2) | tests 695, pass 695, fail 0, skipped 0 |
| `TEST_DB_PORT=5434 npm test` (after unit 3) | tests 697, pass 697, fail 0, skipped 0 |
| `TEST_DB_PORT=5434 npm test` (final) | tests 702, suites 102, pass 702, fail 0, cancelled 0, skipped 0 (687 baseline + 15 new) |
| `npx tsc --noEmit` (final) | exit 0, no output |
| `git diff --stat -- prisma package.json package-lock.json .env.example` | empty |
| Grep `canal` in `src/**` excluding tests | Only the type (`db-probe.ts:39`), the seam branch (`:136-138`) and the pass-through (`conexion-destino.ts:74`). No production path sets a channel |

The test PostgreSQL was running (`localhost:5434`), so no live suite was skipped.

## Files Changed

| File | Action | What |
|---|---|---|
| `src/agente-protocolo.ts` | Created | Types only, zero imports: `TipoCanal`, `AperturaSesion`, `Latido`, `MensajeControl`, `CodigoErrorAgente` |
| `src/agente-protocolo.test.ts` | Created | P1, P2 (runtime and type-level) |
| `src/db-probe.ts` | Modified | `CanalDuplex`, `AbrirCanal`, `canal?` on `DestinoPostgres`, one branch in `iniciarConexion` |
| `src/db-probe-canal.test.ts` | Created | Fake duplex, `ch19a_pruebas` fixture, C1-C5, D1-D2, Q1-Q4 |
| `src/conexion-destino.ts` | Modified | `camposDeDestino` |
| `src/conexion-destino.test.ts` | Modified | H1 (no PG); `destinoDeConexion` returns no `canal` key |
| `src/conexiones.ts`, `src/consultas.ts`, `src/plantilla-prueba.ts`, `src/planificador.ts` | Modified | Five-field copy replaced by `camposDeDestino` |

## Deviations from Design

- `src/conexiones.ts` passes `camposDeDestino(conexion)` directly to `probeConnection` instead of spreading it, because that call has no other fields. Same object, same behavior.
- In `iniciarConexion` the absent-channel path now passes a named `config` constant holding the same six fields to `new pg.Client(config)`, rather than an inline literal. The configuration is identical.
- `src/validacion-mapeo-rutas.ts` and `src/consulta-ejecucion.ts` are unchanged, as the design states (the proposal's "Modified (input type)" for `consulta-ejecucion.ts` is satisfied by inheritance).

## Issues Found

- The 400-line budget is exceeded (see the stop reason). The forecast underestimated the spike suite.
- A stray empty file `2.6` exists at the repository root (created 2026-10-02 15:38, before this apply ran). It was not created by apply and was left untouched.
