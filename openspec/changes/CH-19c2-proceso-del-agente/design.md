# Design: CH-19c2 — Agent Process

## Technical Approach

This change applies DEC-112, DEC-113, DEC-115, DEC-120, DEC-122 and DEC-123. It takes no new architecture decision. Every choice below is either fixed by DEC-123 or is one of the design-level items DEC-123 leaves to this design ("Fuera de esta decisión"). Nothing is wired into the engine in any PR.

- **PR 1:** constants, configuration, URL/TLS policy, literal allowlist, parity test.
- **PR 2:** JSON-lines logger, one-session bridge, session table (cap 16, allowlist dispatch).
- **PR 3:** backoff, control loop, 401/403/4001/4002 classification, ping watchdog, `iniciarAgente`.
- **PR 4:** signal handling, exit codes, `main.ts`, boundary test, build and packaging files.
- **PR 5:** end-to-end matrix A1-A9 with a real in-process agent, spawned-process checks S1-S3, TLS options spy.

## Architecture Decisions (design-level, under DEC-123)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Engine `tsconfig.json` | Keep `include: ["src"]`; it also compiles `src/agente-proceso/` | `exclude: ["src/agente-proceso"]` | `npm run build` is the repository's only type-check (`tsx --test` does not type-check). `tsconfig.agente.json` excludes tests, so with the exclude nobody would type-check the agent tests, and PR 5's e2e imports engine modules. The engine image gains inert `dist/agente-proceso/*.js`, which it never imports, as it already carries compiled tests. Runtime behavior, entrypoint and default Compose are unchanged |
| Agent compile | `tsconfig.agente.json` extends the base: `outDir: dist-agente`, `types: ["node"]`, `include: ["src/agente-proceso/**/*.ts"]`, `exclude: ["src/**/*.test.ts"]` | Separate package | DEC-123 A1. `import type` pulls `src/agente-protocolo.ts` into the program; it emits as an empty module that `main.js` never loads |
| Docker stages | `build` -> `build-agente` (`FROM build`, `RUN npm run build:agente`) -> `agente` -> engine (unnamed, last) | `build:agente` inside `build` | BuildKit skips `build-agente` when building the default target, so the engine build runs exactly the steps it runs today. The engine stays last, so `docker build .` and `build: .` still produce the engine |
| Ignore files | `.dockerignore` adds `dist-agente` and `.env.agente`. `.gitignore` adds `dist-agente/` and `.env.agente` | Rely on `dist` and `.env` | `.dockerignore` patterns match exactly, so `dist` does not match `dist-agente` (stale output would enter `COPY . .`). `.env` does not match `.env.agente`, which holds the token (rule 7) |
| Test glob | `"test": "tsx --test \"src/**/*.test.ts\""` | Unquoted | DEC-123 A1. `node --test` expands the glob itself on every shell. The apply step records the test count before and after; it must not drop |
| Control message from the engine | Accepted only as text JSON with the exact keys `host,puerto,sesionId,tipo` and `tipo: 'apertura-sesion'`. Binary closes with 1003. A message that is not text JSON, has another key set or an unknown `tipo` logs `mensaje-invalido` and closes with 1008, then the loop reconnects. A well-shaped message whose `sesionId` fails `^[A-Za-z0-9_-]{22}$` is IGNORED: it logs `mensaje-invalido` without the id, nothing is reported to the engine, and the connection stays open (no 1008), per the spec's "Malformed sesionId" scenario | Closing on a malformed `sesionId` | Mirrors the engine's control parser (`agente-servidor.ts`). The dispatcher stays a closed switch on `tipo` for 19d1. An untrusted id is never echoed back and cannot belong to a pending session. The values of `host` and `puerto` are not validated structurally: a value that is not in the allowlist gets `ECONNREFUSED` (DEC-123 A5) |
| Data-dial failure | Destroy the replica socket. No `sesion-fallida` is sent | Sending a code | No closed code describes it. The engine's 30 s pending TTL fails the session with `ESINAGENTE` |
| Session close on exit | `detener()` closes data sockets with 1001 (orderly; `arranque` bounds the wait to 5 s). Terminal outcomes (2, 3) terminate data sockets and destroy replicas immediately | Orderly close for every exit | `ws.close` can wait up to its 30 s close timeout on a silent peer |
| Timers | The default `programar` is a plain `setTimeout` (not `unref`) | `unref` as in the engine | The agent must stay alive while it waits to reconnect |
| Compose interpolation | `${VAR:?VAR is required}` for all three variables | `:?` on the token only | Compose fails before the container starts, names the variable and never repeats the value (DEC-123 A7). The agent's own check (exit 1) still covers runs outside Compose |
| Crash handler | `uncaughtException` and `unhandledRejection` log `error-interno` with the class name only, then exit 1 | Node's default printout | Node would print `error.message` and the stack to stderr, for example `connect ECONNREFUSED <host>:<port>` (rule 5). Exit 1 is Node's own default for a crash; no new code is added (see Open Questions) |

## Sequence

```
main/arranque         iniciarAgente (control loop)       sesiones/puente            engine
  | leerConfig(env) -- ErrorConfig -> log configuracion-invalida, exit 1
  |-- iniciarAgente ->| new WebSocket(<origin>/agente/control, opcionesSocket) -->|
  |                   |<-- unexpected-response 401|403 -> fin 'credenciales-rechazadas' (exit 2)
  |                   |<-- other status | error+close -> wait esperaReconexion(n), retry
  |                   |<-- 'open': arm watchdog 50 s (re-armed on 'ping'), stability 30 s (n = 0)
  |                   |<-- apertura-sesion {sesionId,host,puerto} (text, exact keys)
  |                   |-- sesiones.abrir -->| cap 16 / not in allowlist -> sesion-fallida ECONNREFUSED -->|
  |                   |                     | net.connect(list host, port), 10 s -> fail: sesion-fallida <code> -->|
  |                   |                     | replica up -> WS <origin>/agente/datos/<id>, 10 s handshake -->|
  |                   |                     |== binary frames <-> replica bytes, backpressure both ways ==|
  |                   |<-- close 4002 -> 'agente-revocado' (2) | 4001 -> 'reemplazado' (3) | other -> retry
  | SIGTERM/SIGINT -> detener(): no reconnect, control 1001, data 1001, replicas destroyed; 5 s cap; exit 0
```

## Interfaces / Contracts

```ts
// limites.ts (PR 1)
export const LIMITES_AGENTE = { tramaDatos: 1 << 20, tramaControl: 4096, sesiones: 16,
  esperaMinMs: 1_000, esperaMaxMs: 60_000, controlEstableMs: 30_000, vigilanciaPingMs: 50_000,
  replicaMs: 10_000, handshakeMs: 10_000, apagadoMs: 5_000 } as const;
export const FORMATO_TOKEN = /^zda_[A-Za-z0-9_-]{43}$/;
export const FORMATO_SESION = /^[A-Za-z0-9_-]{22}$/;

// config.ts (PR 1) — reads exactly three variables; nothing that disables TLS
export type VariableAgente = 'AGENT_SERVER_URL' | 'AGENT_TOKEN' | 'AGENT_ALLOWED_TARGETS';
export class ErrorConfig extends Error { readonly variable: VariableAgente; } // message: variable + fixed text, never the value
export interface ConfigAgente { readonly servidor: URL; readonly token: string; readonly destinos: ListaDestinos; }
export function leerConfig(env: Readonly<Record<string, string | undefined>>): ConfigAgente;

// politica-tls.ts (PR 1)
export function validarUrlServidor(texto: string): URL; // wss: always; ws: only localhost, 127.x.x.x, [::1];
  // rejects userinfo, any '#', other schemes, non-empty query, path other than '/'. Parsed before any WebSocket
export function opcionesSocket(token: string, maxPayload: number): ClientOptions;
  // { headers: { authorization: `Bearer ${token}` }, maxPayload, perMessageDeflate: false,
  //   rejectUnauthorized: true, followRedirects: false, handshakeTimeout: LIMITES_AGENTE.handshakeMs }

// destinos.ts (PR 1)
export interface Destino { readonly host: string; readonly puerto: number; } // normalized
export type ListaDestinos = ReadonlyMap<string, Destino>;                     // key `${host} ${puerto}`
export function normalizarHost(h: string): string;  // lowercase, strip [], strip one trailing '.'
export function leerDestinos(texto: string): ListaDestinos; // comma list; trims items; empty item, empty list,
  // wildcard, CIDR, range or missing port -> ErrorConfig('AGENT_ALLOWED_TARGETS'). Port ^[1-9]\d{0,4}$ <= 65535.
  // [v6] must pass net.isIPv6; a name whose labels are all digits must pass net.isIPv4; else a DNS-name regex
export function buscarDestino(l: ListaDestinos, host: unknown, puerto: unknown): Destino | null;

// log.ts (PR 2; the union grows per PR as marked)
export type EventoLog =
  | { evento: 'sesion-abierta' } | { evento: 'sesion-cerrada' }                        // PR 2
  | { evento: 'sesion-fallida'; codigo: CodigoErrorAgente }                            // PR 2
  | { evento: 'destino-no-permitido' } | { evento: 'tope-de-sesiones' }               // PR 2
  | { evento: 'control-conectado' } | { evento: 'sin-ping' } | { evento: 'mensaje-invalido' } // PR 3
  | { evento: 'control-rechazado'; estado: number }                                    // PR 3
  | { evento: 'control-cerrado'; codigoCierre: number }                                // PR 3
  | { evento: 'reconexion-programada'; intento: number; esperaMs: number }             // PR 3
  | { evento: 'configuracion-invalida'; variable: VariableAgente }                     // PR 4
  | { evento: 'apagado'; senal: 'SIGTERM' | 'SIGINT' }                                 // PR 4
  | { evento: 'fin'; motivo: MotivoFin; codigoSalida: CodigoSalida }                   // PR 4
  | { evento: 'error-interno'; nombreError: string };                                  // PR 4
export type Log = (e: EventoLog) => void;
export function crearLog(escribir?: (linea: string) => void, ahora?: () => Date): Log;
  // one line {"ts","nivel","evento",...}; a fixed per-event key list projects the object at runtime,
  // so a spread can never add a field; nivel comes from a fixed map; nombreError must match
  // ^[A-Za-z]{1,40}$, else 'Error'. Default sink: process.stdout.write

// puente.ts (PR 2)
export type Programar = (ms: number, fn: () => void) => () => void;
export function codigoDeError(e: unknown): CodigoErrorAgente; // one of the 7 codes, else 'EHOSTUNREACH'
export function abrirPuente(d: { destino: Destino; sesionId: string; abrirReplica: (d: Destino) => Socket;
  abrirDatos: (sesionId: string) => WebSocket; programar: Programar; log: Log;
  informar: (codigo: CodigoErrorAgente) => void }): { cerrar(modo: 'ordenado' | 'inmediato'): void; cerrada: Promise<void> };

// sesiones.ts (PR 2)
export interface Sesiones { abrir(a: { sesionId: string; host: unknown; puerto: unknown }): void; // never throws
  cantidad(): number; cerrarTodas(modo: 'ordenado' | 'inmediato'): Promise<void>; }
export function crearSesiones(d: { destinos: ListaDestinos; log: Log; programar: Programar;
  abrirReplica: (d: Destino) => Socket; abrirDatos: (id: string) => WebSocket;
  informar: (sesionId: string, codigo: CodigoErrorAgente) => void }): Sesiones;

// espera.ts (PR 3): tope = min(60 000, 1 000 * 2 ** (intento + 1)); espera in [tope/2, tope], so 1 s .. 60 s
export function esperaReconexion(intento: number, aleatorio: () => number): number;

// agente.ts (PR 3)
export type MotivoFin = 'detenido' | 'credenciales-rechazadas' | 'agente-revocado' | 'reemplazado';
export interface DependenciasAgente { config: ConfigAgente; log: Log; programar: Programar; aleatorio: () => number;
  abrirSocket?: (url: URL, op: ClientOptions) => WebSocket; // default new WebSocket(url, op)
  abrirReplica?: (d: Destino) => Socket; }                  // default net.connect({ host, port })
export function iniciarAgente(d: DependenciasAgente): { readonly terminado: Promise<MotivoFin>; detener(): void };

// arranque.ts (PR 4)
export type CodigoSalida = 0 | 1 | 2 | 3;
export const CODIGO_SALIDA: Readonly<Record<MotivoFin, CodigoSalida>>; // detenido 0, credenciales 2, revocado 2, reemplazado 3
export function ejecutarAgente(d: { env: Readonly<Record<string, string | undefined>>;
  proceso: { on(e: 'SIGTERM' | 'SIGINT' | 'uncaughtException' | 'unhandledRejection', fn: (x?: unknown) => void): unknown };
  escribir?: (l: string) => void; salir?: (c: CodigoSalida) => void; programar?: Programar;
  aleatorio?: () => number; iniciar?: typeof iniciarAgente }): void;
// main.ts (PR 4): `ejecutarAgente({ env: process.env, proceso: process })`, no exports
```

**Control loop rules.** The first dial is immediate. `'unexpected-response'` records `res.statusCode`, logs `control-rechazado`, and calls `ws.terminate()` (ws then emits `'error'` and `'close'`). 401 and 403 end with `credenciales-rechazadas`. Every other status retries. On `'close'`: 4002 ends with `agente-revocado`, 4001 ends with `reemplazado`, and any other code schedules `esperaReconexion(intento++)`. `'error'` is a no-op, because `'close'` always follows. The watchdog is armed on `'open'` and re-armed on every `'ping'`; when it fires, it logs `sin-ping` and terminates the socket. The 30 s stability timer resets `intento` to 0, and a close cancels it. `informar` sends `sesion-fallida` only while the control socket is `OPEN`; otherwise the message is dropped (best effort, no queue). Sessions do not depend on the control socket. `detener()` is idempotent, and the first motive wins.

**Bridge rules.** The replica is dialed first, with a 10 s timer that ends in `ETIMEDOUT`. A replica error goes through `codigoDeError`, then `informar` and the `sesion-fallida` log. Once the replica is up, the bridge dials the data socket. Engine to replica: `replica.write(b) === false` calls `ws.pause()`, and `'drain'` calls `ws.resume()`. Replica to engine: on `'data'` the bridge calls `replica.pause()`, sends slices of at most 1 MiB with `{ binary: true }`, and the last slice's callback resumes the replica. A text frame closes with 1003 and destroys the replica. Either side closing closes the other. Both sockets get a no-op `'error'` listener. `net.connect` uses the allowlist entry's normalized host, never the engine's string. The bridge never reads the bytes (rule 1). `sesiones.abrir` checks the cap (16) before the allowlist, and both refusals reply `ECONNREFUSED`.

**Engine-code boundary (PR 4, `frontera.test.ts`).** (1) Every non-test `.ts` in `src/agente-proceso/` is scanned for `from '…'`, `import('…')` and `require(`. Each specifier must be `node:*`, `ws`, `./<name>.js`, or `../agente-protocolo.js`, and that last one only on a line that starts with `import type`. (2) The test spawns `node node_modules/typescript/bin/tsc -p tsconfig.agente.json --listFilesOnly`. Every listed file under `src/` must be a non-test file in `src/agente-proceso/` or `src/agente-protocolo.ts`. This catches transitive imports. (3) The image copies only `dist-agente` and `node_modules/ws`, so a stray `pg` or Prisma import fails at start.

## Packaging (PR 4)

```dockerfile
# after the existing `build` stage (unchanged)
FROM build AS build-agente
RUN npm run build:agente

# CH-19c2 (DEC-120, DEC-123): docker build --target agente .  No Prisma, pg, Fastify or engine code.
FROM node:22-alpine AS agente
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build-agente /app/package.json ./
COPY --from=build-agente /app/node_modules/ws ./node_modules/ws
COPY --from=build-agente /app/dist-agente ./dist-agente
USER node
CMD ["node", "dist-agente/agente-proceso/main.js"]

# existing engine stage follows, unchanged and last
```

`package.json` is copied for `"type": "module"`. `ws` has no required runtime dependencies. There is no `HEALTHCHECK` (DEC-123).

```yaml
# docker-compose.agente.yml — CH-19c2 (DEC-120, DEC-123 A7). Runs on the customer's host,
# never with docker-compose.yml: this machine needs no engine secret, and the default
# `docker compose up` is unchanged.
#   cp .env.agente.example .env.agente   # fill in; never commit it
#   docker compose -f docker-compose.agente.yml --env-file .env.agente up -d --build
# Deployment note (DEC-122 Q7): never expose the engine's app port to untrusted networks;
# terminate TLS in a reverse proxy whose idle timeout exceeds the engine's 20 s ping.
# Exit 2 (credentials) and 3 (replaced) need the operator; Docker restarts with growing delays.
services:
  agente:
    build:
      context: .
      target: agente
    environment:
      AGENT_SERVER_URL: ${AGENT_SERVER_URL:?AGENT_SERVER_URL is required}
      AGENT_TOKEN: ${AGENT_TOKEN:?AGENT_TOKEN is required}
      AGENT_ALLOWED_TARGETS: ${AGENT_ALLOWED_TARGETS:?AGENT_ALLOWED_TARGETS is required}
    restart: unless-stopped
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    init: true
```

`.env.agente.example` has the three variables, all with empty values. Its comments give the URL rule, the token's origin (`POST /agentes`, shown once, a secret), and the allowlist format with examples.

## File Changes and Estimates (tests x1.7, limit 400)

| PR | File | Est. ± |
|---|---|---|
| 1 | `src/agente-proceso/limites.ts` 22, `config.ts` 35, `politica-tls.ts` 40, `destinos.ts` 55 | 152 |
| 1 | `config.test.ts` (with policy cases, 50 x1.7) 85, `destinos.test.ts` (45) 77, `paridad.test.ts` (18) 31 | 193 |
| | **PR 1** | **~345** |
| 2 | `log.ts` 45, `puente.ts` 85, `sesiones.ts` 45 | 175 |
| 2 | `log.test.ts` (25) 43, `puente.test.ts` (65) 111, `sesiones.test.ts` (30) 51 | 205 |
| | **PR 2** | **~380 (at risk)** |
| 3 | `espera.ts` 15, `agente.ts` 150 | 165 |
| 3 | `espera.test.ts` (12) 20, `agente.test.ts` (100) 170 | 190 |
| | **PR 3** | **~355** |
| 4 | `arranque.ts` 55, `main.ts` 5, `tsconfig.agente.json` 10, `Dockerfile` +16, `docker-compose.agente.yml` 25, `.env.agente.example` 20, `package.json` 3, `.gitignore` 2, `.dockerignore` 2 | 138 |
| 4 | `arranque.test.ts` (50) 85, `frontera.test.ts` (40) 68 | 153 |
| | **PR 4** | **~291** |
| 5 | `src/agente-proceso/proceso-e2e.test.ts` (fixtures 40, forwarder 15, A1-A9 95, S1-S3 30: 180 x1.7) | 306 |
| 5 | `src/agente-proceso/tls.test.ts` (14 x1.7) | 24 |
| | **PR 5** | **~330** |

**Fallbacks (agreed).** If PR 2 is over 400 when measured, move `sesiones.ts` and its test (about 96) to a sixth PR, "2b", between PR 2 and PR 3. PR 3 cannot absorb them. If PR 5 is over, move A8 and A9 to a follow-up PR. The 19c1 `src/agente-e2e.test.ts` is not modified.

## Testing Strategy (`node:test`; live PostgreSQL skipped when absent, as in 19c1)

| Id | PR | Case |
|---|---|---|
| C1-C6 | 1 | Missing or empty variable gives `ErrorConfig` naming it. Bad token format. URL policy: `wss:` any host; `ws:` on `localhost`, `127.0.0.5`, `[::1]` only; refuses `ws://10.0.0.1`, `http:`, userinfo, `#`, `?a`, a path. No error message contains the input (assert with a sentinel value). `opcionesSocket` returns exactly the six options |
| L1-L5 | 1 | Allowlist: valid DNS name, IPv4, `[::1]:5432`. Refuses `*`, CIDR, a range, a missing port, port 0 or 65536, an empty item, `127.1:5432`, `0x7f.0.0.1:1`. Match: case, brackets and trailing dot normalize. `127.1` does not match `127.0.0.1`. Port as a string does not match |
| P1 | 1 | Parity: `tramaDatos === LIMITE_TRAMA_DATOS`; `tramaControl === LIMITES.tramaControl`; `sesiones > LIMITES.sesionesPorAgente`; `vigilanciaPingMs > 2 * LIMITES.pingMs`. 50 `generarTokenAgente()` values match `FORMATO_TOKEN`. A `sesionId` from `crearRegistroAgentes()`, captured with a fake control socket, matches `FORMATO_SESION` |
| G1-G3 | 2 | One JSON line per event. A spread extra key is dropped. `nombreError` is sanitized |
| B1-B8 | 2 | Local `net` replica plus local `WebSocketServer`. Relay both ways. Pause observed in both directions with a slow consumer, and the payload is intact. A text frame gives 1003 and destroys the replica. Each side's close reaches the other. A replica timeout gives `ETIMEDOUT` (injected `programar`). `EADDRNOTAVAIL` maps to `EHOSTUNREACH`. A data-dial failure destroys the replica and sends no `sesion-fallida` |
| T1-T3 | 2 | A 17th session gives `ECONNREFUSED` and `tope-de-sesiones`. An unlisted target makes zero `abrirReplica` calls. `cerrarTodas` resolves |
| K1-K10 | 3 | Fake engine `WebSocketServer({ port: 0, verifyClient })`. 401 and 403 are terminal, with zero redials. 404, 500 and a refused port retry. Close 4002 and 4001 are terminal, 1006 and 1000 retry. Backoff sequence with `aleatorio` at 0 and at 1. Stability reset after 30 s. Watchdog: no ping gives `sin-ping` and a redial. Bad, binary and unknown messages close with 1008 or 1003. `abrirSocket` spy: control gets `maxPayload` 4096 and data gets 1 MiB, with the TLS options. `detener` closes with 1001 and never redials |
| M1-M5 | 4 | `EventEmitter` as `proceso`. Config error: `configuracion-invalida` and exit 1. SIGTERM: `detener`, then exit 0. A second signal is ignored. A hung session exits 0 at 5 s (injected `programar`). Each `MotivoFin` maps to its code. `uncaughtException` logs the class name only and exits 1 |
| F1-F2 | 4 | Boundary scan and the `--listFilesOnly` check |
| A1-A9 | 5 | See below |
| S1-S3 | 5 | Spawned `process.execPath --import tsx src/agente-proceso/main.ts`, with an env of only `PATH`, `SystemRoot` and the `AGENT_*` values. S1 (no PG needed): userinfo URL with a sentinel password gives exit 1, and neither the sentinel nor the token appears on stdout or stderr. S2: a probe through the spawned agent is `ok`, then `child.kill()`. S3: an unknown token gives exit 2 and `fin credenciales-rechazadas` |
| X1 | 5 | `NODE_TLS_REJECT_UNAUTHORIZED=0` is set in-process and restored after. `tls.connect` on the CommonJS export is wrapped, and `new WebSocket('wss://127.0.0.1:<closed>/…', opcionesSocket(...))` is opened. The options ws hands to `tls.connect` carry `rejectUnauthorized: true` |

**E2E fixtures (PR 5).** Same setup as 19c1: Prisma, `registrarContextoTenant`, `registerConexionRoutes`, `registrarServidorAgentes`, a generated token and `listen({ port: 0, host: '127.0.0.1' })`. A **TCP forwarder** is `net.createServer` piping each client to the engine port; `cortar()` destroys every live pair. The agent dials `ws://127.0.0.1:<forwarder>`. Each test starts its own `iniciarAgente` with `aleatorio: () => 0`, a log sink array and real timers, and calls `detener()` in `finally`. An `app.server.prependListener('upgrade')` spy records the paths. A1: the probe is `ok` through the agent. A2: a throwaway `net` server outside the list sees zero accepts; the result is `host-inalcanzable`/`ECONNREFUSED` and `destino-no-permitido` is logged. A3: after `cortar()`, a second `control-conectado` arrives and the probe is `ok`. A4: an unknown token gives `credenciales-rechazadas`. A5: `registro.cerrarAgente` gives `agente-revocado`. A6: a raw second control socket with the same token gives `reemplazado`. A7: a listed port that is closed gives `ECONNREFUSED` and no `/agente/datos/` upgrade. A8: `pg.Client({ stream: registro.canalPara({…}) })` runs `SELECT $1::text` with 1.5 MiB, which the engine splits; the result comes back equal over many frames. A9: no log line (in-process or S1/S3) contains the token, the forwarder URL, `host:port`, or any recorded `sesionId`, and every line's keys belong to the closed set.

**TLS gap.** A real handshake needs a server certificate. Node 22 cannot issue an X.509 certificate, `openssl` is not guaranteed on Windows, and a hand-written DER encoder would be test code that needs its own review. So, as DEC-123 accepts, there is no end-to-end TLS test. X1 proves that the explicit option reaches `tls.connect`. That the explicit option beats the environment default is Node's merge in `lib/_tls_wrap.js` (`connect`: `{ rejectUnauthorized: !allowUnauthorized, …, ...options }`). The apply step records that line for the pinned Node 22, and the 19e runbook carries the gap.

**Windows constraints.** `child.kill()` is `TerminateProcess`, so no signal handler runs. Graceful shutdown is therefore tested in-process only (M2-M4, K10), and the spawned checks never depend on a signal. A connection refused on loopback takes about 2 s on Windows; that is inside the 5 s probe budget (A7). Spawned children need `SystemRoot`. npm runs scripts in `cmd.exe`, which neither expands nor keeps quotes, so the quoted glob behaves the same there. `docker build --target agente .` is a manual apply check.

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths, git repository selection, commit state, push state, PR commands | N/A: no shell, VCS or PR automation and no executable-file classification. Process integration (signals, exit codes, environment, spawned children) is covered by M1-M5 and S1-S3. The network boundaries (TLS policy, allowlist, engine refusals) are covered by C, L, K and A2/A4-A7 |

## Migration / Rollout

No migration. `.env.example` and `docker-compose.yml` are unchanged; the new variables live only in `.env.agente.example`. To roll back, revert PRs 5 to 1. Nothing is wired into the engine.

## Open Questions

- [ ] (orchestrator, non-blocking) A crash exits 1, Node's own default, which is also the configuration code in DEC-123. A distinct code would need a DEC-123 amendment. The design adds none.
- [ ] (delivery) Apply PR 2b if PR 2 measures over 400.
