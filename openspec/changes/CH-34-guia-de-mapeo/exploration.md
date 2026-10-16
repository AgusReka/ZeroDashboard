# Exploration: CH-34 — A step-by-step guide and an example SQL per entity on the Mapping screen

Status: **decided** (2026-10-16): D1 (a) new DEC-176 narrowing DEC-30, D2 (a) fixed food_store example, D3 (b) copy into an empty editor. No research phase. Store: openspec. Origin: the open items of the CH-33 archive report ("CH-34 (proposed 2026-10-15): a step-by-step and an example SQL per entity on the Mapping screen"). Front end only: no route, no migration, no engine change.

## What exists (verified)

| Piece | State |
|---|---|
| DEC-30 | `docs/01-decisiones.md:547`. Views are **registered, written by the operator**, not generated. "Se resigna": the alta requires knowing SQL and the source data model; **"No hay asistencia para escribir las vistas."** Writing them is the adaptation cost the thesis measures (CH-15, CH-16). |
| DEC-32 | `docs/01-decisiones.md:587`. One self-contained definition per canonical entity, keyed by the contract name. |
| DEC-169 | `docs/01-decisiones.md:3066`. CH-30d screen: one SQL editor per entity, «Guardar», «Validar»; no column picker, no generator. "Mapear exige escribir SQL … la pantalla lo hace visible y validable, no lo simplifica." |
| Screen markup | `src/consola.ts:468-492` (`#pantalla-mapeo`). The only help is the page description at `:473`. Editors start empty; no placeholder, no example, no steps. |
| Screen script | `src/consola.ts:4531-4718`. `bloqueDeEntidad` (`:4586`) builds per entity: `h3`, state `p`, `textarea`, «Guardar», diagnostics `ul`. `cargarPantallaMapeo` (`:4670`) fetches `GET /contrato`, the views and the last report. |
| Contract | `src/contrato.ts:91-299`. Five entities in order: `producto`, `pedido`, `item_pedido` (required), `insumo`, `receta_componente` (optional). Semantic types `texto|numero|booleano|fecha|identificador`. camelCase fields must be double-quoted aliases (`:26-30`). Served by `GET /contrato`. |
| Validation | `src/validacion-mapeo.ts:182` (`diagnosticar`): verdicts `ok|ausente|tipo-incorrecto|alias-sin-comillas|duplicada`, cast hint (DEC-45), extra columns. The probe reads zero rows (`LIMIT 0`). PUT only checks non-empty SQL. |
| Real mapping SQL in repo | `docker/replica-demo/01-esquema-y-datos.sql:579-645`: the five `v_*` views over the food_store schema (casts `::text` for ids, `NULL::text AS sku`, a `CASE` on `estado_pedido.codigo`, joins for `receta_componente`). CH-16b/c/d hold Food Store, Medusa, Woo and Saleor views as `CREATE VIEW` files. `src/semilla-demo.ts:273-290` registers only `SELECT * FROM v_<entidad>`. |
| Console guards | `src/consola.test.ts`: `IDS` (`:148-220`), `IDS_GUARDADOS`/`verificarIds` (`:374-377`, every id exactly once), `IDS_OCULTOS` (`:367`), G3' (`:590`: no new `zd-*` token in the script). Static guide text belongs in markup; script-built nodes use plain elements and the `ayuda` class; everything is written as text. |
| Spec | `openspec/specs/query-console/spec.md:828` "Mapping and Validation Screen". |
| Tests | `src/consola.test.ts:3890-4030` (Mapeo helpers and tests). |

## The architecture flag

CH-34 adds, by definition, assistance to write the views — exactly what DEC-30 resigned ("No hay asistencia para escribir las vistas"). Per `AGENTS.md`, this is a decision that must be recorded in `docs/01-decisiones.md` (a new DEC that extends or revises DEC-30's resignation) **before** proposal. The agent does not decide it.

What stays true under any option: the operator still writes and saves each SELECT (DEC-30, DEC-169); nothing reads the client's replica to build SQL; no route, no engine change; the CH-16 experiment hours are already recorded, so the help affects only future altas (CH-15 timing marks remain comparable only among altas made with the same help — worth one line in the DEC).

## Open decisions

**D1 — Record the help as a new DEC that extends DEC-30.**
- (a) New DEC: the Mapping screen shows a static step-by-step and one example per entity; DEC-30's model holds (registered views, written by the operator, no generator, no column picker); only its "no assistance" resignation is narrowed to "no generated assistance". **Recommended.**
- (b) Do not record; drop CH-34. DEC-30 stays as is.

**D2 — Where each entity's example comes from.**
- (a) A fixed example per entity, the food_store demo replica's views rewritten as plain SELECTs (real tables, real casts, a `CASE`, joins). Concrete and runnable against the demo; it hard-codes a foreign schema in the console and must be kept in sync with the contract by a test.
- (b) A skeleton built in the browser from `GET /contrato`: one line per field with its exact quoted alias and a cast for its semantic type over placeholder columns (`/* columna */`), `FROM tabla_origen`. Never drifts from the contract and teaches the two common failures (alias without quotes, wrong type); it does not run as is and shows no joins.
- (c) Both: the contract skeleton, plus the food_store example as a second, collapsible reference.

**D3 — What the operator can do with the example.**
- (a) Read only (shown under the editor, collapsible). Nothing reaches the editor without the operator copying it.
- (b) A «Usar de punto de partida» button that copies it into the editor **only when the editor is empty**; it never saves. Faster; the saved SQL is still the operator's after editing. **Recommended with D2 (b)**, since a skeleton that does not run forces editing before «Guardar».

## Shape that fits (no decision needed)

- **Step-by-step.** Static markup in `#pantalla-mapeo`, above `#mapeo-entidades`, in a `<details>` (open while no entity is mapped is a nice-to-have, not required): 1) choose the connection, 2) per entity, write one SELECT over the replica whose columns are named exactly like the contract fields (camelCase in double quotes) with the contract types, 3) «Guardar» each entity, 4) «Validar mapeo» and read each field's verdict and cast hint, 5) the automations table says which ones the mapping enables and why. Optional entities can stay unmapped. Copy follows `guidelines/lenguaje.md`.
- **Per-entity example.** Built inside `bloqueDeEntidad`, as plain elements with the `ayuda` class (G3'), written with `textContent`. One new static id at most per markup node; ids registered in `IDS`.
- **Specs.** Modify `query-console` "Mapping and Validation Screen" (guide + example per entity, D3 behaviour). `docs/02-mapa-de-changes.md` gains the CH-34 row; `docs/01-decisiones.md` gains the DEC from D1. `guidelines/pantallas.md` C-08 note, if the design skill is updated.
- **Out of scope.** Generating SQL from the tenant's columns, listing replica columns, marking entities inapplicable, any route or engine change.

## Affected files

`docs/01-decisiones.md`, `docs/02-mapa-de-changes.md`, `src/consola.ts` (markup `:468-492`, script `:4586`), `src/consola.test.ts` (ids, Mapeo tests), `openspec/specs/query-console/spec.md` (via delta). If D2 (a)/(c): a test that each fixed example aliases every contract field of its entity.

## Size

~150–250 changed lines (markup ~30, script ~60–90, tests ~60–100, docs ~30). One PR.

## Suggested name

`CH-34-guia-de-mapeo`.
