# Tasks: CH-22c — Panel "My Automations" with Failure State (P3h)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~240, PR2 ~150, PR3 ~140 (docs excluded) |
| 400-line budget risk | PR1 Low, PR2 Low, PR3 Low |
| Chained PRs recommended | Yes |
| Decision needed before apply | No |
| Suggested split | PR0 (SDD artifacts) -> PR1 (pure layer + unit tests) -> PR2 (route tests) -> PR3 (panel page + page tests) |
| Delivery strategy | chained PRs |
| Chain strategy | stacked-to-main: PR(n+1) branched from PR(n), base `master`; merge in order, rebase on master after each merges |
| Review budget | 400 changed lines per PR |

> Slicing rule: budget constrains slice, not code (no trimming of comments/blank lines/docs/tests). If overage, report and recommend `size:exception`.

## Chain overview
```
master <- PR0 (docs) <- PR1 (pure layer) <- PR2 (route tests) <- PR3 (page)
```

| PR | Branch | Depends on | Est. lines |
|----|--------|------------|-----------|
| PR0 | `ch22c/exploracion` | none | docs only |
| PR1 | `ch22c/capa-pura` | PR0 merged | ~240 |
| PR2 | `ch22c/rutas-tests` | PR1 merged | ~150 |
| PR3 | `ch22c/pantalla` | PR2 merged | ~140 |

## PR0: SDD Artifacts (docs only)
Branch `ch22c/exploracion`. Base `master`.

- [ ] 0.1 Create change folder and artifacts: `exploration.md`, `proposal.md`, `design.md`, `tasks.md`, `specs/client-panel-automations/spec.md`.

Commits: `docs(sdd): add CH-22c exploration/proposal/spec/design/tasks (failure state)`.

## PR1: Pure Layer + Unit Tests (~240)
Branch `ch22c/capa-pura`. Base `master` (after PR0 merges).

- [ ] 1.1 Update `src/panel-automatizaciones.ts`: change `ItemActiva.estado` type to include `'con_falla'`. Update `proyectarActiva()` to derive `con_falla` when `activo === true` and latest finished run has `resultado === 'no-realizada'`. Keep allow-list and existing behavior for other cases.
- [ ] 1.2 Add/extend unit tests in `src/panel-automatizaciones.test.ts` (pure section):
  - Active + `fallo` → `con_falla`
  - Active + `omitida` → `con_falla`
  - Active + `ok` → `activa`
  - Active + only `en-curso` (null ultima) → `activa`
  - Paused + `fallo` → `pausada` (never con_falla)
  - Projection keys unchanged (allow-list)

Commits:
1. `feat(panel): derive estado con_falla in automation projection (CH-22c)`
2. `test(panel): cover con_falla derivation in pure layer (CH-22c)`

Verification: `npx tsc --noEmit`, `npx tsx --test src/panel-automatizaciones.test.ts`, `npm run build`.

## PR2: Route Tests (~150)
Branch `ch22c/rutas-tests`. Base `master` (after PR1 merges).

- [ ] 2.1 Extend route tests in `src/panel-automatizaciones.test.ts` (DB-backed) to cover the same cases with live fixtures (ensure `con_falla` appears correctly, isolation unchanged).
- [ ] 2.2 Optional: add one case in `src/aislamiento-panel.test.ts` if helpful (no behavior change expected).

Commits: `test(panel): add route tests for con_falla state (CH-22c)`

Verification: `npx tsc --noEmit`, `npx tsx --test src/panel-automatizaciones.test.ts src/aislamiento-panel.test.ts`, `TEST_DB_PORT=5434 npm test` (where applicable), `npm run build`.

## PR3: Panel Page + Page Tests (~140)
Branch `ch22c/pantalla`. Base `master` (after PR2 merges).

- [ ] 3.1 Update `src/panel.ts` in `tarjetaActiva()`: when `item.estado === 'con_falla'`, render an inline error banner inside the card (business language: title "No pudimos completar esta automatización esta vez", body "La última revisión falló. La próxima vez que se ejecute, volvemos a intentarlo."). Use `.zd-banner .zd-banner--error` with `role="alert"`, insert via `textContent`/DOM creation (no innerHTML). Keep script constraints.
- [ ] 3.2 Update `src/panel.test.ts`: assert banner text appears when script receives `con_falla`; verify no forbidden terms in visible/script literals; existing safety checks still pass.

Commits:
1. `feat(panel): show failure banner in automation card when estado is con_falla (CH-22c)`
2. `test(panel): assert failure banner and glossary compliance (CH-22c)`

Verification: `npx tsc --noEmit`, `npx tsx --test src/panel.test.ts`, `TEST_DB_PORT=5434 npm test`, `npm run build`.

## Rollback
Revert PRs in reverse order; no migration or data change.
