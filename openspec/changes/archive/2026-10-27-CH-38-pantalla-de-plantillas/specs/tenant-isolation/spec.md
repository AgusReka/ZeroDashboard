# Tenant Isolation Specification (CH-38 delta)

## Purpose
The in-use rule of DEC-191 needs to know whether any tenant has an active automation on a template, from routes that have no tenant context. It is added as one more audited unscoped operation, in the same place and with the same discipline as the agent token lookup.

## ADDED Requirements

### Requirement: Template Use Is the Single Audited Unscoped Read of Automatizacion (DEC-191)

The isolation extension SHALL expose exactly two operations that read `Automatizacion` without a tenant context, both on the raw client it closes over:
- one that answers whether a template has at least one automation with `activo = true`, as a boolean;
- one that replaces a template only if it has none, inside one transaction that first locks the template row, then checks, then writes.

Neither SHALL return rows, counts, tenant ids or automation ids. Neither SHALL accept a tenant id. Every other unscoped `Automatizacion` operation SHALL remain rejected. Routes SHALL reach these operations only through a port injected in `src/app/rutas.ts`, never through a raw client.

#### Scenario: Use is answered without a context

- GIVEN tenant B with an active automation on template T and no tenant context
- WHEN the use operation runs for T
- THEN it SHALL answer `true` and nothing else

#### Scenario: Other unscoped operations still fail

- GIVEN no tenant context
- WHEN `count` or `findMany` on `Automatizacion` is attempted through the extended client
- THEN it SHALL throw

#### Scenario: Two tenants

- GIVEN tenant A with no automation on T and tenant B with an active one
- WHEN the use operation runs for T inside A's context
- THEN it SHALL answer `true`, and no identifier of B SHALL be reachable from its result
