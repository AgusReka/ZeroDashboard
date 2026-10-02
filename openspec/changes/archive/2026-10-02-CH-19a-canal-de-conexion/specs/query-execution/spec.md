# Delta for Query Execution

## ADDED Requirements

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
