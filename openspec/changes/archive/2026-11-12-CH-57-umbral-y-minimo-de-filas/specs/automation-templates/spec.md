# Automation Templates Specification (CH-57 delta)

DEC-209 lets each parameter of a template carry an optional label and help text for the operator. The shared `query-parameters` declaration shape does not change: these keys exist only in a template's `parametros`.

## ADDED Requirements

### Requirement: Optional Operator Texts per Template Parameter (DEC-209)
Each entry of a template's `parametros` SHALL accept, besides `nombre` and `tipo`, an optional `etiqueta` and an optional `ayuda`, both strings.
- `etiqueta` SHALL be at most 60 characters and `ayuda` at most 240 characters, counted after trimming surrounding spaces.
- A text that is empty or only spaces SHALL be stored as absent.
- A longer text SHALL answer `400` naming the field (`/parametros/{i}/etiqueta` or `/parametros/{i}/ayuda`), and nothing SHALL be written.
- Any other key in an entry SHALL be rejected, as today.
- The texts SHALL be stored trimmed in the same JSON column and returned by `GET /plantillas/:id`.
- The texts SHALL NOT take part in composition, execution, the declared-versus-used checks (DEC-56, DEC-57) or the panel's threshold detection (`nombre === 'umbral'` and `tipo === 'numero'`).
- `POST /plantillas`, `PUT /plantillas/:id` and `POST /plantillas/prueba` SHALL accept the same entry shape.

#### Scenario: Texts are stored trimmed and returned
- GIVEN a create body with `parametros: [{nombre:"umbral", tipo:"numero", etiqueta:"  Stock mínimo  ", ayuda:"Avisa con esta cantidad o menos."}]`
- WHEN the template is created and then read by `GET /plantillas/:id`
- THEN the entry SHALL be `{nombre:"umbral", tipo:"numero", etiqueta:"Stock mínimo", ayuda:"Avisa con esta cantidad o menos."}`

#### Scenario: A blank text is absent
- GIVEN an entry with `etiqueta: "   "`
- WHEN the template is created
- THEN the stored entry SHALL have no `etiqueta` key

#### Scenario: A text over the limit is refused
- GIVEN an entry whose `ayuda` has 241 characters after trimming
- WHEN the template is created
- THEN the response SHALL be `400` naming `/parametros/0/ayuda`, and no row SHALL be written

#### Scenario: An unknown key in an entry is refused
- GIVEN an entry with `descripcion: "x"`
- WHEN the template is created
- THEN the response SHALL be `400`

#### Scenario: The panel still finds the threshold
- GIVEN a template whose `umbral` entry carries an `etiqueta`
- WHEN the client panel reads an automation built on it
- THEN it SHALL still offer the threshold as «Cantidad mínima»
