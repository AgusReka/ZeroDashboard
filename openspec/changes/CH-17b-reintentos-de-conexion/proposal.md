# Proposal: CH-17b — Bounded Connection Retries (X5)

**Status**: ready for spec and design, pending OQ-1..OQ-3. Inputs: CH-17 explore.md (archived with CH-17a), DEC-97, DEC-98.

## Intent

A scheduled run whose connection fails transiently is closed `fallo` and waits for the next fire. X5: retry with a cap; once exhausted, mark the run failed.

## Scope

### In Scope
- Retryable only: `fase='conexion'` with `host-inalcanzable`, `dns-no-resuelve`, `tiempo-agotado` (DEC-97).
- In-run loop around the connect-and-query step in `correr()`; fixed pause via `Reloj.programar` wrapped in a promise (DEC-98).
- Policy injected into `crearPlanificador`, default "no retry"; `server.ts` wires the env-derived policy.
- Two global env vars (defaults: 3 total attempts, 5000 ms pause), parsed like DEC-19 budgets; placeholders in `.env.example` and `docker-compose.yml`.
- Additive migration: nullable `Ejecucion.intentos`. One row per run; exhausted cap closes `fallo` with the last attempt's category.
- Bitácora `docs/bitacora/CH-17b-*.md`.

### Out of Scope
- Notification retry (email-notification "exactly one send attempt" unchanged); X6/X8 (CH-18); CH-19.
- Any other category or phase; per-automation/template config; queue; backoff; catch-up (DEC-95); console query/test paths.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `automation-scheduling`: bounded connection retry inside a run; the row stays `en-curso` across attempts, so the overlap guard still applies.
- `execution-log`: nullable `intentos`; one row per run; exhausted cap closes `fallo` with the last category.
- `project-environment`: retry variables, defaults, placeholder-only example.
- `query-console`: only if OQ-1 chooses to display `intentos`.
- `email-notification`: no delta (reaffirmed).

## Approach

- Pure predicate beside `cierreDeResultado` decides retryability.
- Row created once before the loop, closed once after it (unchanged close path).
- Strict TDD, live PostgreSQL, fake `Reloj`; the closed-port fixture (`host-inalcanzable`) retries only where a policy is injected.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/planificador.ts`, `src/automatizaciones.ts`, `src/config.ts` (+ tests) | Modified |
| `src/server.ts` | Modified (wiring) |
| `prisma/schema.prisma`, `prisma/migrations/<ts>_ejecucion_intentos/` | Modified / New |
| `.env.example`, `docker-compose.yml` | Modified |
| `docs/bitacora/CH-17b-*.md` | New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Serial tick blocked ≈ 3×5 s connect + 2×5 s pause = 25 s per dead automation, multiplied per automation on that connection | Med | Small cap (DEC-98); isolation is X8/CH-18 |
| Shutdown waits for in-flight retries (OQ-2) | Med | Decide before design |
| Existing tests change silently | Med | No-retry default |
| Fake-clock pause tests fragile | Med | Pause only through injected `Reloj` |
| Spec drift | Low | Deltas in modified specs |

## Rollback Plan

Revert the PRs. Keep the applied migration (reverted code ignores a nullable column) or add a forward migration dropping it; never delete an applied migration file.

## Dependencies

- `master` at `e0dfe7c` (CH-17a merged, DEC-97/98 recorded).

## Review Workload Forecast

- Code + tests: ~330–430 changed lines (+20–40 if OQ-1 displays `intentos`).
- `400-line budget risk: Medium`
- `Chained PRs recommended: Yes`
- `Decision needed before apply: No` (auto-chain chosen).
- Slice 1: config, env files, migration, predicate (~140). Slice 2: loop, wiring, tests (~250).

## Open Questions (not covered by DEC-97/98)

- OQ-1: Is `intentos` exposed in the runs listing API and console runs view?
- OQ-2: On `detener()` during a pause: cancel and close with the last attempt, or finish the loop?
- OQ-3: `intentos` for runs that never dialled (null or 0) and for first-try runs (1 or null).

## Success Criteria

- [ ] Transient failure then success: one row, `ok`, `intentos=2`.
- [ ] Cap exhausted: one row, `fallo`, last category, `intentos` = cap.
- [ ] Non-retryable, query-phase and notification failures make exactly one attempt.
- [ ] Existing scheduler tests pass unchanged.
