# Delta for domain-data-model

## MODIFIED Requirements

### Requirement: No Premature Modeling of Out-of-Release Entities

The schema introduced by this change SHALL NOT include tables for `usuario`, `ejecucion`, `plantilla`, or `automatizacion`. It MAY include exactly one additional model representing a tenant's registered schema-mapping definition, scoped to a `Conexion` and a canonical entity name (DEC-30 through DEC-34).
(Previously: also forbade a `mapeo` table; the model list was pinned to exactly `Tenant`, `Conexion`, `ConsultaGuardada`.)

#### Scenario: Inspecting the schema after this change

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** it SHALL contain `Tenant`, `Conexion`, `ConsultaGuardada`, and exactly one additional model for the schema-mapping definition
- **AND** it SHALL NOT contain any of `Usuario`, `Ejecucion`, `Plantilla`, or `Automatizacion`
