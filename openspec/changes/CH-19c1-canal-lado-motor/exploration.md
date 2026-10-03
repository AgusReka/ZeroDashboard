# Exploration: CH-19c1 engine side of the outbound agent channel

Date: 2026-10-03. Decisions registered: DEC-122 in `docs/01-decisiones.md` (user chose the recommended options). DEC-116 amended by it.

## Current state

- `src/agente-protocolo.ts`: types only, zero imports: `TipoCanal`, `AperturaSesion{sesionId,host,puerto}`, `Latido`, `MensajeControl`, `CodigoErrorAgente` (7 Node codes). No message reports a replica error yet.
- `src/db-probe.ts:36-53,120-155`: `DestinoPostgres.canal?: AbrirCanal` (`() => CanalDuplex`); with a channel `iniciarConexion` builds `new pg.Client({...config, stream: canal, ssl: false})` plus the DEC-111 no-op `'error'` listener.
- pg calls the stream factory inside the `new pg.Client(...)` constructor, not at `connect()` (`node_modules/pg/lib/client.js:91`, `connection.js:19-21`): a real channel must allocate nothing and never throw there; failures must be asynchronous.
- `src/conexion-destino.ts:25-76`: `destinoDeConexion(prisma, id)` does not select `agenteId` and never sets `canal`; `camposDeDestino` passes `canal` through. Callers: `conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts`, `validacion-mapeo-rutas.ts`, `planificador.ts`.
- `src/aislamiento-prisma.ts:133-160`: `agente.buscarPorTokenHash(hash)` returns exactly `{id, tenantId, tenantActivo}` for non-revoked agents, on the raw client; spec and test L2 pin those keys.
- `src/agentes-rutas.ts`, `src/tenants.ts:113`: revoke/baja only write the row; nothing notifies live sockets.
- `src/contexto-tenant.ts:84,116-145`: closed exemption list, Fastify `onRequest` hooks only.
- `src/server.ts`: `Fastify({logger:true})`, no WebSocket code; `ws` is not installed.
- `src/db-probe-canal.test.ts:47-119`: `CanalFalso` fake duplex (private to the test); the 19a Fake Duplex Contract table binds the real channel too.
- Deployment: no reverse proxy in the repo; the app port is published on all interfaces.

## Decisions (DEC-122)

| Q | Decision |
|---|---|
| Q1 | Raw `ws` with `noServer` and a own `'upgrade'` listener |
| Q2 | No `conTenantActivo` in the upgrade path; amends DEC-116 |
| Q3 | Authorization header only; 401 same for missing/unknown/revoked, 403 deactivated tenant; data channel re-authenticates; foreign or unknown session is the same 404 |
| Q4 | Agent reports a replica failure with a control message `sesion-fallida` carrying one of the 7 closed codes |
| Q5 | No control channel: asynchronous destroy with an internal engine code (name set in design), `error-desconocido`, not retried; never direct dial, wait or queue |
| Q6 | Revoke and baja close the agent's sockets (4002) through the registry |
| Q7 | No proxy configured or documented here; TLS enforced on the agent side |

Design-level: session ids `randomBytes(16)` base64url bound to the agent; in-memory registry with replacement of the control socket (old closed 4001); limits as constants (data frames 1 MiB, control 4 KiB, 8 sessions per agent, pending TTL 30 s, `perMessageDeflate` off); ping every 20 s, no data idle timeout; no new env vars; registry reaches `destinoDeConexion` as an optional parameter defaulting to a fail-closed "no agents" opener; at-use check that the registry entry's `tenantId` equals the active tenant (no composite FK, DEC-121); orderly socket close in `onClose`.

## Scope

- In 19c1: `ws` and `@types/ws`, `CanalAgente` duplex (19a contract, lazy session allocation in `connect()`, real backpressure), registry, control and data upgrade server, authentication, limits, ping, `onClose`, `sesion-fallida` in the catalog, `destinoDeConexion` returning a channel and the five callers, push close on revoke and baja, tests and spec deltas.
- Out: agent process, reconnect, allowlist, Docker (19c2); persisted state, heartbeat semantics, TCP probe (19d1); `agente-desconectado` category and DEC-97 amendment (19d2); runbook and direct-mode re-evaluation (19e); proxy/TLS configuration; operator authentication.

## Size and split

About 1,000 changed lines, so four chained PRs: 1) `ws`, types, `CanalAgente`, contract tests (~305); 2) registry (~190); 3) upgrade server, auth, ping, close, revoke/baja push (~370); 4) `destinoDeConexion` switch, callers, end-to-end test (~150-210). Estimates use tests x1.7; previous slices overshot by 30-50%, so checkpoints at 400 are mandatory.

## Anti-scope risks

- Rule 1: no route accepts SQL; the agent only sends `latido` and `sesion-fallida`, the engine only `apertura-sesion`; `host` and `puerto` come from stored `Conexion` rows. Any other message closes the socket.
- Rule 2: tenant only from the token row; session ids unguessable and bound to an agent; mandatory at-use `registro.tenantId === exigirTenantActivo().id` check with a two-tenant test.
- Rule 5: never log or buffer frame contents; `perMessageDeflate` off; backpressure; log closed fields only (never token, hash, `tenantId`, host, puerto, or the `Authorization` header).
- Rule 6: no queue, grace wait or store-and-forward when the agent is offline; scheduler untouched; no new failure category.
- Rule 7: tests use generated tokens only; `.env.example` unchanged.
- Technical: the factory must not throw (breaks the probe contract); a missing `socket.on('error')` during the async upgrade can end the process; `app.close()` hangs unless sockets are terminated; dial-back latency must fit the 5 s connect budget; `app.inject` cannot upgrade, so tests need a real ephemeral port; hook/shutdown ordering must be tested; an unauthenticated upgrade flood costs one hash and one query each (documented residual limit).
