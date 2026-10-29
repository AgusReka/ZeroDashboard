# Automation Templates Specification

## Purpose

A reusable `Plantilla` (query + parameters + entities + format + freshness) over the canonical contract: a global, persisted catalog (DEC-61) that P1 curates by API and, since CH-38, from the console (a template with active automations is duplicated, never replaced: DEC-182, DEC-191), and since CH-39 it may declare its message text (a static header and a line per row, checked against the columns of the passing test: DEC-188, DEC-192), composed at test time as `WITH` CTEs over a tenant's registered canonical views (DEC-62, DEC-70), and exercised read-only against exactly one tenant's connection through the existing pipeline. This is D1's mechanism only — scheduling (CH-13), delivery (CH-14/21), freshness enforcement (CH-24), and versioning (CH-25) are out of scope.

## Requirements

### Requirement: Plantilla Is a Global Catalog (DEC-61)

The system SHALL persist `Plantilla` with no `tenantId` column and no per-tenant scoping. `POST /plantillas`, `GET /plantillas`, `GET /plantillas/:id`, and `PUT /plantillas/:id` SHALL NOT require `x-tenant-id`.

#### Scenario: Creating a template without a tenant header

- GIVEN a valid template payload
- WHEN `POST /plantillas` is sent with no `x-tenant-id` header
- THEN the response SHALL be `201` with the persisted template

### Requirement: Catalog Supports Create, List, Get, Replace — No Delete (DEC-68)

The system SHALL expose create, list-all, get-by-id, and replace-by-id (`PUT`) for `Plantilla`. It SHALL NOT expose any delete route. `GET/PUT /plantillas/:id` for an unknown id SHALL respond `404`. Replace SHALL be refused on a template in use (see "A Template In Use Is Not Replaced").
(Previously: replace was always allowed.)

#### Scenario: Round-trip create, get, replace

- GIVEN a created template with no automation
- WHEN it is fetched by id, then replaced with `PUT` using a new `sql`
- THEN the get SHALL return the original fields
- AND the replace SHALL respond `200` with the same id and the new `sql`, with exactly one row persisted for that id

#### Scenario: Unknown id

- WHEN `GET /plantillas/:id` or `PUT /plantillas/:id` names an id with no row
- THEN the response SHALL be `404`

### Requirement: Test Endpoint Is Not Exempt, Matched by Exact Method and Path (DEC-62)

The tenant-context exemption allowlist SHALL match `Plantilla` routes by exact HTTP method and route pattern, never by shared URL prefix. `POST /plantillas/:id/prueba` SHALL NOT be added to that allowlist and SHALL require `x-tenant-id` like any non-exempt route, even though it shares the `/plantillas/:id` prefix with exempt catalog routes.

#### Scenario: Test endpoint without a tenant header is rejected

- GIVEN an existing template
- WHEN `POST /plantillas/:id/prueba` is sent with no `x-tenant-id`
- THEN the response SHALL be `400 tenant-no-indicado`
- AND no query SHALL execute

### Requirement: Field Validation Reuses CH-11 Parameter Rules (DEC-52, DEC-73)

`nombre` and `sql` SHALL be required non-empty strings. `parametros` SHALL use the `query-parameters` declaration shape and SHALL be validated with the same rules applied to saved queries: a declared-but-unused parameter is rejected (DEC-56), an undeclared `:marker` in `sql` is rejected (DEC-57), and a hand-written `$n` in `sql` is always rejected (DEC-59). `parametros` and `entidades` SHALL be stored as JSON columns, validated in the application.

#### Scenario: Declared parameter unused in sql

- GIVEN a template with `parametros: [{nombre:"x", tipo:"numero"}]` and `sql` with no `:x`
- WHEN the template is created
- THEN the response SHALL be `400` naming `x`

#### Scenario: Hand-written positional bind always rejected

- GIVEN `sql` containing `WHERE id = $1`
- WHEN the template is created or replaced
- THEN the response SHALL be `400`, regardless of `parametros`

### Requirement: entidades Validated Against the Canonical Contract (DEC-63)

`entidades` SHALL be a non-empty list drawn only from the five `CONTRATO_CANONICO` names (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`). An unknown name SHALL be rejected, naming it.

#### Scenario: Unknown entity rejected

- GIVEN a template with `entidades: ["cliente"]`
- WHEN it is created
- THEN the response SHALL be `400` naming `cliente`

### Requirement: automatizacion Is an Enum From AUTOMATIZACIONES (DEC-67, closes DEC-22)

`automatizacion` SHALL accept only a value already enumerated by `AUTOMATIZACIONES` (`stock-fisico`, `stock-producible`, `reporte-diario`). Any other value SHALL be rejected, naming the invalid value.

#### Scenario: Invalid automatizacion rejected

- GIVEN a template with `automatizacion: "envio-abandonado"`
- WHEN it is created
- THEN the response SHALL be `400` naming the invalid value

#### Scenario: Valid automatizacion accepted

- GIVEN a template with `automatizacion: "stock-fisico"`
- WHEN it is created
- THEN the response SHALL be `201`

### Requirement: formato Is Fixed to correo-html (DEC-65)

`formato` SHALL accept only the literal `correo-html`. Any other value SHALL be rejected.

#### Scenario: Unsupported formato rejected

- GIVEN a template with `formato: "pdf"`
- WHEN it is created
- THEN the response SHALL be `400`

### Requirement: toleranciaFrescuraMinutos Is Stored, Never Enforced (DEC-66)

`toleranciaFrescuraMinutos` SHALL be a stored non-negative integer with no effect on this change's test endpoint or any other execution path.

#### Scenario: Value has no effect on test execution

- GIVEN two otherwise-identical templates differing only in `toleranciaFrescuraMinutos`
- WHEN each is tested against the same connection
- THEN both SHALL execute identically

### Requirement: WITH Composition Using v_<entidad> Aliases (DEC-70)

The composition function SHALL prefix each entity in `entidades`, using that connection's registered `tenant-schema-mapping` SQL, as a CTE aliased `v_<entidad>`, and SHALL nest the template's own `sql` as an outer subquery so the template's own `WITH` clauses remain usable. Only stored, operator-authored SQL text SHALL participate in composition (rule 4) — no request-supplied SQL fragment is spliced in.

#### Scenario: Two entities compose as CTEs

- GIVEN a template with `entidades: ["producto", "insumo"]`
- WHEN it is composed for a connection with both mappings registered
- THEN the composed text SHALL open `WITH v_producto AS (...), v_insumo AS (...)` before nesting the template's `sql`

#### Scenario: Template references an undeclared alias

- GIVEN a template with `entidades: ["producto"]` whose `sql` also reads `v_insumo`
- WHEN the test endpoint runs against a connection whose `producto` view passes validation
- THEN the statement SHALL execute and fail on the undefined relation
- AND the response SHALL be `200` with verdict `fallo`, category `error-sintaxis` (existing verdict contract; no engine change)

### Requirement: Every Composed View Requires a Passing Saved Validation (DEC-71)

For each entity in `entidades`, the test endpoint SHALL require a persisted, passing `mapping-validation` result on the target connection. WHEN an entity has no registered mapping at all, or its persisted validation did not pass, the system SHALL respond `4xx` naming that entity and SHALL execute nothing.

#### Scenario: Missing registered view

- GIVEN `entidades: ["insumo"]` and no `insumo` mapping registered for the target connection
- WHEN the test endpoint runs
- THEN the response SHALL be `4xx` naming `insumo`
- AND no query SHALL execute

#### Scenario: Registered but failing validation

- GIVEN `producto` is mapped but its persisted validation is invalid
- WHEN the test endpoint runs with `entidades: ["producto"]`
- THEN the response SHALL be `4xx` naming `producto`

### Requirement: Test Endpoint Runs Only Against the Request's Own Tenant Connection, Read-Only (DEC-62)

`POST /plantillas/:id/prueba` SHALL resolve the target `Conexion` only among rows belonging to the tenant resolved from `x-tenant-id`, and SHALL execute the composed statement through the existing read-only pipeline (`ejecutarConsulta`, `READ ONLY` transaction, DEC-08 permission check). Declared parameter values SHALL be bound only as driver parameters, never concatenated into SQL text.

#### Scenario: Successful test execution

- GIVEN a template whose entities are all mapped and validated on the tenant's connection
- WHEN the test endpoint runs with valid parameter values
- THEN the response SHALL contain rows from the composed query
- AND the final SQL text SHALL contain only placeholders, never a literal value

#### Scenario: Naming another tenant's connection

- GIVEN tenants A and B, and a `Conexion` belonging to B
- WHEN A's active tenant tests a template naming B's connection id
- THEN the response SHALL be `404`
- AND no query SHALL execute against B's database

### Requirement: Personal-Field Access Is Not Provided (DEC-72 Limit)

The system SHALL NOT provide any mechanism for a `Plantilla` to declare, request, or expose the personal fields excluded by the canonical contract (DEC-23: domicilio, teléfono, correo). This is a documented artifact limit, deferred until a future change decides the override mechanism.

#### Scenario: No entity or field exists to request personal data

- GIVEN the canonical contract has no personal field or buyer entity
- WHEN `entidades` is validated against the contract
- THEN no personal field SHALL ever be reachable through composition

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

### Requirement: A Template In Use Is Not Replaced (DEC-182, DEC-191)

A template SHALL be **in use** when at least one `Automatizacion` with `activo = true` references it, in any tenant. An automation with `activo = false` SHALL NOT count. `PUT /plantillas/:id` on a template in use SHALL be refused with `409 {error: "plantilla-en-uso"}` and nothing SHALL be written. The body checks SHALL run first: an invalid body SHALL still be `400`, whatever the template's use. An unknown id SHALL still be `404`. The in-use check and the write SHALL be atomic with respect to the creation of an automation on the same template: once the check passes, no automation created concurrently on that template SHALL be committed before the replacement.

#### Scenario: Replacing a template with an active automation

- GIVEN a template with one active automation in tenant A
- WHEN `PUT /plantillas/:id` is sent with a valid body
- THEN the response SHALL be `409` with `error: "plantilla-en-uso"`
- AND the stored template SHALL be unchanged

#### Scenario: Only deactivated automations

- GIVEN a template whose only automations, in tenants A and B, have `activo = false`
- WHEN `PUT /plantillas/:id` is sent with a valid body
- THEN the response SHALL be `200` with the replaced template

#### Scenario: Use in another tenant counts

- GIVEN a template with an active automation in tenant B only
- WHEN `PUT /plantillas/:id` is sent with no `x-tenant-id`
- THEN the response SHALL be `409`

#### Scenario: An invalid body on a template in use

- GIVEN a template in use
- WHEN `PUT /plantillas/:id` is sent with `sql` containing `$1`
- THEN the response SHALL be `400`, not `409`

### Requirement: The Full Projection Reports Use (DEC-191)

`GET /plantillas/:id` SHALL include `enUso` (boolean), computed with the rule above at request time. The `201` body of `POST /plantillas` SHALL include `enUso: false` and the `200` body of `PUT` SHALL include `enUso: false`. The `GET /plantillas` summary SHALL NOT include it. No response SHALL include how many automations use the template, nor any tenant or automation identifier.

#### Scenario: Reading a template in use

- GIVEN a template with one active automation in tenant B
- WHEN `GET /plantillas/:id` is requested with no `x-tenant-id`
- THEN the body SHALL have `enUso: true` and no count, tenant or automation id

#### Scenario: Reading a free template

- GIVEN a template with no active automation
- WHEN `GET /plantillas/:id` is requested
- THEN the body SHALL have `enUso: false`

### Requirement: Testing an Unsaved Template (DEC-191, D4)

`POST /plantillas/prueba` SHALL accept the template body of `POST /plantillas` plus `conexionId` (required) and `valores` (optional object, default `{}`), under a strict schema. The template body includes `encabezadoMensaje`, `lineaMensaje` and `columnasPrueba`. It SHALL require `x-tenant-id` and SHALL NOT be in the tenant-context exemption allowlist. It SHALL refuse the template fields exactly as `POST /plantillas` does (`400`, same body), except the test-columns check (step 6 of the message texts), which SHALL NOT apply: a test is what produces those columns. It SHALL then apply, in order, the gates of `POST /plantillas/:id/prueba`: the connection owned by the active tenant (`404 conexion-no-encontrada`), the approved views of the declared entities (`409 vista-canonica-no-aprobada`), the values against the declaration (`400`) and a readable credential (`409 credencial-ilegible`). It SHALL execute the composed statement through the same read-only pipeline and answer as that route does: `200` with the execution result, first page only. It SHALL write no `Plantilla` row. The route `POST /plantillas/:id/prueba` SHALL keep matching only paths with an id.
(Previously: the body had no message texts, and every check of `POST /plantillas` applied.)

#### Scenario: Testing before saving

- GIVEN an active tenant whose connection has approved views for `producto`
- WHEN `POST /plantillas/prueba` is sent with a valid template over `v_producto`, that `conexionId` and its values
- THEN the response SHALL be `200` with the rows of the composed query
- AND no `Plantilla` row SHALL be created

#### Scenario: An invalid template is refused before any execution

- GIVEN a body whose `sql` contains `$1`
- WHEN `POST /plantillas/prueba` is sent
- THEN the response SHALL be `400` and nothing SHALL execute

#### Scenario: No tenant header

- WHEN `POST /plantillas/prueba` is sent with no `x-tenant-id`
- THEN the response SHALL be `400 tenant-no-indicado` and nothing SHALL execute

#### Scenario: Another tenant's connection

- GIVEN tenants A and B and a connection of B
- WHEN A's active tenant sends `POST /plantillas/prueba` naming B's connection
- THEN the response SHALL be `404` and nothing SHALL execute against B's database

#### Scenario: Testing with message texts and no test columns

- GIVEN an active tenant whose connection has approved views for `producto`
- WHEN `POST /plantillas/prueba` is sent with a valid template carrying both message texts and no `columnasPrueba`
- THEN the response SHALL be `200` with the execution result, including `columnas`

#### Scenario: An unpaired text is still refused when testing

- WHEN `POST /plantillas/prueba` is sent with `lineaMensaje` and no `encabezadoMensaje`
- THEN the response SHALL be `400` naming `/encabezadoMensaje`, and no query SHALL run
