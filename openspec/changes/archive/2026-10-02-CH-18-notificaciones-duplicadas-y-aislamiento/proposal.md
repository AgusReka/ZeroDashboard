# Proposal: CH-18 — At-Most-Once Notification and Per-Tenant Failure Isolation (X6, X8)

**Status**: ready for spec and design. Inputs: exploration.md, DEC-107..DEC-111 (firm, 2026-10-02).

## Intent

- X8: a throw outside `correr()` in one tenant aborts the tick; later tenants lose their window (DEC-95). A dead agent connection may crash the process (unverified).
- X6: one send per run already holds by construction, but it is not a stated invariant, and a crash or timeout leaves the log unable to say whether the mail left.

## Scope

### In Scope
- Unit 1 (X8-A, DEC-109/110/111): per-tenant try/catch in `ejecutarTick`, closed-field log, serial tick. Socket-destroying test: `'error'` listener on `pg.Client` (`src/db-probe.ts`) only if it proves the crash; if refuted, nothing added.
- Unit 2 (X6-B, DEC-107/108): at-most-once invariant + tests across retry, overlap skip, sweep, `detener()`; write-ahead `notificacion='enviando'`; sweep closes it `fallo`/`interrumpida`/`incierta`; timeout shown as "puede haberse entregado".
- Unit 3: remove "CH-18 pending" wording (specs, `src/planificador.ts:43-45,446-448`); bitácora `docs/bitacora/CH-18-*.md`; archive.

### Out of Scope
- X8-B lanes, X8-C loops, X8-D circuit breaker (DEC-110); X6-C notification table, X6-D content/cooldown dedupe (DEC-107). Documented as artifact limits (rule 6).
- Send retry (DEC-97), re-running interrupted runs (DEC-99), catch-up (DEC-95), partial unique index (DEC-111), migration, CH-19.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `automation-scheduling`: per-tenant failure isolation within a serial tick; Purpose and "Not CH-18 Isolation" requirement updated.
- `email-notification`: at-most-once send invariant; write-ahead marker; timeout may have delivered.
- `execution-log`: `enviando`/`incierta` join the `notificacion` set; sweep no longer always nulls `notificacion`.
- `tenant-isolation`: a failure inside one tenant context does not stop other tenants' context entry; log carries closed fields only.
- `query-console`: labels for `enviando`/`incierta`; timeout copy.

## Approach

- Catch pattern copied from the boot sweep (DEC-102).
- Marker as one extra scoped `update` before `notificador.enviar`; the close path is unchanged.
- Strict TDD, live PostgreSQL, fake `Reloj`, `notificadorFalso` call counts.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/planificador.ts`, `src/automatizaciones.ts` (+ tests) | Modified |
| `src/db-probe.ts` (+ test) | Conditional |
| `src/consola.ts` (+ test) | Modified |
| `docs/bitacora/CH-18-*.md` | New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rule 6 drift toward lanes/outbox | Med | DEC-110/107 limits |
| Spike inconclusive | Med | No test, no listener |
| Console labels missed | Med | Delta in `query-console` |
| Size over budget | High | `size:exception` accepted |

## Rollback Plan

Revert the PR. No schema change. Reverted sweep nulls `enviando`; existing `incierta` rows stay readable as free text.

## Dependencies

- Branch at `a09ab39` (DEC-107..DEC-111 recorded).

## Review Workload Forecast

- ~410-490 changed lines; `400-line budget risk: High`; `Chained PRs recommended: No`; `Decision needed before apply: No` (single PR, `size:exception`).

## Success Criteria

- [ ] One tenant's throw does not stop other tenants in the same tick.
- [ ] Notifier called at most once per run in every path.
- [ ] Simulated crash after marker yields `fallo`/`interrumpida`/`incierta`.
- [ ] Listener present only if its test proved the crash.
