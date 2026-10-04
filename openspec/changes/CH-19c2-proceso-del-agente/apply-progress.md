# Apply Progress: CH-19c2 — Agent Process

**Mode**: Standard (`openspec/config.yaml` has `strict_tdd: false`), with RED-before-GREEN as the tasks require.
**Delivery**: auto-chain, stacked-to-main, no `size:exception`.
**Branch**: `ch19c2/config-y-politicas`. Nothing committed.

## Status

Unit 1: tasks 1.1-1.7 done; task 1.8 (line-count checkpoint) FAILED at 429 lines against a 400 limit. Work stopped there per the stop rule. Units 2-5 not started.

## Completed Tasks

- [x] 1.1 RED C1-C6 (`src/agente-proceso/config.test.ts`)
- [x] 1.2 GREEN `limites.ts`, `politica-tls.ts`
- [x] 1.3 RED L1-L5 (`src/agente-proceso/destinos.test.ts`)
- [x] 1.4 GREEN `destinos.ts`
- [x] 1.5 GREEN `config.ts`
- [x] 1.6 RED then GREEN P1 (`src/agente-proceso/paridad.test.ts`)
- [x] 1.7 Checkpoint: `npm test` green, `npx tsc --noEmit` clean, no `.env` change, no engine import in agent files
- [ ] 1.8 Line-count checkpoint: 429 > 400, STOP (see below)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.1/1.2/1.5 | `npx tsx --test src/agente-proceso/config.test.ts`: exit 1, `ERR_MODULE_NOT_FOUND` for `config.js`, tests 1 pass 0 | Same file with `destinos.test.ts`: exit 0, tests 14 pass 14 fail 0 | None needed |
| 1.3/1.4 | `npx tsx --test src/agente-proceso/destinos.test.ts`: exit 1, `ERR_MODULE_NOT_FOUND`, tests 1 pass 0 fail 1 | Same run as above, 14/14 | Removed a redundant ternary in `leerEntrada` (IPv6 host only lowercased) before the GREEN run |
| 1.6 | `limites.ts` already existed (1.2), so RED was a temporary mutation `tramaControl: 4095`: exit 1, `4095 !== 4096`, tests 1 fail 1. File restored, byte-identical (`git diff --no-index` exit 0) | `npx tsx --test src/agente-proceso/paridad.test.ts`: exit 0, tests 1 pass 1 | None |

Note: 1.2's GREEN was observed together with 1.5, because `politica-tls.ts` and `destinos.ts` throw `ErrorConfig`, which the design places in `config.ts`.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/agente-proceso/config.test.ts src/agente-proceso/destinos.test.ts` exit 0, 14/14; `npx tsx --test src/agente-proceso/paridad.test.ts` exit 0, 1/1 |
| Types | `npx tsc --noEmit` exit 0 (also checks at compile time that `opcionesSocket(...)` is assignable to the `ws` `ClientOptions`) |
| Full suite | `TEST_DB_PORT=5434 npm test` exit 0: tests 782, suites 121, pass 782, fail 0, cancelled 0, skipped 0. Baseline 767 + 15 new = 782 |
| Runtime harness | P1 runs against the real engine constants, real `generarTokenAgente()` and a real `crearRegistroAgentes()` with a fake control socket. No network boundary in this unit |
| Rollback boundary | Delete `src/agente-proceso/` (7 new files). No existing file changed except this change's OpenSpec documents |

## Test placement

Tests live in `src/agente-proceso/`. With the current unquoted script (`tsx --test src/**/*.test.ts`), npm on this Windows machine runs scripts in `cmd.exe` (`script-shell` is null), which passes the glob to Node unexpanded; Node's own glob matches subdirectories. The full run shows 782 = 767 + 15, and the three new files' tests appear in the output. Under POSIX `sh` the unquoted glob would now expand to `src/*/*.test.ts` and drop the flat tests; there is no CI in the repository, and the quoting fix is task 4.6 (unit 4).

## Line-count checkpoint (task 1.8) — FAILED

Method: `git diff --stat` (only `openspec/.../tasks.md`, excluded) plus untracked files (`src/agente-proceso/`), excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md` and OpenSpec files.

| File | Lines |
|---|---|
| `src/agente-proceso/limites.ts` | 33 |
| `src/agente-proceso/config.ts` | 49 |
| `src/agente-proceso/politica-tls.ts` | 55 |
| `src/agente-proceso/destinos.ts` | 66 |
| `src/agente-proceso/config.test.ts` | 117 |
| `src/agente-proceso/destinos.test.ts` | 69 |
| `src/agente-proceso/paridad.test.ts` | 40 |
| **Total** | **429** (code 203, tests 226; estimate was 345) |

Per the stop rule nothing was trimmed. Decision needed from the orchestrator. Possible paths (none applied):
- Accept `size:exception` for PR 1 (the user declined it on 2026-10-03, so this needs the user).
- Split PR 1. Note: `destinos.ts` and `politica-tls.ts` import `ErrorConfig` from `config.ts`, and `config.ts` imports both, so any split that ships `destinos` without `config` requires moving `ErrorConfig` to its own file (a design-level file move, not an architecture decision).

## Deviations from Design

- `opcionesSocket` returns a local structural type `OpcionesSocket` instead of importing `ClientOptions` from `ws`, to keep unit 1 to `node:*` and same-directory imports as instructed. `config.test.ts` assigns the result to a `ClientOptions` variable, so `tsc` proves compatibility.
- `validarUrlServidor` refuses any `@`, `#` or `?` in the input, so an empty query (`wss://x?`) and empty userinfo (`wss://@x`) are refused too. Stricter than the spec's "non-empty query"; consistent with "origin only".
- Allowlist DNS names must have a last label containing a letter, so IP-like ranges such as `10.0.0.1-10.0.0.9` or `10.0.0.1-9` cannot pass as names. Side effect: a single-label all-digit-and-hyphen name is refused. Digits-only names must pass `net.isIPv4` (refuses `127.1`, `010.0.0.1`).
- IPv6 entries are lowercased only (no trailing-dot strip); DNS and IPv4 entries use `normalizarHost`.
- Import cycle `config.ts` <-> `destinos.ts` / `politica-tls.ts` (from the design placing `ErrorConfig` in `config.ts`). Safe in ESM because no module uses the others at top level.

## Files Changed

| File | Action |
|---|---|
| `src/agente-proceso/limites.ts` | Created |
| `src/agente-proceso/config.ts` | Created |
| `src/agente-proceso/politica-tls.ts` | Created |
| `src/agente-proceso/destinos.ts` | Created |
| `src/agente-proceso/config.test.ts` | Created |
| `src/agente-proceso/destinos.test.ts` | Created |
| `src/agente-proceso/paridad.test.ts` | Created |
| `openspec/changes/CH-19c2-proceso-del-agente/tasks.md` | 1.1-1.7 marked `[x]` |

---

# Unit 2: Logger, Bridge, Sessions

**Branch**: `ch19c2/logger-y-puente` (stacked on the unit 1 tests branch). Nothing committed.
**Mode**: Standard, RED before GREEN for every file.

## Status

Tasks 2.1-2.8 done. Task 2.9 (line-count checkpoint) FAILED at 616 lines against a 400 limit. Work stopped there per the stop rule. Units 3-5 not started. The pre-agreed fallback (moving `sesiones.ts` and its test, 143 lines, to PR 2b) is NOT enough on its own: the remaining logger plus bridge measure 473.

## Completed Tasks

- [x] 2.1 RED G1-G3 (`src/agente-proceso/log.test.ts`)
- [x] 2.2 GREEN `log.ts`
- [x] 2.3 RED B1-B4 (`src/agente-proceso/puente.test.ts`)
- [x] 2.4 RED B5-B8 (same file), plus B9 (data-socket watchdog, see deviations)
- [x] 2.5 GREEN `puente.ts`
- [x] 2.6 RED T1-T3 (`src/agente-proceso/sesiones.test.ts`)
- [x] 2.7 GREEN `sesiones.ts`
- [x] 2.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean
- [ ] 2.9 Line-count checkpoint: 616 > 400, STOP (see below)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.1/2.2 | `npx tsx --test src/agente-proceso/log.test.ts`: tests 1 pass 0 fail 1, `ERR_MODULE_NOT_FOUND` for `log.js` | Same command: tests 3 pass 3 fail 0 | None |
| 2.3/2.4/2.5 | `npx tsx --test src/agente-proceso/puente.test.ts`: fail 1, `ERR_MODULE_NOT_FOUND` for `puente.js` | Same command: tests 9 pass 9 fail 0 (B1-B9) | None |
| 2.6/2.7 | `npx tsx --test src/agente-proceso/sesiones.test.ts`: tests 1 fail 1, `ERR_MODULE_NOT_FOUND` for `sesiones.js` | Three files together: tests 15 pass 15 fail 0 | None |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/agente-proceso/log.test.ts src/agente-proceso/puente.test.ts src/agente-proceso/sesiones.test.ts`: exit 0, tests 15, suites 3, pass 15, fail 0 |
| Types | `npx tsc --noEmit`: exit 0, no output |
| Full suite | `TEST_DB_PORT=5434 npm test` (container `zd-ch09-testdb`): exit 0, tests 797, suites 124, pass 797, fail 0, cancelled 0, skipped 0. Baseline 782 + 15 new = 797 |
| Runtime harness | B1-B4, B7-B9 run the real bridge against a local `net` replica server and a local `WebSocketServer({ port: 0, maxPayload: 1 MiB, perMessageDeflate: false })`; B2 moves 4 MiB each way with a paused consumer and checks byte equality and frames of at most 1 MiB |
| Rollback boundary | Delete `src/agente-proceso/log.ts`, `log.test.ts`, `puente.ts`, `puente.test.ts`, `sesiones.ts`, `sesiones.test.ts`. Nothing imports them; no existing file changed except this change's OpenSpec documents |

## Line-count checkpoint (task 2.9) — FAILED

Method: `git diff --stat` (only `openspec/.../tasks.md`, excluded) plus untracked files, excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md` and OpenSpec files.

| File | Lines |
|---|---|
| `src/agente-proceso/log.ts` | 55 |
| `src/agente-proceso/log.test.ts` | 50 |
| `src/agente-proceso/puente.ts` | 166 |
| `src/agente-proceso/puente.test.ts` | 202 |
| `src/agente-proceso/sesiones.ts` | 69 |
| `src/agente-proceso/sesiones.test.ts` | 74 |
| **Total** | **616** (code 290, tests 326; estimate was 380) |

Nothing was trimmed and no file was moved. Dependency order: `puente.ts` imports the `Log` type from `log.ts`; `sesiones.ts` imports `puente.ts`. Splits that respect it and fit 400 each (none applied, orchestrator's decision): log (105) -> bridge (368) -> sessions (143); or log plus bridge code with tests in a following PR, as unit 1 was delivered.

## Deviations from Design

- `log.ts` already holds `mensaje-invalido` (listed for PR 3) and `error-interno` (listed for PR 4). `mensaje-invalido` is the event `sesiones.abrir` records for a malformed `sesionId`; `error-interno` is the only event with `nombreError`, so G3 can be tested through the public type. Tasks 3.6 and 4.2 then add five and three events instead of six and four.
- `sesiones.abrir` validates `sesionId` against `FORMATO_SESION` itself (spec "Malformed sesionId": ignored, `mensaje-invalido`, nothing reported, no replica). The control loop of unit 3 can rely on it; K8-K10 still apply at the loop level.
- Cap refusal logs `tope-de-sesiones` AND `destino-no-permitido`. The spec (Error Reporting) requires `destino-no-permitido` for the cap, allowlist and malformed `host`/`puerto`; task 2.6 requires `tope-de-sesiones` for the cap. Both are emitted to satisfy both literally; needs the orchestrator's confirmation.
- The bridge arms the 50 s ping watchdog on the data socket (spec Ping Watchdog: "a control or data socket"); no task named it, so it is covered by an extra case B9. It logs nothing of its own; the session's end logs `sesion-cerrada`.
- The data-dial 10 s handshake timeout is not enforced in the bridge: it comes from the injected `abrirDatos`, which in unit 3 must build the socket with `opcionesSocket(token, LIMITES_AGENTE.tramaDatos)` (`handshakeTimeout` 10 s, `maxPayload` 1 MiB, `perMessageDeflate: false`).
- Close handling: when the data socket closes after it opened, the replica gets `destroySoon()` (pending bytes such as the client's `Terminate` reach the replica); on a failed data dial, a text frame, `cerrar()` or a replica failure it gets `destroy()`. A replica close closes the data socket with 1000.
- `abrirReplica` throwing synchronously is reported through `codigoDeError` (for example `EMFILE` -> `EHOSTUNREACH`); `abrirDatos` throwing synchronously is a data-dial failure (replica destroyed, nothing reported). This is how `abrir` never throws.
- Named exports beyond the design's signatures: `DependenciasPuente`, `Puente`, `DependenciasSesiones`.

## Files Changed (unit 2)

| File | Action |
|---|---|
| `src/agente-proceso/log.ts` | Created |
| `src/agente-proceso/log.test.ts` | Created |
| `src/agente-proceso/puente.ts` | Created |
| `src/agente-proceso/puente.test.ts` | Created |
| `src/agente-proceso/sesiones.ts` | Created |
| `src/agente-proceso/sesiones.test.ts` | Created |
| `openspec/changes/CH-19c2-proceso-del-agente/tasks.md` | 2.1-2.8 marked `[x]` |

---

# Unit 3: Backoff, Control Loop, Classification, Watchdog

**Branch**: `ch19c2/bucle-de-control` (stacked on `ch19c2/sesiones`). Nothing committed.
**Mode**: Standard (`strict_tdd: false`), RED before GREEN for every file.

## Status

Tasks 3.1-3.8 done. Task 3.9 (line-count checkpoint) FAILED at 444 lines against a 400 limit. Work stopped there per the stop rule; no test was trimmed and no file was moved. Units 4-5 not started.

## Completed Tasks

- [x] 3.1 Doc fix: the "Control message from the engine" row of `design.md` now says a well-shaped message with a malformed `sesionId` is ignored (`mensaje-invalido`, nothing reported, connection kept, no 1008); 1008 stays for non-JSON, wrong key set or unknown `tipo`
- [x] 3.2 RED then GREEN `espera.test.ts` / `espera.ts`
- [x] 3.3 RED K1-K4 (`agente.test.ts`; K4 = 1006/1000 retry, inside the K3 case table)
- [x] 3.4 RED K5-K7
- [x] 3.5 RED K8-K10 (K10 is two tests: options spy plus URL check, and `detener`)
- [x] 3.6 GREEN `log.ts`: `control-conectado`, `sin-ping`, `control-rechazado`, `control-cerrado`, `reconexion-programada` (`mensaje-invalido` already existed from unit 2)
- [x] 3.7 GREEN `agente.ts` (`MotivoFin`, `DependenciasAgente`, `Agente`, `iniciarAgente`)
- [x] 3.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean
- [ ] 3.9 Line-count checkpoint: 444 > 400, STOP (see below)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.2 | `npx tsx --test src/agente-proceso/espera.test.ts`: tests 1 pass 0 fail 1, `ERR_MODULE_NOT_FOUND` for `espera.js` | Same command: tests 2 pass 2 fail 0 | None |
| 3.3-3.7 | `npx tsx --test src/agente-proceso/agente.test.ts`: tests 1 pass 0 fail 1, `ERR_MODULE_NOT_FOUND` for `agente.js` | `npx tsx --test src/agente-proceso/agente.test.ts src/agente-proceso/espera.test.ts src/agente-proceso/log.test.ts`: tests 15 pass 15 fail 0; `agente.test.ts` alone 5 runs in a row, 10/10 each | Waits in `agente.test.ts` made bounded (5 s per poll, 30 s suite timeout) after a mutation run showed a regression would hang instead of failing |

Mutation check (each applied to a scratch copy of `agente.ts`, restored byte-identical with `cmp`, then 10/10 green again): 4001 not terminal (K3 timeout, exit 1); no re-arm on ping (K7 fails); stability timer not resetting (K6 fails); `informar` never sends (K9 fails); binary not closed with 1003 (K8 fails); 403 not terminal (K1 timeout, exit 1). All six killed.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/agente-proceso/agente.test.ts src/agente-proceso/espera.test.ts src/agente-proceso/log.test.ts`: exit 0, tests 15, suites 3, pass 15, fail 0 |
| Types | `npx tsc --noEmit`: exit 0, no output |
| Full suite | `TEST_DB_PORT=5434 npm test` (container `zd-ch09-testdb`): exit 0, tests 809, suites 126, pass 809, fail 0, cancelled 0, skipped 0. Baseline 797 + 12 new (2 espera, 10 agente) = 809 |
| Runtime harness | Fake engine `WebSocketServer({ port: 0, verifyClient })` on loopback with real `ws` client sockets: refusals by status (401, 403, 404, 500), a closed port, server closes 4001/4002/1000 and terminate (1006), server pings, text and binary control frames, and a data upgrade refused with 404. Timers are a fake `programar` fired by the test |
| Rollback boundary | Delete `src/agente-proceso/espera.ts`, `espera.test.ts`, `agente.ts`, `agente.test.ts`; revert the `log.ts` hunk (5 events, header comment). Nothing imports `agente.ts` yet |

## Line-count checkpoint (task 3.9) — FAILED

Method: `git diff --stat` (`log.ts` 13+/2-; OpenSpec files excluded) plus untracked files, excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md` and OpenSpec files.

| File | Lines |
|---|---|
| `src/agente-proceso/log.ts` (diff) | 15 |
| `src/agente-proceso/espera.ts` | 12 |
| `src/agente-proceso/agente.ts` | 163 |
| `src/agente-proceso/espera.test.ts` | 22 |
| `src/agente-proceso/agente.test.ts` | 232 |
| **Total** | **444** (code 190, tests 254; estimate was 355) |

No split was pre-approved for this unit. Possible splits that respect dependencies (none applied, orchestrator's decision): code with `espera.test.ts` (212) then `agente.test.ts` (232) in the next PR, as unit 1 was delivered; or `espera` plus `log.ts` (49) then `agente.ts` with its test (395).

## Deviations from Design

- Backoff formula follows the design (`tope = min(60 s, 1 s * 2^(intento + 1))`, delay in `[tope/2, tope]`): with `aleatorio` at 0 the delays are 1, 2, 4 ... 30 s and at 1 they are 2, 4, 8 ... 60 s. The spec's wording "random fixed at 1 gives 1, 2, 4" cannot hold together with its own 1 s minimum under equal jitter; the design's reading keeps every delay within 1 s to 60 s (DEC-123). Needs confirmation, not a new decision.
- `programar` and `aleatorio` are optional in `DependenciasAgente` (defaults: plain `setTimeout`, `Math.random`), because task 3.7 puts the default timer in `agente.ts`. The design interface lists them as required.
- `iniciarAgente` re-validates `config.servidor` with `validarUrlServidor` before any socket and throws `ErrorConfig` synchronously on a bad origin (prompt rule "validate the control URL with the TLS policy before new WebSocket"). K10 covers it.
- `control-cerrado` is logged on every control close that is not a stop, including terminal ones and the 1006 that follows a refused upgrade; `control-rechazado` precedes it for refusals.
- A binary control frame closes with 1003 without logging `mensaje-invalido` (design row: binary 1003, "anything else logs").
- `terminado` resolves after `sesiones.cerrarTodas` settles; it does not wait for the control socket's closing handshake. `arranque` (unit 4) bounds the wait to 5 s.
- A close of a socket that is no longer `control` is ignored (only the current socket can end the agent with 4001); with one dial at a time this is a guard, not a reachable path.
- Exported `Agente` interface (the return type of `iniciarAgente`) beyond the design's signatures.
- Not covered by a unit-3 test: sessions surviving a control drop (by construction, a control close never touches the session table). No planned case asserts it either: e2e A3 (unit 5) checks reconnection and a fresh probe only.

## Files Changed (unit 3)

| File | Action |
|---|---|
| `src/agente-proceso/espera.ts` | Created |
| `src/agente-proceso/espera.test.ts` | Created |
| `src/agente-proceso/agente.ts` | Created |
| `src/agente-proceso/agente.test.ts` | Created |
| `src/agente-proceso/log.ts` | Modified (5 PR 3 events) |
| `openspec/changes/CH-19c2-proceso-del-agente/design.md` | Control-message row corrected (task 3.1) |
| `openspec/changes/CH-19c2-proceso-del-agente/tasks.md` | 3.1-3.8 marked `[x]`; 3.9 measurement recorded |
