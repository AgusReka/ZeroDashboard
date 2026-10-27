# Design: CH-38 — Templates screen in the console

Inputs: proposal.md, the four spec deltas (`automation-templates`, `tenant-isolation`, `execution-audit`, `query-console`), DEC-182, DEC-191, DEC-173, DEC-177, DEC-160, DEC-121, DEC-79, DEC-71. Code as it stands on `ch37/textos-cliente`: `src/aislamiento/aislamiento-prisma.ts`, `src/app/rutas.ts`, `src/plantillas/plantillas-rutas.ts`, `src/plantillas/plantilla-prueba.ts`, `src/consola/consola.ts`.

## 0. Two refinements of DEC-191's "Forma"

The code makes two details of DEC-191 more precise. Neither changes an option the user chose.

1. **Where the unscoped read lives.** DEC-191 says the function is "armada en `rutas.ts` con el cliente sin aislar". `rutas.ts` has no raw client: `server.ts` keeps only the extended one on purpose (`aislamiento-prisma.ts`, comment over `extenderConAislamiento`). Every unscoped read of a scoped model lives as a typed method of the extension, on the raw client it closes over (`agente.buscarPorTokenHash`, `usuario.buscarPorCorreo`, `sesionPanel.buscarPorTokenHash`). CH-38 follows that precedent. `rutas.ts` only builds the port from those methods and injects it, which is the part of DEC-191 that matters: the routes get a function, not a client.
2. **What it returns, and the race.**
   - The read returns a boolean, not a number: `enUso` needs nothing more, and less leaves the isolation boundary.
   - The replacement locks the template row (`SELECT … FOR UPDATE`) before checking. Creating an automation takes `FOR KEY SHARE` on the referenced `Plantilla` row (foreign key check), which conflicts with `FOR UPDATE`. So the window DEC-191 accepted ("una carrera mínima") is closed at no extra cost.

Both go into DEC-191 as a wording amendment on PR #213 before the apply.

## 1. Isolation extension (`src/aislamiento/aislamiento-prisma.ts`)

A new `automatizacion` entry in `model:` with two methods. Both run on the closed-over raw `prisma`, like `buscarPorTokenHash`, with a doc comment naming CH-38, DEC-191 and why it is unscoped (the catalog routes are global and exempt; use is a cross-tenant property).

```ts
automatizacion: {
  /** CH-38 (DEC-191): whether any tenant has an active automation on the template. Boolean only. */
  async plantillaEnUso(plantillaId: string): Promise<boolean> {
    const fila = await prisma.automatizacion.findFirst({
      where: { plantillaId, activo: true },
      select: { id: true },
    });
    return fila !== null;
  },
  /**
   * CH-38 (DEC-191): replace a template only if no tenant has an active automation on it.
   * The row lock conflicts with the FOR KEY SHARE an automation insert takes on its
   * template, so no automation can commit between the check and the write.
   */
  async reemplazarPlantillaLibre(
    id: string,
    datos: Prisma.PlantillaUpdateInput,
  ): Promise<'no-encontrada' | 'en-uso' | PlantillaCompletaFila> {
    return prisma.$transaction(async (tx) => {
      const bloqueada = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Plantilla" WHERE "id" = ${id} FOR UPDATE`;
      if (bloqueada.length === 0) return 'no-encontrada';
      const activa = await tx.automatizacion.findFirst({
        where: { plantillaId: id, activo: true },
        select: { id: true },
      });
      if (activa !== null) return 'en-uso';
      return tx.plantilla.update({ where: { id }, data: datos, select: PlantillaCompleta });
    });
  },
},
```

- `$queryRaw` uses a tagged template: `id` is a driver parameter, never text (rule 4). It touches `Plantilla`, which is not scoped.
- `PlantillaCompleta` and its row type are imported from `plantillas-rutas.ts`. If that import makes a cycle, the select moves to `src/plantillas/plantillas.ts`, which the extension can import.
- `$allOperations` keeps rejecting every other `Automatizacion` operation without context. The header comment of the file gains a CH-38 paragraph, like CH-19b and CH-22a.

## 2. Template routes (`src/plantillas/plantillas-rutas.ts`)

### 2.1 Port and signature

```ts
/** CH-38 (DEC-191): the only cross-tenant facts the catalog routes may know. */
export interface UsoDePlantillas {
  enUso(plantillaId: string): Promise<boolean>;
  reemplazarSiLibre(id: string, datos: ReturnType<typeof datosDePlantilla>):
    Promise<'no-encontrada' | 'en-uso' | PlantillaCompletaFila>;
}
export function registerPlantillaRoutes(app, plantillas, uso: UsoDePlantillas): void
```

In `rutas.ts`:

```ts
registerPlantillaRoutes(app, prisma.plantilla, {
  enUso: (id) => prisma.automatizacion.plantillaEnUso(id),
  reemplazarSiLibre: (id, datos) => prisma.automatizacion.reemplazarPlantillaLibre(id, datos),
});
```

The comment above it is extended: the exempt catalog still gets no scoped model, only two answers about use.

### 2.2 Handlers

- **`POST`.** Unchanged, and the body gains `enUso: false`.
- **`GET /:id`.** After the `findUnique`, it reads `await uso.enUso(id)` and sends `{plantilla: {...fila, enUso}}`.
- **`PUT /:id`.** `rechazoDePlantilla` first, unchanged, so the rejection suite's throwing `Proxy` is never reached. Then `uso.reemplazarSiLibre(id, datosDePlantilla(body))`:
  - `'no-encontrada'` → `404 plantilla-no-encontrada`;
  - `'en-uso'` → `409 plantilla-en-uso`;
  - a row → `200 {plantilla: {...fila, enUso: false}}`.
  - `esPlantillaInexistente` and the `update`-and-catch disappear: the lock answers "unknown" first.
- **`GET /plantillas`.** Unchanged.

## 3. Unsaved-template test (`src/plantillas/plantilla-prueba.ts`)

- **Shared gates.** `ejecutarPrueba` already takes `{plantilla: {id, sql, parametros}, vistas, cuerpo}`. `plantilla.id` becomes `string | null`, and the audit call passes it as is (`plantillaId: plantilla.id`). The two routes share the gates through one function, `probarContraConexion(prisma, request, reply, plantilla, cuerpo, canales)`, which does the ownership check, the views read, `evaluarVistas` and the call to `ejecutarPrueba`. The stored-template handler shrinks to "load the row, then call it".
- **New route `POST /plantillas/prueba`:**
  - Schema `pruebaSinGuardarSchema`: the properties of `registroPlantillaSchema` plus `conexionId` (required) and `valores` (object, default `{}`). `propertyNames.enum` lists all eleven keys, and the `required` list is the union of both schemas.
  - `limite` and `desplazamiento` are not accepted: first page only, as the console asks. `ejecutarPrueba` gets the defaults (50, 0).
  - **Handler.** `rechazoDePlantilla(request.validationError, templateFields(body))` → `400` with the same body as `POST /plantillas`. Then `probarContraConexion` with `{id: null, sql, parametros}` and `entidades` from the body.
  - `rechazoDePlantilla` needs to ignore AJV errors on `/conexionId` and `/valores`. Simplest: the route maps a validation error on those two to `{error:'solicitud-invalida', campos}` itself, before calling `rechazoDePlantilla`.
- **Routing and exemption.** Fastify matches the static `/plantillas/prueba` before the parametric `/plantillas/:id/prueba` (different depth, so no clash either way). `PLANTILLAS_EXENTAS` is matched by exact method and pattern and the new pattern is not added, so it requires `x-tenant-id` like its sibling. `rutas.test.ts` sees it as a guarded route with no change to its exemption list.

## 4. Console (`src/consola/consola.ts`)

### 4.1 Markup

- **C-03 header:** button `#plantilla-nueva` «Nueva plantilla» (primary, `type="button"`).
- **Side panel `#plantilla-panel`:**
  - `#plantilla-textos` (client title and description, or «Sin textos para el cliente: no aparece en el panel»);
  - `#plantilla-editar` and `#plantilla-duplicar`, both `hidden` by default;
  - `#plantilla-en-uso-aviso` («Tiene automatizaciones activas: se duplica en lugar de editarse»).
- **New pop-up `#plantilla-dialogo`**, following `#conexion-dialogo`:
  - `.zd-dialog-backdrop` > `.zd-dialog[role=dialog][aria-labelledby]`, title `#plantilla-dialogo-titulo` («Nueva plantilla», «Editar plantilla» or «Duplicar plantilla»).
  - A `<form id="plantilla-form">` with:
    - fields `#plantilla-f-nombre`, `#plantilla-f-sql` (textarea, mono), `#plantilla-f-parametros` (container), `#plantilla-f-agregar-parametro`;
    - `#plantilla-f-entidades` (fieldset, checkboxes built by the script from a literal `ENTIDADES_PLANTILLA`, written like the existing `TIPOS_PARAMETRO` literal, `consola.ts:1017`);
    - `#plantilla-f-automatizacion` and `#plantilla-f-formato` (selects; options in static markup);
    - a `consola.test.ts` case pins the three console lists (entities, automation tags, formats) to `ENTIDADES_CANONICAS`, `VALORES_AUTOMATIZACION` and `FORMATOS`, so they cannot drift from the code's closed lists;
    - `#plantilla-f-tolerancia` (number, min 0);
    - `#plantilla-f-titulo` (maxlength 80) and `#plantilla-f-descripcion` (textarea, maxlength 200), each with its cap in the hint;
    - `#plantilla-f-aviso-copia` (hidden unless duplicating).
  - Test block: `#plantilla-f-conexion` (select), `#plantilla-f-valores` (container), `#plantilla-f-probar`, `#plantilla-f-resultado` (`role=status`).
  - `#plantilla-dialogo-estado` (`role=status`, refusals and the reason «Guardar» is disabled). Actions: `#plantilla-dialogo-cancelar`, `#plantilla-dialogo-guardar` (`type="submit" form="plantilla-form"`).
- **Styling.** Every `zd-*` class is in the static markup. Nodes the script builds (checkbox rows, parameter rows) use bridge classes of the `<style>` block, as the query pop-up's parameter rows already do (G3').

### 4.2 Parameter editor, made reusable

`agregarFilaParametro`, `limpiarParametros` and `declaracionActual` are bound to the module globals `contenedorParametros`, `filasParametros` and to `actualizarGuardado`. They become one factory:

```js
function crearEditorParametros(contenedor, alCambiar) {
  var filas = [];
  return {
    agregar: function (nombre, tipo) { /* body of agregarFilaParametro, using filas/contenedor/alCambiar */ },
    limpiar: function () { vaciar(contenedor); filas = []; alCambiar(); },
    declaracion: function () { /* body of declaracionActual over filas */ },
  };
}
var editorConsulta = crearEditorParametros(contenedorParametros, actualizarGuardado);
```

The Consultas callers switch to `editorConsulta.agregar` and the other two methods. The DOM produced is byte-identical, so the existing Consultas tests are the regression net and are not edited. The template pop-up gets its own `editorPlantilla = crearEditorParametros(nodo('plantilla-f-parametros'), actualizarGuardadoPlantilla)`. Parameter value inputs reuse `construirValores` (already shared with the side-panel test block).

### 4.3 Pop-up logic

- **Mode.** `modoPlantilla` ∈ `'nueva' | 'editar' | 'duplicar'`, plus `plantillaEditada` (id, for `editar`).
- **Opening.** `abrirDialogoPlantilla(modo, plantilla)` fills the form:
  - `nueva`: empty fields;
  - `editar`: the loaded template;
  - `duplicar`: the loaded template, `nombre + ' (copia)'`, empty texts, and the copy notice shown.
  - It loads the connections of the active tenant through `pedir('/conexiones')`. It resets `ultimaPrueba = null` and opens through `crearDialogo` (with `hayCambios` comparing a snapshot of the form taken at open).
- **Fingerprint.** `huellaPlantilla()` is the `JSON.stringify` of `[sql, editorPlantilla.declaracion(), entidadesMarcadas(), conexionId]`. `ultimaPrueba = {huella, ok}` is set on every test answer. `guardadoPlantillaHabilitado()` is `ultimaPrueba && ultimaPrueba.ok && ultimaPrueba.huella === huellaPlantilla() && nombre !== ''`. `motivoGuardadoPlantilla()` returns «Probá la plantilla antes de guardarla», «La última prueba falló» or «Cambió la plantilla desde la última prueba».
- **«Probar».** It sends `pedir('/plantillas/prueba', POST, {…cuerpoPlantilla(), conexionId, valores})` and renders the answer with the side panel's renderer. Today that rendering is inline in `probarPlantilla` (`consola.ts`, after `generacionPrueba`). It is extracted into `mostrarResultadoPrueba(nodo, respuesta)` with no change to the side panel's output, and both blocks call it. Stale answers are dropped with a generation counter, as in `generacionPrueba`. `ok` is true only for `200` with `resultado: "ok"`.
- **«Guardar».** It sends `POST /plantillas`, or `PUT /plantillas/:id` for `editar`, with `cuerpoPlantilla()`, always both texts (blank as `''`, the route stores `null`), through `leerGlobal`-style fetch with no tenant header. A double-submit flag guards it, as in the connection pop-up.
  - `201`/`200`: close, `cargarPantallaPlantillas()`, `verPlantilla(id)`.
  - `400`: `avisarEnDialogo` with «Revisá estos campos» plus the field labels, and the `terminos` when present.
  - `409 plantilla-en-uso`: message and a «Duplicar y editar» button `#plantilla-dialogo-duplicar` that switches the open pop-up to `duplicar` mode with the current form values.
- **Drawer.** `verPlantilla` fills `#plantilla-textos` and toggles `#plantilla-editar`/`#plantilla-duplicar`/`#plantilla-en-uso-aviso` by `enUso`.
- **Tenant switch.** `cerrarDialogos()` already closes every `crearDialogo` pop-up.

## 5. Tests

- **`plantillas-rutas.test.ts`.**
  - Signature pin updated to `(app, delegate, uso)`.
  - Unit suite with a fake `UsoDePlantillas`: `GET` returns `enUso`; `PUT` maps the three outcomes to `404`/`409`/`200`; a `400` body never calls the port.
  - DB suite (existing pattern): a template with an active automation in tenant B → `PUT` without header is `409` and unchanged; only deactivated automations → `200`.
- **`aislamiento-prisma` / isolation test.** Two tenants:
  - `plantillaEnUso` answers without context and returns a boolean;
  - `automatizacion.count` without context still throws;
  - `reemplazarPlantillaLibre` returns `'en-uso'` when B has an active one.
- **Race test (DB).** Open a transaction that inserts an automation on T and hold it. Call `reemplazarPlantillaLibre(T)` concurrently: it waits on the lock. Commit the insert, and the replace answers `'en-uso'`. Timeboxed, so it fails rather than hangs.
- **`plantilla-prueba.test.ts`.**
  - `POST /plantillas/prueba`: `400` with an invalid template and no execution, `400 tenant-no-indicado`, `404` on another tenant's connection, `409` on unapproved views, `200` with rows on an approved connection, and no `Plantilla` row written.
  - `auditoria-registro.test.ts` checks the row: `origen`, composed SQL, `plantillaId` null.
- **`rutas.test.ts`.** No change expected: the new route is guarded. It is run to confirm.
- **`consola.test.ts`.**
  - New ids in `IDS`, hidden ones in `IDS_OCULTOS`, the three selects in the select list.
  - G3' unchanged (no new `zd-*` in the script).
  - Scenarios: «Nueva plantilla» opens the pop-up; «Guardar» disabled until a passing test; an SQL edit disables it and a title edit does not; «Guardar» sends `POST` with both texts; «Duplicar y editar» prefills with «(copia)» and empty texts and writes nothing; `409 plantilla-en-uso` offers duplication; the drawer shows «Editar» or «Duplicar y editar» by `enUso`; a `400` with `terminos` names the field and the term.
  - All existing Consultas tests pass unedited.

## 6. Docs

- **`docs/guia/05-plantillas.md`:**
  - The screen: create, test, save, edit, duplicate.
  - The in-use rule with the `409`, and `enUso`.
  - `POST /plantillas/prueba`.
  - The "Límites" line about the console is removed.
  - A note that the demo's `stock-fisico` template is in use.
- **`guidelines/consola.md`.** The C-03 entry (both copies, `.claude/` and `.agents/`) loses "solo lectura" and describes the header action, the drawer actions and the pop-up.
- **Bitácora `docs/bitacora/CH-38-…`.** Written at archive, as CH-37's.

## 7. Rejected alternatives

- **`_count.automatizaciones` through the `plantilla` delegate.** It is option 2(b) of DEC-191, rejected by the user: it relies on nested reads being unscoped.
- **Count first, then `update` without a lock.** It leaves the race open for no saving: the lock is one statement.
- **A backend «duplicar» route.** Duplication is a prefilled pop-up. A route would write before the test gate, against DEC-191.
- **Reusing `POST /plantillas/:id/prueba` with an overriding body.** It mixes two sources of SQL in one route and weakens DEC-62's "stored SQL only" property of that route.

## 8. Size forecast

| Part | Lines |
|---|---|
| Isolation extension + comment | ~55 |
| Template routes + wiring | ~45 |
| Test route (shared gates + new route) | ~80 |
| Console markup | ~90 |
| Console script (editor factory, pop-up, drawer) | ~260 |
| Tests (routes, isolation, race, test route, audit, console) | ~330 |
| Docs and guideline | ~40 |
| **Total** | **~900** |

Over the 400 budget. Delivery is one PR with `size:exception`, chosen by the user (exploration decision 5(b)).
