# Delta for Query Console

## ADDED Requirements

### Requirement: Per-Parameter Input Rendering

WHEN the statement currently in the editor declares parameters (inline, or loaded from a saved query's `parametros`), the console SHALL render one input control per declared parameter, labeled with its `nombre`, using an input appropriate to its `tipo` (`texto`, `numero`, `booleano`, `fecha`), and SHALL submit the collected values as a name→value map alongside the execution request. Saving submits the declaration only, never values (DEC-48).

#### Scenario: Rendering inputs for a declared parameter

- GIVEN the editor contains SQL with `:desde` and a declaration for `desde` as `fecha`
- WHEN the console detects the declaration
- THEN it SHALL render one input labeled `desde` appropriate for a date value

#### Scenario: Submitting collected parameter values

- GIVEN the console renders inputs for two declared parameters with values entered
- WHEN the execution control is used
- THEN the console SHALL submit a name→value map with both entered values alongside the execution request

### Requirement: Saving and Loading the Parameter Declaration With a Query

The console SHALL submit the current parameter declaration together with `sql` and `nombre` when saving a query, and SHALL render the saved declaration's inputs when a saved query is loaded into the editor (per `saved-queries`' `parametros`).

#### Scenario: Declaration saved with the query

- GIVEN the editor holds SQL with declared parameters
- WHEN the save control is used
- THEN the console SHALL submit the declaration in the create request's `parametros`

#### Scenario: Declaration loaded with the query

- GIVEN a saved query with a non-empty `parametros` is loaded into the editor
- WHEN the load completes
- THEN the console SHALL render one input per entry in the loaded `parametros`

### Requirement: Parameter Validation Error Surfaced Legibly

WHEN an execution or save request fails because of a parameter validation error (per `query-parameters` / `query-execution`), the console SHALL display a legible error naming the offending parameter, consistent with the existing legible-error requirement, and MUST NOT display a raw driver error or stack trace.

#### Scenario: A parameter error is shown legibly

- GIVEN a parametrized statement is submitted with a value that fails shape validation
- WHEN the `400` response is received
- THEN the console SHALL display a legible message naming the offending parameter
- AND the console SHALL NOT display a raw driver error object or a stack trace
