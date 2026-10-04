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

---

# Unit 4: Entrypoint, Boundary, Packaging

**Branch**: `ch19c2/arranque-y-empaquetado` (stacked on `ch19c2/tests-bucle`). Nothing committed.
**Mode**: Standard (`strict_tdd: false`), RED before GREEN for every file.

## Status

Tasks 4.1-4.12 done. Line-count checkpoint 399, within the 400 limit. Unit 5 not started.

## Completed Tasks

- [x] 4.1 RED M1-M5 (`src/agente-proceso/arranque.test.ts`)
- [x] 4.2 GREEN `log.ts` (`configuracion-invalida`, `apagado`, `fin`; `error-interno` already existed), `arranque.ts`, `main.ts`
- [x] 4.3 RED F1-F2 (`src/agente-proceso/frontera.test.ts`), with the temporary forbidden-import proof
- [x] 4.4 GREEN `tsconfig.agente.json`, `build:agente` script; `tsconfig.json` unchanged (`include: ["src"]`)
- [x] 4.5 Baseline before quoting: 816
- [x] 4.6 Quoted glob: 816 -> 816
- [x] 4.7 `Dockerfile`: `build-agente` and `agente` stages; engine stage unchanged and last
- [x] 4.8 `docker-compose.agente.yml`, `.env.agente.example`, `.dockerignore`, `.gitignore`
- [x] 4.9 Manual check A (agent image)
- [x] 4.10 Manual check B (default engine image)
- [x] 4.11 Checkpoint
- [x] 4.12 Line-count checkpoint: 399

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 4.1/4.2 | `npx tsx --test src/agente-proceso/arranque.test.ts`: tests 1 pass 0 fail 1, `ERR_MODULE_NOT_FOUND` for `arranque.js` | Same command with `log.test.ts`: tests 8 pass 8 fail 0 | `nombreDe` returns `string` with an `'Error'` fallback instead of a cast; 5/5 again |
| 4.3/4.4 | `npx tsx --test src/agente-proceso/frontera.test.ts`: tests 2 pass 1 fail 1 (F2: `TS5058`, `tsconfig.agente.json` does not exist; F1 already green on the existing files) | Same command: tests 2 pass 2 fail 0 | None |
| 4.3 proof | Temporary first line in `limites.ts`: `import pg from 'pg';` makes F1 fail (`['pg']`); `import { LIMITE_TRAMA_DATOS } from '../canal-agente.js';` makes F1 fail (`['../canal-agente.js']`) and F2 fail (lists `src/cripto-credencial.ts`, `src/config.ts`, ...). File restored byte-identical (`cmp`), 2/2 green | | |
| 4.6 | Count before quoting: 816 | Count after quoting: 816 | |

Mutation check on `arranque.ts` (scratch backup, restored byte-identical with `cmp`, 5/5 green after): second signal not ignored (M3 fails); crash logs `String(e)` (M5 fails); `credenciales-rechazadas` mapped to 1 (M4 fails); no 5 s cap (M3 fails). A non-config error thrown at start treated as a config error survived at first, so M5 gained a case (start throws `RangeError`, giving `error-interno` `RangeError` and exit 1), which then killed it.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx tsx --test src/agente-proceso/arranque.test.ts src/agente-proceso/frontera.test.ts src/agente-proceso/log.test.ts`: exit 0, tests 10, pass 10, fail 0 |
| Types | `npx tsc --noEmit`: exit 0, no output |
| Builds | `npm run build`: exit 0; `npm run build:agente`: exit 0, emits `dist-agente/agente-proceso/*.js` (11) and `dist-agente/agente-protocolo.js` (output deleted after the check) |
| Full suite | `TEST_DB_PORT=5434 npm test` (container `zd-ch09-testdb`): before quoting tests 816, suites 128, pass 816, fail 0, cancelled 0, skipped 0; after quoting the same; final run after the last edit the same. 809 + 7 new (M1-M5, F1-F2) = 816 |
| Runtime harness (spawned) | A scratchpad script spawns the agent with an env of only `PATH`, `SystemRoot` and `AGENT_*`, a token generated in the script and a random sentinel. For both `node dist-agente/agente-proceso/main.js` and `node --import tsx src/agente-proceso/main.ts`: a userinfo URL, a missing token and a CIDR allowlist entry each exit 1, stdout empty, stderr one JSON line `configuracion-invalida` naming only the variable; sentinel, token and host absent from both streams |
| Runtime harness (Docker) | `docker build --target agente .` exit 0 (check 4.9); default `docker build .` exit 0 and identical to the previous Dockerfile's image (check 4.10); `docker run` without `AGENT_TOKEN` exit 1, stderr `{"ts":...,"nivel":"error","evento":"configuracion-invalida","variable":"AGENT_TOKEN"}`, stdout empty. `docker compose -f docker-compose.agente.yml --env-file <file> config`: with `AGENT_TOKEN=` it fails with `required variable AGENT_TOKEN is missing a value: AGENT_TOKEN is required`; with `.env.agente.example` it names all three variables; no value echoed. The three images built for the checks were removed; no running container was touched |
| Rollback boundary | Delete `src/agente-proceso/arranque.ts`, `arranque.test.ts`, `main.ts`, `frontera.test.ts`, `tsconfig.agente.json`, `docker-compose.agente.yml`, `.env.agente.example`; revert the `log.ts` hunk (3 events), the two `Dockerfile` stages, the `package.json` script lines and the two ignore-file pairs. The engine image is unaffected either way |

## Line-count checkpoint (task 4.12)

Method: `git diff --stat` plus untracked files, excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md` and OpenSpec files.

| File | Lines |
|---|---|
| `src/agente-proceso/log.ts` (diff) | 13 |
| `Dockerfile` (diff) | 17 |
| `package.json` (diff) | 3 |
| `.gitignore`, `.dockerignore` (diff) | 4 |
| `src/agente-proceso/arranque.ts` | 98 |
| `src/agente-proceso/main.ts` | 4 |
| `tsconfig.agente.json` | 9 |
| `docker-compose.agente.yml` | 37 |
| `.env.agente.example` | 17 |
| `src/agente-proceso/arranque.test.ts` | 124 |
| `src/agente-proceso/frontera.test.ts` | 73 |
| **Total** | **399** (code 202, tests 197; estimate was 291) |

## Known design-level choice (for the user to confirm; task 6.2)

The crash handler (`uncaughtException`, `unhandledRejection`) logs `error-interno` with the class name only (never `error.message`, which can carry a host and a port) and exits 1, the same code as a configuration error (DEC-123 A3 defines codes 0-3 only). A distinct code would need a DEC-123 amendment; none was added.

## Deviations from Design

- Configuration and crash lines go to **stderr** through a second sink (`escribirError`, default `process.stderr.write`); every other event stays on stdout. The spec's "Missing or invalid variable" scenario says stderr names the variable; the design had a single stdout sink. The stderr line is still a JSON line of the closed union (Logging requirement), so no plain-text message is printed.
- The agent image follows the launch instructions rather than the design snippet: it generates `package.json` (`{"type":"module"}`) instead of copying the repository's, and uses `ENTRYPOINT` instead of `CMD`. It still holds only `dist-agente`, `node_modules/ws` and that file.
- The default `salir` flushes stdout and stderr (empty writes with callbacks) before `process.exit`, because pipes can be asynchronous and the last `fin` or `configuracion-invalida` line must not be lost.
- After the first exit request, later crashes, signals and the agent's own end are ignored (the process exits once). At the 5 s cap the line `fin` is logged with `motivo: 'detenido'`, `codigoSalida: 0`.
- `ejecutarAgente` also catches a non-`ErrorConfig` exception thrown by `iniciarAgente` at start and routes it to the crash path (`error-interno`, exit 1), so a top-level throw never reaches Node's printout.
- `docker-compose.agente.yml` sets a top-level `name: zerodashboard-agente`, so on a development machine that also runs `docker-compose.yml` the two projects do not share a name and `down --remove-orphans` on one cannot remove the other's containers. It also carries a commented `extra_hosts` line for reaching a replica on the same Linux host.
- Exported `DependenciasArranque` beyond the design's inline parameter type.
- F1 also checks the scan itself on synthetic snippets (`pg`, `../canal-agente.js`, a value import of `../agente-protocolo.js`, a `../agente-token.js` re-export, a dynamic `fastify`, a side-effect `@prisma/client`, `require`), in addition to the temporary-edit proof the task asks for. A `pg` import fails F1 only, not F2: F2 lists files under `src/`, and `pg` lives in `node_modules` (the image's missing `pg` is the third guard).

## Files Changed (unit 4)

| File | Action |
|---|---|
| `src/agente-proceso/arranque.ts` | Created |
| `src/agente-proceso/arranque.test.ts` | Created |
| `src/agente-proceso/main.ts` | Created |
| `src/agente-proceso/frontera.test.ts` | Created |
| `src/agente-proceso/log.ts` | Modified (3 PR 4 events) |
| `tsconfig.agente.json` | Created |
| `docker-compose.agente.yml` | Created |
| `.env.agente.example` | Created |
| `Dockerfile` | Modified (`build-agente` and `agente` stages before the engine stage) |
| `package.json` | Modified (`build:agente`, quoted test glob) |
| `.dockerignore` | Modified (`dist-agente`, `.env.agente`) |
| `.gitignore` | Modified (`dist-agente/`, `.env.agente`) |
| `openspec/changes/CH-19c2-proceso-del-agente/tasks.md` | 4.1-4.12 marked `[x]` with recorded results |

---

# Unit 5: End-to-End Matrix, Spawned Process, TLS Options

**Branch**: `ch19c2/e2e-con-agente-real` (stacked on `ch19c2/arranque-y-empaquetado`). Nothing committed.
**Mode**: Standard (`strict_tdd: false`). Tests only; no production file changed. The production code already existed, so RED is shown by mutation runs (scratch backups, each file restored byte-identical with `cmp`).

## Status

Tasks 5.1-5.9 done. Line-count checkpoint 342, within the 400 limit. All implementation units of the change are complete; 6.1-6.2 are orchestrator-owned archive items.

## Completed Tasks

- [x] 5.1 Fixtures in `src/agente-proceso/proceso-e2e.test.ts`: Prisma, `registrarContextoTenant`, `registerConexionRoutes`, `registrarServidorAgentes`, generated token, `listen({ port: 0, host: '127.0.0.1' })`, TCP forwarder (cut = destroy every live pair), upgrade-path spy (`prependListener('upgrade')`), recorded session ids (`generarId` injected into `crearRegistroAgentes`), skip when PG is absent. `src/agente-e2e.test.ts` untouched
- [x] 5.2 A1-A3
- [x] 5.3 A4-A7
- [x] 5.4 A8-A9
- [x] 5.5 S1-S3
- [x] 5.6 X1 (`src/agente-proceso/tls.test.ts`)
- [x] 5.7 Node source line recorded in `tasks.md` (v24.19.0; Node 22 not verified)
- [x] 5.8 Checkpoint: 829 tests
- [x] 5.9 Line-count checkpoint: 342

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 5.6 X1 | Mutation: `rejectUnauthorized: true` line removed from `politica-tls.ts`; `npx tsx --test src/agente-proceso/tls.test.ts`: tests 1 pass 0 fail 1 (`actual: undefined, expected: true`). Restored, `cmp` equal | Same command: tests 1 pass 1. Two test-side fixes before GREEN: `events.once(ws, 'close')` rejects on the refusal's `'error'` (replaced by a `'close'` promise); `ws` passes the port as a string (compared with `Number`) | None |
| 5.1-5.5 | Mutations, one at a time, against `TEST_DB_PORT=5434 npx tsx --test src/agente-proceso/proceso-e2e.test.ts`: allowlist bypass in `sesiones.ts` (miss dials the engine's host) -> A2 and A9 fail; 4001 removed from the terminal map in `agente.ts` -> A6 fails (10 s bound); close 1006 made terminal -> A3 fails; `control-conectado` logged with the URL plus `log.ts` copying every key -> A9 fails. Each run 11 or 10 pass, the named cases fail; all files restored, `cmp` equal | Same command: tests 12 pass 12 fail 0; with `tls.test.ts`, 13/13 three runs in a row | None |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `TEST_DB_PORT=5434 npx tsx --test src/agente-proceso/proceso-e2e.test.ts src/agente-proceso/tls.test.ts`: exit 0, tests 13, pass 13, fail 0 (three consecutive runs). Without PG (`TEST_DB_PORT=1`): S1 passes, the suite is reported skipped with its reason |
| Types | `npx tsc --noEmit`: exit 0, no output (also proves `CAMPOS` lists every `EventoLog` event and no other) |
| Full suite | `TEST_DB_PORT=5434 npm test` (container `zd-ch09-testdb`): exit 0, tests 829, suites 129, pass 829, fail 0, cancelled 0, skipped 0. Baseline 816 + 13 new = 829 |
| Runtime harness | Real agent (`ejecutarAgente` -> `iniciarAgente`) in process with an `EventEmitter` as `proceso`; real Fastify, registry and upgrade listener on an ephemeral loopback port; live PostgreSQL through a TCP forwarder; spawned `process.execPath --import tsx src/agente-proceso/main.ts` with an env of only `PATH`, `SystemRoot` and `AGENT_*` |
| Rollback boundary | Delete `src/agente-proceso/proceso-e2e.test.ts` and `src/agente-proceso/tls.test.ts`. Nothing else changed outside this change's OpenSpec documents |

## Line-count checkpoint (task 5.9)

Method: `git diff --stat` (only `openspec/.../tasks.md`, excluded) plus untracked files, excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md` and OpenSpec files.

| File | Lines |
|---|---|
| `src/agente-proceso/proceso-e2e.test.ts` | 301 |
| `src/agente-proceso/tls.test.ts` | 41 |
| **Total** | **342** (tests only; estimate was 330) |

## Node source citation (task 5.7)

`node --version`: v24.19.0. On this binary `lib/_tls_wrap.js` is only `const { TLSSocket, Server, createServer, connect } = require('internal/tls/wrap');` plus its export. In `lib/internal/tls/wrap.js`, `exports.connect` is at line 1832, `const allowUnauthorized = getAllowUnauthorized();` at 1836, and the merge `options = { rejectUnauthorized: !allowUnauthorized, ciphers: tls.DEFAULT_CIPHERS, checkServerIdentity: tls.checkServerIdentity, minDHSize: 1024, ...options };` at lines 1838-1844. `getAllowUnauthorized` (`lib/internal/options.js`, line 154) returns `process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'` and emits the warning once. Source read from the running binary via `process.binding('natives')`. **Not verified against Node 22**: no fetch tool was available in this apply, and a different remote read was not authorized; the design's Node 22 location (`lib/_tls_wrap.js`, `connect`) and line need confirmation in the 19e runbook.

## Deviations from Design

- The in-process agent is started through `ejecutarAgente` (which calls the real `iniciarAgente`) with an `EventEmitter` as `proceso`, an injected `salir` and real timers that are `unref`'d, instead of `iniciarAgente` with `detener()` in `finally`. Cleanup is a SIGTERM and a bounded wait for the exit code. This adds exit-code assertions to the terminal cases (A4 2, A5 2, A6 3) and tests graceful shutdown with a real engine in process (A1 exit 0 with `fin detenido`; A8 SIGTERM with a live session: exit 0 and the pg client sees `'end'` within 6 s), as the launch asked, since `child.kill()` is a hard kill on Windows. The `unref` keeps the 5 s shutdown cap from holding the test process open; the 1 s reconnect wait of A3 runs on the same real timer.
- A8 follows task 5.4 (`SELECT $1::text` with 1.5 MiB, both directions), not the launch's `SELECT repeat('x', 1000000)`: 1,000,000 bytes is below 1 MiB (1,048,576), so it would fit in one frame. "Many frames" is proven by the limits, not by counting: both ends set `maxPayload` to 1 MiB, so a larger value can only cross in several frames.
- A9 checks the in-process lines plus the stdout and stderr of S2 and S3; S1 checks its own streams (sentinel, token, host). The forbidden strings are the token, the forwarder URL and its `host:port`, the replica's `host:port`, the closed port's `host:port` and every recorded `sesionId`. The closed key set is per event (`Record<EventoLog['evento'], ...>`), stricter than one global key set.
- A2 and A7 also assert the data-upgrade count does not change; A2 asserts exactly one `destino-no-permitido`; A7 asserts the single `sesion-fallida` carries `ECONNREFUSED`. On this machine the refused loopback dial of A7 took about 50 ms, not the 2 s the design expected.
- X1 also asserts the host and port `ws` hands to `tls.connect`. Setting the variable makes Node print its one-time insecure-TLS warning to the test's stderr; expected.
- S1 lives outside the PG-gated suite (no PG needed); S2 and S3 need the engine and the token lookup, so they are inside it.

## Files Changed (unit 5)

| File | Action |
|---|---|
| `src/agente-proceso/proceso-e2e.test.ts` | Created |
| `src/agente-proceso/tls.test.ts` | Created |
| `openspec/changes/CH-19c2-proceso-del-agente/tasks.md` | 5.1-5.9 marked `[x]` with recorded results |
