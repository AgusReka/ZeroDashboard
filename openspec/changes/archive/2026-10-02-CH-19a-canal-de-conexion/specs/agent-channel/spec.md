# Agent Channel Specification

## Purpose

Type catalog for the agent protocol and the optional channel seam through which a database session may be carried over an injected duplex stream instead of a direct TCP dial (DEC-112, DEC-113). This slice defines contracts only; nothing is wired to a route or a production caller.

## Requirements

### Requirement: Protocol Type Catalog Is Limited to Fixed Decisions

`src/agente-protocolo.ts` SHALL export types only, with no runtime behavior, for exactly: the control channel versus the per-session data channel (DEC-113), the session-open message (DEC-113, DEC-114), the closed set of replica-side error codes the agent reports (DEC-117), and the heartbeat message (DEC-118). The catalog MUST NOT define tokens, registry, states, failure categories, or any message not fixed by those decisions. The session-open message MUST NOT carry a tenant identifier.

#### Scenario: The catalog compiles and has no runtime exports

- GIVEN the module `src/agente-protocolo.ts`
- WHEN the project is type-checked and the module is imported
- THEN it SHALL compile and expose no runtime value

#### Scenario: Session open carries no tenant

- GIVEN the session-open type
- WHEN its fields are inspected
- THEN no field SHALL carry a tenant identifier (DEC-114)

### Requirement: Channel Is Optional on the Connection Destination

`DestinoPostgres` SHALL accept an optional `canal`. WHEN `canal` is absent, `iniciarConexion` SHALL build the client configuration byte-identically to the behavior before this change (direct TCP dial). WHEN `canal` is present, it SHALL give the driver a stream factory backed by that channel, and `ssl` SHALL remain off (DEC-113). The seam MUST NOT log or buffer bytes carried by the channel.

#### Scenario: Absent channel leaves the configuration unchanged

- GIVEN a destination with no `canal`
- WHEN `iniciarConexion` builds the client
- THEN the client configuration SHALL equal the pre-change configuration and contain no stream factory

#### Scenario: Present channel supplies the stream

- GIVEN a destination with a `canal`
- WHEN `iniciarConexion` builds the client
- THEN the driver SHALL obtain its stream from the channel and SHALL NOT dial TCP

### Requirement: Channel Is Threaded Through Callers Without Inspection

The five callers of `destinoDeConexion` (`conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts`, `validacion-mapeo-rutas.ts`, `planificador.ts`) SHALL pass an optional `canal` through to the destination unchanged and MUST NOT inspect it. `destinoDeConexion` MUST NOT return a channel, and no production path SHALL supply one.

#### Scenario: Caller passes the channel through

- GIVEN a caller invoked with a `canal`
- WHEN it builds the destination
- THEN the destination SHALL carry the same `canal` instance

#### Scenario: Production paths never set a channel

- GIVEN any production code path building a destination from a `Conexion`
- WHEN the destination is built
- THEN `canal` SHALL be absent

### Requirement: Channel Failure Modes Are Bounded

A session over a channel SHALL honor the connect budget: WHEN the channel stays silent past the budget, the attempt SHALL fail as `tiempo-agotado` (`PRESUPUESTO_AGOTADO`) within that budget. WHEN the channel drops after connecting, the DEC-111 `'error'` listener SHALL absorb it and the process MUST NOT crash. `cerrarCliente` SHALL return without hanging on a channel that is still connecting.

#### Scenario: Silent channel exhausts the budget

- GIVEN a channel that never answers
- WHEN a connection is attempted
- THEN it SHALL fail as `tiempo-agotado` within the connect budget

#### Scenario: Dropped channel does not crash the process

- GIVEN an established session over a channel
- WHEN the channel is destroyed with an error
- THEN the process SHALL keep running and the failure SHALL surface as a legible connection failure

#### Scenario: Closing a connecting client returns

- GIVEN a client whose channel has not finished connecting
- WHEN `cerrarCliente` is called
- THEN it SHALL return within the budget
