# Automation Templates Specification (CH-39 delta)

## Purpose
A template may declare the text of its message: a static header and a line repeated per row, with `{columna}` placeholders replaced by the row's values (DEC-188 (b), DEC-192). The texts are optional, go together, and are checked against the columns of the test that preceded the save. Composition, the closed lists, the in-use rule and the summary do not change.

## ADDED Requirements

### Requirement: Optional Message Texts, Paired and Checked Against the Test Columns (DEC-188, DEC-192)

`POST /plantillas` and `PUT /plantillas/:id` SHALL accept two optional string fields: `encabezadoMensaje` (at most 200 characters) and `lineaMensaje` (at most 300 characters). Each SHALL be trimmed before it is checked and stored, and a value that is empty after trimming SHALL be treated as absent and stored as `null`.

A **placeholder** SHALL be any `{` followed by one or more characters other than `{` and `}`, followed by `}`. Its name is the text between the braces, unchanged (no trimming, case-sensitive). Any other brace SHALL be literal text.

The checks SHALL run after the client-text checks and before the SQL checks. Each refusal SHALL be `400 solicitud-invalida`, write nothing, and name the field in `campos`. In this order:
1. **Pairing.** Exactly one of the two present SHALL be refused, naming the absent one.
2. **Caps.** A value over its cap SHALL be refused.
3. **Header is static.** A placeholder in `encabezadoMensaje` SHALL be refused, with its names in `marcadores`.
4. **Line has data.** A `lineaMensaje` with no placeholder SHALL be refused.
5. **Glossary.** The panel glossary (DEC-137) SHALL be applied to `encabezadoMensaje` and to `lineaMensaje` with its placeholders removed; a match SHALL be refused with the terms in `terminos`.
6. **Test columns.** When the texts are present, the body SHALL carry `columnasPrueba`, an array of at most 200 strings: the column names of the passing test. Its absence SHALL be refused naming `/columnasPrueba`. Every placeholder of `lineaMensaje` that is not an element of `columnasPrueba` SHALL be refused naming `/lineaMensaje`, with the unknown names in `marcadores`, each once, in order of first appearance.

`columnasPrueba` SHALL be accepted when the texts are absent and then ignored. It SHALL never be stored or returned. Because `PUT` replaces the template as a whole, a `PUT` that omits the texts SHALL store both as `null`. `GET /plantillas/:id` and the `201`/`200` bodies of create and replace SHALL include both fields (`null` when absent). The `GET /plantillas` summary SHALL NOT include them.

#### Scenario: Creating a template with message texts

- GIVEN a valid template payload with `encabezadoMensaje: "Productos con poco stock"`, `lineaMensaje: "{producto}: quedan {cantidad} unidades"` and `columnasPrueba: ["producto", "cantidad"]`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `201`, echoing both texts and no `columnasPrueba`
- AND `GET /plantillas/:id` SHALL return the same two texts

#### Scenario: Creating a template without message texts

- GIVEN a valid template payload with neither text
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `201` with `encabezadoMensaje: null` and `lineaMensaje: null`

#### Scenario: A placeholder outside the test columns

- GIVEN a payload with `lineaMensaje: "{producto}: {stock} ({stock})"` and `columnasPrueba: ["producto", "cantidad"]`
- WHEN `POST /plantillas` or `PUT /plantillas/:id` is sent
- THEN the response SHALL be `400` with `campos` containing `/lineaMensaje` and `marcadores` equal to `["stock"]`
- AND no row SHALL be created or changed

#### Scenario: Placeholder names are exact

- GIVEN `lineaMensaje: "{Producto}"` and `columnasPrueba: ["producto"]`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` with `marcadores` equal to `["Producto"]`

#### Scenario: Only one text

- GIVEN a payload with `lineaMensaje` and no `encabezadoMensaje`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/encabezadoMensaje`

#### Scenario: Texts without test columns

- GIVEN a payload with both texts and no `columnasPrueba`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/columnasPrueba`

#### Scenario: A placeholder in the header

- GIVEN `encabezadoMensaje: "Stock de {deposito}"`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/encabezadoMensaje` with `marcadores` equal to `["deposito"]`

#### Scenario: A line without placeholders

- GIVEN `lineaMensaje: "Revisá el stock"`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/lineaMensaje`

#### Scenario: The glossary ignores placeholder names

- GIVEN `lineaMensaje: "{consulta}: revisar"` and `columnasPrueba: ["consulta"]`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `201`

#### Scenario: A forbidden term in the literal text

- GIVEN `lineaMensaje: "{producto} según la consulta"` and `columnasPrueba: ["producto"]`
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/lineaMensaje` with `terminos` containing `consulta`

#### Scenario: A line over its cap

- GIVEN a `lineaMensaje` of 301 characters
- WHEN `POST /plantillas` is sent
- THEN the response SHALL be `400` naming `/lineaMensaje`

## MODIFIED Requirements

### Requirement: Testing an Unsaved Template (DEC-191, D4)

`POST /plantillas/prueba` SHALL accept the template body of `POST /plantillas` plus `conexionId` (required) and `valores` (optional object, default `{}`), under a strict schema. The template body includes `encabezadoMensaje`, `lineaMensaje` and `columnasPrueba`. It SHALL require `x-tenant-id` and SHALL NOT be in the tenant-context exemption allowlist. It SHALL refuse the template fields exactly as `POST /plantillas` does (`400`, same body), except the test-columns check (step 6 of the message texts), which SHALL NOT apply: a test is what produces those columns. It SHALL then apply, in order, the gates of `POST /plantillas/:id/prueba`: the connection owned by the active tenant (`404 conexion-no-encontrada`), the approved views of the declared entities (`409 vista-canonica-no-aprobada`), the values against the declaration (`400`) and a readable credential (`409 credencial-ilegible`). It SHALL execute the composed statement through the same read-only pipeline and answer as that route does: `200` with the execution result, first page only. It SHALL write no `Plantilla` row. The route `POST /plantillas/:id/prueba` SHALL keep matching only paths with an id.
(Previously: the body had no message texts, and every check of `POST /plantillas` applied.)

#### Scenario: Testing with message texts and no test columns

- GIVEN an active tenant whose connection has approved views for `producto`
- WHEN `POST /plantillas/prueba` is sent with a valid template carrying both message texts and no `columnasPrueba`
- THEN the response SHALL be `200` with the execution result, including `columnas`

#### Scenario: An unpaired text is still refused when testing

- WHEN `POST /plantillas/prueba` is sent with `lineaMensaje` and no `encabezadoMensaje`
- THEN the response SHALL be `400` naming `/encabezadoMensaje`, and no query SHALL run
