# Exploration: CH-06 — Tenants y aislamiento (T1, T2, T4)

## Current State

- Data model (CH-02, DEC-06): `Tenant` (`id`, `nombre`, `creadoEn`) with `Conexion[]` / `ConsultaGuardada[]`; both children carry a required NOT NULL `tenantId` FK with `@@index([tenantId])`. The multi-tenancy **data model shape** (shared schema + `tenantId` discriminator column) is already decided by DEC-06 — this part is not open.
- Every write path resolves "the" tenant identically — `src/conexiones.ts:147` and `src/consultas-guardadas.ts:106`: `prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' }, select: { id: true } })`, 503 `tenant-no-inicializado` if none. This is a single-tenant placeholder ("first tenant ever created"), not an operator-selected or authenticated tenant.
- Every read path has zero tenant filtering today:
  - `GET /consultas-guardadas` (`src/consultas-guardadas.ts:143`) — the code's own comment admits: "No tenant filter — no read path in this codebase filters by tenant yet, and half-implementing isolation here would make CH-06 harder to review, not easier."
  - `GET /consultas-guardadas/:id`, `POST /conexiones/:id/prueba` (`src/conexiones.ts:178`), and `POST /consultas/ejecutar`'s `Conexion` lookup (`src/consultas.ts:52`) all use `findUnique({ where: { id } })` with no tenant check — any UUID resolves regardless of owning tenant.
- No auth/session/user model exists anywhere in `src/`. P1 (implementer) is the sole console operator; per `docs/mapa-historias.md` §3, P1's visión is "Todos los tenants" — by design P1 acts across tenants, unlike P2 (panel, T3/R2/CH-22).
- Important nuance: Regla 2 (`docs/mapa-historias.md` §3 — "Ninguna consulta del panel puede devolver datos de otro tenant") is worded specifically about the **panel** (P2), not the console (P1). An operator-supplied active-tenant identifier at the console layer is a different trust surface. T2's acceptance criterion ("ninguna operación devuelve filas del otro tenant") is unqualified — it must be read as covering the console now, not deferred until the panel (CH-22) exists.
- `src/consola.ts` (CH-04/CH-05) has no tenant selector/indicator/state at all — T4 has nothing to build on yet.
- Test convention (CH-03–CH-05): `node:test` + `app.inject()` against live Postgres, skip (not fail) when unreachable, no mocking. T2's dual-tenant test must follow this exact pattern.

## Affected Areas

- `prisma/schema.prisma` — migration needed: add an `activo` (soft-delete) flag to `Tenant` for T1 (deliberately deferred by CH-02's `design.md`).
- `src/conexiones.ts` — replace tenant-resolution hack on create; add tenant filter to `POST /conexiones/:id/prueba` (currently none).
- `src/consultas-guardadas.ts` — replace tenant-resolution hack on create; add tenant filters to `GET /consultas-guardadas` and `GET /consultas-guardadas/:id` (currently none, explicitly deferred in code comments).
- `src/consultas.ts` — add tenant filter to `POST /consultas/ejecutar`'s `Conexion` lookup.
- `src/server.ts` — wire in the new tenant-resolution primitive/module.
- `src/consola.ts` — needs tenant selector/indicator (T4).
- New `src/tenants.ts` (+ test) — T1 CRUD (alta, baja lógica, listado) and tenant-resolution ownership.
- New isolation test — T2's automated two-tenant test.
- `docs/01-decisiones.md` — at least one architecture decision (isolation enforcement mechanism) is unregistered; see Risks/Open Questions.

## Open Questions (surfaced, not resolved by the agent)

1. **Isolation enforcement mechanism** — `01-decisiones.md` records DEC-06 (data model shape) but nothing about *how* every query actually honors `tenantId`. Three viable approaches:
   - (a) Manual per-query filtering — every route explicitly adds `where: { tenantId: activo.id }`. Matches the codebase's current explicit/unabstracted style; no new dependency. Nothing structurally prevents a future route from forgetting the filter — T2's automated test becomes the only backstop.
   - (b) Prisma Client Extension auto-injecting the tenant filter, sourced from an `AsyncLocalStorage`-held request context. Structural guarantee that scales to future tenant-scoped tables (CH-08–CH-14); consistent with DEC-08/DEC-09's precedent of preferring structural guarantees. Needs a new request-context primitive; the extension itself becomes a single point of failure.
   - (c) PostgreSQL Row-Level Security with a per-transaction session variable and `USING` policies. Strongest, engine-enforced guarantee; heaviest for this app's own DB (not a semi-trusted external replica) with zero role/policy precedent in this codebase; silently permissive if a transaction forgets to set the session variable.
2. **Tenant deactivation semantics (T1 "baja lógica")** — no precedent exists for what deactivating a tenant actually does: fully freeze it (hidden + all future operations rejected, rows kept for audit), hide-but-still-operable (reversible, explicit-ID access still works), or only block creation of new resources while existing ones keep working.
3. **How the console declares the active tenant (T4)** — no session/auth infrastructure exists yet. Two viable shapes: explicit per-request tenant id (route param/header, echoed by client-side state, no new server infra) vs. a server-side session set by a "switch tenant" action (requires introducing session middleware that doesn't exist yet).

## Approaches — isolation enforcement (see Open Question 1 for full pros/cons)

| Approach | Effort |
|---|---|
| Manual per-query filtering | Low |
| Prisma Client Extension + AsyncLocalStorage | Medium |
| Postgres Row-Level Security | Medium-High |

## Recommendation

Prisma Client Extension + `AsyncLocalStorage`-carried active tenant, consistent with this project's established pattern of pushing non-negotiable-rule guarantees into a structural mechanism (DEC-08/DEC-09) while avoiding a mechanism heavier than the problem needs (RLS). Not final — per `docs/01-decisiones.md`'s own gating rule ("ninguna decisión de arquitectura la toma un agente... se frena, se registra, y recién después se implementa"), this must be confirmed and registered as a new decision entry before `sdd-propose`, the same way DEC-07/08/09/10/11/12 were each resolved by the user during prior changes' exploration, not inferred by the agent.

## Risks

1. **Blocking** — isolation enforcement mechanism (Open Question 1) is an unregistered architecture decision; must be resolved and registered in `01-decisiones.md` before `sdd-propose`.
2. Existing read paths have zero tenant filtering today — a real, already-shipped gap the code's own comments admit, not just a future risk.
3. Regla 2's panel-scoped wording vs. T2's unqualified criterion could cause T2 to be satisfied "on paper" while the console's current unscoped reads keep leaking, if misread as panel-only.
4. No precedent/decision exists for tenant deactivation semantics (T1 "baja lógica") (Open Question 2).
5. How the console declares the active tenant (Open Question 3) interacts directly with T4 and T1 and has no session/auth precedent to draw on.

## Ready for Proposal

Yes, conditional on Open Questions 1, 2, and 3 being resolved by explicit user decision (not inferred) — Question 1 is a blocking architecture decision per `01-decisiones.md`'s own rule; Questions 2 and 3 follow the same "decidido por el usuario, no inferido" precedent as DEC-07/10/11/12.

## Key Learnings

1. DEC-06 already fixed the tenant data-model shape (shared schema, `tenantId` FK column) but no decision yet covers the isolation *enforcement* mechanism, which is the actual open architecture question for CH-06.
2. Every existing read path in `conexiones.ts`, `consultas-guardadas.ts`, and `consultas.ts` has zero tenant filtering today, including one instance where the code's own comment admits this was deliberately deferred to CH-06.
3. Regla 2 ("el identificador de tenant nunca se toma de la petición del cliente") is worded specifically about the panel (P2), not the console (P1) — P1 is designed to act across all tenants, so console-supplied tenant selection is a distinct trust surface from panel isolation.
4. No session/auth infrastructure exists anywhere in this codebase yet, which bounds how T4's "active tenant indicator" can be implemented without introducing new infra.
