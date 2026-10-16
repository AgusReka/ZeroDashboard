# Design: CH-34 — A step-by-step guide and an example SQL per entity on the Mapping screen

Inputs: proposal.md, specs/query-console/spec.md, DEC-176, DEC-169, the console guards in `src/consola.test.ts`.

## Decisions

### 1. The examples live in their own module, interpolated once into the script
`src/mapeo-ejemplos.ts` exports `EJEMPLOS_MAPEO: Readonly<Record<string, string>>`, keyed by the five contract names. The contract has no entity-name union type (`ENTIDADES_CANONICAS` is `readonly string[]`, `src/vistas-canonicas.ts:25`), so the test enforces that the keys equal the contract's entities. `src/consola.ts` imports it and writes it into the inline script once:

```
var EJEMPLOS_MAPEO = ${jsonEnScript(EJEMPLOS_MAPEO)};
```

`jsonEnScript` is `JSON.stringify` with `<` replaced by `<` (so no `</script>` can close the block) and U+2028/U+2029 escaped. The value is a compile-time constant, not stored data, so it does not weaken the CH-29 rule. The header comment that says the operator name "is the one interpolation" is updated to name this second, constant one.

- *Why not hard-code inside the script string?* The alignment test would then have to parse the HTML document. A module is importable by the test as plain TypeScript.
- *Why not markup?* Five `<pre>` blocks in static markup would need ten guarded ids and would duplicate the per-entity blocks the script already builds.

### 2. The examples are the demo replica's views, as plain SELECTs
These are rewritten from `docker/replica-demo/01-esquema-y-datos.sql:579-645` with no `CREATE VIEW` and no `public.` prefix. Tables take an alias without `AS`, so every `AS` in a select list is a column alias:

- `producto`: `SELECT p.id::text AS id, p.name AS nombre, p.stock_quantity AS "stockDisponible", NULL::text AS sku, p.available AS activo FROM product p WHERE p.deleted_at IS NULL`
- `pedido`: `SELECT p.id::text AS id, p.created_at AS "fechaCreacion", CASE WHEN ep.codigo = 'CANCELADO' THEN 'cancelado' ELSE ep.codigo::text END AS estado, p.total AS total, NULL::integer AS numero, NULL::text AS moneda FROM pedido p JOIN estado_pedido ep ON ep.id = p.estado_id WHERE p.deleted_at IS NULL`
- `item_pedido`: `SELECT dp.id::text AS id, dp.pedido_id::text AS "pedidoId", dp.producto_id::text AS "productoId", dp.cantidad AS cantidad, dp.producto_precio_unitario AS "precioUnitario" FROM detalle_pedido dp WHERE dp.deleted_at IS NULL`
- `insumo`: `SELECT i.id::text AS id, i.name AS nombre, i.stock_quantity AS "stockDisponible", NULL::text AS "unidadMedida", NULL::text AS codigo FROM ingredient i WHERE i.deleted_at IS NULL`
- `receta_componente`: `SELECT pi.product_id::text AS "productoId", pi.ingredient_id::text AS "insumoId", pi.quantity AS "cantidadPorUnidad" FROM product_ingredient pi JOIN product p ON p.id = pi.product_id AND p.deleted_at IS NULL JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL`

Each statement is stored multi-line: one select item per line, `FROM` and `JOIN`s on their own lines, and no trailing `;`. Columns whose name already equals the field keep an explicit `AS` (`p.total AS total`, `dp.cantidad AS cantidad`), so the alias set is complete and readable.

### 3. The guide is static markup
Inside `#pantalla-mapeo`, between `#mapeo-aviso` and `#mapeo-entidades`:

```html
<details id="mapeo-guia" class="zd-card">
  <summary>Cómo mapear</summary>
  <ol>
    <li>Elegí la conexión del tenant.</li>
    <li>Por cada entidad, escribí un SELECT sobre la réplica del cliente que devuelva los campos del contrato con esos mismos nombres. Los que tienen mayúsculas van entre comillas dobles ("stockDisponible") y cada uno con el tipo del contrato.</li>
    <li>Guardá cada entidad.</li>
    <li>Validá el mapeo y revisá el resultado de cada campo; si el tipo no coincide, la pista dice qué casteo probar.</li>
    <li>La tabla de automatizaciones dice cuáles quedan habilitadas y por qué.</li>
  </ol>
  <p class="ayuda">Las entidades opcionales pueden quedar sin mapear. Cada entidad trae un ejemplo sobre la réplica de demo.</p>
</details>
```

The guide is closed by default. The container class is the one the design skill uses for a bordered block. If `zd-card` is not in the kit, design falls back to the plainest existing container: markup may carry `zd-*` classes, and only the script is restricted. `mapeo-guia` joins `IDS`. The final copy is checked against `guidelines/lenguaje.md` in apply.

### 4. The per-entity example is built by `bloqueDeEntidad`
Between the editor and «Guardar», and with no classes other than `ayuda` (G3'):

```
details
  summary  "Ejemplo sobre la réplica de demo (food_store)"
  pre      EJEMPLOS_MAPEO[entidad]               (textContent)
  button   «Usar de punto de partida»            (botonTenant)
```

The click handler, `usarEjemplo(entidad)`, does the following:
- If `bloque.editor.value.trim() === ''`, it sets `editor.value = EJEMPLOS_MAPEO[entidad]`, focuses the editor and writes in `#mapeo-aviso` «Se copió el ejemplo de {entidad}. Adaptalo a la réplica del cliente y guardalo.»
- Otherwise it leaves the editor unchanged and writes «El editor de {entidad} ya tiene SQL. Vacialo para usar el ejemplo.»
- It never calls `pedir`.

An entity with no example, which cannot happen while the module covers the contract, renders no `details`.

## Tests (`src/mapeo-ejemplos.test.ts`, `src/consola.test.ts`)
- **Alignment (pure).** For each entity in `CONTRATO_CANONICO`, collect the aliases of its example by matching `\bAS\s+("[A-Za-z]+"|[a-z_]+)` followed by `,` or a line break before `FROM`. The set must equal the entity's field names. A name with an uppercase letter must appear quoted, and the others unquoted. The keys of `EJEMPLOS_MAPEO` must equal the contract's entities.
- **Script safety.** `jsonEnScript` never emits `</`, and the console document contains no `</script` inside the script except its own closing tag.
- **Console:**
  - `mapeo-guia` is in the markup, before `mapeo-entidades`.
  - In `abrirMapeo`, pressing «Usar de punto de partida» on `insumo` (empty) copies the example, and the request count is unchanged.
  - On `producto` (holds `SQL_PRODUCTO`), the editor is unchanged and the notice says so.
  - The example `pre` holds the text verbatim (`textContent`).
- **The existing guards** G3' and `verificarIds` pass unchanged, apart from adding `mapeo-guia` to `IDS`.

## Files
- **New:** `src/mapeo-ejemplos.ts`, `src/mapeo-ejemplos.test.ts`.
- **Modified:**
  - `src/consola.ts`: import, the `jsonEnScript` helper, the header comment, the markup, `bloqueDeEntidad` and `usarEjemplo`.
  - `src/consola.test.ts`
  - `docs/02-mapa-de-changes.md`: the CH-34 row.
  - Design skill: `guidelines/pantallas.md` C-08 gets one line noting the guide and the example. If it is a copy in two places (`.claude/` and `.agents/`), both are updated.

## Size
About 200 changed lines: module ~40, its test ~50, `consola.ts` ~60, `consola.test.ts` ~50, docs ~10. One PR.
