# Design: CH-30d — Mapping and validation, Templates and Contract screens

Inputs: proposal.md, the `query-console` delta, DEC-30 to DEC-46, DEC-61, DEC-169, the shell and helpers of CH-30a to CH-30c (`mostrarPantalla`, `pedir`, `siNoAutenticado`, `celdaTenant`, `botonTenant`, `vaciar`, `manejarFalloDeTenant`).

## 1. Navigation

`PANTALLAS` adds `plantillas`, `contrato`, `mapeo`. Global: Tenants, Plantillas, Contrato. Puesta en marcha: Conexiones, Agentes, Mapeo y validación, Usuarios del panel.

## 2. Plantillas (`#plantillas`, global)

Markup: `section#pantalla-plantillas`, page header (global scope), `p#plantillas-aviso`, table with `tbody#plantillas-cuerpo`, `aside#plantilla-panel.zd-drawer` (hidden) with `h2#plantilla-titulo`, `p#plantilla-entidades`, `p#plantilla-parametros`, `pre#plantilla-sql`, `button#plantilla-cerrar`.
Script: `cargarPantallaPlantillas()` → `fetch('/plantillas').then(siNoAutenticado)` → rows (name, automation, format, `toleranciaTexto(minutos)` as "N min" or "N h"); "Ver" → `fetch('/plantillas/' + id)` → fills the panel with `textContent` and opens it; `truncado` adds a notice.

## 3. Contrato (`#contrato`, global)

Markup: `section#pantalla-contrato`, page header, `p#contrato-aviso`, table with `tbody#contrato-cuerpo`.
Script: `cargarPantallaContrato()` → `fetch('/contrato')` → for each entity a header row (`th` with name and "obligatoria"/"opcional", colspan) then a row per field (name, type, "Sí"/"No", automations joined by ", "). Loaded once per page and kept.

## 4. Mapeo y validación (`#mapeo`, active tenant)

Markup: `section#pantalla-mapeo`, page header with `button#mapeo-validar` in the actions, `select#mapeo-conexion`, `p#mapeo-aviso` (role status), `div#mapeo-entidades` (blocks built by the script), table with `tbody#mapeo-automatizaciones`.
Script:
- `cargarPantallaMapeo()`: no tenant → message; else `pedir('/conexiones')` fills the select (placeholder "Elegí una conexión"); a remembered choice survives within the page.
- On choose: `pedir(…/validacion-mapeo)` (GET, stored report) and `pedir(…/vistas-canonicas)`; for each entity mapped, `pedir(…/vistas-canonicas/:entidad)` to fill its editor.
- `renderizarInforme(informe)`: one block per entity: `h3` name + obligatoriness, state text (map: `no-mapeada` → "Sin mapear", `no-validado` → "Sin validar", `valida` → "Válida", `invalida` → "Inválida"), a `textarea` (value = stored SQL), "Guardar", and a list of field diagnostics when present (`campo · veredicto · columna · tipo observado · pista`); a failed probe shows its category. Automations table: name, state, reasons (`entidad.campo: motivo`).
- "Guardar": `pedir(PUT …/vistas-canonicas/:entidad, { sql })` → 200/201 → the block's state becomes "Sin validar"; 400 → the field names.
- "Validar": `pedir(POST …/validacion-mapeo, {})` → `resultado: 'ok'` → `renderizarInforme`; `resultado: 'fallo'` → the notice "La validación no pudo conectarse: {fase} · {categoria} ({codigo}). Se mantiene el último resultado." and nothing else changes.
- The bridge style gains rules for `#mapeo-entidades textarea` (monospace, full width) and the blocks' spacing; the script assigns no class.

## 5. Tests

New ids in `IDS`/`IDS_OCULTOS`; navigation order; Plantillas: rows, "Ver" fills the panel as text, `truncado`; Contrato: entity header rows and field rows; Mapeo: no tenant and no connection send nothing, the five blocks from a report, saving sends the SQL and shows "Sin validar", a session failure keeps the states and shows the failure, an invalid field shows verdict and hint, automations with reasons; a SQL with markup shows as text.

## 6. Size forecast
PR1 ~380 (navigation, Plantillas, Contrato) · PR2 ~480 (Mapeo; split if over 400). Total ~860.
