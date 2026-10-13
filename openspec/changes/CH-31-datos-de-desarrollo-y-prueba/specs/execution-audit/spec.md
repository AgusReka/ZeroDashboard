# Execution Audit Specification (CH-31 delta)

## Purpose
The demo seed's mapping probe runs SQL against a tenant's replica outside any request; it is audited like the route (DEC-171).

## ADDED Requirements

### Requirement: The Demo Seed's Validation Is Audited
When the demo seed validates the mapping, it SHALL write exactly one `RegistroEjecucion` row with the tenant "Food Store", the operator `demo`, `origen` `validacion-mapeo`, the connection, the probe statements of every entity in contract order, and the result, exactly as `POST /conexiones/:id/validacion-mapeo` would record it.

#### Scenario: Auditing the seed's probe
- **WHEN** the demo seed validates the five entities
- **THEN** one row exists with operator `demo`, `origen` "validacion-mapeo", the five probe statements and `resultado` "ok"
