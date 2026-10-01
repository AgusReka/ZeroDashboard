# Delta for Automation Scheduling

## ADDED Requirements

### Requirement: Retry Applies Only to Transient Connection Failures (X5, DEC-97)

A run SHALL be retried only WHEN an attempt fails with `fase='conexion'` and category `host-inalcanzable`, `dns-no-resuelve`, or `tiempo-agotado`. Every other failure MUST end the run after the attempt that produced it: invalid credentials, nonexistent database, permissions, preparation, syntax, data, `no-es-lectura`, query-phase `tiempo-agotado`, `error-desconocido`, `error-interno`, and any `fase='notificacion'` failure. The notification step MUST NOT be retried and `email-notification` is unchanged (exactly one send attempt).

#### Scenario: Transient connection failure is retried

- GIVEN a retry policy of 3 attempts and a connection failing with `host-inalcanzable`, `dns-no-resuelve`, or `tiempo-agotado` (connection phase)
- WHEN the run executes
- THEN a further attempt SHALL be made after the pause

#### Scenario: Non-retryable failures make exactly one attempt

- GIVEN a retry policy of 3 attempts and a failure in any non-retryable category above
- WHEN the run executes
- THEN exactly one connection attempt SHALL be made and no pause SHALL be scheduled

#### Scenario: Query-phase timeout is not retried

- GIVEN a connection that succeeds and a query failing with `tiempo-agotado` in the execution phase
- WHEN the run executes
- THEN the query SHALL run once and the run SHALL close `fallo`

#### Scenario: Notification failure is not retried

- GIVEN a run whose query succeeds and whose send fails
- WHEN the run executes
- THEN the notifier SHALL be called exactly once and no connection attempt SHALL be repeated

### Requirement: Bounded In-Run Retry Loop With Fixed Pause (X5, DEC-98)

The retry SHALL happen inside the single run: one `Ejecucion` row is created before the first attempt and closed once after the last. Attempts SHALL be capped by the injected policy's total attempts, separated by the policy's fixed pause, scheduled only through the injected `Reloj`. The default policy SHALL be "no retry" (one attempt). WHEN the cap is exhausted, the run SHALL close `estado='fallo'` with `fase='conexion'` and the category of the last attempt.

#### Scenario: Transient failure then success

- GIVEN a policy of 3 attempts and a connection failing once with `host-inalcanzable`, then succeeding
- WHEN the run executes and the fake `Reloj` fires the pause
- THEN exactly one `Ejecucion` row SHALL persist with `estado='ok'` and `intentos=2`

#### Scenario: Cap exhausted

- GIVEN a policy of 3 attempts and a connection failing every attempt, the last with `tiempo-agotado`
- WHEN the run executes with the pause fired twice
- THEN one row SHALL persist with `estado='fallo'`, `error='tiempo-agotado'`, `intentos=3`
- AND no fourth attempt SHALL be made

#### Scenario: Pause is fixed and clock-driven

- GIVEN a policy with a 5000 ms pause and a failed first attempt
- WHEN the first attempt fails
- THEN exactly one timer of 5000 ms SHALL be requested from the fake `Reloj` and no second attempt SHALL start before it fires

#### Scenario: Default policy performs no retry

- GIVEN a scheduler built without a retry policy and a connection failing with `host-inalcanzable`
- WHEN the run executes
- THEN one attempt SHALL be made, no timer SHALL be requested, and the row SHALL be `fallo` with `intentos=1`

### Requirement: Overlap Guard Covers a Run Mid-Retry (X4, X5)

The row SHALL stay `en-curso` across attempts and pauses, so the overlap check (DEC-96) MUST treat a run in pause or retry as running.

#### Scenario: Tick during a pause is skipped

- GIVEN a run of an automation waiting in a retry pause
- WHEN a later tick finds that automation due
- THEN no connection attempt SHALL start and one `omitida`/`solapamiento` row SHALL persist

### Requirement: Stopping the Scheduler Cancels a Pending Retry Pause (DEC-104)

`detener()` SHALL cancel any pending retry pause, make no further attempt, and close the row `fallo` with the last attempt's category and the `intentos` reached, so shutdown does not wait for remaining retries.

#### Scenario: Stop during a pause

- GIVEN a run waiting in a pause after its second failed attempt (category `tiempo-agotado`)
- WHEN `detener()` is called
- THEN the pending timer SHALL be cancelled and `detener()` SHALL resolve without further attempts
- AND the row SHALL be `fallo`, `error='tiempo-agotado'`, `intentos=2`, not `en-curso`

#### Scenario: Stop with no run in a pause

- GIVEN no run is in a pause
- WHEN `detener()` is called
- THEN behavior SHALL be unchanged from CH-17a
