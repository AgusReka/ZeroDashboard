# Apply Progress: CH-19c1 — Engine Side of the Agent Channel

**Mode**: Standard (openspec `strict_tdd: false`), with RED before GREEN per task as `tasks.md` requires.
**Delivery**: auto-chain, stacked-to-main. This batch is unit 1 only (PR 1, base: main). Units 2, 3a, 3b and 4 were not started.
**Status**: unit 1 implemented and green; **line-count checkpoint 1.10 FAILED (over 400). Stopped for an orchestrator decision; the fallback was not applied.**

## Tasks

| Task | State | Notes |
|---|---|---|
| 1.1 | done | `npm view ws version` = 8.22.0; `npm view @types/ws version` = 8.18.2 (latest published types). Pinned exactly: `ws: 8.22.0` (dependencies), `@types/ws: 8.18.2` (devDependencies). `node_modules/ws/lib/websocket.js` has `get isPaused()` (line 149), `pause()` (360), `resume()` (441); `@types/ws` declares all three |
| 1.2 | done | `SesionFallida`, `MensajeControl` union, `CodigoCierre = 4001 \| 4002` (types only) |
| 1.3 | done | A1, A2 written first; RED: `ERR_MODULE_NOT_FOUND` for `./canal-agente.js` |
| 1.4 | done | `CODIGO_SIN_AGENTE`, `errorSinAgente`, `SolicitudSesion`, `PuertoDeSesion`, `AbridorDeCanales`, `CanalAgente` (constructor, `setNoDelay`, `connect`, `adjuntar`) |
| 1.5 | done | A3 RED: missing export `SIN_AGENTES`; GREEN: `SIN_AGENTES` |
| 1.6 | done | A4-A6 RED: A5 and A6 failed with `ERR_METHOD_NOT_IMPLEMENTED`; A4 already passed (base `Duplex.destroy`). GREEN: basic `_write`, `_final`, socket `'close'` -> `destroy()` |
| 1.7 | done | RED (behavioral, after exporting `LIMITE_TRAMA_DATOS` alone): slice test got `['send','write']` not 3 sends; pg test got `pausado === false`. GREEN: `push` false -> `pause`, `_read` -> `resume`, 1 MiB slicing. Mutation: removing the `resume` in `_read` makes the pg A7 case hang (8 s test timeout) |
| 1.8 | done | RED: A9 `soltados` empty; A10 timed out (no 1003). A8 already passed (from 1.6). GREEN: `_destroy` (`soltarSesion`, `close(1000)`), text frame -> `close(1003)` + `destroy()`, `terminado` guard |
| 1.9 | done | `npx tsc --noEmit` clean; full suite green twice; no `.env` / `.env.example` diff |
| 1.10 | **failed — STOP** | Authored lines 461 for code alone (see below). Fallback not applied, per orchestrator instruction |

## TDD / Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npx tsx --test --test-timeout=8000 src/canal-agente.test.ts src/agente-protocolo.test.ts`: exit 0, `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0`, `ℹ skipped 0` |
| Runtime harness | Real loopback `ws` pair (`WebSocketServer` on port 0) plus live test PostgreSQL on 5434 relayed by a `net.connect` far side: A6 (SSL off with `PGSSLMODE=require`, `SELECT 1`, engine page via `ejecutarConsulta` as a fresh read-only role) and A7 (8 x 1 MB rows with a stalled consumer) pass |
| Type check | `npx tsc --noEmit`: exit 0, no output |
| Full suite | `TEST_DB_PORT=5434 npm test` run twice: exit 0 both times, `ℹ tests 737`, `ℹ suites 108`, `ℹ pass 737`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. Baseline after 19b was 725 tests / 106 suites; +12 tests (11 A-cases, 1 P3) and +2 suites. No suite skipped itself |
| Rollback boundary | Revert `package.json`, `package-lock.json`, `src/agente-protocolo.ts`, `src/agente-protocolo.test.ts`, and delete `src/canal-agente.ts`, `src/canal-agente.test.ts`. Nothing is wired; no schema change |

## Line-Count Checkpoint (1.10)

Method: `git diff --stat` plus untracked files, excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md`.

| File | + / - |
|---|---|
| `package.json` | +3 / -1 |
| `src/agente-protocolo.ts` | +21 / -3 |
| `src/agente-protocolo.test.ts` | +15 / -1 |
| `src/canal-agente.ts` (new) | +147 |
| `src/canal-agente.test.ts` (new) | +270 |
| **Code subtotal** | **461** |
| `openspec/.../tasks.md` (checkboxes) | +8 / -8 |
| `openspec/.../apply-progress.md` (new) | this file |

Over the 400 limit by 61 on code alone. The pre-agreed fallback (move A8-A10 and `_final` coverage to unit 2) removes about 32 test lines (~48 if `_final`/`_destroy` code moved too), which still leaves ~413-429: it does not reach 400 by itself. Decision belongs to the orchestrator.

## Deviations from Design

- `_final` landed in 1.6, not 1.8: A5's "close returns while connecting" cannot pass without it. A9 still went RED in 1.8 on the missing `_destroy` (`soltarSesion`).
- A text frame on a data socket closes the socket with **1003** and then destroys the channel. The design's `CanalAgente` sketch only says "text -> destroy" (whose `_destroy` closes with 1000); the spec scenario "Text on data" requires 1003, so the spec wins.
- Private `terminado` flag: a frame that arrives after `_final`/`_destroy` is dropped instead of pushed (avoids `ERR_STREAM_PUSH_AFTER_EOF`). Internal detail, no contract change.
- `@types/ws` is 8.18.2, the latest published; there is no 8.22 types release.
- A6 "Q1 rows" is proven through `ejecutarConsulta` with a fresh no-grant role `ch19c1_lector` over a `VALUES` list (no table fixture), which keeps the engine's privilege check and pagination in the path.

## Issues / Risks

- Budget: unit 1 is 461 code lines against the 400 limit (estimate was ~326; same 30-50% overshoot recorded for earlier slices).
- `adjuntar` on an already destroyed channel is not guarded in `CanalAgente`; unit 2's registry must keep `adjuntarDatos` returning `false` once `soltarSesion` has removed the session.
- No unregistered architecture decision was found.

## Update 2026-10-03: A6-A10 moved to unit 2 (user decision)

- Moved A6-A10 (A6/A7 live PostgreSQL, A7 1 MiB slicing, A8 far-side close, A9 `end()` while connecting / session release, A10 text frame 1003) to new `src/canal-agente-ampliado.test.ts` (152 lines, belongs to unit 2, untracked). Code in `src/canal-agente.ts` is unchanged.
- Shared fixtures extracted to non-test `src/canal-agente-apoyo.ts` (65 lines, stays in unit 1); `relevar` and `conRelevo` live only in the moved file.
- Unit 1 line count (tracked diff 44 + untracked 147 + 75 + 65): **331** (limit 400). Checkpoint 1.10 resolved.
- Verification: `npx tsc --noEmit` exit 0; focused `canal-agente.test.ts canal-agente-ampliado.test.ts agente-protocolo.test.ts`: tests 14, pass 14, fail 0, skipped 0; full `TEST_DB_PORT=5434 npm test`: tests 737, suites 109, pass 737, fail 0, cancelled 0, skipped 0.
