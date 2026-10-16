# Tasks: CH-30e1 — Audit screen in the console

Inputs: proposal.md, specs/query-console/spec.md, design.md. Delivery: single-pr.

## 0. Planning
- [x] 0.1 DEC-178, the CH-30e exploration, the change map rows CH-30e1 and CH-30e2, and this change's proposal, spec, design and tasks.

## 1. Console
- [x] 1.1 Markup: `nav-auditoria` and the `pantalla-auditoria` section of design §1; ids in `IDS`, the section in `IDS_OCULTOS`.
- [x] 1.2 Script: `PANTALLAS`, `mostrarPantalla`, `cambiarTenant`, `filtrosAuditoria`, `cargarPantallaAuditoria`, `filaAuditoria` and `ORIGENES_AUDITORIA`, per design §2. No new `zd-*` in the script.
- [x] 1.3 `src/consola.test.ts`: the CH-30e1 tests of design §3.

## 2. Docs
- [x] 2.1 `guidelines/consola.md`, in both copies: C-12 built by CH-30e1.

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/consola.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts`.

## Review Workload Forecast
- Estimated changed lines: ~310 (plus ~120 of planning docs)
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
