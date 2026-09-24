# Canonical Contract Specification

## Purpose

The minimal, tenant-agnostic set of entities and fields a candidate e-commerce platform must expose for generic automations to work without per-client rewrites (DEC-21). Defined once, statically, in code — not as a persisted model — and exposed read-only so P1 can inspect it (M1). Personal fields are structurally absent, not filtered (M5, DEC-23).

## Requirements

### Requirement: Static Catalog Is the Source of Truth

The system SHALL define the canonical contract as a static TypeScript module, not as a persisted database model. The catalog SHALL enumerate exactly the entities `producto`, `pedido`, `item_pedido`, `insumo`, and `receta_componente`. `producto`, `pedido`, and `item_pedido` SHALL be marked required at the entity level; `insumo` and `receta_componente` SHALL be marked optional at the entity level.

#### Scenario: Inspecting the catalog module

- **GIVEN** the catalog module after this change is applied
- **WHEN** its exported entity list is inspected
- **THEN** it SHALL contain exactly `producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`
- **AND** `producto`, `pedido`, `item_pedido` SHALL be marked required
- **AND** `insumo`, `receta_componente` SHALL be marked optional

### Requirement: Each Field Is Marked Required or Optional and Names Its Automation

Every field in every catalog entity SHALL be marked required or optional at the field level, independent of its entity's own required/optional status. Every field SHALL carry at least one free-text automation label naming which automation(s) depend on it (DEC-22). The system SHALL NOT admit a field or entity that traces to no automation.

#### Scenario: A required entity's required field

- **GIVEN** the `producto` entity in the catalog
- **WHEN** its `id`, `nombre`, `stockDisponible`, and `activo` fields are inspected
- **THEN** each SHALL be marked required
- **AND** each SHALL name at least one automation

#### Scenario: An optional field on a required entity

- **GIVEN** the `producto` entity in the catalog
- **WHEN** its `sku` field is inspected
- **THEN** it SHALL be marked optional
- **AND** it SHALL name at least one automation

### Requirement: Personal Fields Are Structurally Absent

The catalog SHALL NOT define any field named or meaning domicilio, teléfono, or correo, and SHALL NOT define any customer/buyer entity. This is a structural property of the module, not a filter applied at read time (DEC-23).

#### Scenario: Automated absence check over the catalog

- **GIVEN** the catalog module after this change is applied
- **WHEN** an automated test inspects every entity and field name (and, where present, field descriptions) across the whole catalog
- **THEN** none SHALL be named or reasonably interpreted as domicilio, teléfono, or correo
- **AND** no entity representing a customer or buyer SHALL be present

### Requirement: Read-Only Endpoint Projects the Catalog

The system SHALL expose `GET /contrato`, returning every canonical entity with its required/optional status, every field with its required/optional status, and each field's automation label(s), projected directly from the static catalog module. The endpoint SHALL be read-only and SHALL NOT accept a request body that mutates the catalog.

#### Scenario: Retrieving the full catalog

- **GIVEN** the application is running with this change applied
- **WHEN** a client sends `GET /contrato`
- **THEN** the response SHALL list all five entities (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`)
- **AND** each entity SHALL be marked required or optional
- **AND** each entity's fields SHALL each be marked required or optional and SHALL each carry an automation label

### Requirement: `GET /contrato` Is Exempt From the Tenant-Context Header

`GET /contrato` SHALL be added to the tenant-context exemption allowlist (`esExenta`), alongside `GET /health` and `GET /consola` (DEC-24). The endpoint SHALL return the identical response whether or not the `x-tenant-id` header is present, because the catalog is not tenant data.

#### Scenario: Requesting the catalog without a tenant header

- **GIVEN** the application is running with this change applied
- **WHEN** a client sends `GET /contrato` with no `x-tenant-id` header
- **THEN** the request SHALL succeed
- **AND** the response body SHALL equal the response body of the same request sent with a valid `x-tenant-id` header

#### Scenario: Requesting the catalog with an arbitrary tenant header

- **GIVEN** the application is running with this change applied
- **WHEN** a client sends `GET /contrato` with an `x-tenant-id` header naming a nonexistent tenant
- **THEN** the request SHALL succeed identically to the no-header case
- **AND** no tenant lookup SHALL gate the response
