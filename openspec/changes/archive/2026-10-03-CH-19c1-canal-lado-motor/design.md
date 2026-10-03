# Design: CH-19c1 — Engine Side of the Agent Channel

## Technical Approach

This change applies DEC-112..DEC-117, DEC-121 and DEC-122. It takes no new architecture decision. Every choice below is one of the design-level items DEC-122 leaves to this design ("Fuera de esta decisión").

- **PR 1:** adds `ws`, adds `sesion-fallida` to the catalog, and adds `CanalAgente`, a duplex that honors the 19a Fake Duplex Contract.
- **PR 2:** an in-memory registry of control sockets and sessions.
- **PR 3:** a `noServer` `'upgrade'` listener with header-only auth, refusals before 101, ping, shutdown close, and the revoke/baja push close.
- **PR 4:** `destinoDeConexion` returns a channel for agent-bound rows. The registry is threaded to the five callers and to `crearPlanificador`.

## Architecture Decisions (design-level, under DEC-122)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| No-control-channel code | `CODIGO_SIN_AGENTE = 'ESINAGENTE'`. Destroy uses `Object.assign(new Error('sin-agente'), { code })` | `ECONNREFUSED`; `ENOAGENT`-style names that look like Node codes | Verified against `classifyConnectionError` (`db-probe.ts:187`): the name matches `NODE_CODE_PATTERN` (`pg-error.ts:16`), so `codigo` is published. It is outside `ETIMEDOUT`, `CODIGOS_HOST_INALCANZABLE`, `CODIGOS_DNS` and the SQLSTATE sets, so the result is `error-desconocido`. `esFalloReintentable` (`automatizaciones.ts:280`) retries only host/dns/timeout, so the run is not retried |
| Code coverage | `ESINAGENTE` covers: no control socket, a failed `apertura-sesion` send, more than 8 sessions, the pending TTL, `registro.cerrando`, and a registry `tenantId` that differs from the active tenant | One code per cause | DEC-122 Q5 names one internal code. The tenant mismatch is "no control channel for this tenant" |
| Agent codes | `sesion-fallida.codigo` is copied only when it is one of the 7 `CodigoErrorAgente` values. Any other value destroys with no `code` (`error-desconocido`, `codigo: null`) | Echoing the agent's string | Otherwise an agent could choose the published `codigoError` |
| Host and port | Bound when the factory is created (`canalPara`). `connect(port, host)` ignores its arguments | Reading pg's arguments | Required by the 19a contract row. The values come from the stored `Conexion` row (DEC-115) |
| Frame limits | Two `WebSocketServer({ noServer: true, perMessageDeflate: false, clientTracking: false })` instances, with `maxPayload` 4 KiB (control) and 1 MiB (data). `_write` splits writes larger than 1 MiB | One server | `maxPayload` is set per server |
| Shutdown hook | `app.addHook('preClose', …)` terminates every socket and sets `cerrando` | Terminating in `onClose` | **Verified in the source.** `addHook('onClose')` becomes avvio `onClose` (`fastify.js:602`). avvio `unshift`s close callbacks, so they run LIFO (`avvio/index.js:311`). Fastify registers `server.close()` at `preReady` (`fastify.js:384-430`), so it runs *before* every `onClose` in `server.ts`. Upgraded sockets keep `server.close()` pending, so terminating in `onClose` deadlocks. `preClose` runs inside that same close step and fulfills DEC-122's intent ("orderly close on shutdown"). The scheduler's `onClose` is unchanged and runs after it. Apply re-verifies this with RED test U9 |
| Refusal | `socket.once('finish', socket.destroy); socket.end('HTTP/1.1 <code> <reason>\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')`. No body | JSON error codes | Mirrors ws's `abortHandshake`. No new public codes are needed |
| Logging | `{ canal, estado }` on a refusal. `{ canal, agenteId, codigoCierre }` after auth. A lookup throw logs `nombreError` | — | Never logged: the token, hash, `tenantId`, `sesionId`, host, port, the header, or frame content (rule 5) |

## Sequence

```
agent                         upgrade listener      registro                CanalAgente         pg / caller
  |-- GET /agente/control (Bearer) -->|                                                         
  |                     socket.on('error',noop); hash; buscarPorTokenHash
  |<-- 401|403 (pre-101) -------------|  or handleUpgrade -> registrarControl (old: close 4001)
  |                                                     caller: destinoDeConexion(p,id,registro)
  |                                                     -> canal = registro.canalPara({agenteId,tenantId,host,puerto})
  |                                                                          <-- new (inert) -- new pg.Client
  |                                                                          <-- connect() ---- client.connect()
  |                                                     <-- pedirSesion (setImmediate)
  |                                     checks fail -> canal.destroy(ESINAGENTE)  -- 'error' --> error-desconocido
  |<-- apertura-sesion {sesionId,host,puerto} --- send cb(err) -> ESINAGENTE; TTL 30 s
  |-- GET /agente/datos/<sesionId> (same token) -->| 404 if foreign/unknown/taken
  |                                     handleUpgrade -> adjuntarDatos -> canal.adjuntar(ws) -- 'connect' -->
  |== binary frames <-> push()/pause()/resume(); _write -> send(cb) ==================================>
  |-- sesion-fallida {sesionId,codigo} -> canal.destroy({code}) before 'connect'
```

## Interfaces / Contracts

```ts
// src/agente-protocolo.ts (MODIFIED; types only)
export interface SesionFallida { tipo: 'sesion-fallida'; sesionId: string; codigo: CodigoErrorAgente; }
export type MensajeControl = AperturaSesion | Latido | SesionFallida;

// src/canal-agente.ts (PR 1)
export const CODIGO_SIN_AGENTE = 'ESINAGENTE';
export const LIMITE_TRAMA_DATOS = 1 << 20;
export function errorSinAgente(): Error;
export interface SolicitudSesion { agenteId: string; tenantId: string; host: string; puerto: number; }
export interface PuertoDeSesion {
  pedirSesion(canal: CanalAgente): void;  // never throws; failure = canal.destroy(...)
  soltarSesion(canal: CanalAgente): void; // idempotent, called from _destroy
}
export interface AbridorDeCanales { canalPara(s: SolicitudSesion): AbrirCanal; }
export const SIN_AGENTES: AbridorDeCanales; // every connect() -> async destroy(errorSinAgente())
export class CanalAgente extends Duplex implements CanalDuplex {
  constructor(readonly solicitud: SolicitudSesion, puerto: PuertoDeSesion); // stores fields only
  setNoDelay(): this;
  connect(): this;               // state 'pidiendo'; setImmediate(() => !destroyed && puerto.pedirSesion(this))
  adjuntar(socket: WebSocket): void; // binary 'message' -> push, false -> socket.pause(); text -> destroy;
                                 // 'close' -> destroy(); 'error' noop; then emit('connect')
  _read(): void;                 // socket.isPaused && socket.resume()
  _write(c, e, cb): void;        // detached: cb(). attached: send(≤1 MiB slices, {binary:true}), cb on last send cb
  _final(cb): void;              // push(null); socket?.close(1000); cb()
  _destroy(err, cb): void;       // puerto.soltarSesion(this); socket?.close(1000); cb(err)
}

// src/registro-agentes.ts (PR 2)
export const LIMITES = { tramaControl: 4096, sesionesPorAgente: 8, pendienteMs: 30_000, pingMs: 20_000 } as const;
export const CIERRE_REEMPLAZO = 4001, CIERRE_REVOCADO = 4002;
export interface RegistroAgentes extends AbridorDeCanales, PuertoDeSesion {
  registrarControl(agente: { id: string; tenantId: string }, socket: WebSocket): void;
  reservarDatos(agenteId: string, sesionId: string): boolean;               // pending, own, not taken
  adjuntarDatos(agenteId: string, sesionId: string, socket: WebSocket): boolean;
  sesionFallida(agenteId: string, sesionId: string, codigo: unknown): void; // pending only; else ignored
  cerrarAgente(agenteId: string): void;  // control + data sockets 4002, pending -> ESINAGENTE
  cerrarTenant(tenantId: string): void;
  cerrarTodo(): void;                    // cerrando = true; terminate all; pending -> ESINAGENTE
}
export function crearRegistroAgentes(op?: { programar?: (ms: number, fn: () => void) => () => void;
  generarId?: () => string }): RegistroAgentes; // default randomBytes(16).toString('base64url')

// src/agente-servidor.ts (PR 3)
export function registrarServidorAgentes(d: { app: FastifyInstance; prisma: PrismaAislado; registro: RegistroAgentes }): void;
// src/conexion-destino.ts (PR 4)
export function destinoDeConexion(prisma: PrismaAislado, id: string, canales: AbridorDeCanales = SIN_AGENTES): Promise<…>;
```

**Registry rules.** A control close removes the entry only while `entry.socket === socket`, so a replaced socket never removes its successor. Sessions are bound to `agenteId` and survive a control replacement. `pedirSesion` fails with `ESINAGENTE` in any of these cases: `cerrando` is set, the control socket is missing, `control.tenantId !== solicitud.tenantId`, or the agent already has 8 sessions (pending or attached). Otherwise it stores the session, arms the TTL and sends `apertura-sesion`. The send callback error and the TTL both fail with `ESINAGENTE`.

**Upgrade listener.** It attaches `socket.on('error', noop)` synchronously, before any `await`. Then it checks, in order:
1. The method is `GET` and the path is `/agente/control` or `/agente/datos/:sesionId`. Otherwise 404.
2. `authorization` matches `^Bearer (zda_[A-Za-z0-9_-]{43})$`. Otherwise 401, with no lookup.
3. `buscarPorTokenHash`. `null` gives 401, `!tenantActivo` gives 403, and a throw gives 500.
4. After the await: if `socket.destroyed` or `cerrando`, destroy and stop.
5. Data path only: `reservarDatos`. `false` gives 404, and an id that does not match `^[A-Za-z0-9_-]{22}$` gives the same 404.
6. `handleUpgrade`, then attach a `ws.on('error')` listener.

On control sockets: a binary frame closes the socket with 1003 (wrong data type, per the spec and DEC-122); invalid JSON or a key set other than the exact `latido` or `sesion-fallida` keys closes it with 1008; a message over 4 KiB closes with 1009 (the `ws` `maxPayload` limit closes before any engine code runs, found at apply of unit 3a). `latido` is a no-op (19d1).

## File Changes and Estimates (tests ×1.7, limit 400)

| PR | File | Est. ± |
|---|---|---|
| 1 | `package.json`: exact-pinned `ws` and `@types/ws`. `package-lock.json` is generated and excluded from the count | 2 |
| 1 | `src/agente-protocolo.ts` | 16 |
| 1 | `src/canal-agente.ts` (Create) | 115 |
| 1 | `src/agente-protocolo.test.ts` (8 ×1.7) | 14 |
| 1 | `src/canal-agente.test.ts` (Create, 105 ×1.7) | 179 |
| | **PR 1** | **~326** |
| 2 | `src/registro-agentes.ts` (Create) | 125 |
| 2 | `src/registro-agentes.test.ts` (Create, 60 ×1.7) | 102 |
| | **PR 2** | **~227** |
| 3 | `src/agente-servidor.ts` (Create: upgrade, auth, parse, preClose, ping) | 150 |
| 3 | `src/server.ts` (registry, listener); `agentes-rutas.ts` and `tenants.ts` (optional `agentes: Pick<RegistroAgentes,'cerrarAgente'\|'cerrarTenant'>`, no-op default, called after a successful write) | 20 |
| 3 | `src/agente-servidor.test.ts` (130 ×1.7) and the `agentes-rutas`/`tenants` tests (25 ×1.7) | 264 |
| | **PR 3** | **~434 (over)** |
| 4 | `src/conexion-destino.ts` (select `agenteId`, `canal` from `canales.canalPara({…, tenantId: exigirTenantActivo().id})`) | 16 |
| 4 | `conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts` (via `ejecutarPrueba`), `validacion-mapeo-rutas.ts`: optional `canales = SIN_AGENTES` param; `planificador.ts`: `canales?` in `DependenciasPlanificador`; `server.ts` passes `registro` | 27 |
| 4 | `src/conexion-destino.test.ts` (22 ×1.7) and `src/agente-e2e.test.ts` (Create, 80 ×1.7) | 173 |
| | **PR 4** | **~216** |

**Recommended mitigation for PR 3.** Split it into **3a** (upgrade, auth, refusals, attach, parse, `preClose`; ~317) and **3b** (20 s ping, plus revoke/baja close with 4002; ~110). Each slice stands alone. Until 3b lands, a revoked token is still refused at every upgrade, and no agent exists before 19c2. Moving from four PRs to five is a delivery decision for the orchestrator.

## Testing Strategy (`node:test`, real ephemeral port `listen({port:0, host:'127.0.0.1'})`, live PG skipped when absent)

The fake agent is a `ws` client. When it receives `apertura-sesion`, it opens `/agente/datos/<id>` with the same token, opens a `net.connect` to the message's `host`/`puerto` (the test PostgreSQL), and relays in both directions. Tests use generated tokens only (rule 7).

| Id | PR | Case |
|---|---|---|
| A1-A2 | 1 | `new pg.Client({stream})` calls the factory, and `pedirSesion` is not called. `connect()` neither throws nor calls `pedirSesion` synchronously. `'connect'` is emitted only after `adjuntar` |
| A3 | 1 | `SIN_AGENTES` with `probeConnection` and `ejecutarConsulta`: `error-desconocido`, `ESINAGENTE`, `fase: 'conexion'`, within the budget. `esFalloReintentable` is false |
| A4-A6 | 1 | Destroy with `ECONNREFUSED` gives `host-inalcanzable`. A silent port gives `tiempo-agotado`, and C5 close returns. Over a real ws pair: `SELECT 1`, `PGSSLMODE=require` gives `ssl === false`, Q1 rows |
| A7 | 1 | Backpressure: `SELECT repeat('x',1000000) FROM generate_series(1,8)` with a slow consumer. `pause` is observed, the result is complete, and the `_write` callback fires only after the `send` callback (spy) |
| A8-A10 | 1 | The far side closes: `'close'` is reached and the process survives (D1). `end()` while connecting reaches `'close'`. A text frame destroys the channel |
| R1-R6 | 2 | Replacement closes the old socket with 4001, and the old socket's close leaves the new entry. A 9th session gives `ESINAGENTE`. The TTL gives `ESINAGENTE` (injected `programar`). A failed send gives `ESINAGENTE`. `sesionFallida` maps the 7 codes and drops unknown ones. **Tenant mismatch** (agent registered for A, request names B): `ESINAGENTE`, and A's control socket receives nothing |
| U1-U8 | 3 | 401: header missing, malformed, unknown or revoked, and a token in the query is ignored. 403: deactivated tenant. 404: unknown path, foreign session, unknown session, taken session. Tenant B's token on A's `sesionId` gives 404. A socket reset during a slow lookup does not crash. Bad JSON or keys close with 1008. A non-upgrade `GET /agente/control` gives 400 `tenant-no-indicado`. Logs never contain the token or `sesionId` |
| U9 | 3 | `app.close()` with live control and data sockets resolves under 2500 ms, and the scheduler's `detener` still runs (RED if termination sits in `onClose`) |
| U10-U12 | 3(b) | No pong: terminated after the ping. Revoke and baja close control and data sockets with 4002 |
| H1 | 4 | `agenteId` null gives `canal` undefined. Set with no registry: the factory is inert and the connection fails with `ESINAGENTE` |
| E1-E5 | 4 | The agent-bound probe succeeds through the fake agent, using the row's host and port. No control socket with the row pointing at the *reachable* test PG gives `ESINAGENTE` (proves no direct dial). The scheduler with `intentos: 3` gives `intentos: 1`. **Two tenants:** B's row forced to A's `agenteId` by admin SQL gives `ESINAGENTE`, with zero `apertura-sesion` at A. `sesion-fallida ECONNREFUSED` gives `host-inalcanzable` |

All existing suites run unchanged, because the defaults are fail-closed and optional.

## Apply-time verification tasks

- Pin the latest `ws` 8.x and the matching `@types/ws` exactly (check with `npm view`, consistent with `cron-parser`/`nodemailer` pins). Confirm that `WebSocket.prototype.pause`, `resume` and `isPaused` exist in `node_modules/ws/lib/websocket.js`. If they are absent, STOP.
- Re-verify the avvio LIFO order and the `preClose` placement with U9 before writing PR 3 code.

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths, git selection, commit/push state, PR commands | N/A: no shell, subprocess, VCS/PR automation or file classification. The HTTP/tenant boundary is covered by U1-U8, R6 and E4 |

## Migration / Rollout

No migration and no env vars; `.env.example` is unchanged. To roll back, revert PR 4 first, then the others in reverse order. Reverting PR 4 restores direct dial for agent-bound rows; no agent exists before 19c2.

## Open Questions

- [ ] (orchestrator, non-blocking) DEC-122's design-level text says "cierre … en `onClose`", and this design uses `preClose` (see the rationale above). You may want to add a one-line clarification to DEC-122.
- [ ] (delivery) Split PR 3 into 3a/3b?
