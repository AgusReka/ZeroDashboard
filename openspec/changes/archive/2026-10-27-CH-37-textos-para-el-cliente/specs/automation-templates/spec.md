# Automation Templates Specification (CH-37 delta)

## Purpose
A template may carry a client-facing title and description, written through the existing catalog routes (DEC-182, DEC-190). Their only reader is the client panel (`client-panel-automations`). Composition, execution and the test route do not change.

## ADDED Requirements

### Requirement: Optional Client Texts, Length-Capped and Glossary-Checked (DEC-182, DEC-190)

`POST /plantillas` and `PUT /plantillas/:id` SHALL accept two optional string fields, `titulo` (at most 80 characters) and `descripcion` (at most 200 characters). Each SHALL be trimmed of surrounding whitespace before it is checked and stored, and a value that is empty after trimming SHALL be stored as `null`. A value that contains, case-insensitively, a term of the panel glossary's forbidden list (`tenant`, `cron`, `sql`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout`, `plantilla`) SHALL be refused with `400 solicitud-invalida`, naming the field in `campos` and the matched terms in `terminos`, and nothing SHALL be written. A value over its cap SHALL be refused with `400 solicitud-invalida` naming the field. Because `PUT` replaces the template as a whole, a `PUT` that omits a text SHALL store it as `null`. `GET /plantillas/:id` and the `201`/`200` bodies of create and replace SHALL include both fields (`null` when absent). The `GET /plantillas` summary SHALL NOT include them.

#### Scenario: Creating a template with client texts

- GIVEN a valid template payload with `titulo: "  Aviso de stock por depósito "` and a clean `descripcion`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `201`, echoing `titulo: "Aviso de stock por depósito"` and the `descripcion`
- AND `GET /plantillas/:id` SHALL return the same two values

#### Scenario: Creating a template without client texts

- GIVEN a valid template payload with neither field
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `201` with `titulo: null` and `descripcion: null`

#### Scenario: A forbidden term is refused

- GIVEN a payload whose `descripcion` is "Corre la consulta cada mañana"
- WHEN `POST /plantillas` or `PUT /plantillas/:id` is sent
- THEN the response SHALL be `400` with `error: "solicitud-invalida"`, `campos` containing `/descripcion` and `terminos` containing `consulta`
- AND no row SHALL be created or changed

#### Scenario: A text over its cap is refused

- GIVEN a payload whose `titulo` has 81 characters
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/titulo`

#### Scenario: A blank text is stored as null

- GIVEN a payload with `titulo: "   "`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `201` with `titulo: null`

#### Scenario: Replacing without the texts clears them

- GIVEN a template with a `titulo` and a `descripcion`
- WHEN `PUT /plantillas/:id` is sent with a valid body that omits both
- THEN the response SHALL be `200` with `titulo: null` and `descripcion: null`

#### Scenario: The summary list is unchanged

- GIVEN templates with client texts
- WHEN `GET /plantillas` is requested
- THEN each item SHALL have exactly `id`, `nombre`, `automatizacion`, `formato` and `toleranciaFrescuraMinutos`
