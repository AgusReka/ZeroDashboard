# Automation Templates Specification

## Purpose

A reusable `Plantilla` (query + parameters + entities + format + freshness) over the canonical contract: a global, persisted catalog (DEC-61) that P1 curates by API, composed at test time as `WITH` CTEs over a tenant's registered canonical views (DEC-62, DEC-70), and exercised read-only against exactly one tenant's connection through the existing pipeline. This is D1's mechanism only — scheduling (CH-13), delivery (CH-14/21), freshness enforcement (CH-24), and versioning (CH-25) are out of scope.

## Requirements

### Requirement: Plantilla Is a Global Catalog (DEC-61)

The system SHALL persist `Plantilla` with no `tenantId` column and no per-tenant scoping. `POST /plantillas`, `GET /plantillas`, `GET /plantillas/:id`, and `PUT /plantillas/:id` SHALL NOT require `x-tenant-id`.

#### Scenario: Creating a template without a tenant header

- GIVEN a valid template payload
- WHEN `POST /plantillas` is sent with no `x-tenant-id` header
- THEN the response SHALL be `201` with the persisted template

### Requirement: Catalog Supports Create, List, Get, Replace — No Delete (DEC-68)

The system SHALL expose create, list-all, get-by-id, and replace-by-id (`PUT`) for `Plantilla`. It SHALL NOT expose any delete route. `GET/PUT /plantillas/:id` for an unknown id SHALL respond `404`.

#### Scenario: Round-trip create, get, replace

- GIVEN a created template
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
