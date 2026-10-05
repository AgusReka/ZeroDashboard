# Design: CH-21b — Initial Template Catalog (stock fisico, stock producible; D3)

## Technical Approach

This design implements DEC-125 (a), DEC-126 (a), DEC-127 (b) and DEC-128 (a) in one code PR (PR1). PR0 (the DECs) is already committed. It implements the `initial-template-catalog` spec.

- **Module.** A new `src/catalogo-inicial.ts` holds a closed, frozen list of two entries with fixed literal ids. It also exports `sembrarCatalogoInicial(delegado)`. The seeder validates every entry with the route's own functions and then writes all absent rows in **one** `createMany({ skipDuplicates: true })`, which runs as `INSERT ... ON CONFLICT DO NOTHING`. It never reads, updates or deletes a row.
- **Seed.** `prisma/seed.ts` stays a thin caller. The tenant step keeps its early return inside its own function. The catalog step runs after it on every boot.
- **No other changes.** There is no schema, migration, route or engine change (rule 6). `src/plantillas*.ts`, `parametros.ts`, `consulta-ejecucion.ts`, `planificador.ts` and `correo.ts` are not modified.

## Architecture Decisions (design-level, inside DEC-125..128)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Fixed ids | `stock-fisico` = `21b00000-0000-4000-8000-000000000001`. `stock-producible` = `21b00000-0000-4000-8000-000000000002` | Random v4 literals | These are valid UUID text (version nibble 4, variant 8), the same shape as `@default(uuid())`. They are easy to recognize in smoke greps, logs and the rollback SQL. `id` is `text`, so nothing parses them |
| Names | `Alerta de stock físico`, `Alerta de stock producible` | Console-style names | These are the C-12 names in the design skill (`pantallas.md:73`). `nombre` becomes the email subject and title (`correo.ts:149-163`), so it must read as business language |
| Write primitive | `createMany({ data, skipDuplicates: true })` with a returned `count` | `findUnique` + `create` per entry | One statement. Two concurrent boots cannot race into a P2002 that aborts the container. `id` is the only unique key on `Plantilla` (`schema.prisma:122-132`), so the conflict target is exactly "id present". The statement never touches an existing row, which satisfies DEC-68 and the "edit survives" scenario |
| Delegate type | A narrow `DelegadoSiembra` interface with only `createMany`. A `tsc` signature pin in the test proves the real `PrismaClient['plantilla']` satisfies it | Passing the full client | This follows the `firmaSoloDelegado` pattern (`plantillas-rutas.test.ts:42-45`). The seeder can reach no tenant-scoped model, and a fake is trivial |
| Runtime validation | Before any write, each entry goes through `rechazoDeEntrada`. That function first applies the strict-body clause **at runtime**: the entry's keys minus `id` must equal the `PlantillaCompleta` keys minus `id`. An extra key is reported as `campos: ['/<key>']`, the same way the route reports `/tenantId`, and a missing key is reported the same way. It does not rely on the `EntradaCatalogo` type alone, because a type does not stop a spread from adding a key. U1 also asserts the key set. The check is slightly stricter than the route, which accepts a body without `parametros`, but every catalog entry declares `parametros` anyway. It then checks the AJV-owned fields against the **same constants** the schema enumerates (`ENTIDADES_CANONICAS`, `VALORES_AUTOMATIZACION`, `FORMATOS`, non-empty unique `entidades`, integer `toleranciaFrescuraMinutos >= 0`). It then calls `rechazoDePlantilla(undefined, entrada)` unchanged (blank SQL plus the CH-11 rules). It returns the route's envelope (`campos`, `rechazados`, `problemas`). If any entry fails, the seeder throws `Error('catálogo inicial: <id> rechazada: <envelope JSON>')` and writes nothing | Adding `ajv` as a direct dependency; building a Fastify instance inside the seed | Fastify owns AJV and is not reachable outside a route. The test proves exact parity (test U2): each entry gets 201 through the real `POST /plantillas`, and the two broken samples are rejected by both paths with the same `campos`. The list is compile-time content, so this is defense in depth |
| Test seam | `sembrarCatalogoInicial(delegado, catalogo = CATALOGO_INICIAL)` | Live tests on the real fixed ids | `TEST_DB_*` defaults to the same `zerodashboard` database the Compose stack uses. Deleting the real ids would remove a developer's seeded rows, and `Automatizacion_plantillaId_fkey` is `RESTRICT`. Live tests use per-run random ids and delete only those. The production caller passes no second argument |
| Seed failure | **Keep the current contract.** `main()` rejects, `seed.ts` sets `exitCode = 1`, `docker-entrypoint.sh` (`set -e`) stops before `exec node`, and the container does not start. `docker-entrypoint.sh` is unchanged | Catch and log, then boot anyway | After a successful `migrate deploy`, a catalog failure means the DB is gone or a catalog entry fails its own checks (a code defect that U1-U3 catch). Failing loudly is the mitigation for the proposal's "selector silently empty" risk. A soft failure would change the seed's failure contract, and that would need a DEC |
| Column aliases | Quoted Spanish aliases in sentence case, and no `id` column. `stock-fisico`: `"Producto"`, `"Stock disponible"`. `stock-producible`: `"Producto"`, `"Stock producible"`, `"Insumo limitante"`, `"Stock del insumo limitante"` | Raw names (`stockDisponible`, `stock_producible`) | Email headers are raw column names (`correo.ts:307`). The readers are business users, and `lenguaje.md:23` limits `id` to the console. The row set is unchanged. `id` stays in `ORDER BY` as a tiebreaker |
| Numeric binding | `stock-fisico` compares `pr."stockDisponible"::numeric <= :umbral` | Bare `<= :umbral` | `numero` accepts any finite number (`parametros.ts:378`). Against an `integer` column PostgreSQL types `$1` as integer, so `umbral = 7.5` would fail with 22P02. `stock-producible` already compares a `numeric` aggregate. The cast widens the type without changing the rows |
| ORDER BY | Keep `ORDER BY` inside the template and make it total (tiebreakers `nombre`, `id`). Pin the behavior with a live test through the exact executed text. See "Order through nesting" | Documenting "no order" up front; an outer `ORDER BY` (engine change, rule 6) | Order matters under the row ceiling: the `LIMIT` of `sentenciaPaginada` keeps the first rows, so the email shows the most urgent products |

**Entries with an existing fixed id but changed or invalid content** are left untouched. The seeder never reads them. Each run re-checks the stored declaration (DEC-73), so a broken row is rejected at run time, never repaired.

## Needs User Decision

None. Each choice above stays inside DEC-125..128 or follows an existing contract:

- The fixed ids, names and aliases are the design-time copy the proposal left open.
- The seed failure policy keeps `docker-entrypoint.sh` and the seed's existing failure contract (a soft failure would need a DEC).
- `::numeric`, the tiebreakers, the dropped `id` column and the aliases leave the verified row sets unchanged (DEC-127 keeps the `NOT EXISTS`). The user may still object; see "SQL deltas vs the verified originals".
- Relying on the ORDER BY behavior needs no engine change.

If the user prefers to keep an `id` column in the email, they can add it back in the SQL, and nothing else depends on it.

## Template Contents

| Field | `stock-fisico` | `stock-producible` |
|---|---|---|
| `entidades` | `['producto','receta_componente']` (DEC-127) | `['producto','insumo','receta_componente']` (contract order) |
| `parametros` | `[{ nombre: 'umbral', tipo: 'numero' }]` | same |
| `automatizacion` / `formato` | `stock-fisico` / `correo-html` | `stock-producible` / `correo-html` |
| `toleranciaFrescuraMinutos` | 60 (DEC-128, provisional) | 120 |

```sql
-- stock-fisico (CH-16d 11_, threshold parameterized)
SELECT
  pr.nombre AS "Producto",
  pr."stockDisponible" AS "Stock disponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible"::numeric <= :umbral
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC, pr.nombre ASC, pr.id ASC
```

```sql
-- stock-producible (CH-16b 04_ + HAVING threshold)
SELECT
  pr.nombre AS "Producto",
  FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS "Stock producible",
  (ARRAY_AGG(ins.nombre
     ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS "Insumo limitante",
  (ARRAY_AGG(ins."stockDisponible"
     ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS "Stock del insumo limitante"
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
HAVING FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) <= :umbral
ORDER BY "Stock producible" ASC, pr.nombre ASC, pr.id ASC
```

Notes on the SQL:

- Neither statement has a trailing `;` or comments, so the stored text is exactly what the console editor shows.
- `HAVING` repeats the expression because PostgreSQL does not allow output aliases there.
- The added `ins.id` tiebreaker makes both `ARRAY_AGG`s pick the **same** limiting ingredient on ties. Without it, the name and the stock could come from different ingredients.
- The scanner skips the quoted aliases. `:umbral::numeric` does not occur, because the cast sits on the column.

### SQL deltas vs the verified originals (`11_`, `04_`)

| Delta | Template | Effect on rows |
|---|---|---|
| `:umbral` replaces the literal `20` (`11_`); `HAVING ... <= :umbral` added (`04_`) | both | The threshold is required by DEC-127 and DEC-128 |
| `"stockDisponible"::numeric` on the comparison | `stock-fisico` | None for integer or numeric columns; it only types `$1` as numeric |
| `ins.id ASC` tiebreaker in both `ARRAY_AGG ... ORDER BY` | `stock-producible` | None on the row set; it fixes which ingredient is reported on a tie |
| `nombre`, `id` tiebreakers in the final `ORDER BY` | both | None on the row set; the order becomes total |
| `id` column dropped; columns renamed to Spanish aliases | both | None on the row set; only the projection changes |
| No trailing `;` and no comments | both | None |

DEC-127 says the verified query is "kept". This design reads that as keeping its **semantics**: the row set, including the exclusion of products that have a recipe, is unchanged. The literal text is not kept. C1 and C2 prove the row sets on a fixture. On that reading, no new DEC is needed. **The user may object to this reading.** If they require the literal text, the alternative is the verified projection (`id`, `nombre`, `"stockDisponible"` / `stock_producible`, ...) with raw email headers, no cast (decimal thresholds then fail on integer columns) and no tiebreakers. That would be a DEC-127 addendum recorded before apply.

## Order Through Nesting

The statement a run or `/prueba` actually sends is built by `componerSentencia` and then `sentenciaPaginada`:

```
SELECT * FROM (
  WITH v_producto AS (...), v_receta_componente AS (...)
  SELECT * FROM (
    <template ... ORDER BY ...>
  ) AS _plantilla
) AS _consulta_usuario LIMIT $2 OFFSET $3
```

How PostgreSQL handles this:

- The planner does not pull up a subquery that has `ORDER BY` (or one with a `WITH`). The template is therefore planned on its own, with its top Sort node.
- Every enclosing level is a plain Subquery Scan or Limit with no join, aggregate, `DISTINCT`, set operation or outer `ORDER BY`. None of these nodes reorders rows, so the order survives and `LIMIT` cuts the lowest-stock rows.
- This is **observed planner behavior, not a documented SQL guarantee**. The module header comment records this, and test L4 pins it on the exact executed text.
- If a future PostgreSQL version breaks L4, the fallback is to document "order not guaranteed" as an artifact limit. The engine is never changed for it.

## Boot Sequence (container start)

```
docker-entrypoint.sh (set -e)
  |-- npx prisma migrate deploy ----------------- fail -> exit != 0, container stops
  |-- npx tsx prisma/seed.ts
  |     |-- sembrarTenant(): tenant.count() > 0 -> log "Seed skipped: N tenant row(s)"; return (this step only)
  |     |                    else create "Food Store"
  |     |-- sembrarCatalogoInicial(prisma.plantilla)        [dist/catalogo-inicial.js]
  |     |     |-- rechazoDeEntrada(e) for each e --------- non-null -> throw (names id + campos), nothing written
  |     |     `-- createMany({data: 2 rows, skipDuplicates}) -> INSERT ... ON CONFLICT DO NOTHING -> count
  |     |-- log "Seed: template catalog, <count> of 2 created; existing rows left as they are."
  |     `-- any rejection -> "Seed failed:" + exitCode = 1 -> set -e stops here
  `-- exec node dist/server.js
```

## GET /plantillas on a Fresh Install

```
/consola cargarCatalogoPlantillas()
  -> GET /plantillas (no x-tenant-id) -> contexto-tenant: exempt by exact row
  -> plantilla.findMany(select PlantillaResumen, orderBy nombre,id, take 201)
  <- 200 {plantillas:[{id:21b0..01,"Alerta de stock físico",stock-fisico,correo-html,60},
                      {id:21b0..02,"Alerta de stock producible",stock-producible,correo-html,120}], truncado:false}
  -> #auto-plantilla gets 2 options -> elegirPlantilla() -> GET /plantillas/:id -> one "umbral" (numero) input
```

## Interfaces

```ts
export const ID_STOCK_FISICO = '21b00000-0000-4000-8000-000000000001';
export const ID_STOCK_PRODUCIBLE = '21b00000-0000-4000-8000-000000000002';
export interface EntradaCatalogo extends RegistroPlantillaBody { readonly id: string }
export const CATALOGO_INICIAL: readonly EntradaCatalogo[];          // frozen, exactly 2
export type FilaCatalogo = ReturnType<typeof datosDePlantilla> & { id: string };
export interface DelegadoSiembra {
  createMany(args: { data: FilaCatalogo[]; skipDuplicates: true }): Promise<{ count: number }>;
}
export function rechazoDeEntrada(e: EntradaCatalogo): Record<string, unknown> | null;
/** Validates every entry, then one createMany. Returns how many rows were created (0..n). Throws on a rejected entry or on duplicate ids within the list. */
export function sembrarCatalogoInicial(
  plantillas: DelegadoSiembra, catalogo?: readonly EntradaCatalogo[]): Promise<number>;
```

Imports: `plantillas-rutas.js` (`rechazoDePlantilla`, `datosDePlantilla`, type `RegistroPlantillaBody`), `plantillas.js` (`FORMATOS`, `VALORES_AUTOMATIZACION`) and `vistas-canonicas.js` (`ENTIDADES_CANONICAS`). None of them does IO at import time. The existing tests already import them with no environment.

`prisma/seed.ts` imports `{ CATALOGO_INICIAL, sembrarCatalogoInicial }` from `'../dist/catalogo-inicial.js'`, the same way it already imports the client from `dist`.

## File Changes

| File | Action | ± lines (authored) |
|---|---|---|
| `src/catalogo-inicial.ts` | Create: ids, two entries, `rechazoDeEntrada` (key set, enums, route rules), `sembrarCatalogoInicial`, and a header comment (rule 6, ORDER BY note, SQL deltas, DEC refs) | ~118 |
| `src/catalogo-inicial.test.ts` | Create (U, L and C blocks below) | ~225 |
| `prisma/seed.ts` | Modify: extract `sembrarTenant()` (body unchanged), add the catalog step and its log line, `main()` calls both in sequence, update the header comment | +20 / −6 |
| `scripts/smoke.sh` | Modify: capture the restart's `StartedAt`, switch line 54 to `--since`, add the CH-21b block | +16 / −1 |
| **PR1** | | **~386, under 400 but tight.** If the test grows past ~235, merge U-cases into shared loops and trim fixture comments. Do not split the PR. If the total still exceeds 400, flag it before apply |

## Testing Strategy

All tests are in `src/catalogo-inicial.test.ts` and use `node:test`. The live blocks reuse the `TEST_DB_*` / `esAlcanzable` gating pattern from `plantillas-rutas.test.ts:157-185` and are skipped when no server is reachable.

| Id | Layer | Case |
|---|---|---|
| U1 | unit | Closed list: there are exactly 2 entries with the fixed ids, and the names, `entidades`, `parametros`, `formato` and tolerances (60/120) are as specified. No `reporte-diario`. Each entry's keys are exactly the `PlantillaCompleta` keys (no `tenantId`). Every `v_<x>` in `sql` is declared in `entidades`. Each `sql` contains no `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`CREATE` (word-boundary, case-insensitive), no `;`, nothing matching `/\$\d/`, and no literal threshold (`/<=\s*\d/` absent; `<= :umbral` present). `rechazoDeEntrada` rejects a copy with an extra `tenantId` key (`campos: ['/tenantId']`) and a copy without `nombre` |
| U2 | unit | POST parity: register `registerPlantillaRoutes` with a delegate whose `create` captures `data`. Each entry body (without `id`) gets 201, and the captured data deep-equals `datosDePlantilla(entry)`. Two broken copies (`sql` with `$1`; `entidades: ['producto','cliente']`) get 400 from the route, `rechazoDeEntrada` returns the same `campos`/`rechazados`, and `sembrarCatalogoInicial` throws naming the id. A delegate that throws on any call proves nothing was written |
| U3 | unit | With a fake delegate, the seeder makes exactly one `createMany` call. Its `data` ids are the fixed ids in list order, `skipDuplicates === true`, and it returns `count`. A list with a duplicated id throws before the call |
| U4 | unit | Composition: for each entry, `componerSentencia(sql, stub views)` then `prepararSentencia(..., { umbral: 5 })` gives `ok`. `texto` has no `:umbral`, `valores` deep-equals `[5]`, and `texto` equals the composed text with `:umbral` replaced by `$1`, so the value is never part of the text. **DEC-71 gate for `stock-fisico`** (`evaluarVistas(entry.entidades, filas)`):<br>• `[producto valida]` gives `{ ok: false, entidades: [{ entidad: 'receta_componente', estado: 'no-mapeada' }] }`.<br>• Adding `receta_componente` as `no-validado` gives `ok: false` naming it with that state.<br>• Adding it as `valida`, with an empty-view SQL (`... WHERE false`), gives `ok: true` with both views in contract order.<br>This covers "connection without a valid view" and, together with C1's empty-view run, "tenant without recipes using an empty view" |
| U5 | tsc | Signature pin `firmaAceptaDelegado(p: PrismaClient) { sembrarCatalogoInicial(p.plantilla) }`, checked by `npm run build` and never called |
| L1 | live | Seed a test catalog (the real entries with per-run `randomUUID()` ids and a `CH-21b test <ts>` prefix on `nombre`). The first run returns 2 and the second returns 0. `count({ id: { in } })` is 2 both times |
| L2 | live | PUT through the route with a different `sql`/`nombre`, then seed again. `findUnique` deep-equals the PUT response. **Unrelated template**: before that seed, create a template through `POST /plantillas` with `automatizacion: 'stock-fisico'` and a `CH-21b test <ts>` name. After the seed, `findUnique` on its generated id deep-equals the POST response, and no extra row exists with that prefix. Clean it up by its id |
| L3 | live | Delete one test row, then seed again. The run returns 1, the deleted row comes back with its content, and the other row is unchanged. For each test id, `GET /plantillas/:id` through the route answers 200 with that row. The list route is not used: it returns only the first 200 rows by `nombre`, and `plantillas-rutas.test.ts:258-272` inserts 201 `CH-12 ...` rows, so a parallel run could push the test rows out of the page |
| C1 | live | `stock-fisico`: run `sentenciaPaginada(preparada, 50, 0)` with `pg` `rowMode: 'array'` inside `BEGIN READ ONLY`. The fixture views are `VALUES` lists (no tables, nothing to clean). Columns are `['Producto','Stock disponible']`. With `umbral: 5` the rows are `Alfajor 2, Chipa 2, Budin 4`: the inactive product and `Empanada` (stock 1, has a recipe) are excluded. With `umbral: 2.5` the rows are `Alfajor, Chipa` (decimal bind). With an empty `receta_componente` view, `Empanada 1` comes first |
| C2 | live | `stock-producible`: Empanada's recipe is Harina 10/2 and Huevo 3/1, Fugazza's is Harina 10/1. With `umbral: 5` the result is `[['Empanada','3','Huevo',3]]` (numeric values come back as strings). With `umbral: 10` it is Empanada, then Fugazza |
| L4 | live | Order through nesting: `sentenciaPaginada(preparada, 2, 0)` returns the 2 lowest rows in order, plus the probe row. Names use distinct ASCII initials, so the result does not depend on collation |

Cleanup: L1-L3 delete only their own random ids in `after`. C1, C2 and L4 create no objects. The real fixed ids are never written by tests.

**Smoke** (`scripts/smoke.sh`, after the `docker compose restart app` step, where a tenant certainly exists). The smoke runs on a clean stack, so the list check is reliable there:

- **Log window.** After `restart` and `wait_for_app`, read `INICIO_APP=$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q app)")`. Every log assertion of this block uses `docker compose logs --since "$INICIO_APP" app`:
  - the existing `No pending migrations to apply.` check at `smoke.sh:54`, which changes from `tail -20` to this window;
  - `Seed skipped:`;
  - `Seed: template catalog`.

  **Chosen over** `tail -60` and over a host `date` taken before the restart. `StartedAt` and the log timestamps both come from the Docker daemon clock, so there is no host/VM skew (Docker Desktop on Windows). The window also holds exactly the restarted boot, whatever the number of seed or server lines.
- `GET /plantillas` with no header returns 200, and the body contains `"id":"21b00000-0000-4000-8000-000000000001"` and `...0002`.
- Both `Seed skipped:` and `Seed: template catalog` appear in that window. This proves the catalog step ran even though the tenant step returned early (spec "Existing tenant does not skip").

`seed.ts` has no unit test: it is outside `tsconfig` and runs at import. The smoke check above is its evidence.

## Apply Checklist (verify during sdd-apply)

- [ ] `npx tsx prisma/seed.ts` still runs in the container with only the env the entrypoint provides (`DATABASE_URL` and the Compose env). The new import of `dist/catalogo-inicial.js` pulls in `plantillas-rutas.js`, and through it `conexiones.js`, `consulta-ejecucion.js`, `vistas-canonicas.js` and others. Confirm that none of these calls `loadConfig()`, or reads a required env var, at module top level. Grep for top-level `loadConfig(` and `process.env` in that import graph, and run the seed once with only `DATABASE_URL` set. If some module does, import the needed functions from a leaner module or move the read inside a function. Never add env to the entrypoint.
- [ ] U5's `tsc` pin: if Prisma 7's generic `createMany` does not assign to `DelegadoSiembra`, adjust only the interface types (for example `data` as Prisma's `PlantillaCreateManyInput[]`, or a return type of `PromiseLike<{ count: number }>`). Do not cast at the call site and do not widen the seeder to the full client.
- [ ] `createMany({ skipDuplicates: true })` is supported by the `@prisma/adapter-pg` driver adapter in use. L1 proves it on live PostgreSQL.
- [ ] The authored line count stays at or under 400 (forecast ~386).

## Threat Matrix

| Boundary | Applicability | Response / tests |
|---|---|---|
| Documentation-like paths, git repository selection, commit, push, PR commands | N/A: there is no VCS automation and nothing is classified or executed by path | — |
| Global catalog write outside HTTP (rule 2, project-specific) | **Applicable** | The seeder takes only the `plantilla` delegate and a closed constant list, with no tenant or request input. Rows carry no `tenantId`. Values are bound by Prisma (rule 4). Tests U1, U3, U5 |
| Boot process (`set -e` entrypoint) | **Applicable** | A seed failure exits non-zero and the server does not start. Covered by the existing contract and the smoke check that the catalog was listed after a restart |

## Migration / Rollout

There is no migration, env var or dependency. When PR1 is merged and deployed, the next boot creates the two rows on existing installs as well (the upgrade path).

**Rollback:** revert PR1. The seeded rows persist (no delete route, DEC-68). Remove them only **after** the revert. While PR1 is deployed, a removed row comes back at the next boot. To remove them, run `SELECT count(*) FROM "Automatizacion" WHERE "plantillaId" IN ('21b00000-0000-4000-8000-000000000001','21b00000-0000-4000-8000-000000000002')`. If the count is 0, run `DELETE FROM "Plantilla" WHERE id IN (...)`. The FK is `RESTRICT`, so a referenced row cannot be deleted by mistake.

## Open Questions

- None blocking. If the PostgreSQL version in the test environment ever fails L4, record "order not guaranteed" as an artifact limit (see "Order Through Nesting"). The engine is not changed.
