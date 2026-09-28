# Delta for Query Parameters

## ADDED Requirements

### Requirement: Plantilla Is a Third Declaration Source (DEC-52)

The `Plantilla.parametros` field SHALL reuse this capability's declaration shape (`{nombre, tipo}`) and named-placeholder rewrite unmodified. The same validations already applied to saved queries SHALL apply at `Plantilla` create/replace time: a declared-but-unused parameter is rejected (DEC-56), an undeclared `:marker` is rejected (DEC-57), and a hand-written `$n` is always rejected (DEC-59). Values supplied when testing a template SHALL be bound only as driver parameters (rule 4).

#### Scenario: Same rewrite mechanism applies to a template

- GIVEN a `Plantilla` whose `sql` contains `:desde` and a matching declaration
- WHEN the template is tested with a value for `desde`
- THEN the rewrite SHALL bind it positionally, identically to a saved query's own parameter handling

#### Scenario: Undeclared marker rejected at template save time

- GIVEN a `Plantilla` payload whose `sql` contains `:y` with no matching entry in `parametros`
- WHEN the template is created or replaced
- THEN the response SHALL be `400` naming `y`
