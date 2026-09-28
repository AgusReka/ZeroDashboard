# Delta for Domain Data Model

## MODIFIED Requirements

### Requirement: No Premature Modeling of Out-of-Release Entities

The schema introduced by this change SHALL NOT include tables for `usuario`, `ejecucion`, or `automatizacion`. It MAY include exactly one additional tenant-scoped model representing a tenant's registered schema-mapping definition, scoped to a `Conexion` and a canonical entity name (DEC-30 through DEC-34). It MAY additionally include exactly one global model, `Plantilla`, carrying no `tenantId` column and no foreign key to `Tenant` (DEC-61).
(Previously: also forbade a `plantilla` table; the model list was pinned to `Tenant`, `Conexion`, `ConsultaGuardada`, and the one schema-mapping model, all tenant-scoped.)

#### Scenario: Inspecting the schema after this change

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** it SHALL contain `Tenant`, `Conexion`, `ConsultaGuardada`, the schema-mapping definition model, and `Plantilla`
- **AND** it SHALL NOT contain any of `Usuario`, `Ejecucion`, or `Automatizacion`

#### Scenario: Plantilla carries no tenant reference

- **GIVEN** the `Plantilla` model
- **WHEN** its columns are inspected
- **THEN** it SHALL have no `tenantId` column and no foreign key to `Tenant`
