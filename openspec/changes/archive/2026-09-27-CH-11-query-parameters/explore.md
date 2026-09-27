## Exploration: CH-11 — Parámetros en consultas (B3)

> Mirror of Engram `sdd/CH-11-query-parameters/explore` (hybrid store).

### Current State

- `src/consulta-ejecucion.ts` (`ejecutarConsulta`/`paginar`) wraps every user-authored statement literally as `SELECT * FROM (<sql>) AS _consulta_usuario LIMIT $1 OFFSET $2`, binding `values: [limiteEfectivo+1, desplazamiento]`. Today there are exactly two driver-bound placeholders, both owned by pagination. Nothing scans the user's SQL for placeholders; `sanearSql()` only trims and strips one trailing `;`.
- Every statement (pagination wrapper, DEC-08 permission probe, user SQL) is sent via pg's extended protocol (a `values` array present even when empty), specifically to force single-statement text (DEC-09). This is the exact `$n` positional-bind mechanism CH-11 must reuse for user parameters — never string interpolation (rule 4 / DEC-09).
- `POST /consultas/ejecutar` (`src/consultas.ts`) body is `{conexionId, sql, limite, desplazamiento}` — no parameter field; `sql` here is always ad hoc, never persisted by this route.
- `ConsultaGuardada` (`src/consultas-guardadas.ts`, `prisma/schema.prisma`) persists `{nombre, descripcion?, sql}` per tenant, create+list+get only (DEC-10), no update route (a correction requires saving a new row).
- `VistaCanonica` (CH-09, `src/vistas-canonicas.ts`) stores per-`Conexion`×entity SQL verbatim; DEC-31 defers composing it as `WITH v_x AS (...)` ahead of the real query to CH-12. Its SQL has no parameter concept and is only probed structurally with `LIMIT 0` (CH-10), never executed with real values.
- `src/contrato.ts` already defines a 5-way tolerant semantic-type vocabulary (`TipoSemantico`: `texto`, `numero`, `booleano`, `fecha`, `identificador`, DEC-39) used to validate mapped *columns* against Postgres OIDs. No equivalent vocabulary exists yet for *parameter input values* (JS/JSON values supplied by a human or a scheduler, not columns read back from a probe) — reuse is a candidate, not a given.
- The HTML console (`src/consola.ts`) has one static SQL textarea and one `limite` number input; it POSTs flat JSON (`{sql, limite, desplazamiento}` / `{sql, nombre}`). No mechanism renders N dynamic input controls for N declared parameters or submits a name→value map.
- No SQL-parsing dependency exists (`package.json`: `pg`, `@prisma/client`, `fastify` only), consistent with DEC-09's explicit rejection of a SQL parser for statement classification. Any placeholder-scanning CH-11 introduces should stay a plain string transform, in the same spirit as `sanearSql()` (trim/strip, never parse).
- CH-11 is the **first** feature that puts a second class of bind parameter into the same statement text as the pagination wrapper's own `$1`/`$2` — a new coupling, not a purely additive one: whatever syntax is chosen, the final renumbering must guarantee the wrapper's own placeholders never collide with user-declared ones.

### Affected Areas

- `src/consulta-ejecucion.ts` — `ejecutarConsulta()`/`paginar()` build final SQL text + `values`; introducing user parameters requires renumbering/positioning binds so pagination's own LIMIT/OFFSET placeholders never collide with declared ones.
- `src/consultas.ts` (`POST /consultas/ejecutar`) — schema/handler need a parameter-value map alongside `sql`, validated against declared name/type before binding.
- `src/consultas-guardadas.ts` + `prisma/schema.prisma` (`ConsultaGuardada`) — if B3 parametrizes *saved* queries, declared parameters (name, type, maybe required/default) need a persistence home: new columns/migration, plus a DEC-10 create/list/get surface projecting the declaration.
- `src/consola.ts` and `openspec/specs/query-console/spec.md` — console must detect/declare parameters and render per-parameter input controls, submitting values with execution/save requests.
- `openspec/specs/query-execution/spec.md`, `openspec/specs/saved-queries/spec.md`, `openspec/specs/query-console/spec.md` — each documents today's opaque-`sql`-plus-two-pagination-binds shape and needs a delta.
- `src/contrato.ts` (`TipoSemantico`) — candidate reuse point for parameter types; not a given.
- `docs/01-decisiones.md` — at least one new DEC-* entry required before design (AGENTS.md: no architecture decision without registering it first).
- CH-12 (`Plantilla`, D1: "Consulta sobre vistas canónicas + parámetros + condición + formato + tolerancia de frescura") is the consumer this exploration must not implement but must leave a coherent contract for. Supplying actual parameter *values* for an unattended scheduled run (X1-X3, CH-13/14) and instantiating a template with parameter values (D2, CH-21, R2) are explicitly out of CH-11's scope — CH-11 only needs to leave a "declare + substitute safely" primitive CH-12 can adopt without redesign.

### Approaches

1. **Named placeholders (`:nombre`) translated to positional `$n` at execution time.** SQL text contains `:nombre` tokens; a plain-string scan (regex, not a parser) finds distinct names and rewrites to `$k`, building `values` in matching order.
   - Pros: parameter identity is by name; a name can repeat in the query (bound once, used twice) without hand-numbering; decouples console/template parameter order from SQL token order.
   - Cons: needs a new regex-based rewrite step; must not mis-rewrite `::type` casts, string literals containing `:`, or dollar-quoted blocks — edges a real parser would absorb for free but a regex will not.
   - Effort: Medium.

2. **Native Postgres positional (`$1`, `$2`, …) written directly by the operator + an ordered declared-parameter list.** Wrapper's own LIMIT/OFFSET binds appended after (`$(n+1)`, `$(n+2)`).
   - Pros: no new string-rewrite step; reuses the existing `values`-array binding as-is.
   - Cons: couples declared-list order to literal SQL token order with nothing to catch a mismatch; reordering breaks saved queries; repeat use needs hand-written duplicate `$k`; harder for a console UI to build a named-parameter form.
   - Effort: Low.

3. **Named placeholders, declarations kept request-time only, nothing persisted structurally.**
   - Pros: smallest schema footprint.
   - Cons: no fixed declared type — weaker than B3's "parámetros declarados"; callers could disagree on a parameter's type across runs; defers the real decision to CH-12.
   - Effort: Low, but defers the real decision.

### Recommendation

Approach 1 (named `:nombre` placeholders rewritten to positional `$n` at execution time, backed by a persisted declaration — name + a typed vocabulary, at minimum). Offered for the user's decision; OD-1, OD-2, OD-3 determine whether it holds.

### Risks

- **Bind-parameter collision with the pagination wrapper** (off-by-one renumbering, stale parameter count between declaration and execution).
- **Regex-based placeholder rewriting edge cases** (`:foo` inside a string literal, `::type` casts, `$$...$$` dollar-quoting) must be enumerated and tested.
- **Interaction with CH-09/DEC-31's `WITH`-composition plan** — the mechanism should not make later composition harder.
- **Scope creep toward CH-12/CH-13/14/CH-21** — where automation-instance values live is out of scope.
- **DEC-10's no-update posture on `ConsultaGuardada`** would be inherited by parameter-declaration columns unless stated.
- **Console UX for dynamic parameter forms** is new client-side surface.

### Ready for Proposal

No. The Open Decisions below must be resolved by the user and registered in `docs/01-decisiones.md` before `sdd-propose` runs.

## Open Architecture/Product Decisions (not yet in docs/01-decisiones.md)

**OD-1 — Parameter placeholder syntax.** (a) named `:nombre` rewritten to `$n`; (b) native positional `$1,$2,...` + ordered declared list; (c) another convention (e.g. `{{nombre}}`). Recommendation: (a).

**OD-2 — Where declared parameters live.** (a) only on `ConsultaGuardada`; (b) both `ConsultaGuardada` and ad hoc `/consultas/ejecutar` (inline declaration+values, no persistence for ad hoc); (c) a new model decoupled from `ConsultaGuardada`. Recommendation: (b).

**OD-3 — Parameter type vocabulary.** (a) reuse `TipoSemantico` verbatim; (b) separate smaller set without `identificador`; (c) no declared type. Recommendation: leaning (b).

**OD-4 — Required/optional and defaults.** (a) all required, no defaults; (b) optional with defaults; (c) no optionality, rely on Postgres bind-count error. Recommendation: (a).

**OD-5 — Value validation against declared type.** (a) application-layer only; (b) Postgres only via `classifyExecutionError`; (c) both. Recommendation: (c).

**OD-6 — Relationship to CH-12 `Plantilla`.** (a) reusable declaration primitive CH-12 adopts; (b) CH-12 defines its own. Recommendation: (a), without CH-12 fields.

**OD-7 — Bind numbering vs pagination.** (a) declared `$1..$n`, pagination `$(n+1)/$(n+2)`; (b) pagination fixed `$1/$2`, declared from `$3`; (c) pagination not as binds (infeasible under rule 4). Recommendation: (a).

**OD-8 — Does CH-11 touch `VistaCanonica`?** (a) no; (b) yes, views declare parameters too. Recommendation: (a).
