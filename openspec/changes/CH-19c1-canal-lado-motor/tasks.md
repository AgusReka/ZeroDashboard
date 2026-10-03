# Tasks: CH-19c1 — Engine Side of the Agent Channel

From `design.md` and `specs/**`. No task edits `docs/01-decisiones.md`. Strict TDD: RED then GREEN, one session per task. Test: `npm test`; types: `npx tsc --noEmit`. Live-PG tests skip when PG is absent. Test ids (A1.., R1.., U1.., H1, E1..) are the design's. Verify, archive, DEC-122 clarification and all commits belong to the orchestrator; apply never commits.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~870 total: 1 ~326, 2 ~227, 3a ~317, 3b ~110, 4 ~216 |
| 400-line budget risk | Medium (per PR: unit 1 and 3a High, others Low) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3a -> PR 3b -> PR 4, each stacked on the previous |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

No `size:exception` (user decision 2026-10-03). Hard limit: 400 changed lines per PR. Past slices overshot estimates by 30-50%.

**Line-count checkpoint (end of each unit):** run `git diff --stat` PLUS `git status --porcelain`, and count lines of each `??` file (for example `(Get-Content <file>).Count`). Exclude `package-lock.json` and the untracked `docs/design/` and `docs/verificacion-tesis-2026-10-01.md`. **Stop rule:** if additions plus deletions exceed 400, STOP and report to the orchestrator; do not trim tests or start the next unit.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `ws` pin, catalog, `CanalAgente` | PR 1 (base: main) | `npm test -- src/canal-agente.test.ts src/agente-protocolo.test.ts` | Real ws pair plus live PG (A4-A7) | Revert PR; no schema change |
| 2 | In-memory registry | PR 2 (base: PR 1 branch) | `npm test -- src/registro-agentes.test.ts` | Injected `programar` timer, fake sockets | Revert PR; nothing wired |
| 3a | Upgrade listener, auth, `preClose` | PR 3a (base: PR 2 branch) | `npm test -- src/agente-servidor.test.ts` | Real ephemeral port, `ws` client | Revert PR; listener unregistered |
| 3b | Ping, 4002 close on revoke/baja | PR 3b (base: PR 3a branch) | `npm test -- src/agente-servidor.test.ts src/agentes-rutas.test.ts src/tenants.test.ts` | Real port, live PG | Revert PR; routes keep no-op default |
| 4 | `destinoDeConexion`, five callers, e2e | PR 4 (base: PR 3b branch) | `npm test -- src/conexion-destino.test.ts src/agente-e2e.test.ts` | Fake agent over real port to test PG | Revert PR first; restores direct dial |

## Unit 1: `ws`, Catalog, `CanalAgente` (~326)

- [ ] 1.1 FIRST. `npm view ws version` and `npm view @types/ws version`; pin latest 8.x and the matching types exactly in `package.json` (no `^`). Confirm `pause`, `resume`, `isPaused` exist in `node_modules/ws/lib/websocket.js` (read-only). If absent, STOP.
- [ ] 1.2 RED `src/agente-protocolo.test.ts`: `SesionFallida` rejects a code outside the 7 (`@ts-expect-error`); no runtime exports. GREEN `src/agente-protocolo.ts`: add `SesionFallida`, `MensajeControl` union, close codes 4001/4002 as types.
- [ ] 1.3 RED A1, A2 in new `src/canal-agente.test.ts`: `new pg.Client({stream})` calls the factory and never `pedirSesion`; `connect()` does not throw or call it synchronously; `'connect'` only after `adjuntar`.
- [ ] 1.4 GREEN `src/canal-agente.ts`: `CODIGO_SIN_AGENTE`, `errorSinAgente`, `SolicitudSesion`, `PuertoDeSesion`, `AbridorDeCanales`, `CanalAgente` (constructor, `setNoDelay`, `connect`, `adjuntar`), per design.
- [ ] 1.5 RED then GREEN A3: `SIN_AGENTES` with `probeConnection` and `ejecutarConsulta` gives `error-desconocido`, `ESINAGENTE`, `fase: 'conexion'`, and `esFalloReintentable` false.
- [ ] 1.6 RED then GREEN A4-A6: destroy `ECONNREFUSED` gives `host-inalcanzable`; silent port gives `tiempo-agotado` and close returns; over a real ws pair `SELECT 1`, `PGSSLMODE=require` gives `ssl === false`, Q1 rows.
- [ ] 1.7 RED then GREEN A7: `SELECT repeat('x',1000000) FROM generate_series(1,8)` with a slow consumer; `pause` seen, result complete, `_write` callback only after the `send` callback. GREEN `_read`, `_write` (1 MiB slices), `LIMITE_TRAMA_DATOS`.
- [ ] 1.8 RED then GREEN A8-A10: far-side close reaches `'close'` and the process survives; `end()` while connecting reaches `'close'`; a text frame destroys the channel. GREEN `_final`, `_destroy`.
- [ ] 1.9 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; no `.env` change.
- [ ] 1.10 Line-count checkpoint (method above): at most 400. **Fallback if over 400:** STOP; the pre-agreed cut is moving A8-A10 and `_final` coverage to unit 2 as a separate test file, subject to orchestrator approval.

## Unit 2: In-Memory Registry (~227, stacked on 1)

- [ ] 2.1 RED R1 in new `src/registro-agentes.test.ts` (fake sockets, injected `programar` and `generarId`): replacing a control socket closes the old with 4001; the old socket's later close leaves the new entry.
- [ ] 2.2 RED R2-R4: a 9th session gives `ESINAGENTE`; the 30 s TTL gives `ESINAGENTE` and removes the session; a failed `send` gives `ESINAGENTE`.
- [ ] 2.3 RED R5, R6: `sesionFallida` copies only the 7 closed codes and drops unknown (no `code`); tenant mismatch (agent registered for A, request names B) gives `ESINAGENTE` and A's socket receives nothing.
- [ ] 2.4 GREEN `src/registro-agentes.ts`: `LIMITES`, `CIERRE_REEMPLAZO`, `CIERRE_REVOCADO`, `crearRegistroAgentes`, the full `RegistroAgentes` interface and registry rules (`registrarControl`, `canalPara`, `pedirSesion`, `soltarSesion`, `reservarDatos`, `adjuntarDatos`, `sesionFallida`, `cerrarAgente`, `cerrarTenant`, `cerrarTodo`, `cerrando`). Session id: `randomBytes(16).toString('base64url')`.
- [ ] 2.5 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; no log of token, `tenantId`, `sesionId`, host or port.
- [ ] 2.6 Line-count checkpoint (method above): at most 400.

## Unit 3a: Upgrade Listener (~317, stacked on 2)

- [ ] 3.1 RED U9 FIRST in new `src/agente-servidor.test.ts`: `app.close()` with live control and data sockets resolves under 2500 ms and the scheduler's `detener` still runs. Record it failing before any listener code exists.
- [ ] 3.2 RED U1-U8: 401 (header missing, malformed, unknown, revoked; token in query ignored); 403 deactivated tenant; 404 (unknown path, foreign, unknown, taken session; B's token on A's `sesionId`); socket reset during a slow lookup does not crash; text-JSON/key violations close with 1008; binary on control closes with 1003 (spec); non-upgrade `GET /agente/control` gives 400 `tenant-no-indicado`; logs never contain token or `sesionId`.
- [ ] 3.3 GREEN `src/agente-servidor.ts` `registrarServidorAgentes`: sync `socket.on('error', noop)`, ordered checks 1-6 of the design, refusal via `socket.end` with no body, two `WebSocketServer` instances (`maxPayload` 4 KiB / 1 MiB, `perMessageDeflate: false`), control message parsing, `ws.on('error')`.
- [ ] 3.4 GREEN `app.addHook('preClose', ...)` calling `registro.cerrarTodo()`. MUST NOT use `onClose`. Mutation check: temporarily move it to `onClose` and confirm U9 fails (hang or over 2500 ms), then restore.
- [ ] 3.5 GREEN wire `crearRegistroAgentes` and `registrarServidorAgentes` in `src/server.ts`; `contexto-tenant.ts` exemption list stays unchanged.
- [ ] 3.6 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; existing suites unchanged.
- [ ] 3.7 Line-count checkpoint (method above): at most 400. If over, STOP (no further split is pre-approved).

## Unit 3b: Ping and 4002 Close (~110, stacked on 3a)

- [ ] 4.1 RED U10: with injected `programar`, a control socket with no pong is terminated after the 20 s ping. GREEN ping in `src/agente-servidor.ts`.
- [ ] 4.2 RED U11, U12 in `src/agentes-rutas.test.ts` and `src/tenants.test.ts`: revoke and baja close control and data sockets with 4002; revoking with no live sockets leaves the response unchanged.
- [ ] 4.3 GREEN `src/agentes-rutas.ts` and `src/tenants.ts`: optional `agentes: Pick<RegistroAgentes,'cerrarAgente'|'cerrarTenant'>` with a no-op default, called after a successful write. `src/server.ts` passes `registro`.
- [ ] 4.4 Checkpoint: `npm test` green, `npx tsc --noEmit` clean.
- [ ] 4.5 Line-count checkpoint (method above): at most 400.

## Unit 4: `destinoDeConexion` and Callers (~216, stacked on 3b)

- [ ] 5.1 RED H1 in `src/conexion-destino.test.ts`: `agenteId` null gives `canal` undefined; set with no registry gives an inert factory and `ESINAGENTE`.
- [ ] 5.2 GREEN `src/conexion-destino.ts`: select `agenteId`; `canal` from `canales.canalPara({ agenteId, tenantId: exigirTenantActivo().id, host, puerto })`; third parameter `canales: AbridorDeCanales = SIN_AGENTES`.
- [ ] 5.3 GREEN thread the optional `canales = SIN_AGENTES` through `src/conexiones.ts`, `src/consultas.ts`, `src/plantilla-prueba.ts` (via `ejecutarPrueba`), `src/validacion-mapeo-rutas.ts`; `src/planificador.ts` gains `canales?` in `DependenciasPlanificador`; `src/server.ts` passes `registro`.
- [ ] 5.4 RED then GREEN E1-E5 in new `src/agente-e2e.test.ts`: probe succeeds via the fake agent using the row's host/port; no control socket with a reachable PG row gives `ESINAGENTE` (no direct dial); scheduler `intentos: 3` gives `intentos: 1`; two tenants (B's row forced to A's `agenteId`) gives `ESINAGENTE` with zero `apertura-sesion` at A; `sesion-fallida ECONNREFUSED` gives `host-inalcanzable`.
- [ ] 5.5 Checkpoint: full `npm test` green (all existing suites unchanged), `npx tsc --noEmit` clean; no `.env` or `.env.example` diff.
- [ ] 5.6 Line-count checkpoint (method above): at most 400.

## Archive-time (orchestrator-owned)

- [ ] 6.1 At archive, hand-edit the Purpose lines of the main specs `openspec/specs/agent-channel/spec.md` and `openspec/specs/agent-registration/spec.md` to match the delta Purpose text; do not rely on automatic merge.

## Traceability

- Catalog, `sesion-fallida` -> 1.2, R5; channel contract -> 1.3-1.8; fail-closed default -> 1.5, 5.1
- Registry, limits, replacement -> 2.1-2.4; tenant at use -> 2.3, 5.4
- Upgrade auth, framing, shutdown -> 3.1-3.5; ping -> 4.1; revoke/baja -> 4.2-4.3
- Channel in callers, no direct dial -> 5.1-5.4
