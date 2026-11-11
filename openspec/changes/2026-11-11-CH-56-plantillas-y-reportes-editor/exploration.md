# Exploration: CH-56 — Template and report editor as a sectioned page

Source: the console UX audit (EXPLORE, 2026-11-11), `guidelines/admin.md` F1–F8, K3–K5, N4, P5, §13 Plantillas/Reportes. Decisions: DEC-182, DEC-191 (in-use templates only duplicate; test before save), DEC-183, DEC-198 (reports). `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)

**Plantillas** (L691, JS L5784):
- A table with a side panel and a «Nueva plantilla» dialog `#plantilla-dialogo` (L744).
- Dialog fields: Nombre, Sentencia SQL, Parámetros, entities, Automatización, Formato, Tolerancia de frescura (minutos), Título and Descripción para el cliente, Encabezado del mensaje, Línea por fila, and "Probar antes de guardar".
- Save is disabled until a successful test with a connection of the active tenant (L6128).
- When the template is in use, the API answers 409 `plantilla-en-uso` and the console offers to duplicate.

**Reportes** (L832, JS L6451): the same composition, in dialog `#reporte-dialogo` (L886).
- Fields: Nombre, Título and Descripción para el cliente, entities, SQL, Período, Visualización, and columns by role.
- Save requires a test (L6887).

**Known behaviour difference (K4):**
- Duplicating a template clears its client texts (L6284–6286).
- Duplicating a report keeps them.
- Both are intentional per their changes. This proposal flags the difference; it does not change it.

**Template cards:**
- They describe only `stock-fisico` and `stock-producible`.
- Any other template shows "Plantilla del catálogo, sin descripción en la consola" (L1572–1576).

## Hypotheses
- The long dialog with many fields hides errors below the fold.

## Open questions (product)
1. K4: should duplicating a template keep its client texts, like reports do? Not decided here.
2. Should the in-use count ("la usan 3 automatizaciones") be shown before the 409? Only if the API already returns it on `GET /plantillas/:id` (DEC-191 mentions a count across tenants). The design phase checks; no new API.
