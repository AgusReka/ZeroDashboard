# Exploration: CH-30d — Mapping and validation, Templates and Contract screens

Status: **decided** (2026-10-13): DEC-169, option (a) — the Mapping screen follows the one-SQL-per-entity model. Store: openspec. Fourth cut of CH-30 (DEC-166). This exploration decides nothing: the owner's decisions are registered in `docs/01-decisiones.md` before any code.

## What exists (verified)

| Piece | State |
|---|---|
| Mapping | **One SQL statement per contract entity and connection** (DEC-30 registered by the operator, not generated; DEC-32 one definition per entity). `PUT /conexiones/:id/vistas-canonicas/:entidad {sql}` creates (201) or replaces (200) and resets the entity to `no-validado` (DEC-41). `GET …/vistas-canonicas` (no SQL) and `GET …/vistas-canonicas/:entidad` (with SQL). Tenant-scoped. |
| Validation | `GET /conexiones/:id/validacion-mapeo` reads the stored report; `POST` runs a zero-row probe per entity (DEC-42) and answers `{resultado:'ok', validacionMapeo}` or, on a session failure, HTTP 200 `{resultado:'fallo', fase, categoria, codigo}`. The report: 5 entities (`obligatorio`/`opcional`, `no-mapeada`/`no-validado`/`valida`/`invalida`, per-field diagnostics with `veredicto`, `columna`, observed type and a cast hint) and 3 automations (`aplicable`/`inaplicable`/`bloqueada`/`pendiente` with every reason, DEC-46). |
| "Inaplicable" | Computed per **automation** (an optional entity not mapped), never marked by the operator; there is no reason field. |
| Contract | `GET /contrato`: static, global; entities with their fields, type, obligatoriness and the automations that use each field. |
| Templates | `GET /plantillas` (id, nombre, automatizacion, formato, tolerance; capped) and `GET /plantillas/:id` (plus `sql`, `parametros`, `entidades`). **No `descripcion`.** `POST`/`PUT` exist (used by the seed). Global. |
| Design guide | C-06 shows a **column picker per field** and an operator-marked "inaplicable" with a mandatory reason; C-03 shows a description and the required fields; C-04 matches the API. |

## Decision that is not mine to take

1. **How the Mapping screen maps.** (a) Follow the real model: per entity, the operator writes its SQL in an editor and saves it; "Validar" runs the probe and the screen shows each field's verdict, the cast hint and the automations' state with their reasons; nothing is marked inaplicable by hand. (b) The guide's column picker: the screen generates each entity's SQL from the chosen columns — contradicts DEC-30 (views are written by the operator, not generated) and needs the replica's column list, which no route returns.

The templates screen stays read-only as the guide says (create and replace remain API-only), showing the entities each template needs instead of a description that does not exist.

## Size
~900 lines with tests: two PRs (Templates and Contract; Mapping and validation).
