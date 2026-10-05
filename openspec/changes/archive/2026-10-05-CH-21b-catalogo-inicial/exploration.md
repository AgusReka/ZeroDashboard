# Exploration: CH-21b Initial template catalog (stock fisico, stock producible, reporte diario; D3)

Date: 2026-10-05. Next free DEC is DEC-125 (last registered entry is DEC-124, `docs/01-decisiones.md:2247-2266`). The decisions listed below must be registered BEFORE implementing. They are the user's (`AGENTS.md`, "Decisiones de arquitectura").

## Headline findings

1. The catalog is EMPTY today. The mechanism exists (CH-12), but no real `Plantilla` row or code definition of the three templates exists anywhere in the repo. A fresh install shows an empty selector in the console.
2. Two of three templates have verified canonical SQL: stock fisico (CH-16d `11_`) and stock producible (CH-16b `04_`). `reporte-diario` has none on master and cannot be verified from this tree.
3. `stock-fisico`'s verified query reads `v_receta_componente`, an OPTIONAL entity that the contract does not tag for `stock-fisico`. A template declaring it will return 409 on a tenant that never mapped recipes, while M4 says `stock-fisico` is `aplicable`. This is a decision, not a detail.
4. C-12 fields `descripcion` and `icono` do not exist in the model. `campos_requeridos` and "disabled with reason" are derivable from existing data. CH-21b can ship with ZERO schema change.
5. The slice is not empty (SQL authoring, a delivery mechanism, 3-4 DECs) but it is small, about 300 authored lines for the recommended option. Recommendation: keep it separate from CH-21c.

## Current state

**What the catalog contains today: nothing as data**
- Model: `Plantilla` (`prisma/schema.prisma:122-132`) has `id` uuid, `nombre`, `sql`, `parametros` JSON default `[]`, `entidades` JSON, `automatizacion`, `formato` and `toleranciaFrescuraMinutos` Int. There is no description, icon or timestamp.
- Migration `prisma/migrations/20260927100000_plantilla/migration.sql:10-21` creates the table and nothing else. A grep of `prisma/` for `INSERT` returns no match.
- Seed: `prisma/seed.ts:23-35` creates only the `Tenant` "Food Store". It returns early at `:24-28` when any tenant exists. It describes itself as "a convenience, not a precondition" (`:15-22`).
- Delivery: `docker-entrypoint.sh:4-5` runs `prisma migrate deploy` and then `tsx prisma/seed.ts` on EVERY container start, then the server. The seed imports the Prisma client from `../dist/generated/prisma/client.js` (`seed.ts:2`). `tsconfig` includes only `src`, so `seed.ts` is not type-checked.
- Nothing in `scripts/` touches `/plantillas`. Test fixtures use throwaway bodies (`src/plantillas-rutas.test.ts:20-28`), cleaned by name prefix.
- Creation paths today: only `POST /plantillas` (`src/plantillas-rutas.ts:176-190`) and `PUT /plantillas/:id` (`:226-248`, in-place replace, DEC-68, no delete). Both are manual, by the operator.
- The console already consumes the catalog: selector `#auto-plantilla` (`src/consola.ts:186-189`), `cargarCatalogoPlantillas()` calls `GET /plantillas` (`:1131-1146`), `elegirPlantilla()` calls `GET /plantillas/:id` (`:1152-1170`). Once rows exist, the current console can already create an automation from them (C-10), before CH-21c.

**The mechanism (CH-12, CH-13, CH-14)**
- Save-time checks: a strict AJV body (`plantillas-rutas.ts:60-100`), a blank-SQL guard and the CH-11 parameter rules (`src/plantillas.ts:140-143`). Parameter types are `texto|numero|booleano|fecha` (`src/parametros.ts:239`). Every declared parameter is required, with no defaults (DEC-50). Values travel only as driver binds, through `prepararSentencia`.
- Composition: `componerSentencia` builds `WITH v_<entidad> AS (...) SELECT * FROM (<template>) AS _plantilla` (`plantillas.ts:120-131`). The gate `evaluarVistas` requires every DECLARED entity to have a saved `valida` view on the connection (`:85-102`, DEC-71). The same gate runs on scheduled runs (`src/planificador.ts:226-237`).
- The engine reads only `sql`, `parametros`, `entidades`, `nombre` and `automatizacion` from a template (`planificador.ts:194-200`, `:418-424`). It reads neither description, icon nor tolerance (DEC-66: stored, never enforced).
- Email: `nombre` becomes the subject and title bar. `automatizacion` picks the accent and emoji (`src/correo.ts:123-127,149-163,315`). Table headers are the raw SQL column names (`correo.ts:307`). Zero rows means no send (DEC-84), and one run produces one table (DEC-85).

**Per target template**

| Template | Row or code in repo | Verified query material | Parameters | Condition | Status |
|---|---|---|---|---|---|
| `stock-fisico` | None | `openspec/changes/CH-16d-segunda-automatizacion-y-with/sql/11_consulta_canonica_stock_fisico.sql:7-12`: active products without recipe, `stockDisponible <= 20` hardcoded, ascending. Equivalence with the original WF-01a verified on real Food Store (`docs/bitacora/bitacora_CH-16d.md:25-26`) | none declared (`20` is a literal) | the `WHERE` clause (DEC-64) | SQL verified; template not written |
| `stock-producible` | None | `openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql:8-22`; WITH form on Food Store and Medusa in `13_*` (CH-16d t5). It has NO threshold: the original WF-01c `HAVING ... <= 10` was removed for comparison (`02_query_original.sql:2-3`) | none declared | the template must add `HAVING FLOOR(MIN(...)) <= :umbral` | SQL verified without the threshold |
| `reporte-diario` | None | None canonical. `docs/01-decisiones.md:539` (DEC-29) and DEC-69 (`:1253-1267`) say it has no implementation and was left for "D3/CH-21". `docs/estado_prototipo_2026-09-24.md:131` agrees | n/a | n/a | not implemented, not verified |

The contract tags already exist for all three labels (`src/contrato.ts:43-47`, `AUTOMATIZACIONES`), and `correo.ts:123-127` already has a theme per label.

## Constraints discovered

1. **stock-fisico vs the contract.** The verified query's `NOT EXISTS (... v_receta_componente ...)` (`11_...sql:11`) needs the entity `receta_componente`. In `src/contrato.ts:272-299` that entity is OPTIONAL and its fields are tagged only `STOCK_PRODUCIBLE`. M4 computes applicability per automation LABEL from field tags (`src/validacion-mapeo.ts:353-354`), so `stock-fisico` is reported `aplicable`. A template must declare the entity (DEC-63); the gate (`plantillas.ts:85-102`) then answers `409 vista-canonica-no-aprobada` (or a run `rechazo`) for any connection without a valid `receta_componente` view. Precedent for this class of mismatch is DEC-36. Neither fix is neutral: tagging the field `STOCK_FISICO` would make an unmapped optional entity render `stock-fisico` `inaplicable` (`validacion-mapeo.ts:364-368`); dropping the clause changes the validated semantics.
2. **No relative-date parameter for a daily report.** Parameters are declared once per template and values stored once per automation (`planificador.ts:181-191`); all are required (DEC-50) and the vocabulary has no "yesterday". A daily report must compute the window in SQL (for example `CURRENT_DATE`), which raises the replica session time zone versus the app zone (DEC-77) and the type of `pedido.fechaCreacion`. Adding a default or relative parameter would extend the engine (rule 6), so it is not an option.
3. **Daily report vs "no rows, no send".** The original WF-03 sent an empty-day report with zeros (`docs/bitacora/estudio_previo/bitacora_WF-03_reportes.md:162`), built from three queries (`:75-116`). DEC-84 chose X3 literal and DEC-85 states that multi-section reports are not reproduced (`docs/01-decisiones.md:1545,1563`). An honest canonical `reporte-diario` is ONE table per run, and an empty day sends nothing.
4. **`pedido` and `item_pedido` have no verified views anywhere on master.** `03_vistas_foodstore.sql:16-43` defines only `v_producto`, `v_insumo` and `v_receta_componente`. `docs/bitacora/matriz_correspondencias.md:73-100` lists Food Store, WooCommerce and Saleor as "sin vista" for every `pedido`/`item_pedido` field. Medusa has the views, but `total` is deliberately omitted and Medusa seeds no orders (`docs/bitacora/CH-16-mapeo-del-segundo-esquema.md:36,53`). The Food Store fixture has only `product`, `ingredient` and `product_ingredient`.
5. **The reporte-diario experiment is not on master.** `docs/bitacora/bitacora_estado_repo_tesis.md:139-157` states that `experimento/reporte-diario` (`0e80098`) was never merged. It holds `v_pedido_foodstore.sql`, `v_pedido_saleor.sql` and `docs/bitacora/bitacora_reporte_diario.md`, whose "proposed" DEC-39 to DEC-44 (`:379-389`) COLLIDE with master's DEC-39 to DEC-44. It could not be read in this exploration.
6. **Contract fields for `reporte-diario`** (`?` optional): `producto.{id,nombre,stockDisponible,sku?}`, `pedido.{id,fechaCreacion,estado,total,numero?,moneda?}`, `item_pedido.{id,pedidoId,productoId,cantidad,precioUnitario?}`. Per DEC-29 (`:539`) the obligatory ones were never checked against real code.
7. **Seed vs operator edits.** DEC-68 makes `PUT` the operator's iteration path, with no versioning. A seed that overwrites would destroy operator edits; a create-if-absent seed never propagates later fixes.
8. **Seed placement.** `seed.ts` runs from `prisma/` against `dist/`. Testable catalog code must live in `src/` (the only tsconfig root), and `seed.ts` becomes a thin caller.

## Gap analysis against D3 and C-12 (`pantallas.md:71-73`)

| C-12 field | Today | Gap | Kind |
|---|---|---|---|
| `id` | `Plantilla.id` uuid | seeded rows need stable ids to be idempotent | data (seed) |
| `nombre` | `Plantilla.nombre` | flows to every email subject and title (`correo.ts:149-163`). Skill names: "Alerta de stock físico", "Alerta de stock producible", "Reporte diario" | data (seed) |
| `descripcion` | absent | new. Panel P-02 needs business-language copy, different from console copy | schema + API if stored; or a code map keyed by label like `TEMAS` |
| `icono` | absent | new. Skill icons: package, boxes, file-text | same |
| `tolerancia_frescura` (min) | `toleranciaFrescuraMinutos`, already in the list projection | only values missing; repo has no source (mock uses 60 and "2 h"). Enforcement is CH-24 | data (seed) |
| `campos_requeridos` | absent as a field | derivable at read time from contract fields tagged with the label (`GET /contrato`) or from `entidades` | none |
| disabled with reason | not stored | derivable per connection: M4 report by label or the DEC-71 gate by the template's entities. They disagree for `stock-fisico` (constraint 1). The UI is CH-21c | none for CH-21b |

Not part of CH-21b: C-13 email format per template (N3), frequency-plus-hour to cron (DEC-76), freshness enforcement (CH-24).

## Isolation and rules

- `Plantilla` is GLOBAL: absent from `MODELOS_AISLADOS` (`src/aislamiento-prisma.ts:35-42`). The four catalog routes are exempt by exact method and pattern (`src/contexto-tenant.ts:124-129,154`). `POST /plantillas/:id/prueba` is NOT exempt.
- Rule 2: the catalog holds operator SQL with `:marker` placeholders and no tenant data; execution is always bound to a tenant. A seeded global row cannot return another tenant's data.
- Rules 1, 3, 4: seeded SQL is only SELECT and `:umbral`; values go through `prepararSentencia`; execution is the READ ONLY pipeline. Rule 5: only contract fields, no personal data. Rule 7: no secrets in the seed. Rule 6: no engine change for `stock-fisico` or `stock-producible`; for `reporte-diario` the engine limits are documented limits, not features to add.
- Pre-existing, not introduced here: catalog writes and `GET /plantillas/:id` (which returns `sql`) are exempt and unauthenticated (`docs/bitacora/CH-12-plantillas-de-automatizacion.md:62`). CH-22b must never call the by-id route from the panel (rule 1).

## Dependencies

- CH-21c (two-step creation, D2/N3) needs the rows to exist, `automatizacion`, `parametros` and `entidades`, description and icon copy, and a way to show a template disabled with reason. Nothing else from CH-21b.
- The parameter name `umbral` (type `numero`) is the shared interface for CH-21c (C-11), CH-23 (P-04) and the panel. Use `umbral` in both stock templates.
- CH-22b needs title, description and tolerance in business language (`pantallas.md:123`): a reason not to add console-language columns in CH-21b.
- CH-24 enforces tolerance (F2). CH-21b only seeds values.

## Approaches

**A. What to ship**

| # | Approach | Fresh install has catalog | Verified against real data | Schema change | Effort |
|---|---|---|---|---|---|
| A1 | Docs only: DECs plus documented POST bodies; merges with CH-21c | No (manual) | n/a | none | Low |
| A2 | Two verified templates (`stock-fisico`, `stock-producible`) seeded; `reporte-diario` documented as an artifact limit | Yes, 2 of 3 | SQL yes (CH-16b/16d); through the real composition path only at apply | none | Medium (~300 lines) |
| A3 | All three, with an honest single-block `reporte-diario` | Yes, 3 of 3 | No: needs `v_pedido`/`v_item_pedido` for Food Store, the `pedido.estado` vocabulary, timezone and currency; evidence is on an unmerged branch | none, but 4+ more DECs | High, over 400 |
| A4 | Seed a stub or failing `reporte-diario` row | Yes | No | none | Rejected: a row that cannot run is dishonest and the model has no "disabled" flag |

**B. How the catalog reaches a fresh install**

| # | Mechanism | Fresh install | Existing rows | Operator edits (DEC-68) | Notes |
|---|---|---|---|---|---|
| B1 | Create-if-absent seed, fixed ids, from a `src/` module called by `prisma/seed.ts` | Yes | not updated | preserved | Follows the `Tenant` seed precedent; the seed's early return must be restructured |
| B2 | Data migration `INSERT ... ON CONFLICT DO NOTHING` | Yes | immutable once applied | preserved | Heavier to change; may pollute the test DB (not verified) |
| B3 | Boot-time upsert in `server.ts` | Yes | propagates | OVERWRITES operator edits (conflicts with DEC-68) | New server write path to a global table |
| B4 | Documented POST bodies only | No | n/a | n/a | Leaves the demo with an empty selector |

**C. Presentation fields**: C1 not in CH-21b (first consumer, CH-21c, decides; console copy as a code map keyed by label); C2 additive migration with nullable `descripcion` and `icono` (schema and API change, console and panel copy likely differ).

## Recommendation (the decision is the user's)

**A2 + B1 + C1**, with `stock-fisico` keeping the verified `NOT EXISTS` and declaring `entidades: ['producto','receta_componente']` (D3, option b).

1. New `src/catalogo-inicial.ts`: a closed list of two entries (fixed id, `nombre`, `sql`, `parametros: [{ nombre: 'umbral', tipo: 'numero' }]`, `entidades`, `automatizacion`, `formato: 'correo-html'`, `toleranciaFrescuraMinutos`) and `sembrarCatalogoInicial(...)` that creates a row only when its id is absent and never overwrites.
2. `prisma/seed.ts` calls it independently of the tenant early return.
3. SQL: `stock-fisico` is `11_` with `<= :umbral`; `stock-producible` is `04_` with `HAVING FLOOR(MIN(...)) <= :umbral`. Both written against `v_<entidad>` aliases only (DEC-70). Business-readable column aliases are decided at design time, because email headers are raw column names.
4. Tests: every entry passes the same save-time checks as `POST /plantillas`; `componerSentencia` plus `prepararSentencia` succeed with a sample `umbral`; seeding twice yields exactly 2 rows; a `PUT`-edited row survives a second seed; optionally run the composed text against a miniature of the Food Store fixture.
5. `reporte-diario` is documented in the DEC as an artifact limit with the reasons from constraints 2 to 5; the unmerged branch is recorded as a lead.
6. Do NOT add columns, a `GET` field, a disabled flag, tolerance enforcement or any engine capability.

Merge with CH-21c? The map's criterion ("nearly empty") does not hold for A2; keep it separate. Merge only if A1 is picked (then the DECs become CH-21c's PR0).

## Scope and size estimate (estimates, not measured)

| PR | Content | Est. lines |
|---|---|---|
| PR0 | DEC-125 to DEC-128 in `docs/01-decisiones.md` (docs PR) | ~80-100 |
| PR1 | `src/catalogo-inicial.ts` (~110), `prisma/seed.ts` (~25), `src/catalogo-inicial.test.ts` (~150, with the 1.7 test multiplier), smoke check (~5) | ~290-320 |

Forecast: Decision needed before apply: Yes. Chained PRs recommended: Yes (PR0 docs, PR1 code). 400-line budget risk: Low for A2, High for A3.

## Risks

- **stock-fisico gate mismatch** (constraint 1): a tenant without recipes gets 409 or `rechazo` on a template M4 calls applicable. CH-21c's "disabled with reason" must derive from the template's own entities.
- **Unverified composition path**: the nested form `SELECT * FROM (<tpl>) AS _plantilla` with the new `:umbral` was not run on real data; `ORDER BY` inside the subquery is not guaranteed to survive the outer `SELECT *`.
- **Email headers** are raw column names (`stockDisponible`); the alias choice affects what P2 reads.
- **The seed never updates**: later fixes need a manual `PUT` or a DEC about versioned sync.
- **Seeded rows are editable by anyone** with API access (pre-existing).
- **DEC number collision** if the unmerged branch's "DEC-39 to DEC-44" proposals are reused; renumber from DEC-125 when porting.
- **Tolerance values** are placeholders unless the user chooses them.
- Untracked stray files at the repo root (`peticion.tenant`, `texto.includes('null')`) look like shell-quoting artifacts logged in `docs/bitacora/CH-12-plantillas-de-automatizacion.md:50`; keep them out of commits.

## Open decisions (all the user's)

1. **D1 Delivery mechanism.** Recommended B1: create-if-absent seed, fixed ids, never overwrite.
2. **D2 Scope.** Recommended A2: `reporte-diario` out, documented as an artifact limit. Alternative A3 requires first reading the unmerged experiment and registering its decisions anew from DEC-129.
3. **D3 stock-fisico and `receta_componente`.** (a) tag `receta_componente.productoId` also for `STOCK_FISICO` (makes `stock-fisico` inapplicable for tenants without recipes); (b) keep the verified query, declare the entity, document that `stock-fisico` needs the entity mapped (an empty view is a valid mapping for a tenant without recipes); (c) drop the `NOT EXISTS` (changes validated semantics). Recommended: (b).
4. **D4 Presentation fields and tolerance values.** Recommended C1. Tolerance values are the user's choice; the mock suggests 60 and 120 minutes.
5. **Names and email column aliases** for the two seeded templates (design-time copy).

## Draft DECs (proposals, not decisions; Spanish as the decisions file uses)

- **DEC-125** the initial catalog reaches a fresh install through a create-if-absent seed (options a to d; proposal a).
- **DEC-126** `reporte-diario` stays out of the initial catalog and is documented as an artifact limit (options a, b; proposal a).
- **DEC-127** `stock-fisico` keeps the exclusion of products with recipe and declares `receta_componente` (options a to c; proposal b).
- **DEC-128** description, icon and tolerance values (options a, b; proposal a, tolerance values chosen by the user).

(Full draft text, with Contexto, Opciones, Se resigna and Estado, is in the exploration result persisted in Engram `sdd/CH-21b-catalogo-inicial/explore`, observation 237; it is re-derived from this document when the user decides.)

## Not verified

- Contents of `experimento/reporte-diario` and of the real Food Store database.
- Running the seeded SQL through `componerSentencia`, `prepararSentencia` and `ejecutarConsulta` on Postgres.
- Whether `CURRENT_DATE` and the replica session time zone behave as the daily window would need.
- How the test database is built (relevant only for option B2), and `ORDER BY` preservation through the nested subquery.
- Size figures, which are forecasts.

## Ready for Proposal

Not yet. The user must answer D1 to D3 (D4 can follow the recommendation). DEC-125 to DEC-128 must be registered in `docs/01-decisiones.md` before `sdd-propose` (`AGENTS.md`).
