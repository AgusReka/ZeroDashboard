# Mapping Validation Specification

## Purpose

Explicit, persisted structural validation of a tenant's registered canonical-view mappings against the canonical contract (M3), plus a derived report of which automations are inapplicable or blocked and why (M4). Validation is structural only — column presence and semantic type, via a zero-row probe — never a data sample (DEC-39, DEC-40, DEC-42).

## Requirements

### Requirement: Postgres Types Classify Into Five Tolerant Semantic Categories (DEC-39)

The system SHALL classify a mapped column's Postgres type into exactly one of `texto`, `numero`, `booleano`, `fecha`, `identificador`, using a documented, tolerant type mapping. `identificador` SHALL accept integer, `uuid`, and text-typed columns. A type absent from the mapping (arrays, `money`, `json`, enums, any other OID) SHALL be treated as a category mismatch, and its diagnostic SHALL carry a hint to cast the column in the view (DEC-45).

#### Scenario: Identifier column typed as uuid

- GIVEN a mapped `producto.id` column of Postgres type `uuid`
- WHEN validation classifies its type
- THEN it SHALL be accepted as `identificador`

#### Scenario: Column type outside the tolerant mapping

- GIVEN a mapped column whose Postgres type has no entry in the documented mapping
- WHEN validation classifies its type
- THEN the field SHALL fail with a category-mismatch diagnostic
- AND the diagnostic SHALL suggest casting the column in the view (for example `::text`)

### Requirement: Validate Action Runs a Zero-Row Structural Probe Per Entity (DEC-40, DEC-42)

The system SHALL expose an explicit validate action, scoped to one `Conexion`, that runs a `LIMIT 0` probe of each mapped entity's registered SQL against the tenant's own connection, inside the same `READ ONLY` transaction and DEC-08 permission check used elsewhere. The probe SHALL read only column names and types, never row data.

#### Scenario: Validating a connection's mapped entities

- GIVEN a `Conexion` with registered mappings for `producto` and `insumo`
- WHEN the validate action is invoked for that connection
- THEN each mapped entity SHALL be probed with `LIMIT 0` inside a `READ ONLY` transaction
- AND the DEC-08 write-permission check SHALL run before any probe
- AND no row of tenant data SHALL be read

### Requirement: Missing Required Column Fails With a Per-Field Diagnostic

WHEN a mapped entity's probe does not return a column for a contract field, the system SHALL mark that entity invalid and name the missing field in its diagnostic.

#### Scenario: A required field absent from the view

- GIVEN a `producto` mapping whose SQL never selects an `activo` column
- WHEN validation runs
- THEN the entity SHALL be marked invalid
- AND the diagnostic SHALL name `activo` as missing

### Requirement: Wrong-Category Column Fails With a Per-Field Diagnostic

WHEN a probed column for a contract field classifies into a category other than that field's declared semantic type, the system SHALL mark the entity invalid and name the field, its expected category, and its observed category.

#### Scenario: A numeric field mapped to a text column

- GIVEN a `producto` mapping whose `stockDisponible` column is Postgres `text`
- WHEN validation runs
- THEN the entity SHALL be marked invalid
- AND the diagnostic SHALL name `stockDisponible`, expecting `numero`, observing `texto`

### Requirement: Column Outside the Contract Fails Validation and Is Named (DEC-43)

WHEN a mapped entity's probe returns a column naming no field the contract defines for that entity, the system SHALL mark the entity invalid and name every such extra column in its diagnostic.

#### Scenario: A view exposing an undefined column

- GIVEN a `producto` mapping whose SQL also selects a `notasInternas` column
- WHEN validation runs
- THEN the entity SHALL be marked invalid
- AND the diagnostic SHALL name `notasInternas` as a column the contract does not define

### Requirement: Case-Folded Alias Is Diagnosed Distinctly

WHEN a contract field is absent from the probed columns but a column exists matching it only after Postgres's default unquoted-identifier lowercase folding (e.g. `stockdisponible` for `stockDisponible`), that field's diagnostic SHALL name the folded column and note the folding, distinct from an ordinary missing-column diagnostic.

#### Scenario: An unquoted mixed-case alias

- GIVEN a `producto` mapping whose SQL selects `stockDisponible` unquoted, which Postgres folds to `stockdisponible`
- WHEN validation runs
- THEN the diagnostic for `stockDisponible` SHALL note the case-folded alias `stockdisponible`
- AND SHALL NOT be reported as an ordinary missing column

### Requirement: Reading Validation State Never Opens a Tenant Connection (DEC-40)

The system SHALL serve a connection's per-entity validation state (validated, invalid, or not-validated) from the persisted result only. Reading it SHALL NOT open a connection to the tenant's own database.

#### Scenario: Reading validation state after a previous run

- GIVEN an entity validated in a prior request
- WHEN its validation state is read
- THEN the response SHALL reflect the persisted result
- AND no connection SHALL be opened to the tenant database

### Requirement: Automation Applicability Report Derived From Contract Labels (DEC-22)

The system SHALL derive, per automation named in `AUTOMATIZACIONES`, an applicability verdict from the contract's field labels and each entity's mapping/validation state. An optional entity with no registered mapping SHALL make every automation depending solely on it "inapplicable — entity not mapped", never "failed". A required entity that is unmapped, or a required field that fails or is missing validation, SHALL block every automation naming it, with a reason identifying the entity or field. When an automation is both inapplicable and blocked, it SHALL be reported inapplicable, and every reason, including the blocking ones, SHALL be listed (DEC-46).

#### Scenario: Optional entity unmapped

- GIVEN no `insumo` mapping is registered for a connection
- WHEN the applicability report is read
- THEN `stock-producible` SHALL be reported inapplicable, reason "entity not mapped"
- AND SHALL NOT be reported as failed

#### Scenario: Required entity fails validation

- GIVEN `producto` is mapped but fails validation on `activo`
- WHEN the applicability report is read
- THEN every automation naming `producto.activo` SHALL be reported blocked, with a reason naming `producto.activo`

#### Scenario: Automation both inapplicable and blocked (DEC-46)

- GIVEN no `insumo` mapping is registered for a connection
- AND `producto` is mapped but fails validation on `activo`
- WHEN the applicability report is read
- THEN `stock-producible` SHALL be reported inapplicable
- AND its reasons SHALL include both "entity not mapped" for `insumo` and the failure of `producto.activo`

### Requirement: Validation and Report Routes Are Tenant-Scoped

The system SHALL resolve the target `Conexion` for validate, validation-read, and applicability-report requests only among rows belonging to the active tenant, never from a client-supplied tenant id. WHEN the named connection belongs to a different tenant or does not exist, the response SHALL be `404`.

#### Scenario: Validating another tenant's connection

- GIVEN tenants A and B, and a `Conexion` belonging to B
- WHEN A requests validation naming B's connection id
- THEN the response SHALL be `404`
- AND no probe SHALL run

#### Scenario: Request body carrying a tenant id

- GIVEN a validate request body that includes a `tenantId` property
- WHEN the request is submitted
- THEN the response SHALL be `400 solicitud-invalida`
- AND the resolved tenant SHALL always come from context, never from the body
