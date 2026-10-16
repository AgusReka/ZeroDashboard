# Archive Report: CH-26

**Change**: CH-26 — Freshness warning in the automation wizard (F3, R3; DEC-180)
**Archived at**: 2026-10-16, after PR #195 was merged.
**Destination**: `openspec/changes/archive/2026-10-16-CH-26-advertencia-de-frescura/`

**Main spec synced**:
- `query-console` gains "Freshness Warning in the Wizard (DEC-180)". Requirements go from 49 to 50, scenarios from 145 to 149.

## Artifacts

exploration.md, proposal.md, specs (query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-180** (taken by the user on 2026-10-16): F3 asks to warn P2 on activation, but the panel activates nothing (DEC-137). The warning goes where activation happens today: the console's «Nueva automatización» wizard. Advisory only; the engine, the panel and the routes do not change (DEC-142).

## Verify summary

PASS (see `verify-report.md`):
- `tsc --noEmit` and `npm run build` are clean.
- `consola.test.ts`: 319 of 319, with 3 new CH-26 tests.

## Final state

- A template card whose tolerance is below the active tenant's declared window names both values and says the automation can still be created; the creation notice repeats it.
- No warning with an undeclared window, a window within the tolerance or a template with no tolerance. Recomputed each time the wizard opens.

## Open items

None. P2 still does not see the warning; option (b) of the exploration stays available if the client needs it (DEC-180).
