# Verify report: CH-34 — A step-by-step guide and an example SQL per entity on the Mapping screen

**Verdict: PASS.** Date: 2026-10-16. Branch: `ch34/guia-de-mapeo`, not committed yet.

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx tsx --test src/mapeo-ejemplos.test.ts src/consola.test.ts` | 291 / 291 pass. The orchestrator re-ran this as a spot check: 291 / 291. |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1456 / 1460. The 4 failures are the known false positives in `conexiones.test.ts` (5.1, 5.3, 5.4, and "CH-07 the probe deciphers…"). |

## Spec scenarios → evidence
| Scenario | Test |
|---|---|
| Saving an entity; A session failure; An invalid field | Existing CH-30d Mapeo tests in `src/consola.test.ts`, unchanged and passing |
| The guide is part of the screen | `CH-34 the guide is static markup, closed, above the entities` (`src/consola.test.ts:4035`) |
| Copying the example into an empty editor | `CH-34 «Usar de punto de partida» copies the example into the empty insumo editor and sends nothing` (`:4047`) |
| The example never overwrites SQL | `CH-34 the example never overwrites SQL…` (`:4060`), which also covers a whitespace-only editor |
| Each example matches the contract | `src/mapeo-ejemplos.test.ts`: the keys equal the contract's entities, and per entity the alias set equals its fields |
| Every SQL, example and diagnostic written as text | `CH-34 every entity block renders its example as text…` (`:4076`) and `CH-34 jsonEnScript never emits "</"…` (`:4090`) |

## Tasks
8 / 8 checked in `tasks.md`.

## Design conformance and deviations
- `jsonEnScript` is exported from `src/consola.ts` so the test can import it.
- Bridge CSS for `#mapeo-guia` and the example `pre` uses tokens only.
- The header comment now names the operator as "the only interpolation of stored data" and adds a CH-34 paragraph about the constant interpolation.
- None of these changes behaviour.

## Rules
- No route, migration, engine or validation change.
- No SQL is generated from the tenant's replica: DEC-30 and DEC-169 hold, as narrowed by DEC-176.
- G3' and `verificarIds` pass.
- The examples reach the page only as `textContent` and as an editor `value`.

## Risk assessment
`gentle-ai review assess`: **medium**. The only reason given is `executable_change` on the design skill's `pantallas.md` copy. Receipt-driven development is off. Under the tier table, the writer's self-verification plus the orchestrator's spot check are enough.

## Size
- Code, tests and docs: about 245 changed lines.
- OpenSpec artifacts are extra.
- One PR.
