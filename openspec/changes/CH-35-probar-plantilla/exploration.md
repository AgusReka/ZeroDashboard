# Exploration: CH-35 — Testing a template against a connection from the console

Status: **decided** (2026-10-16): DEC-177 (a), «Probar» in the template panel. No research phase. Store: openspec. Origin: the audit of 2026-10-13, §3.2 and phase F3 (template → query). Front end only: no route, no migration.

## What exists (verified)

| Piece | State |
|---|---|
| Templates | Global (DEC-61), written against `v_<entidad>`. They only run composed with a connection's views: `componerSentencia` (`src/plantillas.ts:120`) builds `WITH v_<entidad> AS (...) SELECT * FROM (<plantilla>) AS _plantilla`. |
| Test route | `POST /plantillas/:id/prueba` (`src/plantilla-prueba.ts`, DEC-62), scoped by `X-Tenant-Id`. Strict body: `conexionId` (required), `valores` (object, default `{}`), `limite` (default 50), `desplazamiento`. Errors: `400 solicitud-invalida` (with the parameter problems from `prepararSentencia`), `404 plantilla-no-encontrada` or `conexion-no-encontrada`, `409 vista-canonica-no-aprobada` with `entidades`, `409 credencial-ilegible`. A completed attempt is `200` with the `/consultas/ejecutar` body (`resultado`, columns, rows, `paginacion`), and is recorded in the audit with `origen: 'plantilla-prueba'` (DEC-159). |
| Console, Plantillas | `src/consola.ts:440-464` markup (global screen; side panel `#plantilla-panel` with entities, parameters, SQL, «Cerrar»); script `verPlantilla` (`:4505`) and `cargarPantallaPlantillas` (`:4519`). Read-only. Nothing calls the test route. |
| Reusable script pieces | `construirValores` (`:2395`) plus `valoresDe` (`:1532`) for parameter inputs; `ponerOpcionesConexion` (`:1600`) for a connection select; `renderizarTabla` (`:2000`); `mensajeDeFallo` and `MENSAJES_ERROR` (used by `ejecutar`, `:1667-1760`); `manejarFalloDeTenant`; `pedir` (sends the tenant header and refuses with no tenant). |
| Spec | `query-console` "Templates Screen" (`spec.md:814`): "The screen SHALL offer no way to create or change a template." Testing does neither. |
| Guards | `IDS`, `verificarIds`, G3' in `src/consola.test.ts`. |

## Shape that fits

- **Where.** A «Probar en el tenant activo» block in `#plantilla-panel`, under the SQL. The screen stays global; the block is the one scoped part and says so.
- **Inputs.** A connection select filled from `GET /conexiones` of the active tenant, one input per declared parameter (`construirValores`), and «Probar».
- **Request.** `POST /plantillas/:id/prueba` with `{ conexionId, valores }`; first page only, `limite` 50.
- **Answers.**
  - `200 ok`: a table of columns and rows, and a line saying how many rows and whether there are more.
  - `200 fallo`: `mensajeDeFallo`.
  - `409 vista-canonica-no-aprobada`: names the entities and points to Mapeo y validación.
  - `400`: names the parameters.
  - `404`, `409 credencial-ilegible` and tenant failures: legible text.
- **No tenant.** The block says «Elegí un tenant para probar la plantilla» and sends nothing.
- **Reset.** Opening another template, closing the panel or switching tenant clears the result.
- **Out of scope.** Turning a template into a saved query (DEC-177 resigns it), pagination of the result, editing templates.

## Size
~200–280 changed lines (markup ~15, script ~90, tests ~120, docs ~15). One PR.
