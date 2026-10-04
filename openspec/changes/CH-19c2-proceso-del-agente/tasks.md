# Tasks: CH-19c2 — Agent Process

From `design.md` and `specs/agent-process/spec.md`. Where they differ, the SPEC wins. No task edits `docs/01-decisiones.md`. Strict TDD: RED then GREEN, one session per task. Test: `npm test`; types: `npx tsc --noEmit`. Live-PG tests skip when PG is absent. Test ids (C1.., L1.., P1, G1.., B1.., T1.., K1.., M1.., F1.., A1.., S1.., X1) are the design's. Verify, archive and all commits belong to the orchestrator; apply never commits. Nothing is wired into the engine in any PR. Focused runs use `npm test -- <files>`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,700 total: 1 ~345, 2 ~380, 3 ~355, 4 ~291, 5 ~330 |
| 400-line budget risk | High (unit 2 at risk; unit 3 has no room) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 (-> PR 2b if over) -> PR 3 -> PR 4 -> PR 5, each stacked on the previous |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

No `size:exception` (user decision 2026-10-03). Hard limit: 400 changed lines per PR, measured as code plus tests, excluding `package-lock.json`, OpenSpec documents, `docs/design/` and `docs/verificacion-tesis-2026-10-01.md`. Past slices overshot estimates by 30-50%.

**Line-count checkpoint (end of each unit):** run `git diff --stat` PLUS `git status --porcelain`, and count lines of each `??` file (for example `(Get-Content <file>).Count`), applying the exclusions above. **Stop rule:** if additions plus deletions exceed 400, STOP and report to the orchestrator; do not trim tests or start the next unit.

**Ledger note for apply:** use `--max-changed-lines 500` (the ledger counts OpenSpec documents, unlike the checkpoint).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Limits, config, TLS policy, allowlist, parity | PR 1 (base: main) | `npm test -- src/agente-proceso/config.test.ts src/agente-proceso/destinos.test.ts src/agente-proceso/paridad.test.ts` | Parity against real engine values and `generarTokenAgente()` | Revert PR; new files only |
| 2 | Logger, bridge, session table | PR 2 (base: PR 1 branch); fallback PR 2b | `npm test -- src/agente-proceso/log.test.ts src/agente-proceso/puente.test.ts src/agente-proceso/sesiones.test.ts` | Local `net` replica plus local `WebSocketServer` | Revert PR; nothing imports it |
| 3 | Backoff, control loop, classification, watchdog | PR 3 (base: PR 2 branch) | `npm test -- src/agente-proceso/espera.test.ts src/agente-proceso/agente.test.ts` | Fake engine `WebSocketServer({ port: 0, verifyClient })` | Revert PR; nothing imports it |
| 4 | Entrypoint, boundary test, build and packaging | PR 4 (base: PR 3 branch) | `npm test -- src/agente-proceso/arranque.test.ts src/agente-proceso/frontera.test.ts` | `tsc -p tsconfig.agente.json --listFilesOnly`; manual `docker build --target agente .` | Revert PR; Dockerfile and package.json edits are additive |
| 5 | e2e matrix A1-A9, S1-S3, X1 | PR 5 (base: PR 4 branch) | `npm test -- src/agente-proceso/proceso-e2e.test.ts src/agente-proceso/tls.test.ts` | Real agent, real Fastify and registry, live PG, TCP forwarder, spawned process | Revert PR; tests only |

## Unit 1: Limits, Config, TLS Policy, Allowlist (~345)

- [x] 1.1 RED C1-C6 in new `src/agente-proceso/config.test.ts`: missing or empty variable gives `ErrorConfig` naming it; bad token format; URL policy (`wss:` any host, `ws:` only `localhost`, `127.0.0.5`, `[::1]`; refuses `ws://10.0.0.1`, `http:`, userinfo, `#`, `?a`, path); no message contains the input (sentinel); `opcionesSocket` returns exactly the six options with `rejectUnauthorized: true` while `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- [x] 1.2 GREEN `src/agente-proceso/limites.ts` (`LIMITES_AGENTE`, `FORMATO_TOKEN`, `FORMATO_SESION`) and `src/agente-proceso/politica-tls.ts` (`validarUrlServidor`, `opcionesSocket`).
- [x] 1.3 RED L1-L5 in new `src/agente-proceso/destinos.test.ts`: valid DNS, IPv4, `[::1]:5432`; refuses `*`, CIDR, range, missing port, port 0 or 65536, empty item, `127.1:5432`, `0x7f.0.0.1:1`; case, brackets and trailing dot normalize; `127.1` does not match `127.0.0.1`; string port does not match.
- [x] 1.4 GREEN `src/agente-proceso/destinos.ts` (`normalizarHost`, `leerDestinos`, `buscarDestino`, `Destino`, `ListaDestinos`).
- [x] 1.5 GREEN `src/agente-proceso/config.ts` (`ErrorConfig`, `ConfigAgente`, `leerConfig`; reads exactly three variables, never `loadConfig`); C1-C6 and L1-L5 pass.
- [x] 1.6 RED then GREEN P1 in new `src/agente-proceso/paridad.test.ts`: `tramaDatos === LIMITE_TRAMA_DATOS`; `tramaControl === LIMITES.tramaControl`; `sesiones > LIMITES.sesionesPorAgente`; `vigilanciaPingMs > 2 * LIMITES.pingMs`; 50 `generarTokenAgente()` values match `FORMATO_TOKEN`; a `sesionId` from `crearRegistroAgentes()` (fake control socket) matches `FORMATO_SESION`. Test-only imports of engine files are allowed.
- [x] 1.7 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; no `.env` change; no agent file imports an engine module.
- [ ] 1.8 Line-count checkpoint (method above): at most 400, else STOP.

## Unit 2: Logger, Bridge, Sessions (~380, stacked on 1; AT RISK)

- [ ] 2.1 RED G1-G3 in new `src/agente-proceso/log.test.ts`: one JSON line per event; a spread extra key is dropped; `nombreError` sanitized to `Error` when it fails `^[A-Za-z]{1,40}$`.
- [ ] 2.2 GREEN `src/agente-proceso/log.ts` (`EventoLog` with the PR 2 events only, `Log`, `crearLog`; fixed per-event key list, fixed `nivel` map, default sink `process.stdout.write`).
- [ ] 2.3 RED B1-B4 in new `src/agente-proceso/puente.test.ts` (local `net` replica plus local `WebSocketServer`): relay both ways; pause observed in both directions with a slow consumer, payload intact; text frame gives 1003 and destroys the replica; each side's close reaches the other.
- [ ] 2.4 RED B5-B8: replica timeout gives `ETIMEDOUT` (injected `programar`); `EADDRNOTAVAIL` and `EMFILE` map to `EHOSTUNREACH`; replica first, no data dial before the replica connects; a data-dial failure destroys the replica and sends no `sesion-fallida`.
- [ ] 2.5 GREEN `src/agente-proceso/puente.ts` (`Programar`, `codigoDeError`, `abrirPuente`): 1 MiB slices with `{ binary: true }`, no `createWebSocketStream`, no-op `'error'` listeners, bytes never read or logged.
- [ ] 2.6 RED T1-T3 in new `src/agente-proceso/sesiones.test.ts`: 17th session gives `ECONNREFUSED` and `tope-de-sesiones`; unlisted target or malformed host/puerto gives `ECONNREFUSED`, `destino-no-permitido` without host or port, and zero `abrirReplica` calls; an active replayed `sesionId` is ignored; `cerrarTodas` resolves.
- [ ] 2.7 GREEN `src/agente-proceso/sesiones.ts` (`crearSesiones`; cap checked before allowlist; `net.connect` uses the allowlist entry's normalized host; `abrir` never throws).
- [ ] 2.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean.
- [ ] 2.9 Line-count checkpoint (method above). If over 400, STOP and report. Pre-agreed fallback, to apply only on the orchestrator's go: move `src/agente-proceso/sesiones.ts` and `src/agente-proceso/sesiones.test.ts` (tasks 2.6-2.7, ~96 lines) to a sixth PR "2b" between PR 2 and PR 3. PR 3 cannot absorb them.

## Unit 3: Backoff, Control Loop, Classification, Watchdog (~355, stacked on 2; NO ROOM)

- [ ] 3.1 Doc fix: edit the "Control message from the engine" row in `design.md` so a `sesionId` that fails `FORMATO_SESION` is IGNORED (local `mensaje-invalido`, nothing reported to the engine, connection kept, no 1008) per the spec's "Malformed sesionId" scenario; the 1008 close stays for non-text-JSON shape or key violations. Excluded from line counts.
- [ ] 3.2 RED in new `src/agente-proceso/espera.test.ts`: sequence with `aleatorio` at 0 and 1 (1, 2, 4 ... capped at 60 s; each in `[tope/2, tope]`). GREEN `src/agente-proceso/espera.ts` (`esperaReconexion`).
- [ ] 3.3 RED K1-K4 in new `src/agente-proceso/agente.test.ts` (fake engine): 401 and 403 are terminal with zero redials (`credenciales-rechazadas`); 404, 500 and a refused port retry; close 4002 gives `agente-revocado`, 4001 gives `reemplazado`, no retry; 1006 and 1000 retry.
- [ ] 3.4 RED K5-K7: backoff sequence through the loop; stability reset after 30 s and not after 5 s; watchdog: no ping gives `sin-ping` and a redial, a ping at 40 s re-arms it.
- [ ] 3.5 RED K8-K10: bad shape, binary and unknown `tipo` close with 1008 or 1003; malformed `sesionId` is ignored with `mensaje-invalido`, no `sesion-fallida` and the socket stays open (spec wins); `abrirSocket` spy sees control `maxPayload` 4096 and data 1 MiB with the TLS options; `detener` closes with 1001, never redials, is idempotent, first motive wins.
- [ ] 3.6 GREEN `src/agente-proceso/log.ts`: add the PR 3 events (`control-conectado`, `sin-ping`, `mensaje-invalido`, `control-rechazado`, `control-cerrado`, `reconexion-programada`).
- [ ] 3.7 GREEN `src/agente-proceso/agente.ts` (`MotivoFin`, `DependenciasAgente`, `iniciarAgente`): control loop rules of the design; `informar` only while `OPEN`; plain `setTimeout` default (not `unref`).
- [ ] 3.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean.
- [ ] 3.9 Line-count checkpoint (method above): at most 400. No further split is pre-approved: if over, STOP.

## Unit 4: Entrypoint, Boundary, Packaging (~291, stacked on 3)

- [ ] 4.1 RED M1-M5 in new `src/agente-proceso/arranque.test.ts` (`EventEmitter` as `proceso`): config error logs `configuracion-invalida` and exits 1 with no network; SIGTERM calls `detener` then exits 0; a second signal is ignored; a hung session exits 0 at 5 s (injected `programar`); each `MotivoFin` maps to its code; `uncaughtException` logs the class name only and exits 1.
- [ ] 4.2 GREEN `src/agente-proceso/log.ts` (PR 4 events), `src/agente-proceso/arranque.ts` (`CodigoSalida`, `CODIGO_SALIDA`, `ejecutarAgente`) and `src/agente-proceso/main.ts` (`ejecutarAgente({ env: process.env, proceso: process })`, no exports).
- [ ] 4.3 RED F1-F2 in new `src/agente-proceso/frontera.test.ts`: import scan allows only `node:*`, `ws`, `./<name>.js`, and `import type` from `../agente-protocolo.js`; spawned `tsc -p tsconfig.agente.json --listFilesOnly` lists only non-test agent files and `src/agente-protocolo.ts` under `src/`. Prove it fails on a temporary forbidden import (`pg`, `../canal-agente.js`), then remove it.
- [ ] 4.4 GREEN `tsconfig.agente.json` (extends base; `outDir: dist-agente`, `types: ["node"]`, include agent files, exclude tests); `package.json` `build:agente` script. Keep `tsconfig.json` unchanged.
- [ ] 4.5 BEFORE editing the test script, record the baseline test count from `npm test` (767 plus the new tests of units 1-4 present in the checkout) in this file.
- [ ] 4.6 GREEN `package.json`: quote the glob, `"test": "tsx --test \"src/**/*.test.ts\""`. Re-run `npm test` and compare the count to 4.5: it MUST NOT drop (flat and subdirectory tests both run). If it drops, STOP.
- [ ] 4.7 GREEN `Dockerfile`: add `build-agente` (`FROM build`, `RUN npm run build:agente`) and `agente` stage (`node:22-alpine`, `USER node`, copies only `package.json`, `node_modules/ws`, `dist-agente`, no `HEALTHCHECK`) before the engine stage, which stays unchanged and last.
- [ ] 4.8 GREEN `docker-compose.agente.yml` (`${VAR:?VAR is required}` for all three variables, hardening options), `.env.agente.example` (three empty values, comments per design), `.dockerignore` (`dist-agente`, `.env.agente`), `.gitignore` (`dist-agente/`, `.env.agente`).
- [ ] 4.9 Manual check A: `docker build --target agente .` succeeds; inspect: runs as `node`, no `HEALTHCHECK`, no `pg`, Prisma or engine sources in the image. Record the result here. Skip with a note only if Docker is unavailable.
- [ ] 4.10 Manual check B: default `docker build .` (no target) still produces the engine stage and the same image contents as before; `docker compose up` services unchanged (`docker-compose.yml` has no diff). Record the result.
- [ ] 4.11 Checkpoint: `npm test` green, `npm run build` and `npm run build:agente` clean, `.env.example` and `docker-compose.yml` unchanged.
- [ ] 4.12 Line-count checkpoint (method above): at most 400, else STOP.

## Unit 5: End-to-End Matrix (~330, stacked on 4)

- [ ] 5.1 RED fixtures in new `src/agente-proceso/proceso-e2e.test.ts`: Prisma, `registrarContextoTenant`, `registerConexionRoutes`, `registrarServidorAgentes`, generated token, `listen({ port: 0, host: '127.0.0.1' })`; TCP forwarder with `cortar()`; upgrade-path spy; per-test `iniciarAgente` with `aleatorio: () => 0`, log sink array, `detener()` in `finally`. Skips when PG is absent. The 19c1 `src/agente-e2e.test.ts` is not modified.
- [ ] 5.2 A1-A3: probe `ok` through the agent; unlisted target gives `host-inalcanzable`/`ECONNREFUSED`, zero accepts on a throwaway server, `destino-no-permitido` logged; after `cortar()` a second `control-conectado` arrives and the probe is `ok`.
- [ ] 5.3 A4-A7: unknown token gives `credenciales-rechazadas`; `registro.cerrarAgente` gives `agente-revocado`; a second raw control socket with the same token gives `reemplazado`; a listed closed port gives `ECONNREFUSED` and no `/agente/datos/` upgrade.
- [ ] 5.4 A8-A9: `pg.Client({ stream: registro.canalPara({...}) })` runs `SELECT $1::text` with 1.5 MiB and gets it back equal over many frames; no log line contains the token, forwarder URL, `host:port` or any recorded `sesionId`, and every line's keys belong to the closed set.
- [ ] 5.5 S1-S3 (spawned `process.execPath --import tsx src/agente-proceso/main.ts`, env only `PATH`, `SystemRoot`, `AGENT_*`): S1 userinfo URL with a sentinel gives exit 1 and neither sentinel nor token on stdout or stderr (no PG needed); S2 probe `ok` through the spawned agent, then `child.kill()`; S3 unknown token gives exit 2 and `fin credenciales-rechazadas`. No signal-based assertions (Windows).
- [ ] 5.6 RED then GREEN X1 in new `src/agente-proceso/tls.test.ts`: set `NODE_TLS_REJECT_UNAUTHORIZED=0` in-process and restore; wrap `tls.connect`; open `new WebSocket('wss://127.0.0.1:<closed>/...', opcionesSocket(...))`; the options carry `rejectUnauthorized: true`.
- [ ] 5.7 Record the Node source line: in the pinned Node 22 `lib/_tls_wrap.js`, `connect` merges `{ rejectUnauthorized: !allowUnauthorized, ..., ...options }`, so an explicit `rejectUnauthorized` beats `NODE_TLS_REJECT_UNAUTHORIZED=0`. Cite file, line and `node --version` in this file for the 19e runbook (the end-to-end TLS gap is accepted by DEC-123).
- [ ] 5.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; test count recorded, not below 4.6.
- [ ] 5.9 Line-count checkpoint (method above). If over 400, STOP and report. Pre-agreed fallback, on the orchestrator's go: move A8 and A9 (tasks 5.4) to a follow-up PR.

## Archive-time (orchestrator-owned)

- [ ] 6.1 At archive, hand-edit the Purpose line of `openspec/specs/agent-channel/spec.md` that says the agent process is out of scope for 19c2, so it points to the `agent-process` capability.
- [ ] 6.2 Known design-level choice for the user to confirm: the crash handler (`uncaughtException`, `unhandledRejection`) exits 1, the same code as the configuration error of DEC-123. A distinct code would need a DEC-123 amendment; the design adds none.

## Traceability

- Configuration, TLS, allowlist -> 1.1-1.5; parity, boundary -> 1.6, 4.3
- Session handling, error reporting, byte bridge, logging -> 2.1-2.7, 3.5, 5.4
- Backoff, terminal conditions, watchdog -> 3.2-3.7
- Shutdown, exit codes -> 4.1-4.2, 5.5
- Packaging, quoted glob -> 4.4-4.10
- Real agent, TLS option -> 5.1-5.7
