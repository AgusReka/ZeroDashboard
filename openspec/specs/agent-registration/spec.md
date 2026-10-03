# Agent Registration Specification

## Purpose

Each tenant has at most one agent, authenticated by its own token (DEC-114, DEC-115, DEC-121). This capability covers the `Agente` model and the emission, re-issue, listing and revocation of its token. Revoke and tenant baja close the agent's live WebSocket sockets with 4002; the channel itself is described in agent-channel. The agent process is out of scope (19c2).

## Requirements

### Requirement: One Agent Row Per Tenant

The own database SHALL have an `Agente` table with `id`, `tenantId` (required foreign key to `Tenant`, `RESTRICT`), `tokenHash`, `creadoEn`, `tokenEmitidoEn` and `revocadoEn` (nullable). `tenantId` MUST carry a full (non-partial) unique index and `tokenHash` MUST be unique. The migration SHALL be additive and carry its rollback SQL in its header.

#### Scenario: A second agent for the same tenant is rejected by the database

- GIVEN a tenant with an `Agente` row
- WHEN a second `Agente` row is inserted for that tenant
- THEN the database SHALL reject the insert

#### Scenario: Two agents cannot share a token hash

- GIVEN an `Agente` row with a given `tokenHash`
- WHEN another row is inserted with the same `tokenHash`
- THEN the database SHALL reject the insert

### Requirement: Token Emission Shown Once

`POST /agentes`, scoped by `X-Tenant-Id`, SHALL create the tenant's `Agente` when none exists. The token MUST be `zda_` followed by 32 random bytes encoded base64url; only its SHA-256 hex digest SHALL be stored. The response SHALL include the token exactly once and MUST carry `Cache-Control: no-store`. The body MUST NOT accept `tenantId`; the tenant comes only from the resolved active tenant. A request body containing any unknown field SHALL be rejected.

#### Scenario: Creating the first agent

- GIVEN an active tenant with no agent
- WHEN `POST /agentes` is called
- THEN the response SHALL be `201` with the agent projection and a token starting with `zda_`
- AND `Cache-Control` SHALL be `no-store`
- AND the stored `tokenHash` SHALL equal the SHA-256 hex of the returned token, and the token SHALL NOT be stored

#### Scenario: Body naming a tenant is rejected

- GIVEN an active tenant A
- WHEN `POST /agentes` is called with a body containing `tenantId` of tenant B
- THEN the request SHALL be rejected and no `Agente` row SHALL be created

### Requirement: Re-Issue in Place After Revocation

WHEN the tenant's agent is revoked, `POST /agentes` SHALL re-issue in place: same `id`, new `tokenHash`, new `tokenEmitidoEn`, `revocadoEn` cleared. WHEN the agent is active, it SHALL respond `409 agente-existente` and MUST NOT change the row. No token history SHALL be kept.

#### Scenario: Re-issuing a revoked agent

- GIVEN a tenant whose agent is revoked
- WHEN `POST /agentes` is called
- THEN the same `id` SHALL be returned with a new token, and the old token SHALL no longer resolve

#### Scenario: Creating over an active agent

- GIVEN a tenant with an active agent
- WHEN `POST /agentes` is called
- THEN the response SHALL be `409 agente-existente`
- AND the stored `tokenHash` SHALL be unchanged

### Requirement: List and Soft Revoke Scoped to the Active Tenant

`GET /agentes` SHALL list only the active tenant's agent. The revoke route SHALL set `revocadoEn` and keep the row; it SHALL be idempotent in effect. A row of another tenant MUST be treated as nonexistent (`404`).

#### Scenario: Listing returns only the own agent

- GIVEN tenants A and B, each with an agent
- WHEN A lists agents
- THEN only A's agent SHALL appear

#### Scenario: Revoking another tenant's agent

- GIVEN tenants A and B, and B's agent id
- WHEN A calls revoke naming that id
- THEN the response SHALL be `404` and B's agent SHALL remain active

#### Scenario: Revoking keeps the row

- GIVEN an active agent
- WHEN it is revoked
- THEN `revocadoEn` SHALL be set and the row SHALL still exist

### Requirement: Public Projection Without Secrets

Every response projecting an agent MUST expose only non-secret fields (`id`, `creadoEn`, `tokenEmitidoEn`, `revocadoEn`) plus the token on emission. It MUST NOT contain `tokenHash` or `tenantId`, and no log line or error message MAY contain the token, its hash or a `tenantId`.

#### Scenario: List and revoke omit secrets

- GIVEN an agent with a known token
- WHEN it is listed and revoked
- THEN neither response SHALL contain the token, its hash, or the `tenantId`

### Requirement: Typed Lookup by Token Hash

The system SHALL expose one typed lookup by `tokenHash` that finds only non-revoked agents and returns only `id`, `tenantId` and the tenant's active state. It MUST NOT return the hash or any other column, and SHALL be provided inside the isolation module.

#### Scenario: Valid token resolves

- GIVEN an active agent of an active tenant
- WHEN its token hash is looked up
- THEN `id`, `tenantId` and the tenant state SHALL be returned

#### Scenario: Revoked or unknown token fails

- GIVEN a revoked agent, or a hash matching no row
- WHEN the hash is looked up
- THEN no agent SHALL be returned

#### Scenario: Re-issued token supersedes the old one

- GIVEN a re-issued agent
- WHEN the old token's hash is looked up
- THEN no agent SHALL be returned

### Requirement: Revoke and Tenant Baja Close Live Sockets

`POST /agentes/:id/revocar` and `POST /tenants/:id/baja` SHALL close the agent's live control and data sockets with 4002 through the session registry, in addition to writing the row. A later upgrade MUST be rechecked against the row.

#### Scenario: Revoking closes sockets

- GIVEN an agent with a live control socket and a data socket
- WHEN the agent is revoked
- THEN both sockets SHALL close with 4002

#### Scenario: Baja closes sockets

- GIVEN a tenant whose agent has live sockets
- WHEN the tenant is deactivated
- THEN the agent's sockets SHALL close with 4002

#### Scenario: Revoking with no live sockets

- GIVEN an agent with no live sockets
- WHEN it is revoked
- THEN the response SHALL be unchanged and no error SHALL occur
