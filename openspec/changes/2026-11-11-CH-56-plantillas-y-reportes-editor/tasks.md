# Tasks: CH-56 — Template and report editor as a sectioned page

Inputs: proposal.md, specs/query-console/spec.md, design.md, DEC-208.

**Delivery.** Two chained PRs, as the user asked:
- **56a**: Plantillas, together with the shared skeleton.
- **56b**: Reportes.

The session is **single-pr** per slice. Chain strategy: stacked-to-main (user's choice, 2026-11-11): 56b branches from 56a, targets it, and they merge in order. It starts after CH-55 merges. DEC-208 was registered before any code.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800 total: 56a ~410 (skeleton and bridge ~60, markup move ~110, routes and wiring ~60, tests ~180); 56b ~390 (markup move ~120, routes and wiring ~50, tests ~220) |
| 400-line budget risk | Medium per slice: 56a sits at the budget's edge |
| Chained PRs recommended | Yes |
| Suggested split | 56a → 56b. If 56a passes 400 at apply, ask the user for `size:exception` on 56a, or move the copy banner (task a.6) into 56b |
| Delivery strategy | single-pr per slice (split asked by the user) |
| Chain strategy | stacked-to-main (user's choice, 2026-11-11) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 56a | Shared skeleton (sections, sticky footer, bridge rules), Plantillas editor subview, routes, footer line, copy banner, leave guard | `npx tsx --test src/consola/consola.test.ts` | `npm test`; typecheck; smoke | Revert 56a (template pop-up returns) |
| 56b | Reportes editor on the same skeleton | same | `npm test`; typecheck; smoke | Revert 56b (report pop-up returns) |

## 56a — Shared skeleton and Plantillas
- [x] a.1 Bridge rules `editor-secciones` (numbered sections) and `editor-pie` (sticky footer, bottom padding).
- [x] a.2 `#plantilla-editor` markup:
  - crumbs and the «Prueba sobre» line;
  - `#plantilla-copia-aviso`;
  - four sections with titles and purpose lines;
  - the footer with «Cancelar», `#plantilla-motivo` and «Guardar plantilla».
  
  Move every field node of `#plantilla-dialogo` into its section, keeping the ids, and remove the wrapper and its `dialogos` entry.
- [x] a.3 Sub-routes for `plantillas`:
  - `nueva`, `{id}` and `{id}/duplicar`, plus not found;
  - an in-use `{id}` goes to the list with the side panel.
  
  «Nueva plantilla», «Editar» and «Duplicar y editar» set the hash.
- [x] a.4 409 `plantilla-en-uso` → «Duplicar y editar» switches the mode in place and calls `history.replaceState` to `#plantillas/{id}/duplicar`.
- [x] a.5 Footer reason line: the existing reason, or «Última prueba: OK · {hh:mm} · {n} filas».
- [x] a.6 Copy banner from an in-use original. The existing "copy will not appear in the client panel…" line moves into it.
- [x] a.7 Leave guard (CH-53) with the editor's `hayCambios`. `tc-sin-guardar` lists Plantillas. A tenant switch returns to the list.
- [x] a.8 Saving returns to `#plantillas` with the side panel on the saved template.
- [x] a.9 Tests:
  - addresses and modes; in-use redirect; not found;
  - section order and titles;
  - the footer lines;
  - the banner only from an in-use original;
  - the guard and the tenant switch;
  - the 409 conversion keeps «Guardar plantilla» enabled;
  - existing template cases moved to hash-based opening.

## 56b — Reportes on the same skeleton
- [x] b.1 `#reporte-editor` markup on the same skeleton (section 3 is «Salida»: visualization and columns by role). Move every field node of `#reporte-dialogo`, keeping the ids, and remove the wrapper.
- [x] b.2 Sub-routes for `reportes`: `nuevo`, `{id}` and `{id}/duplicar`, plus not found and the in-use redirect. Wire the buttons.
- [x] b.3 409 `reporte-en-uso` → in-place duplicate with `replaceState`.
- [x] b.4 Footer line, copy banner («la original está en un tablero de cliente»), leave guard, tenant switch, and save returning to the list.
- [x] b.5 Tests:
  - the same set as a.9 for reports;
  - a structural check that both editors expose the same four section titles (K3);
  - existing report cases moved to hash-based opening.

## Verify
- [ ] v.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass after each slice.
- [ ] v.2 Every request sent by the template and report flows is identical to before: same routes, same bodies.
- [ ] v.3 Check `guidelines/admin.md` §14 for both editors. K4 stays flagged, not changed.
