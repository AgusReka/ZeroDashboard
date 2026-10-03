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

## Unit 2: In-Memory Registry (2026-10-03)

**Branch**: `ch19c1/registro-de-sesiones` (stacked on `ch19c1/ws-y-canal-agente`). **Status**: implemented and green; **line-count checkpoint 2.6 FAILED (492 > 400). Stopped for an orchestrator decision; nothing trimmed, unit 3a not started.**

### Tasks

| Task | State | Notes |
|---|---|---|
| 2.1-2.3 | done | R1-R6 plus attach/close cases written first in `src/registro-agentes.test.ts`. RED: `ERR_MODULE_NOT_FOUND` for `./registro-agentes.js` (tests 1, fail 1) |
| 2.4 | done | `src/registro-agentes.ts`: `LIMITES`, `CIERRE_REEMPLAZO`, `CIERRE_REVOCADO`, `RegistroAgentes`, `crearRegistroAgentes` (default `programar` = unref'd `setTimeout`; default `generarId` = `randomBytes(16).toString('base64url')`) |
| 2.5 | done | `npx tsc --noEmit` exit 0; full suite green; the registry has no logger call at all |
| 2.6 | **failed — STOP** | 492 changed lines (see below) |
| 2.7 | done | `src/canal-agente-ampliado.test.ts` kept unchanged (152 lines) and counted in 2.6; commit is orchestrator-owned |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npx tsx --test src/registro-agentes.test.ts src/canal-agente-ampliado.test.ts`: exit 0, `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0` (11 registry + 6 A6-A10) |
| Runtime harness | Injected `programar` (manual timers) and `generarId`; fake `EventEmitter` sockets; real `CanalAgente` instances, so `adjuntar`, `_destroy` -> `soltarSesion` and the `'connect'` emission run for real. The default-id case uses the real defaults (unref'd timer, `randomBytes`) |
| Mutation checks | (1) removing `control.tenantId !== tenantId`: R6 fails (tests 11, fail 1). (2) removing the `entry.socket === socket` guard on control close: R1 fails (fail 1). The first run of mutant 1 hung on an unsettled promise; `codigoDe` now races a 1 s unref'd timer so a regression fails instead of hanging |
| Type check | `npx tsc --noEmit`: exit 0, no output |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0, `ℹ tests 748`, `ℹ suites 111`, `ℹ pass 748`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0` (baseline 737 + 11 new) |
| Rollback boundary | Delete `src/registro-agentes.ts`, `src/registro-agentes.test.ts` (and `src/canal-agente-ampliado.test.ts` if unit 2 is reverted as a whole). Nothing is wired; no schema change |

### Line-Count Checkpoint (2.6)

Method: `git diff --stat` (empty: no tracked change) plus untracked files, excluding `package-lock.json`, `docs/design/`, `docs/verificacion-tesis-2026-10-01.md` and openspec files.

| File | Lines |
|---|---|
| `src/registro-agentes.ts` (new) | 173 |
| `src/registro-agentes.test.ts` (new) | 167 |
| `src/canal-agente-ampliado.test.ts` (moved from unit 1, unchanged) | 152 |
| **Total** | **492** |

Over the limit by 92. The estimate was 227 for registry + tests; they came to 340 (+50%, same overshoot as earlier slices). Without the moved A6-A10 file, unit 2 alone is 340. Options for the orchestrator (not applied): (a) ship `canal-agente-ampliado.test.ts` as its own small PR (152) before or after the registry PR (340); (b) accept `size:exception`; (c) another split chosen by the user.

### Deviations / Clarifications

- `cerrarTenant` follows the design and tasks name (the launch prompt said `cerrarPorTenant`).
- `cerrando` is a read-only getter on the registry (task 2.4 lists it; the design sketch omits it).
- `cerrarAgente` closes the attached data socket with 4002 **and** destroys its channel with `ESINAGENTE` at once, so bytes stop without waiting for the close handshake. The design only says "control + data sockets 4002, pending -> ESINAGENTE". Design-level detail, no new architecture decision.
- `registrarControl` while `cerrando` terminates the socket; `adjuntarDatos` while `cerrando` returns false. Guards for the window between the listener's step-4 check and the attach.
- `adjuntarDatos` returns false whenever the session is no longer in the map, its channel is destroyed, it belongs to another agent, or a data socket is already attached. This covers the unit-1 risk (`CanalAgente.adjuntar` does not check `destroyed`).
- Sessions keep their `tenantId` through `canal.solicitud.tenantId` (checked equal to the control entry's token-row tenant at `pedirSesion`); `cerrarTenant` uses both the control entries and the sessions.
- No unregistered architecture decision was found.

## Unit 3a: Upgrade Listener (2026-10-03)

**Branch**: `ch19c1/upgrade-y-autenticacion` (stacked on `ch19c1/registro-de-sesiones`). **Status**: implemented and green; line-count checkpoint 3.7 passed (380). Units 3b and 4 not started. Nothing committed.

### Tasks

| Task | State | Notes |
|---|---|---|
| 3.1 | done | U9 written first, alone. RED: `ERR_MODULE_NOT_FOUND` for `./agente-servidor.js` (tests 1, fail 1) |
| 3.2 | done | U1-U8 added. RED: same `ERR_MODULE_NOT_FOUND` (tests 1, fail 1) |
| 3.3 | done | `src/agente-servidor.ts`: sync `socket.on('error', ignorar)`, checks 1-6 in design order, bare-status-line refusal then `destroy` on `'finish'`, two `noServer` servers (4 KiB / 1 MiB, deflate off, no client tracking), control parsing, `ws.on('error')`. With no close hook yet: U1-U8 pass, **U9 fails behaviorally** (`app.close() did not resolve within 2500 ms`) |
| 3.4 | done | `app.addHook('preClose', ...)` -> `registro.cerrarTodo()`: tests 9, pass 9. Mutation: hook moved to `onClose` -> U9 fails (`did not resolve within 2500 ms`; tests 9, fail 1); restored |
| 3.5 | done | `src/server.ts` builds `crearRegistroAgentes()` and calls `registrarServidorAgentes({ app, prisma, registro })` after the routes. `src/contexto-tenant.ts` unchanged (no diff) |
| 3.6 | done | `npx tsc --noEmit` exit 0; full suite green (below) |
| 3.7 | done | 380 changed lines (below) |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx tsx --test --test-timeout=15000 src/agente-servidor.test.ts`: exit 0, `ℹ tests 9`, `ℹ pass 9`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0` |
| Runtime harness | Real Fastify on `listen({ port: 0, host: '127.0.0.1' })`; the agent is a `ws` client; refusals read as raw bytes over `net.connect`, so "identical 401/404" compares whole responses; U7 uses `fetch` on the same port. The token lookup is a fake keyed by hash (no PostgreSQL needed); like the real one it returns `null` for unknown and revoked tokens, whose `revocadoEn` filter stays proven live in `aislamiento.test.ts` |
| Mutation checks | (1) `preClose` -> `onClose`: U9 fails (2.5 s timeout). (2) The synchronous `socket.on('error', ...)` guard removed: U4's reset surfaces as an uncaught `read ECONNRESET` and the file fails. Both restored |
| Type check | `npx tsc --noEmit`: exit 0, no output |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0, `ℹ tests 757`, `ℹ suites 113`, `ℹ pass 757`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0` (baseline 748 + 9 new; 111 + 2 suites) |
| Rollback boundary | Delete `src/agente-servidor.ts`, `src/agente-servidor.test.ts`; revert the 7 added lines in `src/server.ts`. The registry module stays unwired; no schema or env change |

### Line-Count Checkpoint (3.7)

| File | Lines |
|---|---|
| `src/server.ts` (tracked) | +7 / -0 |
| `src/agente-servidor.ts` (new) | 135 |
| `src/agente-servidor.test.ts` (new) | 238 |
| **Total** | **380** |

### Cases Covered

U1 one identical 401 for: no header, `Basic`, malformed bearer, unknown, revoked, token only in the query, token only in `Sec-WebSocket-Protocol`, data path with no header; only the two well-formed tokens reach the lookup. U2 403 deactivated tenant; a throwing lookup is 500. U3 one identical 404 for: B's token on A's session, A's taken session, unknown id, malformed id, `/agente/otra`, `/otra`; a text frame on an attached data socket closes 1003. U4 reset during a slow lookup: no crash, server still answers. U5 control framing: binary 1003; bad JSON, extra key, agent-sent `apertura-sesion`, non-string `sesionId` 1008; 4097-byte text 1009. U6 `latido` keeps control open; `sesion-fallida` destroys the pending channel with `ECONNREFUSED` before `'connect'`. U7 non-upgrade `GET /agente/control` -> 400 `tenant-no-indicado`. U8 the lookup runs with `tenantActivoOpcional() === null`; the full log contains no token, hash, tenant id, replica host or session id. U9 shutdown under 2500 ms with live control and data sockets; the `onClose` stand-in for `detener` still runs.

### Deviations / Open Points

- **Oversized control frame closes with 1009, not 1008.** The spec scenario "Oversized control or unknown message" says 1008, but the design fixes `maxPayload` 4 KiB on the control server, and `ws` closes a frame over `maxPayload` with 1009 before any handler runs (`receiverOnError` -> `websocket.close(err[kStatusCode])`, `node_modules/ws/lib/websocket.js:1227`). U5 asserts the observed 1009. Spec text or design needs an orchestrator call; no code path in this module can turn it into 1008 while `maxPayload` stays 4 KiB.
- **No 503.** The launch prompt mentions "503 for limits"; neither the design nor the spec has a 503 path. The 8-session cap is enforced at `pedirSesion` (`ESINAGENTE`), and a closing registry destroys the socket at step 4 (design). Not implemented; flagged for the orchestrator.
- `prisma` is typed `{ agente: Pick<PrismaAislado['agente'], 'buscarPorTokenHash'> }` instead of the full `PrismaAislado` in the design sketch. `server.ts` passes the full client unchanged; the narrower type makes "no other model within reach of the upgrade path" structural and lets the tests use a fake lookup.
- A data socket whose session vanished between reservation and attach (TTL or failure in that window) is `terminate`d after the 101. Design-level detail.
- No unregistered architecture decision was found.

## Unit 3b: Ping and 4002 Close (2026-10-03)

**Branch**: `ch19c1/ping-y-cierre-al-revocar` (stacked on `ch19c1/upgrade-y-autenticacion`). **Status**: implemented and green; line-count checkpoint 4.5 passed (201). Unit 4 not started. Nothing committed.

### Tasks

| Task | State | Notes |
|---|---|---|
| 4.1 | done | U10 written first in `src/agente-servidor.test.ts`. RED: `relojes` empty (`actual: []`, `expected: [ 20000 ]`): no ping timer existed. GREEN: optional `programarPing` (repeating timer; default unref'd `setInterval`), one timer per server at `LIMITES.pingMs`, a `Map<WebSocket, boolean>` of every upgraded control and data socket; each tick terminates a socket that missed the last pong and pings the rest; `pong` marks it alive; `close` removes it; `preClose` cancels the timer before `cerrarTodo()`. No data idle timeout |
| 4.2 | done | U11 appended to the live-PG suite in `src/agentes-rutas.test.ts`, U12 to the live-PG suite in `src/tenants.test.ts`. Each builds a second app with a real `crearRegistroAgentes()` and fake sockets (new shared fixture `src/registro-agentes-apoyo.ts`). RED (routes without the parameter): both failed on `actual: [ [], [] ]`, `expected: [ [ 4002 ], [ 4002 ] ]`; the no-socket revoke, the 404 and the 409 parts already passed |
| 4.3 | done | `registerAgenteRoutes(app, prisma, agentes = SIN_REGISTRO)` calls `agentes.cerrarAgente(id)` only after the guarded `updateMany` matched (count > 0), before the projection read. `registerTenantRoutes(app, prisma, agentes = SIN_REGISTRO)` calls `agentes.cerrarTenant(id)` after the `update`. Status codes and bodies unchanged. `src/server.ts` builds the registry before the routes and passes it to both and to `registrarServidorAgentes` |
| 4.4 | done | `npx tsc --noEmit` exit 0; full suite green twice (below) |
| 4.5 | done | 201 changed lines (below) |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npx tsx --test --test-timeout=15000 src/agente-servidor.test.ts src/agentes-rutas.test.ts src/tenants.test.ts`: exit 0, `ℹ tests 35`, `ℹ pass 35`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0` (RED run of the same command: tests 35, pass 32, fail 3: U10, U11, U12) |
| Runtime harness | U10: real Fastify on an ephemeral port, `ws` clients; two sockets with `autoPong: false` (B's control, one data socket of A) and two that auto-pong (A's control, an idle data socket of A); the injected timer is fired twice. U11/U12: `app.inject` against live PostgreSQL on 5434, real registry, fake sockets whose `close` keeps only the first code, like `ws` (a second `close` on a CLOSING socket returns; `node_modules/ws/lib/websocket.js:323`) |
| Mutation check | `ws.on('pong', ...)` removed: U10 fails (the pong-answering sockets are terminated too, readyState `[3, 3]` instead of `[1, 1]`); restored. The route RED above is the no-op-default mutant |
| Type check | `npx tsc --noEmit`: exit 0, no output |
| Full suite | `TEST_DB_PORT=5434 npm test` run twice: exit 0 both times, `ℹ tests 760`, `ℹ suites 114`, `ℹ pass 760`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0` (baseline 757 + 3 new; +1 suite for U10; U11/U12 sit inside existing suites). The pre-existing Mailpit live-delivery case still reports its environmental skip reason (`no Mailpit API at http://127.0.0.1:8026`) |
| Rollback boundary | Revert the 7 tracked files and delete `src/registro-agentes-apoyo.ts`. Routes fall back to their pre-3b signatures; the listener loses the ping; no schema or env change |

### Line-Count Checkpoint (4.5)

| File | + / - |
|---|---|
| `src/agente-servidor.ts` | +31 / -2 |
| `src/agente-servidor.test.ts` | +33 / -4 |
| `src/agentes-rutas.ts` | +12 / -1 |
| `src/agentes-rutas.test.ts` | +35 / -0 |
| `src/tenants.ts` | +11 / -1 |
| `src/tenants.test.ts` | +26 / -0 |
| `src/server.ts` | +5 / -3 |
| `src/registro-agentes-apoyo.ts` (new) | 37 |
| **Total** | **201** |

### Deviations / Open Points

- Each route takes the narrowest `Pick`: `agentes-rutas.ts` takes `Pick<RegistroAgentes, 'cerrarAgente'>` and `tenants.ts` takes `Pick<RegistroAgentes, 'cerrarTenant'>`, instead of the design's shared `Pick<..., 'cerrarAgente' | 'cerrarTenant'>`. `server.ts` passes the same `registro` to both.
- The injected timer is named `programarPing` (a repeating timer) so it is not confused with the registry's one-shot `programar`.
- Shared test fixture `src/registro-agentes-apoyo.ts` (not a test file, like `canal-agente-apoyo.ts`) holds `SocketFalso` and `socketsVivos` for U11 and U12.
- A ping tick logs nothing new: a terminated socket goes through the existing `'agent socket closed'` line (`{ canal, agenteId, codigoCierre: 1006 }`).
- No unregistered architecture decision was found.
