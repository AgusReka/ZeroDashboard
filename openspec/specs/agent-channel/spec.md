# Agent Channel Specification

## Purpose

Type catalog for the agent protocol, the optional channel seam, and the engine side of the outbound agent channel: in-memory session registry, authenticated WebSocket upgrade for control and data channels, and the channel through which a database session is carried instead of a direct TCP dial (DEC-112, DEC-113, DEC-122). The agent process is out of scope (19c2).

## Requirements

### Requirement: Protocol Type Catalog Is Limited to Fixed Decisions

`src/agente-protocolo.ts` SHALL export types only, with no runtime behavior, for exactly: the control channel versus the per-session data channel (DEC-113), the session-open message (DEC-113, DEC-114), the closed set of replica-side error codes the agent reports (DEC-117), the heartbeat message (DEC-118), the `sesion-fallida` control message carrying one of the closed error codes (DEC-122), and the numeric close codes 4001 (control socket replaced) and 4002 (agent revoked or tenant deactivated) (DEC-122). The catalog MUST NOT define tokens, registry, states, failure categories, or any message not fixed by those decisions. The session-open message MUST NOT carry a tenant identifier.

#### Scenario: The catalog compiles and has no runtime exports

- GIVEN the module `src/agente-protocolo.ts`
- WHEN the project is type-checked and the module is imported
- THEN it SHALL compile and expose no runtime value

#### Scenario: Session open carries no tenant

- GIVEN the session-open type
- WHEN its fields are inspected
- THEN no field SHALL carry a tenant identifier (DEC-114)

#### Scenario: Session failure uses a closed code

- GIVEN the `sesion-fallida` type
- WHEN a value is built with a code outside the seven closed codes
- THEN type-checking SHALL reject it

### Requirement: Channel Is Threaded Through Callers Without Inspection

The five callers of `destinoDeConexion` (`conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts`, `validacion-mapeo-rutas.ts`, `planificador.ts`) SHALL pass an optional `canal` through to the destination unchanged and MUST NOT inspect it. `destinoDeConexion` MAY return a channel WHEN the `Conexion` has an agent (`agenteId`); WHEN it has none, `canal` MUST be absent (direct dial). The session registry SHALL reach `destinoDeConexion` as an optional parameter whose default is a fail-closed "no agents" opener.

#### Scenario: Caller passes the channel through

- GIVEN a caller invoked with a `canal`
- WHEN it builds the destination
- THEN the destination SHALL carry the same `canal` instance

#### Scenario: Connection with an agent gets a channel

- GIVEN a `Conexion` with an `agenteId` and a registry
- WHEN the destination is built
- THEN `canal` SHALL be present

#### Scenario: Connection without an agent stays direct

- GIVEN a `Conexion` with no `agenteId`
- WHEN the destination is built
- THEN `canal` SHALL be absent

#### Scenario: Default opener fails closed

- GIVEN a destination built with no registry argument for a `Conexion` with an agent
- WHEN a session is attempted
- THEN it SHALL fail asynchronously and MUST NOT dial TCP

### Requirement: In-Memory Session Registry

The engine SHALL keep an in-memory registry mapping agent to its control socket and session id to its data socket. A new control socket for the same agent SHALL replace the old one, which MUST be closed with 4001. Session ids SHALL be `randomBytes(16)` encoded base64url and bound to the agent. Each agent MUST have at most 8 sessions; a pending session SHALL expire after 30 s. Each entry SHALL record the `tenantId` from the token row.

#### Scenario: Control socket replacement

- GIVEN an agent with a live control socket
- WHEN the same agent connects a new control socket
- THEN the old socket SHALL close with 4001 and the new one SHALL be registered

#### Scenario: Ninth session refused

- GIVEN an agent with 8 sessions
- WHEN a ninth is requested
- THEN it SHALL fail as no-control-channel failure

#### Scenario: Pending session expires

- GIVEN a pending session never claimed by a data socket
- WHEN 30 s elapse
- THEN it SHALL fail as no-control-channel failure and be removed

### Requirement: Upgrade Authentication

The `'upgrade'` handler SHALL authenticate from the `Authorization: Bearer` header only (never query or subprotocol) before answering 101. A missing, unknown or revoked token MUST yield the same 401; a deactivated tenant MUST yield 403. The data channel SHALL re-authenticate with the same token; a session that is foreign to the agent or unknown MUST yield the same 404. The upgrade path MUST NOT enter a tenant context, and a non-upgrade `GET /agente/...` SHALL fall to Fastify and fail closed.

#### Scenario: Indistinguishable 401

- GIVEN a missing, unknown, and revoked token
- WHEN each attempts an upgrade
- THEN each response SHALL be an identical 401 before 101

#### Scenario: Deactivated tenant

- GIVEN a valid token of a deactivated tenant
- WHEN it attempts an upgrade
- THEN the response SHALL be 403

#### Scenario: Foreign or unknown session

- GIVEN agent A's session id and an unknown id
- WHEN agent B opens a data channel with each
- THEN both SHALL answer the same 404

### Requirement: Framing and Limits

Control messages SHALL be text JSON of at most 4 KiB. Data frames SHALL be binary only, at most 1 MiB. `perMessageDeflate` MUST be off. The engine SHALL ping every 20 s and MUST NOT impose a data idle timeout. Any other frame or message MUST close the socket with 1008 (policy), 1003 (wrong data type) or 1009 (message too big; the `ws` limit closes with it before any engine code runs). The engine MUST NOT log or buffer frame contents.

#### Scenario: Binary on control

- GIVEN a control socket
- WHEN a binary frame arrives
- THEN the socket SHALL close with 1003

#### Scenario: Text on data

- GIVEN a data socket
- WHEN a text frame arrives
- THEN the socket SHALL close with 1003

#### Scenario: Oversized control or unknown message

- GIVEN a control socket
- WHEN a message over 4 KiB arrives
- THEN the socket SHALL close with 1009
- WHEN a message not fixed by the catalog arrives
- THEN the socket SHALL close with 1008

### Requirement: No Control Channel Fails Asynchronously

WHEN no control channel exists, sending fails, the per-agent cap is reached, or a pending session expires, the channel SHALL be destroyed asynchronously with an internal engine error code (name set in design), classified `error-desconocido`, and not retried. The engine MUST NOT dial directly, wait, or queue. The channel factory MUST NOT throw.

#### Scenario: Agent offline

- GIVEN a `Conexion` with an agent that has no control socket
- WHEN a query runs
- THEN the session SHALL fail asynchronously with the internal code and no TCP dial

### Requirement: Tenant Checked at Use

WHEN a session is used, the engine MUST verify that the registry entry's `tenantId` equals the active tenant; otherwise the session MUST fail closed.

#### Scenario: Tenant B uses tenant A's session

- GIVEN a registry entry of tenant A
- WHEN tenant B's active context uses it
- THEN no bytes SHALL flow and the session SHALL fail

### Requirement: Failure Reported by the Agent

WHEN the agent sends `sesion-fallida`, the engine SHALL destroy the pending channel before it emits `'connect'`, mapping an unknown code to `error-desconocido`.

#### Scenario: Replica refused

- GIVEN a pending session
- WHEN `sesion-fallida` with a closed code arrives
- THEN the channel SHALL be destroyed with that code before `'connect'`
