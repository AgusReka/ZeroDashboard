# Client Panel Automations Specification (CH-48 delta)

## MODIFIED Requirements

### Requirement: No Technical Terms in the Client Surface (Rule 1, DEC-04, DEC-93)

No string shown to the client by this feature SHALL contain a term the panel glossary replaces (`lenguaje.md`): `tenant`, `cron`, `SQL`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout`, `plantilla`, nor identifiers, codes or table names. This covers the copy map, the fallback, the frequency texts, the last-run texts, and the page's static HTML and script string literals, including the dashboard section's (`client-panel-dashboard`). Stored execution results or rows SHALL NOT be shown (DEC-93): no automation shows its last result. The only rows the panel shows are the dashboard's live, projected results, which are never stored (DEC-183, `client-panel-dashboard`).
(Previously: execution results or rows were not shown at all; the panel had no dashboard.)

#### Scenario: Copy and page contain no glossary-forbidden term

- **GIVEN** every copy map value, the fallback, every frequency text and the served authenticated page's visible text and script string literals
- **WHEN** they are scanned case-insensitively for the forbidden terms
- **THEN** none SHALL be found

#### Scenario: Automations never show a stored result

- **GIVEN** an automation with finished runs
- **WHEN** its card is rendered
- **THEN** it SHALL show the last run's date and business text only, and no returned row
