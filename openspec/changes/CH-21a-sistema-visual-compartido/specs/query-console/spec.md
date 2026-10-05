# Delta for Query Console

## ADDED Requirements

### Requirement: Console Markup Ids Are Guarded

A test MUST assert that the served console page keeps every identifier the inline script depends on: the existing `IDS` list plus `barra-tenant`, `resultados`, `guardado`, `automatizaciones`; `banner` keeps its `role` and `hidden` attributes; `limite` keeps `min="1"` and has no `max`. Each id MUST appear exactly once.

#### Scenario: All ids present once

- GIVEN the served console page
- WHEN the guard test scans the markup
- THEN every guarded id occurs exactly once

#### Scenario: A renamed id fails the guard

- GIVEN markup in which one guarded id is renamed or duplicated
- WHEN the guard test runs
- THEN it fails naming the id

#### Scenario: Limit attributes preserved

- GIVEN the served console page
- WHEN the `limite` input is inspected
- THEN it has `min="1"` and no `max` attribute

## MODIFIED Requirements

### Requirement: Console Page Is Servable

The system SHALL serve a console page, reachable by a request, that presents a SQL input control and a way to trigger execution of the entered statement against a registered connection. The page MUST link the shared stylesheet `/ui/styles.css` and MUST NOT carry the former inline `<style>` block of the full console styling; any residual console-specific stylesheet location is a design-level concern. The page MUST keep every existing element id, its inline script MUST be byte-identical to the script before this change, the page MUST contain exactly one closing script tag, and neither the page nor its script MUST contain a backtick character. The exact markup is otherwise a design-level concern.
(Previously: only required that the page exists and is servable; styling was an inline `<style>`.)

#### Scenario: Requesting the console page

- **GIVEN** the application is running
- **WHEN** a request for the console page is made
- **THEN** the response SHALL be a page containing a SQL input control
- **AND** the page SHALL provide a way to trigger execution of the entered statement

#### Scenario: Page links the shared stylesheet

- **GIVEN** the application is running
- **WHEN** the console page is requested
- **THEN** it SHALL contain a `<link rel="stylesheet" href="/ui/styles.css">`
- **AND** it SHALL NOT contain the former inline full-console `<style>` rules

#### Scenario: Inline script is unchanged

- **GIVEN** the inline script as it existed before this change
- **WHEN** the served page's script is compared with it
- **THEN** they SHALL be byte-identical
- **AND** the page SHALL contain exactly one closing script tag and no backtick

### Requirement: Row-Cap Cutoff Is Surfaced Legibly

WHEN an execution response reports the row-cap cutoff verdict (per `query-execution`), the console SHALL display a legible message stating that the result was capped at the configured row limit, and this message SHALL be visually and textually distinguishable from the "load more" control the console shows when `hayMas` indicates further pages are available. The distinction MUST survive the shared stylesheet: the cutoff message and the "load more" control MUST NOT share one visual treatment.
(Previously: the distinction was required but not stated against the shared visual system.)

#### Scenario: Viewing a capped result

- **GIVEN** the console page is loaded and a statement is submitted whose execution is stopped by the row cap
- **WHEN** the response is received by the console
- **THEN** the console SHALL display a legible message stating the result was capped at the configured limit
- **AND** the console SHALL NOT present a "load more" control for that response

#### Scenario: A capped result is not mistaken for a partial page

- **GIVEN** the console page is loaded and a statement's execution returns the row-cap cutoff verdict
- **WHEN** the result is rendered
- **THEN** the cutoff message SHALL be distinguishable on screen from the ordinary pagination control used for `hayMas`

#### Scenario: Distinct styling after the restyle

- **GIVEN** the console styled by the shared stylesheet and its bridge rules
- **WHEN** the cutoff message and the pagination control are each rendered
- **THEN** their style classes SHALL differ and the cutoff message SHALL remain visible with its text intact

### Requirement: Permanent Active-Tenant Indicator (T4)

The console SHALL display, at all times and without ambiguity, which tenant it is currently operating against. The no-active-tenant state MUST remain visually distinct from the active state and MUST still state in text that no tenant is selected.
(Previously: no requirement on the no-tenant state surviving restyling.)

#### Scenario: Indicator is always visible

- GIVEN the console page is loaded with an active tenant selected
- WHEN any part of the console is viewed
- THEN the active tenant SHALL be identifiable on screen without further action

#### Scenario: No-tenant state stays distinct

- GIVEN the console page is loaded with no active tenant
- WHEN the tenant bar is rendered with the shared stylesheet
- THEN it SHALL carry text stating no tenant is selected
- AND its style SHALL differ from the active-tenant state

## Resolved in design

- Console bridge CSS: a reduced inline `<style>` in `src/consola.ts` (a sixth file in `public/ui/` would break DEC-124 A2 and A3).
- Cache policy: `Cache-Control: no-cache` plus an ETag computed at boot (see the `shared-visual-system` Response Headers requirement).
- Unmatched `GET` paths: all give `400 tenant-no-indicado` (DEC-124 accepts this instead of 404).
- The registrar list and the exemption rows share one exported constant; a missing file stops boot (see `design.md`).
