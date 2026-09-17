# Exploration: CH-05 — Consultas guardadas (B2)

## Current State

- `prisma/schema.prisma` already has `ConsultaGuardada` (from CH-02): `id`, `tenantId` (required FK), `nombre`, `descripcion` (`String?`), `sql`, `creadaEn`, `actualizadaEn`, `@@index([tenantId])`. **No `conexionId` field.** CH-04's `design.md` (`openspec/changes/archive/2026-09-16-CH-04-read-only-query-execution/design.md`) explicitly states: "`ConsultaGuardada` stays unwired (CH-05)".
- Nothing in `src/` touches `ConsultaGuardada` — it is dead schema.
- `src/consultas.ts` registers only `POST /consultas/ejecutar` (CH-04).
- `src/conexiones.ts` is the closest CRUD-style sibling (CH-03): create + test-connection only, no list/get/update/delete for `Conexion` either.
- Tenant resolution pattern (used identically in `conexiones.ts`): `prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' }, select: { id: true } })`, 503 `{error:'tenant-no-inicializado'}` if none — the client never supplies `tenantId`. `consultas.ts` doesn't even touch `Tenant` (looks up `Conexion` directly).
- Validation style (both `conexiones.ts`/`consultas.ts`): Fastify JSON Schema, `additionalProperties:false`, explicit `required`, `attachValidation:true`, shared `camposInvalidos()` helper from `conexiones.ts` mapping to `400 {error:'solicitud-invalida', campos:[...]}`. No uniqueness constraints exist anywhere in the schema (not even on `Conexion.nombre`).
- `src/consola.ts` (CH-04, DEC-07) is a single self-contained HTML+inline-JS document (editor, execute, paginated table), rendering only via `textContent`. No saved-query UI exists.
- Test convention: `node:test`, `assert/strict`, `app.inject()` against a **real** Prisma client and **live** PostgreSQL target, skipping (not failing) when unreachable. No Prisma mocking anywhere.
- DEC-06 already committed `ConsultaGuardada.tenantId` to exist from CH-02, so tenant-scoping itself needs no new gate.

## Affected Areas

- `src/consulta-guardada.ts` (new) — mirrors `src/conexiones.ts`'s shape.
- `src/server.ts` — one import + one registration call.
- `src/consola.ts` — only if UI scope is confirmed (open question below).
- `prisma/schema.prisma` — only if a `conexionId` field is added (open question below); otherwise the CH-02 model needs no migration.
- `src/consulta-guardada.test.ts` (new) — live-Postgres integration pattern, same as `conexiones.test.ts`.
- `docs/01-decisiones.md` — if any open question below resolves as a new architecture decision (per AGENTS.md, must be registered before implementation).

## Open Scope Questions (surfaced, not resolved)

1. **CRUD surface** — B2's literal text ("guardar... con nombre y descripción") reads as create-only, but the mapa's own R0 closure test ("escribir una consulta, guardarla y ejecutarla") implies retrieval is needed too. A pure create-only route (mirroring CH-03's `Conexion` scope) is literally defensible but leaves the saved query practically unusable. Recommend at least create + list + get-by-id; update/delete explicitly deferred (update overlaps B4/CH-25 versioning in R3; delete isn't asked for anywhere).
2. **Relation to `Conexion`** — the schema has no `conexionId` and B2 says nothing about binding to a connection. Two readings: (a) no binding — `sql` is portable text, connection chosen separately at execution time (matches current schema, zero migration, symmetric with today's `/consultas/ejecutar` taking `conexionId` and `sql` independently); (b) binding required — a saved query's columns are meaningless without knowing the target schema, which would require a new migration on a table CH-02 already shipped. This is a real gap worth an explicit decision, not an inferred assumption.
3. **Validation** — no established uniqueness precedent anywhere (`Conexion.nombre` also unenforced). Recommend mirroring `conexiones.ts`: `nombre` required `minLength:1`, `descripcion` optional/nullable, `sql` required `minLength:1` (reusing `sanearSql`'s empty-after-trim rejection as CH-04 does). No length ceiling precedent exists in the codebase for any field.
4. **Console UI integration** — DEC-07 justified building the HTML console in CH-04 specifically because B1's acceptance criterion named interface elements ("Editor, ejecución, tabla paginada"). B2's criterion ("Persistencia en la base propia") names a storage property, not a UI element — a textual signal (not a firm conclusion) that CH-05 could be API-only. But the mapa's closure narrative implies the operator does interact with saving somewhere. Same class of question DEC-07/08/09 were each explicitly decided by the user during CH-04's exploration, not inferred by the agent — recommend the same treatment here.

## Approaches

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| 1. New sibling module `src/consulta-guardada.ts` (create+list+get, mirroring `conexiones.ts`) | Matches established one-module-per-resource convention; reuses `camposInvalidos`, schema idiom, tenant-resolution pattern | Goes beyond B2's literal wording — needs scope question 1 resolved first | Low |
| 2. Extend `src/consultas.ts` with saved-query routes | Fewer new files; keeps "consultas" as one surface | Breaks the established one-resource-per-module convention; mixes execution-engine wiring with storage CRUD; risks exceeding "review in one sitting" | Low, higher coupling cost |
| 3. Create-only route now, defer list/get to a follow-up change | Most literal reading of B2; smallest diff | Produces a saved query nobody can retrieve — contradicts the mapa's own R0 closure narrative | Very low, likely incomplete |

## Recommendation

Approach 1, with a minimal-but-usable surface (create + list + get-by-id, update/delete deferred). Not final — questions 1, 2, and 4 should be returned to the user as an explicit decision before `sdd-propose` commits to a shape, the same way DEC-07/08/09 were resolved during CH-04's own exploration.

## Risks

- Resolving open questions 1/2/4 by inference rather than explicit decision would violate AGENTS.md's "ninguna decisión de arquitectura la toma un agente" rule.
- If question 2 resolves toward binding a saved query to a `Conexion`, it requires the first schema migration on a table CH-02 already shipped — worth flagging explicitly.
- No uniqueness/collision precedent exists for `nombre` anywhere in the codebase.
- CH-05's test suite will need the same live-Postgres/Docker Compose harness as `conexiones.test.ts`/`consultas.test.ts` — no unit-only path exists for anything touching Prisma in this codebase.

## Ready for Proposal

Yes, with a caveat: present open questions 1, 2, and 4 to the user as an explicit decision point before/during `sdd-propose`. Question 3 has enough precedent to resolve directly in the proposal.

## Key Learnings

1. CH-04's design.md explicitly states `ConsultaGuardada` stays unwired and defers it to CH-05.
2. No Prisma model in this codebase enforces uniqueness on any name-like field, including `Conexion.nombre`.
3. Every test file touching Prisma uses a live PostgreSQL target via `node:test`, never a mocked client.
4. The tenant is always resolved server-side via `prisma.tenant.findFirst` ordered by `creadoEn`, never taken from the request.
5. `ConsultaGuardada` has no `conexionId` field, and no project document explicitly asks for one.
