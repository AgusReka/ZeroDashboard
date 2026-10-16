# Tasks: CH-30e2 — Onboarding times route and screen

Inputs: proposal.md, specs (onboarding-timing-marks, query-console), design.md. Delivery: single-pr.

## 0. Planning
- [x] 0.1 This change's proposal, specs, design and tasks (DEC-178 and the change map row already exist).

## 1. Route
- [x] 1.1 `src/tiempos-alta.ts`: `registerTiemposAltaRoutes`, per design §1; registered in `src/rutas.ts`.
- [x] 1.2 `src/tiempos-alta-rutas.test.ts`: the parity and isolation tests of design §2.

## 2. Console
- [x] 2.1 Markup and bridge style of design §3; ids in `IDS`, the section in `IDS_OCULTOS`.
- [x] 2.2 Script of design §4. No new `zd-*` in the script.
- [x] 2.3 `src/consola.test.ts`: the CH-30e2 tests of design §5.

## 3. Docs
- [x] 3.1 `guidelines/consola.md`, both copies: C-07 built by CH-30e2 over `GET /tiempos-alta`; «conexión probada» → «conexión registrada».

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/consola.test.ts src/marcas-alta.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts`.

## Review Workload Forecast
- Estimated changed lines: ~450–500 (plus ~200 of planning docs)
- 400-line budget risk: High
- Chained PRs recommended: No
- Decision needed before apply: taken — the user accepted `size:exception` on 2026-10-16, keeping one PR per change as DEC-178 says.
