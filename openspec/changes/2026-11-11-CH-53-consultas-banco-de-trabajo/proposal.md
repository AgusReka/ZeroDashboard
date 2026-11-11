# Proposal: CH-53 — Consultas as a SQL workbench page

**Status**: approved by the user on 2026-11-11, with two conditions:
- keep the scope in UX/UI and add no new SQL capability;
- leave out the optional backend item (current version in the list).

**Decision.** Moving the editor from a pop-up to a page contradicted DEC-173. The user chose to amend it, and the amendment is **DEC-208** (`docs/01-decisiones.md`): editors with SQL open as a subview with an address.

**Inputs:**
- `exploration.md` and EXPLORE 2026-11-11;
- `guidelines/admin.md` P5, W1–W9, T1, T6, T8 and §13 Consultas;
- DEC-164, DEC-172, DEC-173 and DEC-208.

**Priority: high.** Depends on:
- CH-51, for the restore confirmation and pop-up focus;
- CH-52, for feedback, errors and busy buttons.

## Intent
The operator's main SQL work happens inside a pop-up, and the screen never says what Consultas is for: exploring the replica before writing a mapping, a template or a report. Nothing else uses its saved queries. This change:
- turns the editor into a subview of the Consultas screen, with the shared workbench skeleton (W);
- gives the saved list search and orientation;
- states the screen's role and links to where its findings are used.

Executing, saving, versioning and restoring behave exactly as today.

## Scope

Item tags:
- **[visual]**: presentation only.
- **[navegación]**: order, titles and routes.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. P5 / DEC-208 · From pop-up to subview.** [navegación] + [comportamiento front]
- **Addresses:**
  - «Nueva consulta» opens `#consultas/nueva`;
  - «Abrir» opens `#consultas/{id}`;
  - `#consultas` shows the list.
- **Breadcrumb:** «Consultas › {nombre} · versión N», or «Consultas › Nueva consulta».
- **Ids:** the pop-up's nodes move into the subview, and their ids are not renamed (DEC-164).
- **Leaving with unsaved changes:**
  - by the breadcrumb or another address: a C1 confirmation «¿Descartar los cambios?»;
  - by switching tenant: the warning inside the tenant pop-up (CH-50) names Consultas.
- **After a successful save:** back to the list with the success notice. This is the equivalent of today's "close the pop-up".

**2. W1–W5, W7, W9 · Workbench skeleton.** [visual] + [comportamiento front]
```
┌ Consultas › Stock bajo · versión 3 ──────────────────────── [Guardar como versión 4] ┐
├ Conexión [food-store ▾] · :umbral [25] · Filas por página [50 ▾] ───────────────────┤
├──────────────────────────────────────────────────────────┬─────────────────────────────┤
│ SELECT …                                                  │ REFERENCIA            [×]  │
│                                                          │ Contrato canónico           │
│ [▶ Ejecutar consulta]  Ctrl + Enter                      │ Parámetros declarados       │
│ ▸ Declaración de parámetros                               │ Ir a Mapeo · Ir a Plantillas│
├──────────────────────────────────────────────────────────┤                             │
│ 12 filas · 301 ms · food-store                (statusline) │                             │
│ (result / error / empty state)                            │                             │
└──────────────────────────────────────────────────────────┴─────────────────────────────┘
```
- **Context bar (W2, W3):** the connection and one test-value field per declared parameter, above the editor. The declaration (name, type) moves to a collapsible block under the editor.
- **Execute (W4):**
  - «Ejecutar consulta» with "Ctrl + Enter" shown next to it. Ctrl/Cmd + Enter in the editor runs the query, and plain Enter still inserts a newline. This is a keyboard shortcut, not a new SQL capability.
  - While running: «Ejecutando…» (CH-52) and the previous result dimmed with `aria-busy`.
- **Result (W5):** a status line with rows, duration, connection and the existing cap notice, then the table and the pager.
- **Before the first run (W7):** «Ejecutá la consulta para ver el resultado acá (Ctrl + Enter).»
- **Errors (W6):** shown in place of the result, through CH-52, with the SQLSTATE and engine message in a copyable mono block.
- **Editor height (W9):** at least 8 visible lines.
- **Save gate (F4, already the rule):** the reason line stays next to the save control. After a passing run it reads «Última ejecución: OK · {hora} · {n} filas».

**3. W8 · Reference panel with existing data only.** [visual]
- **Contents:**
  - the canonical contract, embedded as in CH-54;
  - the parameters declared in the editor;
  - «Ir a Mapeo y validación» and «Ir a Plantillas».
- **Note:** a line explains that Consultas reads the replica's own tables, while templates and reports read the canonical views built by the mapping.
- **Behaviour:** collapsible.
- **Not included:** a listing of the replica's tables, and any "use in a template" action.

**4. T1, T6, T8 · Saved list.** [visual] + [comportamiento front]
- **Layout:** a table instead of the `<ul>`, with Nombre (plus the description, muted), Última edición (`actualizadaEn`, which the list already returns), and «Abrir» / «Versiones».
- **Toolbar:** client-side search over the loaded list, with a counter («12 consultas»).
- **States:**
  - filtered empty: «Ninguna consulta coincide con "{texto}"» + «Limpiar búsqueda»;
  - empty: «Todavía no hay consultas guardadas. Ejecutá una y guardala para volver a usarla.»;
  - an error with «Reintentar» (CH-52).
- **Current item:** the query open in the subview carries `aria-current` when the list is shown beside it.

**5. Versions panel.** [visual]
- **Unchanged:** it stays a wide side panel (DEC-173 for read-only detail), opened from the list and from the subview header.
- **Compare:** "Comparar con la actual" uses the `zd-compare` layout, server-rendered.
- **Restore:** uses CH-51's C1 confirmation.

### Out of Scope
- **Showing the current version number in the list.** It needs `GET /consultas-guardadas` to return it, which is a backend change. Left out by the user.
- Deleting saved queries, binding a saved query to a connection, listing the replica's tables or columns, and SQL highlighting or completion.
- Any change to execution, read-only enforcement (rule 3) or parameters (rule 4).
- Plantillas and Reportes editors: CH-56 reuses this skeleton.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`. Every requirement that described the query pop-up is rewritten for the subview:
  - the pop-up rule (DEC-173, amended by DEC-208);
  - the query screen;
  - the result placement;
  - the save control;
  - the connection picker;
  - save as a version;
  - the saved list.

`saved-queries` specifies the API, which does not change.

## Approach
- Move the pop-up's markup into `#pantalla-consultas` as two sections: list and editor.
- `mostrarPantalla` reads the first segment of the hash for the screen and the rest as the subview (DEC-208).
- The pop-up's open and close functions become `irAEditor(id|nueva)` and `volverALista()`.
- The context bar, status line, reference panel and list toolbar are server-rendered `zd-*`; the script fills text and toggles attributes (G3').
- Search is client-side over the already loaded list.

## Rules Check
- **Rule 1.** Console only; P2 still has no SQL editor.
- **Rule 2.** The tenant still comes from `X-Tenant-Id`; a subview of one tenant never survives a switch.
- **Rule 3.** Read-only enforcement is untouched, including DEC-204's front-end check.
- **Rule 4.** Parameters still go through the driver.
- **Rules 5 to 7.** Untouched.
- **Anti-scope.** No table browser, no query builder, no AI.

## Rollback
Front-end only. Reverting the PRs restores the pop-up. DEC-208 would then be marked superseded.

## Affected Areas
- `src/consola/consola.ts`:
  - Consultas markup (L1041–1190);
  - the query pop-up (L1072);
  - the saved list (L2506–2556);
  - load and save (L2700, L4474);
  - the versions panel;
  - `mostrarPantalla` (L8119–8169);
  - `cambiarTenant` (L4703).
- `src/consola/consola.test.ts`: query, version and save cases (CH-07, CH-11, CH-25, CH-32a).
- `openspec/specs/query-console`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Many query tests open and close the pop-up | Certain | Ids are kept; only open and close steps change |
| `hashchange` cannot be cancelled | Medium | On leaving with changes, restore the previous hash and ask; the design describes the guard |
| Size well above 400 lines | Certain | Two chained PRs: **53a** subview, skeleton, status line and states; **53b** saved list, reference panel and versions |

## Success Criteria
- [ ] «Nueva consulta» and «Abrir» navigate to `#consultas/nueva` and `#consultas/{id}`, with a breadcrumb, and no pop-up opens.
- [ ] The connection and parameter values are above the editor; Ctrl + Enter runs; plain Enter adds a newline.
- [ ] Before the first run, the empty state shows; after it, the status line shows rows, duration and connection, plus the cap notice when capped.
- [ ] A failing statement shows a sentence and the copyable engine detail in place of the result.
- [ ] Save stays gated by a passing run of the current content, and versioning works as DEC-172.
- [ ] Leaving the subview with unsaved changes asks first; a tenant switch warns inside the tenant pop-up.
- [ ] The list filters as you type, shows the filtered empty state and needs no new request.
- [ ] The reference panel shows the contract and the two links, and nothing reads replica metadata.
- [ ] `npm test`, the typecheck and the smoke script pass.
