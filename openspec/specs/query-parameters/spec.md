# Query Parameters Specification

## Purpose

Declaring named, typed parameters for a user-authored SQL statement and rewriting them to positional driver binds, so parameter values are always substituted through the driver — never concatenated into SQL text (rule 4). This is a pure, reusable primitive consumed by `query-execution` (ad hoc and saved), and left in a shape `CH-12` (`Plantilla`) can adopt without redesign (DEC-52).

## Requirements

### Requirement: Declaration Shape and Type Vocabulary

The system SHALL represent a parameter declaration as a list of `{nombre, tipo}` entries, where `tipo` is one of `texto`, `numero`, `booleano`, `fecha` (DEC-49) — a vocabulary distinct from `TipoSemantico`. Each `nombre` SHALL match `^[A-Za-z_][A-Za-z0-9_]*$`, compared case-sensitively, and SHALL be unique within the declaration. Every declared parameter SHALL be required; the system SHALL NOT support default or optional parameters (DEC-50).

#### Scenario: Valid declaration accepted

- GIVEN a declaration `[{nombre: "desde", tipo: "fecha"}]`
- WHEN the declaration is validated
- THEN it SHALL be accepted

#### Scenario: Unknown tipo rejected

- GIVEN a declaration entry with `tipo: "identificador"` (not in the vocabulary)
- WHEN the declaration is validated
- THEN the system SHALL reject it with `400`, naming the offending entry

### Requirement: Named-Placeholder Rewrite to Positional Binds

The system SHALL scan statement text for `:nombre` tokens and rewrite each distinct declared name to a positional driver placeholder `$k`, binding a name repeated multiple times to a single `$k` reused at every occurrence (DEC-47). The scan SHALL be a plain text transform (no SQL parser, per DEC-09) and SHALL NOT rewrite a `:` that is part of `::cast`, inside a single-quoted string literal, inside a double-quoted identifier, inside a `--` or `/* */` comment, or inside a `$$...$$` (or tagged `$tag$...$tag$`) dollar-quoted block.

#### Scenario: Repeated name bound once

- GIVEN SQL `WHERE a = :x OR b = :x` and declaration `[{nombre:"x", tipo:"numero"}]`
- WHEN the rewrite runs
- THEN both occurrences SHALL become the same `$1`
- AND exactly one value SHALL be bound for `x`

#### Scenario: Cast operator is not rewritten

- GIVEN SQL containing `campo::text`
- WHEN the rewrite runs
- THEN `::text` SHALL remain unchanged and SHALL NOT be treated as a placeholder

#### Scenario: Colon inside a string literal is not rewritten

- GIVEN SQL containing `'hora: 10:30'`
- WHEN the rewrite runs
- THEN the literal's `:` characters SHALL remain unchanged

#### Scenario: Colon inside a quoted identifier is not rewritten

- GIVEN SQL containing `"col:x"`
- WHEN the rewrite runs
- THEN the identifier's `:` SHALL remain unchanged

#### Scenario: Colon inside a comment is not rewritten

- GIVEN SQL containing `-- nota: pendiente` or `/* nota: :x */`
- WHEN the rewrite runs
- THEN the commented `:` SHALL remain unchanged

#### Scenario: Colon inside a dollar-quoted block is not rewritten

- GIVEN SQL containing `$$texto :x$$`
- WHEN the rewrite runs
- THEN the dollar-quoted `:x` SHALL remain unchanged

### Requirement: Declared-but-Unused Parameter Is Rejected

WHEN a declared parameter's name has no corresponding `:nombre` marker in the statement text, the system SHALL reject the request with `400`, naming the unused parameter (DEC-56).

#### Scenario: Unused declaration rejected

- GIVEN declaration `[{nombre:"x", tipo:"numero"}]` and SQL with no `:x` marker
- WHEN the statement is validated
- THEN the system SHALL respond `400` naming `x`

### Requirement: Undeclared Marker Is Rejected

WHEN the statement text contains a `:nombre` marker with no matching entry in the declaration, the system SHALL reject the request with `400`, naming the undeclared marker (DEC-57).

#### Scenario: Undeclared marker rejected

- GIVEN SQL containing `:y` and a declaration that does not include `y`
- WHEN the statement is validated
- THEN the system SHALL respond `400` naming `y`

### Requirement: Value for an Undeclared Name Is Rejected

WHEN the supplied value map contains a name absent from the declaration, the system SHALL reject the request with `400`, naming the undeclared name (DEC-58).

#### Scenario: Extra value rejected

- GIVEN a declaration `[{nombre:"x", tipo:"numero"}]` and a value map `{x: 1, z: 2}`
- WHEN the request is validated
- THEN the system SHALL respond `400` naming `z`

### Requirement: Hand-Written `$n` Is Always Rejected

WHEN the statement text contains a `$n` token (matching `$` followed by digits) outside a string literal, quoted identifier, comment, or dollar-quoted block, the system SHALL reject the request with `400`, regardless of whether the statement declares any parameter (DEC-59).

#### Scenario: Hand-written positional bind rejected

- GIVEN SQL containing `WHERE id = $1` with no declared parameters
- WHEN the statement is validated
- THEN the system SHALL respond `400`

#### Scenario: Hand-written positional bind inside a literal is not rejected

- GIVEN SQL containing `'precio: $1'`
- WHEN the statement is validated
- THEN the literal's `$1` SHALL NOT trigger rejection

### Requirement: Two-Layer Value Validation With Fixed Wire Formats

The system SHALL validate each supplied value's JSON shape against its declared `tipo` before execution (DEC-51, DEC-60): `texto` accepts a JSON string; `booleano` accepts a JSON boolean; `numero` accepts a JSON number only (a numeric string is rejected); `fecha` accepts an ISO 8601 date (`2026-09-27`) or date-time string. WHEN a value's shape does not match, the system SHALL reject the request with `400`, naming the parameter. Postgres remains the final arbiter of the value's actual conversion at execution time.

#### Scenario: Wrong shape rejected before execution

- GIVEN a declared `numero` parameter and a value `"10"` (JSON string)
- WHEN the request is validated
- THEN the system SHALL respond `400` naming the parameter, before any statement executes

#### Scenario: Correct shape passed through to Postgres

- GIVEN a declared `fecha` parameter and a value `"2026-09-27T10:00:00Z"`
- WHEN the request is validated
- THEN the value SHALL pass the shape check
- AND Postgres SHALL receive it as a driver-bound parameter

### Requirement: Values Bound Only as Driver Parameters

The system MUST NOT concatenate a parameter's value into SQL text under any circumstance. Every declared parameter's value SHALL be supplied exclusively through the driver's positional bind mechanism (rule 4).

#### Scenario: Value never appears in generated SQL text

- GIVEN a declared parameter with a value containing SQL metacharacters (e.g. `O'Brien`, `; DROP TABLE t`)
- WHEN the statement is rewritten and executed
- THEN the final SQL text SHALL contain only `$k` placeholders, never the literal value
- AND the value SHALL be delivered solely through the driver `values` array

### Requirement: Bind Numbering Reserved for Declared Parameters

The rewrite SHALL number declared parameters `$1..$n` and SHALL report `n` (the count of distinct declared names) to the caller, so a consumer appending its own driver binds (e.g. pagination) can safely start at `$(n+1)` (DEC-53).

#### Scenario: Zero declared parameters yields n = 0

- GIVEN a statement with no declared parameters and no `:nombre` markers
- WHEN the rewrite runs
- THEN `n` SHALL be `0` and the statement text SHALL be unchanged
