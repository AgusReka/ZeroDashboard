# Preregistro — versión 2 de la consulta de stock producible: desempate del insumo limitante (P15)

**Fecha:** 2026-09-29. **Rama:** `experimento/desempate`, creada desde `experimento/odoo` (commit `c3ee7b4`), porque usa sus vistas. No se fusiona.

Evaluación de una tesis ya redactada. La versión 1 (`openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql`) queda como está: es la que evaluó la tesis. No se modifica `src/`, `src/contrato.ts`, las pruebas ni ninguna vista. Todo lo nuevo va en `experimentos/desempate/` y en `docs/bitacora/bitacora_desempate.md`.

Este archivo se commitea **antes** de ejecutar cualquier consulta de resultados: la V2, los cálculos manuales y las lecturas de existencias o recetas. Hasta este commit solo se hizo lo siguiente:

- Se leyeron el catálogo (vistas, tipos de columnas, roles, privilegios, colaciones) y las definiciones instaladas de las vistas.
- Se hizo un `EXPLAIN (COSTS OFF)` de los tres cálculos manuales y de las tres huellas. Planifica la consulta, pero no lee ni devuelve filas.
- Se leyeron salidas ya commiteadas: las de `experimento/odoo` del 2026-09-26 y la auditoría P14 de `master` (`docs/bitacora/auditoria_mapa_cambios.md`, sección 3).

---

## 1. Versión 2

Archivo: `experimentos/desempate/sql/04_consulta_canonica_v2.sql`. Es una copia de la versión 1 con estos tres cambios, y ninguno más:

1. En los dos `ARRAY_AGG` se agrega `ins.id ASC` como segundo criterio de orden, después del cociente.
2. Se agrega la columna `insumo_limitante_id`: el mismo `ARRAY_AGG`, sobre `ins.id`. Hace falta porque en Odoo hay dos insumos distintos con el mismo nombre (Drawer Black, ids 33 y 65). La columna va **al final**, para no correr las posiciones de las columnas de la versión 1.
3. En el `ORDER BY` final se agrega `pr.id` como segundo criterio.

Texto completo:

```sql
-- ============================================================
-- CONSULTA CANÓNICA: stock producible con insumo limitante.
-- Escrita UNA sola vez, contra las vistas canónicas.
-- No menciona ninguna tabla nativa de ninguna plataforma.
-- Debe correr sin modificarse sobre cualquier esquema que
-- satisfaga el contrato.
-- ============================================================
SELECT
    pr.id,
    pr.nombre,
    FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS stock_producible,
    (ARRAY_AGG(ins.nombre
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS stock_insumo_limitante,
    (ARRAY_AGG(ins.id
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS insumo_limitante_id
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC, pr.id;
```

SHA-256:

```
979131ebbf5055a6a267221db8c2de80ae7ccbaa3d56c091e24d900d66359c90  openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql   (versión 1, sin cambios)
b2acb0664d007373269ef49af03dcf293a13cefc285df23a2d0d62416bee61f7  experimentos/desempate/sql/04_consulta_canonica_v2.sql                 (versión 2)
```

`diff -u` entre la versión 1 y la versión 2:

```diff
--- openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql
+++ experimentos/desempate/sql/04_consulta_canonica_v2.sql
@@ -10,13 +10,15 @@
     pr.nombre,
     FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS stock_producible,
     (ARRAY_AGG(ins.nombre
-       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
+       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS insumo_limitante,
     (ARRAY_AGG(ins."stockDisponible"
-       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
+       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS stock_insumo_limitante,
+    (ARRAY_AGG(ins.id
+       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS insumo_limitante_id
 FROM v_producto pr
 JOIN v_receta_componente rc ON rc."productoId" = pr.id
 JOIN v_insumo ins           ON ins.id = rc."insumoId"
 WHERE pr.activo = true
   AND rc."cantidadPorUnidad" > 0
 GROUP BY pr.id, pr.nombre
-ORDER BY stock_producible ASC;
+ORDER BY stock_producible ASC, pr.id;
```

### 1.1 El desempate es por orden de texto

`ins.id` y `pr.id` son `text` en las vistas de los tres esquemas: `v_insumo.id` es `text` en Food Store, Medusa y Odoo. El desempate es, entonces, por **orden de texto**, no numérico: en Food Store y en Odoo los ids son enteros convertidos a texto, así que `'10' < '9'`. La V2 no fija una colación, así que ordena con la colación por defecto de cada base:

| Base | `datcollate` | Proveedor |
|---|---|---|
| `food_store` | `en_US.utf8` | libc |
| `medusa_db` | `en_US.utf8` | libc |
| `odoo` | `C` | libc |

El insumo limitante esperado es, entonces, el de menor id según la colación por defecto de la base. Esa es la regla que aplica la V2, y es la que se evalúa. Como dato informativo, el cálculo manual informa además el que se elegiría con `COLLATE "C"` y cuenta los productos en que las dos colaciones difieren. Esa diferencia no refuta nada: se reporta.

`.gitattributes` de `experimentos/desempate/` fija `* -text`, para que git no convierta los finales de línea y el SHA-256 de la V2 no cambie al hacer checkout.

---

## 2. Cálculo manual

Un archivo por esquema, **sobre las tablas nativas, sin vistas**:

```
fb5f04cb3c09acf159a0d13c8b8d950e3dc0f497b937f397ac2a47048791fe24  experimentos/desempate/sql/manual/m_foodstore.sql
14fed01719ac3f2ae58958bed7fd9de1bfb9039436d557823f2b5c87db0e4140  experimentos/desempate/sql/manual/m_medusa.sql
b2298a8a487af17d592207ac4b5a685e2ca4577826c57c7523bf551a336dba45  experimentos/desempate/sql/manual/m_odoo.sql
```

### 2.1 Regla

Para cada producto activo con receta, y para cada componente con cantidad por unidad mayor que 0:

1. **Cociente exacto.** El cociente del componente se escribe como una fracción `n / d`, con `d > 0`. La comparación se hace sin dividir: `a/b < c/e ⇔ a·e < c·b`. Así no hay redondeo del tipo `numeric` en la comparación.
   - Food Store: `n = ingredient.stock_quantity`, `d = product_ingredient.quantity`.
   - Medusa: `n = COALESCE(SUM(stocked_quantity − reserved_quantity), 0)` del `inventory_item`, `d = required_quantity`.
   - Odoo: `n = disp · bom_qty · f_bom · f_comp` y `d = f_prod · SUM(qty · f_linea)`. Es la misma cantidad que `disp / por_unidad` de `experimentos/odoo/sql/manual/m_stock_producible.sql`, con los factores de unidad pasados al numerador y al denominador.
2. **Conjunto empatado.** Los componentes para los que ningún otro componente del mismo producto tiene un cociente estrictamente menor.
3. **Stock producible.** El piso exacto del cociente mínimo: `div(n, d)`, menos 1 si `n < 0` y la división no es exacta.
4. **Insumo limitante esperado.** El de menor id **como texto**, dentro del conjunto empatado: `MIN(id::text)`, con la colación por defecto de la base (ver 1.1).

Salida del manual, una fila por producto: `producto | stock_producible | insumo_limitante_id | empatados | cantidad de empatados | limitante con COLLATE "C"`.

### 2.2 Decisiones de significado

Los cálculos manuales replican las decisiones de significado de las vistas instaladas, que se leyeron con `pg_views` antes de este commit:

- **Food Store:** `deleted_at IS NULL` en producto e insumo, `available = true` y `quantity > 0`.
- **Medusa:** el producto es la variante de un producto con `status = 'published'`. La existencia es la suma por `inventory_item`. Como las vistas, no filtra `deleted_at`.
- **Odoo:** la lista elegida, kit y fabricar, las líneas con valores de atributo descartadas y el disponible en ubicaciones internas, como en `m_stock_producible.sql`, validado 7/7 en la replicación.

Lo que se verifica es la composición vista + V2, no esas decisiones.

Si un cálculo manual falla al ejecutarse, se corrige el manual, no la V2. Eso se registra como incidente, con el texto nuevo y su SHA-256, y no refuta nada: el manual no es lo que se evalúa.

---

## 3. Procedimiento

Todas las lecturas corren en transacciones `REPEATABLE READ READ ONLY` que terminan en `ROLLBACK`. La excepción son las modificaciones controladas (sección 5). Cada ejecución registra:

- la fecha y la hora del host (`date -Iseconds`) antes y después;
- el texto exacto, en el archivo `*_input.sql` y con el eco de `psql -e`;
- `now()`, `current_user`, el pid del backend y `transaction_read_only`;
- el código de salida.

Los datos se vuelcan sin encabezados, con separador `|` (`\pset format unaligned`, `tuples_only`).

| Esquema | Instancia | V2 (3 sesiones) | Manual y huellas |
|---|---|---|---|
| Food Store | contenedor `foodstore-backend-fastapi-db-1`, base `food_store`, en su estado actual | rol de solo lectura `lector_zerodashboard` | `lector_zerodashboard`, que tiene `SELECT` sobre las tablas nativas |
| Medusa | contenedor `ch16-medusa-pg`, base `medusa_db`. Se arranca antes y se detiene al terminar | `medusa`. No hay rol de solo lectura: la protección es la transacción `READ ONLY` | `medusa` |
| Odoo | contenedor `zd-odoo-db-1`, base `odoo`, en su estado actual. El contenedor de la aplicación Odoo no está creado, así que nada escribe en la base | rol de solo lectura `zd_odoo_lectura`, con conexión propia y contraseña | `odoo`, porque `zd_odoo_lectura` solo lee las vistas |

`experimentos/desempate/scripts/p3_base.sh <esquema>` hace, en este orden:

1. Una **huella antes**: cantidad de filas y `md5` de todas las filas de cada tabla nativa relevante (`sql/estado/huella_<esquema>.sql`).
2. La V2 en **tres sesiones distintas**, cada una con su propio proceso `psql`.
3. El manual en una cuarta sesión.
4. Una **huella después**. Si las dos huellas son iguales, las cuatro sesiones leyeron el mismo estado.

Antes de cada ejecución se registra el SHA-256 de la V2, en el host y dentro del contenedor, y se compara con la sección 1.

`experimentos/desempate/scripts/comparar.sh` compara las corridas así:

- **Entre corridas:** `cmp` de los tres archivos de datos de la V2, dos a dos, byte a byte.
- **Contra el manual:** diferencia simétrica en las dos direcciones sobre la tupla `(producto, stock_producible, insumo_limitante_id)`, para cada una de las tres corridas. Se usa `comm` con `LC_ALL=C`, sobre las columnas 1, 3 y 6 de la V2 y 1, 2 y 3 del manual.

Orden: Food Store, Medusa, Odoo (paso 3); después, Odoo y Food Store (paso 4).

---

## 4. Criterios de refutación

La corrección queda **refutada** si ocurre alguna de estas cosas:

- **C1.** La versión 2 necesita editar su texto para ejecutar sobre alguno de los tres esquemas.
- **C2.** En algún esquema, el stock producible o el insumo limitante difieren del cálculo manual, incluidos los estados modificados.
- **C3.** Las tres corridas de algún esquema o de algún estado modificado no son idénticas byte a byte.

Operativamente:

- **C1** se cumple si alguna ejecución de la V2 termina con error, o si el SHA-256 de la V2 deja de ser `b2acb066…61f7`.
- **C2** se cumple si alguna diferencia simétrica tiene al menos una fila, en cualquiera de las dos direcciones y en cualquier corrida o estado. En los estados modificados, también se cumple si la tupla difiere de los valores esperados de la sección 5.
- **C3** se cumple si algún `cmp` entre corridas del mismo estado informa diferencia.

`stock_insumo_limitante` y el nombre se reportan, pero no entran en la tupla.

---

## 5. Modificaciones controladas

Las dos corren en **una transacción terminada en `ROLLBACK`**, como el dueño de las tablas (`odoo`, `postgres`). Dentro de la transacción:

- se aplica el cambio, con una guarda que aborta si no se aplicó;
- se corre el manual;
- se corre la V2 **tres veces**, con `SET ROLE` al rol de solo lectura. Así se ejecuta con sus privilegios y ve los cambios no confirmados, como en el desvío D-2 de la replicación sobre Odoo.

Después del `ROLLBACK`, desde **sesiones nuevas**, se verifica:

- que la huella del estado volvió a la de antes;
- que la V2 da una salida idéntica byte a byte a la corrida base.

### 5.1 Odoo — repetición exacta de `experimentos/odoo/ESPERADO_P3_4.md`

- **Línea 6** de `mrp_bom_line` (lista 2, Table, componente 57 Bolt): `product_qty` de 4 a 12.
- **Existencia de Bolt:** se inserta un `stock_quant` con `product_id = 57`, `location_id = 5`, `company_id = 1`, `quantity = 7`, `reserved_quantity = 0`.
- **Condición previa:** el estado de Odoo es el del 2026-09-26: la línea 6 con 4, ningún `stock_quant` interno de 57, y los componentes de `experimentos/odoo/salidas/p3_stock/A/manual.txt`. Se comprueba con el manual base del paso 3 y con la lectura previa de `p4_odoo.sh`. Si no se cumple, **no se corre la modificación**: se recalculan los valores esperados y se commitean antes, como desvío.

Estado base esperado, antes de modificar, derivado de las salidas commiteadas del 2026-09-26 con la regla 2.1:

| Producto | Empatados en el mínimo (ids) | Stock producible | Limitante esperado (id, nombre) |
|---|---|---|---|
| 8 Desk Combination | {32, 33} | 0 | **32** Corner Desk Left Sit |
| 39 Drawer | {65, 66} | 45 | **65** Drawer Black |
| 54 Table | {56, 57, 58} | 0 | **56** Table Leg |
| 55 Table Top | {62} | 24 | 62 Wood Panel |
| 62 Wood Panel | {59} | 6 | 59 Ply Layer |
| 63 Plastic Laminate | {61} | 0 | 61 Ply Veneer |
| 64 Table Kit | {57} | 0 | 57 Bolt |

Estado modificado esperado (Bolt con 7 disponibles):

| Producto | Cocientes relevantes | Empatados | Stock producible | Limitante esperado |
|---|---|---|---|---|
| 54 Table | Table Leg 0/4 = 0; Screw 0/10 = 0; Bolt 7/12 = 0,583…; Table Top 5/1 = 5 | {56, 58} | 0 | **56** Table Leg |
| 64 Table Kit | Bolt 7/4 = 1,75; Wood Panel 48/1 = 48 | {57} | **1** | **57** Bolt (`stock_insumo_limitante = 7`) |
| 8, 39, 55, 62, 63 | sin cambios | igual que la base | igual que la base | igual que la base |

Salida esperada de la V2 dentro de la transacción. Es la misma en las tres corridas; el nombre y `stock_insumo_limitante` son informativos:

```
54|Table|0|Table Leg|0|56
63|Plastic Laminate|0|Ply Veneer|0|61
8|Desk Combination|0|Corner Desk Left Sit|0.00|32
64|Table Kit|1|Bolt|7|57
62|Wood Panel|6|Ply Layer|20.00|59
55|Table Top|24|Wood Panel|48.00|62
39|Drawer|45|Drawer Black|45.00|65
```

Salida esperada de la V2 base y después del `ROLLBACK`:

```
54|Table|0|Table Leg|0|56
63|Plastic Laminate|0|Ply Veneer|0|61
64|Table Kit|0|Bolt|0|57
8|Desk Combination|0|Corner Desk Left Sit|0.00|32
62|Wood Panel|6|Ply Layer|20.00|59
55|Table Top|24|Wood Panel|48.00|62
39|Drawer|45|Drawer Black|45.00|65
```

El orden de las filas sigue el `ORDER BY stock_producible, pr.id` en colación `C`: `'54' < '63' < '64' < '8'`.

### 5.2 Food Store — empate forzado

Regla fija, aplicada **a mano** sobre el estado que lee `scripts/p4_foodstore_estado.sh` (solo lectura, después del paso 3):

1. **Candidatos.** Los productos activos (`available = true`, `deleted_at IS NULL`) con **dos o más** componentes (`quantity > 0`, insumo no borrado).
2. **Limitante y segundo insumo.** En cada candidato, los componentes se ordenan por cociente exacto ascendente y, a igual cociente, por id como texto. **L** es el primero, que es el limitante actual. **S** es el segundo.
3. **Existencia nueva de S.** `x = n_L · d_S / d_L`, para que `x / d_S = n_L / d_L`. El candidato sirve si `x` es entero, `x ≥ 0` y `x` es distinto de la existencia actual de S.
4. **Producto.** Entre los candidatos que sirven, el de menor `product.id`, en orden numérico. Si ninguno sirve, no se modifica nada y se registra como límite.
5. **Modificación.** `UPDATE ingredient SET stock_quantity = x WHERE id = S AND stock_quantity = <actual>`, con una guarda que aborta si no se aplicó.

**Valores esperados.** Se calculan a mano con la regla 2.1, a partir del estado leído, para **todos** los productos activos, porque S puede estar en otras recetas:

- el producto elegido conserva su stock producible, `FLOOR(n_L / d_L)`;
- su conjunto empatado pasa a ser {L, S};
- el limitante esperado es `min(L, S)` como texto;
- los demás productos que usan S se recalculan con la existencia nueva.

Los valores esperados se escriben en `experimentos/desempate/ESPERADO_FOODSTORE.md` y se commitean **antes** de correr `scripts/p4_foodstore.sh`. No pueden ir en este preregistro sin leer existencias antes de este commit. Lo que queda fijado acá es la regla que los determina, y se declara como desvío anticipado D-1. Dentro de la transacción se verifica, además, que la huella del estado sea la misma que la leída para calcular los valores esperados.

---

## 6. Scripts

```
6229ced13632dec66e904d5bd8bcf12f6f181d588ef31b7281f1044064e5a86b  experimentos/desempate/scripts/comparar.sh
420cdec61a4514e2941d6c872f079eaab2422d298c9a909b69efa224178f040c  experimentos/desempate/scripts/lib.sh
b0d16b53a9363dcd7d0e6ff72bd41ae571a0d7052ce083cfb6ce6e2d784a5a79  experimentos/desempate/scripts/p3_base.sh
faad8b5200ce0080ca5b9fef4e5993a49ddaea931423298c03b178dcaf332ad1  experimentos/desempate/scripts/p4_foodstore.sh
6cb4d0ecea95bf67202735b83ac423b5b88c8ed158622257802b1504cf50491a  experimentos/desempate/scripts/p4_foodstore_estado.sh
75308c13e165741f4f9335101fe3107abd2c7d9ef23f70fd5706cb41728f8962  experimentos/desempate/scripts/p4_odoo.sh
0917a5a8eed4332c8ee68e7c5204ac041cb611fdb4c150f18640f73033762d47  experimentos/desempate/sql/estado/huella_foodstore.sql
79f7fd21979faa7be2946ecadf0562b2a1ce0dedda4782c01efe2d411df564d0  experimentos/desempate/sql/estado/huella_medusa.sql
06c318f11e78888f2efff6316755828be59df4061145af476fdd17ac8373ab5f  experimentos/desempate/sql/estado/huella_odoo.sql
```

Si un script falla por un defecto propio, no de la V2, se corrige, se registra como incidente con el SHA-256 nuevo y se vuelve a correr completo el paso afectado.
