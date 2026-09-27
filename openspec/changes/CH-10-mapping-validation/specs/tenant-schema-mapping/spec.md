# Delta for Tenant Schema Mapping

## MODIFIED Requirements

### Requirement: Registered SQL Is Not Executed at Register, List, or Read Time

The system SHALL NOT open a connection to, execute against, or preview the target database using the submitted SQL, at registration, listing, or reading time. It MAY apply a purely textual check (e.g. non-empty after trimming). Only the explicit validate action defined by the `mapping-validation` capability executes registered SQL, and only as a zero-row probe.
(Previously: "Registered SQL Is Never Executed" — no action ever executed it; now the validate action is the sole, explicitly scoped exception.)

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
(Previously: replaced the SQL text only; did not reset any validation state, since none was persisted yet.)

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
