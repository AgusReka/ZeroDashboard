# Exploration: CH-32a — Saved queries without duplicates, and a connection picker

Status: **decided** (2026-10-14): DEC-172, option (a) — "Guardar consulta" is hidden while a saved query is loaded. Store: openspec. Origin: the audit of 2026-10-13 (`docs/auditoria-2026-10-13.md`, observations 3 and 4, phase F1). Front-end only.

## What exists (verified)

| Piece | State |
|---|---|
| Saving | `guardar()` (`src/consola.ts:1460`) always sends `POST /consultas-guardadas`, whether or not a saved query is loaded. Loading a query and pressing "Guardar consulta" creates a second row at version 1 with the same content. Duplicate names are allowed by the API (spec `saved-queries`). |
| Versioning | With a query loaded, `#version-guardar` appears with "Guardar como nueva versión", which sends `PUT /consultas-guardadas/:id` (CH-25). Both buttons are visible at once; the help text explains the `PUT` path but not that the other button creates a new query. |
| Loaded query | `consultaCargada` (`:2563`) holds `{ id, nombre, version, sql }`; `olvidarConsultaCargada()` clears it on a tenant switch or a 404. There is no way to go back to an empty editor without reloading the page. |
| Connection | `#conexion` is a free-text input for the connection's UUID (`:423-424`); `ejecutar()` reads `entradaConexion.value.trim()` (`:1264`). `GET /conexiones` exists (DEC-132, DEC-167) and already feeds the automation wizard's select (`renderizarConexiones`, `:1713`) and the Conexiones and Mapeo screens. |
| Saved query and connection | A saved query is not bound to a connection (DEC-11); loading one leaves `#conexion` as it is (`:1561`). |
| Spec | `query-console` "Saving the Current Statement From the Console" only says the console creates; nothing covers a loaded query, a new-query action or the connection picker. |
| Design guide (C-08) | Connection as a select (id + name); "Consulta nueva"; "Guardar consulta" only with no query loaded; with one loaded, a strip with its name, "Versión N · vigente" and "Guardar como nueva versión". |
| Tests | `consola.test.ts` sets `nodo(escenario, 'conexion').value = 'c-1'` in about a hundred places; the fake DOM's `value` works for a select as well, so a select with the same id keeps them valid once the option exists. |

## Shape that fits (no decision needed)

- `#conexion` becomes a `select` filled from `GET /conexiones` when the Consultas screen opens and when the tenant changes (option text: the connection's name; value: its id). The choice survives within the page. No tenant or no connection: the select says so and "Ejecutar" stays as today (the server answers 400/404 legibly). DEC-11 stands: the query is still not bound to the connection.
- "Consulta nueva" in the saved-queries section: empties the editor, the parameters, the name and the description, and forgets the loaded query.

## Decision that is not mine to take

1. **What saving does while a query is loaded.**
   - (a) **Hide "Guardar consulta" while a query is loaded** (C-08): the only way to save is "Guardar como nueva versión"; to save it as a different query, "Consulta nueva" first and paste. Duplicates by accident become impossible.
   - (b) **Keep both, renamed:** "Guardar como nueva versión" stays the main action and "Guardar consulta" becomes "Guardar como consulta nueva", with a line saying it creates a separate query. A copy remains one click away, but it is still possible by mistake.

## Size
Front-end only (`src/consola.ts`, `src/consola.test.ts`) plus the `query-console` delta: ~300 lines with tests. One PR.
