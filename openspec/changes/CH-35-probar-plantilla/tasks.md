# Tasks: CH-35 — Testing a template against a connection from the console

Inputs: proposal.md, specs/query-console/spec.md, design.md. Delivery: auto-chain; one PR (forecast below the budget).

## 1. Console
- [x] 1.1 Markup: the `#plantilla-prueba` block of design §1 inside `#plantilla-panel`, after `#plantilla-sql`; its ids in `IDS`.
- [x] 1.2 Script: `plantillaAbierta`, `entradasPrueba`, `cargarConexionesPrueba`, `probarPlantilla` and `limpiarPruebaPlantilla`, per design §2. Hook them into `verPlantilla`, «Cerrar» and the tenant switch. No new `zd-*` in the script.
- [x] 1.3 `src/consola.test.ts`: the CH-35 tests of design §3.

## 2. Docs
- [x] 2.1 `docs/02-mapa-de-changes.md`: the CH-35 row, after CH-34.
- [x] 2.2 `guidelines/pantallas.md`, in both copies (`.claude/skills/…` and `.agents/skills/…`): one line on testing a template (DEC-177).

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/consola.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts`.

## Review Workload Forecast
- Estimated changed lines: ~250
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
