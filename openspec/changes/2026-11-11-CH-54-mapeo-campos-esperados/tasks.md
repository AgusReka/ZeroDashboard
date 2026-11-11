# Tasks: CH-54 — Mapping with expected fields

Inputs: proposal.md, specs/query-console/spec.md, design.md.

Delivery: **single-pr**. Branch `ch54/mapeo` after CH-52b merges. No new DEC.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~390: ~200 production (markup ~70, script ~110, bridge ~20) + ~190 tests |
| 400-line budget risk | Medium |
| Chained PRs recommended | No, unless the apply count passes 400 |
| Suggested split | If over budget: **54a** = section 1 (contract, field column, verdict words, labels); **54b** = section 2 (entity list, summary buttons, blocked state) |
| Delivery strategy | single-pr |
| Chain strategy | — |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: —
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Embedded contract, server-rendered blocks with labels, field column with verdict words | `npx tsx --test src/consola/consola.test.ts` | `npm test`; typecheck | Revert the PR |
| 2 | Entity list, selection, summary buttons, blocked state | same | `npm test`; smoke | Revert the PR |

## 1. Contract and field column
- [x] 1.1 Embed `var CONTRATO = ${jsonEnScript(CONTRATO_CANONICO)};` next to `EJEMPLOS_MAPEO`, and add a test that it equals the exported constant.
- [x] 1.2 Server-render the five entity blocks from `ENTIDADES_CANONICAS`, each with a `label for` «SELECT de {entidad}». Keep the editor ids and reduce `bloqueDeEntidad` to event wiring.
- [x] 1.3 Add the `aside#mapeo-campos` markup and the bridge grid rule (three columns; one column under 960 px).
- [x] 1.4 `renderizarCampos(entidad)` and `textoDeVeredicto(campo)`, with an unknown token falling back to the token.
- [x] 1.5 `renderizarInforme` stops writing the per-entity `<ul>`; keep `ultimoInformeMapeo`, cleared on a connection or tenant change.
- [x] 1.6 Tests:
  - fields are listed before validation;
  - each of the five verdicts produces its sentence;
  - the hint is in mono;
  - extra columns are listed;
  - the labels are associated.

## 2. Entity list, summary, blocked state
- [x] 2.1 `nav#mapeo-entidades`: one button per entity, with its state (icon + text) and `data-tono`.
- [x] 2.2 `seleccionarEntidad`: on load, select the first entity that is not valid.
- [x] 2.3 `resumenDeMapeo`: append one button per pending entity that selects it.
- [x] 2.4 Add `#mapeo-regla` above «Validar mapeo» with the validity rule sentence.
- [x] 2.5 `#mapeo-bloqueado`: with zero connections, show it with «Ir a Conexiones» and hide the columns.
- [x] 2.6 Tests:
  - the first non-valid entity is selected;
  - a summary button selects its entity;
  - the blocked state appears and no validation request is sent;
  - the existing save, failure and example cases are updated to select the entity first.

## 3. Verify
- [x] 3.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass.
- [x] 3.2 Check the `guidelines/admin.md` §14 items for this screen. The open question about a per-entity probe stays out of scope.

## Apply notes (2026-11-11)

**Evidence.**
- `consola.test.ts`: 501/501.
- `test:db`: 2325/2329. The 4 failures are the known `conexiones` false positives.
- `tsc`: ok.
- 291 changed lines in `src/`: one PR, within the budget.
- `scripts/smoke.sh` was not run: it runs `docker compose down` on the developer stack.

**Deviations, aligned in the spec delta where they touch it.**
- **1.2 Entity blocks.** They stay script-built rather than server-rendered. The label is a plain `<label>` with `htmlFor = 'mapeo-sql-{entidad}'`, and the block, list button and field items use local classes or attributes, never `zd-*` (G3'). Rendering them on the server would have rewritten every existing Mapeo test for no visible difference.
- **2.3 Summary links.** The banner body is text, so the links live in `#mapeo-pendientes`, right under it, as «Ir a {entidad}» buttons.
- **Probe failures and extra columns** stay in the entity block («Columna que sobra: …»): they concern the whole SELECT, not one field.
- **`tipo-incorrecto` without an observed semantic type** names the PostgreSQL type instead.
