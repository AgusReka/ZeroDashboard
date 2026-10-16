# Design: CH-35 — Testing a template against a connection from the console

Inputs: proposal.md, specs/query-console/spec.md, DEC-177, DEC-62, `src/plantilla-prueba.ts`.

## 1. Markup
The block goes inside `#plantilla-panel` `.zd-drawer__body`, after `#plantilla-sql` and before «Cerrar». Markup may carry `zd-*` classes; only the script may not (G3'):

```html
<section id="plantilla-prueba" aria-labelledby="plantilla-prueba-titulo">
  <h3 id="plantilla-prueba-titulo" class="zd-h3">Probar en el tenant activo</h3>
  <label for="plantilla-prueba-conexion" class="zd-label">Conexión</label>
  <select id="plantilla-prueba-conexion" class="zd-select"></select>
  <div id="plantilla-prueba-valores"></div>
  <button id="plantilla-probar" class="zd-btn zd-btn--secondary" type="button">Probar</button>
  <p id="plantilla-prueba-aviso" class="ayuda" role="status"></p>
  <div class="zd-table-wrap zd-table-scroll"><table id="plantilla-prueba-tabla" class="zd-table"></table></div>
</section>
```

If `zd-h3` or `zd-btn--secondary` are not in the kit, use the closest class already used in `consola.ts`. The seven ids join `IDS`.

## 2. Script
The open template is kept in `plantillaAbierta` (its `id` and `parametros`), and the parameter inputs in `entradasPrueba`.

- **`verPlantilla(id)`**, after filling the panel:
  - runs `limpiarPruebaPlantilla()`;
  - empties `#plantilla-prueba-valores` and sets `entradasPrueba = construirValores(contenedor, plantilla.parametros)`;
  - runs `cargarConexionesPrueba()`.
- **`cargarConexionesPrueba()`**:
  - With `tenantActivo === null`, it empties the select and writes «Elegí un tenant para probar la plantilla.».
  - Otherwise it reads `GET /conexiones` through `pedir` and fills the select, using `ponerOpcionesConexion` or the name and short-id labelling of the query pop-up.
  - With no connections, it writes «Registrá una conexión de este tenant para probar la plantilla.».
- **`probarPlantilla()`** is wired to `#plantilla-probar`.
  - With no tenant, it writes the no-tenant message and sends nothing.
  - With no connection chosen, it writes «Elegí una conexión para probar la plantilla.» and sends nothing.
  - Otherwise it sends `pedir('/plantillas/' + encodeURIComponent(id) + '/prueba', { method: 'POST', JSON { conexionId, valores: valoresDe(entradasPrueba) } })`. There is no `limite`, so the server default of 50 applies. The button is disabled while the request is in flight.
  - The answer is read in the same order as in `ejecutar` (`:1705-1750`):

    | Answer | Message |
    |---|---|
    | Network failure | «No se pudo contactar con la aplicación.» |
    | Tenant failure | Handled by `manejarFalloDeTenant` |
    | Non-JSON body | Says so, with the HTTP status |
    | `409 vista-canonica-no-aprobada` | «Las vistas de estas entidades no están aprobadas en esta conexión: producto, insumo. Mapealas y validalas en Mapeo y validación.» |
    | `MENSAJES_ERROR[error]` | That entry's text; this covers `credencial-ilegible` |
    | `404` | «La plantilla o la conexión ya no existen.» |
    | `400` | «Revisá estos parámetros: …», built from `campos` or the parameter problems; reuse the query pop-up's helper when it fits |
    | Any other non-200 | The HTTP status |
    | `resultado !== 'ok'` | `mensajeDeFallo(cuerpo)` |
    | ok | `renderizarTabla` with the columns and rows, as the query result does. The notice says «N filas.» and, when `paginacion.hayMas`, adds «Hay más filas; la prueba muestra solo la primera página.» |
- **`limpiarPruebaPlantilla()`** empties the table and the notice. It runs from `verPlantilla`, from «Cerrar», and from the place where the active tenant changes (the writer finds the existing tenant-switch hook, the one that calls `cerrarDialogos`). When the panel is open, that hook also re-runs `cargarConexionesPrueba()`.

Every value is written with `textContent`, and no `zd-*` appears in the script.

## 3. Tests (`src/consola.test.ts`, CH-35 prefix)
- `plantilla-prueba` sits inside `plantilla-panel`, after `plantilla-sql`.
- **With a tenant.**
  - Opening a template with one `numero` parameter fills the connection list and adds one input.
  - «Probar» sends one `POST /plantillas/t-1/prueba` with the `X-Tenant-Id` header, `conexionId` and `valores: { umbral: 5 }`.
  - The table shows the rows as text, and a `<b>` cell is rendered verbatim.
- **`409 vista-canonica-no-aprobada`.** The entities are named and the table stays empty.
- **No tenant.** The message appears and no request is sent.
- **No connection chosen.** The message appears and no request is sent.
- **Another template.** Opening it clears the previous result.
- **`hayMas: true`.** The "more rows" line appears.

## Files
- `src/consola.ts`, `src/consola.test.ts`
- `docs/02-mapa-de-changes.md`: the CH-35 row.
- Design skill `guidelines/pantallas.md`, in both copies: one line on the test, in the templates entry.

## Size
About 250 changed lines. One PR.
