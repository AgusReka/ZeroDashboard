# Delta for Tenant Isolation

## MODIFIED Requirements

### Requirement: Every Scoped Query Is Filtered by the Active Tenant (DEC-13)

The system SHALL filter every read and write on `Conexion`, `ConsultaGuardada`, the schema-mapping definitions, `Automatizacion`, `Ejecucion`, and `Agente` by the resolved active tenant, structurally, such that a row belonging to a different tenant is treated as though it does not exist for that request or run. `Agente` MUST be listed in `MODELOS_AISLADOS`.
(Previously: covered `Conexion`, `ConsultaGuardada`, the schema-mapping definitions, `Automatizacion`, and `Ejecucion`; did not cover `Agente`.)

#### Scenario: Reading another tenant's connection, saved query, schema-mapping definition, automation, execution record, or agent

- GIVEN tenants A and B, and a row belonging to B
- WHEN A's active tenant requests that row by id
- THEN the response SHALL behave as though the row does not exist
- AND SHALL NOT return or act on B's data

#### Scenario: Listing returns only the active tenant's rows

- GIVEN tenants A and B, each with saved queries
- WHEN A's active tenant requests the saved-queries listing
- THEN only A's rows SHALL appear

#### Scenario: Agente access outside a context fails closed

- GIVEN a read or write on `Agente` through the scoped client with no tenant context entered
- WHEN it is attempted
- THEN it SHALL throw rather than execute unfiltered

#### Scenario: The model list pin includes Agente

- GIVEN the pin test over the generated model names
- WHEN it runs
- THEN it SHALL expect `Agente` and SHALL fail if a model is neither scoped nor justified

## ADDED Requirements

### Requirement: Token Lookup Is the Single Audited Unscoped Read

The lookup by `tokenHash` SHALL be the only read of `Agente` that runs without a tenant context. It MUST live in `extenderConAislamiento`, MUST filter `revocadoEn` null, and MUST return only `id`, `tenantId` and tenant state. Other unscoped `Agente` operations SHALL remain rejected.

#### Scenario: Lookup works without context

- GIVEN an active agent and no tenant context
- WHEN the lookup runs with its token hash
- THEN it SHALL return the minimum fields

#### Scenario: Other unscoped operations still fail

- GIVEN no tenant context
- WHEN `findMany` on `Agente` is attempted
- THEN it SHALL throw

### Requirement: A Token Never Resolves to a Deactivated Tenant (rule 2)

The lookup result SHALL expose the tenant's state so the caller can refuse a deactivated tenant. The tenant id MUST derive only from the matched token row, never from a request value.

#### Scenario: Deactivated tenant

- GIVEN an active agent whose tenant has `activo: false`
- WHEN the lookup runs
- THEN the result SHALL report the tenant as inactive

#### Scenario: Two tenants, two tokens

- GIVEN tenants A and B with their own agents
- WHEN each token is looked up
- THEN each SHALL resolve only to its own `tenantId`
