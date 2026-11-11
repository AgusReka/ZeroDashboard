# Tasks: CH-53 — Consultas as a SQL workbench page

Inputs: proposal.md, specs/query-console/spec.md, design.md, DEC-208.

**Delivery.** The session is **single-pr**. This change is forecast well above 400 lines, so it ships as **two chained PRs**, as the user authorized:
- **53a**: subview, skeleton and states.
- **53b**: list, reference panel and versions.

Chain strategy: stacked-to-main (user's choice, 2026-11-11): 53b branches from 53a, targets it, and they merge in order.

**Order.** It starts after CH-52b and CH-54 merge.

**DEC-208** was registered on 2026-11-11, before any code (AGENTS.md).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~760 total: 53a ~390 (markup move ~120, routes and guard ~70, skeleton ~40, tests ~160); 53b ~370 (list ~80, reference ~50, versions ~20, tests ~220) |
| 400-line budget risk | High as one PR; Medium per slice |
| Chained PRs recommended | Yes |
| Suggested split | 53a → 53b |
| Delivery strategy | single-pr per slice (split authorized by the user) |
| Chain strategy | stacked-to-main (user's choice, 2026-11-11) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium per slice

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 53a | Sub-routes, editor subview with context bar, status line and states, leave guard, Ctrl + Enter, save returns to the list | `npx tsx --test src/consola/consola.test.ts` | `npm test`; typecheck; smoke | Revert 53a (the pop-up returns) |
| 53b | List table with search and states, reference panel, versions entry from the editor | same | `npm test`; typecheck; smoke | Revert 53b |

## 53a — Subview and workbench skeleton
- [x] a.1 Harness: the fake `history.replaceState` and a dispatchable `hashchange`, with `ctrlKey` and `metaKey` on keydown events.
- [x] a.2 `leerRuta()`, plus sub-route handling for `consultas` in `mostrarPantalla`: list, `nueva`, `{id}` and not found.
- [x] a.3 Move every node of the query pop-up into `#consultas-editor`, keeping the ids, and remove the backdrop and dialog wrapper together with its `dialogos` entry.
- [x] a.4 Context bar: connection, parameter values (`#consultas-parametros-valores`) and rows per page. The declaration moves to a `<details>` under the editor. Change `editorConsulta.agregar()` to write into both containers.
- [x] a.5 Run row: «Ejecutar consulta» with «Ctrl + Enter», and the Ctrl/Cmd + Enter handler. `#estado` becomes `zd-statusline`. The empty state comes before the first run, and the result gets `aria-busy` while running (CH-52 `ocupado`).
- [x] a.6 Leave guard per design §2, which extends `confirmar` with a `cancelar` label. The `tc-sin-guardar` text lists the screens with unsaved changes.
- [x] a.7 `cambiarTenant`: if the editor is visible, go to `#consultas`, and forget the loaded query (existing).
- [x] a.8 Saving returns to `#consultas` and shows the success notice. The reason line «Última ejecución: OK · {hora} · {n} filas» appears after a passing run.
- [x] a.9 A connection is preselected when the tenant has exactly one.
- [x] a.10 Tests:
  - routes, the not-found address, the guard (both buttons) and the tenant warning;
  - Ctrl + Enter and plain Enter, the empty state and the status line;
  - save navigation and one-connection preselection;
  - existing query cases moved to hash-based opening.

## 53b — List, reference, versions
- [ ] b.1 Saved list as a table (name + description, last edit, «Abrir», «Versiones») through `renderizarTabla`.
- [ ] b.2 Search field and counter: `filtrarGuardadas` is accent- and case-insensitive with no request. Add the no-match state with «Limpiar búsqueda», the empty state and the error with «Reintentar».
- [ ] b.3 Reference panel `#consultas-referencia`:
  - contract from `CONTRATO` (embed it if CH-54 has not);
  - declared parameters;
  - the explanatory line;
  - links to `#mapeo` and `#plantillas`;
  - the collapse toggle (`aria-expanded`).
- [ ] b.4 «Versiones» in the editor header for a loaded query opens the existing wide side panel. «Comparar con la actual» uses the `zd-compare` layout (server markup).
- [ ] b.0 Moved from 53a:
  - the parameter test values move to the context bar (`#consultas-parametros-valores`), with `editorConsulta.agregar()` writing the value there and the declaration in the `<details>` under the editor;
  - an editor address whose id is not a saved query of the tenant shows «No encontramos esa consulta.» with a link to the list.
- [ ] b.5 Tests:
  - the list's columns, search, counter and states;
  - reference panel content and no extra request;
  - versions opened from the editor.

## Verify
- [ ] v.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass after each slice.
- [ ] v.2 `guidelines/admin.md` §14 for Consultas (P5, W1–W9, T1, T6, T8).
- [ ] v.3 No new request appears in the network calls the tests record, compared with before this change.

## Apply notes, 53a (2026-11-11)

**Evidence.**
- `consola.test.ts`: 509/509.
- `test:db`: 2332/2336. The 4 failures are the known `conexiones` false positives.
- `tsc`: ok.
- 322 changed lines in `src/`.
- `scripts/smoke.sh` was not run: it runs `docker compose down` on the developer stack.

**Deviations.**
- **a.1 Harness.** It needed only a writable `location.hash`, because the script never calls `history.replaceState`. When the script sets an address itself it records it in `hashDelScript`, so the resulting `hashchange` is a no-op.
- **a.3 The editor.** It keeps its id (`consulta-dialogo`) and the shared pop-up helper, with a new `pagina` option: no focus trap, no backdrop, no dialog role. This kept every query test's assertions and changed only how the editor opens. The design's `#consultas-editor` / `#consultas-lista` names were not introduced: `consulta-dialogo` and `guardado` are those sections.
- **a.4 Partial.** The connection and the rows per page are now in the context bar above the statement. The parameter values stay in their declaration rows; they move to b.0 together with the not-found state.
- **a.6 Leave guard.** It reuses the editor's own unsaved-changes line («Hay cambios sin guardar.» · «Descartar cambios» · «Seguir editando») rather than a C1 dialog, so «Cancelar», Escape and a change of address ask the same way. The spec delta was aligned.
