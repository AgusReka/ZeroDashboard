# Proposal: CH-26 — Freshness warning in the automation wizard

**Status**: ready for apply. Inputs: `exploration.md`, DEC-180, DEC-142, DEC-127, DEC-128.

## Intent
Whoever activates an automation knows, before creating it, when the tenant's replica refreshes less often than the template tolerates (F3). Today that only shows later, on the Frescura screen.

## Scope

### In Scope
- In the «Nueva automatización» wizard, each template card whose tolerance is below the active tenant's window shows a warning naming both values; the card stays selectable.
- The creation notice repeats the warning when the chosen template was in that situation.
- No warning when the window is undeclared or not greater than the tolerance (the CH-24 comparison).

### Out of Scope
- Any panel change (DEC-137 contract), any route, engine or migration change; blocking creation (DEC-142).
- «Ajustar»: the template does not change there.

## Capabilities

### Modified Capabilities
- `query-console`: adds the Freshness Warning in the Wizard requirement.

## Approach
Front only, in `src/consola.ts`. The wizard already has each template's tolerance (`catalogoPlantillas`) and the tenant's window (`tenantsCargados`); `estadoFrescura` is the client twin of `evaluarFrescura`. Each card gains a hidden text slot with a local class (G3'), refreshed when the catalog renders and when the wizard opens.

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`
- `openspec/specs/query-console/spec.md` (at archive)

## Rules check
Rules 1 to 7 untouched: no SQL, no route, no data sent; text only.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A stale window after editing Frescura or switching tenant | Medium | The warnings are refreshed every time the wizard opens |
| Read as a block | Low | The text says the automation can still be created; the card stays enabled |
| Provisional tolerances make it noisy | Medium | Accepted in DEC-180 |

## Rollback
Revert the PR: front only, no data.
