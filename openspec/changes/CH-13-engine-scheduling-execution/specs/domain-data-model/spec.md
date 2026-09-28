# Delta for Domain Data Model

## MODIFIED Requirements

### Requirement: No Premature Modeling of Out-of-Release Entities

The schema introduced by this change SHALL NOT include a table for `usuario`. It MAY include exactly one additional tenant-scoped model representing a tenant's registered schema-mapping definition, scoped to a `Conexion` and a canonical entity name (DEC-30 through DEC-34). It MAY additionally include exactly one global model, `Plantilla`, carrying no `tenantId` column and no foreign key to `Tenant` (DEC-61). It MAY additionally include exactly two tenant-scoped models: `Automatizacion`, binding a `Plantilla` to a tenant's `Conexion`, parameter values, and a schedule (DEC-74); and `Ejecucion`, recording one run of an `Automatizacion` (X2).
(Previously: also forbade `Ejecucion` and `Automatizacion` tables outright; this change explicitly supersedes that prohibition for these two models. `Usuario` remains forbidden, unchanged.)

#### Scenario: Inspecting the schema after this change

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** it SHALL contain `Tenant`, `Conexion`, `ConsultaGuardada`, the schema-mapping definition model, `Plantilla`, `Automatizacion`, and `Ejecucion`
- **AND** it SHALL NOT contain `Usuario`

#### Scenario: Plantilla carries no tenant reference

- **GIVEN** the `Plantilla` model
- **WHEN** its columns are inspected
- **THEN** it SHALL have no `tenantId` column and no foreign key to `Tenant`

#### Scenario: Usuario stays forbidden

- **GIVEN** `prisma/schema.prisma` after this change is applied
- **WHEN** the model list is inspected
- **THEN** no `Usuario` table SHALL exist
