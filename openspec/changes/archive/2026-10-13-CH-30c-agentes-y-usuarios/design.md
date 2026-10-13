# Design: CH-30c — Agents and panel users screens

Inputs: proposal.md, the `query-console` delta, DEC-121, DEC-155 to DEC-158, CH-30a/30b's shell, `mostrarPantalla()`, `cambiarTenant()`, `pedir()` and the helpers `celdaTenant`/`botonTenant`.

## 1. Navigation and screens

`PANTALLAS` gains `agentes` and `usuarios`; "Puesta en marcha" lists Conexiones, Agentes, Usuarios del panel. `mostrarPantalla()` calls each screen's loader when shown and calls `olvidarSecretos()` on every switch.

## 2. Secrets shown once

Markup per screen: `div#agente-secreto` / `div#usuario-secreto` (hidden), each with a `code` node for the value, a "Copiar" button and a "Ya lo guardé" button.
- `mostrarSecreto(contenedor, valor, explicacion)`: writes the value with `textContent`, shows the container.
- `olvidarSecretos()`: empties both value nodes and hides both containers. Called by "Ya lo guardé", by `mostrarPantalla()` and by `cambiarTenant()`.
- "Copiar": `navigator.clipboard.writeText(valor)` when available; otherwise (or on rejection) the notice says "Seleccioná el texto y copialo a mano." The value read for copying is the node's text; nothing else stores it.

## 3. Agentes (`#agentes`)

Markup: `section#pantalla-agentes` with a page header, `p#agentes-aviso`, `div#agente-estado` (the script writes state, dates and the action buttons inside it), the secret container.

Script:
- `cargarPantallaAgentes()`: no tenant → message, no request; else `pedir('/agentes')` → `renderizarAgente(lista[0] || null)`.
- No agent → "Crear agente"; revoked → "Revocado desde dd/mm/aaaa" and "Emitir un token nuevo"; active → "Activo", token emitted date, "Revocar".
- Emit: `pedir('/agentes', POST, {})` → 201 or 200 → `mostrarSecreto(token)` and reload; `409 agente-existente` → reload with a notice.
- Revoke: inline confirmation «Revocar el token» with the impact text, then `pedir('/agentes/' + id + '/revocar', POST)` → reload.

## 4. Conexiones panel: through the agent

The panel gains `select#cx-via` with "Directa" (value empty) and, when the tenant has an active agent, "Por el agente del tenant" (value its id). The options are rebuilt when the panel opens (`pedir('/agentes')`). On save, a non-empty value adds `agenteId` to the body.

## 5. Usuarios del panel (`#usuarios`)

Markup: `section#pantalla-usuarios`, page header, `form#usuario-alta` (`usuario-correo`, `usuario-nombre`, submit "Crear usuario"), `p#usuarios-aviso`, the secret container, `table` with `tbody#usuarios-cuerpo`.

Script:
- `cargarPantallaUsuarios()`: no tenant → message; else `pedir('/usuarios')` → rows (email, name or "—", state, created, actions).
- Create: `pedir('/usuarios', POST, { correo, nombre? })` → 201 → `mostrarSecreto(clave)`, clear the form, reload; 409 → "Ese correo ya está en uso."; 400 → the invalid fields.
- Row actions: "Reponer clave" → `POST /usuarios/:id/clave` → `mostrarSecreto(clave)`; "Desactivar" → inline confirmation «Desactivar {correo}» → `POST …/desactivar`; "Reactivar" → `POST …/reactivar`; each reloads the list.

## 6. Tests

New ids in `IDS` and hidden ones in `IDS_OCULTOS`; navigation order; Agentes: no tenant, none/active/revoked states, emit shows the token, dismiss clears it from every node, revoke asks inline then sends; the panel's agent option sends `agenteId`; Usuarios: list, create shows the password, 409 shows no password, reset, deactivate confirmation, reactivate; leaving the screen and switching tenant clear any secret. The duplicate-function guard keeps every new helper unique.

## 7. Size forecast
PR1 ~420 (navigation, secrets helper, Agentes, agent option) · PR2 ~430 (Usuarios). Total ~850.
