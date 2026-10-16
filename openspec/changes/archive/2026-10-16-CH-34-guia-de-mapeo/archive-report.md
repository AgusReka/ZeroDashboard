# Archive Report: CH-34

**Change**: CH-34 — A step-by-step guide and an example SQL per entity on the Mapping screen
**Archived at**: 2026-10-16, after PR #183 was merged (`bd9c6d7`)
**Destination**: `openspec/changes/archive/2026-10-16-CH-34-guia-de-mapeo/`

**Main spec synced**:
- `query-console`, "Mapping and Validation Screen", replaced in place. It now covers the «Cómo mapear» guide, the fixed example per entity, «Usar de punto de partida» (copies only into an empty editor, sends nothing, keeps the state), and the alignment of each example with the contract. Scenarios go from 127 to 131. Requirements stay at 47.

## Artifacts

exploration.md, proposal.md, specs (query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-176**, taken by the user on 2026-10-16. It narrows DEC-30's resignation from "no assistance" to "no generated assistance". The model of DEC-30 and DEC-169 holds: the operator writes and saves every SELECT, there is no generator and no column picker, and nothing reads the client's replica to build SQL.
- **D1 (a):** record the help as a new DEC.
- **D2 (a):** a fixed example per entity, taken from the food_store demo replica's views and rewritten as plain SELECTs.
- **D3 (b):** «Usar de punto de partida» copies the example only into an empty editor.
- The examples live in `src/mapeo-ejemplos.ts` and are written once into the console script through `jsonEnScript`. This is the second interpolation in the document, and the only constant one.

## Verify summary

PASS (see `verify-report.md`):
- `tsc --noEmit` is clean.
- `mapeo-ejemplos.test.ts` and `consola.test.ts`: 291 of 291.
- `npm run test:db`: 1456 of 1460. The 4 failures are the known `conexiones` false positives.
- `gentle-ai review assess`: medium risk. Receipt-driven development is off.

## Final state

- The Mapping screen shows a collapsible «Cómo mapear» guide above the entities.
- Every entity block holds its food_store example as text, plus «Usar de punto de partida».
- A test keeps each example's aliases equal to its entity's fields in `CONTRATO_CANONICO`.
- No route, migration, engine or validation change.

## Open items

- From the audit's F3: template → saved query (§3.2), and the CH-30e screens.
- Per-platform examples (Medusa, Woo, Saleor) were left out of scope. If they are wanted later, they need a new decision.
