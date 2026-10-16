# Tasks: CH-34 — A step-by-step guide and an example SQL per entity on the Mapping screen

Inputs: proposal.md, specs/query-console/spec.md, design.md. Delivery: auto-chain; one PR (forecast below the budget).

## 1. Examples module
- [x] 1.1 `src/mapeo-ejemplos.ts`: `EJEMPLOS_MAPEO`, the five multi-line SELECTs of design §2, with a header comment citing DEC-176 and the demo views they come from.
- [x] 1.2 `src/mapeo-ejemplos.test.ts`: keys equal the contract's entities; per entity, the alias set equals its fields, camelCase quoted and the rest unquoted; no example ends with `;`.

## 2. Console
- [x] 2.1 `src/consola.ts`: `jsonEnScript` (escapes `<`, U+2028, U+2029), the `var EJEMPLOS_MAPEO = …` line in the script, and the updated header comment on interpolations.
- [x] 2.2 Markup: the `#mapeo-guia` `<details>` of design §3 between `#mapeo-aviso` and `#mapeo-entidades`, with its copy checked against `guidelines/lenguaje.md`.
- [x] 2.3 Script: `bloqueDeEntidad` adds the example `details` / `pre` / «Usar de punto de partida»; `usarEjemplo(entidad)` per design §4. No new `zd-*` in the script.
- [x] 2.4 `src/consola.test.ts`: add `mapeo-guia` to `IDS`. New tests: the guide sits before the entities; copying into the empty `insumo` editor sends nothing; `producto` is left unchanged and the notice says so; the example is rendered as text; `jsonEnScript` never emits `</`.

## 3. Docs
- [x] 3.1 `docs/02-mapa-de-changes.md`: the CH-34 row, after CH-33.
- [x] 3.2 `guidelines/pantallas.md` C-08, in both copies (`.claude/skills/…` and `.agents/skills/…`): one line on the guide and the example (DEC-176).

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/mapeo-ejemplos.test.ts src/consola.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts`.

## Review Workload Forecast
- Estimated changed lines: ~200
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
