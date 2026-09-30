# Tasks: CH-15 — Onboarding (alta) Timing Instrumentation (G1)

Derived from `design.md` and `specs/onboarding-timing-marks/spec.md`. Decisions DEC-87..92 are already registered in `docs/01-decisiones.md` (design items B1-B3 resolved as DEC-90, DEC-91, DEC-92). No task edits that file. No migration, route, console or engine change.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250-350 (SQL ~60, test ~190, bitácora ~60) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Script, fixture test, bitácora | `ch15/1-instrumentacion-de-tiempos-de-alta` (base: tip of `ch14/7-verify-archivo`) | `npm test -- src/marcas-alta.test.ts` | psql run with `default_transaction_read_only=on` against the own DB | Delete the three new files; nothing consumes them |

## 1. Branch & Script

- [x] 1.1 Create branch `ch15/1-instrumentacion-de-tiempos-de-alta` from the tip of `ch14/7-verify-archivo`. Do not stage the stray untracked `0` and `run`; commit the CH-15 planning artifacts first, docs only
- [x] 1.2 Verify at apply: node-pg sets `requiresPreparation` for a named query (single-statement guarantee); explicit `actualizadaEn` survives `@updatedAt` on raw create (fallback: admin `UPDATE` in setup). Record findings in the PR body
- [x] 1.3 Create `scripts/marcas-alta.sql`: header comment (DEC-87..92, limits, psql command), one SELECT with per-source CTEs keyed by `conexionId`, `LEFT JOIN`ed to `Conexion`, `DISTINCT ON` (validation `validadaEn DESC, entidad, id`; first run `iniciadaEn ASC, id`; run's connection via `Automatizacion.conexionId`). Columns per design; no `$n`, no `\`, ends with `;` (specs "One Row per Conexion", "Mark Sources and Definitions", "Null When a Stage Has Not Happened")

## 2. Fixture Test (`src/marcas-alta.test.ts`)

- [x] 2.1 RED static tests: no non-test `src/*.ts` references `marcas-alta.sql`; the file has no `$n` placeholder or `\` line (specs "No route exposure", "Read-only content")
- [x] 2.2 RED live-suite setup: skip when PG is unreachable (spec "Database unreachable"); throwaway role `ch15_lector` with `GRANT SELECT (cols)` only on the columns read, never `credencial`, `host` or `sql`; `SQL_LIMPIEZA` (`DROP OWNED BY`, `DROP ROLE`) in `before` and `after`; UTC parser for OID 1114 on the test's own client
- [x] 2.3 RED fixture (raw Prisma, fixed 2020 timestamps, `marca` prefix, explicit `actualizadaEn`): tenant A/A1 (two views, `producto` re-validated, `insumo` `invalida` earlier; two automations; runs `fallo/preparacion`, `fallo/ejecucion`, `ok`); A2 bare; tenant B deactivated with one connection
- [x] 2.4 RED assertions: the script file read unchanged, run through a named `{name, text}` query inside `BEGIN READ ONLY`; a second statement is rejected; reading a non-granted column fails; rows indexed by `conexion_id`, filtered to fixture tenants; one row per connection with A1/A2 sharing the tenant mark; failed-then-ok run marks; latest validation incl. `invalida`; nulls for A2; deactivated B still present; cleared validation is null; no assertion on order between marks (specs "Failed run then ok run", "Re-validation", "No runs yet", "Never validated", "Clock mix")
- [x] 2.5 GREEN: adjust `scripts/marcas-alta.sql` until 2.1-2.4 pass
- [x] 2.6 `after` cleanup per tenant in FK order: `ejecucion`, `automatizacion`, `vistaCanonica`, `conexion`, `tenant`; then plantillas by `marca`; then the role

## 3. Bitácora & Close

- [x] 3.1 Create `docs/bitacora/CH-15-instrumentacion-de-tiempos-del-alta.md` (Spanish, from `docs/bitacora/_plantilla.md` (read-only)): script path and commit, exact psql command, "Consultas ejecutadas" with a dated block (`-- ejecutada AAAA-MM-DD sobre la base propia; universo: todas las conexiones`) holding the raw output of a real run (spec "Limits recorded")
- [x] 3.2 Same file, "Límites del artefacto": mutable validation mark (capture at each alta close); elapsed time, not effort; connection is registration; no strict order across marks (clock mix); no backfill nor CH-16 retro-measurement; Food Store `creadoEn` is seed time; own-DB read-only is one DB layer (DEC-92)
- [x] 3.3 Checkpoint: `npm test` green; `npx tsc --noEmit` clean; `git diff --stat` shows no `prisma/`, `src/server.ts`, engine or scheduler change (spec "Diff surface")
- [ ] 3.4 Run `sdd-verify` against the spec, then `sdd-archive`

## Traceability

- One row per connection, nulls → 2.3, 2.4
- Read-only, no route, no parameters → 2.1, 2.2, 2.4
- Documented limits and dated output → 3.1, 3.2
