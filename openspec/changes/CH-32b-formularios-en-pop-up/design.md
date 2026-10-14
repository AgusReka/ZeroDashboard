# Design: CH-32b — Create forms in a pop-up, and the audit's F2 items

Inputs: proposal.md, the `query-console` delta, DEC-173, DEC-156, DEC-129, DEC-132/DEC-167, CH-32a's pop-up (`src/consola.ts:447-539`, `:2734-2932`), the design guide (`consola.md`: dialogs below the tenant bar, one primary action per screen in the header, C-09 cron "expresión mono + texto humano"; `lenguaje.md:28`: a destructive confirmation repeats action and object) and, as subordinate reading, `impeccable`'s harden checklist (validation next to the field, error inside the form that produced it).

## 1. One pop-up mechanism

CH-32a's logic (`abrirConsulta`, `cerrarConsulta`, `hayCambiosSinGuardar`, `pedirCerrarConsulta` and the Escape listener) becomes one factory:

```js
// DEC-173: every create form opens in a pop-up. Cancelar and Escape close it without sending;
// with something typed they first ask «Descartar cambios». A tenant switch closes it at once.
function crearDialogo(opciones) {
  // opciones: { fondo, primerCampo, cancelar, confirmar, descartar, seguir, hayCambios, alAbrir, alCerrar }
  function cerrar() { opciones.fondo.hidden = true; opciones.confirmar.hidden = true; if (opciones.alCerrar) { opciones.alCerrar(); } }
  function pedirCerrar() { if (opciones.hayCambios()) { opciones.confirmar.hidden = false; return; } cerrar(); }
  function abrir() { opciones.confirmar.hidden = true; if (opciones.alAbrir) { opciones.alAbrir(); } opciones.fondo.hidden = false; opciones.primerCampo.focus(); }
  opciones.cancelar.addEventListener('click', pedirCerrar);
  opciones.fondo.addEventListener('keydown', function (evento) { if (evento.key === 'Escape') { pedirCerrar(); } });
  opciones.descartar.addEventListener('click', cerrar);
  opciones.seguir.addEventListener('click', function () { opciones.confirmar.hidden = true; });
  var dialogo = { abrir: abrir, cerrar: cerrar, abierto: function () { return !opciones.fondo.hidden; } };
  dialogos.push(dialogo);
  return dialogo;
}
var dialogos = [];
function cerrarDialogos() { dialogos.forEach(function (dialogo) { dialogo.cerrar(); }); }
```

- **Consultas** is rebuilt on it with its existing ids and behaviour: `alAbrir` holds what `abrirConsulta` does today before showing it; `hayCambios` is today's `hayCambiosSinGuardar`. `abrirConsulta`/`cerrarConsulta` stay as thin names the rest of the query code already calls. Its tests must pass unchanged — that is the refactor's check.
- `cambiarTenant()` and `manejarFalloDeTenant()` call `cerrarDialogos()` where they call `cerrarConsulta()` today (and where `cambiarTenant` hides `#conexion-panel` and calls `cerrarAlta()`).
- **Messages inside a pop-up.** `avisarEnConsulta` / `llevarBannerAlDialogo` are generalised to `avisarEnDialogo(dialogo, linea, texto)` and `llevarBannerA(dialogo, linea)`: open, the text goes to the pop-up's status line; closed, to the banner. Each pop-up owns one status line.
- **Confirmation strip**, the same markup as CH-32a in each pop-up's actions row: `span#<x>-confirmar[hidden]` with «Hay cambios sin guardar.», `button#<x>-descartar` «Descartar cambios» and `button#<x>-seguir` «Seguir editando». The console rule that lays out `#consulta-nueva-confirmar` is extended to a selector list.
- Not added (DEC-173 does not ask, CH-32a has none): focus trap, focus return, backdrop click.

## 2. Markup per pop-up

Every pop-up is `div#<x>-dialogo.zd-dialog-backdrop[hidden]` > `div.zd-dialog[role=dialog][aria-modal=true][aria-labelledby=<x>-dialogo-titulo]` > `h2#<x>-dialogo-titulo.zd-dialog__title`, the form, a status line `p#<x>-dialogo-aviso.ayuda[role=status]`, and `.zd-dialog__actions` (confirm strip, main action, «Cancelar» ghost). Field ids do not change, so the scripts that read them do not either.

| Pop-up | Backdrop id | Opener (page header) | First field | Actions | Retired ids |
|---|---|---|---|---|---|
| Nuevo tenant | `tenant-dialogo` | `tenant-nuevo` «Nuevo tenant» | `tenant-nombre` (label «Nombre») | submit «Crear tenant», `tenant-crear-elegir` «Crear y elegir» (`type=button`, secondary), `tenant-cancelar` | — |
| Nueva conexión | `conexion-dialogo` | `conexion-nueva` (unchanged) | `cx-nombre` | submit «Guardar y probar», `cx-cancelar` | `conexion-panel`, `titulo-conexion-nueva`, `cx-cerrar` |
| Nuevo usuario | `usuario-dialogo` | `usuario-nuevo` «Nuevo usuario» | `usuario-correo` | submit «Crear usuario», `usuario-cancelar` | — |
| Nueva automatización | `auto-alta` (kept: becomes the backdrop) | `auto-nueva` (moved to the header) | `auto-conexion` | step 1: `auto-siguiente`, `auto-cancelar`; step 2: `auto-volver`, `auto-crear`, plus a «Cancelar» | — |

- **Wizard:** `#auto-alta` keeps its id and its `hidden` (so tests that read it as "open/closed" keep their meaning) and moves from `.zd-card.zd-form` to `.zd-dialog-backdrop`; the stepper and both steps go inside `div.zd-dialog.zd-form`. Width: `#auto-alta .zd-dialog { width: min(900px, 100%); }`, replacing the `#auto-alta { margin-top }` rule. `abrirAlta()` no longer hides `#auto-nueva`. The help paragraph of the section stays. Step 2 gains `p#auto-dialogo-aviso` for refusals (400) — the `banner` is behind the pop-up. Step 1's «Cancelar» (`auto-cancelar`) and a new step-2 `auto-cancelar-2` both call `pedirCerrar`.
- **Connection:** `#cx-resultado` stays inside the pop-up as its status line (no new id); `conexiones-aviso` (page) gets the success/test result.
- **Tenant and user:** `tenant-aviso` and `usuarios-aviso` stay on the page for success notices; errors go to `tenant-dialogo-aviso` / `usuario-dialogo-aviso`.
- New ids go to `IDS`; the four backdrops and the four confirm strips to `IDS_OCULTOS`; retired ids to `IDS_RETIRADOS`.

## 3. Dirty predicates

| Pop-up | `hayCambios()` true when |
|---|---|
| Tenant | `tenant-nombre` trimmed is not empty |
| Usuario | `usuario-correo` or `usuario-nombre` trimmed is not empty |
| Conexión | any of nombre, host, base, usuario, clave is not empty, or puerto ≠ `5432`, or `cx-via` ≠ `''` |
| Wizard | a connection or a template is chosen, or any step-2 parameter value or the recipient is not empty |

Each `alAbrir` resets its form to blank (the tenant and user forms already clear on success; the connection form is cleared by `alAbrir`, which also empties `cx-resultado` and calls `opcionesDeVia()` as the open handler does today; the wizard's `alAbrir` is today's `abrirAlta` body, `alCerrar` today's reset in `cerrarAlta`).

## 4. Behaviours

- **Tenant create** (`crearTenant(elegir)`): the form's `submit` calls `crearTenant(false)`, `#tenant-crear-elegir` calls `crearTenant(true)`. Empty name: «Escribí el nombre del tenant.» in `tenant-dialogo-aviso`, nothing sent. On 201: close, `await cargarTenantsPantalla()`, `await cargarTenants()`, then with `elegir` `cambiarTenant(String(cuerpo.tenant.id))` and the notice «Se creó el tenant «X» y quedó como activo.»; without it, today's «Se creó el tenant «X».». A missing `cuerpo.tenant.id` with `elegir`: create notice only. Other answers: message inside, pop-up open.
- **Connection save:** on 201 + test: close, `conexiones-aviso` = «Guardada. Prueba: OK (N ms).» or «Guardada. La prueba falló: {categoría} ({código}).» (wording from today's `cx-resultado` text), reload the list. 400: the field list inside (`cx-resultado`), the password field already empty, pop-up open. Any non-201: inside.
- **User create:** on 201: close, `mostrarSecreto(1, clave)` and reload, as today. 409/400/other: inside (`usuario-dialogo-aviso`).
- **Wizard create:** on 201: `dialogo.cerrar()` (which resets), `mostrarConfirmacion(...)`, reload list. 400 and other refusals: `auto-dialogo-aviso`, step 2 kept.
- **«Reponer clave»** (`accionesUsuario`, both branches): the button replaces the row's actions with `span` «Se cierran sus sesiones abiertas.», `botonTenant('Reponer clave de ' + correo, …accionUsuario(id, 'clave'))` and `botonTenant('Cancelar', …accionesUsuario(td, usuario))` — the same shape as «Desactivar».

## 5. Automations list

- `cargarAutomatizaciones()` loads, in this order: the template catalog (as today), then `cargarNombresConexiones()` — `pedir('/conexiones')` into `nombresConexion` (`{ id: nombre }`); any failure, refusal or network error leaves it empty and is not reported (the column falls back to the short id) — then the list. A generation token drops answers after a tenant switch, as the wizard does.
- **Conexión cell:** `nombresConexion[id]` when present, otherwise the first 8 characters of the id followed by «…».
- **Horario cell:** `horarioEnPalabras(cron)` — split on single spaces into exactly five fields; fields 3 and 4 are `*`; field 5 is one of the values of `DIAS_FRECUENCIA` (reverse lookup into `NOMBRES_FRECUENCIA`); minute and hour are 1–2 digits checked character by character (no regex literal in the page, see the comment at `DIAS_FRECUENCIA`) and in range. Returns «{días} a las HH:MM» or `null`. Cell content: the words as text, a space, and a `code` element holding the cron (no class: G3'; `code` is monospace) — or the `code` alone when `null`.

## 6. Tests (`consola.test.ts`, prefix `CH-32b`)

- **Helpers** generalised from CH-32a (`:3976-4007`): `abrirDialogo(escenario, idAbridor)`, `dialogoAbierto(escenario, idFondo)`, `FORMAS_DE_CANCELAR` reused per pop-up; `respuestasAutomatizaciones(conexiones)` queues catalog + connections + list in the order of §5 and is used by every existing scenario that loads the automations screen.
- **Shared, per pop-up (table-driven over the four):** markup (backdrop, `role=dialog`, `aria-labelledby`, opener in `.zd-pagehead__actions`, no inline form outside the backdrop); focus on the first field; Cancelar and Escape with no changes close and send nothing; with changes ask, «Seguir editando» keeps values, «Descartar cambios» closes; a tenant switch closes it.
- **Tenant:** «Crear tenant» does not change the active tenant; «Crear y elegir» ends with the new tenant active (selector value and label); empty name sends nothing.
- **Connection:** success closes and writes the notice; 201 + failed test closes and says so; 400 keeps it open with the message and an empty password; no password in any node.
- **User:** create closes and shows the secret once; 409 inside, no secret. «Reponer clave»: first click sends nothing and shows «Reponer clave de {correo}»; confirming sends `POST /usuarios/:id/clave`; «Cancelar» restores the actions and sends nothing. Existing test 3379 changes to click twice.
- **Automations list:** name instead of id; «De lunes a viernes a las 06:00» plus `0 6 * * 1-5`; custom cron alone; unknown connection shows the short id; `GET /conexiones` failing still renders the list. Test 1165 changes from `'c-1'` to the connection's name.
- **Wizard:** existing CH-13/CH-21c tests keep driving the same field ids; those that check `#auto-nueva` hidden while open change; a 400 now reads inside the pop-up.

## 7. Size forecast and slices

| Slice | consola.ts | consola.test.ts | Total |
|---|---|---|---|
| 1. Factory (Consultas on it), tenant and user pop-ups, «Crear y elegir», «Reponer clave» | ~170 | ~220 | ~390 |
| 2. Connection pop-up | ~70 | ~110 | ~180 |
| 3. Wizard pop-up, automations list names and schedule | ~130 | ~200 | ~330 |
| Spec delta (planning PR) | | | ~200 |

About 900 lines of code and tests, over the 400-line budget for one PR; each slice fits on its own.
