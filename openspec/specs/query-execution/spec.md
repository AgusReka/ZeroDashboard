# Query Execution Specification

## Purpose

Executing a single user-authored read-only statement against a registered `Conexion`, enforced at both the application layer (DEC-09) and the database-role layer (DEC-08), returning paginated rows or a sanitized legible failure — never a raw driver error, stack trace, or credential value.

## Requirements

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

### Requirement: Trailing Semicolon Is Stripped Before Wrapping

The system SHALL strip a single trailing semicolon and surrounding whitespace from the submitted statement (plain string trimming, not SQL parsing) before applying the pagination wrapper.

#### Scenario: A query submitted with a trailing semicolon still executes

- **GIVEN** a registered, reachable connection
- **WHEN** a `SELECT` statement ending in `;` is submitted for execution
- **THEN** the statement SHALL execute successfully
- **AND** the response SHALL contain the expected rows

### Requirement: Multi-Statement Text Is Rejected Before Execution

The system SHALL submit the user-authored statement using the driver's extended query protocol (a `values` array), which rejects text containing more than one statement. WHEN the submitted text contains multiple statements, the system SHALL reject the request and SHALL execute none of it.

#### Scenario: Rejecting semicolon-separated multi-statement text

- **GIVEN** a registered, reachable connection
- **WHEN** text containing two statements separated by a semicolon (e.g. `SELECT 1; SELECT 2;`) is submitted for execution
- **THEN** the request SHALL be rejected
- **AND** neither statement SHALL have executed against the target database

### Requirement: Data-Modifying Statements Are Rejected by a Read-Only Transaction

The system SHALL execute every submitted statement inside a `BEGIN TRANSACTION READ ONLY` transaction against the target connection. WHEN the statement attempts to write or perform DDL — including through a data-modifying common table expression that is syntactically a single statement — Postgres SHALL reject it, and the system SHALL surface this as a rejected execution categorized as `no-es-lectura`, with no committed change.

Postgres has two rejection points for such a statement and either SHALL satisfy this requirement: `25006` (`read_only_sql_transaction`) when the write is the direct top-level statement, and `0A000` (`feature_not_supported`) when a data-modifying CTE is refused during parse analysis because the pagination wrapper has demoted it below the top level. The system SHALL map both SQLSTATEs to the same legible category, so the guarantee does not depend on which point fires.

#### Scenario: A data-modifying CTE is rejected and nothing is written

- **GIVEN** a registered, reachable connection to a database containing rows
- **WHEN** a single statement of the form `WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x` is submitted for execution
- **THEN** the request SHALL be rejected with a failure categorized as `no-es-lectura`, derived from SQLSTATE `25006` or `0A000` depending on the engine's rejection point
- **AND** no row in `t` SHALL have been deleted

### Requirement: Execution Is Blocked When the Connected Role Holds Write or CREATE Privilege

Before executing the submitted statement, the system SHALL check the connected role's privileges using `has_table_privilege()` for table-level `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`, and `has_schema_privilege()` for schema-level `CREATE`. WHEN any of these checks indicates the role holds that privilege, the system SHALL refuse to execute the statement and SHALL report a legible reason.

#### Scenario: Blocking a role with table-level write privilege

- **GIVEN** a registered connection whose connected role holds `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` privilege on a table reachable by the query
- **WHEN** a statement is submitted for execution against that connection
- **THEN** the system SHALL refuse to execute the statement before running it
- **AND** the response SHALL state that the connected role holds write privilege

#### Scenario: Blocking a role with schema-level CREATE privilege

- **GIVEN** a registered connection whose connected role holds `CREATE` privilege on the target schema
- **WHEN** a statement is submitted for execution against that connection
- **THEN** the system SHALL refuse to execute the statement before running it
- **AND** the response SHALL state that the connected role holds schema-level `CREATE` privilege

### Requirement: Legible Syntax Error Reporting

WHEN the submitted statement is syntactically invalid, the system SHALL return a legible, sanitized error summary and MUST NOT return a raw driver error object or stack trace.

#### Scenario: Submitting a syntactically invalid query

- **GIVEN** a registered, reachable connection
- **WHEN** a syntactically invalid statement is submitted for execution
- **THEN** the response SHALL report a legible failure
- **AND** the response body SHALL NOT contain a raw driver error object or a stack trace

### Requirement: Credential Value Never Exposed During Execution

The system MUST NOT include the stored credential value of the target `Conexion` in any execution response body, error message, or log line, regardless of the execution outcome.

#### Scenario: A failed execution does not leak the credential

- **GIVEN** a registered connection whose execution attempt fails (for any reason)
- **WHEN** the failure response and any log line produced during the attempt are inspected
- **THEN** neither SHALL contain the stored credential value

#### Scenario: A successful execution does not leak the credential

- **GIVEN** a registered connection whose execution attempt succeeds
- **WHEN** the success response and any log line produced during the attempt are inspected
- **THEN** neither SHALL contain the stored credential value

### Requirement: Bounded Execution Timeout

The system SHALL bound the runtime of each query execution attempt to a fixed maximum duration, distinct from the connection-attempt timeout established for connectivity testing. WHEN the statement does not complete within that duration, the system SHALL abort it and report a timeout failure instead of waiting indefinitely.

#### Scenario: A long-running query is cut off

- **GIVEN** a registered, reachable connection
- **WHEN** a submitted statement runs longer than the bounded execution timeout
- **THEN** the execution SHALL be aborted at or before that timeout
- **AND** the response SHALL report a timeout failure
### Requirement: Connection Lookup for Execution Is Scoped to the Active Tenant

Before executing a submitted statement, the system SHALL resolve the target `Conexion` only among rows belonging to the request's active tenant. WHEN the named `conexionId` belongs to a different tenant, or does not exist, the system SHALL respond as though it does not exist and SHALL NOT execute any statement against it.

#### Scenario: Executing against another tenant's connection

- **GIVEN** tenants A and B, and a `Conexion` belonging to B
- **WHEN** A's active tenant submits an execution request naming B's `conexionId`
- **THEN** the response SHALL report the connection as not found
- **AND** no statement SHALL execute against B's target database

#### Scenario: Executing against the active tenant's own connection is unaffected

- **GIVEN** a registered, reachable `Conexion` belonging to the active tenant
- **WHEN** a valid `SELECT` statement is submitted naming that `conexionId`
- **THEN** execution SHALL proceed exactly as before this change (CH-04/CH-05 behavior preserved for a single active tenant)
### Requirement: Row Cap Sourced From Global Configuration, Reported as a Distinct Cutoff Verdict

The system SHALL bound the number of rows an execution can return by a maximum row cap sourced from a global environment-variable default, applied uniformly across every `Conexion` and every tenant (DEC-19). WHEN an execution is stopped by this cap — as opposed to simply completing within the caller's requested page size — the system SHALL report a distinct cutoff verdict (e.g. `tope-de-filas`) in the response. This verdict SHALL be reported separately from, and SHALL NOT be conflated with, the `hayMas` pagination signal: `hayMas` invites requesting a further page, while the row-cap verdict states that no further page will be served.

#### Scenario: Execution stays within the row cap

- **GIVEN** a registered, reachable connection and a query whose result set is smaller than the configured row cap
- **WHEN** the statement is executed
- **THEN** the response SHALL report rows and pagination as before this change, with no row-cap verdict present

#### Scenario: Execution is stopped by the row cap

- **GIVEN** a registered, reachable connection and a query whose result set exceeds the configured row cap
- **WHEN** the statement is executed
- **THEN** the response SHALL report the distinct row-cap cutoff verdict
- **AND** the response SHALL NOT use `hayMas` to signal this cutoff

#### Scenario: Row cap is configurable without a source change

- **GIVEN** the row-cap environment variable is set to a different value than its default
- **WHEN** an execution's result set exceeds that configured value
- **THEN** the row-cap cutoff SHALL apply at the newly configured value, with no source code change required
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
### Requirement: A Session Over an Injected Channel Keeps Every Execution Guarantee

WHEN a connection is established over an injected channel (`agent-channel`), `ejecutarConsulta` SHALL behave exactly as over a direct dial: the `BEGIN TRANSACTION READ ONLY` transaction, the DEC-08 privilege check, the single-statement rule, the row cap, the execution timeout and the tenant-scoped lookup SHALL apply unchanged. The channel MUST NOT add, remove, or relax any check, and MUST NOT change the response shape or expose the credential value.

#### Scenario: Rows are returned over a channel

- GIVEN a reachable database and an in-memory channel relaying bytes to it
- WHEN a valid `SELECT` is executed with a page and page size
- THEN the response SHALL contain the requested page of rows

#### Scenario: A write-privileged role is still blocked

- GIVEN a channel to a database whose connected role holds write or `CREATE` privilege
- WHEN a statement is executed
- THEN execution SHALL be refused before the statement runs, stating the role holds write privilege

#### Scenario: A data-modifying statement is still rejected

- GIVEN a channel to a database containing rows
- WHEN a data-modifying CTE is submitted
- THEN it SHALL be rejected as `no-es-lectura` and no row SHALL change

#### Scenario: Multi-statement text is still rejected over a channel

- GIVEN a channel to a reachable database
- WHEN `SELECT 1; SELECT 2;` is submitted
- THEN the request SHALL be rejected and neither statement SHALL execute

#### Scenario: Absent channel preserves prior behavior

- GIVEN an execution without a channel
- WHEN it runs
- THEN the outcome SHALL be identical to behavior before this change
