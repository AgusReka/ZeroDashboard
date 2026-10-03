# Agent Process Specification

## Purpose

The customer-side agent process (DEC-112, DEC-113, DEC-115, DEC-120, DEC-122, DEC-123): a byte relay that dials the engine outbound over WebSocket, receives session-open messages on a control channel, opens TCP to a literally allowlisted replica, and bridges bytes over a per-session data channel. It carries no tenant identifier, no database credentials and no SQL capability. It lives in `src/agente-proceso/`, shares only types with the engine, and is packaged as its own Docker image.

## Requirements

### Requirement: Configuration

The agent SHALL read exactly three variables: `AGENT_SERVER_URL` (origin only: scheme, host, optional port, optional path `/`), `AGENT_TOKEN` and `AGENT_ALLOWED_TARGETS`. All limits and timings MUST be constants. The agent MUST NOT call `loadConfig`. A configuration error MUST name the variable and MUST NOT print any value. On a configuration error the process MUST exit with code 1 before any network activity.

#### Scenario: Valid configuration

- GIVEN the three variables hold valid values
- WHEN the configuration is parsed
- THEN a configuration object is returned and no engine variable is required

#### Scenario: Missing or invalid variable

- GIVEN `AGENT_TOKEN` is absent or `AGENT_SERVER_URL` carries a path other than `/`
- WHEN the process starts
- THEN stderr names only the variable, contains no value, and the exit code is 1

#### Scenario: Value never echoed

- GIVEN `AGENT_SERVER_URL` holds an invalid URL containing a recognizable secret string
- WHEN parsing fails
- THEN no output contains that string

### Requirement: TLS and URL Policy

The agent MUST accept `wss:` always and `ws:` only when the host is `localhost`, a `127.x.x.x` address or `[::1]`. It MUST reject userinfo, a fragment, any other scheme and a non-empty query. It MUST pass `rejectUnauthorized: true` explicitly, MUST NOT read any variable that disables verification, and MUST NOT follow redirects. The URL MUST be validated before `new WebSocket` is called.

#### Scenario: Accepted forms

- GIVEN `wss://motor.example` and `ws://127.0.0.1:3000` and `ws://[::1]:3000`
- WHEN validated
- THEN all three are accepted

#### Scenario: Rejected forms

- GIVEN `ws://motor.example`, `https://x`, `wss://u:p@x`, `wss://x#f`, `wss://x?a=1`
- WHEN validated
- THEN each is rejected and no WebSocket is constructed

#### Scenario: Verification not disableable

- GIVEN `NODE_TLS_REJECT_UNAUTHORIZED=0` in the environment
- WHEN the client options are built
- THEN `rejectUnauthorized` is `true` and redirects are not followed

### Requirement: Literal Allowlist

`AGENT_ALLOWED_TARGETS` MUST be a comma-separated list of exact `host:port` entries: DNS name, IPv4 or bracketed IPv6; port required, 1 to 65535. Wildcards, CIDR and ranges MUST NOT be accepted. An empty or absent value MUST stop the boot (exit 1). Matching MUST be exact on host and port normalized (lowercase, no brackets, no trailing dot). `net.connect` MUST use the matched string. Forms such as `127.1` or octal MUST NOT match unless listed.

#### Scenario: Normalized match

- GIVEN the list `DB.Example.com.:5432`
- WHEN a session opens with host `db.example.com` and port 5432
- THEN the target matches and `net.connect` receives the matched string

#### Scenario: Unlisted target

- GIVEN the list `10.0.0.5:5432`
- WHEN a session asks for `10.0.0.5:5433` or `10.0.0.0/24` or `127.1`
- THEN no TCP connection is attempted

#### Scenario: Empty list

- GIVEN `AGENT_ALLOWED_TARGETS` is empty or absent
- WHEN the process starts
- THEN it exits with code 1 naming only the variable

### Requirement: Session Handling

The agent MUST validate `sesionId` against `^[A-Za-z0-9_-]{22}$` before it enters any URL. It MUST connect to the replica FIRST, with a 10 s timeout (`ETIMEDOUT`), and only then dial the data channel with a 10 s handshake timeout. A data-dial failure MUST destroy the replica socket. A replayed `sesionId` that is already active MUST be ignored. The agent MUST hold at most 16 concurrent sessions; sessions MUST survive a control socket drop. `sesion-fallida` is best effort: no queue and no retry.

#### Scenario: Replica first

- GIVEN a valid open message for an allowlisted target
- WHEN the replica connect has not yet succeeded
- THEN no data channel is dialed
- WHEN it succeeds
- THEN the data channel is dialed with the Bearer header

#### Scenario: Malformed sesionId

- GIVEN a `sesionId` of 21 chars or containing `/` or `..`
- WHEN the open message arrives
- THEN no URL is built, no connection is made, nothing is reported to the engine (the id cannot belong to a pending session, and an untrusted id is never echoed back), and the local event `mensaje-invalido` is recorded without the id

#### Scenario: Data dial fails

- GIVEN the replica connected
- WHEN the data handshake fails or exceeds 10 s
- THEN the replica socket is destroyed

#### Scenario: Replay and cap

- GIVEN a session already active
- WHEN the same `sesionId` arrives again
- THEN it is ignored and no second replica connection opens
- GIVEN 16 active sessions
- WHEN a seventeenth arrives
- THEN it is refused without dialing

### Requirement: Error Reporting

On allowlist refusal, on reaching the 16-session cap, and on malformed `host` or `puerto`, the agent MUST send `sesion-fallida` with `ECONNREFUSED` and record a local event `destino-no-permitido` carrying neither host nor port. A network error outside the seven closed codes (for example `EADDRNOTAVAIL`, `EMFILE`, `EPERM`, `EAI_FAIL`) MUST be reported as `EHOSTUNREACH`. No new code MAY be added to the catalog.

#### Scenario: Refusal indistinguishable

- GIVEN an unlisted target
- WHEN the session opens
- THEN `sesion-fallida` carries `ECONNREFUSED` and the local log has `destino-no-permitido` with no host or port

#### Scenario: Unmapped network error

- GIVEN the replica connect fails with `EMFILE`
- WHEN the failure is reported
- THEN the code is `EHOSTUNREACH`

### Requirement: Byte Bridge

The bridge MUST carry binary frames only, MUST apply backpressure in both directions, and MUST NOT inspect, parse or log bytes. A text frame on a data socket MUST close it with 1003. The data client MUST set `maxPayload` to exactly 1 MiB and `perMessageDeflate` to off; the control client `maxPayload` MUST be 4096. The bridge MUST NOT use `createWebSocketStream`.

#### Scenario: Large result

- GIVEN a replica that returns 1 MB
- WHEN the bytes cross the bridge
- THEN they arrive intact, in frames of at most 1 MiB

#### Scenario: Text frame

- GIVEN an established data socket
- WHEN a text frame arrives
- THEN the data socket closes with 1003 and the replica socket is destroyed

#### Scenario: Backpressure

- GIVEN a slow consumer on one side
- WHEN the producer side keeps sending
- THEN the producer is paused until the consumer drains

#### Scenario: Client options

- GIVEN the data and control clients are built
- WHEN the options are inspected
- THEN data `maxPayload` is 1048576, control is 4096, and `perMessageDeflate` is false

### Requirement: Reconnect Backoff

After a control socket loss the agent MUST reconnect with exponential delay: minimum 1 s, factor 2, maximum 60 s, equal jitter. Random source and timer MUST be injectable. The attempt counter MUST reset only after a control socket stays open at least 30 s.

#### Scenario: Growth and cap

- GIVEN consecutive failures with random fixed at 1
- WHEN delays are computed
- THEN they are 1, 2, 4, ... capped at 60 s, and with equal jitter each lies within [d/2, d]

#### Scenario: Reset

- GIVEN a control socket open for 30 s then dropped
- WHEN the next delay is computed
- THEN it is the minimum
- GIVEN a socket dropped after 5 s
- THEN the counter is not reset

### Requirement: Terminal Conditions

A 401 or 403 on upgrade, or a control close 4002, MUST terminate with exit code 2. A close 4001 on the current control socket MUST terminate with exit code 3. Every other condition (network error, 404, 5xx, 1006, engine restart) MUST retry with backoff.

#### Scenario: Credentials rejected

- GIVEN the engine answers 401, or 403, or closes control with 4002
- WHEN the agent observes it
- THEN it stops reconnecting and the exit code is 2

#### Scenario: Replaced

- GIVEN the current control socket closes with 4001
- WHEN observed
- THEN the exit code is 3 and there is no retry

#### Scenario: Transient

- GIVEN a 503, a 404 or a 1006 close
- WHEN observed
- THEN the agent retries with backoff

### Requirement: Ping Watchdog

The agent MUST terminate a control or data socket that receives no engine ping for 50 s. It MUST NOT send `latido` in this change.

#### Scenario: Silent engine

- GIVEN a socket with no ping for 50 s
- WHEN the watchdog fires
- THEN the socket is terminated and the reconnect path runs

#### Scenario: Ping resets the timer

- GIVEN a ping at 40 s
- WHEN 50 s total elapse since the start
- THEN the socket is still open

### Requirement: Graceful Shutdown

On SIGTERM or SIGINT the agent MUST stop reconnecting, close control with 1001, close data sockets, destroy replica sockets, wait at most 5 s, and exit 0. A second signal MUST be ignored.

#### Scenario: Orderly stop

- GIVEN active sessions
- WHEN SIGTERM arrives
- THEN control closes with 1001, data and replicas close, and the exit code is 0 within 5 s

#### Scenario: Second signal

- GIVEN shutdown in progress
- WHEN SIGINT arrives
- THEN nothing changes and no second shutdown starts

### Requirement: Logging

The agent MUST log JSON lines with a closed event union and closed fields. A log line MUST NOT contain the token, the URL, any host, any port, any `sesionId`, frame bytes or any `error.message`.

#### Scenario: Secrets absent from stdout

- GIVEN a full run with failures, refusals and a probe
- WHEN stdout and stderr are collected
- THEN none contains the token, URL, host, port, `sesionId` or payload bytes

#### Scenario: Closed events

- GIVEN any emitted line
- WHEN parsed
- THEN its `evento` belongs to the declared union and its keys to the declared fields

### Requirement: Engine-Code Boundary

Code under `src/agente-proceso/` MAY import only `node:*`, `ws`, same-directory files, and `import type` from `agente-protocolo.ts`. It MUST NOT import `pg`, `@prisma/*`, `fastify`, `config`, `canal-agente`, `agente-token`, or any other engine file. The 1 MiB and 4 KiB limits and the token pattern MUST be duplicated in the agent, with a parity test against the engine values. `agente-protocolo.ts` SHALL keep exporting types only.

#### Scenario: Boundary test

- GIVEN every file under `src/agente-proceso/`
- WHEN imports are scanned
- THEN only the allowed forms appear

#### Scenario: Forbidden import

- GIVEN a file importing `pg` or `../canal-agente`
- WHEN the boundary test runs
- THEN it fails

#### Scenario: Parity

- GIVEN the agent's duplicated limits and token pattern
- WHEN compared with the engine's values
- THEN they are equal

### Requirement: Packaging

The build MUST use a second `tsconfig.agente.json` emitting to `dist-agente`, and a `build:agente` script. The Dockerfile MUST add a stage `agente` before the engine's final stage, based on `node:22-alpine`, `USER node`, containing only `dist-agente` and `node_modules/ws`, with no `HEALTHCHECK`. `docker-compose.agente.yml` MUST require the token via `${AGENT_TOKEN:?AGENT_TOKEN is required}`; `.env.agente.example` MUST hold empty values. The default `docker compose up` and the engine default build target MUST remain unchanged. The test script glob MUST be quoted (`"src/**/*.test.ts"`) and the test count MUST NOT drop.

#### Scenario: Engine unaffected

- GIVEN the new Dockerfile
- WHEN built with no `--target`
- THEN the engine image is produced and `docker compose up` starts the same services as before

#### Scenario: Agent image

- GIVEN `docker build --target agente`
- WHEN inspected
- THEN it runs as `node`, has no `HEALTHCHECK`, and lacks engine sources, `pg` and Prisma

#### Scenario: No secrets in files

- GIVEN `.env.agente.example` and the Compose file
- WHEN read
- THEN values are empty and `AGENT_TOKEN` unset makes Compose fail with the message

#### Scenario: Quoted glob

- GIVEN a test file under `src/agente-proceso/`
- WHEN the test script runs under POSIX `sh`
- THEN flat tests and subdirectory tests both run
