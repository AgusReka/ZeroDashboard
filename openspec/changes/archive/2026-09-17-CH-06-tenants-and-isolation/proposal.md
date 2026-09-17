# Proposal: CH-06 — Tenants and Isolation

## Source

- `docs/mapa-historias.md`, release R1, stories T1 (alta, baja lógica, listado), T2 (automated two-tenant test: "ninguna operación devuelve filas del otro"), T4 (permanent, unambiguous active-tenant indicator).
- `docs/01-decisiones.md`: DEC-13, DEC-14, DEC-15 (firm, user-decided 2026-09-17 — cited, not re-opened); DEC-06 (tenant model shape), DEC-08/DEC-09 (structural-guarantee precedent).
- `openspec/changes/CH-06-tenants-and-isolation/explore.md`; Engram `sdd/CH-06/explore`.

## Why

Isolation is claimed by the architecture (DEC-03) and enforced nowhere. Today `GET /consultas-guardadas`, `GET /consultas-guardadas/:id`, `POST /conexiones/:id/prueba` and the `Conexion` lookup in `POST /consultas/ejecutar` resolve by `id` with no `tenantId` check, and both create paths pick "the first tenant ever created". CH-06 is R1's first change and the one that makes two isolated tenants real.

## What Changes

- **Migration**: `Tenant` gains `activo Boolean @default(true)`. First migration over a CH-02 table; additive, backfills `true`.
- **New `src/tenants.ts`** (+ test), registered through the existing `register<X>Routes(app, prisma)` pattern: alta, listado (active by default), baja lógica. No reactivation (DEC-14).
- **New request-context primitive (DEC-13)**: the active tenant, declared explicitly per request (DEC-15), is held in `AsyncLocalStorage` and a Prisma Client Extension injects `tenantId` into every query on `Conexion` and `ConsultaGuardada`. Routes stop filtering by hand; the placeholder `tenant.findFirst` disappears.
- **Freeze semantics (DEC-14)**: a request naming a deactivated tenant is rejected before any handler logic; existing rows stay for audit.
- **Console (T4/DEC-15)**: `src/consola.ts` gains a tenant selector plus a permanent indicator, and forwards the selection on every API call.
- **New isolation test (T2)**: two tenants loaded, every route exercised from both, asserting no operation returns the other's rows — `node:test` + `app.inject()` against live Postgres, skip-not-fail when unreachable, no mocking.

## Design-Level Scoping Decisions (carry into `sdd-design`)

1. Where the active tenant enters the request (header vs route prefix), which routes are exempt (`/health`, `/consola`, tenant CRUD), and the failure envelopes for absent / unknown / inactive tenant.
2. How the extension scopes `create` vs `findMany`/`findUnique`, and whether a scoped-model query with no context is an error rather than silently unfiltered.
3. Whether `503 tenant-no-inicializado` survives or is replaced by the new envelopes.

## Out of Scope

- A2 credential encryption (CH-07), M1–M5 canonical contract, X-block execution engine, T3 panel authentication (CH-22, R2).
- Tenant reactivation, tenant editing, per-tenant users, and any P2 surface.
- Persisting execution results (gate D-1 stays open).

## Non-Negotiable Rules in Effect (`docs/00-contexto.md` §5)

- **Rule 2**: the prohibition on client-supplied tenant ids is panel-scoped (P2). The console (P1, DEC-04) is a distinct trust surface; DEC-15 accepts an explicit per-request tenant there, and CH-22 owns the panel.
- **Rule 7**: the console keeps `textContent`-only rendering; a tenant `nombre` is stored input replayed later.

## Review Workload

Migration + new module + new context primitive + four touched route files + console + two test files is well past the 400-line budget — the same overrun CH-03, CH-04 and CH-05 already hit. **Chained PRs recommended**, strategy `auto-chain`, provisional slices: (1) migration + `src/tenants.ts` + wiring, (2) context primitive + Prisma extension + route adoption, (3) tenant and isolation tests, (4) console + smoke. `sdd-tasks` owns the binding forecast.

## Rollback Plan

Revert in reverse slice order. The `activo` column is additive with a `true` default, so reverting the code leaves rows valid and every pre-CH-06 path behaves as it did; drop the column with a follow-up migration only if the change is abandoned. Reverting the extension restores unfiltered reads — a regression to today's behavior, not data loss.

## Impact

### New Capabilities

- `tenant-management`: creating, listing and logically deactivating a tenant, and what a frozen tenant rejects.
- `tenant-isolation`: the active tenant is declared per request, every scoped query is filtered by it, and no operation crosses tenants.

### Modified Capabilities

- `domain-data-model`: `Tenant` gains `activo`, and "exactly one seeded row" stops being a requirement.
- `connection-registration`: registration and the connectivity test bind to the active tenant, not the seeded one.
- `saved-queries`: create, list and get-by-id are tenant-scoped; another tenant's id returns `404`.
- `query-execution`: the `Conexion` lookup is tenant-scoped.
- `query-console`: permanent active-tenant indicator and selector.

## Success Criteria

- [ ] A tenant is created, appears in the listing, is deactivated, disappears from the active listing, and every subsequent operation naming it is rejected while its rows remain readable in the database.
- [ ] With two tenants loaded, no route returns, tests or executes a row belonging to the other — proven by an automated test, not by inspection.
- [ ] A request carrying no active tenant cannot reach a scoped query at all.
- [ ] The console shows, at all times and without ambiguity, which tenant it is operating against.
- [ ] CH-03/CH-04/CH-05 behavior is unchanged for a single active tenant.
