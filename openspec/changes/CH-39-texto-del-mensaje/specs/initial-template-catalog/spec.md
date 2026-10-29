# Initial Template Catalog Specification (CH-39 delta)

## Purpose
The seeded templates keep the table: they declare no message texts.

## ADDED Requirements

### Requirement: Seeded Entries Declare No Message Texts (DEC-188)

Each catalog entry SHALL declare `encabezadoMensaje: null` and `lineaMensaje: null`, and the seeded rows SHALL store both as null. The entries' key set SHALL equal the keys of the full template projection.

#### Scenario: Fresh install

- GIVEN an empty `Plantilla` table
- WHEN the initial catalog is seeded
- THEN each of the two rows SHALL have `encabezadoMensaje` and `lineaMensaje` null

#### Scenario: Key set matches the projection

- GIVEN the catalog entries
- WHEN their keys are compared with the full template projection
- THEN they SHALL be equal
