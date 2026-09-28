# Delta for Query Execution

## MODIFIED Requirements

### Requirement: Paginated Execution of a Read-Only Statement

The system SHALL execute a single user-authored `SELECT` statement against a registered `Conexion` by first applying the `query-parameters` rewrite (declared `:nombre` markers to `$1..$n`), then wrapping the rewritten text as `SELECT * FROM (<query>) AS _consulta_usuario LIMIT $(n+1) OFFSET $(n+2)` (DEC-53), and SHALL return the resulting rows together with pagination information (page/pageSize or an equivalent limit/offset pair). WHEN the statement declares no parameters, `n` SHALL be `0` and the wrapper SHALL bind `LIMIT $1 OFFSET $2` exactly as before this change.
(Previously: the wrapper always used a fixed `LIMIT $1 OFFSET $2`, with no declared-parameter concept.)

#### Scenario: Executing a SELECT against a reachable, correctly-privileged connection

- **GIVEN** a registered `Conexion` that is reachable and whose connected role holds no write or schema-`CREATE` privilege
- **WHEN** a valid `SELECT` statement is submitted for execution with a page and page size
- **THEN** the response SHALL contain the requested page of rows
- **AND** the response SHALL indicate how to request further pages

#### Scenario: Zero-parameter query is byte-identical to prior behavior

- **GIVEN** a registered, reachable connection and a `SELECT` statement declaring no parameters
- **WHEN** the statement is executed with a page and page size
- **THEN** the final wrapped SQL text and bind positions SHALL be identical to this change's predecessor (`LIMIT $1 OFFSET $2`)
- **AND** the response SHALL be unaffected by this change

#### Scenario: Declared parameters bind before pagination's own binds

- **GIVEN** a statement declaring two parameters and a page request
- **WHEN** the statement executes
- **THEN** the declared parameters SHALL bind at `$1` and `$2`
- **AND** the pagination wrapper SHALL bind `LIMIT` at `$3` and `OFFSET` at `$4`

## ADDED Requirements

### Requirement: Inline Parameter Declaration and Values on Ad Hoc Execution

`POST /consultas/ejecutar` SHALL accept an optional inline parameter declaration and a value map alongside `sql`, validated by `query-parameters` before execution, and SHALL NOT persist the declaration or values (DEC-48).

#### Scenario: Ad hoc execution with inline parameters

- GIVEN a request body with `sql` containing `:desde`, an inline declaration for `desde`, and a matching value
- WHEN the request is submitted
- THEN the statement SHALL execute with the value bound only as a driver parameter
- AND neither the declaration nor the value SHALL be persisted

### Requirement: Parameter Validation Errors Are Reported Before Execution

WHEN `query-parameters` validation rejects a request (unused declaration, undeclared marker, undeclared value, hand-written `$n`, or a value shape mismatch), the system SHALL respond `400` naming the offending parameter and SHALL execute no statement against the target connection.

#### Scenario: Validation failure executes nothing

- GIVEN a request whose parameter validation fails for any of the reasons above
- WHEN the request is submitted
- THEN the response SHALL be `400` naming the parameter
- AND no statement SHALL have executed against the target database

### Requirement: Connection Lookup Remains Tenant-Scoped With Parameters Present

The tenant-scoped `Conexion` lookup (existing requirement) applies unchanged when the request carries declared parameters and values: the parameter mechanism SHALL NOT introduce any path that resolves a `Conexion` outside the request's active tenant.

#### Scenario: Parametrized execution against another tenant's connection

- **GIVEN** tenants A and B, and a `Conexion` belonging to B
- **WHEN** A's active tenant submits a parametrized execution request naming B's `conexionId`
- **THEN** the response SHALL report the connection as not found
- **AND** no statement SHALL execute against B's target database
