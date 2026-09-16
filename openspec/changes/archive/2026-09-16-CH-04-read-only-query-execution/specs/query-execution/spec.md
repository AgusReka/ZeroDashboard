# Query Execution Specification

## Purpose

Executing a single user-authored read-only statement against a registered `Conexion`, enforced at both the application layer (DEC-09) and the database-role layer (DEC-08), returning paginated rows or a sanitized legible failure — never a raw driver error, stack trace, or credential value.

## Requirements

### Requirement: Paginated Execution of a Read-Only Statement

The system SHALL execute a single user-authored `SELECT` statement against a registered `Conexion` by wrapping it as `SELECT * FROM (<query>) AS sub LIMIT $1 OFFSET $2` with driver parameters, and SHALL return the resulting rows together with pagination information (page/pageSize or an equivalent limit/offset pair).

#### Scenario: Executing a SELECT against a reachable, correctly-privileged connection

- **GIVEN** a registered `Conexion` that is reachable and whose connected role holds no write or schema-`CREATE` privilege
- **WHEN** a valid `SELECT` statement is submitted for execution with a page and page size
- **THEN** the response SHALL contain the requested page of rows
- **AND** the response SHALL indicate how to request further pages

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
