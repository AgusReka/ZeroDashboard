# Proposal: CH-04 — Read-Only Query Execution

## Source

- `docs/02-mapa-de-changes.md`, release R0, CH-04: "Ejecución de consultas de solo lectura."
- `docs/mapa-historias.md`, stories A3 ("solo se admitan sentencias de lectura"; criterion: rejection in the application **and** a database user without write access) and B1 ("escribir una consulta y ver el resultado"; criterion: editor, execution, paginated table, legible error).
- `docs/01-decisiones.md`: DEC-07, DEC-08, DEC-09 (all firm, user-decided 2026-09-16 — cited, not re-opened).
- Engram `sdd/CH-04/explore` (obs #35) and `sdd/CH-04/research` (obs #37).

## Why

CH-03 leaves a connection registered and proven reachable but unusable: nothing runs a query against it. R0 is named "consola mínima" and, after three changes, no console exists. CH-04 is the first change that executes a real user-authored query, and therefore the first that must make rule 3 (read-only in two layers) actually true.

## What Changes

- **Execution engine** (new module, `register<X>Route(app, prisma)` convention): opens a short-lived `pg.Client` from a stored `Conexion`, runs one user-authored statement, returns paginated rows or a sanitized failure. Reuses `src/db-probe.ts`'s connection-opening, race-based timeout and error-classification discipline — that file carries fixed bugs; extract and share, do not copy-paste.
- **Application layer of A3 (DEC-09)**: both legs required. Forced extended protocol (`values` array passed) rejects multi-statement text; `BEGIN TRANSACTION READ ONLY` makes Postgres reject writes and DDL at SQLSTATE `25006`. Research C4 proves neither leg is redundant: a data-modifying CTE is one statement, caught only by the transaction leg. No SQL-parser dependency.
- **Database-user layer of A3 (DEC-08)**: block execution when the connected role appears to hold write permission. Constraint from research C8/C10: MUST use `has_table_privilege()` / `has_schema_privilege()` (which resolve ownership) and MUST include schema-level `CREATE`, not per-table grants alone. Raw `information_schema.role_table_grants` / ACL introspection is insufficient — owner privileges are invisible there.
- **Pagination**: wrap as `SELECT * FROM (<query>) AS sub LIMIT $1 OFFSET $2` with driver parameters, after stripping one trailing semicolon and whitespace (plain string trim, not parsing).
- **Minimal web console (DEC-07)**: first UI in the project — SQL textarea, paginated results table, legible error surface, served by the app. No static-file plugin exists in `package.json`; whether a new dependency (e.g. `@fastify/static`) or an inline route-served document is needed is a design call.
- **Bounded execution timeout**: a query-runtime bound (distinct from CH-03's connection-attempt timeout, likely session `statement_timeout`) so no query hangs forever. Same class of safety measure CH-03 established — not A4.

## Design-Level Scoping Decisions (carry into `sdd-design`)

Design-level calls in the same sense as CH-01's framework/ORM choices (DEC-05), not new architecture gates. Design MUST resolve both explicitly; neither may be silently assumed.

1. **Superuser veto.** Whether a connected superuser role is an automatic hard-block regardless of privilege-check results. A superuser bypasses all permission checks, so a clean `has_*_privilege()` result is meaningless for one (research gap 2).
2. **Role-inheritance resolution.** Whether `has_table_privilege()` / `has_schema_privilege()` correctly resolve privileges inherited through role membership / `INHERIT` chains. Unconfirmed by PostgreSQL docs; verify empirically (research gap 1).

Accepted known limits to state, not prevent: a trailing `--` or unterminated `/* */` comment in the pasted query breaks the pagination wrapper and fails closed with a Postgres syntax error (no write executes) — DEC-09 has no parser by design, so this surfaces as a legible error per B1. DEC-08's check remains detect-and-refuse, never a guarantee (TOCTOU, grants widened after the check).

## Out of Scope

- B2 saved queries (name, description, persistence) → CH-05. `ConsultaGuardada` exists from CH-02 and stays unwired.
- B3 parameterized queries with user-declared driver parameters → CH-11, release R1. The pagination wrapper's own `$1/$2` are the app's SQL, not this feature.
- A2 credential encryption at rest → CH-07. `credencial` stays plaintext.
- A4 configurable per-query timeout and row limits as a tenant-facing feature → CH-07. The bounded execution timeout above is not A4.
- T1/T2/T4 tenant CRUD, isolation, active-tenant indicator → CH-06. Exactly one seeded `Tenant`, no tenant picker.
- Persisting query results (gate D-1 stays open).

## Non-Negotiable Rules in Effect (`docs/00-contexto.md` §5)

- **Rule 3**: read-only in two layers — this change IS that rule, via DEC-08 (database user) and DEC-09 (application).
- **Rule 4**: the app's own SQL (pagination wrapper, privilege-check queries) MUST use driver parameters. The user's pasted statement is the literal statement being executed and structurally wrapped, not interpolated with untrusted fragments — that is not the forbidden concatenation.
- **Rule 7**: no credential value, raw driver error or stack crosses any boundary. Arbitrary user queries widen the error surface far beyond CH-03's fixed probe, so only a sanitized `{code, category}` summary is logged or returned.
- **Rule 1** is not engaged: the console is P1-only, no P2 surface exists.

## Rollback Plan

No migration and no schema change — no new table, no altered column, no persisted execution result. Rollback is reverting the commit: the new execution module and its registration line in `src/server.ts`, the console page and any asset-serving dependency, and the new optional timeout entry in `src/config.ts` / `.env.example` (unset falls back to its default). Rows written by CH-02/CH-03 are untouched and stay valid.

## Impact

### New Capabilities

- `query-execution`: executing a single user-authored read-only statement against a registered connection, enforced at both the application and database-role layers, returning paginated rows or a sanitized legible failure.
- `query-console`: the minimal P1 web console — SQL editor, execution trigger, paginated results table and legible error surface.

### Modified Capabilities

- None. `connection-registration` (CH-03), `domain-data-model` (CH-02) and `project-environment` (CH-01) are untouched at spec level; `soloLectura` remains a stored advisory flag, since A3's enforcement comes from DEC-08/DEC-09, not from that column.

## Success Criteria

- [ ] A `SELECT` submitted in the console returns rows in a paginated table against a registered connection.
- [ ] A multi-statement submission is rejected and no part of it executes.
- [ ] A data-modifying CTE (`WITH x AS (DELETE ... RETURNING *) SELECT * FROM x`) is rejected with SQLSTATE `25006` and no row is deleted.
- [ ] Executing against a connection whose role holds write or schema-`CREATE` privilege is blocked before the query runs, with a legible reason.
- [ ] A syntactically invalid query produces a legible error, never a raw driver error or stack.
- [ ] No credential value appears in any response, page, error or log line.
- [ ] A long-running query is cut off by the bounded execution timeout instead of hanging.
