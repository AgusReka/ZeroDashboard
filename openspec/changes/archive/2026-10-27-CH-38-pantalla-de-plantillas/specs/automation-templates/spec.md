# Automation Templates Specification (CH-38 delta)

## Purpose
A template with active automations is not replaced: it is duplicated (DEC-182 (b), DEC-191). The full projection says whether a template is in use, and a template can be tested before it is saved. Composition, the closed lists and the stored-template test route do not change.

## ADDED Requirements

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

`POST /plantillas/prueba` SHALL accept the template body of `POST /plantillas` plus `conexionId` (required) and `valores` (optional object, default `{}`), under a strict schema. It SHALL require `x-tenant-id` and SHALL NOT be in the tenant-context exemption allowlist. It SHALL refuse the template fields exactly as `POST /plantillas` does (`400`, same body). It SHALL then apply, in order, the gates of `POST /plantillas/:id/prueba`: the connection owned by the active tenant (`404 conexion-no-encontrada`), the approved views of the declared entities (`409 vista-canonica-no-aprobada`), the values against the declaration (`400`) and a readable credential (`409 credencial-ilegible`). It SHALL execute the composed statement through the same read-only pipeline and answer as that route does: `200` with the execution result, first page only. It SHALL write no `Plantilla` row. The route `POST /plantillas/:id/prueba` SHALL keep matching only paths with an id.

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

## MODIFIED Requirements

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
