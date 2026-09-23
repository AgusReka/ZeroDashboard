# Bitácora — CH-16b: Vistas canónicas sobre el esquema de origen y tercer esquema de contraste

**Fecha de la corrida sobre fixtures:** 2026-09-21.
**Fecha de la corrida sobre bases reales:** 2026-09-21.
**Estado:** verificación de equivalencia (Food Store real) y de portabilidad (Medusa real) **completada contra bases reales**. WooCommerce siguió siendo fixture — no hay una instancia real de WooCommerce disponible en este proyecto; ver la sección "Qué corrió contra base real y qué sigue siendo fixture" para el detalle exacto por afirmación.

> **Advertencia vigente para todo lo que sigue siendo fixture.** Las secciones de este documento que describen la corrida sobre **WooCommerce** corrieron sobre un **fixture**: una réplica mínima con datos inventados. **No son datos de la tesis.** Las secciones de **Food Store** y **Medusa**, en cambio, ya corrieron contra las bases reales (ver más abajo) y sus resultados sí son citables como evidencia del caso de estudio, sujetos a las salvedades registradas en "Fricciones encontradas".

---

## Qué corrió contra base real y qué sigue siendo fixture (actualizado 2026-09-21)

| Afirmación de la entrada original | Estado ahora |
|---|---|
| V-1, V-2, V-3 (Food Store) | **Re-ejecutadas contra la base real `food_store` (Docker, contenedor `foodstore-backend-fastapi-db-1`, esquema `public`).** Ver "Re-ejecución contra bases reales" abajo. Los números de la tabla V-1/V-2/V-3 original quedan reemplazados por los de esa sección. |
| V-4, V-5 (Medusa) | **Re-ejecutadas contra la instancia real `ch16-medusa-pg` (base `medusa_db`, esquema `public`, usuario `medusa`).** Ver la misma sección. |
| V-6, V-7, V-8 (WooCommerce) | **Sin cambios: siguen siendo fixture.** No hay instancia real de WooCommerce en este proyecto. Estos tres puntos no se re-ejecutaron y no deben citarse como evidencia sobre un caso real, solo como prueba de que el SQL frente a un modelo EAV se comporta como se describe. |
| Fricción 1 (`sku`/`unidadMedida`) | **Cerrada (2026-09-21).** `sku` es opcional en el contrato, sin conflicto. `unidadMedida` era obligatorio y Food Store no tenía de dónde derivarlo; el usuario decidió DEC-29 y ahora es opcional. Ver sección "TAREA 3" más abajo. |
| DEC-28 (vistas exponen hechos crudos) | **Confirmada por el usuario el 2026-09-21.** Registrada como firme en `docs/01-decisiones.md`. |
| DEC-29 (criterio de obligatoriedad de campos; `unidadMedida` → opcional) | **Nueva, firme.** Decidida por el usuario el 2026-09-21, aplicada en `src/contrato.ts`. Ver sección "TAREA 3" más abajo. |
| `ingredient.is_active` (hallazgo del PASO 2) | **Verificado el 2026-09-21: 0 inactivos sobre 14 filas en la base real.** No afecta la tabla de divergencia de 6.2.2. Ver sección "TAREA 1" más abajo. |
| Aritmética proporcional contra Medusa (todas las filas con `stock_producible=1000000` en la corrida original) | **Verificada con una modificación controlada y revertida el 2026-09-21.** Ver sección "TAREA 2" más abajo. |

---

## Re-ejecución contra bases reales (2026-09-21)

**Food Store real:** host `localhost` (contenedor Docker `foodstore-backend-fastapi-db-1`, mapeado `5433→5432`; desde otro contenedor: `host.docker.internal:5433`), base `food_store`, esquema `public` (único esquema no-sistema; no existe un esquema `foodstore` en la base real). Las vistas se crearon con el usuario `postgres` (superusuario) porque `lector_zerodashboard` no tiene `CREATE` sobre `public` — confirmado con `has_schema_privilege('lector_zerodashboard','public','CREATE') = false`. Decisión de qué usuario usar para el `CREATE VIEW` confirmada por el usuario antes de ejecutar.

Diferencias entre el esquema real y lo que asumía `03_vistas_foodstore.sql`: ninguna que afecte a las columnas que la vista usa. `product` real tiene columnas de más (`description`, `base_price`, `image_urls`, `prep_time_min`, `created_at`, `updated_at`) y no tiene `sku`; `ingredient` real tiene columnas de más (`description`, `is_allergen`, `is_active`, `created_at`, `updated_at`) y no tiene `unidadMedida` ni `codigo`; `product_ingredient` real tiene además `is_removable`. Hallazgo no resuelto por la vista: `ingredient.is_active` es un segundo mecanismo de baja que ni el fixture, ni la vista, ni `02_query_original.sql` consideran (ambos solo filtran por `deleted_at IS NULL`) — no se agregó a la vista porque decidir qué significa "insumo activo" es una decisión de diseño que no le corresponde tomar al agente.

Único ajuste hecho: se quitó el `SET search_path TO foodstore;` de `03_vistas_foodstore.sql` (apuntaba al esquema del fixture) porque las tablas reales están en `public`. No se modificó ninguna otra línea de la vista. `02_query_original.sql` y `04_consulta_canonica.sql` no se tocaron en disco.

| ID | Condición real | Acción | Resultado obtenido (base real) | Estado |
|---|---|---|---|---|
| V-1 (real) | Base real `food_store`, tablas `product`/`ingredient`/`product_ingredient` | `02_query_original.sql` (Anexo A, sin `HAVING`) contra las tablas reales | 6 filas: Hamburguesa Clásica 50/Tomate, BBQ Bacon 20/Bacon, Doble 40/Carne vacuna, Picante 15/Jalapeños, Papas Fritas 250/Papas, Aros de Cebolla 70/Cebolla | ✅ |
| V-2 (real) | Vistas creadas contra `food_store` real (usuario `postgres`) | `03_vistas_foodstore.sql` (ajustado solo en el `search_path`) | Las tres vistas (`v_producto`, `v_insumo`, `v_receta_componente`) se crean sin error | ✅ |
| V-3 (real) | Ambas consultas disponibles contra la base real | Diferencia simétrica entre `02_query_original.sql` y `04_consulta_canonica.sql` (sin modificar), comparando por `id::text` | `solo en ORIGINAL: 0` / `solo en CANÓNICA: 0` / `intersección: 6` | ✅ **equivalencia probada contra la base real** |
| V-4 (real) | Contenedor `ch16-medusa-pg` arrancado, base `medusa_db`, usuario `medusa` | `06_vistas_medusa.sql` (se omitió únicamente su línea `SET search_path TO medusa;`, sin editar el archivo en disco) | Las tres vistas se crean sin error | ✅ |
| V-5 (real) | Vistas reales de Medusa creadas | `04_consulta_canonica.sql`, byte por byte idéntico al usado contra Food Store, contra `medusa_db` | 20 filas. Todas con `stock_producible = 1000000` e `insumo_limitante` igual al talle/variante — reproduce exactamente el patrón que la corrida sobre fixture anticipaba (categoría 5: `required_quantity=1` en el 100% de los vínculos del seed oficial, sin insumos compartidos). Salida cruda, sin interpretar más allá de lo ya registrado en "El hallazgo" | ✅ **portabilidad demostrada contra la instancia real** |

**PASO 6 — verificación contra `src/contrato.ts` real (sin decidir nada):**

- `producto.sku`: `obligatoriedad: 'opcional'` en el contrato. Food Store no tiene columna de SKU → `v_producto.sku` es `NULL`, pero el contrato no lo exige. **No hay conflicto.**
- `insumo."unidadMedida"`: `obligatoriedad: 'obligatorio'` en el contrato. Food Store no tiene ninguna columna de la que derivar unidad de medida → `v_insumo."unidadMedida"` es `NULL` sobre un campo que el contrato declara obligatorio. **Hay conflicto entre el contrato y lo que Food Store puede satisfacer.** Esto es exactamente la fricción 1 original, ahora acotada a un solo campo (no a `sku`). Queda para que el usuario decida qué hacer con esto — no lo resuelvo yo.

---

## Por qué existe este change

CH-16 mapeó el segundo esquema (Medusa) pero dejó dos huecos:

1. **No existían las vistas canónicas sobre Food Store**, el esquema de origen. Sin los dos lados no hay demostración de "la misma consulta contra dos esquemas": solo hay "se pueden escribir vistas sobre Medusa".
2. **El paso 4 quedó omitido** (correr las consultas del catálogo contra las vistas) porque CH-11/12/13 no existen. Pero la consulta de WF-01c **sí existe** desde el trabajo previo: está en el Anexo A. No hacía falta esperar al motor.

Y además CH-16 arrojó un resultado incómodo: ningún campo canónico quedó sin origen en Medusa. Como DEC-26 eligió Medusa precisamente por ser el candidato con el modelo de insumos más completo, ese resultado está condicionado por la selección. Hacía falta un tercer esquema elegido por el criterio inverso.

---

## Qué se hizo

### 1. Vistas canónicas sobre Food Store

Tres vistas (`v_producto`, `v_insumo`, `v_receta_componente`) sobre el esquema real de Food Store documentado en la bitácora de WF-01: `product`, `ingredient`, `product_ingredient`.

**Decisión de diseño que aparece acá y no estaba prevista — candidata a DEC-28.**

`v_producto."stockDisponible"` expone el **stock declarado crudo** (`product.stock_quantity`), no el stock producible ya calculado. Las vistas exponen hechos, no cálculos.

El motivo no es de estilo. Si la vista precalculara el producible para los productos con receta, la **divergencia entre declarado y producible desaparecería de la capa canónica** y el hallazgo central del trabajo (sección 6.2.2) sería inobservable desde el contrato. El cálculo pertenece a la automatización, no a la correspondencia.

Consecuencia que hay que declarar: para un producto con receta, `v_producto."stockDisponible"` contiene un valor que la plataforma ignora. La capa canónica lo expone tal cual porque es lo que la plataforma efectivamente persiste; interpretarlo es responsabilidad de quien consulta.

Esta decisión es además **consistente con lo que CH-16 ya hizo** en Medusa sin nombrarlo: allí `stockDisponible` se mapeó al stock físico de `inventory_level`, no a un producible derivado.

### 2. Consulta canónica única

La consulta de stock producible con insumo limitante, reescrita **una sola vez** contra las vistas canónicas. No menciona ninguna tabla nativa de ninguna plataforma.

### 3. Tercer esquema: WooCommerce

Elegido por el criterio inverso a DEC-26: el candidato con el modelo de inventario **más pobre** de los relevados, y el más difundido entre comercios pequeños. Réplica del almacenamiento real de productos de WooCommerce: `wp_posts` con `post_type IN ('product','product_variation')` más `wp_postmeta` con los atributos como pares clave-valor (`_sku`, `_stock`, `_stock_status`, `_price`).

---

## Verificación

Entorno: PostgreSQL 16.13, instancia local, tres esquemas (`foodstore`, `medusa`, `woo`) en la misma base.

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Fixture de Food Store cargado | Correr la consulta **original** de WF-01c (Anexo A) sin el `HAVING` | Reproduce la tabla de divergencia de 6.2.2 | 6 filas: BBQ Bacon 20/Bacon, Picante 24/Jalapeños, Nueva 31/Queso, Doble 38/Carne, Clásica 47/Tomate, Aros 67/Cebolla | ✅ |
| V-2 | Vistas canónicas creadas sobre Food Store | `SELECT * FROM v_producto` | Filas legibles con el stock declarado crudo | 8 filas; `sku` en `NULL` (sin origen) | ✅ |
| V-3 | Ambas consultas disponibles | **Diferencia simétrica de conjuntos** entre el resultado de la consulta original y el de la canónica | Cero filas de diferencia en las dos direcciones | `solo en ORIGINAL: 0` / `solo en CANÓNICA: 0` / `intersección: 6` | ✅ **equivalencia probada** |
| V-4 | Fixture de Medusa con las características del seed oficial (20 variantes, `required_quantity=1` en todos, `unit_of_measure` NULL en 20/20) | Crear las tres vistas de CH-16 transcriptas tal cual | Las tres se crean sin error | Creadas | ✅ |
| V-5 | Las dos baterías de vistas creadas | Correr **el mismo archivo** `04_consulta_canonica.sql`, byte por byte idéntico, contra `foodstore` y contra `medusa` | Corre en ambos sin una sola modificación | 6 filas en Food Store, 20 filas en Medusa. Cero cambios en el texto de la consulta | ✅ **portabilidad demostrada** |
| V-6 | Fixture de WooCommerce (EAV) | Escribir `v_producto` sobre `wp_posts` + `wp_postmeta` | Se puede, con un `LEFT JOIN` por cada campo canónico | 3 filas correctas, con `sku` y `stockDisponible` pivotados desde `meta_key` | ✅ |
| V-7 | Esquema de WooCommerce | Buscar tablas cuyo nombre sugiera insumo, receta, componente, material o BOM | — (sin expectativa previa) | **0 tablas** | ✅ (confirma ausencia) |
| V-8 | `v_producto` de WooCommerce creada, `v_insumo` y `v_receta_componente` imposibles | Correr la consulta canónica contra `woo` | Falla, y falla de forma informativa | `ERROR: relation "v_receta_componente" does not exist` | ✅ **el límite se manifiesta como falla cerrada, no como resultado incorrecto** |

---

## El hallazgo: cuatro clases de obstáculo, no dos

La predicción original distinguía dos clases: **traducción** y **ausencia**. La evidencia de tres esquemas distingue cuatro, y las dos del medio no estaban previstas.

| Clase | Esquema donde se observó | Qué ocurre | Costo de resolverlo |
|---|---|---|---|
| **1. Correspondencia directa** | Food Store | Una columna con el mismo significado | Nulo |
| **2. Asimetría de granularidad** | Medusa | El contrato modela una entidad plana; la plataforma la parte en una cadena de tablas (`product`→`product_variant`→`inventory_item`). No falta el dato: sobra un nivel de indirección | Una **decisión de arquitectura** (DEC-27: la fila canónica es la variante, no el producto). No se resuelve escribiendo SQL: se resuelve decidiendo qué significa "producto" |
| **3. Modelo entidad-atributo-valor** | WooCommerce | El dato existe pero como fila de una tabla de pares clave-valor, no como columna. Cada campo canónico exige un `LEFT JOIN` propio contra la misma tabla | Mecánico pero creciente: la vista crece linealmente con la cantidad de campos del contrato, y cada campo agrega una reunión |
| **4. Ausencia del concepto** | WooCommerce (insumos y recetas) | No hay tabla, columna ni convención de la que derivar el concepto. Ninguna vista es escribible | **Irresoluble en la capa de correspondencia.** Determina el límite de aplicabilidad del catálogo |

Y una quinta categoría, que ya había aparecido en CH-16 y conviene mantener separada porque no es un problema de esquema:

**5. Esquema capaz, datos no representativos.** El Inventory Kit de Medusa es estructuralmente idéntico a `receta_componente`, pero el seed oficial tiene `required_quantity = 1` en el 100% de los vínculos y ningún insumo compartido entre variantes. La aritmética de consumo proporcional —el matiz que la sección 6.2.3 identifica como valor de la automatización— **no se pudo ejercitar contra Medusa**, no por falta de esquema sino por falta de datos que la ejerciten.

### Lo que esto cambia respecto de lo que se afirmaba

La clase 4 se observó, pero **no en Medusa**. Medusa modela listas de materiales. La afirmación de que "una plataforma que no modela listas de materiales no puede sostener el control de stock de productos elaborados" es correcta y ahora tiene un caso: WooCommerce, no Medusa. Cualquier texto que use Medusa como ejemplo de ausencia hay que corregirlo.

### El efecto de selección, declarado

DEC-26 eligió Medusa por tener el modelo de insumos más completo de los candidatos. Que todo mapeara es, en parte, consecuencia de esa elección. WooCommerce se incorporó por el criterio inverso precisamente para acotar ese sesgo. Con los dos casos, la afirmación defendible es:

> El contrato canónico resulta satisfacible por plataformas cuyo modelo de datos incluye el concepto de insumo y de composición, mediante correspondencias que pueden exigir decisiones de granularidad; y resulta parcialmente insatisfacible por plataformas que carecen de ese concepto, en las cuales la porción del catálogo que depende de él queda inaplicable.

Eso es más débil que "el contrato es genérico" y es lo que la evidencia sostiene.

---

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Costo |
|---|---|---|---|---|
| 1 | Food Store no tiene columna de SKU ni unidad de medida de insumo, pese a que el contrato canónico declara esos campos | El contrato se escribió con campos que el esquema de origen no tiene. No fue derivado del caso: fue escrito con expectativas sobre él | **Verificado contra `src/contrato.ts` real (2026-09-21).** `producto.sku` es `opcional` en el contrato → sin conflicto, `NULL` es un valor válido. `insumo."unidadMedida"` es `obligatorio` en el contrato → **sí hay conflicto**: Food Store no tiene de dónde derivarlo y `v_insumo."unidadMedida"` queda `NULL` sobre un campo que el contrato exige. Sin resolver — queda para que el usuario decida | Bajo en tiempo, alto en consecuencia: acota (no elimina) la fricción a un solo campo obligatorio incumplido; sigue obligando a revisar la afirmación de que el contrato fue "derivado de un caso real" |
| 2 | La consulta canónica no distingue productos con receta de productos sin receta | El `JOIN` con `v_receta_componente` los excluye implícitamente, igual que hacía el `JOIN` de la consulta original | No se corrigió: es el comportamiento correcto y heredado. Se anota que la rama de stock físico (WF-01a) necesita su propia consulta canónica, con un `NOT EXISTS` sobre `v_receta_componente` | Ninguno |
| 3 | El fallo de la consulta contra WooCommerce es un error de relación inexistente, no un mensaje de dominio | La ausencia de un concepto se manifiesta como una vista que no se puede crear, y el motor lo reporta como tal | Se documenta como resultado: el límite se manifiesta como falla cerrada al intentar usar el catálogo, no como un resultado silenciosamente incorrecto. Eso es preferible y conviene decirlo | Ninguno — es un hallazgo |

---

## Consultas ejecutadas

Los siete archivos SQL acompañan esta entrada. La consulta canónica, que es la pieza citable, es esta, y corrió idéntica contra los tres esquemas:

```sql
-- ejecutada 2026-09-21 sobre los esquemas foodstore, medusa y woo
-- universo: todos los productos activos con al menos un componente de receta
-- el MISMO texto, sin una sola modificación, en las tres corridas
SELECT
    pr.id,
    pr.nombre,
    FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS stock_producible,
    (ARRAY_AGG(ins.nombre
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC;
```

Resultados: **Food Store** 6 filas, reproduciendo la tabla de divergencia. **Medusa** 20 filas. **WooCommerce** falla al resolver `v_receta_componente`.

---

## TAREA 1 — `ingredient.is_active` contra la base real (2026-09-21, solo lectura)

Consulta ejecutada, sin modificar ningún dato de Food Store:

```sql
SELECT count(*) FILTER (WHERE is_active = false) AS inactivos,
       count(*) AS total
FROM ingredient WHERE deleted_at IS NULL;
```

Resultado crudo:

```
 inactivos | total
-----------+-------
         0 |    14
```

**Nota de robustez.** `inactivos = 0` sobre las 14 filas no borradas de `ingredient` en la base real de Food Store. `is_active` existe como columna pero, al momento de esta verificación, ningún ingrediente real la usa para marcarse inactivo — todos los que no están borrados (`deleted_at IS NULL`) están activos. La tabla de divergencia de la sección 6.2.2, calculada sin este filtro, **no está afectada**: agregar `AND is_active = true` no habría excluido ninguna fila adicional, porque no hay ninguna fila con `is_active = false` que pasar por alto. No hizo falta re-ejecutar la consulta original ni la canónica con el filtro agregado, según lo indicado (solo se corre esa comparación si `inactivos > 0`).

---

## TAREA 2 — Verificación de la aritmética proporcional contra Medusa real (2026-09-21)

**Objetivo.** El PASO 5 corrió con datos del seed oficial donde `required_quantity = 1` en los 20 vínculos y ningún `inventory_item` compartido entre variantes, así que el `MIN()` de la consulta canónica siempre operó sobre un solo elemento dividido por 1 — no ejercitó la aritmética proporcional ni la selección del insumo limitante entre varios candidatos. Se hizo una modificación controlada, documentada y revertida, sobre la base real de Medusa (`medusa_db`), nunca sobre Food Store.

### a) Estado previo (registrado antes de tocar nada)

Tabla `product_variant_inventory_item`, filas involucradas:

```
                id                 |             variant_id             |        inventory_item_id         | required_quantity
-----------------------------------+------------------------------------+----------------------------------+-------------------
 pvitem_01M2Y2W2ZPZWZ5YQ6JBCW346AA | variant_01M2Y2W2W86H25DSB7KMSCC47J | iitem_01M2Y2W2Y872375F32J08SC3XF |                 1
 pvitem_01M2Y2W2ZQ43WYXVPGVD1269V0 | variant_01M2Y2W2W9EHVM9GA5NZYGQETN | iitem_01M2Y2W2Y85GDAR3TN4QK6089P |                 1
```

No existía ningún vínculo entre `variant_01M2Y2W2W9EHVM9GA5NZYGQETN` (T-Shirt S/White) e `iitem_01M2Y2W2Y872375F32J08SC3XF` (S/Black) antes de la modificación.

Stock de los dos `inventory_item` usados (`inventory_level`, sin cambios en toda la prueba):

```
        inventory_item_id         | stocked_quantity | reserved_quantity | (título)
-----------------------------------+------------------+--------------------+-----------
 iitem_01M2Y2W2Y85GDAR3TN4QK6089P |          1000000 |                  0 | S / White
 iitem_01M2Y2W2Y872375F32J08SC3XF |          1000000 |                  0 | S / Black
```

### b) Modificación aplicada (transacción única, 2026-09-21)

```sql
BEGIN;

UPDATE product_variant_inventory_item
SET required_quantity = 3, updated_at = now()
WHERE id = 'pvitem_01M2Y2W2ZPZWZ5YQ6JBCW346AA';

INSERT INTO product_variant_inventory_item
  (id, variant_id, inventory_item_id, required_quantity, created_at, updated_at)
VALUES
  ('pvitem_ch16b_test_share01', 'variant_01M2Y2W2W9EHVM9GA5NZYGQETN', 'iitem_01M2Y2W2Y872375F32J08SC3XF', 5, now(), now());

COMMIT;
```

Efecto: la variante S/Black pasa a requerir 3 unidades de su propio insumo (antes 1). La variante S/White queda con **dos** componentes de receta: su propio insumo (S/White, `required_quantity=1`) y el insumo de S/Black compartido (`required_quantity=5`, nuevo).

### c) `04_consulta_canonica.sql` sin modificar, corrida contra la base modificada

Filas relevantes de las 20 devueltas (salida cruda):

```
                 id                 |           nombre           | stock_producible | insumo_limitante | stock_insumo_limitante
------------------------------------+-----------------------------+------------------+------------------+------------------------
 variant_01M2Y2W2W9EHVM9GA5NZYGQETN | Medusa T-Shirt - S / White  |           200000 | S / Black        |                1000000
 variant_01M2Y2W2W86H25DSB7KMSCC47J | Medusa T-Shirt - S / Black  |           333333 | S / Black        |                1000000
```

(Las 18 filas restantes no tocadas por la modificación se mantuvieron en `1000000`, como en la corrida del PASO 5.)

### d) Verificación manual

- **S/Black:** un solo componente, insumo propio con stock 1.000.000 y `required_quantity=3` → 1.000.000 / 3 = 333.333,33… → `FLOOR = 333333`. Coincide con la salida.
- **S/White:** dos componentes. Insumo propio: 1.000.000 / 1 = 1.000.000. Insumo compartido (S/Black): 1.000.000 / 5 = 200.000. El mínimo es 200.000, y corresponde al insumo compartido → `stock_producible = 200000`, `insumo_limitante = "S / Black"`, `stock_insumo_limitante = 1000000` (el stock crudo del insumo limitante, no dividido). Coincide con la salida.

**La aritmética proporcional del `MIN()` y la selección del insumo limitante por `ARRAY_AGG ... ORDER BY` funcionan correctamente** cuando hay más de un componente por variante y cuando un insumo se comparte entre variantes con cantidades distintas — algo que la corrida del PASO 5, con el seed oficial sin modificar, no había ejercitado.

### e) Reversión y verificación

```sql
BEGIN;

UPDATE product_variant_inventory_item
SET required_quantity = 1, updated_at = now()
WHERE id = 'pvitem_01M2Y2W2ZPZWZ5YQ6JBCW346AA';

DELETE FROM product_variant_inventory_item
WHERE id = 'pvitem_ch16b_test_share01';

COMMIT;
```

Verificación posterior (no asumida): se volvió a listar la tabla completa. Las 20 filas quedaron idénticas al estado previo — mismos `id`, mismos `variant_id`/`inventory_item_id`, `required_quantity = 1` en las 20, y sin la fila `pvitem_ch16b_test_share01`. Confirmado por consulta, no por inferencia.

---

## TAREA 3 — Decisiones aplicadas (2026-09-21)

**DEC-28 confirmada por el usuario.** Las vistas canónicas exponen hechos crudos, no cálculos derivados. Registrada como firme en `docs/01-decisiones.md`.

**DEC-29, nueva.** `insumo."unidadMedida"` pasa de `obligatorio` a `opcional` en `src/contrato.ts`, aplicado. Criterio general que queda registrado para todo el catálogo: **un campo es obligatorio si y solo si al menos una automatización no puede ejecutarse sin él.** `unidadMedida` no lo usa ninguna automatización actual — `04_consulta_canonica.sql`, la implementación real de `stock-producible`, divide `stockDisponible` por `cantidadPorUnidad` sin leer ni validar la unidad. Tests de `src/contrato.test.ts` corridos después del cambio: 13/13 pasan.

**Revisión del resto del catálogo contra el criterio (hecha por el agente, sin cambiar nada más).** Se pudo verificar contra código real solo lo que tiene implementación: `stock-producible` vía `04_consulta_canonica.sql`. Resultado: `producto.id`, `producto.nombre`, `insumo.id`, `insumo.nombre`, `insumo.stockDisponible`, `receta_componente.productoId`, `receta_componente.insumoId` y `cantidadPorUnidad` están todos efectivamente leídos por esa consulta — ninguno de estos falla el criterio. `producto.stockDisponible` no lo usa `stock-producible`, pero su propio comentario en el contrato lo ata a `stock-fisico` como el valor que esa automatización reporta directamente, así que sigue pasando el criterio (alcanza con que una automatización lo necesite).

**Límite de esta revisión, reportado sin resolver.** Los campos obligatorios de `pedido` e `item_pedido` (atados a `reporte-diario`) **no se pudieron verificar contra código real**, porque ni `reporte-diario` ni `stock-fisico` tienen ninguna implementación en este repositorio todavía (CH-11/12/13 no existen). No hay ninguna consulta ni función contra la cual confirmar o refutar que cada campo sea indispensable para que esas automatizaciones se ejecuten. Aplicar el criterio ahí sin esa evidencia sería adivinar, así que no se tocó nada de `pedido`/`item_pedido`. Queda pendiente repetir esta revisión cuando esas automatizaciones tengan código.

---

## TAREA 4 — Procedimiento de adaptación: dos actores con privilegios distintos

Hallazgo del PASO 1, que hasta ahora no estaba escrito en ningún procedimiento: dar de alta una instalación nueva requiere **dos roles de base de datos distintos**, no uno.

1. **Un actor con permiso de escritura sobre el esquema** (en este proyecto, verificado contra la base real de Food Store: el usuario `postgres`, superusuario del contenedor). Es quien corre `CREATE VIEW` para instalar las tres vistas canónicas (`v_producto`, `v_insumo`, `v_receta_componente`). Este actor actúa una sola vez, en el momento del alta (o cuando el esquema de origen cambia y las vistas necesitan ajustarse), y no participa en la operación diaria del producto.
2. **El rol de solo lectura del producto** (en este proyecto, `lector_zerodashboard`), que es el que P2 usa para consultar. Verificado en la base real: este rol **no tiene `CREATE` sobre el esquema** (`has_schema_privilege('lector_zerodashboard','public','CREATE') = false`) y solo tiene `SELECT` sobre las tablas base. Después del alta, a este rol le alcanza con recibir `SELECT` sobre las tres vistas — nunca necesita, ni debe tener, permiso para crearlas o modificarlas.

Esto no es una casualidad del entorno de prueba: es consistente con la regla no negociable #3 de `AGENTS.md` (solo lectura en dos capas, aplicación + usuario de base sin permisos de escritura). La consecuencia para el procedimiento de adaptación es que **el alta de una instalación no la puede completar el mismo credential que el producto usa para operar**: hace falta pedirle al cliente (o a quien administre su base) un acceso de escritura de esquema, aunque sea transitorio, separado del acceso de solo lectura que el producto usará después. Este requisito no estaba anotado en ningún lado antes de esta verificación.

---

## Regeneración de la tabla de divergencia contra la base real (2026-09-22)

Motivo: la tabla de divergencia de la sección 6.2.2 de la tesis no coincide con lo que devolvió la corrida real. Todas las consultas de esta sección son **de solo lectura**; no se modificó ninguna fila de `food_store`.

### TAREA 1 — Tabla de divergencia regenerada desde las vistas canónicas

Consulta ejecutada (tal cual, sin modificar):

```sql
SELECT
    pr.id,
    pr.nombre,
    pr."stockDisponible" AS stock_declarado,
    FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS stock_producible,
    (ARRAY_AGG(ins.nombre
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre, pr."stockDisponible"
ORDER BY pr.nombre;
```

Salida cruda completa:

```
 id |        nombre         | stock_declarado | stock_producible | insumo_limitante
----+-----------------------+-----------------+------------------+------------------
 6  | Aros de Cebolla       |              80 |               70 | Cebolla
 2  | Hamburguesa BBQ Bacon |              30 |               20 | Bacon
 1  | Hamburguesa Clásica   |              50 |               50 | Tomate
 3  | Hamburguesa Doble     |              25 |               40 | Carne vacuna
 4  | Hamburguesa Picante   |              20 |               15 | Jalapeños
 5  | Papas Fritas          |             100 |              250 | Papas
(6 rows)
```

### TAREA 2 — El denominador

```
 productos_con_receta_activos
------------------------------
                            6
```

```
 filas_totales | con_divergencia | sin_divergencia
---------------+-----------------+-----------------
             6 |               5 |               1
```

**Consecuencia directa sobre la afirmación de la tesis.** La tesis afirma que "la totalidad" de los productos con receta presentó divergencia. Sobre la base real, de 6 productos con receta activos, **5 divergen y 1 no**: `Hamburguesa Clásica` tiene `stock_declarado = 50` y `stock_producible = 50`. La afirmación "la totalidad" no se sostiene con estos datos; el número correcto es 5 de 6.

### TAREA 3 — Diferencia con la tabla de la tesis

**a) "Hamburguesa Nueva" no existe en `product`.** `SELECT * FROM product WHERE name ILIKE '%Nueva%'` devolvió `(0 rows)`. No está borrada lógicamente: no está. El listado completo de `product` (9 filas, ninguna con `deleted_at`) es:

```
 id |         name          | stock_quantity | available | deleted_at |         created_at
----+-----------------------+----------------+-----------+------------+----------------------------
  1 | Hamburguesa Clásica   |             50 | t         |            | 2026-09-17 13:07:31.644378
  2 | Hamburguesa BBQ Bacon |             30 | t         |            | 2026-09-17 13:07:31.705501
  3 | Hamburguesa Doble     |             25 | t         |            | 2026-09-17 13:07:31.738721
  4 | Hamburguesa Picante   |             20 | t         |            | 2026-09-17 13:07:31.791792
  5 | Papas Fritas          |            100 | t         |            | 2026-09-17 13:07:31.827475
  6 | Aros de Cebolla       |             80 | t         |            | 2026-09-17 13:07:31.836429
  7 | Coca Cola 500ml       |            150 | t         |            | 2026-09-17 13:07:31.844481
  8 | Agua Mineral 500ml    |            200 | t         |            | 2026-09-17 13:07:31.866781
  9 | Brownie de Chocolate  |             40 | t         |            | 2026-09-17 13:07:31.878563
(9 rows)
```

**b) `created_at` de "Papas Fritas":**

```
 id |     name     |         created_at
----+--------------+----------------------------
  5 | Papas Fritas | 2026-09-17 13:07:31.827475
```

**c) `created_at`/`updated_at` de los productos con receta y de todos los ingredientes.** Productos con receta:

```
 id |         name          | available | deleted_at |         created_at         |         updated_at
----+-----------------------+-----------+------------+----------------------------+----------------------------
  1 | Hamburguesa Clásica   | t         |            | 2026-09-17 13:07:31.644378 | 2026-09-17 13:07:31.644405
  2 | Hamburguesa BBQ Bacon | t         |            | 2026-09-17 13:07:31.705501 | 2026-09-17 13:07:31.705516
  3 | Hamburguesa Doble     | t         |            | 2026-09-17 13:07:31.738721 | 2026-09-17 13:07:31.738737
  4 | Hamburguesa Picante   | t         |            | 2026-09-17 13:07:31.791792 | 2026-09-17 13:07:31.791843
  5 | Papas Fritas          | t         |            | 2026-09-17 13:07:31.827475 | 2026-09-17 13:07:31.827506
  6 | Aros de Cebolla       | t         |            | 2026-09-17 13:07:31.836429 | 2026-09-17 13:07:31.836452
(6 rows)
```

Ingredientes (14 filas, ninguna borrada, todas `is_active = t`):

```
 id |     name      | stock_quantity | is_active | deleted_at |         created_at         |         updated_at
----+---------------+----------------+-----------+------------+----------------------------+----------------------------
  1 | Pan brioche   |            120 | t         |            | 2026-09-17 13:07:31.605966 | 2026-09-17 13:07:31.605988
  2 | Carne vacuna  |             80 | t         |            | 2026-09-17 13:07:31.61179  | 2026-09-17 13:07:31.611815
  3 | Lechuga       |             60 | t         |            | 2026-09-17 13:07:31.614863 | 2026-09-17 13:07:31.614903
  4 | Tomate        |             50 | t         |            | 2026-09-17 13:07:31.617426 | 2026-09-17 13:07:31.617445
  5 | Cebolla       |             70 | t         |            | 2026-09-17 13:07:31.620177 | 2026-09-17 13:07:31.620193
  6 | Queso cheddar |             90 | t         |            | 2026-09-17 13:07:31.621862 | 2026-09-17 13:07:31.621887
  7 | Bacon         |             40 | t         |            | 2026-09-17 13:07:31.623984 | 2026-09-17 13:07:31.623998
  8 | Mayonesa      |            200 | t         |            | 2026-09-17 13:07:31.625464 | 2026-09-17 13:07:31.625478
  9 | Ketchup       |            200 | t         |            | 2026-09-17 13:07:31.626682 | 2026-09-17 13:07:31.626697
 10 | Mostaza       |            150 | t         |            | 2026-09-17 13:07:31.627847 | 2026-09-17 13:07:31.627861
 11 | Salsa BBQ     |            100 | t         |            | 2026-09-17 13:07:31.629204 | 2026-09-17 13:07:31.62922
 12 | Jalapeños     |             30 | t         |            | 2026-09-17 13:07:31.630785 | 2026-09-17 13:07:31.630804
 13 | Papas         |            250 | t         |            | 2026-09-17 13:07:31.633777 | 2026-09-17 13:07:31.633794
 14 | Huevo         |              8 | t         |            | 2026-09-17 13:07:31.635835 | 2026-09-17 13:07:31.635849
(14 rows)
```

Rango de fechas de todo el catálogo:

```
       tabla        |          primera           |           ultima           |       ultimo_update        | count
--------------------+----------------------------+----------------------------+----------------------------+-------
 product            | 2026-09-17 13:07:31.644378 | 2026-09-17 13:07:31.878563 | 2026-09-17 13:07:31.878598 |     9
 ingredient         | 2026-09-17 13:07:31.605966 | 2026-09-17 13:07:31.635835 | 2026-09-17 13:07:31.635849 |    14
 product_ingredient | 2026-09-17 13:07:31.668669 | 2026-09-17 13:07:31.841891 |                            |    26
```

**Lo que dicen las fechas, sin interpretar más allá del dato.** Las 49 filas de las tres tablas (9 productos, 14 ingredientes, 26 vínculos de receta) tienen `created_at` dentro de la misma ventana de **273 milisegundos del 2026-09-17 13:07:31**. En todas las filas `updated_at` es igual a `created_at` salvo por microsegundos: **ninguna fila fue modificada después de haber sido creada.** No hay ninguna fila anterior al 2026-09-17 en ninguna de las tres tablas, ni ninguna fila borrada lógicamente.

### Comparación mecánica: tabla de la tesis vs. base real

| Producto | Tesis (declarado/producible/limitante) | Base real (declarado/producible/limitante) | Coincide |
|---|---|---|---|
| Hamburguesa BBQ Bacon | 30 / 20 / Bacon | 30 / 20 / Bacon | sí |
| Hamburguesa Picante | 20 / 24 / Jalapeños | 20 / 15 / Jalapeños | no (producible) |
| Hamburguesa Nueva | 0 / 31 / Queso cheddar | — (no existe en `product`) | no (ausente) |
| Hamburguesa Doble | 25 / 38 / Carne vacuna | 25 / 40 / Carne vacuna | no (producible) |
| Hamburguesa Clásica | 50 / 47 / Tomate | 50 / 50 / Tomate | no (producible; además deja de haber divergencia) |
| Aros de Cebolla | 80 / 67 / Cebolla | 80 / 70 / Cebolla | no (producible) |
| Papas Fritas | — (no figura) | 100 / 250 / Papas | no (sobra) |

El `stock_declarado` coincide en las cinco filas comparables. Lo que difiere es el `stock_producible` en cuatro de ellas, más una fila ausente y una sobrante. El insumo limitante coincide en todas las filas comparables.

### Lo que esta verificación NO establece

No se puede determinar desde la base por qué la tabla de la tesis difiere. Los `created_at` muestran cuándo se cargaron las filas actuales, no qué valores tenían antes ni si hubo una carga anterior distinta: como `updated_at` nunca se separó de `created_at` y no hay filas borradas, **la base no conserva ningún rastro de un estado previo** contra el cual comparar. Cualquier explicación sobre el origen de los números de la tesis (una carga anterior del catálogo, datos tomados de otro entorno, o cálculo manual) queda fuera de lo que estas consultas pueden sostener. No se modificó la tesis ni ningún documento fuera de esta bitácora.

---

## Lo que falta hacer vos (actualizado 2026-09-21)

1. ~~Correr `03_vistas_foodstore.sql` contra la base real de Food Store.~~ **Hecho.** Ver "Re-ejecución contra bases reales". No hizo falta ajustar columnas, solo el `search_path`.
2. ~~Correr `04_consulta_canonica.sql` contra esas vistas reales y comparar con la consulta original.~~ **Hecho.** Diferencia simétrica 0/0, intersección 6 filas.
3. ~~Correr las mismas vistas contra tu instancia real de Medusa.~~ **Hecho.** 20 filas, portabilidad confirmada.
4. ~~Verificar `src/contrato.ts`.~~ **Hecho.** `sku` es opcional (sin conflicto); `unidadMedida` era obligatorio y no lo satisfacía Food Store — resuelto con DEC-29.
5. ~~Decidir DEC-28~~ **Hecho.** Confirmada por el usuario, firme.
6. **Verificar la ausencia en WooCommerce contra fuente primaria.** Sigue pendiente. Los enlaces están en la sección siguiente; leelos antes de citarlos. Además, **no hay instancia real de WooCommerce en este proyecto** — V-6/V-7/V-8 siguen corriendo solo sobre fixture y no se re-ejecutaron.
7. ~~Decidir qué hacer con el conflicto de `unidadMedida`.~~ **Hecho.** DEC-29: pasa a opcional, con criterio general registrado para todo el catálogo.
8. **Nuevo: repetir la revisión del criterio de DEC-29 sobre `pedido`/`item_pedido`** cuando `reporte-diario` y `stock-fisico` tengan implementación real (CH-11/12/13). No se pudo verificar esta ronda por falta de código contra el cual comprobar cada campo.

---

## Fuentes sobre el esquema de WooCommerce

Verificadas el 2026-09-21. **Leelas antes de citarlas.**

- Almacenamiento de productos como *custom post type* en `wp_posts` con `post_type='product'` y `'product_variation'`, atributos en `wp_postmeta` con las claves `_sku`, `_stock`, `_stock_status`, `_price`, `_regular_price`; variaciones vinculadas por `post_parent`: https://usersinsights.com/woocommerce-products-database/
- High-Performance Order Storage: tablas `wc_orders`, `wc_order_addresses`, `wc_order_operational_data`, `wc_orders_meta`, con `wc_orders` conteniendo `id`, `status`, `currency`, `total_amount`, `date_created_gmt`, `customer_id`. Las líneas de pedido quedan explícitamente fuera del alcance y permanecen en sus tablas previas: https://developer.woocommerce.com/2022/09/15/high-performance-order-storage-database-schema/
- Pedido de funcionalidad de *bill of materials / assemblies*, respondido por el desarrollador de una extensión de terceros, que reconoce las listas de materiales como "parte estándar de la gestión de inventario" y las plantea como agregado opcional. El pedido enumera lo que no se puede hacer: definir qué componentes forman un producto terminado, descontar el inventario de componentes automáticamente al vender, y ocultar los componentes de la tienda: https://woocommerce.com/feature-request/bill-of-materials-assemblies/

> Nota sobre esta última fuente: es un pedido de funcionalidad en el sitio de WooCommerce, respondido por un tercero, no documentación oficial del núcleo. Sirve como evidencia de que la funcionalidad se provee por extensiones y no por el núcleo, pero **conviene complementarla** con la documentación oficial de gestión de inventario de WooCommerce, que enumera qué campos de stock existen.

---

## Notas para la tesis

**Capítulo 6, resultado principal.** La taxonomía de cuatro clases de obstáculo, más la quinta categoría de datos no representativos, derivada de tres esquemas. Es un resultado que puede fallar y falló parcialmente: la clase que se había predicho como paradigmática (ausencia) no apareció en el esquema elegido, y aparecieron dos clases intermedias que no se habían previsto. Eso es preferible a una taxonomía que se confirma sola.

**Capítulo 6, portabilidad.** La afirmación citable es precisa: un archivo SQL, idéntico byte por byte, corrió contra dos esquemas independientes produciendo resultados correctos en ambos, y falló de forma cerrada contra un tercero que carece del concepto. Lo que cambia entre instalaciones son las tres vistas; la consulta no se toca.

**Capítulo 4, decisión de arquitectura.** DEC-28: las vistas exponen hechos crudos, no cálculos derivados. Con su justificación: precalcular el producible en la vista haría inobservable la divergencia declarado/producible, que es el hallazgo central del trabajo.

**Capítulo 6, barreras.** La clase 3 (entidad-atributo-valor) es material para la barrera de entrada: escribir `v_producto` sobre WooCommerce exige entender que los atributos de un producto son filas y no columnas, y que cada campo cuesta una reunión. Es conocimiento de modelo de datos que no se sigue de saber SQL.

**Lo que esta entrada NO sostiene.** Nada sobre tiempos de onboarding: el trabajo se hizo sobre fixtures, no sobre una instalación nueva real. La métrica de costo de adaptación sigue sin medirse.
