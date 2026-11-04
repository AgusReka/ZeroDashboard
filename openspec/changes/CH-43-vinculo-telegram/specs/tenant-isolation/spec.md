# Tenant Isolation Specification (CH-43 delta)

## Purpose
The Telegram link adds two tenant-scoped models, one unscoped lookup by code hash, and a third production entry into a tenant context: the Telegram poller (DEC-185, DEC-196). Written against the main spec as it stands after CH-42's archive.

## ADDED Requirements

### Requirement: Telegram Link Models Are Tenant-Scoped
`VinculoTelegram` and `CodigoVinculoTelegram` SHALL be in the isolation extension's scoped set, so every operation on them outside the lookup below SHALL be filtered by the active tenant, and SHALL fail closed with no context.

#### Scenario: No context, no read
- **GIVEN** no tenant context
- **WHEN** `findMany` on `VinculoTelegram` or `CodigoVinculoTelegram` is attempted through the extended client
- **THEN** it throws

### Requirement: Code Lookup Is the Single Audited Unscoped Read of CodigoVinculoTelegram
The isolation extension SHALL expose exactly one operation that reads `CodigoVinculoTelegram` without a tenant context: a lookup by `codigoHash` returning only `tenantId`, `tenantNombre`, `tenantActivo` and `venceEn`, or nothing. It SHALL NOT accept a tenant id. The caller SHALL refuse an expired code or an inactive tenant. Every other unscoped operation on that model SHALL remain rejected.

#### Scenario: Lookup works without context
- **GIVEN** tenant A's live code and no tenant context
- **WHEN** the lookup runs with its hash
- **THEN** it returns A's id, name, state and the expiry, and nothing else

#### Scenario: A code never links a deactivated tenant
- **GIVEN** a live code of a tenant with `activo: false`
- **WHEN** the bot receives it
- **THEN** no link is stored and the "not valid" answer is sent

### Requirement: The Telegram Poller Enters a Tenant Context Only From the Code Row (rule 2)
The poller SHALL be the third production entry into a tenant context, after request hooks and the scheduler. It SHALL enter a context only to store a link, only with the tenant id the code lookup returned, and SHALL NOT take a tenant id from any field of a Telegram update. The comment on the context entry function SHALL name the three entries.

#### Scenario: A code from tenant A links only A
- **GIVEN** tenants A and B, each with a live code
- **WHEN** chat 42 sends A's code
- **THEN** A is linked to chat 42, B is neither linked nor has its code changed

### Requirement: Telegram Panel Routes Are Proven Isolated by a Two-Tenant Test
The panel two-tenant suite SHALL exercise the three Telegram routes from each tenant's session, including with the other tenant's `X-Tenant-Id` header, and SHALL assert that no response contains the other tenant's state, expiry or link date, that creating a code leaves the other tenant's code unchanged, and that unlinking leaves the other tenant's link unchanged.

#### Scenario: Two tenants, two cards
- **GIVEN** tenant A linked and tenant B with a live code
- **WHEN** each session reads `GET /api/panel/telegram`, also sending the other's `X-Tenant-Id`
- **THEN** A reads `vinculado` and B reads `codigo-pendiente`, each with its own dates only
