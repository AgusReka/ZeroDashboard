# Design: CH-19a — Connection Channel Seam and Protocol Types (C1, slice 1)

## Technical Approach

The change has three units. None of them adds a route, a dependency, a category, or an env var (DEC-112..DEC-120).

- **Unit 1:** `src/agente-protocolo.ts` is a types-only module with zero imports. The agent shares it (DEC-120).
- **Unit 2:** `DestinoPostgres` gets an optional `canal`. `iniciarConexion` adds one branch to the existing `new pg.Client`. Callers pass `canal` through one helper.
- **Unit 3:** A spike suite runs an in-memory fake duplex that relays to the live test PostgreSQL. It proves the specs `agent-channel` and `query-execution` (delta).

## Decisions (design-level, under DEC-112..DEC-117)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| `canal` shape | `canal?: AbrirCanal`, where `AbrirCanal = () => CanalDuplex`. Each call opens a fresh duplex | A `Duplex` instance | `conectarConReintentos` (`planificador.ts:283-301`) dials the same `peticion` again. A pg client cannot be reused. DEC-113 requires one data channel per session |
| Seam typing | `CanalDuplex extends Duplex` and adds `setNoDelay` and `connect`. It is assignable to pg's `stream?: () => Duplex` | Bare `Duplex` | pg calls both methods unconditionally (`connection.js:44-45`). The compiler catches a 19c1 channel that lacks them |
| Branch | Absent: the same literal passed to `new pg.Client(config)`, so it is byte-identical. Present: `{ ...config, stream: destino.canal, ssl: false }` | Wrapping the factory | Passing the factory directly means nothing can log or buffer the bytes (rule 5). Without the explicit `ssl: false`, `PGSSLMODE` would turn SSL negotiation on over the channel (`connection-parameters.js:85`), and DEC-113 keeps the channel without SSL |
| Threading | `camposDeDestino(destino)` in `conexion-destino.ts` returns `{host, port, database, user, password, canal: destino.canal}`. Four callers spread it in place of their five-field copy | One `canal:` line per caller | One pure function is the unit under test for "same instance". It never branches on `canal`, so callers do not inspect it. `validacion-mapeo-rutas.ts:100` already passes `destino` whole and stays unchanged. `PeticionEjecucion extends DestinoPostgres` (`consulta-ejecucion.ts:75`), so that file inherits the field and is not edited |
| Agent codes | `CodigoErrorAgente` holds exactly the seven Node codes `classifyConnectionError` already classifies (`db-probe.ts:53-59,167`): `ECONNREFUSED`, `EHOSTUNREACH`, `ENETUNREACH`, `ECONNRESET`, `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT` | Agent-specific names. A catch-all code. An allowlist-refusal code | DEC-117 fixes only "the replica-side errors the engine no longer sees". Identical values let 19c1 destroy the channel with `{ code }` and keep today's categories. DEC-115 decides the allowlist refusal, not DEC-117, so its code is left out of this slice |
| Catalog | `TipoCanal = 'control' \| 'datos'`, `AperturaSesion {tipo, sesionId, host, puerto}`, `Latido {tipo}`, `MensajeControl = AperturaSesion \| Latido` | Database, user or tenant in the session-open message | Login travels inside the relayed startup bytes (DEC-112). There is no tenant (DEC-114). `host`/`puerto` are the target as the agent sees it (DEC-115). The data channel is raw bytes and has no message type |
| Dropped-channel test | In-process | A child process (CH-18 pattern) | The DEC-111 listener already exists, so GREEN is expected. A regression still fails the run loudly |

## Seam and Threading Flow

```
caller            conexion-destino      consulta-ejecucion     db-probe              pg / canal
  |-- destinoDeConexion -->|  (never sets canal)
  |-- camposDeDestino ---->|  canal: undefined | same ref
  |-- ejecutarConsulta({...campos, sentencia, ...}) -->|
  |                        |  enSesionSoloLectura -->| iniciarConexion
  |                        |                         |   no canal -> new Client(config)        (TCP dial)
  |                        |                         |   canal    -> new Client({...config, stream, ssl:false})
  |                        |                         |-- connect(): canal() -> setNoDelay -> connect -> once('connect')
  |                        |                         |   race vs PRESUPUESTO_AGOTADO (unchanged)
```

## Fake Duplex Contract (pg 8.23; also binding on the 19c1 channel)

| pg call | Requirement |
|---|---|
| `stream(config)` (`connection.js:20`) | Return a fresh duplex on each call |
| `setNoDelay(true)` (`:44`) | Exist as a no-op |
| `connect(port, host)` (`:45`) | Start the relay and ignore the arguments |
| `once('connect')` (`:47`), registered *after* `connect()` | Emit asynchronously. A silent channel never emits |
| `on('error')` (`:61`); backstop `destroy(Error)` (`client.js:170`) | `destroy(err)` emits `'error'` and then `'close'` |
| `on('close')` → `'end'` (`:63`) | Always reach `'close'`: when the far side closes, call `destroy()` (no half-open) |
| `end()` while connecting (`:213-219`) | The write callback fires without the far side. `_final` calls `push(null)` so that `autoDestroy` emits `'close'` |
| `setKeepAlive`, `ref`, `unref` | Not called (`keepAlive` is unset). Not implemented |

## Close Behavior Within Budget

- **Budget lost:** callers pass `esperar=false` (`db-probe.ts:237`, `consulta-ejecucion.ts:409`). `end()` is not awaited. The unref'd backstop destroys a channel that ignores `end()` at budget + 500 ms.
- **Settled or driver error:** `esperar=true`. Termination ends the duplex, `_final` closes it, and pg's `'end'` resolves `client.end()`. A destroyed channel has already set `_ended`.
- **Connecting, awaited (stricter than production):** C5 asserts that it resolves under the ceiling.

## File Changes

| File | Action | Est. ± lines |
|---|---|---|
| `src/agente-protocolo.ts` | Create | 40 |
| `src/db-probe.ts` | `CanalDuplex`, `AbrirCanal`, `canal?` and the branch (`:28-34`, `:105-112`) | 35 |
| `src/conexion-destino.ts` | `camposDeDestino` | 14 |
| `src/conexiones.ts:226`, `consultas.ts:116`, `plantilla-prueba.ts:103`, `planificador.ts:256` | Spread the helper and update the import | 32 |
| `src/agente-protocolo.test.ts` | Create | 25 |
| `src/conexion-destino.test.ts` | Helper unit test (no PG). `destinoDeConexion` returns `canal === undefined` | 12 |
| `src/db-probe-canal.test.ts` | Create: the fake, a `ch19a_pruebas` fixture with `ch19a_lector`/`ch19a_escritor`, and the spike | 200 |
| **Total** | | **~358 / 400** |

## Testing Strategy (`node:test`, live PG skipped when absent, `npx tsc --noEmit`)

| Id | Case | PG |
|---|---|---|
| P1 | `Object.keys(import)` is `[]`. A type-level check: `AperturaSesion` has no `tenant*` key | No |
| P2 | Each `CodigoErrorAgente` value (an exhaustive `satisfies` array) gets a category other than `error-desconocido` from `classifyConnectionError` | No |
| H1 | `camposDeDestino` keeps the same `canal` reference and drops `id`. Without a channel, `canal` is `undefined` | No |
| C1 | Without `canal`, `cliente.connection.stream` is a `net.Socket` and the factory is never called | No |
| C2 | With `canal`: the stream is the fake instance, the factory is called once, `cliente.ssl === false` while `PGSSLMODE=require` (restored afterwards), and `SELECT 1` succeeds | Yes |
| C3 | Silent fake with `probeConnection` and `ejecutarConsulta` (`connectTimeoutMs: 400`): `tiempo-agotado`, `codigo: null`, under 2500 ms | No |
| C4 | A fake destroyed before `'connect'` with `{code:'ECONNREFUSED'}` gives `host-inalcanzable` | No |
| C5 | Silent fake, then `await cerrarCliente(cliente, true)` raced against 2500 ms: it resolves | No |
| D1 | Idle after login, the channel is destroyed: the process keeps running, the next query rejects, and the close returns | Yes |
| D2 | The channel is destroyed 300 ms into `SELECT pg_sleep(2)`: `fallo`, `fase: 'ejecucion'`, `codigo: null`, and no password in the result | Yes |
| Q1-Q4 | Over the fake: `ch19a_lector` gets 2 of 3 rows (`hayMas`). `ch19a_escritor` gets `rol-con-escritura-en-tabla`. A DELETE CTE gives `no-es-lectura`, and the admin count stays unchanged. `SELECT 1; SELECT 2` gives `error-sintaxis` | Yes |
| All | The existing suites run unchanged (direct mode) | — |

Any refutation of C2/Q1 (the stream seam) STOPS the work. DEC-112 then goes back to the user.

## Threat Matrix

N/A: there is no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The spike runs in-process and uses loopback only.

## Migration / Rollout

No migration. One PR, a link in the CH-19 chain. Rollback means reverting it. No production path sets `canal`.

## Open Questions

- [ ] (19c1/19c2 spec, non-blocking) How the agent reports a replica error outside the seven codes, and whether an allowlist refusal (DEC-115) needs a code. If either one needs a new failure category, register a DEC first.
