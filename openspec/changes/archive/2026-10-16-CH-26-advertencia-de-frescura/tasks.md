# Tasks: CH-26 — Freshness warning in the automation wizard

Inputs: proposal.md, specs (query-console), design.md. Delivery: single-pr.

## 0. Planning
- [x] 0.1 Exploration, DEC-180, the change map row and this change's proposal, spec, design and tasks.

## 1. Console
- [x] 1.1 Script and style per design: `avisoFrescuraPlantilla`, the card slot, `actualizarAvisosFrescura`, the creation notice.
- [x] 1.2 `src/consola.test.ts`: the CH-26 tests and the updated card-structure test.

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/consola.test.ts`

## Review Workload Forecast
- Estimated changed lines: ~120 (plus ~180 of planning docs)
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
