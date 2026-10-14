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

## 7. Query pop-up (PR2, DEC-173 as corrected)

PR2 reorganises the screen; the logic of sections 1 to 3 is kept and moved, not rewritten. Every existing id is kept; elements move.

**Screen** (`#pantalla-consultas`):
- **Page header:** `.zd-pagehead__actions` holds `#consulta-nueva`, relabelled «Nueva consulta» and made the primary button. It opens the pop-up empty, with no confirmation of its own.
- **Saved queries:** `#guardado` keeps its title, a shorter help text and `#guardadas`. Each row's «Cargar» becomes «Abrir»: it loads the query (the existing `cargarGuardada`) and opens the pop-up. «Versiones» stays.
- **Versions:** `#versiones` becomes `aside.zd-drawer.zd-drawer--wide` with head, body and foot. Its child ids and the `hidden` toggling stay the same.

**Pop-up** `div#consulta-dialogo.zd-dialog-backdrop` (hidden) > `div.zd-dialog[role=dialog][aria-modal=true][aria-labelledby=consulta-dialogo-titulo]`:
- **Width:** one console bridge-style rule makes it wide, `#consulta-dialogo .zd-dialog { width: min(1100px, 100%) }`. No new shared class.
- **Title:** `h2#consulta-dialogo-titulo.zd-dialog__title`. It reads «Nueva consulta», or «{nombre} · versión N» with a query loaded.
- **Body, in order:**
  - `#nombre`, `#descripcion`;
  - inside `#formulario`: `#conexion` with `#conexion-aviso` and `#conexion-reintentar`, `#sql`, the parameter rows and «Agregar parámetro», `#limite`;
  - `#version-campos` with `#version-nota`, shown only with a query loaded.
- **Result:** `#estado`, the result table and the pager, inside the pop-up.
- **Actions** (`.zd-dialog__actions`):
  - `#ejecutar`, relabelled «Probar» (`type=submit` of `#formulario`);
  - `#guardar` («Guardar consulta»), shown only for a new query;
  - `#version-boton` («Guardar como versión N+1»), shown only with a query loaded;
  - `#consulta-cancelar` («Cancelar»).
- **Unsaved changes:** `#consulta-nueva-confirmar` with `#consulta-nueva-descartar` («Descartar cambios») and `#consulta-nueva-cancelar` («Seguir editando») sits in the actions row and is shown when «Cancelar» or Escape finds changes.
- **Removed:** the PR2 strip and save drawer (`#consulta-franja`, `#franja-sin-guardar`, `#guardar-abrir`, `#version-abrir`, `#guardado-panel`, `#guardado-titulo`, `#guardado-cancelar`). They were never merged.

**Script:**
- **Opening and closing:**
  - `abrirConsulta()` shows the pop-up, writes the title, toggles `#guardar`, `#version-boton` and `#version-campos` by `consultaCargada`, and focuses `#nombre`.
  - `cerrarConsulta()` hides it and the confirmation.
  - «Nueva consulta» runs `empezarConsultaNueva()` (empties SQL, parameters, name and description, forgets the loaded query), then `abrirConsulta()`.
  - «Abrir» runs `cargarGuardada(id)`, then `abrirConsulta()` on success.
- **Cancel:** `pedirCerrarConsulta()`, from «Cancelar» and from the Escape key on the pop-up, asks «Descartar cambios» when `hayCambiosSinGuardar()`. Otherwise it closes.
  - `hayCambiosSinGuardar()` now also compares the name and description with those of the loaded query, or with empty for a new one.
- **Save gate:**
  - `huellaActual()` is the JSON of `{ conexion, sql, parametros: declaracionActual() }`.
  - `ultimaPruebaOk` is set to the fingerprint when an execution answers `resultado: 'ok'`, and to `null` on any other answer, on opening the pop-up and on a tenant switch.
  - `actualizarGuardado()` enables `#guardar` / `#version-boton` only when `ultimaPruebaOk === huellaActual()` and the name is not empty. It runs on every `input` and `change` of the connection, SQL, parameter rows and name, and after every run.
  - `guardar()` and `guardarNuevaVersion()` return early when the gate is closed. `guardar()` keeps its guard against a loaded query.
- **On success:**
  - a 201 closes the pop-up, confirms and reloads the list;
  - a 200 closes it, confirms «Se guardó la versión N de «nombre»» and reloads the list.
  - The confirmations go to the page banner, which is outside the pop-up and visible once it closes.
  - Errors keep the pop-up open. They are written inside it, in `#estado`, so the operator sees them without closing.
- **Tenant switch:** closes the pop-up and the confirmation (`cambiarTenant`).

**Tests** (prefix `CH-32a`):
- markup: the header button, the pop-up hidden with `role=dialog` and `aria-modal`, the field order, the actions, and versions as a wide aside;
- «Nueva consulta» opens it empty and titled; «Abrir» opens it loaded and titled, with «Guardar como versión N+1»;
- «Probar» renders the result inside the pop-up;
- the save gate:
  - disabled before a test;
  - enabled after an ok test with a name;
  - disabled again after editing the SQL, a parameter or the connection;
  - disabled after a failed test;
- a 201 and a 200 close the pop-up; a 400/409 keeps it open with the message inside;
- «Cancelar» and Escape: no changes close it; changes ask, «Seguir editando» keeps them, «Descartar cambios» closes;
- a tenant switch closes it;
- every PR1 behaviour still holds (picker states, no duplicate on save, connection kept on opening another query).

Existing tests that click `#ejecutar`, `#guardar` or `#version-boton` directly now need an ok run first where they save. Each such edit is listed in the writer's report.
