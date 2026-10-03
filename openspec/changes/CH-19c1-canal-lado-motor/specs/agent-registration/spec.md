# Delta for Agent Registration

## ADDED Requirements

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
