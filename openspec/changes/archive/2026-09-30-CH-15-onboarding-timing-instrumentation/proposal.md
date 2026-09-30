# Proposal: CH-15 — Onboarding (alta) Timing Instrumentation (G1)

**Status**: ready for spec and design. Inputs: explore.md, DEC-87..DEC-89.

## Intent

G1: P4 must measure how long each stage of a tenant's onboarding took (connection, mapping, validation, first execution) in R1. The columns exist; nothing derives or records the marks.

## Scope

### In Scope
- Checked-in, read-only SQL script deriving the marks from existing columns (DEC-87).
- Marks per `Conexion` row (DEC-89): `Tenant.creadoEn`; connection = `Conexion.creadaEn` (DEC-88); mapping start/end (min `creadaEn`, max `actualizadaEn`); latest validation + `estadoValidacion`; first execution + `estado`/`fase`; first `estado='ok'`; `Automatizacion.creadaEn` (informational).
- Fixture-based node:test running the script file unchanged (live-DB skip when unreachable).
- Documented limits: connection = registration, mutable validation mark, elapsed time not effort, clock mix, no backfill, no CH-16 retro-measure.
- Bitácora `docs/bitacora/CH-15-*.md` from `docs/_plantilla.md`, with dated outputs in "Consultas ejecutadas" (G3).

### Out of Scope
- Migration, route, console panel, engine or scheduler changes, "run now" (rule 6).
- Persisting connection-test results; write-once marks; `EventoAlta`.
- Per-tenant aggregate; G2/G3 practice; C3.
- Fixing stale docs (AGENTS.md gates, config.yaml, mapa lists).

## Capabilities

### New Capabilities
- `onboarding-timing-marks`: mark definitions, sources, per-connection shape, null semantics, read-only script contract, documented limits.

### Modified Capabilities
None. No model, route or isolation surface changes.

## Approach

- One SELECT-only file; tenant filter, if any, bound as a driver parameter (rule 4). Never exposed by a route.
- Test seeds fixtures (failed then ok runs, re-validation, two connections) and asserts marks, nulls and one row per connection; no ordering assertions.
- Output captured in the bitácora at each alta close.

## Affected Areas

| Area | Impact |
|------|--------|
| SQL script (path set in design) | New |
| `src/*.test.ts` fixture test | New |
| `docs/bitacora/CH-15-*.md` | New |
| `openspec/.../specs/onboarding-timing-marks/spec.md` | New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Validation mark overwritten later | High | Capture output at alta close |
| Cron wait read as effort | Med | Fifth mark; documented limit |
| Clock mix inverts marks | Low | No strict ordering assumed |
| Cross-tenant listing | Low | Out-of-band P4 tool only |
| Base drift vs CH-14 | Low | Base on `ch14/7-verify-archivo` |

## Open for design (flagged, not decided)
- Script location and whether it takes a tenant filter or lists all tenants.
- How the test loads the file without string concatenation. If either implies a new architecture decision, stop and register it.

## Rollback Plan

Delete the script, test, bitácora and change folder. No schema, runtime or data impact.

## Dependencies

- CH-14 stack (`ch14/7-verify-archivo`, unmerged).

## Delivery

Single PR. `400-line budget risk: Low`.

## Success Criteria

- [ ] Script returns every DEC-89 mark per connection; unreached stages are null.
- [ ] Test passes against fixtures; skips when DB unreachable.
- [ ] Bitácora records a dated run and all documented limits.
- [ ] No migration, route or engine diff.
