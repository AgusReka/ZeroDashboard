# Proposal: CH-24 — Data freshness per tenant and per template (F1, F2; screen C-22)

**Status**: ready for spec and design. Inputs: exploration.md, DEC-142 to DEC-145, `docs/02-mapa-de-changes.md` (CH-24), design skill C-22.

## Intent
- Let the implementer (P1) declare, per tenant, how long its replica takes to be regenerated and when it was last refreshed (story **F1**).
- Show, in the console, each template's tolerance (already stored, story **F2**) against the active tenant's window, with a `desactualizada` badge when the window exceeds the tolerance.
- Declare and show only: no run is blocked or changed (DEC-142). The warning to the client is CH-26.

## Scope

### In Scope
- Migration and schema: `Tenant.ventanaDesactualizacionMinutos Int?` and `Tenant.replicaActualizadaEn DateTime?`, both null by default (DEC-143, DEC-144).
- `PUT /tenants/:id/frescura` with a strict body `{ ventanaMinutos?, actualizadaAhora? }` (DEC-145).
- `GET /tenants` and the other tenant responses carry the two new fields (additive, through `TenantPublico`).
- Pure helper `evaluarFrescura(ventana, tolerancia)`: `sin-declarar`, `al-dia` or `desactualizada`.
- Console section "Frescura de datos" (C-22): window, last refresh as relative text, a form to save the window, a button to mark the replica refreshed now, and a table of templates with tolerance and badge.
- A scheduler test proving a run is not affected by a stale window.

### Out of Scope
- Any change in `planificador.ts` or the closed set of rejection categories (DEC-142, rule 6).
- Client warning on activation (CH-26), anything in the client panel (rule 2).
- Per-connection windows (DEC-144), inferring the last refresh from the agent heartbeat (CH-19d1).
- Editing the template tolerance from the new screen (it already has `PUT /plantillas/:id`, DEC-68).

## Capabilities

### New Capabilities
- `data-freshness`: declared window and last refresh per tenant, the tolerance comparison, and its console view.

## Approach
`src/frescura.ts` holds the pure rules (comparison and body validation) with no Prisma and no I/O. The route lives in `src/tenants.ts` next to `baja`, reusing `TenantPublico` and the strict-schema pattern (`propertyNames` plus untyped containers so AJV cannot coerce, the lesson of CH-23). The console adds one section to `src/consola.ts`, built with text nodes like the rest, and applies the same comparison client-side against the active tenant, with shared test vectors (DEC-129 precedent).

## Affected Areas
- `prisma/schema.prisma`, a new migration, regenerated client
- `src/frescura.ts` (new), `src/frescura.test.ts` (new)
- `src/tenants.ts`, `src/tenants.test.ts` or a new route test file
- `src/consola.ts`, `src/consola.test.ts`
- `src/planificador.test.ts` (one case)
- `docs/01-decisiones.md` (DEC-142 to DEC-145, done)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A string `"5"` or `"true"` coerced by AJV into a valid value | Medium (it happened in CH-23) | Untyped properties plus explicit `typeof` checks in code; tests for string, float, negative and boolean-as-string |
| Writing to a deactivated tenant | Low | 409 `tenant-desactivado` before any update (DEC-14) |
| Server and console disagree on "stale" | Low | One rule, shared vectors, equality is `al-dia` |
| `null` window read as "fresh" | Medium | `sin-declarar` is its own state and never shows the stale or fresh badge |

## Review Workload Forecast
- PR1: migration, schema, `frescura.ts`, route and tests: ~260 lines
- PR2: console section and tests, plus the scheduler case: ~330 lines
Total ~590 lines; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (the session strategy is `single-pr`).
