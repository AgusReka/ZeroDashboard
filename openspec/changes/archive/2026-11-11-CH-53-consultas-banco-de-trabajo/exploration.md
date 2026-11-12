# Exploration: CH-53 — Consultas as a SQL workbench page

Source: the console UX audit (EXPLORE, 2026-11-11), `guidelines/admin.md` P5, W1–W9, T8, §13 Consultas, and `guidelines/consola.md` C-08. `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)

**What Consultas does:**
- It runs ad hoc, read-only SQL with typed parameters directly over the replica's **real tables**.
- It does not go through the canonical views: `consultas.ts` uses neither `componerSentencia` nor `ejecutarSobreVistas`.
- Endpoints: `POST /consultas/ejecutar`, `GET/POST /consultas-guardadas`, `GET/PUT /consultas-guardadas/:id`, `…/versiones[/n]`, `…/versiones/:n/restaurar`.

**How saved queries relate to the rest:**
- Templates, reports, automations and the dashboard reference **nothing** from saved queries (grep over `src/`: only shared constants and comments).
- The only link is that Auditoría shows "nombre vN" when the run named a saved query.
- A saved query is not bound to a connection (L2704). The operator chooses the target each time.
- The list projection (`ConsultaGuardadaResumen`, `src/consultas/consultas-guardadas.ts:26`) returns `id`, `nombre`, `descripcion`, `creadaEn` and `actualizadaEn`. It has **no current version number** and no connection.

**The screen today:**
- The screen (L1041) shows only the saved list, a plain `<ul>` (L2506–2556) with "Abrir" and "Versiones", plus «Nueva consulta».
- All the work happens in a 1100 px modal (L1072), with these fields: Nombre, Descripción (opcional), Conexión, Sentencia SQL (starts as `SELECT 1`, L1098), parameters (Nombre, Tipo, Valor) and Filas por página.
- Its actions are: «Ejecutar consulta», «Guardar consulta» / «Guardar como versión N» with a note, and paging.
- Save requires a successful run of exactly that content (DEC-172 for versions). Queries cannot be deleted (L1175).
- The versions panel has "Comparar con la actual" (two text blocks) and "Restaurar". Restaurar confirms in the row; CH-51 moves that to the dialog.
- Name and description sit outside the form on purpose (L1060).

## What the reference panel can show without new APIs (W8)
- The canonical contract (`GET /contrato`, already used by the Contrato screen).
- The parameters the operator declared.
- **Not** the replica's tables or columns: there is no API for that, and adding one would be a new capability.

## Hypotheses
- Operators open Consultas to look at the replica before writing a mapping. The page is not discoverable as that, because nothing says so.

## Open questions (product)
1. Show the current version number in the saved list? It needs `GET /consultas-guardadas` to return it (**backend**, small). Recommended: yes, as an optional work unit; the user decides.
2. Deleting saved queries stays out of scope (existing rule).
