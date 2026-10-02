# Delta for Automation Scheduling

## Purpose Wording (applied at archive)

The Purpose sentence "Instantiation UX, editing, overlaps, retries, and cross-tenant failure isolation are out of scope (CH-17, CH-18, CH-21)" SHALL become: "Instantiation UX and editing are out of scope (CH-21). Retries (CH-17b), overlap handling (CH-17a), and per-tenant error isolation within a serial tick (CH-18) are covered. Per-tenant lanes, concurrency, and circuit breakers are documented artifact limits (rule 6, DEC-110)."

## RENAMED Requirements

### Requirement: A Run's Failure Does Not Stop the Tick for Other Automations (Not CH-18 Isolation) → A Failure Does Not Stop the Tick for Other Automations or Tenants (X8, DEC-109)

(Reason: the old name disclaimed CH-18; this change delivers per-tenant isolation.)
(Migration: tests and docs referencing the old title SHALL use the new one.)

## MODIFIED Requirements

### Requirement: A Failure Does Not Stop the Tick for Other Automations or Tenants (X8, DEC-109)

The scheduler SHALL catch any error raised by one automation's run and continue evaluating the remaining due automations in the same tick. It SHALL also catch any error raised while processing one tenant (including one thrown outside a run) and continue with the remaining tenants in the same tick. A tenant-level failure SHALL be written to the log using closed fields only (the tenant identifier from the own-database `Tenant` row and a classified error name) and MUST NOT include raw error text, stack trace, connection data, credentials, SMTP settings, or a recipient address. A tenant-level failure writes no `Ejecucion` row, and the failed tenant's window for that tick is not recovered (DEC-95).
(Previously: per-run catch only, explicitly not the cross-tenant isolation of CH-18.)

#### Scenario: One failing run does not block a sibling run

- GIVEN two due active automations in the same tick, one of which will fail
- WHEN the scheduler ticks
- THEN the failing automation SHALL be recorded as failed
- AND the other automation SHALL still run to completion

#### Scenario: A tenant-level throw does not stop later tenants

- GIVEN tenants A, B, and C in order, each with a due automation, and processing of B throws outside any run
- WHEN the scheduler ticks
- THEN A's and C's automations SHALL still run to completion
- AND the tick SHALL complete and the next tick SHALL be scheduled

#### Scenario: Tenant failure log carries closed fields only

- GIVEN a tenant-level failure whose error message contains a connection string and a recipient address
- WHEN every log line of the tick is inspected
- THEN none SHALL contain that text, a stack trace, credentials, or the recipient
- AND the failed tenant's identifier SHALL appear

#### Scenario: The failed tenant's window is not recovered

- GIVEN tenant B failed in tick N and recovers before tick N+1
- WHEN tick N+1 runs
- THEN fires of B that fell inside tick N's window SHALL NOT run and no row SHALL record them

## ADDED Requirements

### Requirement: The Tick Stays Serial (DEC-110)

The scheduler SHALL process tenants one at a time within a tick, and the next tick SHALL NOT start before the previous tick finishes. This change MUST NOT add per-tenant lanes, concurrency limits, independent loops, or a circuit breaker; a dead connection continues to delay later tenants up to the bound of DEC-98 (documented artifact limit, rule 6).

#### Scenario: Tenants never run concurrently

- GIVEN two tenants with due automations, the first blocked on a deferred query
- WHEN the scheduler ticks
- THEN the second tenant's automation SHALL NOT start until the first completes

### Requirement: A Dead Agent Connection Must Not Terminate the Process (DEC-111, conditional)

This requirement applies ONLY IF an automated test (a socket-destroying forwarder) proves that a connection dying after login terminates the process. WHEN proven, the agent connection SHALL handle connection-level errors so the process keeps running and the run fails with its existing classified category. WHEN the test refutes the crash, nothing SHALL be added and this requirement is void.

#### Scenario: Connection dies after login (only if the crash is proven)

- GIVEN an established agent connection whose socket is destroyed mid-session
- WHEN the error is emitted
- THEN the process SHALL stay alive and the run SHALL close `fallo` with a classified category

## Not Changed

`tenant-isolation` needs tests only, no spec change: tenant context entry, closed-field logs, and recipient derivation already hold; isolation tests assert them across a tenant failure.
