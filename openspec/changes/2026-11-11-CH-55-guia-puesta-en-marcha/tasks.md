# Tasks: CH-55 — Setup guide as a layer

Inputs: proposal.md, specs/query-console/spec.md, design.md.

Delivery: **single-pr**. Branch `ch55/puesta-en-marcha`, started after CH-53b merges, since both edit the tenant-switch and populate paths. No new DEC.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380: ~180 production (markup ~60, state and render ~80, links and preselection ~40) + ~200 tests |
| 400-line budget risk | Medium |
| Chained PRs recommended | No, unless the apply count passes 400 |
| Suggested split | If over budget: **55a** = sections 1–2 (strip and navigation marks); **55b** = section 3 (next-step links, preselection, purpose lines) |
| Delivery strategy | single-pr |
| Chain strategy | — |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: —
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Strip and navigation marks from cached state | `npx tsx --test src/consola/consola.test.ts` | `npm test`; typecheck | Revert the PR |
| 2 | Next-step links, preselection, purpose lines | same | `npm test`; smoke | Revert the PR |

## 1. State and strip
- [ ] 1.1 `estadoPuestaEnMarcha(forzar)`:
  - four GETs in parallel, then validation per connection with a short-circuit;
  - cache per tenant;
  - stale answers ignored;
  - a failed read gives «Sin datos».
- [ ] 1.2 Strip markup `pm-{pantalla}` in the five headers (icons as server SVG), and add the ids to `IDS` and the start-hidden list.
- [ ] 1.3 `renderizarPuestaEnMarcha(pantalla)`: stage states, «estás acá» (none on Agentes), «Siguiente» or «Puesta en marcha completa». It is hidden without a tenant.
- [ ] 1.4 Call it from `mostrarPantalla` for setup screens and from `fijarTenant`, clearing the cache.
- [ ] 1.5 Tests:
  - each stage done and pending;
  - an invalid mapping is pending;
  - «Sin datos» on a failed read;
  - «Siguiente» and the complete state;
  - no control's `disabled` changes.

## 2. Navigation marks
- [ ] 2.1 Mark markup on `nav-conexiones`, `nav-mapeo`, `nav-usuarios` and `nav-tablero`, filled from the same state and hidden without a tenant.
- [ ] 2.2 Tests: the marks match the strip, and Agentes has none.

## 3. Next step, preselection, purpose lines
- [ ] 3.1 `avisar` accepts an `accion` link, rendered in `zd-banner__actions`.
- [ ] 3.2 Success paths refresh the state with `estadoPuestaEnMarcha(true)` and offer «Siguiente: …» only when the stage flipped. The paths are: connection test, validation, first user, dashboard save and automation creation.
- [ ] 3.3 Preselect the connection when there is exactly one, in `#mapeo-conexion`, in the Tablero select (only without a dashboard) and in wizard step 1.
- [ ] 3.4 Purpose lines «Paso {n} de la puesta en marcha.» on Conexiones (1), Mapeo (2), Usuarios (3) and Tablero (4). Agentes: «Opcional: solo hace falta si la réplica está en una red privada.»
- [ ] 3.5 Tests:
  - the link appears only when the stage flipped;
  - preselection with one connection and none with two;
  - the Tablero select keeps the dashboard's connection;
  - the purpose line text.

## 4. Verify
- [ ] 4.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass.
- [ ] 4.2 Check that no screen or control is blocked by the guide (user condition).
