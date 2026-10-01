# Delta for Execution Log

## ADDED Requirements

### Requirement: Ejecucion Records the Connection Attempts Made (DEC-98, DEC-103)

`Ejecucion` SHALL have a nullable integer `intentos` added by an additive migration. It SHALL equal the number of real connection attempts the run made: 1 when the run connected or failed on its first attempt (even with retry disabled), N after N attempts. It MUST be null WHEN the run never attempted to connect (`omitida`, `interrumpida`, and rejections before connection such as a validation-gate refusal) and for rows written before the migration. Null MUST NOT mean a single attempt. A retried run SHALL still write exactly one row.

#### Scenario: First-try success and failure with retry off

- GIVEN the default no-retry policy
- WHEN one run connects and succeeds, and another fails to connect
- THEN each row SHALL have `intentos=1`

#### Scenario: Retried run counts attempts

- GIVEN a policy of 3 attempts and a run that connects on the third attempt
- WHEN it completes
- THEN one row SHALL persist with `estado='ok'` and `intentos=3`

#### Scenario: Runs that never dialled have null intentos

- GIVEN an `omitida` row, a swept `interrumpida` row, and a gate-refusal row
- WHEN their rows are inspected
- THEN `intentos` SHALL be null for each

#### Scenario: Legacy rows read as null

- GIVEN a row written before the migration
- WHEN it is listed
- THEN `intentos` SHALL be null

#### Scenario: Non-retryable failure after connecting

- GIVEN a policy of 3 attempts, a connection that succeeds, and a query failing with a syntax error
- WHEN the run completes
- THEN the row SHALL be `fallo` with `intentos=1`

### Requirement: Runs Listing Exposes intentos (DEC-80, DEC-103)

`GET /automatizaciones/:id/ejecuciones` SHALL include each run's `intentos` (an integer or null), remaining scoped to the active tenant's automation.

#### Scenario: Listing shows intentos

- GIVEN an automation of the active tenant with a run of `intentos=2` and a legacy run
- WHEN its runs are listed
- THEN the entries SHALL include `intentos` 2 and null respectively

### Requirement: Exhausted Cap Closes the Run With the Last Category (DEC-98)

WHEN the attempt cap is exhausted, the single row SHALL close `estado='fallo'` with `fase='conexion'` and `error` set to the last attempt's classified category, never an earlier attempt's category; `notificacion` SHALL be null.

#### Scenario: Last category wins

- GIVEN attempts failing with `host-inalcanzable`, then `host-inalcanzable`, then `tiempo-agotado`
- WHEN the cap of 3 is reached
- THEN the row SHALL carry `error='tiempo-agotado'` and `intentos=3`
