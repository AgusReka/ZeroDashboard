# Tasks: CH-33 — Adjusting an automation from the console, and a typed confirmation for a tenant's baja

Branch base: `master` (after #180). Tests first. While working: `npx tsx --test <files>` with the test-database variables; full suite `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`.

## Review Workload Forecast
- Estimated changed lines: ~1100 code and tests (design §7) plus ~450 of planning docs
- 400-line budget risk: High
- Chained PRs recommended: Yes (slices 1–3 of design §7, each under 400–450)
- Decision needed before apply: Yes — the session's delivery strategy is single PR: split into the three slices, or one PR with `size:exception`
- **Decided by the user (2026-10-14): one PR with `size:exception`** (branch `ch33/ajuste-y-baja`); the PR sections below are commit groups, not separate PRs.

## PR0 — Planning
- [x] 0.1 Exploration, proposal, specs, design and tasks; DEC-174 (with its CH-33 precision) and DEC-175; the audit's F3 marks; the CH-33 row in `docs/02-mapa-de-changes.md`.

## PR1 — Baja with the typed name
- [x] 1.1 RED: `tenants.test.ts` cases of design §6 (wrong case, trailing space, empty, no body, `{}`, extra key, unknown id, inactive); `bajaDe` helper; existing calls send the name.
- [x] 1.2 GREEN: `bajaTenantSchema` and the name check in `src/tenants.ts` (design §2).
- [x] 1.3 Callers: `contexto-tenant.test.ts:531`, `scripts/smoke.sh:565`.
- [x] 1.4 RED → GREEN: console baja pop-up (design §4); the two CH-30b inline tests rewritten; ids in `IDS` / `IDS_OCULTOS`.

## PR2 — Adjust route
- [x] 2.1 RED: `resolverAjusteOperador` units and schema refusals (no DB).
- [x] 2.2 GREEN: resolver, schema and `PUT /automatizaciones/:id/ajustes` (design §1); module header comment.
- [x] 2.3 RED → GREEN: DB cases (id and runs kept, only sent columns, `proximaEjecucion`, 404, 409).
- [x] 2.4 Isolation sweep: `aislamiento.test.ts:455` gains the route.

## PR3 — Console «Ajustar»
- [x] 3.1 Refactor: `actualizarHorarioDe(c)`, `presetDeCron`, `horarioEnPalabras` on it, `construirValores`; wizard tests pass unchanged.
- [x] 3.2 RED: «Ajustar» tests of design §6; new ids in `IDS` / `IDS_OCULTOS`.
- [x] 3.3 GREEN: markup, `abrirAjuste`, snapshot and dirty check, `guardarAjuste`, `confirmacionDeAjuste`, row button; rewritten copy (`:643`, `:703`).

## Close
- [x] 4.1 `npm run test:db`, `tsc --noEmit`, `npm run build`.
- [x] 4.2 Verify, archive, sync the three specs, mark CH-33 in `docs/02-mapa-de-changes.md`.
