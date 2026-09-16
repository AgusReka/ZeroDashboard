# Design: CH-04 — Read-Only Query Execution

## Inputs

- `proposal.md` (this change)
- `specs/query-execution/spec.md` and `specs/query-console/spec.md` (this change) — both existed when this design was finalized and are reconciled scenario-by-scenario in the scope check below, not only against the proposal's criteria
- Engram `sdd/CH-04/explore` (obs #35) and `sdd/CH-04/research` (obs #37) — claims C1–C14 and gaps 1–2 are cited inline
- CH-03 `design.md` (probe mechanics, race-based budget, classification table, credential-safety boundaries) and CH-01 `design.md` (Fastify, env-only configuration, `register<X>Route(app, prisma)`)
- `docs/01-decisiones.md` DEC-07, DEC-08, DEC-09 (firm, cited not re-opened), DEC-05 (design-level resolution precedent); `docs/00-contexto.md` §5 rules 1, 3, 4, 7

## Decisions resolved at design level

Same class as CH-01's framework/ORM calls under DEC-05: implementation choices inside already-fixed decisions, not new architecture gates. Decisions 1 and 2 are the two the proposal explicitly deferred here.

### 1. A superuser role is an unconditional hard block, checked separately from the privilege enumeration

**The research's gap-2 claim is confirmed, not assumed.** PostgreSQL's role-attribute semantics are explicit that a database superuser bypasses all permission checks except the right to log in. This design session had no network access, so the claim is resolved from documented engine semantics rather than a fresh doc fetch, and is pinned by a mandatory integration test (see Testing strategy) rather than trusted.

The consequence is sharper than "the check is meaningless". Because `has_*_privilege()` reports the privileges the executor would actually grant, and the executor grants a superuser everything, a superuser normally returns `true` from the table leg anyway — so the enumeration usually *does* catch it. It fails in exactly two places: a target database with no non-system tables and no `CREATE`-able schema (enumeration finds zero rows → a clean result), and legibility (the operator is told "this role can write to a table", which is a confusing way to say "this role is a superuser").

**Alternatives considered:** rely on the enumeration alone (fails open on the empty-enumeration case, and reports a misleading reason); check `rolsuper` but treat it as a warning (contradicts DEC-08(c), which is block-not-warn).

**Decision:** `pg_roles.rolsuper OR pg_roles.rolbypassrls` for `current_user` is evaluated first and, when true, blocks execution with its own category `rol-superusuario`, regardless of what the other two legs return. `rolbypassrls` is included because a role that bypasses row-level security defeats the one remaining containment the tenant could have applied, even though it is not itself a write privilege. `pg_roles` is readable by any role.

### 2. `has_*_privilege()` resolves `INHERIT` chains; `NOINHERIT` membership is the residual gap, and it is documented, not hidden

**Finding on research gap 1.** These are privilege-*evaluation* functions: they answer the same question the executor asks before running a command, using the same access-mask evaluation, which walks role memberships the role holds privileges *of*. Privileges inherited through an `INHERIT` membership chain are therefore resolved correctly — the same reason a member role can simply run `INSERT` without any `SET ROLE`.

The genuinely open half is the mirror image: a role holding membership with `NOINHERIT` does **not** hold those privileges in its own right, so `has_table_privilege()` correctly returns `false` — and that role can still reach them by issuing `SET ROLE` inside its session. The privilege check cannot see that, by construction.

**Decision:** trust the functions for inheritance (they are the correct instrument, and the alternative — hand-walking `pg_auth_members` — would reimplement the engine's own evaluation worse). Design defensively for the `NOINHERIT` + `SET ROLE` path instead of pretending it does not exist: it is contained by DEC-09's leg, because `SET ROLE` does not lift a `READ ONLY` transaction — the transaction attribute is checked at execution time regardless of which role is current. This is written into the known-limits section, and both halves are pinned by integration tests rather than assumed.

### 3. The privilege check is one round trip of three `EXISTS` legs, over catalogs rather than `information_schema`

Run as the first statement inside the read-only transaction. Fixed literal SQL, zero interpolation, zero user input, submitted with `[]` (rule 4 is satisfied trivially — there is nothing to parameterize):

```sql
SELECT
  EXISTS (SELECT 1 FROM pg_catalog.pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls))          AS es_superusuario,
  EXISTS (SELECT 1 FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r','p','v','m','f')
            AND n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\_%'
            AND has_table_privilege(c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))     AS escribe_en_tabla,
  EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
          WHERE n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\_%'
            AND has_schema_privilege(n.oid, 'CREATE'))                           AS crea_en_esquema
```

**Alternatives considered:** `information_schema.tables` / `information_schema.schemata` as the enumeration source (the proposal's sketch). Rejected on two counts: those views apply their own visibility filter whose exact definition has shifted across PostgreSQL versions, so "every schema visible to the role" would silently mean different sets on different servers; and they expose only `schema.name` text, forcing a `format('%I.%I')::regclass` round trip that breaks on quoting edge cases. `pg_class`/`pg_namespace` are world-readable, give an OID that `has_table_privilege()` accepts directly with no quoting at all, and enumerate *every* object rather than a filtered subset — strictly more complete, which is the right bias for a refuse-check. Also rejected: `count(*)` per leg (`EXISTS` short-circuits on the first hit; on a large schema this matters) and per-row round trips (N+1 against a tenant's live replica).

System schemas are excluded because only a superuser holds write privilege there, and decision 1 already catches that case first.

**Blocking precedence and reasons** (the spec requires table-write and schema-`CREATE` to be *separately* reportable):

| Leg true | `fase` | `categoria` | Legible reason shown |
|---|---|---|---|
| `es_superusuario` | `permisos` | `rol-superusuario` | the connected role is a superuser and bypasses every permission check |
| `escribe_en_tabla` | `permisos` | `rol-con-escritura-en-tabla` | the connected role holds write privilege on at least one table |
| `crea_en_esquema` | `permisos` | `rol-con-create-en-esquema` | the connected role holds schema-level `CREATE` |

Evaluated in that order; the first true one blocks. No user statement is ever sent when any leg blocks — the transaction is rolled back and the client closed.

### 4. Read-only enforcement: both DEC-09 legs, in one transaction, closed by `ROLLBACK` always

Statement order on the open client: `BEGIN TRANSACTION READ ONLY` → timeout (decision 5) → privilege check (decision 3) → the wrapped user statement → `ROLLBACK`.

- **Extended protocol.** Every statement the app sends, including the user's, goes through `client.query({ text, values, rowMode: 'array' })` with a `values` array — `[]` where there is nothing to bind. Passing any array forces the Parse/Bind/Execute path, where PostgreSQL's own wire protocol rejects multi-statement text (C5/C6); this is documented protocol behavior, not a driver accident, so it is not version-fragile.
- **`READ ONLY` transaction.** Writes and DDL are refused by the engine at SQLSTATE `25006` (C1/C2) — including a data-modifying CTE, which is syntactically one statement and therefore passes the protocol leg untouched (C4). Neither leg is redundant.

  **C4 amended (2026-09-16), verified live against PostgreSQL 16.** A data-modifying CTE is refused by *two* engine mechanisms, and which one fires depends on decision 6's pagination wrapper:

  | Statement as submitted to the server | Transaction | SQLSTATE | Refused by |
  |---|---|---|---|
  | `WITH x AS (DELETE …) SELECT * FROM x` (top level, unwrapped) | `READ ONLY` | `25006` | `PreventCommandIfReadOnly` — execution time |
  | `SELECT * FROM (WITH x AS (DELETE …) SELECT * FROM x) AS _consulta_usuario LIMIT $1 OFFSET $2` | `READ ONLY` | `0A000` | parse analysis — "WITH clause containing a data-modifying statement must be at the top level" |
  | the same wrapped form | `READ WRITE` | `0A000` | parse analysis — isolates the wrapper, not `READ ONLY`, as the cause |

  C4's original claim — that the CTE reaches the `READ ONLY` leg and is stopped there at `25006` — holds only for the unwrapped statement. **On this implementation's actual path the wrapper always applies**, so the CTE is never a top-level statement, PostgreSQL rejects it during parse analysis, and the executor (and therefore `ExecCheckXactReadOnly`) is never reached. `0A000` is the code this change will observe in practice; `25006` remains reachable for a write or DDL that is *not* a CTE (`DELETE FROM t`, `CREATE TABLE …`), which the wrapper cannot demote because it is refused as a subquery target anyway.

  This is two of the design's own decisions interacting, not a defect: the rejection is engine-enforced on both paths, fails closed, and writes nothing. To keep the *guarantee* independent of which mechanism fires, decision 7 maps both SQLSTATEs to `no-es-lectura` (see its table). The operator therefore always gets "this statement is not a read, nothing was executed", and the raw `codigo` in the response still distinguishes the two catch points for anyone debugging.
- **`rowMode: 'array'`** so duplicate output column names (`SELECT 1 AS a, 2 AS a`) survive; column names come from `result.fields`.
- **`ROLLBACK`, never `COMMIT`.** A read-only transaction has nothing to commit, so `COMMIT` and `ROLLBACK` are semantically identical here and `ROLLBACK` collapses the success and failure paths into one close, removing a branch that could only ever be wrong.

**No app-side keyword or regex pre-check is added, and none may be added later.** Both legs above are engine-enforced facts. A keyword blocklist would be a second, weaker, always-outdated boundary that invites someone to "fix" a gap by extending a regex instead of the engine.

### 5. Execution timeout: server-side `statement_timeout`, with a race-based client backstop — and never an elapsed-time comparison

CH-03's most expensive bug was inferring "the budget was exhausted" by comparing a measured duration against the budget it was measured against. That class of bug is excluded here by construction: a timeout is only ever recorded when it is a **fact**, from one of two unambiguous sources.

1. **Primary: server-side.** `SELECT set_config('statement_timeout', $1, true)` immediately after `BEGIN`. The function form is chosen over `SET LOCAL statement_timeout = …` specifically because `SET` takes no bind parameters, so it would require splicing the configured number into SQL text; `set_config` takes it as `$1` and satisfies rule 4 literally. `is_local = true` scopes it to the transaction, so it cannot leak into a reused session. The server aborts the statement itself and reports SQLSTATE `57014` — a machine-readable code, read exactly like every other code.
2. **Backstop: the CH-03 race, unchanged in shape.** The whole execution phase is raced against the module's own `setTimeout` at `queryTimeoutMs + MARGEN_RESPALDO_EJECUCION_MS`. If that timer wins, the attempt exhausted its budget as a fact of who won the race — no clock is consulted to decide it. This covers the case the server-side timer cannot: a connection that stops answering at all, where `57014` would never arrive.

The execution-phase margin is **2000 ms**, not the connect phase's 500 ms: after `statement_timeout` fires the server must abort the statement, unwind it, and deliver the error across the network, none of which the connect-phase backstop ever had to cover.

`duracionMs` is reported to the client and consulted by nothing.

**Alternatives considered:** a `pg` client-level query timeout option (client-side only — the statement would keep burning CPU on the tenant's replica after the app gave up, which is the exact availability risk the explore flagged); reusing CH-03's race alone with no server-side timer (same defect: nothing stops the runaway query on the tenant's side).

Budget: `queryTimeoutMs`, optional env `QUERY_TIMEOUT_MS`, default `15000`, positive-integer validated exactly like `CONNECTION_TEST_TIMEOUT_MS` already is. It is distinct from the connection budget and is **not** A4 — A4's tenant-facing, per-query configurability stays in CH-07.

### 6. Pagination wrapper, semicolon strip, and the accepted comment failure

```
SELECT * FROM (<sql saneado>) AS _consulta_usuario LIMIT $1 OFFSET $2
```

`sqlSaneado` = `trim()` → strip **exactly one** trailing `;` → `trim()` again (C12). Plain string trimming, not parsing — DEC-09's no-parser constraint is untouched. Empty after trimming is a request-shape failure (`400`), not an execution verdict.

`$1` is bound to `limite + 1`: if the extra row comes back, `hayMas` is true and the extra row is sliced off before responding. This is preferred over `SELECT count(*) FROM (<query>) AS sub`, which would double the load on the tenant's live replica for every page view in a system that has no execution accounting yet.

**Accepted, stated, not prevented (C13):** a trailing `--` line comment or an unterminated `/* */` block comment in the pasted statement comments out the wrapper's closing parenthesis. DEC-09 has no parser *by design*, so this is not detected — it fails closed with a PostgreSQL syntax error before anything executes, and surfaces as a legible `error-sintaxis` per the console spec. That is the designed behavior, not an oversight to fix later with a regex.

### 7. Execution errors get a sibling classifier, not an extension of `classifyConnectionError`

**Alternatives considered:** widening `classifyConnectionError` to cover execution SQLSTATEs. Rejected: its eight-row table is a verified CH-03 artifact pinned by `src/db-probe.test.ts`, it describes a phase in which a `42601` can never occur, and merging the two would produce one function whose result type means different things depending on when it was called.

**Decision:** a sibling pure function `classifyExecutionError(error): { categoria, codigo }` in the new engine module, and the two shared sanitizers — the raw-code reader and the allowlist gate, today module-private in `src/db-probe.ts` — are **moved** (not copied) into a new `src/pg-error.ts` that both import. `src/db-probe.test.ts` must pass unchanged; it is the regression guard for that move. `classifyConnectionError` keeps its exact behavior and stays a pure function of the error alone.

The response carries `fase` (`conexion` | `permisos` | `ejecucion`) so the two closed category sets never have to be told apart by guessing.

| # | Observed | `categoria` (`fase: ejecucion`) |
|---|---|---|
| 1 | the engine's own timer won the race | `tiempo-agotado` |
| 2 | `57014` (`query_canceled`) | `tiempo-agotado` |
| 3 | `25006` (`read_only_sql_transaction`) **or** `0A000` (`feature_not_supported`, a data-modifying CTE below the top level) | `no-es-lectura` |
| 4 | `42501` (`insufficient_privilege`) | `permiso-denegado` |
| 5 | any other `42***` | `error-sintaxis` |
| 6 | any `22***` (data exception, e.g. division by zero) | `error-datos` |
| 7 | anything else, including a non-`Error` throw | `error-desconocido` |

Row 4 is ordered before row 5 because `42501` is itself in class 42. The connection phase reuses CH-03's six `CategoriaFallo` values unchanged under `fase: 'conexion'`.

**Row 3 carries two SQLSTATEs on purpose (amended 2026-09-16).** Per decision 4's amended C4 table, the engine refuses a non-read at two different points — execution time (`25006`) and parse analysis (`0A000`, which is what decision 6's wrapper makes the common case) — and the operator's verdict is the same either way: the statement is not a read and nothing ran. Mapping only `25006` would send the path this implementation actually takes to row 7, showing "failed for an unrecognized reason" for the single most explicable rejection the system produces. The two are *not* merged: `codigo` still reports the exact SQLSTATE, so the catch point stays visible in the response and in logs. `0A000` is matched as a literal code rather than by SQLSTATE class, because class `0A` is `feature_not_supported` generally and a future unrelated `0A***` should not silently inherit this category.

**Accepted limit, stated explicitly:** multi-statement text and an ordinary syntax error both arrive as `42601` and land in `error-sintaxis` (row 5). They are distinguishable only by the server's message text, which is locale-dependent (`lc_messages`) and which CH-03's rule-7 discipline forbids reading. Rejected alternatives: scanning for a non-trailing `;` (false-positives on any semicolon inside a string literal, rejecting legal queries) and matching message text (locale-fragile and a rule-7 regression). The spec requires the multi-statement submission to be *rejected with nothing executed*, which is satisfied by the engine; the console's message for `error-sintaxis` therefore names both causes — invalid syntax, or more than one statement in a single execution.

### 8. The console is one route returning one self-contained document; no static-file dependency

**Alternatives considered:** `@fastify/static` plus a `public/` directory. It is the conventional answer and it is the wrong size here: it adds a runtime dependency, and `tsc` does not copy non-TS files, so it also forces a build-pipeline change (a copy step in `npm run build`) for a single file. Also considered and rejected: a template engine (`@fastify/view` — same cost, more of it) and any frontend framework or CDN script (a build toolchain and a third-party script origin, for a textarea and a table).

**Decision:** `GET /consola` returns one HTML document held as a template-literal constant in `src/consola.ts`, `Content-Type: text/html; charset=utf-8`, with vanilla inline JS — `fetch()` to `POST /consultas/ejecutar`, a `<table>` render, prev/next controls, one error banner. No dependency added, no build change, rollback is deleting one file. `/` is deliberately left unclaimed.

**Rendering is `textContent`, never `innerHTML`.** Every cell value and every error string is assigned through `textContent` (or `document.createTextNode`). The rows come from a tenant's replica — arbitrary third-party data — and this is the project's first browser surface; `innerHTML` would make a stored `<script>` in the tenant's data execute in the operator's session. This is a mechanism, not a convention: it is the single reviewable boundary that makes the console safe to point at untrusted data.

Rule 1 is not engaged: the console is P1-only and no P2 surface exists.

### 9. Route shapes follow CH-03's envelope exactly

A completed execution attempt is `200` whatever its verdict — the operation succeeded, the verdict is in the body. HTTP error codes stay reserved for failures of the request itself: `400` (schema validation or empty SQL), `404` (unknown `conexionId`). A privilege block is `200 {resultado:"fallo", fase:"permisos", …}`, not `403`: it is a verdict about the tenant's database, not about the caller's authorization to use our API.

## Contracts

```jsonc
// POST /consultas/ejecutar  (Fastify JSON schema; additionalProperties: false)
{ "conexionId": "…", "sql": "SELECT id, nombre FROM producto ORDER BY id",
  "limite": 50, "desplazamiento": 0 }      // limite 1..200 default 50; desplazamiento >= 0 default 0

// 200 — success
{ "resultado": "ok", "fase": "ejecucion",
  "columnas": ["id", "nombre"], "filas": [[1, "Café"], [2, "Té"]],
  "paginacion": { "limite": 50, "desplazamiento": 0, "hayMas": true, "siguienteDesplazamiento": 50 },
  "duracionMs": 37 }

// 200 — every failure verdict, same envelope
{ "resultado": "fallo", "fase": "permisos",   "categoria": "rol-con-create-en-esquema", "codigo": null,    "duracionMs": 9 }
{ "resultado": "fallo", "fase": "ejecucion",  "categoria": "no-es-lectura",             "codigo": "25006", "duracionMs": 12 }
{ "resultado": "fallo", "fase": "conexion",   "categoria": "tiempo-agotado",            "codigo": null,    "duracionMs": 5001 }

// GET /consola — 200 text/html
```

Credential safety is inherited wholesale from CH-03 and re-asserted for a wider error surface: the `Conexion` row is fetched with an explicit `select` that includes `credencial` only on this path, the value is handed straight to the engine and never returned to the handler, the raw driver error never escapes the engine module, `codigo` passes the same allowlist regex, and logging is `app.log.warn({ conexionId, fase, categoria, codigo, durationMs }, 'query execution failed')` — never the `app.log.error(error, …)` form used in `src/health.ts`. The console renders only these fields, so no page can display more than the API returned.

## Flow

```mermaid
sequenceDiagram
    participant U as Console (GET /consola)
    participant R as POST /consultas/ejecutar
    participant P as Prisma (own DB)
    participant T as Target Postgres

    U->>R: {conexionId, sql, limite, desplazamiento}
    R->>P: findUnique(conexionId) + credencial
    P-->>R: row (or null -> 404)
    R->>T: pg.Client(discrete fields) + connect(), raced against the connect budget
    R->>T: BEGIN TRANSACTION READ ONLY
    R->>T: SELECT set_config('statement_timeout', $1, true)
    R->>T: privilege check (3 EXISTS legs, values [])
    alt role holds no write / CREATE / superuser
        T-->>R: (false, false, false)
        R->>T: SELECT * FROM (<sql saneado>) AS _consulta_usuario LIMIT $1 OFFSET $2  (values [limite+1, desplazamiento])
        T-->>R: rows + fields
        R->>T: ROLLBACK
        R-->>U: 200 {resultado:"ok", columnas, filas, paginacion:{hayMas}}
    else role holds write or CREATE privilege
        T-->>R: escribe_en_tabla = true
        R->>T: ROLLBACK (user statement never sent)
        R-->>U: 200 {resultado:"fallo", fase:"permisos", categoria:"rol-con-escritura-en-tabla"}
    else multi-statement text
        R->>T: Parse of "SELECT 1; SELECT 2" over the extended protocol
        T-->>R: 42601 — the server refuses multiple commands in one prepared statement
        R->>T: ROLLBACK
        R-->>U: 200 {resultado:"fallo", fase:"ejecucion", categoria:"error-sintaxis", codigo:"42601"}
    else data-modifying CTE (wrapped, so refused at parse analysis)
        T-->>R: 0A000 — a data-modifying CTE must be at the top level
        R->>T: ROLLBACK (nothing was written)
        R-->>U: 200 {resultado:"fallo", fase:"ejecucion", categoria:"no-es-lectura", codigo:"0A000"}
    else other write or DDL (refused by the READ ONLY transaction)
        T-->>R: 25006 — read-only transaction
        R->>T: ROLLBACK (nothing was written)
        R-->>U: 200 {resultado:"fallo", fase:"ejecucion", categoria:"no-es-lectura", codigo:"25006"}
    else statement exceeds the budget
        T-->>R: 57014 (server-side), or the engine's own timer wins the race
        R-->>U: 200 {resultado:"fallo", fase:"ejecucion", categoria:"tiempo-agotado"}
    end
```

## File changes

| File | Action | Description |
|---|---|---|
| `src/pg-error.ts` | Create | The two shared sanitizers **moved** out of `src/db-probe.ts` — the `error.code`-only reader and the SQLSTATE/Node-code allowlist gate, with their regexes. Pure move, no behavior change. |
| `src/consulta-ejecucion.ts` | Create | The engine: `ejecutarConsulta()` (connect → `BEGIN READ ONLY` → `set_config` → privilege check → wrapped statement → `ROLLBACK`), `verificarPermisosRol()`, `classifyExecutionError()`, `sanearSql()`, the category types. The raw-error containment boundary is this one reviewable file, as `db-probe.ts` is for CH-03. |
| `src/consultas.ts` | Create | `registerConsultaRoutes(app, prisma)` — `POST /consultas/ejecutar`, JSON schema, connection lookup, sanitized logging. Same signature shape as `registerConexionRoutes`. |
| `src/consola.ts` | Create | `registerConsolaRoute(app)` — `GET /consola` and the HTML document constant. Takes no `prisma`: it touches no database. |
| `src/consulta-ejecucion.test.ts` | Create | Unit tests for the classifier rows, `sanearSql`, and sanitization, following `src/db-probe.test.ts`'s `node:test` shape. |
| `src/db-probe.ts` | Modify | Import the two sanitizers from `./pg-error.js` instead of defining them. `classifyConnectionError` and `probeConnection` behavior unchanged; `src/db-probe.test.ts` passes unchanged. |
| `src/server.ts` | Modify | Two imports, two registration calls beside the existing ones. |
| `src/config.ts` | Modify | Add `queryTimeoutMs` (optional `QUERY_TIMEOUT_MS`, default `15000`, positive-integer validation mirroring `CONNECTION_TEST_TIMEOUT_MS`). |
| `.env.example` | Modify | Document `QUERY_TIMEOUT_MS` as optional with its default. |
| `scripts/smoke.sh` | Modify | Add the CH-04 end-to-end cases (see Testing strategy). |

**No dependency is added.** Verified against `package.json`, not assumed: `pg@^8.23.0` and `@types/pg` are already direct dependencies from CH-01/CH-03; there is no static-file plugin, no template engine and no SQL parser, and decision 8 and DEC-09 mean none is introduced.

**Connection opening is shared, not re-derived.** `ejecutarConsulta` reuses CH-03's discrete-field client construction and race-based connect budget rather than rebuilding them — the CH-03 bitácora documents two real bugs in exactly that logic (clock-inferred timeout; an `await client.end()` that never settles on a still-connecting socket). Whether that is an extracted helper both callers import or a direct reuse is an implementation call for `sdd-apply`; what this design fixes is that it must not be copy-pasted, and that `src/db-probe.test.ts` must pass unchanged afterwards.

## Testing strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `classifyExecutionError` rows 1–7 | Synthetic errors per row, plus a non-`Error` throw and an unknown code asserting `codigo: null` |
| Unit | `sanearSql` | Trailing `;`, trailing `;` plus whitespace, two trailing `;` (only one stripped), no semicolon, whitespace-only input |
| Unit | Sanitization | An error carrying `connectionParameters.password` and a `stack` yields a summary containing neither |
| Integration | Read-only enforcement | Against the Compose target: a plain `SELECT` returns rows; `SELECT 1; SELECT 2` is rejected and neither runs; `WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x` returns `no-es-lectura` with `0A000` (the wrapped path — see amended C4) **and a follow-up `SELECT count(*)` proves no row was deleted**; a companion case submitting the same CTE unwrapped, on its own client, pins `25006` so the difference stays attributable to the pagination wrapper rather than to `READ ONLY` |
| Integration | DEC-08 legs | Four roles against the same database: a read-only role executes; a role with table `INSERT` blocks as `rol-con-escritura-en-tabla`; a role with only schema `CREATE` and no table grants blocks as `rol-con-create-en-esquema`; a superuser blocks as `rol-superusuario` (pins decision 1) |
| Integration | Inheritance (decision 2) | `GRANT INSERT ON t TO escritor; GRANT escritor TO lector;` — with `INHERIT`, the check MUST block; with `NOINHERIT`, the check passes and the follow-up `SET ROLE escritor` + `INSERT` inside the transaction MUST still fail with `25006`. Pins both halves of decision 2 |
| Integration | Timeout | `SELECT pg_sleep(<budget × 2>)` returns `tiempo-agotado` at or before the budget, and the server-side path is exercised (`57014`) as well as the race backstop |
| Integration | Pagination | A 3-row table with `limite: 2` returns 2 rows and `hayMas: true`; `desplazamiento: 2` returns the last row and `hayMas: false`; a query with a trailing `;` executes normally |
| Smoke | End-to-end | Extend `scripts/smoke.sh` with the success, multi-statement, `25006`, privilege-block and timeout cases, asserting no response body contains the submitted credential |
| Manual | Console | `GET /consola` renders, executes a `SELECT`, pages through results, and shows a legible banner for a failed execution |

## Threat matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No file is classified or executed by this change. |
| Git repository selection | N/A | No VCS invocation. |
| Commit state | N/A | No VCS invocation. |
| Push state | N/A | No VCS invocation. |
| PR commands | N/A | No PR automation. |

No shell command, subprocess, VCS/PR automation, executable-file classification or process integration is added. The genuine adversarial boundaries of this change are elsewhere and are handled above: **arbitrary user-authored SQL against a third party's live database** (decisions 3–5: two engine-enforced read-only legs, an active role-privilege refusal, and a bounded runtime with a server-side kill); **rendering untrusted tenant data in the operator's browser** (decision 8: `textContent` only, no `innerHTML`, no third-party script origin); and **credential leakage across a much wider error surface than CH-03's fixed probe** (Contracts: engine-contained raw errors, allowlisted `codigo`, sanitized-only logging). SSRF-style outbound-destination restriction remains out of R0's threat model as established in CH-03 and stays noted for CH-07.

## Migration / rollout

No migration and no schema change. `ConsultaGuardada` stays unwired (CH-05) and `soloLectura` stays an advisory stored flag — A3's enforcement comes from DEC-08/DEC-09, not from that column. Rollback is reverting the commit: four new files, five edited ones, one optional env var that falls back to its default when unset. Rows written by CH-02/CH-03 are untouched.

## Scope check against the spec's scenarios

The proposal's success criteria are not the only contract this design must satisfy; drift is only caught when `spec.md`'s scenarios are reconciled explicitly. Both capability specs existed when this design was finalized and every scenario is reconciled below.

| Scenario (`specs/query-execution/spec.md`) | Covered by |
|---|---|
| Executing a `SELECT` against a reachable, correctly-privileged connection | Decisions 4 and 6; `200 {resultado:"ok", columnas, filas, paginacion}`. "Indicate how to request further pages" is the `hayMas` + `siguienteDesplazamiento` pair from the `limite + 1` fetch |
| A query submitted with a trailing semicolon still executes | Decision 6: one trailing `;` stripped by plain trimming before wrapping (C12); pinned by a unit test and an integration case |
| Rejecting semicolon-separated multi-statement text | Decision 4, extended-protocol leg — the server refuses at Parse, so nothing executes; surfaced as `error-sintaxis` / `42601` per decision 7's stated limit; the integration case asserts neither statement ran |
| A data-modifying CTE is rejected and nothing is written | Decision 4's two engine legs → `0A000` on the wrapped path this implementation always takes, `25006` on the unwrapped one (amended C4) → both mapped to `no-es-lectura` by decision 7's row 3, so the legible verdict does not depend on which fires. The integration case asserts the row count is unchanged, satisfying the scenario's second `AND`, and a companion case pins `25006` for the unwrapped statement so the mechanism stays attributable to the wrapper |
| Blocking a role with table-level write privilege — response SHALL **state that the role holds write privilege** | Decision 3, leg 2, reported as its own category `rol-con-escritura-en-tabla`. Distinct categories (rather than one shared "blocked") exist precisely because the spec requires the two blocks to be separately legible |
| Blocking a role with schema-level `CREATE` privilege — response SHALL **state schema-level `CREATE`** | Decision 3, leg 3, reported as `rol-con-create-en-esquema` |
| Submitting a syntactically invalid query | Decision 7, row 5 → `error-sintaxis`; the raw error never escapes the engine module, so no driver object or stack can reach the body |
| A failed execution does not leak the credential | Contracts (credential safety): engine-contained raw error, allowlisted `codigo`, sanitized `app.log.warn` summary, `credencial` selected only on the engine path |
| A successful execution does not leak the credential | Same; the success envelope carries only `columnas`/`filas`/`paginacion`/`duracionMs`, and the smoke case asserts the submitted credential appears in no body |
| A long-running query is cut off | Decision 5: server-side `statement_timeout` via `set_config(..., true)` → `57014`, with the race backstop at `queryTimeoutMs + 2000` — and a timeout is recorded only as a fact (a code, or who won the race), never inferred from elapsed time |

| Scenario (`specs/query-console/spec.md`) | Covered by |
|---|---|
| Requesting the console page | Decision 8: `GET /consola` returns an HTML document with a `<textarea>` and an execute control. The spec leaves markup to design, which is what decision 8 resolves |
| Viewing a page of results | Decision 8's `<table>` render plus prev/next controls driven by `paginacion.hayMas` / `siguienteDesplazamiento` |
| A failed execution is shown legibly, never a raw error or silence | The console renders only `{fase, categoria, codigo}` through a fixed category→message map, so a raw driver object cannot reach it; every non-`ok` verdict — including a `fase: "permisos"` block and a timeout — fills the error banner, and `fetch` rejections fill it too, so no failure is silent |

## Known limits (stated, not prevented)

- A trailing `--` or unterminated `/* */` comment breaks the pagination wrapper and fails closed as a syntax error (decision 6, C13).
- Multi-statement text and ordinary syntax errors share the `error-sintaxis` category (decision 7).
- DEC-08's check is detect-and-refuse, never a guarantee: it is a snapshot, so grants widened after it (TOCTOU) are not seen, and a `NOINHERIT` membership reachable by `SET ROLE` is invisible to it (decision 2). DEC-09's `READ ONLY` transaction, which `SET ROLE` does not lift, remains the layer that actually prevents the write.
- A temp object created *before* the read-only transaction can still be written inside it via a pre-created temp sequence's `nextval()`; `CREATE TEMPORARY TABLE` itself is blocked, correcting the exploration's assumption (C1).
- `OFFSET` pagination re-computes and discards preceding rows on later pages. Acceptable for R0 under the bounded timeout; A4's row caps are CH-07.
- Non-scalar column values (`bytea`, composite types) are serialized by Fastify's JSON encoder as-is and may render awkwardly in the table. Legibility of exotic types is not an R0 requirement.

## Out of scope (unchanged from proposal.md)

B2 saved queries (CH-05, `ConsultaGuardada` stays unwired), B3 user-declared query parameters (CH-11), A2 credential encryption at rest (CH-07), A4 tenant-configurable timeouts and row limits (CH-07), T1/T2/T4 tenant CRUD, isolation and active-tenant indicator (CH-06), and persisting query results (gate D-1 stays open). No P2 surface, no authentication, no connection listing or editing beyond what CH-03's routes already return.
