# Design: CH-53 — Consultas as a SQL workbench page

Inputs:
- `proposal.md` and `specs/query-console/spec.md`;
- `src/consola/consola.ts`: Consultas L1041–1190, query pop-up L1072, list L2506–2556, load L2700, `mostrarPantalla` L8119–8169, `cambiarTenant` L4703, `crearDialogo` L1782.

Decisions in force:
- **DEC-208** (registered 2026-11-11, amends DEC-173): editors with SQL are subviews with an address.
- DEC-164 (one document; ids move, never renamed).
- DEC-172 (a loaded query saves only as a version).
- DEC-204 (front-end read-only refusal).

Depends on:
- CH-51: `confirmar`, focus in pop-ups;
- CH-52: `avisar`, `mensajeDeError`, `ocupado`;
- CH-54: the embedded `CONTRATO`. If CH-54 has not merged, this change adds the embed itself.

## Technical Approach

### 1. Sub-routes
`mostrarPantalla()` parses `location.hash` as `#{pantalla}[/{sub}]`:
```
function leerRuta() {
  var partes = location.hash.replace(/^#/, '').split('/');
  return { pantalla: partes[0] || '', sub: partes.slice(1).join('/') || null };
}
```
- Only `consultas` interprets `sub` in this change. For any other screen, a `sub` is ignored and the screen shows normally. CH-56 adds `plantillas` and `reportes`.
- For `consultas`:
  - `sub === null` shows `#consultas-lista`;
  - `sub === 'nueva'` shows `#consultas-editor` empty;
  - any other `sub` loads that id through the existing `cargarGuardada(id)` (L2690–2706) and shows the editor, or the not-found state on a 404.

### 2. Leaving with unsaved changes (`hashchange` cannot be cancelled)
```
var rutaActual = leerRuta();
window.addEventListener('hashchange', async function () {
  var destino = leerRuta();
  if (estaEnEditorConsulta(rutaActual) && hayCambiosConsulta() && !saliendoConfirmado) {
    history.replaceState(null, '', '#' + serializar(rutaActual));   // put the address back
    if (await confirmar({ nivel: 'c1', titulo: '¿Descartar los cambios?', … , verbo: 'Descartar cambios' })) {
      saliendoConfirmado = true; location.hash = serializar(destino);
    }
    return;
  }
  saliendoConfirmado = false; rutaActual = destino; mostrarPantalla();
});
```
- `hayCambiosConsulta()` is the same predicate the query pop-up passes to `crearDialogo` today (its `hayCambios`).
- The C1 confirmation's second button reads «Seguir editando» through `confirmar`'s cancel label. `confirmar` takes an optional `cancelar` text, a small extension of CH-51's helper.
- **Tenant switch:** the `tc-sin-guardar` warning of CH-50 turns into a list of the screens with unsaved changes: Tablero (`tableroCambiado()`) and Consultas (`hayCambiosConsulta()`). The text becomes «Tenés cambios sin guardar en {pantallas}. Si cambiás de tenant, se descartan.»
- `cambiarTenant` (L4703) replaces `cerrarDialogos()` for the query with `olvidarConsultaCargada()`, which it already calls, and sets `location.hash = '#consultas'` when the editor was visible.

### 3. Markup move
```
section#pantalla-consultas
  div#consultas-lista            ← page header (Nueva consulta), toolbar (search + counter), table, states
  div#consultas-editor hidden    ← zd-pagehead with crumbs, context bar, editor + run row,
                                   declaration <details>, statusline, result, pager,
                                   aside#consultas-referencia (zd-drawer-like panel, server-rendered)
  div#consultas-no-encontrada hidden
```
- **Moved:** every node of `#consulta-dialogo` moves into `#consultas-editor` with its id: `#formulario`, `#ejecutar`, `#conexion`, the param editor, `#estado`, the result table, the pager, the save controls and `#consulta-aviso`.
- **Removed:** the backdrop and dialog wrappers (`#consulta-dialogo` and its title), together with their entry in `dialogos`.
- **Parameters:** the parameter rows the script builds today (name, type, value) split into two places:
  - the value field goes to the context bar (`#consultas-parametros-valores`);
  - name and type stay in the declaration `<details>`.

  Both are built by the same `editorConsulta.agregar()`, which writes into two containers. Their row-local classes are unchanged (G3').
- **Status line:** `#estado` (exists) gets the server class `zd-statusline`.

### 4. Ctrl + Enter
A `keydown` listener on the SQL textarea: `if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); formulario.requestSubmit ? … : botonEjecutar.click(); }`. The test harness fake supports `click()`.

### 5. List
- `renderizarGuardadas(filas)` builds `tr` rows instead of `li`s (`renderizarTabla`, which exists).
- `filtrarGuardadas(texto)` toggles `hidden` on rows by a case- and accent-insensitive match (`normalize('NFD')`) over name and description, and updates `#consultas-contador`.
- The loaded rows stay in `guardadasCargadas`.

### 6. Reference panel
- **Content:** server-rendered shell. The script fills the contract list once from `CONTRATO`, and the declared parameters on each change of the declaration.
- **Links:** `href="#mapeo"` and `href="#plantillas"`.
- **Collapse:** the collapse toggle sets `hidden` on the panel body and `aria-expanded` on its button.

## Architecture Decisions

### Decision: Sub-route parsing lives in `mostrarPantalla`
**Choice:** one parser, and one hook per screen that has subviews.
**Alternatives considered:** a router object.
**Rationale:** DEC-164 keeps one document and one script; a single `leerRuta` is enough for three screens.

### Decision: Restore the hash, then ask
**Choice:** `history.replaceState` back to the editor's address, then `confirmar`.
**Alternatives considered:** `beforeunload`, which does not fire on hash changes.
**Rationale:** it is the only way to keep the address truthful while asking.

### Decision: Save returns to the list
**Choice:** a successful save navigates to `#consultas`.
**Rationale:** it is the behaviour of today's pop-up (close on save), so the save flow keeps its outcome. Staying in the editor would be a behaviour change.

## Data Flow
```
«Abrir» ─► location.hash = #consultas/{id} ─► hashchange guard ─► mostrarPantalla
                                                  └─► cargarGuardada(id) ─ 404 ─► #consultas-no-encontrada
                                                                          └─ 200 ─► editor filled
Ctrl+Enter / «Ejecutar consulta» ─► POST /consultas/ejecutar ─► statusline + table   (unchanged request)
«Guardar …» ─► POST|PUT /consultas-guardadas ─► #consultas + success notice         (unchanged request)
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` | Modify | Consultas markup restructured; query pop-up wrapper removed; `leerRuta`, the hash guard and `mostrarPantalla` sub-routes; `irAEditor` and `volverALista`; `cambiarTenant`; list table, search and states; context bar and declaration split; Ctrl + Enter; reference panel; `tc-sin-guardar` text; save success navigation; M5 text «Ejecutá…» kept from CH-52 |
| `src/consola/consola.test.ts` | Modify | Open and close steps become hash changes; new cases below; `IDS` and the start-hidden list updated (removed: `consulta-dialogo` wrapper ids; added: `consultas-lista`, `consultas-editor`, `consultas-no-encontrada`, `consultas-busqueda`, `consultas-contador`, `consultas-referencia`, `consultas-parametros-valores`) |

## Interfaces / Contracts
No API change. Requests are identical: `POST /consultas/ejecutar`, `GET`, `POST` and `PUT` on `/consultas-guardadas`, and the version routes.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM) | Hash routes: list, `nueva`, `{id}`, not found. Leaving with changes: hash restored and confirm shown, both buttons. Tenant switch warning lists Consultas. Ctrl + Enter runs and Enter does not. Empty state. Status line. Save returns to the list. Search filters with no request, counter, no-match state. Reference panel filled from `CONTRATO` | The fake `location`/`history` needs `replaceState` and a dispatchable `hashchange`; add them to the harness |
| Existing | Execution, cap, parameters, save gate, versions, DEC-204 refusal | Keep assertions, change only the open steps |
| Smoke | `scripts/smoke.sh` | verify |

## Migration / Rollout
None. If reverted, DEC-208 is marked superseded for Consultas.

## Open Questions
- None blocking.
