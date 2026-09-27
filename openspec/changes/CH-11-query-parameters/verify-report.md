```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ae72cf6cf913087e22c86e9430330e6251247d4ddd41ca347f2807d6ed9bf511
verdict: pass
blockers: 0
critical_findings: 0
requirements: 19/19
scenarios: 37/37
test_command: TEST_DB_HOST=localhost TEST_DB_PORT=5434 TEST_DB_USER=zerodashboard TEST_DB_PASSWORD=change-me TEST_DB_NAME=zerodashboard npm test
test_exit_code: 0
test_output_hash: sha256:4c31fd08f7c029e46a585777cd7b9b769da162d595758235cffd05578adff973
build_command: npx tsc --noEmit && npx prisma validate
build_exit_code: 0
build_output_hash: sha256:5a39f09e393debef9553912e6218918f9d545e39869f94f39e24eb4a86303cda
```

## Verification Report

**Change**: CH-11-query-parameters
**Version**: N/A (no versioned spec numbering in this repository)
**Mode**: Standard (Strict TDD disabled)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 41 |
| Tasks complete | 39 (task 6.2, this report, completes on PASS; 6.3 is archive job) |
| Tasks incomplete | 2 (6.2 in progress via this report; 6.3 deferred to sdd-archive) |

Every task in Phases 1-5 and 6.1 is checked in tasks.md, with matching evidence in
apply-progress.md for each work unit (ch11/1 through ch11/7). No unchecked task belongs to a
core deliverable outside phase 6.

### Build & Tests Execution

**Build**: PASSED
```text
$ npx tsc --noEmit
(no output, exit 0)

$ npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid
(exit 0)
```

**Tests**: 406 passed / 0 failed / 0 skipped / 0 cancelled
```text
$ TEST_DB_HOST=localhost TEST_DB_PORT=5434 TEST_DB_USER=zerodashboard TEST_DB_PASSWORD=change-me TEST_DB_NAME=zerodashboard npm test
...
tests 406
suites 50
pass 406
fail 0
cancelled 0
skipped 0
todo 0
```

Matches the expected 406/406 baseline from apply-progress.md's final work unit (5b).

**Coverage**: Not available (no coverage tool configured in this repository)

### Spec Compliance Matrix

#### specs/query-parameters/spec.md

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Declaration Shape and Type Vocabulary | Valid declaration accepted | parametros.test.ts: validarDeclaracion accepts a valid entry | COMPLIANT |
| Declaration Shape and Type Vocabulary | Unknown tipo rejected | parametros.test.ts 2.1 tipo-desconocido; consultas.test.ts CH-11 unknown tipo refused by schema | COMPLIANT |
| Named-Placeholder Rewrite to Positional Binds | Repeated name bound once | parametros.test.ts 1.5 WHERE a = :x OR b = :x rewrites both to $1 | COMPLIANT |
| Named-Placeholder Rewrite to Positional Binds | Cast operator is not rewritten | parametros.test.ts 1.1 colon in normal state; cast unchanged | COMPLIANT |
| Named-Placeholder Rewrite to Positional Binds | Colon inside a string literal is not rewritten | parametros.test.ts 1.2 colon inside single-quoted string | COMPLIANT |
| Named-Placeholder Rewrite to Positional Binds | Colon inside a quoted identifier is not rewritten | parametros.test.ts 1.2 double-quoted identifier | COMPLIANT |
| Named-Placeholder Rewrite to Positional Binds | Colon inside a comment is not rewritten | parametros.test.ts 1.2 line comment and nested block comment | COMPLIANT |
| Named-Placeholder Rewrite to Positional Binds | Colon inside a dollar-quoted block is not rewritten | parametros.test.ts 1.2 dollar-quoted block, tagged and untagged | COMPLIANT |
| Declared-but-Unused Parameter Is Rejected | Unused declaration rejected | parametros.test.ts 2.2 sin-usar; consultas.test.ts SELECT 1 with declared x rejected sin-usar | COMPLIANT |
| Undeclared Marker Is Rejected | Undeclared marker rejected | parametros.test.ts 2.3 sin-declarar; consultas.test.ts SELECT :y rejected sin-declarar | COMPLIANT |
| Value for an Undeclared Name Is Rejected | Extra value rejected | parametros.test.ts 2.5 valor-no-declarado; consultas.test.ts extra value rejected | COMPLIANT |
| Hand-Written dollar-n Is Always Rejected | Hand-written positional bind rejected | parametros.test.ts 2.4 posicional-a-mano; consultas.test.ts SELECT $1 rejected | COMPLIANT |
| Hand-Written dollar-n Is Always Rejected | Hand-written bind inside a literal is not rejected | parametros.test.ts literal dollar-1 has no posicional | COMPLIANT |
| Two-Layer Value Validation With Fixed Wire Formats | Wrong shape rejected before execution | parametros.test.ts 2.7 DEC-60 shape table, string "10" rejected for numero | COMPLIANT |
| Two-Layer Value Validation With Fixed Wire Formats | Correct shape passed through to Postgres | consultas.test.ts CH-11 each tipo filters its live column through a driver bind | COMPLIANT |
| Values Bound Only as Driver Parameters | Value never appears in generated SQL text | parametros.test.ts 2.8 value never in the text; consultas.test.ts SQL metacharacters come back as data, table intact | COMPLIANT |
| Bind Numbering Reserved for Declared Parameters | Zero declared parameters yields n = 0 | parametros.test.ts 1.6 zero markers, n is 0, text byte-identical | COMPLIANT |

query-parameters summary: 17/17 scenarios compliant.

#### specs/query-execution/spec.md

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Paginated Execution of a Read-Only Statement | Executing a SELECT against a reachable, correctly-privileged connection | consultas.test.ts, pre-existing CH-04/CH-07 suite, unedited, still green | COMPLIANT |
| Paginated Execution of a Read-Only Statement | Zero-parameter query is byte-identical to prior behavior | consulta-ejecucion.test.ts: zero parameters produce the pre-CH-11 wrapped text and binds, byte for byte | COMPLIANT |
| Paginated Execution of a Read-Only Statement | Declared parameters bind before pagination own binds | consulta-ejecucion.test.ts: two declared parameters bind at 1 and 2, pagination at 3 and 4; consultas.test.ts page 2 with two parameters binds at 3 and 4 | COMPLIANT |
| Inline Parameter Declaration and Values on Ad Hoc Execution | Ad hoc execution with inline parameters | consultas.test.ts CH-11 each tipo filters its live column through a driver bind | COMPLIANT |
| Parameter Validation Errors Are Reported Before Execution | Validation failure executes nothing | consultas.test.ts CH-11 every parameter failure is 400 naming the parameter, before any lookup; uses an unreadable-credential connection, a stronger proof than a closed port since not even the lookup runs | COMPLIANT |
| Connection Lookup Remains Tenant-Scoped With Parameters Present | Parametrized execution against another tenant connection | consultas.test.ts CH-11 a parametrized request naming another tenant connection is 404 | COMPLIANT |

query-execution summary: 6/6 scenarios compliant.

#### specs/saved-queries/spec.md

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Creating a Saved Query | Creating a valid saved query | consultas-guardadas.test.ts 2.2 a valid create persists the full row, readable by get-by-id | COMPLIANT |
| Creating a Saved Query | Creating a saved query with a valid declaration | consultas-guardadas.test.ts CH-11 4.3 a valid declaration is persisted as submitted and returned by get-by-id | COMPLIANT |
| Creating a Saved Query | Creating a saved query with an unused or undeclared parameter | consultas-guardadas.test.ts CH-11 4.3 a declaration that does not match the statement is rejected and creates no row | COMPLIANT |
| Creating a Saved Query | Saving a query with a name already in use | consultas-guardadas.test.ts 2.8 two saved queries may share a nombre, and both persist independently | COMPLIANT |
| Creating a Saved Query | No active tenant resolvable | contexto-tenant.test.ts 2.1 a scoped route with no X-Tenant-Id answers 400 tenant-no-indicado, applies uniformly to consultas-guardadas via the shared onRequest hook | COMPLIANT |
| Retrieving a Saved Query by Id | Retrieving an existing saved query | consultas-guardadas.test.ts CH-11 4.3 a valid declaration is persisted as submitted and returned by get-by-id | COMPLIANT |
| Retrieving a Saved Query by Id | Retrieving another tenant saved query | consultas-guardadas.test.ts CH-11 4.4 another tenant saved query answers 404 and leaks none of its fields | COMPLIANT |
| Retrieving a Saved Query by Id | Retrieving an unknown id | consultas-guardadas.test.ts 2.9 an unknown id answers a legible 404, with no driver error or stack | COMPLIANT |
| Creation Rejects an Invalid Parameter Declaration Shape | Unknown tipo in a saved declaration | consultas-guardadas.test.ts CH-11 4.3 an unknown tipo is rejected naming the entry and creates no row | COMPLIANT |

saved-queries summary: 9/9 scenarios compliant.

#### specs/query-console/spec.md

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Per-Parameter Input Rendering | Rendering inputs for a declared parameter | consola.test.ts: a declared parameter renders one control labeled with its nombre, and a blank is omitted | COMPLIANT |
| Per-Parameter Input Rendering | Submitting collected parameter values | consola.test.ts: execute sends each value with the JSON type its tipo requires | COMPLIANT |
| Saving and Loading the Parameter Declaration With a Query | Declaration saved with the query | consola.test.ts: save sends the declaration only, and loading rebuilds the rows with empty values | COMPLIANT |
| Saving and Loading the Parameter Declaration With a Query | Declaration loaded with the query | consola.test.ts: save sends the declaration only, and loading rebuilds the rows with empty values | COMPLIANT |
| Parameter Validation Error Surfaced Legibly | A parameter error is shown legibly | consola.test.ts: each parameter problem is one legible line naming the parameter, never a raw error; a save refused for its declaration shows one line per problem | COMPLIANT |

query-console summary: 5/5 scenarios compliant.

Overall compliance: 37/37 scenarios compliant, 19/19 requirements covered.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Rule 4, values only via driver binds | Implemented | reescribirMarcadores in src/parametros.ts only ever inserts dollar-k tokens into the text; prepararSentencia freezes texto plus valores with a brand only itself can construct, so no other code path can hand raw SQL with spliced values to ejecutarConsulta. Verified by unit test 2.8 and the integration test with SQL-metacharacter values. |
| Tenant never taken from the request | Implemented | destinoDeConexion and the Prisma isolation extension in aislamiento-prisma.ts resolve tenantId from exigirTenantActivo, never from the body; findUnique and create on ConsultaGuardada and Conexion have tenantId injected or overwritten by aplicarAlcance, not read from client input. Verified by the cross-tenant 404 tests in both consultas.test.ts and consultas-guardadas.test.ts. |
| Zero-parameter path byte-identical | Implemented | sentenciaPaginada computes the pagination binds from sentencia.valores.length; with n equal to 0 this is exactly the pre-CH-11 LIMIT and OFFSET binds, and reescribirMarcadores returns the input sql unchanged when no names are declared. Verified by consulta-ejecucion.test.ts explicit byte-identity test and parametros.test.ts 1.6. |
| Migration correctness | Implemented | prisma/migrations/20260927000000_consulta_parametros/migration.sql emits exactly the additive ALTER TABLE ADD COLUMN statement the design specifies, confirmed by npx prisma validate and by apply-progress.md recorded backfill check. Down path is DROP COLUMN, consistent with the rollback plan. |
| No SQL parser, DEC-09 | Implemented | The scanner in src/parametros.ts is a plain-text state machine over regex-driven token matching; no parsing library is imported anywhere in the diff. |
| DEC-47 through DEC-60 all recorded before use | Implemented | docs/01-decisiones.md carries DEC-47 through DEC-60, each cited by its own commit message and by the relevant code comment. |

### Design Coherence

| Decision (design.md) | Followed | Notes |
|---|---|---|
| PeticionEjecucion.sentencia of type SentenciaPreparada replaces sql | Yes | src/consulta-ejecucion.ts: no raw sql field remains on the execution input. |
| sanearSql runs once, in the route, not in ejecutarConsulta | Yes | Confirmed in src/consultas.ts (route) and src/consulta-ejecucion.ts doc comment; the CH-10 probe still calls it locally for its own unrelated wrapper, outside this change scope. |
| Bind order equals declaration index plus one | Yes | reescribirMarcadores numbers via nombres.forEach with indice plus 1. |
| No casts injected | Yes | The rewrite only emits dollar-k; no cast is ever appended. |
| fecha bind is the validated ISO string, not a Date object | Yes | validarValores and FORMA.fecha keep the value as a string; nothing converts it to a Date. |
| Route schema: containers and keys only, no scalar type on nombre, values, or tipo beyond enum | Yes | Both ejecucionSchema and registroConsultaGuardadaSchema match this exactly, with the documented AJV-coercion rationale in comments. |
| Error body 400 with error, campos, problemas in a fixed order | Yes | MOTIVOS_PARAMETRO fixes the order via ordenar; both routes render the same shape. |
| Check order: parameters before destinoDeConexion | Yes | src/consultas.ts calls prepararSentencia before destinoDeConexion. |
| Save path runs static checks only, no values | Yes | src/consultas-guardadas.ts calls validarDeclaracion and analizarSentencia, never prepararSentencia or validarValores. |
| parametros Json default empty array, projected by create and get-by-id only | Yes | ConsultaGuardadaCompleta includes it; ConsultaGuardadaResumen, the list projection, does not. |
| Values never logged | Yes | app.log.warn in src/consultas.ts logs only fase, categoria, codigo and durationMs, never sentencia or valores. |
| Console: blank value omits the key | Yes | valoresActuales returns early without setting the key when the raw text is empty. |
| Console: save sends declaration only | Yes | guardar's payload has no valores field. |

No design deviation was found that breaks a spec requirement.

### Evaluation of Recorded Deviations

1. Unknown tipo rejected by the schema enum gives campos only, no problemas. Confirmed in
   src/consultas.ts: the request.validationError branch runs before prepararSentencia is ever called,
   so AJV schema-level enum rejection short-circuits with error plus campos and no problemas array.
   This matches the existing camposInvalidos pattern used by every other route in the codebase, and
   the design own rationale for keeping tipo schema-typed as an enum with no type is exactly to let
   AJV catch this case before prepararSentencia runs. Not a spec violation: the Unknown tipo rejected
   scenario only requires a 400 naming the offending entry, and campos with the parametros zero tipo
   path satisfies that. WARNING level: minor inconsistency in error shape between this one rejection
   path and every other parameter rejection, which does carry problemas. Cosmetic, not a functional or
   security gap.
2. Task 3.5 used an unreadable-credential connection instead of a closed port to prove nothing was
   dialed. Verified in consultas.test.ts via sembrarCredencialCruda. This is a stronger proof, as
   documented: a closed port still requires destinoDeConexion to run and the credential to be
   decrypted before the dial fails, whereas an unreadable credential fails inside the lookup itself
   before any connection attempt. Accepted as-is, not a gap.
3. The arr-lo-hi documented limit. Verified against the design Documented limits section and
   parametros.test.ts explicit test: arr-lo-hi yields marker hi; arr-lo-space-colon-space-hi and
   arr-1-colon-2 do not. This is a stated rule-6 boundary of the artifact, not scope creep into the
   engine, consistent with AGENTS.md anti-alcance guidance that a near-fit case is documented as a
   limit of the artifact rather than given new engine capability. Accepted as-is.
4. The escape-string doubled-quote handling. The design scanner table describes an escape string only
   via a backslash escape; the implementation additionally treats a doubled quote as an embedded
   quote, matching real Postgres behavior, a strict superset of the documented behavior that cannot
   cause the design grammar to accept less than specified. Covered by parametros.test.ts doubled-quote
   and escape-string cases. Accepted as-is.
5. Unit splits, phase 2 into 2a and 2b, phase 5 into 5a and 5b. Purely a delivery and PR-sizing
   decision under the 400-line budget guard; tasks.md and apply-progress.md both show every
   constituent task, 2.1 through 2.11 and 5.1 through 5.6, checked and evidenced. No functional gap.

None of the five recorded deviations rises to CRITICAL; none breaks a spec scenario or a
non-negotiable rule from AGENTS.md.

### Issues Found

**CRITICAL**: None

**WARNING**:
1. The schema-level tipo rejection (400 with error and campos, no problemas) is a narrower error
   shape than every other CH-11 parameter rejection, which always includes problemas. Purely cosmetic
   for the console today (it already falls back to a campos-based message), but a future API consumer
   that only reads problemas would silently see nothing for this one case. Consider, in a later
   change, giving tipo a real value validated post-schema so the shape is uniform; not required by
   any spec scenario today.
2. docs/02-mapa-de-changes.md was not inspected beyond confirming CH-11 is not yet archived; verifying
   its CH-11 entry reflects in-progress state, not yet done, is left to sdd-archive, consistent with
   task 6.3 scope.

**SUGGESTION**:
1. Coverage is not measured by any configured tool in this repository; if a future change wants a
   quantitative regression signal for the scanner edge-case density, a node test coverage flag would
   be a low-cost addition, out of scope for CH-11.
2. The design Migration and Rollout section calls for five stacked PRs of at most 400 lines each;
   apply-progress.md shows unit 1 landed at 403 lines, self-reported as slightly above 400 and not
   compressed per the budget rule. An accepted, self-reported minor overage with no functional
   consequence.

### Verdict

PASS

All 19 requirements and 37 scenarios across the four specs (query-parameters, query-execution,
saved-queries, query-console) are implemented and covered by a passing test, rule 4 and tenant
isolation hold by construction and by test, the zero-parameter path is proven byte-identical, the
migration is additive and correct, and every pre-recorded deviation was independently checked against
the design and found consistent with it. npx tsc --noEmit, npx prisma validate, and the full test
suite (406 pass, 0 fail) all pass.
