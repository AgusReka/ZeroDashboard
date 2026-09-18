# Delta for Query Execution

## ADDED Requirements

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
