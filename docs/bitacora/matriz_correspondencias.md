# Matriz de correspondencias: contrato canónico × plataformas

**Fecha:** 2026-09-24.
**Alcance:** solo lectura. No se crearon ni modificaron vistas. La matriz se construyó leyendo los archivos citados; no se ejecutó SQL.

**Fuentes de las expresiones:**

| Plataforma | Archivo | Vistas | ¿Corrió sobre una instancia real? |
|---|---|---|---|
| Food Store | `openspec/changes/CH-16b-vistas-canonicas/sql/03_vistas_foodstore.sql` | `v_producto`, `v_insumo`, `v_receta_componente` | Sí: base `food_store`, esquema `public`, 2026-09-21 (`bitacora_CH-16b_tres_esquemas.md:15`) |
| Medusa | `openspec/changes/CH-16b-vistas-canonicas/sql/06_vistas_medusa.sql` | `v_producto`, `v_insumo`, `v_receta_componente` | Sí: `ch16-medusa-pg`, base `medusa_db` (`bitacora_CH-16b_tres_esquemas.md:16`); Medusa 2.21.0 (`bitacora_medusa_version.md:13`) |
| Medusa | `docs/bitacora/CH-16-mapeo-del-segundo-esquema.md:144-170` | `v_pedido`, `v_item_pedido` | Sí, pero solo el `CREATE VIEW`: 0 filas, porque el seed no crea pedidos (`CH-16-mapeo-del-segundo-esquema.md:36`, V-9 en `:53`) |
| WooCommerce | `openspec/changes/CH-16b-vistas-canonicas/sql/08_vistas_woo.sql` | `v_producto` | **No.** Ver "Registro de ejecución de `08_vistas_woo.sql`" |
| Saleor | `openspec/changes/CH-16c-saleor-caso-negativo/sql/10_vistas_saleor.sql` (idéntico a `docs/saleor_kit/08_vistas_saleor.sql`) | `v_producto` | Sí: Saleor 3.23.36, 81 filas (`bitacora_CH-16c_saleor.md:4`, `:475`) |

Nota: `06_vistas_medusa.sql:2` dice transcribir las vistas de CH-16 "TAL CUAL", pero omite `v_pedido` y `v_item_pedido`. Las expresiones de pedido e item_pedido de Medusa se toman de la bitácora de CH-16 (decisión del autor, 2026-09-24).

---

## Registro de ejecución de `08_vistas_woo.sql`

**No hay registro de ejecución sobre una instancia real de WooCommerce.** El archivo corrió solo sobre un fixture (`07_woocommerce_fixture.sql`): una réplica mínima en PostgreSQL, con 3 productos inventados y sin variaciones.

- Motor y versión de la corrida sobre el fixture: PostgreSQL 16.13. `bitacora_CH-16b_tres_esquemas.md:88`: "Entorno: PostgreSQL 16.13, instancia local, tres esquemas (`foodstore`, `medusa`, `woo`) en la misma base."
- Fecha: 2026-09-21. `bitacora_CH-16b_tres_esquemas.md:3`: "**Fecha de la corrida sobre fixtures:** 2026-09-21."
- Salida registrada: solo el resumen de V-6, sin archivo de salida guardado. `bitacora_CH-16b_tres_esquemas.md:97`: "3 filas correctas, con `sku` y `stockDisponible` pivotados desde `meta_key`".
- Línea que prueba que no hubo corrida real, `bitacora_CH-16b_tres_esquemas.md:17`: "V-6, V-7, V-8 (WooCommerce) | **Sin cambios: siguen siendo fixture.** No hay instancia real de WooCommerce en este proyecto."
- Historial de git: el archivo aparece en un único commit, `fc54f19` (2026-09-21 21:33 -0300, "CH-16b: vistas canonicas contra bases reales y DEC-28/DEC-29").
- El SQL usa conversiones `::` (`p.ID::text`, `meta_value::numeric`, `::int`), que son de PostgreSQL. WooCommerce corre sobre MySQL/MariaDB (`docs/01-decisiones.md:475`), así que el archivo tal como está no correría sobre una instancia real sin reescribirlo.

---

## Criterio aplicado

En orden: **1** Directa · **2** Granularidad · **3** Entidad-atributo-valor · **4** Ausencia. Marcas adicionales:

- **NI**: no implementado (no hay vista para la entidad en esa plataforma).
- **?**: el criterio no alcanza para decidir. Se indican las clases candidatas y la referencia a la sección "Casos donde el criterio no alcanza". No se elige ninguna.

La clase se asigna a partir de la expresión que produce el valor del atributo. Los filtros de fila (`WHERE`, `JOIN` que solo filtran) no se tomaron como parte de esa expresión; esa lectura se marca como caso T-1.

---

## 1. `producto` (5 atributos)

| Atributo | Plataforma | Expresión | Clase | Justificación |
|---|---|---|---|---|
| id | Food Store | `p.id::text` (`03:18`) | 1 | Una columna de `product` con conversión de tipo, misma fila. |
| id | Medusa | `pv.id` (`06:4`) | ? (1 o 2), G-1 | Columna de la fila de `product_variant`, pero esa fila es la canónica por la decisión de nivel DEC-27 (`FROM product_variant pv JOIN product p`, `06:9-10`). |
| id | WooCommerce | `p.ID::text` (`08:6`) | ? (1 o 2), G-1/G-2 | Columna de `wp_posts`, pero la vista admite filas de dos niveles de la cadena: `post_type IN ('product','product_variation')` (`08:14`). |
| id | Saleor | `pv.id::text` (`10:26`) | ? (1 o 2), G-1 | Columna de `product_productvariant`, fila canónica a nivel de variante (`10:11`, `10:35-36`). |
| nombre | Food Store | `p.name` (`03:19`) | 1 | Una columna, misma fila. |
| nombre | Medusa | `p.title \|\| ' - ' \|\| pv.title` (`06:5`) | 2 | Combina columnas de dos niveles de la cadena (`product` y `product_variant`). La reunión con el padre no es con una tabla de valores enumerados, así que la cláusula 1 no aplica; la composición sigue de la decisión de nivel DEC-27. |
| nombre | WooCommerce | `p.post_title` (`08:7`) | ? (1 o 2), G-1/G-2 | Una columna de `wp_posts`, con la misma cuestión de nivel que `id`. |
| nombre | Saleor | `CASE WHEN pv.name IS NULL OR pv.name = '' THEN p.name ELSE p.name \|\| ' - ' \|\| pv.name END` (`10:27-28`) | 2 | Combina `product_product` y `product_productvariant` (dos niveles de la cadena), igual que en Medusa. |
| stockDisponible | Food Store | `p.stock_quantity` (`03:20`) | 1 | Una columna, misma fila ("declarado, crudo"). |
| stockDisponible | Medusa | `COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)` con `GROUP BY pv.id, …` (`06:6`, `06:11-14`) | 2 | Agrega varias filas en una: suma sobre todos los `inventory_item` de la variante y, por cada uno, sobre todas sus filas de `inventory_level` (una por ubicación). |
| stockDisponible | WooCommerce | `COALESCE(m_stock.meta_value::numeric, 0)::int` con `LEFT JOIN wp_postmeta m_stock … AND m_stock.meta_key = '_stock'` (`08:8`, `08:12`) | ? (2 o 3), G-1/G-2 | Fila de una tabla clave-valor filtrada por clave (cláusula 3). Como el criterio se aplica en orden, sería clase 2 si la cuestión de nivel G-1/G-2 cuenta para este atributo. |
| stockDisponible | Saleor | `COALESCE(SUM(s.quantity - s.quantity_allocated), 0)` con `LEFT JOIN warehouse_stock s` y `GROUP BY pv.id, …` (`10:29`, `10:37-38`) | 2 | Agrega sobre todos los depósitos de la variante (DEC-37). |
| sku | Food Store | `NULL::text` (`03:21`) | 4 | "SIN ORIGEN en Food Store": no hay columna de la cual derivarlo. |
| sku | Medusa | `pv.sku` (`06:7`) | ? (1 o 2), G-1 | Columna de la fila de variante; misma cuestión que `id`. |
| sku | WooCommerce | `m_sku.meta_value` con `LEFT JOIN wp_postmeta m_sku … AND m_sku.meta_key = '_sku'` (`08:9`, `08:13`) | ? (2 o 3), G-1/G-2 | Clave-valor filtrado por clave, como `stockDisponible`. |
| sku | Saleor | `pv.sku` (`10:30`) | ? (1 o 2), G-1 | Columna de la fila de variante. |
| activo | Food Store | `p.available` (`03:22`) | 1 | Una columna, misma fila. |
| activo | Medusa | `(p.status = 'published')` (`06:8`) | 2 | Expresión sobre una columna del padre `product`, leída desde la fila de variante mediante la reunión `JOIN product p` (`06:10`); no es una tabla de valores enumerados. |
| activo | WooCommerce | `(p.post_status = 'publish')` (`08:10`) | ? (1 o 2), G-1/G-2 | Expresión sobre una columna de la misma fila, con la misma cuestión de nivel que `id`. |
| activo | Saleor | `EXISTS (SELECT 1 FROM product_productchannellisting pcl WHERE pcl.product_id = p.id AND pcl.is_published)` (`10:31-34`) | 2 | Resume varias filas (una por canal) en un booleano: "publicado en al menos un canal" (DEC-38). El propio archivo lo llama "una decisión de granularidad, no una columna" (`10:20`). |

## 2. `pedido` (6 atributos)

| Atributo | Plataforma | Expresión | Clase | Justificación |
|---|---|---|---|---|
| id | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_pedido`. |
| id | Medusa | `o.id` (`CH-16:146`) | 1 | Una columna de `"order"`, misma fila. |
| fechaCreacion | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_pedido`. |
| fechaCreacion | Medusa | `o.created_at` (`CH-16:147`) | 1 | Una columna, misma fila. |
| estado | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_pedido`. |
| estado | Medusa | `o.status::text` (`CH-16:148`) | 1 | Conversión de una columna de tipo enum de la misma fila; no hay reunión. |
| total | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_pedido`. |
| total | Medusa | sin vista: omitido a propósito de `v_pedido` (`CH-16:134-142`) | ? (2, 3 o 4), G-4 | No hay expresión para clasificar. El dato estaría en `order_summary.totals` (jsonb), sin verificar (`CH-16:219`). |
| numero | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_pedido`. |
| numero | Medusa | `o.display_id` (`CH-16:149`) | 1 | Una columna, misma fila. |
| moneda | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_pedido`. |
| moneda | Medusa | `o.currency_code` (`CH-16:150`) | 1 | Una columna, misma fila. |

`CH-16` = `docs/bitacora/CH-16-mapeo-del-segundo-esquema.md`.

## 3. `item_pedido` (5 atributos)

| Atributo | Plataforma | Expresión | Clase | Justificación |
|---|---|---|---|---|
| id | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_item_pedido`. |
| id | Medusa | `oi.id` (`CH-16:164`) | 1 | Una columna de `order_item`, misma fila. |
| pedidoId | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_item_pedido`. |
| pedidoId | Medusa | `oi.order_id` (`CH-16:165`) | 1 | Una columna, misma fila. |
| productoId | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_item_pedido`. |
| productoId | Medusa | `oli.variant_id` con `JOIN order_line_item oli ON oli.id = oi.item_id` (`CH-16:166`, `CH-16:169-170`) | ? (1 o 2), G-3 | La columna viene de otra tabla reunida (`order_line_item`), que no es de valores enumerados; la cláusula 1 no la nombra y no está claro que la cláusula 2 aplique. |
| cantidad | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_item_pedido`. |
| cantidad | Medusa | `oi.quantity` (`CH-16:167`) | 1 | Una columna de `order_item`, misma fila. |
| precioUnitario | Food Store / WooCommerce / Saleor | sin vista | NI | No hay `v_item_pedido`. |
| precioUnitario | Medusa | `oli.unit_price` (`CH-16:168`, reunión en `CH-16:170`) | ? (1 o 2), G-3 | Igual que `productoId`. |

## 4. `insumo` (5 atributos)

| Atributo | Plataforma | Expresión | Clase | Justificación |
|---|---|---|---|---|
| id | Food Store | `i.id::text` (`03:28`) | 1 | Una columna de `ingredient` con conversión de tipo. |
| id | Medusa | `ii.id` (`06:17`) | 1 | Columna de `inventory_item`. El `GROUP BY ii.id` (`06:22`) agrupa por la clave primaria de la misma tabla y no cambia la granularidad de este atributo. |
| id | WooCommerce | sin vista | 4 | No hay tabla ni convención de insumo (V-7, `bitacora_CH-16b_tres_esquemas.md:98`). Ver salvedad E-1. |
| id | Saleor | sin vista | 4 | "v_insumo y v_receta_componente NO se crean: el paso 07 debe mostrar que no hay de dónde derivarlas" (`10:5-6`); el código fuente no tiene un modelo de composición (`bitacora_CH-16c_saleor.md:27`). |
| nombre | Food Store | `i.name` (`03:29`) | 1 | Una columna, misma fila. |
| nombre | Medusa | `ii.title` (`06:17`) | 1 | Una columna, misma fila. |
| nombre | WooCommerce | sin vista | 4 | Igual que `id`. E-1. |
| nombre | Saleor | sin vista | 4 | Igual que `id`. |
| stockDisponible | Food Store | `i.stock_quantity` (`03:30`) | 1 | Una columna, misma fila. |
| stockDisponible | Medusa | `COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)` con `LEFT JOIN inventory_level il` y `GROUP BY ii.id, …` (`06:18`, `06:21-22`) | 2 | **Suma sobre ubicaciones.** Ver la sección 6. |
| stockDisponible | WooCommerce | sin vista | 4 | Igual que `id`. E-1. |
| stockDisponible | Saleor | sin vista | 4 | Igual que `id`. |
| unidadMedida | Food Store | `NULL::text` (`03:31`) | 4 | "SIN ORIGEN en Food Store". |
| unidadMedida | Medusa | `ii.unit_of_measure` (`06:19`) | 1 | Una columna, misma fila. La columna existe aunque el seed la deja NULL en 20/20 (`bitacora_CH-16b_tres_esquemas.md:96`); eso es un problema de datos, no de estructura. |
| unidadMedida | WooCommerce | sin vista | 4 | Igual que `id`. E-1. |
| unidadMedida | Saleor | sin vista | 4 | Igual que `id`. |
| codigo | Food Store | `NULL::text` (`03:32`) | 4 | "SIN ORIGEN en Food Store". |
| codigo | Medusa | `ii.sku` (`06:19`) | 1 | Una columna, misma fila. |
| codigo | WooCommerce | sin vista | 4 | Igual que `id`. E-1. |
| codigo | Saleor | sin vista | 4 | Igual que `id`. |

## 5. `receta_componente` (3 atributos)

| Atributo | Plataforma | Expresión | Clase | Justificación |
|---|---|---|---|---|
| productoId | Food Store | `pi.product_id::text` (`03:38`) | 1 | Una columna de `product_ingredient`. Los `JOIN product` y `JOIN ingredient` (`03:42-43`) solo filtran filas (T-1). |
| productoId | Medusa | `pvi.variant_id` (`06:25`) | 1 | Una columna de `product_variant_inventory_item`, misma fila. Apunta a la variante, en coherencia con DEC-27 (ver la nota de G-1). |
| productoId | WooCommerce | sin vista | 4 | No hay estructura de composición (V-7, `bitacora_CH-16b_tres_esquemas.md:98`). E-1. |
| productoId | Saleor | sin vista | 4 | `10:5-6`; `bitacora_CH-16c_saleor.md:27`. |
| insumoId | Food Store | `pi.ingredient_id::text` (`03:39`) | 1 | Una columna, misma fila. |
| insumoId | Medusa | `pvi.inventory_item_id` (`06:25`) | 1 | Una columna, misma fila. |
| insumoId | WooCommerce | sin vista | 4 | Igual que `productoId`. E-1. |
| insumoId | Saleor | sin vista | 4 | Igual que `productoId`. |
| cantidadPorUnidad | Food Store | `pi.quantity` (`03:40`) | 1 | Una columna, misma fila. |
| cantidadPorUnidad | Medusa | `pvi.required_quantity` (`06:26`) | 1 | Una columna, misma fila. |
| cantidadPorUnidad | WooCommerce | sin vista | 4 | Igual que `productoId`. E-1. |
| cantidadPorUnidad | Saleor | sin vista | 4 | Igual que `productoId`. |

---

## 6. Medusa: ¿`insumo.stockDisponible` suma sobre las ubicaciones de `inventory_level`?

**Sí. Por eso es clase 2.**

- Expresión: `COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)` sobre `FROM inventory_item ii LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku` (`06_vistas_medusa.sql:18`, `:20-22`).
- `inventory_level` tiene una fila por par (ítem, `location_id`), así que la suma es sobre ubicaciones (`bitacora_medusa_version.md:85`).
- **Con los datos de la instancia, la suma nunca agrega más de una fila:** 0 de 20 ítems tienen más de una fila en `inventory_level`, y hay 1 sola `stock_location` (`bitacora_medusa_version.md:16`). La clase 2 sale de la estructura que el SQL tiene que resolver, no de un caso que se haya visto en los datos.
- La forma de agregar (sumar sin descartar ubicaciones) quedó como elección de implementación en `CH-16-mapeo-del-segundo-esquema.md:27`. No tiene una DEC propia. Para Saleor, la pregunta equivalente sí se registró (DEC-37), y el archivo de Saleor la llama "la misma pregunta que quedó abierta para insumo.stockDisponible en Medusa" (`10_vistas_saleor.sql:16`).
- La vista no filtra `deleted_at` en `inventory_level` ni en `inventory_item` (`bitacora_medusa_version.md:87`). Es un filtro de filas (T-1) y no cambia la clase.

`producto.stockDisponible` en Medusa también es clase 2, y agrega en dos ejes: sobre los `inventory_item` de la variante y sobre sus ubicaciones (`06:11-14`).

---

## 7. Conteo

### Por clase y por plataforma (24 atributos × 4 plataformas = 96 correspondencias)

| Clase | Food Store | Medusa | WooCommerce | Saleor | Total |
|---|---|---|---|---|---|
| 1. Directa | 10 | 15 | 0 | 0 | 25 |
| 2. Granularidad | 0 | 4 | 0 | 3 | 7 |
| 3. Entidad-atributo-valor | 0 | 0 | 0 | 0 | 0 |
| 4. Ausencia | 3 | 0 | 8 | 8 | 19 |
| ? El criterio no alcanza | 0 | 5 | 5 | 2 | 12 |
| NI No implementado | 11 | 0 | 11 | 11 | 33 |
| **Total** | **24** | **24** | **24** | **24** | **96** |

Detalle de las celdas marcadas con ?:
- Medusa (5): `producto.id`, `producto.sku` (G-1); `pedido.total` (G-4); `item_pedido.productoId`, `item_pedido.precioUnitario` (G-3).
- WooCommerce (5): todos los atributos de `producto` (G-1/G-2).
- Saleor (2): `producto.id`, `producto.sku` (G-1).

### Sensibilidad a G-1 (sin decidirla)

G-1 afecta 9 de las 12 celdas marcadas con ?. Lo que muestra la tabla es el efecto de cada lectura posible, no una elección.

| Lectura de G-1 | Efecto sobre las 9 celdas | 1 | 2 | 3 | 4 | ? restantes |
|---|---|---|---|---|---|---|
| (A) La clase depende solo de la expresión del atributo | Medusa y Saleor `id`/`sku` → 1; WooCommerce `id`/`nombre`/`activo` → 1 y `stockDisponible`/`sku` → 3 | 32 | 7 | 2 | 19 | 3 |
| (B) La decisión de nivel de la entidad alcanza a todos sus atributos | las 9 → 2 (la cláusula 2 se evalúa antes que la 3) | 25 | 16 | 0 | 19 | 3 |

La clase 3 solo aparece con la lectura A. La tabla de `bitacora_CH-16b_tres_esquemas.md:111`, que presenta a WooCommerce como el caso de clase 3, supone implícitamente esa lectura.

---

## 8. Casos donde el criterio no alcanza (no decididos)

**G-1. ¿La decisión de nivel de la entidad alcanza a cada atributo?** La cláusula 2 habla de "a qué nivel de una cadena de entidades corresponde la fila canónica", que es una propiedad de la fila. La cláusula 1 exige "sin cambio de granularidad", pero no dice respecto de qué. Cuando la fila canónica es la variante por decisión (DEC-27 en Medusa; `10_vistas_saleor.sql:11` en Saleor), un atributo que es una columna de esa misma fila (`pv.id`, `pv.sku`) cumple la letra de la cláusula 1, pero existe como fila canónica por una decisión de clase 2. Celdas: Medusa `producto.id` y `producto.sku`; Saleor `producto.id` y `producto.sku`; los 5 atributos de `producto` en WooCommerce (sumando G-2). Candidatas: 1 o 2 (2 o 3 en WooCommerce `stockDisponible` y `sku`).
- *Relacionado, no marcado:* `nombre` y `activo` de Medusa y `nombre` de Saleor se clasificaron como 2 con cualquiera de las dos lecturas: leen columnas del padre mediante una reunión que no es con una tabla de valores enumerados, así que la cláusula 1 no aplica en ningún caso. En Medusa, `receta_componente.productoId` (`pvi.variant_id`) se clasificó como 1 porque la fila de receta no requirió una decisión de nivel propia; su referente, en cambio, depende de DEC-27. Si G-1 se resuelve haciendo que la decisión alcance también a las referencias, esa celda habría que revisarla.

**G-2. WooCommerce: la vista no elige un nivel.** `WHERE p.post_type IN ('product','product_variation')` (`08:14`) mezcla en `v_producto` filas de producto padre y de variación, que forman una cadena por `post_parent` (`bitacora_CH-16b_tres_esquemas.md:467`). El criterio pregunta si "hay que decidir" el nivel; aquí habría que decidirlo, pero la vista no lo hizo, y el fixture no tiene variaciones (`07_woocommerce_fixture.sql:17-20`, todas con `post_parent` 0), así que el caso nunca se ejercitó. El criterio no dice cómo clasificar una correspondencia cuya decisión de granularidad quedó sin tomar.

**G-3. Medusa `item_pedido`: reunión 1 a 1 con una tabla que no es de valores enumerados.** `productoId` y `precioUnitario` salen de `order_line_item`, reunida desde `order_item` (`CH-16:169-170`). La cláusula 1 solo admite reunir con una tabla de valores enumerados; la cláusula 2 requiere decidir un nivel en una cadena o agregar filas. Aquí no se agregan filas, y el criterio no dice si repartir un mismo concepto (la línea de pedido) en dos tablas cuenta como una "cadena de entidades" (`CH-16:153-155`). Candidatas: 1 o 2.

**G-4. Medusa `pedido.total`: no hay expresión.** Se dejó fuera de `v_pedido` a propósito (`CH-16:134-142`). El criterio clasifica cómo se produce un valor, y acá no hay SQL. La estructura existe (`order_summary.totals`, jsonb, `CH-16:219`), así que "no hay estructura de la cual derivarlo" (cláusula 4) no se cumple literalmente. Una clave dentro de un documento JSON tampoco es "una fila de una tabla clave-valor" (cláusula 3), y la cardinalidad de `order_summary` respecto de `order` no está verificada (cláusula 2). Candidatas: 2, 3 o 4.

**T-1 (transversal). Filtros de fila.** El criterio no dice si los filtros que deciden qué filas entran en la vista forman parte de la correspondencia. Estos son: `WHERE p.deleted_at IS NULL` y `WHERE i.deleted_at IS NULL` (`03:24`, `03:34`); los `JOIN` que solo filtran en `v_receta_componente` de Food Store (`03:42-43`); y, en Medusa, la ausencia de filtro sobre `deleted_at` (`bitacora_medusa_version.md:87`). La matriz clasificó por la expresión del valor. Si los filtros contaran, habría que revisar las celdas de Food Store de `producto`, `insumo` y `receta_componente`.

---

## 9. Salvedades de evidencia (no son casos del criterio)

**E-1. La ausencia en WooCommerce se observó sobre un fixture escrito por el propio proyecto.** V-7 encontró "0 tablas" de insumo o receta (`bitacora_CH-16b_tres_esquemas.md:98`), pero sobre un esquema creado por `07_woocommerce_fixture.sql`, que por construcción no las tiene. Todavía falta verificar la ausencia contra una fuente primaria (`bitacora_CH-16b_tres_esquemas.md:457`). Las 8 celdas de clase 4 de WooCommerce se apoyan en ese fixture y en fuentes documentales (`:467-471`). En Saleor, en cambio, la ausencia se observó sobre una instancia real (3.23.36) y en el código fuente (3.23.35) (`bitacora_CH-16c_saleor.md:27-29`).

**E-2. Hay celdas clasificadas cuyo caso no está ejercitado en los datos.** Medusa: suma sobre varias ubicaciones (sección 6) y pedidos (0 filas, `CH-16:36`). Saleor: el caso `activo = false` (`bitacora_CH-16c_saleor.md:463`). WooCommerce: variaciones (G-2). La clase se asignó por la estructura del SQL, no por lo que devolvió.

---

## Reclasificación con el criterio refinado (2026-09-24)

Esta sección aplica las resoluciones del autor (2026-09-24) a las 96 correspondencias. Las secciones 1 a 9 quedan como estaban: son la clasificación con el criterio original. Las expresiones citadas no cambian.

### Criterio refinado

- **Multietiqueta.** Cada correspondencia registra todos los obstáculos presentes: **2** Granularidad, **3** Entidad-atributo-valor, **4** Ausencia. Si no hay ninguno, es **1** Directa. Ya no se asigna solo la primera regla que aplica.
- **Regla 2 ampliada.** Incluye tomar el atributo de otra entidad relacionada que no es una tabla de valores enumerados.
- **NI**: no implementado (no hay vista, o no hay expresión, para la entidad en esa plataforma). NI no es un obstáculo y no cuenta como correspondencia clasificada.

### Resolución de los casos de la sección 8

| Caso | Resolución | Celdas afectadas |
|---|---|---|
| G-1 | La decisión de nivel de una entidad alcanza a todos sus atributos. | Los 5 atributos de `producto` en Medusa, Saleor y WooCommerce llevan obstáculo 2. |
| G-2 | Queda cubierto por G-1: la vista de WooCommerce mezcla niveles de la cadena `post_parent`, así que la decisión de nivel está presente (aunque sin tomar) para toda la entidad. | Las mismas 5 celdas de WooCommerce. |
| G-3 | `item_pedido.productoId` y `precioUnitario` de Medusa son clase 2 (regla 2 ampliada: se toman de `order_line_item`, entidad relacionada que no es de valores enumerados). | 2 celdas de Medusa. |
| G-4 | `pedido.total` de Medusa es NI. | 1 celda de Medusa. |
| T-1 | Los filtros de fila no cuentan para la clase. | Ninguna celda cambia: la matriz ya clasificaba por la expresión del valor. |

### Tabla completa

Columna "Cambio": diferencia respecto de la clasificación de las secciones 1 a 5.

#### `producto`

| Atributo | Plataforma | Expresión | Clase | Cambio |
|---|---|---|---|---|
| id | Food Store | `p.id::text` (`03:18`) | 1 | — |
| id | Medusa | `pv.id` (`06:4`) | 2 | ? → 2 (G-1) |
| id | WooCommerce | `p.ID::text` (`08:6`) | 2 | ? → 2 (G-1/G-2) |
| id | Saleor | `pv.id::text` (`10:26`) | 2 | ? → 2 (G-1) |
| nombre | Food Store | `p.name` (`03:19`) | 1 | — |
| nombre | Medusa | `p.title \|\| ' - ' \|\| pv.title` (`06:5`) | 2 | — |
| nombre | WooCommerce | `p.post_title` (`08:7`) | 2 | ? → 2 (G-1/G-2) |
| nombre | Saleor | `CASE WHEN pv.name IS NULL OR pv.name = '' THEN p.name ELSE p.name \|\| ' - ' \|\| pv.name END` (`10:27-28`) | 2 | — |
| stockDisponible | Food Store | `p.stock_quantity` (`03:20`) | 1 | — |
| stockDisponible | Medusa | `COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)` con `GROUP BY pv.id, …` (`06:6`, `06:11-14`) | 2 | — |
| stockDisponible | WooCommerce | `COALESCE(m_stock.meta_value::numeric, 0)::int` con `LEFT JOIN wp_postmeta m_stock … AND m_stock.meta_key = '_stock'` (`08:8`, `08:12`) | 2 + 3 | ? → 2 + 3 (G-1/G-2 y clave-valor, multietiqueta) |
| stockDisponible | Saleor | `COALESCE(SUM(s.quantity - s.quantity_allocated), 0)` con `LEFT JOIN warehouse_stock s` y `GROUP BY pv.id, …` (`10:29`, `10:37-38`) | 2 | — |
| sku | Food Store | `NULL::text` (`03:21`) | 4 | — |
| sku | Medusa | `pv.sku` (`06:7`) | 2 | ? → 2 (G-1) |
| sku | WooCommerce | `m_sku.meta_value` con `LEFT JOIN wp_postmeta m_sku … AND m_sku.meta_key = '_sku'` (`08:9`, `08:13`) | 2 + 3 | ? → 2 + 3 (G-1/G-2 y clave-valor, multietiqueta) |
| sku | Saleor | `pv.sku` (`10:30`) | 2 | ? → 2 (G-1) |
| activo | Food Store | `p.available` (`03:22`) | 1 | — |
| activo | Medusa | `(p.status = 'published')` (`06:8`) | 2 | — |
| activo | WooCommerce | `(p.post_status = 'publish')` (`08:10`) | 2 | ? → 2 (G-1/G-2) |
| activo | Saleor | `EXISTS (SELECT 1 FROM product_productchannellisting pcl WHERE pcl.product_id = p.id AND pcl.is_published)` (`10:31-34`) | 2 | — |

#### `pedido`

| Atributo | Plataforma | Expresión | Clase | Cambio |
|---|---|---|---|---|
| id | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| id | Medusa | `o.id` (`CH-16:146`) | 1 | — |
| fechaCreacion | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| fechaCreacion | Medusa | `o.created_at` (`CH-16:147`) | 1 | — |
| estado | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| estado | Medusa | `o.status::text` (`CH-16:148`) | 1 | — |
| total | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| total | Medusa | sin vista: omitido a propósito de `v_pedido` (`CH-16:134-142`) | NI | ? → NI (G-4). Nota: la estructura existe en `order_summary.totals` (jsonb, `CH-16:219`), sin verificar su contenido ni su cardinalidad respecto de `order`; clasificarla requiere primero implementar la expresión. |
| numero | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| numero | Medusa | `o.display_id` (`CH-16:149`) | 1 | — |
| moneda | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| moneda | Medusa | `o.currency_code` (`CH-16:150`) | 1 | — |

#### `item_pedido`

| Atributo | Plataforma | Expresión | Clase | Cambio |
|---|---|---|---|---|
| id | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| id | Medusa | `oi.id` (`CH-16:164`) | 1 | — |
| pedidoId | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| pedidoId | Medusa | `oi.order_id` (`CH-16:165`) | 1 | — |
| productoId | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| productoId | Medusa | `oli.variant_id` con `JOIN order_line_item oli ON oli.id = oi.item_id` (`CH-16:166`, `CH-16:169-170`) | 2 | ? → 2 (G-3, regla 2 ampliada) |
| cantidad | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| cantidad | Medusa | `oi.quantity` (`CH-16:167`) | 1 | — |
| precioUnitario | Food Store / WooCommerce / Saleor | sin vista | NI | — |
| precioUnitario | Medusa | `oli.unit_price` (`CH-16:168`, reunión en `CH-16:170`) | 2 | ? → 2 (G-3, regla 2 ampliada) |

#### `insumo`

| Atributo | Plataforma | Expresión | Clase | Cambio |
|---|---|---|---|---|
| id | Food Store | `i.id::text` (`03:28`) | 1 | — |
| id | Medusa | `ii.id` (`06:17`) | 1 | — |
| id | WooCommerce | sin vista | 4 | — (E-1) |
| id | Saleor | sin vista | 4 | — |
| nombre | Food Store | `i.name` (`03:29`) | 1 | — |
| nombre | Medusa | `ii.title` (`06:17`) | 1 | — |
| nombre | WooCommerce | sin vista | 4 | — (E-1) |
| nombre | Saleor | sin vista | 4 | — |
| stockDisponible | Food Store | `i.stock_quantity` (`03:30`) | 1 | — |
| stockDisponible | Medusa | `COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)` con `LEFT JOIN inventory_level il` y `GROUP BY ii.id, …` (`06:18`, `06:21-22`) | 2 | — |
| stockDisponible | WooCommerce | sin vista | 4 | — (E-1) |
| stockDisponible | Saleor | sin vista | 4 | — |
| unidadMedida | Food Store | `NULL::text` (`03:31`) | 4 | — |
| unidadMedida | Medusa | `ii.unit_of_measure` (`06:19`) | 1 | — |
| unidadMedida | WooCommerce | sin vista | 4 | — (E-1) |
| unidadMedida | Saleor | sin vista | 4 | — |
| codigo | Food Store | `NULL::text` (`03:32`) | 4 | — |
| codigo | Medusa | `ii.sku` (`06:19`) | 1 | — |
| codigo | WooCommerce | sin vista | 4 | — (E-1) |
| codigo | Saleor | sin vista | 4 | — |

#### `receta_componente`

| Atributo | Plataforma | Expresión | Clase | Cambio |
|---|---|---|---|---|
| productoId | Food Store | `pi.product_id::text` (`03:38`) | 1 | — (T-1: los `JOIN` que filtran no cuentan) |
| productoId | Medusa | `pvi.variant_id` (`06:25`) | 1 | — (ver nota abajo) |
| productoId | WooCommerce | sin vista | 4 | — (E-1) |
| productoId | Saleor | sin vista | 4 | — |
| insumoId | Food Store | `pi.ingredient_id::text` (`03:39`) | 1 | — |
| insumoId | Medusa | `pvi.inventory_item_id` (`06:25`) | 1 | — |
| insumoId | WooCommerce | sin vista | 4 | — (E-1) |
| insumoId | Saleor | sin vista | 4 | — |
| cantidadPorUnidad | Food Store | `pi.quantity` (`03:40`) | 1 | — |
| cantidadPorUnidad | Medusa | `pvi.required_quantity` (`06:26`) | 1 | — |
| cantidadPorUnidad | WooCommerce | sin vista | 4 | — (E-1) |
| cantidadPorUnidad | Saleor | sin vista | 4 | — |

Nota sobre Medusa `receta_componente.productoId`: la resolución de G-1 alcanza a los atributos de la entidad cuya fila canónica requirió la decisión de nivel (`producto`). `pvi.variant_id` es una columna de la propia fila de `product_variant_inventory_item`, sin reunión, así que queda en 1. La pregunta de la sección 8 (si la decisión alcanza también a las referencias hacia esa entidad) quedó decidida por el autor (2026-09-24): no alcanza. Las referencias a `producto` desde otras entidades se clasifican por su propia expresión, así que esta celda queda en 1.

### Conteo

**Correspondencias clasificadas por plataforma** (todas las que no son NI):

| | Food Store | Medusa | Saleor | WooCommerce | Total |
|---|---|---|---|---|---|
| Clasificadas | 13 | 23 | 13 | 13 | **62** |
| NI | 11 | 1 | 11 | 11 | **34** |
| **Total** | 24 | 24 | 24 | 24 | 96 |

**Obstáculos** (multietiqueta: una celda con 2 + 3 cuenta en ambas filas, así que las filas de obstáculo no suman el total de clasificadas):

| | Food Store | Medusa | Saleor | WooCommerce | Total |
|---|---|---|---|---|---|
| 1. Directa (sin obstáculos) | 10 | 15 | 0 | 0 | **25** |
| Con obstáculo 2 (Granularidad) | 0 | 8 | 5 | 5 | **18** |
| Con obstáculo 3 (Entidad-atributo-valor) | 0 | 0 | 0 | 2 | **2** |
| Con obstáculo 4 (Ausencia) | 3 | 0 | 8 | 8 | **19** |

Combinaciones de obstáculos: {2} en 16 celdas, {2, 3} en 2 (WooCommerce `producto.stockDisponible` y `producto.sku`), {4} en 19. Control: 25 + 16 + 2 + 19 = 62 clasificadas.

Detalle del obstáculo 2 en Medusa (8): los 5 atributos de `producto`; `item_pedido.productoId` y `item_pedido.precioUnitario`; `insumo.stockDisponible`.

Contraste con el cálculo del autor: coincide en todos los valores (clasificadas 62 = 13 + 23 + 13 + 13; directas 25; obstáculo 2: 18; obstáculo 3: 2; obstáculo 4: 19; NI 34). No hay diferencias celda por celda.

Las salvedades E-1 y E-2 de la sección 9 siguen vigentes: la reclasificación cambia el criterio, no la evidencia. En particular, las 2 celdas con obstáculo 3 y las 8 con obstáculo 4 de WooCommerce siguen apoyadas en el fixture.
