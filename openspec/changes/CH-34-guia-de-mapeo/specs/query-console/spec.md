# Query Console Specification (CH-34 delta)

## Purpose
The Mapping screen tells the operator how to map, and offers one real example SELECT per entity that can be copied into an empty editor. The operator still writes and saves every view (DEC-176, which narrows DEC-30).

## MODIFIED Requirements

### Requirement: Mapping and Validation Screen
The Mapeo y validación screen SHALL, for the active tenant, let the operator choose one of its connections and then show, for each of the five contract entities in contract order: its obligatoriness, its state ("Sin mapear", "Sin validar", "Válida" or "Inválida"), its SQL in an editor, an example, and its last diagnostics per field (verdict, column, observed type and cast hint). "Guardar" SHALL send the entity's SQL to `PUT /conexiones/:id/vistas-canonicas/:entidad` and then show the entity as "Sin validar". "Validar" SHALL send `POST /conexiones/:id/validacion-mapeo` and show the new report; when the answer is a session failure (`resultado: "fallo"`), it SHALL show the phase, category and code apart and keep showing the last stored report. The three automations SHALL appear with their state and every reason. With no tenant, or no connection chosen, the screen SHALL say what to choose and send nothing. Every SQL statement, example and diagnostic SHALL be written as text.

Above the entities, the screen SHALL show a collapsible step-by-step guide, «Cómo mapear», in the static markup, stating in order: choose the connection; per entity, write one SELECT over the client's replica whose columns are named exactly like the contract fields, camelCase names in double quotes, with the contract's types; «Guardar» each entity; «Validar mapeo» and read each field's verdict and cast hint; the automations table says which automations the mapping enables. It SHALL say that optional entities can stay unmapped.

Each entity block SHALL show, collapsed, that entity's fixed example over the food_store demo replica (DEC-176), labelled as an example over the demo schema, and a «Usar de punto de partida» action. The action SHALL copy the example into that entity's editor only when the editor is empty or holds only whitespace. Otherwise it SHALL leave the editor unchanged and say that the editor already has SQL. The action SHALL NOT send any request nor change the entity's state. Each example SHALL name every field of its entity in the contract as a column alias, quoted when camelCase, and no other alias.
(Previously: no guide and no example; editors started empty with no help beyond the page description.)

#### Scenario: Saving an entity
- **WHEN** the operator edits the SQL of `producto` and presses "Guardar"
- **THEN** the statement is sent to `PUT …/vistas-canonicas/producto` and the entity shows "Sin validar"

#### Scenario: A session failure
- **WHEN** "Validar" answers `resultado: "fallo"` with category `credenciales-invalidas`
- **THEN** the screen says so, and the entities keep their previous states

#### Scenario: An invalid field
- **GIVEN** the report says `stockDisponible` has verdict `tipo-incorrecto` with the hint `::numeric`
- **THEN** the entity shows that field, its verdict and the hint

#### Scenario: The guide is part of the screen
- **WHEN** the operator opens Mapeo y validación
- **THEN** the «Cómo mapear» guide is present above the entities, in the static markup

#### Scenario: Copying the example into an empty editor
- **GIVEN** the editor of `insumo` is empty
- **WHEN** the operator presses «Usar de punto de partida» in the `insumo` block
- **THEN** the editor holds the `insumo` example
- **AND** no request is sent and the entity keeps its state

#### Scenario: The example never overwrites SQL
- **GIVEN** the editor of `producto` holds the stored SQL
- **WHEN** the operator presses «Usar de punto de partida» in the `producto` block
- **THEN** the editor is unchanged and the screen says the editor already has SQL
- **AND** no request is sent

#### Scenario: Each example matches the contract
- **WHEN** the aliases of each example are compared with its entity's fields in `CONTRATO_CANONICO`
- **THEN** they are the same set, camelCase names quoted
