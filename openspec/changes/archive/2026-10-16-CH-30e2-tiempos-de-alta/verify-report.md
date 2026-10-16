# Verify report: CH-30e2 — Onboarding times route and screen

Date: 2026-10-16. Verdict: **pass**. Delivery: single PR under `size:exception` (accepted by the user on 2026-10-16).

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean |
| `npm run build` | clean |
| `npx tsx --test src/consola.test.ts` | 316 / 316 |
| `npx tsx --test src/tiempos-alta-rutas.test.ts src/marcas-alta.test.ts` (test database) | 17 / 17, live suites ran |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1492 / 1496; the 4 failures are the known false positives of `conexiones.test.ts` |

## Spec coverage
| Requirement | Evidence |
|---|---|
| Active Tenant Marks Route | `tiempos-alta-rutas.test.ts`: header tenant only, no credential/host/tenant id, `400 tenant-no-indicado` without header |
| Route and Script Parity | same test file: the checked-in script and the route give equal marks for A1 (re-validation, tie on `validadaEn`, failed then ok runs, tie on `iniciadaEn`) and A2 (nulls) |
| No Schema, Route, or Engine Change (modified) | `marcas-alta.test.ts` static guard still passes: no application module names the script |
| Navigation by Hash | CH-30e2 nav order and `soloVisible` tests |
| Onboarding Times Screen | CH-30e2 console tests: header, stages and «Pendiente», elapsed time, clock mix, validation state, failed first run phase, no tenant, no connections, cut list, HTTP 500, markup as text, tenant switch |

## Notes
- The CH-15 static guard matches the script's file name anywhere in a non-test module, comments included; the route's header comment refers to "the CH-15 marks script" for that reason.
- Measured size: ~556 lines of code and tests, plus ~270 of planning docs.
