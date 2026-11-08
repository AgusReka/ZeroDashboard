# Domain Data Model Specification (CH-45 delta)

## ADDED Requirements

### Requirement: Reporte Is a Global Model (DEC-183, DEC-198)
The schema SHALL include a global model `Reporte`, with no `tenantId` column and no foreign key to `Tenant`. Its columns SHALL be `id` (text, generated), `nombre`, `titulo`, `descripcion` (nullable), `sql`, `entidades` (JSON), `visualizacion` (text whose values live in code), `columnas` (JSON) and `periodo` (nullable JSON). It SHALL hold no returned row and no tenant data (DEC-93).

#### Scenario: Reporte carries no tenant reference
- **GIVEN** `prisma/schema.prisma` after this change
- **WHEN** the `Reporte` model is inspected
- **THEN** it SHALL have no `tenantId` column and no relation to `Tenant`

### Requirement: Audit Rows Can Name a Report (DEC-198)
`RegistroEjecucion` SHALL gain a nullable text column `reporteId`, with no foreign key, like `plantillaId`. Adding it SHALL NOT change the triggers that refuse `UPDATE`, `DELETE` and `TRUNCATE`.

#### Scenario: Older audit rows
- **GIVEN** an audit row written before this change
- **WHEN** it is read
- **THEN** `reporteId` SHALL be null

#### Scenario: The record stays immutable
- **WHEN** an update of `reporteId` on an existing row is attempted
- **THEN** the database SHALL refuse it
