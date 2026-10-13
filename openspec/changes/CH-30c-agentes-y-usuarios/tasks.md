# Tasks: CH-30c — Agents and panel users screens

Branch base: `master` (after CH-30b). Strict TDD: the test cases first, against `npm test`.

## Review Workload Forecast
- Estimated changed lines: ~850 (PR1 ~420, PR2 ~430)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR0 — Planning
- [ ] 0.1 Exploration, proposal, spec, design and tasks (`ch30c/exploracion`); the change map row.

## PR1 — Agentes and the connection's agent option
- [ ] 1.1 RED: navigation order; secrets shown once and cleared; Agentes states, emit, dismiss, revoke; the panel's agent option.
- [ ] 1.2 GREEN: markup, `mostrarSecreto`/`olvidarSecretos`, the Agentes script, `cx-via`.

## PR2 — Usuarios del panel
- [ ] 2.1 RED: list, create with the password once, 409, reset, deactivate confirmation, reactivate, clearing on leave and on tenant switch.
- [ ] 2.2 GREEN: markup and script.
- [ ] 2.3 Manual visual pass of both screens at 360 px and 1280 px, light and dark.

## Close
- [ ] 3.1 Full suite, `tsc --noEmit`, `npm run build`.
- [ ] 3.2 Verify, archive, sync `query-console` (replace "Navigation by Hash" with every scenario kept; append the new requirements), mark CH-30c in `docs/02-mapa-de-changes.md`.
