# Delta for Email Notification

## Purpose Wording (applied at archive)

The Purpose sentence "Retries, duplicate suppression, ... are out of scope (CH-17, CH-18, CH-21; ...)" SHALL become: "A run sends at most one message (X6, DEC-107). Retries of the send (DEC-97), content or cooldown duplicate suppression, \"send when empty\", per-template HTML, and multi-section reports are out of scope (documented artifact limits, rule 6)."

## ADDED Requirements

### Requirement: A Run Sends at Most One Message (X6, DEC-107)

One run SHALL call the notifier at most once. This MUST hold across a connection retry (DEC-97/98), an overlap skip, the boot sweep, and `detener()`. "Same event" means one run: two consecutive runs with identical rows MAY each send (documented limit).

#### Scenario: Retried connection sends once

- GIVEN a policy of 3 attempts, a connection failing once then succeeding, rows, a recipient, and SMTP configured
- WHEN the run completes
- THEN the notifier SHALL have been called exactly once

#### Scenario: Overlap skip never sends

- GIVEN an automation with an `en-curso` row and a due tick
- WHEN the scheduler ticks
- THEN the notifier SHALL NOT be called

#### Scenario: Sweep never sends

- GIVEN an `en-curso` row left by a previous process
- WHEN the boot sweep runs
- THEN the notifier SHALL NOT be called and the run SHALL NOT be re-executed

#### Scenario: Stopping during a send causes no second send

- GIVEN a run whose send is in flight
- WHEN `detener()` is called
- THEN the notifier SHALL have been called exactly once for that run

### Requirement: A Marker Is Written Before the Send (X6, DEC-108)

Immediately before calling the notifier, and only on the path that reaches the send, the run SHALL set `notificacion='enviando'` on its `en-curso` row through the tenant-scoped client. The marker MUST NOT be written when no send is attempted. The close path overwrites it with the outcome of the precedence table.

#### Scenario: Marker is visible while the send is pending

- GIVEN a run with rows, a recipient, SMTP configured, and a notifier that has not resolved
- WHEN the row is read
- THEN it SHALL be `en-curso` with `notificacion='enviando'`

#### Scenario: No marker when no send happens

- GIVEN a run with zero rows, a null recipient, or SMTP unset
- WHEN the run closes
- THEN the row SHALL never have carried `enviando` and the notifier SHALL NOT be called

## MODIFIED Requirements

### Requirement: Send Is Bounded by a Configured Timeout

The transport SHALL bound every send attempt by a configured timeout, so that an unresponsive SMTP server cannot block the sequential tick indefinitely. A send exceeding the timeout SHALL be treated as a send failure (`fallo-envio`). Because the server may already have accepted the message, the system MUST NOT retry it and MUST NOT state that the message was not delivered.
(Previously: no statement that a timed-out message may have been delivered.)

#### Scenario: Unresponsive SMTP server

- GIVEN a transport whose server never answers
- WHEN a send is attempted
- THEN the attempt SHALL end no later than the configured timeout
- AND the run SHALL record `fallo-envio`

#### Scenario: Timed-out send is not repeated

- GIVEN a send that ends by timeout
- WHEN the run closes
- THEN the notifier SHALL have been called exactly once
