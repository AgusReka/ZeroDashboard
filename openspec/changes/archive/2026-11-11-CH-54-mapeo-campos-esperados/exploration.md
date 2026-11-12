# Exploration: CH-54 — Mapping with expected fields

Source: the console UX audit (EXPLORE, 2026-11-11), `guidelines/admin.md` §13 Mapeo, W8, E6, §12, and `src/mapeo/validacion-mapeo.ts`. `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)

**The screen** (L995, JS L7197) has:
- a «Conexión» select;
- one `<textarea>` per contract entity (producto, pedido, item_pedido, insumo, receta_componente), **without** `<label>` or `aria-label` (L7277);
- a «Guardar mapeo» button per entity;
- a `<details>` "Ejemplo sobre la réplica de demo (food_store)" with «Usar de punto de partida»;
- «Validar mapeo» in the header and a collapsible "Cómo mapear" guide;
- an automation availability table.

**Endpoints:**
- `GET`/`PUT /conexiones/:id/vistas-canonicas[/:entidad]` (`src/mapeo/vistas-canonicas.ts:139, 199, 216`);
- `GET`/`POST /conexiones/:id/validacion-mapeo` (`src/mapeo/validacion-mapeo-rutas.ts:65, 150`).

**What the validation report already returns** (`InformeValidacion`, `validacion-mapeo.ts:349`):
- Per entity: `obligatoriedad`, `estado` (`no-mapeada` | `no-validado` | `valida` | `invalida`), `validadaEn`, and `diagnostico`.
- `diagnostico` holds the probe result plus one `DiagnosticoCampo` per field: `campo`, `tipoEsperado`, `columna`, `veredicto` (`ok`, `ausente`, `tipo-incorrecto`, `alias-sin-comillas`, `duplicada`), the observed type and a cast hint.
- Per automation: `estado` plus `motivos` (entity, field, reason).

**What the screen shows and does not show:**
- The screen renders field diagnostics as a plain `<ul>`.
- It does **not** show the expected fields before validating. They live in Contrato canónico (`GET /contrato`), another screen.
- There is **no** endpoint to run one entity's SELECT and look at its rows. Validation probes every view of the connection.

## Hypotheses
- Operators go back and forth to Contrato canónico while writing each SELECT.

## Open questions
- A per-entity "Probar SELECT" with a result preview (as in admin.md §13's sketch) would need a new endpoint or reuse of `POST /consultas/ejecutar`, and the latter does not run over views. It is **not** proposed here: it would be a new capability. If wanted, it is a separate decision.
