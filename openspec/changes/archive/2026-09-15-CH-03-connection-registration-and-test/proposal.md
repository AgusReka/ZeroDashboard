# Proposal: CH-03 — Connection Registration and Test

## Source

- `docs/02-mapa-de-changes.md`, release R0, CH-03: "Alta de conexión, prueba con resultado visible."
- `docs/mapa-historias.md`, story A1 only: "Como P1, quiero registrar la conexión a la réplica de un tenant. Criterio de aceptación: prueba de conexión con resultado visible."
- Engram `sdd/CH-03/explore` (obs #24) and `sdd/CH-03/research` (obs #25).

## Why

CH-02 created the `Conexion` table but nothing writes to it, and no one can tell whether a stored connection actually works. CH-04 (query execution) needs a registered, proven-reachable connection to build on.

## What Changes

- Register a `Conexion` row against the single seeded `Tenant` (DEC-06). No migration — CH-02's model already fits.
- Test a registered connection against the live target and return a legible success/failure result.
- Failures distinguish at least: unreachable host/port, DNS failure, timeout, bad credentials, missing database, other.
- New route file registered through the existing `register<X>Route(app, prisma)` pattern in `src/server.ts` (precedent: `src/health.ts`).
- `pg` promoted to a direct dependency (today transitive via `@prisma/adapter-pg`). The test dials the target with a short-lived `pg.Client` and an explicit connection-attempt timeout — never the app's own Prisma client, which is startup-bound to the own database.

## Design-Level Scoping Decisions (carry into `sdd-design`)

Design-level calls in the same sense as CH-01's framework/ORM choices (DEC-05), not new architecture gates:

1. **PostgreSQL-only test target.** `motor` is stored, not branched on. Gate D-4 is open but explicitly does not block R0; `design.md` must state this so a future MySQL target fails legibly instead of silently.
2. **API-only visible result.** No UI exists in the repo; "resultado visible" is a clear JSON result. The first UI arrives in CH-04 (B1).

## Out of Scope

- A3 read-only enforcement (app + DB user) → CH-04. `soloLectura` stays stored-but-unenforced.
- A2 credential encryption at rest → CH-07. `credencial` stays plaintext.
- A4 per-query timeout and row limits → CH-07. The connection-attempt timeout above is not A4.
- T1/T2/T4 tenant CRUD, isolation, active-tenant indicator → CH-06. No tenant picker; the existing required `tenantId` FK is used as-is.
- Any query execution beyond the fixed probe.

## Non-Negotiable Rules in Effect (`docs/00-contexto.md` §5)

- **Rule 4**: the probe is a literal parameterless statement; no string-built SQL anywhere in this change.
- **Rule 7**: raw driver errors and stacks MUST NOT be logged or returned — node-postgres serializes plaintext passwords into connection errors (research C7–C9). Only a sanitized `{code, category}` summary crosses any boundary.
- Rules 1/2 are not yet engaged: no panel/P2 surface, one tenant.

## Rollback Plan

No migration and no schema change. Rollback is reverting the commit: the new route file, its registration line in `src/server.ts`, and the `pg` dependency entry. Rows already registered are orphaned but harmless — the CH-02 table predates this change and stays valid.

## Impact

### New Capabilities

- `connection-registration`: registering a tenant connection record and testing its reachability with a legible result.

### Modified Capabilities

- None. `domain-data-model` (CH-02) and `project-environment` (CH-01) are untouched at spec level.

## Success Criteria

- [ ] A connection registers and persists as a `Conexion` row for the seeded tenant.
- [ ] Testing a reachable PostgreSQL target returns a success result.
- [ ] Unreachable host, bad password, and missing database return distinguishable failure results.
- [ ] No credential value appears in any response, error, or log line.
- [ ] A test against an unreachable host returns within the bounded timeout instead of hanging.
