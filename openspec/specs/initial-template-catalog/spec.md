# Initial Template Catalog Specification

## Purpose

The content a fresh installation ships in the global `Plantilla` catalog (DEC-61), and how it gets there: a closed list of two verified templates, seeded by fixed id and create-if-absent (DEC-125), without schema, API or engine change. This capability covers catalog content and the seeding write path only. The mechanism of templates (validation, composition, test endpoint) stays in `automation-templates` and is not modified; seeded rows MUST satisfy it as written.

## ADDED Requirements

### Requirement: Catalog Contains Exactly Two Initial Templates

The shipped catalog SHALL consist of exactly two entries, identified by the fixed ids of `stock-fisico` and `stock-producible` (the `automatizacion` values of the same names). The catalog SHALL NOT contain a `reporte-diario` entry, whether complete, stub or disabled (DEC-126). The absence of `reporte-diario` is a documented artifact limit, not a defect.

#### Scenario: Seeding an empty catalog

- GIVEN an empty `Plantilla` table
- WHEN the initial catalog is seeded
- THEN exactly two rows SHALL exist
- AND one SHALL have `automatizacion: "stock-fisico"` and the other `automatizacion: "stock-producible"`
- AND every row SHALL have `formato: "correo-html"` and `parametros: [{ nombre: "umbral", tipo: "numero" }]`

#### Scenario: No daily report row

- GIVEN the initial catalog has been seeded
- WHEN `GET /plantillas` is requested
- THEN no returned template SHALL have `automatizacion: "reporte-diario"`

### Requirement: Seeding Is Create-If-Absent by Fixed Id (DEC-125, DEC-68)

The seeder SHALL create a catalog entry only when no row with that entry's fixed id exists. It SHALL NOT update, replace or overwrite any existing row, and SHALL NOT delete any row. The fixed id is the only key that decides whether a row is created.

#### Scenario: Seeding twice is idempotent

- GIVEN the initial catalog has been seeded once
- WHEN it is seeded a second time
- THEN exactly two rows SHALL exist for the two fixed ids
- AND no row SHALL have been modified

#### Scenario: Operator edit survives a second seed

- GIVEN the seeded `stock-fisico` row was replaced with `PUT /plantillas/:id` using a different `sql` and `nombre`
- WHEN the initial catalog is seeded again
- THEN the row SHALL be byte-identical to its state before the second seed
- AND the seeder SHALL NOT re-apply its own content

#### Scenario: Absent row is recreated by id only

- GIVEN the row for one fixed id is absent (never created, or removed directly in the database) and the other row exists
- WHEN the initial catalog is seeded
- THEN the absent row SHALL be created with its catalog content under its fixed id
- AND the existing row SHALL be unchanged

#### Scenario: Unrelated templates are untouched

- GIVEN a template created through `POST /plantillas` with a generated id and `automatizacion: "stock-fisico"`
- WHEN the initial catalog is seeded
- THEN that template SHALL be unchanged
- AND the seeder SHALL NOT use `automatizacion` or `nombre` to decide whether to create a row

### Requirement: Catalog Seeding Is Independent of the Tenant Seed

The initial catalog SHALL be seeded on every run of `prisma/seed.ts`, regardless of whether the demo tenant already exists. An existing tenant SHALL NOT cause catalog seeding to be skipped. Tenant seeding behavior SHALL remain unchanged.

#### Scenario: Existing tenant does not skip catalog seeding

- GIVEN a `Tenant` row already exists and the `Plantilla` table is empty
- WHEN `prisma/seed.ts` runs
- THEN both catalog rows SHALL be created
- AND tenant seeding SHALL behave as before (no new tenant created)

#### Scenario: Fresh install lists both templates

- GIVEN a fresh installation after container start and seed
- WHEN `GET /plantillas` is requested without `x-tenant-id`
- THEN the response SHALL list both `stock-fisico` and `stock-producible` templates by their fixed ids

#### Scenario: Seed failure

- GIVEN the seeder cannot create a row (for example the database rejects the write)
- WHEN the seed runs
- THEN the failure SHALL NOT be swallowed silently, and the empty selector SHALL NOT be reported as success
- AND whether container start aborts is an open point for design

### Requirement: Every Entry Passes the Save-Time Checks of POST /plantillas

Each catalog entry SHALL pass exactly the same validation as `POST /plantillas`: strict body shape (no unknown fields), the CH-11 parameter rules (declared-but-unused rejected, undeclared `:marker` rejected, hand-written `$n` rejected), `entidades` drawn from the five `CONTRATO_CANONICO` names, `automatizacion` from `AUTOMATIZACIONES`, `formato` equal to `correo-html`, and `toleranciaFrescuraMinutos` a non-negative integer. Therefore any seeded row could also have been saved through `POST /plantillas`.

#### Scenario: Entries validate with the route's rules

- GIVEN the two catalog entries
- WHEN each is validated with the same functions the `POST /plantillas` route uses
- THEN both SHALL be accepted without error

#### Scenario: Entry violating a rule is not seeded

- GIVEN a catalog entry whose `sql` contains `$1` or whose `entidades` names an unknown entity
- WHEN the seeder processes it
- THEN that entry SHALL NOT be persisted
- AND the failure SHALL name the offending rule or entity

### Requirement: Entries Compose and Execute Read-Only With a Sample umbral

Each entry SHALL compose through `componerSentencia` and `prepararSentencia` with a sample `umbral` value of type `numero`, producing a statement that contains only driver placeholders and never the literal value. The composed statement SHALL execute through the existing read-only pipeline (`READ ONLY` transaction, DEC-08) and filter on `umbral`.

#### Scenario: Composition with a sample threshold

- GIVEN either catalog entry and a connection with all of its entities mapped and validated
- WHEN it is composed and prepared with `umbral = 5`
- THEN composition SHALL succeed
- AND the final SQL text SHALL contain only placeholders, never the literal `5`

#### Scenario: Execution on a miniature fixture

- GIVEN a Postgres miniature of the canonical views with products whose available stock is above and below the threshold
- WHEN each composed template is executed read-only with a sample `umbral`
- THEN only rows at or below the threshold SHALL be returned
- AND the transaction SHALL be read-only

#### Scenario: Result order is not asserted unless verified

- GIVEN the template `sql` is nested as `SELECT * FROM (<sql>) AS _plantilla`
- WHEN row order is checked
- THEN the specification SHALL NOT require any order unless design verifies that `ORDER BY` survives nesting (see open points)

### Requirement: stock-fisico Keeps the Recipe Exclusion and Declares receta_componente (DEC-127)

The `stock-fisico` entry SHALL declare `entidades: ["producto", "receta_componente"]`. Its `sql` SHALL filter on `<= :umbral` and SHALL keep the verified `NOT EXISTS` over `v_receta_componente` that excludes products having a recipe. Its `toleranciaFrescuraMinutos` SHALL be `60`. A connection without a valid `receta_componente` mapping validation SHALL be rejected by the DEC-71 gate; an empty view is a valid mapping.

#### Scenario: Declared entities

- GIVEN the seeded `stock-fisico` row
- WHEN it is read
- THEN `entidades` SHALL equal `["producto", "receta_componente"]`
- AND `toleranciaFrescuraMinutos` SHALL equal `60`

#### Scenario: Products with a recipe are excluded

- GIVEN a fixture with a product that has a `receta_componente` row and one that has none, both at or below the threshold
- WHEN `stock-fisico` is executed with a sample `umbral`
- THEN only the product without a recipe SHALL be returned

#### Scenario: Connection without a valid receta_componente view

- GIVEN a tenant connection with no registered, or no passing, `receta_componente` validation
- WHEN `POST /plantillas/:id/prueba` runs `stock-fisico`
- THEN the response SHALL be `409` with code `vista-canonica-no-aprobada` naming `receta_componente`
- AND no query SHALL execute

#### Scenario: Tenant without recipes using an empty view

- GIVEN a connection whose `receta_componente` view is valid and returns no rows
- WHEN `stock-fisico` is executed
- THEN the gate SHALL pass and the exclusion SHALL remove nothing

### Requirement: stock-producible Carries the Threshold in HAVING (DEC-128)

The `stock-producible` entry SHALL contain `HAVING ... <= :umbral` over the producible-units aggregate (`FLOOR(MIN(...))`) of the verified canonical query. Its `toleranciaFrescuraMinutos` SHALL be `120`. Its `entidades` SHALL be the entities that verified query reads, all from the contract.

#### Scenario: Threshold applies to producible units

- GIVEN a fixture with products whose producible units are above and below the threshold
- WHEN `stock-producible` is executed with a sample `umbral`
- THEN only products whose producible units are at or below the threshold SHALL be returned

#### Scenario: Declared tolerance

- GIVEN the seeded `stock-producible` row
- WHEN it is read
- THEN `toleranciaFrescuraMinutos` SHALL equal `120`

### Requirement: Provisional Tolerances Are Stored and Never Enforced (DEC-128, DEC-66)

The seeded tolerances (60 and 120 minutes) SHALL be stored in `toleranciaFrescuraMinutos` as provisional values with no other source in the repository. They SHALL NOT affect any execution path in this change. Enforcement belongs to CH-24.

#### Scenario: Tolerance has no execution effect

- GIVEN a seeded template
- WHEN it is tested against a connection
- THEN execution SHALL be identical regardless of its `toleranciaFrescuraMinutos`

### Requirement: Entries Use Only v_<entidad> Aliases, No Concatenation, No Personal Data, No Secrets (DEC-70, Rules 4, 5, 7)

Each entry's `sql` SHALL read only `v_<entidad>` aliases for entities declared in its `entidades`, SHALL be SELECT-only, and SHALL carry values only through `:marker` parameters, with no string concatenation of values. Entries SHALL reference only canonical contract fields, SHALL NOT expose domicilio, telefono, correo or any personal field, and SHALL NOT contain credentials or secrets.

#### Scenario: Aliases match declared entities

- GIVEN each entry
- WHEN its `sql` is scanned for `v_<name>` references
- THEN every referenced alias SHALL correspond to a name in the entry's `entidades`
- AND no physical table or schema-qualified name SHALL be referenced

#### Scenario: No write statements or literal values

- GIVEN each entry
- WHEN its `sql` is inspected
- THEN it SHALL contain no `INSERT`, `UPDATE`, `DELETE`, DDL, or hand-written `$n`
- AND the threshold SHALL appear only as `:umbral`

#### Scenario: No personal data or secrets

- GIVEN each entry's `sql` and fields
- WHEN they are inspected
- THEN no personal-data column and no credential or connection string SHALL be present

### Requirement: Catalog Is Global and Holds No Tenant Data (Rule 2)

The seeder SHALL take no tenant input, and the seeded rows SHALL carry no `tenantId` and no tenant-specific data. The catalog SHALL remain readable without `x-tenant-id`, as `automation-templates` already requires.

#### Scenario: Seeding needs no tenant

- GIVEN an empty `Tenant` table and an empty `Plantilla` table
- WHEN the initial catalog is seeded
- THEN both rows SHALL be created without any tenant identifier

#### Scenario: Seeded content is tenant-neutral

- GIVEN the two seeded rows
- WHEN their `sql` and fields are inspected
- THEN they SHALL contain only `:marker` placeholders and `v_<entidad>` aliases, with no tenant identifier or tenant data

### Requirement: No Schema, API or Engine Change

This change SHALL add no migration, no column (including `descripcion` and `icono`), no new route, and no modification to engine files (rule 6). `GET /plantillas` SHALL return the existing template shape unchanged.

#### Scenario: Existing shape is unchanged

- GIVEN the seeded catalog
- WHEN `GET /plantillas` is requested
- THEN each item SHALL have only the fields the model already defines
- AND the Prisma schema and migrations SHALL be unchanged by this change

## Open points for design

- Literal values of the two fixed ids.
- `nombre` values and the business-readable column aliases for the email headers (raw column names are the default).
- Whether a seed failure aborts container start (proposal Open Questions; no DEC decides it).
- Exact `entidades` of `stock-producible` as read by the verified `04_` query (to be confirmed against the SQL during design).
- Whether `ORDER BY` survives the engine's `SELECT * FROM (<sql>) AS _plantilla` nesting, and if not, whether to document that order is not guaranteed or restructure the template SQL (engine unchanged either way).
- How the seeder reuses the route's validation functions from `src/` without going through HTTP.
- Behavior when a fixed id exists but its content is invalid or unrelated (this spec only requires it not be overwritten).
