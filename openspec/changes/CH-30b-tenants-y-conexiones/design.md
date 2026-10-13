# Design: CH-30b — Tenants and Connections screens

Inputs: proposal.md, specs (`connection-registration` and `query-console` deltas), DEC-164 to DEC-168, CH-30a's shell and `mostrarPantalla()`.

## 1. API

`src/conexiones.ts`: `GET /conexiones` selects `ConexionPublica` instead of `ConexionListada` (DEC-167). The console's automation wizard reads only `id` and `nombre` from it, so it keeps working. The listing tests change from "exactly id and nombre" to "exactly the public fields, never `credencial`".

## 2. Navigation

`PANTALLAS` becomes `['tenants', 'conexiones', 'consultas', 'automatizaciones', 'frescura']`. Markup groups, top to bottom: "Global" (Tenants), "Puesta en marcha" (Conexiones), "Trabajo diario" (the three existing). Consultas stays the default.

## 3. Tenants screen (`#tenants`, global)

Markup (`section#pantalla-tenants`, page header with `zd-scope--global` "Global · todos los tenants"):
- `form#tenant-alta`: `input#tenant-nombre`, `button#tenant-crear` (type submit), `p#tenant-aviso` (role status).
- `table#tenants-tabla` (class `zd-table`): the script fills `tbody` rows: name, short id (8 characters + ellipsis), state, created (dd/mm/aaaa), actions.

Script:
- `cargarTenantsPantalla()`: `fetch('/tenants?incluirInactivos=true').then(siNoAutenticado)`; renders the rows with `textContent`. Active row: buttons "Elegir como activo" and "Dar de baja". "Dar de baja" swaps the row's actions for «Dar de baja {nombre}» and «Cancelar» (inline confirmation, the CH-25 restore pattern). Deactivated row: the text "Dado de baja", no buttons.
- Create: `POST /tenants` `{ nombre }`; on 201 clear the field, `cargarTenantsPantalla()` and `cargarTenants()` (the selector).
- Choose: set the selector to that id and run the existing change path (`fijarTenant` and the reloads the selector's `change` handler does).
- Deactivate: `POST /tenants/:id/baja`; on 200 reload both lists; if it was the active tenant, `fijarTenant(null)` and the banner "Diste de baja el tenant activo. Elegí otro en la barra superior."
- Loaded when the screen is shown (`mostrarPantalla` calls a per-screen loader) and after each write.

## 4. Connections screen (`#conexiones`, active tenant)

Markup (`section#pantalla-conexiones`, page header with `zd-scope--tenant`):
- `button#conexion-nueva` in the header actions; `p#conexiones-aviso`; `table#conexiones-tabla`.
- `aside#conexion-panel.zd-drawer` (starts `hidden`) with a `form#conexion-alta`: `cx-nombre`, `cx-host`, `cx-puerto` (number, 5432), `cx-base`, `cx-usuario`, `cx-clave` (type password, autocomplete new-password), `button#cx-guardar` "Guardar y probar", `button#cx-cerrar`, `p#cx-resultado` (role status), and the fixed note "La contraseña se guarda cifrada y no se vuelve a mostrar."

Script:
- `cargarConexiones()` through `pedir('/conexiones')`; with no tenant it writes "Elegí un tenant para ver sus conexiones." and makes no request.
- Row: name, engine, `host:puerto`, database, user, a "Probar" button and a result cell. "Probar" → `pedir('/conexiones/' + id + '/prueba', { method: 'POST' })` → "OK · N ms" or "Falló · {categoria} ({codigo})".
- Save and test: `pedir('/conexiones', POST, { nombre, motor: 'postgres', host, puerto, baseDeDatos, usuarioDb, credencial })`; the password field is emptied right after reading it; on 201 the probe, then the result in `#cx-resultado` and `cargarConexiones()`. A 400 shows the invalid fields by name.
- Tenant switch reloads the list and closes the panel.

## 5. Tests

- `src/conexiones.test.ts` (or the listing file): public fields, never `credencial`.
- `src/consola.test.ts`: new ids in `IDS` (both screens, their controls, the panel; hidden ones in `IDS_OCULTOS`); navigation order and the two new hashes; Tenants: rows for active and deactivated, create reloads, choose, inline confirmation sends nothing until confirmed, deactivating the active tenant resets the bar; Conexiones: no-tenant message without a request, list rows as text, save-and-test sends `motor: 'postgres'` and empties the password, probe result ok and failure, the password never appears in any node's text.

## 6. Trade-offs
- **Inline confirmations instead of dialogs.** Same pattern as CH-25's restore; a dialog component can replace them later without changing the routes.
- **No stored last test** (DEC-167): the result lives until the screen reloads.

## 7. Size forecast
PR1 ~330 (navigation, Tenants) · PR2 ~370 (API widening, Conexiones). Total ~700.
