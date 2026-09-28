# Tenant Schema Mapping Specification

## Purpose

Registering, listing, and reading operator-authored canonical-view SQL per `Conexion` and canonical entity name (DEC-30, DEC-31, DEC-32, DEC-33). Pure persistence: the SQL is stored as inert text; nothing is executed, previewed, or composed in this change (DEC-31 scope).

## Requirements

### Requirement: Registration Persists Against a Tenant-Scoped Connection

The system SHALL register a schema-mapping definition for a `Conexion` and one canonical entity name, resolving the `Conexion` only among rows belonging to the active tenant resolved for the request — never from a client-supplied tenant id. WHEN the named connection belongs to a different tenant or does not exist, the system SHALL respond `404` and create no row.

#### Scenario: Registering a valid definition

- GIVEN an active tenant and a `Conexion` it owns
- WHEN a registration request names that connection, a canonical entity, and non-empty SQL text
- THEN the response SHALL be `201` with the persisted definition, `tenantId` taken from context

#### Scenario: Registering against another tenant's connection

- GIVEN tenants A and B, and a `Conexion` belonging to B
- WHEN A submits a registration naming B's connection id
- THEN the response SHALL be `404`
- AND no row SHALL be created

### Requirement: Entity Name Validated Against the Canonical Contract Only (DEC-32)

The system SHALL accept only one of the five CONTRATO_CANONICO entity names (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`) as the entity being mapped. It SHALL NOT validate any column, field, or shape of the submitted SQL against the contract.

#### Scenario: Unknown entity name

- GIVEN a registration request naming an entity outside CONTRATO_CANONICO (e.g. `cliente`)
- WHEN the request is submitted
- THEN the response SHALL be `400 solicitud-invalida`
- AND no row SHALL be created

### Requirement: Registered SQL Is Not Executed at Register, List, or Read Time

The system SHALL NOT open a connection to, execute against, or preview the target database using the submitted SQL, at registration, listing, or reading time. It MAY apply a purely textual check (e.g. non-empty after trimming). Only the explicit validate action defined by the `mapping-validation` capability executes registered SQL, and only as a zero-row probe.

#### Scenario: Blank SQL text rejected

- GIVEN a registration request with SQL text consisting only of whitespace
- WHEN the request is submitted
- THEN the response SHALL be `400 solicitud-invalida`
- AND no row SHALL be created
- AND no `pg` connection SHALL be opened to the target database

#### Scenario: Registering, listing, and reading never execute SQL

- GIVEN a registered mapping definition
- WHEN it is registered, listed, or read by id
- THEN no `pg` connection SHALL be opened to the target database

### Requirement: Re-registering an Entity Replaces the Previous Definition and Resets Its Validation (DEC-34, DEC-41)

WHEN a registration request names a `Conexion`/entity pair that already has a persisted definition, the system SHALL replace it in place with the newly submitted SQL text, keeping no history and creating no second row. The replace SHALL also reset that entity's persisted validation state (status, diagnostic, timestamp) to not-validated, discarding any prior validation result.

#### Scenario: Re-registering an already-mapped entity

- GIVEN a `Conexion` with an existing definition for the `producto` entity
- WHEN a new registration request is submitted for the same connection and entity with different SQL text
- THEN the response SHALL be `200` (not `201`), distinguishing a replace from a first registration
- AND exactly one row SHALL exist for that connection/entity pair afterward, containing only the new SQL text

#### Scenario: Re-registering resets a previously validated entity

- GIVEN a `Conexion` with a `producto` mapping that has a persisted valid validation result
- WHEN a new registration request is submitted for the same connection and entity with different SQL text
- THEN the response SHALL be `200`
- AND the entity's persisted validation state SHALL become not-validated, with no diagnostic and no validation timestamp
### Requirement: Listing a Connection's Definitions Is Tenant-Scoped

The system SHALL return every schema-mapping definition belonging to a given `Conexion`, resolving that connection only among rows belonging to the active tenant. WHEN the named connection belongs to a different tenant or does not exist, the response SHALL be `404`.

#### Scenario: Listing returns exactly the owned definitions

- GIVEN a `Conexion` owned by the active tenant with two registered definitions
- WHEN the listing request is submitted for that connection
- THEN the response SHALL contain exactly those two definitions
- AND none belonging to another tenant's connection SHALL appear

### Requirement: Reading One Definition Is Tenant-Scoped

The system SHALL return a schema-mapping definition's full record (including SQL text) only when it belongs to a `Conexion` owned by the active tenant. WHEN it belongs to a different tenant or does not exist, the response SHALL be `404`.

#### Scenario: Reading another tenant's definition

- GIVEN tenants A and B, and a definition on a `Conexion` owned by B
- WHEN A's active tenant requests that definition by its connection and canonical entity name
- THEN the response SHALL be `404`

### Requirement: Request Body Rejects Client-Supplied Tenant Id

The system SHALL validate every mutating request body against a strict JSON Schema (`additionalProperties:false`). A body carrying `tenantId` or any property not defined by the schema SHALL be rejected.

#### Scenario: tenantId supplied in the request body

- GIVEN a registration request body that includes a `tenantId` property
- WHEN the request is submitted
- THEN the response SHALL be `400 solicitud-invalida`
- AND the persisted tenant SHALL always be the one resolved from context, never a submitted value
### Requirement: Registered SQL Is Consumable as a WITH CTE by Automation Templates (DEC-70)

A registered schema-mapping definition's SQL text SHALL be reusable as the body of a `WITH v_<entidad> AS (...)` CTE by the `automation-templates` capability's composition function; the only transformation applied is the existing `sanearSql` normalization (trim and one trailing `;` removed), applied exactly once, so a trailing semicolon or line comment cannot break the composed statement. This does not change registration, listing, or reading: those remain pure persistence with no execution (DEC-31 scope unchanged). Composition itself, and any requirement to have a passing validation before composing, belongs to `automation-templates`.

#### Scenario: Registered SQL is reused verbatim as a CTE body

- GIVEN a registered `producto` mapping definition
- WHEN `automation-templates` composes a template listing `producto` in its `entidades`
- THEN the CTE `v_producto` SHALL contain the registered SQL text normalized once by `sanearSql`, and nothing else
