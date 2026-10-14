# Design: CH-32a — Saved queries without duplicates, and a connection picker

Inputs: proposal.md, the `query-console` delta, DEC-172, DEC-11, DEC-132/DEC-167, CH-25 (`consultaCargada`, `recordarConsultaCargada`, `olvidarConsultaCargada`), the design guide (C-08, `lenguaje.md`: buttons are verb + object, empty = what is missing + when + action) and, as a subordinate review, the `harden` checklist of `impeccable` (loading, empty, error and truncated states; validation next to the field).

## 1. Connection picker (`#conexion`)

**Markup.** The `input#conexion` becomes `select#conexion.zd-select` with the same id and the label «Conexión»; below it `p#conexion-aviso.ayuda` (`role="status"`), empty by default. The `required` attribute is kept (native validation on a real browser), but the script does not rely on it.

**Script.**
- `cargarConexionesConsulta()`: with no tenant, one placeholder option «Elegí un tenant para ver sus conexiones» and nothing sent. Otherwise:
  - first, the placeholder «Cargando conexiones…» and the select disabled;
  - then `pedir('/conexiones')`:
    - **200 with rows:** placeholder «Elegí una conexión», then one `option` per connection (`textContent` = nombre plus the first 8 characters of the id, as `renderizarConexiones` does for the automation wizard and as C-08 asks: id + nombre; `value` = id). The previous choice is kept if it is still in the list.
    - **200 with no rows:** placeholder «No hay conexiones registradas», and the notice «Este tenant no tiene conexiones. Registrá una en Conexiones para poder ejecutar.» with a link to `#conexiones`.
    - **`truncado`:** the notice «Se muestran las primeras N conexiones, en orden alfabético.».
    - **Any other answer, or a network failure:** the notice «No se pudieron cargar las conexiones.» and a «Reintentar» button (`button#conexion-reintentar`, `type="button"`) that calls the function again.
  - A generation token, as in the automation wizard (`generacionAlta`), drops an answer that arrives after a tenant switch.
- **Called** from `cambiarTenant()` next to `listarGuardadas()`, from the initial load (`:3619`) and when `#consultas` is shown.
- **`ejecutar()`:** with `entradaConexion.value === ''` it writes «Elegí una conexión para ejecutar.» in `#conexion-aviso`, moves the focus to the select and sends nothing. Any other value goes as today (`cuerpoDeEjecucion` is unchanged).
- **Loading a saved query** does not touch the select (DEC-11; the existing comment stays).

## 2. Saving with a query loaded (DEC-172)

- `recordarConsultaCargada()` also hides `#guardar`; `olvidarConsultaCargada()` shows it again. That is the only switch, so every path that loads or forgets a query (load, tenant switch, 404, restore, "Consulta nueva") stays consistent.
- `guardar()` refuses to run with `consultaCargada !== null`, as a second guard: returning early, with no request.
- Help text of `#guardado`: «Con una consulta cargada, los cambios se guardan como una versión nueva de esa consulta. Para guardar el editor como otra consulta, empezá con «Consulta nueva». No se puede borrar.»

## 3. "Consulta nueva"

**Markup.** `button#consulta-nueva.zd-btn.zd-btn--secondary` (`type="button"`) at the top of `#guardado`, before the name field; next to it `span#consulta-nueva-confirmar` (hidden) holding the text «Hay cambios sin guardar en el editor.» and the buttons `#consulta-nueva-descartar` («Descartar cambios») and `#consulta-nueva-cancelar` («Cancelar»). Same inline-confirmation pattern as «Dar de baja» in Tenants (CH-30b).

**Script.**
- `hayCambiosSinGuardar()`:
  - with a loaded query: `entradaSql.value !== consultaCargada.sql`;
  - with none: the editor is neither empty nor `SELECT 1`, after trimming.
- `consultaNueva()`:
  - when `hayCambiosSinGuardar()`, show the confirmation and stop;
  - otherwise, `empezarConsultaNueva()`.
- `empezarConsultaNueva()`:
  - `entradaSql.value = ''`, `limpiarParametros()`, empty name and description;
  - `olvidarConsultaCargada()`, which hides the version block and shows `#guardar`;
  - `cerrarVersiones()`, hide the confirmation, focus the editor;
  - no request.
- **Confirmation:** «Descartar cambios» calls `empezarConsultaNueva()`; «Cancelar» hides it.

## 4. Ids and guards

New ids registered in `IDS` of `consola.test.ts`:
- `conexion-aviso`, `conexion-reintentar`
- `consulta-nueva`, `consulta-nueva-confirmar`, `consulta-nueva-descartar`, `consulta-nueva-cancelar`

`conexion` keeps its id and changes element type. No `zd-*` class is assigned from the script (G3'). Every text from the API is written with `textContent` or `value`.

## 5. Tests (`consola.test.ts`, prefix `CH-32a`)

Tests come first (RED, then GREEN):
- **Picker:**
  - the select is filled from `GET /conexiones` with name as text and id as value;
  - an empty list shows the notice and the link to Conexiones;
  - a failed list shows «Reintentar», and pressing it asks again;
  - with no tenant, nothing is sent;
  - executing with no choice sends nothing and writes the notice;
  - the chosen id goes as `conexionId`;
  - loading a saved query keeps the choice;
  - a list answered after a tenant switch is dropped.
- **Saving:**
  - with no query loaded, `#guardar` is visible and creates;
  - after loading, `#guardar` is hidden and `#version-guardar` shown;
  - after "Consulta nueva" `#guardar` is visible again;
  - `guardar()` with a loaded query sends nothing.
- **"Consulta nueva":**
  - with an unchanged loaded query it empties everything and sends nothing;
  - with an edited one it asks first; «Cancelar» keeps the edit and «Descartar cambios» empties.
- **Existing suites:** the scenarios that set `nodo(escenario, 'conexion').value` keep working. Where a scenario needs the select populated, its `GET /conexiones` answer is added to the scenario's queue.

## 6. Size forecast
`consola.ts` ~140, `consola.test.ts` ~180, spec ~40: ~360 lines, one PR.

## 7. Screen path and save panel (PR2, DEC-173)

Order of `#pantalla-consultas`, top to bottom (no field changes; every existing id kept):
1. **Page header:** title and description as today; in its actions `#consulta-nueva` («Consulta nueva») with its inline confirmation `#consulta-nueva-confirmar` beside it (moved from `#guardado`).
2. **Strip** `#consulta-franja` above `#formulario`:
   - With no query loaded: `#franja-sin-guardar`, the text «Consulta sin guardar» and `#guardar-abrir` («Guardar consulta»).
   - With one loaded: the existing `#version-guardar` block, now the loaded state of the strip, holding `#version-cargada` (name + «Versión N · vigente») and `#version-abrir` («Guardar como nueva versión»).
   - `recordarConsultaCargada` / `olvidarConsultaCargada` switch between the two, as they already switch `#version-guardar`.
3. **Editor and result:** `#formulario`, `#estado`, the table and the pager, unchanged.
4. **Saved queries:** `#guardado` keeps its title, its help text and `#guardadas`. The name, description, note and save buttons leave it for the panel.
5. **Save panel** `aside#guardado-panel.zd-drawer` (hidden):
   - **Head:** `h2#guardado-titulo`.
   - **Body:** `#nombre` and `#descripcion` (moved, same ids), and `#version-campos` with `#version-nota` (shown only for a version).
   - **Foot:** `#guardar` («Guardar consulta», new-query mode only), `#version-boton` («Guardar versión N+1», version mode only) and `#guardado-cancelar` («Cancelar»).
   - **Modes:**
     - `abrirGuardado('nueva')` empties name and description; title «Guardar consulta».
     - `abrirGuardado('version')` fills them from the loaded query (its `descripcion` is now remembered by `recordarConsultaCargada`) and empties the note; title «Guardar como versión N+1».
     - Both focus `#nombre`.
   - **Closing:** `cerrarGuardado()` on «Cancelar», on a 201/200, on a tenant switch, on loading or forgetting a query, and on «Consulta nueva». `guardar()` keeps its guard (no request with a query loaded). Errors still go to the banner, as today.
6. **Versions:** `#versiones` becomes `aside#versiones.zd-drawer.zd-drawer--wide`. Its title, list, comparison and `#versiones-cerrar` keep their ids, and its `hidden` toggling is unchanged.

Tests (prefix `CH-32a`, design order):
- markup order (header action, strip before `#formulario`, panel and versions are `aside.zd-drawer` hidden by default);
- the strip's two states;
- opening, in each mode, shows the right title, fields and button, and focuses the name;
- «Cancelar» closes and sends nothing;
- a 201 and a 200 close the panel;
- a tenant switch closes it;
- with a query loaded the panel never shows `#guardar`.

Existing tests that click `#guardar` or `#version-boton` directly keep working: the handlers are unchanged.
