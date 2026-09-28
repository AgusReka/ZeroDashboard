# Delta for Tenant Schema Mapping

## ADDED Requirements

### Requirement: Registered SQL Is Consumable as a WITH CTE by Automation Templates (DEC-70)

A registered schema-mapping definition's SQL text SHALL be reusable as the body of a `WITH v_<entidad> AS (...)` CTE by the `automation-templates` capability's composition function; the only transformation applied is the existing `sanearSql` normalization (trim and one trailing `;` removed), applied exactly once, so a trailing semicolon or line comment cannot break the composed statement. This does not change registration, listing, or reading: those remain pure persistence with no execution (DEC-31 scope unchanged). Composition itself, and any requirement to have a passing validation before composing, belongs to `automation-templates`.

#### Scenario: Registered SQL is reused verbatim as a CTE body

- GIVEN a registered `producto` mapping definition
- WHEN `automation-templates` composes a template listing `producto` in its `entidades`
- THEN the CTE `v_producto` SHALL contain the registered SQL text normalized once by `sanearSql`, and nothing else
