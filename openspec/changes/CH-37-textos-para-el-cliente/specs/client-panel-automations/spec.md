# Client Panel Automations Specification (CH-37 delta)

## Purpose
The client-facing title and description of an automation come from its template row instead of a map in the panel module (DEC-182, business text (a)), so any template with texts can reach the panel. «Disponibles» is deduplicated and ordered by title (DEC-190, amending DEC-137). The response shape and the panel page do not change.

## MODIFIED Requirements

### Requirement: Available Automations Rule (DEC-137)

`disponibles` SHALL contain every global template that has a client text — a `titulo` and a `descripcion` that are both non-null and non-blank after trimming — and whose title is not the title of a template for which the session's tenant has an automation with `activo = true`. It SHALL NOT be filtered by connection readiness. A template without a client text SHALL NOT be listed. A template for which the tenant has only paused automations SHALL be listed as available. Templates with the same title SHALL be listed once. Two titles are the same when they are equal after trimming and lower-casing in `es`. The items SHALL be ordered by title with a Spanish collation, then by template `id`, so the same catalog always gives the same list. Each item SHALL carry the stored `titulo` and `descripcion`, trimmed.
(Previously: a template was listed when its `automatizacion` slug had an entry in the panel's copy map; twins were grouped and hidden by slug; the order was the map's insertion order, then `id`.)

#### Scenario: Template with an active automation is not available

- **GIVEN** a tenant with an active automation of the template titled «Aviso de stock bajo»
- **WHEN** the route is called
- **THEN** `disponibles` SHALL NOT contain an item titled «Aviso de stock bajo»

#### Scenario: Template with only a paused automation is available

- **GIVEN** a tenant whose only automation of the template titled «Aviso de stock bajo» has `activo = false`
- **WHEN** the route is called
- **THEN** `disponibles` SHALL contain the «Aviso de stock bajo» item

#### Scenario: Template without a client text is hidden

- **GIVEN** a global template whose `titulo` is null, or whose `descripcion` is null or blank
- **WHEN** the route is called
- **THEN** `disponibles` SHALL NOT contain it

#### Scenario: A new template with its own title is listed beside a seeded one of the same slug

- **GIVEN** a tenant with an active automation of the seeded `stock-fisico` template, and a second `stock-fisico` template titled «Aviso de stock por depósito»
- **WHEN** the route is called
- **THEN** `disponibles` SHALL contain the «Aviso de stock por depósito» item
- **AND** SHALL NOT contain «Aviso de stock bajo»

#### Scenario: Another tenant's automation does not hide a template

- **GIVEN** Tenant B has an active automation of the template titled «Aviso de stock bajo» and Tenant A has none
- **WHEN** Tenant A calls the route
- **THEN** A's `disponibles` SHALL contain the «Aviso de stock bajo» item

#### Scenario: Templates with the same title are listed once and hidden together

- **GIVEN** two global templates titled «Aviso de stock bajo» and «aviso de stock bajo », and a tenant with an active automation of one of them
- **WHEN** the route is called
- **THEN** `disponibles` SHALL NOT contain either
- **AND** without that automation it SHALL contain exactly one of them, the one with the lower `id`

#### Scenario: Order is by title

- **GIVEN** the two seeded templates and a tenant without automations
- **WHEN** the route is called
- **THEN** `disponibles` SHALL list «Aviso de productos que ya casi no podés armar» before «Aviso de stock bajo»

### Requirement: Business Copy Map With Neutral Fallback (DEC-128, DEC-137)

Titles and descriptions SHALL come from the `titulo` and `descripcion` columns of the automation's template (DEC-182, DEC-190), and SHALL be written in business language per the panel glossary (`lenguaje.md`), which the template routes enforce at save time (`automation-templates`). For an automation whose template has no client text, as defined in "Available Automations Rule", the item SHALL use a neutral fallback title and description kept in the panel module, and SHALL NOT throw. A template with only one of the two texts SHALL use the fallback for both. The stored template `nombre` (console text) SHALL NOT be used as a fallback.
(Previously: titles and descriptions came from a map kept in the panel module, keyed by the template's `automatizacion` slug.)

#### Scenario: Template with a client text

- **GIVEN** an automation whose template has `titulo` «Aviso de stock bajo» and a non-blank `descripcion`
- **THEN** its item's `titulo` and `descripcion` SHALL be those stored texts, trimmed

#### Scenario: Template without a client text on an existing automation

- **GIVEN** an automation whose template has `titulo` null
- **WHEN** the route is called
- **THEN** the item SHALL appear in `activas` with the neutral fallback `titulo` and `descripcion`
- **AND** the template's `nombre` SHALL NOT appear in the response

#### Scenario: Half-filled template

- **GIVEN** an automation whose template has a `titulo` and a blank `descripcion`
- **WHEN** the route is called
- **THEN** the item SHALL carry the neutral fallback `titulo` and `descripcion`, never the stored `titulo` with the fallback description
