# Proposal: CH-17a — Interrupted Runs and Overlap (X7, X4)

**Status**: ready for spec and design. Inputs: explore.md, DEC-95, DEC-96, DEC-99, DEC-100, DEC-101.

## Intent

A redeploy or crash leaves `Ejecucion` rows `en-curso` forever (X7). Nothing stops a run from starting while a previous run of the same automation is still `en-curso`, and nothing records that (X4).

## Scope

### In Scope
- Boot sweep before the first tick (DEC-99): per tenant context, all tenants including deactivated, `updateMany` of `en-curso` rows to `fallo`/`interrumpida`, `finalizadaEn` = boot time, `duracionMs`/`filas`/`fase`/`notificacion` null. Fail-open, no re-execution, single instance.
- Overlap check before create (DEC-96): scoped lookup of an `en-curso` row of the same automation; if found, write one `omitida`/`solapamiento` row per tick and skip the run.
- SIGTERM/SIGINT call `app.close()` (DEC-100).
- No catch-up, documented as an artifact limit; fix the CH-17 attributions in `src/planificador.ts` and `src/automatizaciones.ts` (DEC-95).
- Runs view shows readable messages for `solapamiento` and `interrumpida`.
- Bitácora `docs/bitacora/CH-17a-*.md`.

### Out of Scope
- X5 retry (CH-17b, DEC-97/98). X6/X8 (CH-18). Agent connectivity (CH-19).
- Catch-up, coalesced-fire marks, per-tick reaper, partial unique index, multi-instance safety.
- Migration (`estado`/`error` are free TEXT).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `execution-log`: `omitida` joins the `estado` set; `solapamiento` and `interrumpida` join the `error` set; overlap skips and sweep closures are recorded outcomes.
- `automation-scheduling`: overlap guard, boot sweep before the first tick, signal-driven shutdown, no-catch-up limit.
- `tenant-isolation`: the sweep enters each tenant context (including deactivated tenants) from own-database `Tenant` rows through the structural extension. No raw SQL.
- `query-console`: readable messages for the new error values.

## Approach

- Sweep as an injectable planner step awaited before `iniciar()` schedules ticks. Errors are logged, and boot continues.
- Overlap lookup inside `correr()` before `ejecucion.create`, through the scoped client.
- Signal registration factored out so it can be tested without killing the test process.
- Strict TDD against live PostgreSQL with the fake `Reloj`.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/planificador.ts` (+ test) | Modified |
| `src/server.ts` | Modified |
| `src/automatizaciones.ts` | Comment only |
| `src/consola.ts` (+ test) | Modified |
| `docs/bitacora/CH-17a-*.md` | New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Live-process stuck row blocks the automation until the next boot | Med | Accepted (DEC-99); one `omitida` row per tick keeps it visible |
| Lookup/create race | Low | Serial tick; reopen if CH-18 adds parallelism |
| Multi-instance sweep kills live runs | Low | Single instance (DEC-75); documented |
| Existing scheduler tests change | Med | Inject the sweep; keep the tick-path tests unchanged |

## Rollback Plan

Revert the PR. No schema change. Existing `omitida`/`interrumpida` rows stay readable as free text.

## Dependencies

- `master` at `62026ee` (DEC-95..DEC-101 recorded).

## Review Workload Forecast

- Code + tests: ~330–430 changed lines (artifacts excluded).
- `400-line budget risk: Medium`
- `Chained PRs recommended: No`
- `Decision needed before apply: No`. DEC-101 already decides that going over 400 means splitting into slices inside CH-17a (sweep + signals first, then overlap + console).

## Success Criteria

- [ ] After boot, no `en-curso` row remains for any tenant. A sweep failure does not block startup.
- [ ] An automation with an `en-curso` row gets one `omitida`/`solapamiento` row per tick, and no query runs.
- [ ] SIGTERM/SIGINT trigger `app.close()` → `detener()`.
- [ ] No migration, no raw SQL, no catch-up; the CH-17 comments are corrected.
