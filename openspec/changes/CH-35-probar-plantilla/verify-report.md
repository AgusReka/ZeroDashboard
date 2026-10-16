# Verify report: CH-35 — Testing a template against a connection from the console

**Verdict: PASS.** Date: 2026-10-16. Branch: `ch35/probar-plantilla`, not committed yet.

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx tsx --test src/consola.test.ts` | 297 / 297 pass. The orchestrator re-ran it as a spot check and got the same 297 / 297. |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1469 / 1473. The 4 failures are the known false positives in `conexiones.test.ts`. |

## Spec scenarios → evidence
`src/consola.test.ts` holds 14 tests with the `CH-35` prefix.

| Scenario | Evidence |
|---|---|
| Viewing a template | The existing CH-30d test, unchanged and passing |
| Testing a template on a connection | One `POST /plantillas/t-1/prueba` is sent with `X-Tenant-Id`, `conexionId` and `valores: { umbral: 5 }`. The rows render as text, and a hostile `<b>` cell is shown verbatim. |
| The views are not approved | The block names the entities, and the table stays empty |
| No active tenant | The message is shown and no request is sent |
| Another template clears the result | Covered, and so are «Cerrar» and a tenant switch |

The tests also cover a missing connection, `hayMas`, `400`, `fallo`, `404`, `credencial-ilegible`, `500`, a non-JSON answer, a network failure and an empty connection list.

## Tasks
All 5 are checked in `tasks.md`.

## Design conformance and deviations
- **`generacionPrueba` (stale-answer guard).** An answer that arrives after the panel has moved to another template, been closed or switched tenant is dropped.
- **`mensajeDePruebaInvalida`.** The 400 has its own single-line helper, because the query pop-up's message is multi-line and does not render inside a `<p>`.
- **Small copy additions.** «1 fila.» for a single row, and «No se pudieron cargar las conexiones.» when the connection list fails to load.

None of these changes the specified behaviour.

## Rules
- No route, migration or engine change.
- The request runs on the active tenant through `pedir` (rule 2).
- Every value is written as `textContent`. G3' and `verificarIds` pass.
- The template is never changed, and nothing is saved as a query (DEC-177).

## Risk assessment
`gentle-ai review assess` rates it **medium**. The only reason is `executable_change` on the design skill's `pantallas.md` copy. Receipt-driven development is off, so under the tier table the writer's self-verification plus the orchestrator's spot check are enough.

## Size
About 350 changed lines of code, tests and docs, plus the OpenSpec artifacts. It is one PR, within the 400-line budget for code.
