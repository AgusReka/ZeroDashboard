# Query Console Specification (CH-30d delta)

## Purpose
The console gains the Templates and Contract screens (global, read-only) and the Mapping and validation screen (M1–M4), following the one-SQL-per-entity model (DEC-169).

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order, a "Global" group with `#tenants`, `#plantillas` and `#contrato`, a "Puesta en marcha" group with `#conexiones`, `#agentes`, `#mapeo` and `#usuarios`, and a "Trabajo diario" group with `#consultas`, `#automatizaciones` and `#frescura`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: "Global" held only `#tenants`, and "Puesta en marcha" had no `#mapeo`.)

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#mapeo`
- **THEN** only Mapeo y validación is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

## ADDED Requirements

### Requirement: Templates Screen
The Plantillas screen SHALL list the template catalog (`GET /plantillas`) with name, automation, format and freshness tolerance, written as text, and say when the list was cut. "Ver" SHALL load the template (`GET /plantillas/:id`) and show, in a side panel, the entities it needs, its declared parameters and its statement as text. The screen SHALL offer no way to create or change a template.

#### Scenario: Viewing a template
- **WHEN** the operator presses "Ver" on "Stock diario"
- **THEN** the panel shows its entities, parameters and statement, as text

### Requirement: Contract Screen
The Contrato screen SHALL show the canonical contract (`GET /contrato`): one block per entity with its name and whether it is obligatory, and under it each field with its name, type, whether it is obligatory and the automations that use it.

#### Scenario: Reading the contract
- **WHEN** the operator opens Contrato
- **THEN** the five entities appear in contract order, each with its fields

### Requirement: Mapping and Validation Screen
The Mapeo y validación screen SHALL, for the active tenant, let the operator choose one of its connections and then show, for each of the five contract entities in contract order: its obligatoriness, its state ("Sin mapear", "Sin validar", "Válida" or "Inválida"), its SQL in an editor, and its last diagnostics per field (verdict, column, observed type and cast hint). "Guardar" SHALL send the entity's SQL to `PUT /conexiones/:id/vistas-canonicas/:entidad` and then show the entity as "Sin validar". "Validar" SHALL send `POST /conexiones/:id/validacion-mapeo` and show the new report; when the answer is a session failure (`resultado: "fallo"`), it SHALL show the phase, category and code apart and keep showing the last stored report. The three automations SHALL appear with their state and every reason. With no tenant, or no connection chosen, the screen SHALL say what to choose and send nothing. Every SQL statement and diagnostic SHALL be written as text.

#### Scenario: Saving an entity
- **WHEN** the operator edits the SQL of `producto` and presses "Guardar"
- **THEN** the statement is sent to `PUT …/vistas-canonicas/producto` and the entity shows "Sin validar"

#### Scenario: A session failure
- **WHEN** "Validar" answers `resultado: "fallo"` with category `credenciales-invalidas`
- **THEN** the screen says so, and the entities keep their previous states

#### Scenario: An invalid field
- **GIVEN** the report says `stockDisponible` has verdict `tipo-incorrecto` with the hint `::numeric`
- **THEN** the entity shows that field, its verdict and the hint
