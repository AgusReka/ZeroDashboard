# Tasks: CH-30d — Mapping and validation, Templates and Contract screens

Branch base: `master` (after CH-30c). Strict TDD: the test cases first, against `npm test`.

## Review Workload Forecast
- Estimated changed lines: ~860 (PR1 ~380, PR2 ~480)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR0 — Planning
- [ ] 0.1 DEC-169, exploration, proposal, spec, design and tasks (`ch30d/exploracion`); the change map row.

## PR1 — Plantillas and Contrato
- [ ] 1.1 RED: navigation order; Plantillas rows, detail panel as text, cut notice; Contrato entities and fields.
- [ ] 1.2 GREEN: markup and script of both screens.

## PR2 — Mapeo y validación
- [ ] 2.1 RED: no tenant / no connection, the entity blocks, saving, a session failure, an invalid field with its hint, automations with reasons, SQL with markup as text.
- [ ] 2.2 GREEN: markup, script and bridge style.
- [ ] 2.3 Manual visual pass of the three screens at 360 px and 1280 px, light and dark.

## Close
- [ ] 3.1 Full suite, `tsc --noEmit`, `npm run build`.
- [ ] 3.2 Verify, archive, sync `query-console` (replace "Navigation by Hash" keeping every scenario; append the new requirements), mark CH-30d in `docs/02-mapa-de-changes.md`.
