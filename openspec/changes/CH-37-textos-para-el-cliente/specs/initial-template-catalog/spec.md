# Initial Template Catalog Specification (CH-37 delta)

## Purpose
The two seeded templates carry the client texts that DEC-137 kept in the panel module (DEC-182, business text (a)). Installations seeded before CH-37 receive them through the migration, by slug (DEC-190), because the seeder still never updates an existing row (DEC-125).

## ADDED Requirements

### Requirement: Seeded Entries Carry the Client Texts (DEC-182, DEC-190)

Each catalog entry SHALL carry a `titulo` and a `descripcion` for the client panel:

| `automatizacion` | `titulo` | `descripcion` |
|---|---|---|
| `stock-fisico` | Aviso de stock bajo | Te avisamos por correo cuando un producto se está quedando sin stock. |
| `stock-producible` | Aviso de productos que ya casi no podés armar | Te avisamos por correo cuando, con los insumos que tenés, ya casi no podés armar un producto. |

The texts SHALL pass the same length and glossary checks as `POST /plantillas`.

#### Scenario: Fresh install

- GIVEN an empty `Plantilla` table
- WHEN the initial catalog is seeded
- THEN each of the two rows SHALL have the `titulo` and `descripcion` of the table above

#### Scenario: Seeded texts are clean

- GIVEN the two catalog entries
- WHEN their `titulo` and `descripcion` are checked against the panel glossary
- THEN none SHALL contain a forbidden term

### Requirement: Existing Rows Receive the Texts by Slug (DEC-190)

The migration that adds the `titulo` and `descripcion` columns SHALL write the texts of the table above on every existing `Plantilla` row whose `automatizacion` is `stock-fisico` or `stock-producible`, whatever its id. It SHALL NOT write any other row. The seeder SHALL stay create-if-absent ("Seeding Is Create-If-Absent by Fixed Id" is unchanged).

#### Scenario: Seeded install before CH-37

- GIVEN a database with the two seeded rows and an operator-created `stock-fisico` template, all without texts
- WHEN the migration runs
- THEN the three rows SHALL carry the texts of their slug
- AND a `reporte-diario` template SHALL keep `titulo` and `descripcion` null

#### Scenario: Seeding after the migration changes nothing

- GIVEN the migration has run on a seeded database
- WHEN the seeder runs again
- THEN no row SHALL be created or modified

## MODIFIED Requirements

### Requirement: No Schema, API or Engine Change

The initial catalog change (CH-21b) SHALL add no migration, no column (including `icono`), no new route, and no modification to engine files (rule 6). The `titulo` and `descripcion` columns are added by CH-37 under DEC-182, and are the only exception. `GET /plantillas` SHALL return the existing summary shape unchanged.
(Previously: no column at all could be added, `descripcion` included.)

#### Scenario: Existing shape is unchanged

- GIVEN the seeded catalog
- WHEN `GET /plantillas` is requested
- THEN each item SHALL have exactly `id`, `nombre`, `automatizacion`, `formato` and `toleranciaFrescuraMinutos`
