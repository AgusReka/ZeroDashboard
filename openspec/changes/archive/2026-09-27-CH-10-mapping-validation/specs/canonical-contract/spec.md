# Delta for Canonical Contract

## MODIFIED Requirements

### Requirement: Each Field Is Marked Required or Optional, Names Its Automation, and Declares a Semantic Type

Every field in every catalog entity SHALL be marked required or optional at the field level, independent of its entity's own required/optional status. Every field SHALL carry at least one free-text automation label naming which automation(s) depend on it (DEC-22). The system SHALL NOT admit a field or entity that traces to no automation. Every field SHALL additionally declare exactly one semantic type from `texto`, `numero`, `booleano`, `fecha`, `identificador` (DEC-39). Fields named `id`, `pedidoId`, `productoId`, and `insumoId`, and `pedido.numero`, SHALL be typed `identificador`; every other field SHALL be typed by its meaning.
(Previously: fields were marked required/optional and named an automation, with no semantic type.)

Per-field types, derived from `src/contrato.ts`:

| Entity | Field | Type |
|---|---|---|
| producto | id | identificador |
| producto | nombre | texto |
| producto | stockDisponible | numero |
| producto | sku | texto |
| producto | activo | booleano |
| pedido | id | identificador |
| pedido | fechaCreacion | fecha |
| pedido | estado | texto |
| pedido | total | numero |
| pedido | numero | identificador |
| pedido | moneda | texto |
| item_pedido | id | identificador |
| item_pedido | pedidoId | identificador |
| item_pedido | productoId | identificador |
| item_pedido | cantidad | numero |
| item_pedido | precioUnitario | numero |
| insumo | id | identificador |
| insumo | nombre | texto |
| insumo | stockDisponible | numero |
| insumo | unidadMedida | texto |
| insumo | codigo | texto |
| receta_componente | productoId | identificador |
| receta_componente | insumoId | identificador |
| receta_componente | cantidadPorUnidad | numero |

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

#### Scenario: Every field declares one of the five semantic types

- **GIVEN** the catalog module after this change is applied
- **WHEN** every field across all five entities is inspected
- **THEN** each SHALL declare exactly one of `texto`, `numero`, `booleano`, `fecha`, `identificador`, matching the table above
- **AND** `producto.id`, `pedido.id`, `item_pedido.id`, `item_pedido.pedidoId`, `item_pedido.productoId`, `insumo.id`, `receta_componente.productoId`, `receta_componente.insumoId` SHALL be typed `identificador`

### Requirement: Read-Only Endpoint Projects the Catalog

The system SHALL expose `GET /contrato`, returning every canonical entity with its required/optional status, every field with its required/optional status, its automation label(s), and its semantic type, projected directly from the static catalog module. The endpoint SHALL be read-only and SHALL NOT accept a request body that mutates the catalog.
(Previously: projected required/optional status and automation labels, without a semantic type.)

#### Scenario: Retrieving the full catalog

- **GIVEN** the application is running with this change applied
- **WHEN** a client sends `GET /contrato`
- **THEN** the response SHALL list all five entities (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`)
- **AND** each entity SHALL be marked required or optional
- **AND** each entity's fields SHALL each be marked required or optional, SHALL each carry an automation label, and SHALL each carry a semantic type

## RENAMED Requirements

- FROM: `Each Field Is Marked Required or Optional and Names Its Automation`
  TO: `Each Field Is Marked Required or Optional, Names Its Automation, and Declares a Semantic Type`
