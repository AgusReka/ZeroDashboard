# Query Console Specification (CH-54 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-54. `mapping-validation` and `tenant-schema-mapping` specify the API, which does not change. Pattern ids refer to `.claude/skills/zerodashboard-design/guidelines/admin.md`.

## MODIFIED Requirements

### Requirement: Mapping and Validation Screen
The Mapeo y validación screen SHALL, for the active tenant, let the operator choose one of its connections. It SHALL then show three columns.

**Entity list:**
- the five contract entities in contract order, each with its obligatoriness and its state ("Sin mapear", "Sin validar", "Válida" or "Inválida"), shown as icon and text;
- one entity is selected at a time and carries `aria-current`;
- on load, the first entity that is not "Válida" is selected, or the first one when all are.

**The selected entity's block:**
- its SQL in an editor with an associated label «SELECT de {entidad}»;
- «Guardar mapeo»;
- its example, as today.

**Expected fields:** each contract field of the selected entity with its name, type and whether it is obligatory. They are taken from the canonical contract embedded in the page, before any validation. When the last report has a diagnostic for that entity, each field SHALL also show its verdict in words:
- `ok` → «Coincide»;
- `ausente` → «Falta en el SELECT»;
- `tipo-incorrecto` → «Tipo distinto: llega {tipo observado}»;
- `alias-sin-comillas` → «Usá el alias entre comillas dobles»;
- `duplicada` → «La columna aparece dos veces».

The cast hint goes in mono, and extra columns are listed as «Columnas que sobran: …».

**Actions:**
- "Guardar" SHALL send the entity's SQL to `PUT /conexiones/:id/vistas-canonicas/:entidad` and then show the entity as "Sin validar".
- "Validar" SHALL send `POST /conexiones/:id/validacion-mapeo` and show the new report.
- When the answer is a session failure (`resultado: "fallo"`), it SHALL show the phase, category and code apart, and keep showing the last stored report.

**Summary:** the summary of the last report SHALL say «{n} de {m} entidades válidas». Each pending entity in it SHALL be a link that selects that entity. Above «Validar mapeo», one line SHALL state what makes the mapping valid: each obligatory entity mapped, probed without error and with every field matching.

**Automations:** the three automations SHALL appear with their state, as icon and text, and every reason.

**Empty and blocked states:**
- With no tenant, or no connection chosen, the screen SHALL say what to choose and send nothing.
- With a tenant that has no connections, it SHALL show «Primero registrá una conexión. El mapeo se escribe sobre la réplica que llega por esa conexión.» with «Ir a Conexiones».

Every SQL statement, example, field name and diagnostic SHALL be written as text.

**Guide.** Above the entities, the screen SHALL show a collapsible step-by-step guide, «Cómo mapear», in the static markup, stating in order:
1. choose the connection;
2. per entity, write one SELECT over the client's replica whose columns are named exactly like the contract fields shown beside the editor, camelCase names in double quotes, with the contract's types;
3. «Guardar» each entity;
4. «Validar mapeo» and read each field's verdict and cast hint;
5. read the automations table, which says which automations the mapping enables.

It SHALL say that optional entities can stay unmapped.

**Examples.** Each entity block SHALL show, collapsed, that entity's fixed example over the food_store demo replica (DEC-176), labelled as an example over the demo schema, with a «Usar de punto de partida» action.
- The action SHALL copy the example into that entity's editor only when the editor is empty or holds only whitespace.
- Otherwise it SHALL leave the editor unchanged and say that the editor already has SQL.
- The action SHALL NOT send any request nor change the entity's state.
- Each example SHALL name every field of its entity in the contract as a column alias, quoted when camelCase, and no other alias.

(Previously: the five entities were stacked, each always visible. The contract fields were not shown, and diagnostics listed only failing fields as raw verdict tokens. Editors had no label, and the summary had no links.)

#### Scenario: Saving an entity
- **WHEN** the operator selects `producto`, edits its SQL and presses "Guardar"
- **THEN** the statement is sent to `PUT …/vistas-canonicas/producto` and the entity shows "Sin validar"

#### Scenario: A session failure
- **WHEN** "Validar" answers `resultado: "fallo"` with category `credenciales-invalidas`
- **THEN** the screen says so, and the entities keep their previous states

#### Scenario: Expected fields before validating
- **GIVEN** `producto` has never been validated
- **WHEN** the operator selects `producto`
- **THEN** the field column lists every contract field of `producto` with its type and obligatoriness, and no verdict

#### Scenario: An invalid field in words
- **GIVEN** the report says `stockDisponible` has verdict `tipo-incorrecto`, observed type `texto` and the hint `::numeric`
- **WHEN** the operator selects that entity
- **THEN** the field reads «Tipo distinto: llega texto» and shows `::numeric` in mono

#### Scenario: The summary leads to the work
- **GIVEN** the report has `pedido` as "Inválida"
- **WHEN** the operator presses the `pedido` link in the summary
- **THEN** `pedido` becomes the selected entity

#### Scenario: No connections
- **GIVEN** tenant A has no connections
- **WHEN** the hash becomes `#mapeo`
- **THEN** the screen shows the blocked state with «Ir a Conexiones» and sends no validation request

#### Scenario: Labelled editors
- **WHEN** the console document is served
- **THEN** each of the five entity editors has a label associated to it

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
