# Delta for Tenant Isolation

## ADDED Requirements

### Requirement: Boot Sweep Enters Each Tenant Context, Including Deactivated Tenants (DEC-99, DEC-14)

The boot sweep SHALL read the tenant list from `Tenant` rows of the own database and SHALL enter each tenant's context through the same fail-closed structural extension (DEC-13), closing that tenant's `en-curso` rows with `updateMany`. It MUST NOT use raw SQL and MUST NOT touch `Ejecucion` rows outside a tenant context. It SHALL include tenants with `activo: false`.

This is an explicit, bounded exception to DEC-14: a deactivated tenant is frozen for running automations, but its stuck `en-curso` rows are still closed so they do not stay `en-curso` forever. The exception covers only closing rows; it does not allow running any automation.

#### Scenario: Active and deactivated tenants are both swept

- GIVEN an active tenant A and a deactivated tenant B, each with an `en-curso` row
- WHEN the boot sweep runs
- THEN both rows SHALL be closed as `fallo`/`interrumpida`

#### Scenario: Sweep is limited to each tenant's own rows

- GIVEN tenants A and B with `en-curso` rows
- WHEN the sweep runs in A's context
- THEN only A's rows SHALL be updated in that step, and each tenant's rows SHALL be updated only in its own context

#### Scenario: Deactivated tenant's automations still do not run

- GIVEN a deactivated tenant with a due active automation
- WHEN the sweep and then a tick run
- THEN the automation SHALL NOT run

#### Scenario: Sweep outside any context fails closed

- GIVEN a sweep write against `Ejecucion` with no tenant context entered
- WHEN it is attempted
- THEN it SHALL throw rather than execute unfiltered

### Requirement: Overlap Lookup Is Tenant-Scoped (DEC-96, DEC-13)

The overlap lookup and the `omitida` write SHALL go through the tenant-scoped client inside the run's tenant context, so that another tenant's `en-curso` row is never observed.

#### Scenario: Cross-tenant rows are invisible to the lookup

- GIVEN tenants A and B, and an `en-curso` row only in B
- WHEN A's automation runs its overlap lookup
- THEN the lookup SHALL find no row
