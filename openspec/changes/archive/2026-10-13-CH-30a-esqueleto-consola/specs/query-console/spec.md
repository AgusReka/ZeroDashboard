# Query Console Specification (CH-30a delta)

## Purpose
The console gets a shell with side navigation and shows one screen at a time by `location.hash`, in the same document (DEC-164, DEC-165); the query result sits right below the execute button.

## ADDED Requirements

### Requirement: Console Shell and Screens
Below the tenant bar, the console document SHALL hold a shell with a side navigation and a main area. The main area SHALL hold the alert banner, always visible, and one `section` per screen: `pantalla-consultas`, `pantalla-automatizaciones` and `pantalla-frescura`, each with a page header naming the screen and its scope ("Del tenant activo"). Every id the console had before this change SHALL appear exactly once, unchanged.

#### Scenario: Every guarded id survives the move
- **WHEN** the console document is served
- **THEN** each guarded id appears exactly once, and the three screen sections and their navigation links exist

### Requirement: Navigation by Hash
The side navigation SHALL link `#consultas`, `#automatizaciones` and `#frescura`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible, Automatizaciones and Frescura are hidden, and the Consultas link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#frescura`
- **THEN** only Frescura is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

### Requirement: Result Next to the Execute Button
Inside the Consultas screen, the status line, the results table and the pager SHALL come right after the query form, before the saved queries.

#### Scenario: Result placement
- **WHEN** the console document is served
- **THEN** the results table appears after the execute button and before the saved queries section, and both are inside the Consultas screen
