# Verify report: CH-26 — Freshness warning in the automation wizard

Date: 2026-10-16. Verdict: **pass**. Delivery: single PR (~113 lines of code and tests).

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean |
| `npm run build` | clean |
| `npx tsx --test src/consola.test.ts` | 319 / 319 (3 new CH-26 tests; the CH-21c card-structure test updated) |

## Spec coverage
| Scenario | Evidence |
|---|---|
| Window above the tolerance | CH-26 test 1: both cards warn with «3 h» / «1 h» and «2 h»; radios enabled |
| Window not above the tolerance | CH-26 test 2: window 90 with tolerance 90 says nothing |
| Undeclared window | CH-26 test 2: `null` window says nothing; a template with no tolerance says nothing |
| Creating a warned template | CH-26 test 3: the banner ends with the warning; the POST body is the usual one |

## Notes
- No route, engine, panel or migration change; the warning is never sent (DEC-180, DEC-142).
- The console script lives in a TypeScript template literal: comments in it must not use backticks.
