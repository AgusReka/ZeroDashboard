# Delta for Query Console

## ADDED Requirements

### Requirement: Row-Cap Cutoff Is Surfaced Legibly

WHEN an execution response reports the row-cap cutoff verdict (per `query-execution`), the console SHALL display a legible message stating that the result was capped at the configured row limit, and this message SHALL be visually and textually distinguishable from the "load more" control the console shows when `hayMas` indicates further pages are available.

#### Scenario: Viewing a capped result

- **GIVEN** the console page is loaded and a statement is submitted whose execution is stopped by the row cap
- **WHEN** the response is received by the console
- **THEN** the console SHALL display a legible message stating the result was capped at the configured limit
- **AND** the console SHALL NOT present a "load more" control for that response

#### Scenario: A capped result is not mistaken for a partial page

- **GIVEN** the console page is loaded and a statement's execution returns the row-cap cutoff verdict
- **WHEN** the result is rendered
- **THEN** the cutoff message SHALL be distinguishable on screen from the ordinary pagination control used for `hayMas`
