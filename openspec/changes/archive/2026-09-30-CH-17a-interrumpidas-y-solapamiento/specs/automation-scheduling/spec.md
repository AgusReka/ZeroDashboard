# Delta for Automation Scheduling

## ADDED Requirements

### Requirement: Overlap Check Before Creating a Run (X4, DEC-96)

Before creating an `Ejecucion` for an automation, the scheduler SHALL look up, through the tenant-scoped client, an `en-curso` row of the same automation. WHEN one exists, the scheduler SHALL NOT run the automation and SHALL write one `omitida`/`solapamiento` row (per `execution-log`) for that tick. It MUST NOT compose, execute, or notify for the skipped run.

#### Scenario: A stuck automation is skipped and recorded

- GIVEN a due automation with an `en-curso` row
- WHEN the scheduler ticks
- THEN no query SHALL execute against the tenant's connection and the notifier SHALL NOT be called
- AND one `omitida`/`solapamiento` row SHALL persist

#### Scenario: Overlap is per automation

- GIVEN two due automations of one tenant, only one of them with an `en-curso` row
- WHEN the scheduler ticks
- THEN the stuck one SHALL be skipped and recorded
- AND the other SHALL run normally

#### Scenario: Another tenant's en-curso row does not block

- GIVEN tenant B has an `en-curso` row and tenant A has a due automation with none
- WHEN the scheduler ticks
- THEN A's automation SHALL run

#### Scenario: Overlap lookup failure does not stop the tick

- GIVEN the overlap lookup throws for one automation
- WHEN the scheduler ticks
- THEN the error SHALL be caught per run and the remaining due automations SHALL still be evaluated

### Requirement: Boot Sweep Runs Before the First Tick (X7, DEC-99)

On start, and before the first tick is scheduled, the scheduler SHALL close every `en-curso` `Ejecucion` row of every tenant as defined by `execution-log` (`fallo`/`interrumpida`). The sweep SHALL be fail-open: WHEN it fails, the error SHALL be logged and the service SHALL start and schedule ticks anyway. Interrupted runs MUST NOT be re-executed. There is no per-tick reaper.

#### Scenario: Sweep completes before ticking

- GIVEN `en-curso` rows left by a previous process, including one of a due automation
- WHEN the scheduler starts
- THEN the sweep SHALL finish before the first tick evaluates anything
- AND no `en-curso` row SHALL remain

#### Scenario: Sweep failure does not block startup

- GIVEN the sweep throws
- WHEN the scheduler starts
- THEN the error SHALL be logged and ticks SHALL still be scheduled

#### Scenario: Interrupted runs are not re-executed

- GIVEN a swept row of a due automation
- WHEN the sweep completes
- THEN no query SHALL execute because of the swept row, and no new run SHALL be created by the sweep

#### Scenario: A row stuck in a live process is not reaped

- GIVEN a row that becomes `en-curso` after the boot sweep finished
- WHEN later ticks run
- THEN the row SHALL stay `en-curso` and the automation SHALL be skipped as `omitida` until the next boot

### Requirement: Signals Close the Application Gracefully (DEC-100)

The process SHALL handle `SIGTERM` and `SIGINT` by closing the application, which awaits the scheduler's `detener()`. Signal registration MUST be testable without terminating the test process.

#### Scenario: A signal triggers an orderly close

- GIVEN the signal handlers are registered for an application
- WHEN `SIGTERM` or `SIGINT` is delivered
- THEN `app.close()` SHALL be invoked and the scheduler SHALL be stopped via `detener()`

### Requirement: Missed Fires Are Not Recovered — Documented Artifact Limit (DEC-95)

The scheduler SHALL NOT catch up fires missed during downtime or a long run, and SHALL NOT record marks for coalesced fires. This SHALL be documented as a limit of the artifact, and code comments MUST NOT attribute catch-up to CH-17.

#### Scenario: Downtime leaves no catch-up

- GIVEN the service was stopped across a due fire time
- WHEN it restarts and ticks
- THEN the missed fire SHALL NOT run and no row SHALL record it

### Requirement: Single-Instance Assumption (DEC-75, DEC-99)

The sweep and overlap behavior assume exactly one running instance. Multi-instance safety is out of scope and MUST be documented as such.

#### Scenario: Limit is documented

- GIVEN the change documentation (bitacora)
- WHEN it is read
- THEN it SHALL state the single-instance assumption and that a second instance's sweep would close live runs
