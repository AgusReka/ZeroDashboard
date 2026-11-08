# Domain Data Model Specification (CH-46 delta)

## ADDED Requirements

### Requirement: Tablero Is a Tenant-Scoped Model (DEC-199)
The schema SHALL include a tenant-scoped model `Tablero` with:
- `id` (text, generated);
- `tenantId`, unique, with a relation to `Tenant`;
- `conexionId`, with a relation to `Conexion`;
- `reportes`, a text array holding report ids in display order.

It SHALL hold no returned row (DEC-93). `reportes` has no foreign key: reports are never deleted (DEC-68), and the save checks that each id exists.

#### Scenario: One dashboard per tenant
- **GIVEN** `prisma/schema.prisma` after this change
- **WHEN** the `Tablero` model is inspected
- **THEN** `tenantId` SHALL be unique and SHALL relate to `Tenant`

#### Scenario: The connection cannot vanish under a dashboard
- **GIVEN** the `Tablero` model
- **WHEN** its relation to `Conexion` is inspected
- **THEN** it SHALL restrict deletes (no route deletes a connection today, so this only guards a direct delete)
