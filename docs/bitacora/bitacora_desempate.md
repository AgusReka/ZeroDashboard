# Bitácora — P15: versión 2 de la consulta de stock producible (desempate del insumo limitante)

**Fecha:** 2026-09-29 (horas en −03:00, Buenos Aires, salvo que se indique UTC). **Rama:** `experimento/desempate`, creada desde `experimento/odoo` (`c3ee7b4`). No se fusiona.

Evaluación de una tesis ya redactada. La versión 1 (`openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql`, SHA-256 `979131eb…9c90`) no se tocó. Tampoco se tocaron `src/`, `src/contrato.ts`, las pruebas ni las vistas. Todo lo nuevo está en `experimentos/desempate/` y en este archivo.

**Resumen.** La versión 2 corrió sin cambios sobre los tres esquemas.

- En los cinco estados evaluados (tres bases y dos modificados), las tres corridas fueron idénticas byte a byte.
- La diferencia simétrica contra el cálculo manual sobre `(producto, stock_producible, insumo_limitante_id)` dio 0 filas en las dos direcciones, en todas las corridas.
- En los dos estados modificados, la salida coincidió byte a byte con la salida esperada, escrita antes de ejecutar.
- Los empates de Odoo (3 productos en el estado base, 3 en el modificado) y el empate forzado en Food Store se resolvieron por el id menor como texto, como fija la regla.

Ninguno de los tres criterios de refutación se cumple.

---

## 1. Registro previo

- **Commit del preregistro:** `5c00e1c581e7e06ae2a013df4cdd6dcafde4563f` (`experimentos/desempate/PREREGISTRO.md`), antes de ejecutar cualquier consulta de resultados.
- **Commit de los valores esperados de Food Store:** `0443104`, antes de ejecutar la modificación (ver D-1).
- **SHA-256 de la versión 2:** `b2acb0664d007373269ef49af03dcf293a13cefc285df23a2d0d62416bee61f7` (`experimentos/desempate/sql/04_consulta_canonica_v2.sql`). Se recalculó antes de cada una de las seis preparaciones, en el host y dentro del contenedor (`salidas/*/hashes*.txt`), y coincidió siempre.

Diff entre la versión 1 y la versión 2 (`diff -u`):

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

`insumo_limitante_id` va al final, para no correr las columnas de la versión 1.

**El desempate es por orden de texto.** `v_insumo.id` es `text` en los tres esquemas. La V2 no fija colación, así que ordena con la de cada base: `food_store` y `medusa_db` usan `en_US.utf8`, y `odoo` usa `C`.

Lo que se hizo antes del commit del preregistro, sin leer filas de datos:

- se leyeron el catálogo (vistas instaladas, tipos, roles, privilegios, colaciones);
- se hizo un `EXPLAIN (COSTS OFF)` de los cálculos manuales y de las huellas;
- se leyeron salidas ya commiteadas de `experimento/odoo` y de la auditoría P14 en `master`.

---

## 2. Instancias y estado de cada una

| Esquema | Instancia | Estado | V2 | Manual y huellas |
|---|---|---|---|---|
| Food Store | contenedor `foodstore-backend-fastapi-db-1`, PostgreSQL 16.15, base `food_store` | Estado actual. El contenedor ya estaba arriba, junto con `foodstore-backend-fastapi-api-1`. 6 productos activos con receta, 26 componentes, ningún empate. Coincide con la auditoría P14 del 2026-09-26 | `lector_zerodashboard` (rol de solo lectura) | `lector_zerodashboard` |
| Medusa | contenedor `ch16-medusa-pg`, PostgreSQL 16.15, base `medusa_db` | Estaba detenido (`Exited (0)`). Se arrancó a las 12:56:08 y se detuvo a las 13:04:21 (`Exited (0)`). 20 variantes publicadas con receta, **un componente cada una** | `medusa`, con la transacción `READ ONLY`. No hay rol de solo lectura | `medusa` |
| Odoo | contenedor `zd-odoo-db-1`, PostgreSQL 17.11, base `odoo` | Estaba detenido (`Exited (255)`). Se arrancó a las 12:56:08 y se detuvo a las 13:06:22. El contenedor de la aplicación Odoo no existe, así que nada escribe en la base. 7 productos con receta, **3 con empate**: 8, 39 y 54. Mismo estado que el 2026-09-26: la línea 6 con 4 y ningún `stock_quant` interno de Bolt | `zd_odoo_lectura` (rol de solo lectura, con conexión propia) | `odoo`, porque `zd_odoo_lectura` solo lee las vistas |

Huellas del estado: filas y `md5` de cada tabla nativa relevante. Fueron iguales antes y después de cada paso, así que todas las sesiones de un mismo paso leyeron el mismo estado.

```
Food Store  ingredient|14|dc72bad8…  product|9|78bc15a3…  product_ingredient|26|58fe1c6c…
Medusa      inventory_item|20|d1492ad2…  inventory_level|20|2cb00613…  product|4|509e2215…
            product_variant|20|cbc7ab90…  product_variant_inventory_item|20|b12aa754…
Odoo        mrp_bom|8|5314a322…  mrp_bom_line|17|f9eaf5f5…  mrp_bom_line_…_rel|0|d41d8cd9…
            product_product|66|b203f79e…  product_template|53|02cb75ab…  stock_location|36|886ecacc…
            stock_quant|67|58be1be3…  uom_uom|30|82472084…
```

La huella de Food Store fue la misma en el paso 3 (13:03:50), en la lectura previa del paso 4 (13:05:12), dentro de la transacción antes del `UPDATE` (13:05:50) y después del `ROLLBACK` (13:05:50).

---

## 3. Resultados por esquema

Scripts: `scripts/p3_base.sh <esquema>` y `scripts/comparar.sh`. Cada corrida de la V2 es un proceso `psql` distinto, con su propia sesión y su propio pid, en una transacción `REPEATABLE READ READ ONLY` que termina en `ROLLBACK`. El texto exacto de cada ejecución está en `salidas/p3_<esquema>/*_input.sql` y, con el eco de `psql -e`, en `*_output.txt`.

### 3.1 Food Store

| Sesión | Hora del servidor (UTC) | Rol | pid | `read_only` |
|---|---|---|---|---|
| V2, corrida 1 | 16:03:51.153 | `lector_zerodashboard` | 896 | on |
| V2, corrida 2 | 16:03:51.580 | `lector_zerodashboard` | 903 | on |
| V2, corrida 3 | 16:03:52.093 | `lector_zerodashboard` | 910 | on |
| manual | 16:03:52.688 | `lector_zerodashboard` | 917 | on |

Salida de las tres corridas (`salidas/p3_foodstore/datos/v2_corrida{1,2,3}.txt`):

```
4|Hamburguesa Picante|15|Jalapeños|30|12
2|Hamburguesa BBQ Bacon|20|Bacon|40|7
3|Hamburguesa Doble|40|Carne vacuna|80|2
1|Hamburguesa Clásica|50|Tomate|50|4
6|Aros de Cebolla|70|Cebolla|70|5
5|Papas Fritas|250|Papas|250|13
```

- **Entre corridas:** SHA-256 `e1283171…66f1` en las tres. `cmp` 1–2, 1–3 y 2–3: idénticas.
- **Contra el manual:** 6 filas de cada lado. Solo V2: 0 y solo manual: 0, en las tres corridas.
- **Empates según el manual:** ninguno.

### 3.2 Medusa

| Sesión | Hora del servidor (UTC) | Rol | pid | `read_only` |
|---|---|---|---|---|
| V2, corrida 1 | 16:04:09.530 | `medusa` | 113 | on |
| V2, corrida 2 | 16:04:10.090 | `medusa` | 120 | on |
| V2, corrida 3 | 16:04:10.588 | `medusa` | 127 | on |
| manual | 16:04:11.181 | `medusa` | 134 | on |

La salida tiene 20 filas y es idéntica en las tres corridas (`salidas/p3_medusa/datos/v2_corrida1.txt`). Cada variante tiene `stock_producible = 1000000` y su único ítem de inventario como limitante. Primeras filas:

```
variant_01M2Y2W2W86H25DSB7KMSCC47J|Medusa T-Shirt - S / Black|1000000|S / Black|1000000|iitem_01M2Y2W2Y872375F32J08SC3XF
variant_01M2Y2W2W9EHVM9GA5NZYGQETN|Medusa T-Shirt - S / White|1000000|S / White|1000000|iitem_01M2Y2W2Y85GDAR3TN4QK6089P
variant_01M2Y2W2WA2AB8KRVTSJP377F6|Medusa T-Shirt - M / White|1000000|M / White|1000000|iitem_01M2Y2W2Y9ANKKX32ZN54BCNV5
…
```

- **Entre corridas:** SHA-256 `1938b55b…6a1b` en las tres. `cmp`: idénticas.
- **Contra el manual:** 20 filas de cada lado. Solo V2: 0 y solo manual: 0, en las tres corridas.
- **Empates:** ninguno. Las 20 variantes tienen un componente cada una.

### 3.3 Odoo

| Sesión | Hora del servidor (UTC) | Rol | pid | `read_only` |
|---|---|---|---|---|
| V2, corrida 1 | 16:04:26.206 | `zd_odoo_lectura` | 129 | on |
| V2, corrida 2 | 16:04:26.654 | `zd_odoo_lectura` | 136 | on |
| V2, corrida 3 | 16:04:27.114 | `zd_odoo_lectura` | 144 | on |
| manual | 16:04:27.588 | `odoo` | 151 | on |

Salida de las tres corridas:

```
54|Table|0|Table Leg|0|56
63|Plastic Laminate|0|Ply Veneer|0|61
64|Table Kit|0|Bolt|0|57
8|Desk Combination|0|Corner Desk Left Sit|0.00|32
62|Wood Panel|6|Ply Layer|20.00|59
55|Table Top|24|Wood Panel|48.00|62
39|Drawer|45|Drawer Black|45.00|65
```

Salida del cálculo manual (`producto|stock|limitante_id|empatados|n|limitante con COLLATE "C"`):

```
39|45|65|65,66|2|65
54|0|56|56,57,58|3|56
55|24|62|62|1|62
62|6|59|59|1|59
63|0|61|61|1|61
64|0|57|57|1|57
8|0|32|32,33|2|32
```

- **Entre corridas:** SHA-256 `d3faa35b…fa89` en las tres. `cmp`: idénticas.
- **Contra el manual:** 7 filas de cada lado. Solo V2: 0 y solo manual: 0, en las tres corridas.
- **Contra lo esperado en el preregistro (5.1, salida base):** las tres corridas coinciden byte a byte (`salidas/esperado/cmp_odoo.txt`).
- **Empates:** en los tres (8: {32, 33}; 39: {65, 66}; 54: {56, 57, 58}) la V2 informa el id menor. En la replicación del 2026-09-26, con la versión 1, el producto 39 había dado Drawer Case Black en una corrida y Drawer Black en otra. Ahora da `65` (Drawer Black) en las tres.

---

## 4. Modificaciones controladas

En las dos modificaciones, el dueño de las tablas abre una transacción `REPEATABLE READ` de escritura. Dentro de ella: el cambio, una guarda, el manual y la V2 tres veces con `SET ROLE` al rol de solo lectura (D-2). La transacción termina en `ROLLBACK`, y la verificación se hace desde sesiones nuevas.

### 4.1 Odoo (`scripts/p4_odoo.sh`)

**Valores esperados:** la sección 5.1 del preregistro, que repite exactamente `experimentos/odoo/ESPERADO_P3_4.md`:

- la línea 6 (Table, componente 57 Bolt) pasa de 4 a 12;
- se agrega un `stock_quant` de 7 para Bolt en la ubicación 5;
- se espera Table 0 con limitante 56 (empate {56, 58}) y Table Kit 1 con limitante 57, con `stock_insumo_limitante = 7`;
- los demás productos no cambian.

**Ejecución:**

- **Estado previo** (sesión `odoo`, solo lectura, 16:04:42 UTC): la línea 6 tiene `product_qty = 4.00` y hay 0 `stock_quant` internos de 57.
- **Transacción** (pid 196, 16:04:42.659 UTC):
  - `UPDATE mrp_bom_line SET product_qty = 12 WHERE id = 6 AND product_qty = 4` → `UPDATE 1`;
  - `INSERT INTO stock_quant (57, 5, 1, 7, 0, now())` → `INSERT 0 1`;
  - la guarda da `ok`;
  - `SET ROLE zd_odoo_lectura`, y `current_user = zd_odoo_lectura`;
  - la V2, tres veces;
  - `ROLLBACK`.

Valores obtenidos, idénticos en las tres corridas (SHA-256 `35461d6d…65b6`):

```
54|Table|0|Table Leg|0|56
63|Plastic Laminate|0|Ply Veneer|0|61
8|Desk Combination|0|Corner Desk Left Sit|0.00|32
64|Table Kit|1|Bolt|7|57
62|Wood Panel|6|Ply Layer|20.00|59
55|Table Top|24|Wood Panel|48.00|62
39|Drawer|45|Drawer Black|45.00|65
```

- **Contra lo esperado:** las tres corridas coinciden byte a byte con el bloque del preregistro (`salidas/esperado/cmp_odoo.txt`).
- **Contra el manual dentro de la transacción:** 0/0 en las tres corridas. El manual da 54: empatados {56, 58} y 64: stock 1, limitante 57.
- **Entre corridas:** `cmp`, idénticas.

**Reversión**, desde sesiones nuevas:

- Sesión `odoo`, pid 203, solo lectura: la línea 6 volvió a 4.00 y hay 0 quants internos de 57. La huella es idéntica a la del estado base.
- Sesión `zd_odoo_lectura`, pid 210: la V2 es idéntica byte a byte a la corrida 1 del paso 3 y a la salida base esperada.

### 4.2 Food Store (`scripts/p4_foodstore_estado.sh` y `scripts/p4_foodstore.sh 3 60 50`)

**Valores esperados** (`experimentos/desempate/ESPERADO_FOODSTORE.md`, commit `0443104`), a partir del estado leído a las 13:05:12 con la regla 5.2:

- El candidato de menor id es el producto 1, Hamburguesa Clásica. **L** = Tomate (4), con 50/1, y **S** = Lechuga (3), con 60/1. La existencia nueva de Lechuga es `50 · 1 / 1 = 50`.
- Lechuga también está en la receta de Hamburguesa Doble (3), pero ahí el mínimo sigue siendo Carne vacuna, con 80/2 = 40.
- En el producto 1, el empate queda en {3, 4} y el limitante esperado es **3, Lechuga** (`'3' < '4'`). El desempate cambia el insumo informado, que antes era Tomate.

**Ejecución:** transacción de `postgres`, pid 1151, 16:05:50 UTC.

1. La huella dentro de la transacción, antes del cambio, es idéntica a la de la lectura previa.
2. `UPDATE ingredient SET stock_quantity = 50 WHERE id = 3 AND stock_quantity = 60 AND deleted_at IS NULL` → `UPDATE 1`. La guarda da `ok`.
3. `SET ROLE lector_zerodashboard`. Con ese rol corren el manual y la V2, tres veces.
4. `ROLLBACK`.

Valores obtenidos, idénticos en las tres corridas (SHA-256 `db3816c2…a66b`):

```
4|Hamburguesa Picante|15|Jalapeños|30|12
2|Hamburguesa BBQ Bacon|20|Bacon|40|7
3|Hamburguesa Doble|40|Carne vacuna|80|2
1|Hamburguesa Clásica|50|Lechuga|50|3
6|Aros de Cebolla|70|Cebolla|70|5
5|Papas Fritas|250|Papas|250|13
```

- **Contra lo esperado:** las tres corridas coinciden byte a byte con el bloque de `ESPERADO_FOODSTORE.md` (`salidas/esperado/cmp_foodstore.txt`).
- **Contra el manual:** 0/0 en las tres corridas. El manual da, para el producto 1, empatados {3, 4} y limitante 3.
- **Entre corridas:** `cmp`, idénticas.

**Reversión**, desde una sesión nueva de `lector_zerodashboard` (pid 1158, solo lectura):

- Lechuga tiene de nuevo `stock_quantity = 60`.
- La huella es idéntica a la del estado previo.
- La V2 es idéntica byte a byte a la corrida 1 del paso 3, con Tomate (4) como limitante del producto 1.

---

## 5. Veredicto

| Criterio | Veredicto | Evidencia |
|---|---|---|
| **C1.** La V2 necesita editar su texto para ejecutar sobre algún esquema | **No se cumple** | 17 corridas de la V2 sobre los tres esquemas: 9 en los estados base (3 por esquema), 6 en los estados modificados (3 por cada uno) y 2 de verificación, una por reversión. Todas con `exit=0`. El SHA-256 de la V2 fue `b2acb066…61f7` en el host y en el contenedor en las seis preparaciones (`salidas/*/hashes*.txt`). El texto se copió al contenedor sin cambios |
| **C2.** El stock producible o el insumo limitante difieren del cálculo manual, incluidos los estados modificados | **No se cumple** | Diferencia simétrica en las dos direcciones sobre `(producto, stock_producible, insumo_limitante_id)`: 0 filas en las 15 comparaciones (5 estados × 3 corridas; `salidas/*/comparacion.md`). En los estados modificados, además, la salida coincide byte a byte con los valores esperados escritos antes de ejecutar (`salidas/esperado/cmp_*.txt`) |
| **C3.** Las tres corridas de algún esquema o estado modificado no son idénticas byte a byte | **No se cumple** | `cmp` 1–2, 1–3 y 2–3: idénticas en los cinco estados. En cada estado, las tres corridas tienen el mismo SHA-256: Food Store `e1283171…`, Medusa `1938b55b…`, Odoo `d3faa35b…`, Odoo modificado `35461d6d…`, Food Store modificado `db3816c2…` |

**La corrección no queda refutada.**

**Alcance de la evidencia.** Esto es lo que el experimento no ejercitó:

- **Orden de texto contra orden numérico.** En todos los empates que aparecieron, los ids tienen la misma cantidad de dígitos: {32, 33}, {65, 66}, {56, 57, 58}, {56, 58} y {3, 4}. Por eso ordenar como texto o como número da lo mismo. Ningún caso distingue `'10' < '9'`. La regla está fijada como texto y el manual la aplica como texto, pero ningún dato puso a prueba esa diferencia.
- **Colación.** En ningún producto la colación de la base (`en_US.utf8` o `C`) y `COLLATE "C"` eligieron distinto: 0 en los cinco estados.
- **Medusa.** No tiene empates, porque cada variante tiene un solo componente. Ahí se verificó que la V2 corre sin cambios y reproduce el cálculo manual, pero no el desempate.
- **Redondeo de `numeric`.** El manual compara los cocientes exactos, por producto cruzado. La V2 ordena por el cociente en `numeric`, que en Odoo pasa por divisiones de factores de unidad. Los resultados coincidieron en todos los casos. No se buscó a propósito, ni apareció, un par de cocientes racionalmente iguales cuyo valor `numeric` redondee distinto: el experimento no pone a prueba ese caso.

---

## 6. Desvíos e incidentes

### Desvíos

- **D-1 — Valores esperados de Food Store fuera del preregistro.** El prompt pide los valores esperados de las modificaciones controladas en el preregistro. Para Odoo están ahí (5.1), derivados de salidas ya commiteadas. Para Food Store, calcularlos exigía leer existencias y recetas antes del commit del preregistro. En su lugar, el preregistro fijó la regla que los determina (5.2), y los valores se escribieron en `ESPERADO_FOODSTORE.md`, commiteado en `0443104` antes de ejecutar la modificación. Estaba declarado de antemano en el preregistro.
- **D-2 — V2 dentro de la transacción de escritura, con `SET ROLE`.** En las dos modificaciones, la V2 no corrió con una conexión propia del rol de solo lectura. Corrió dentro de la transacción del dueño de las tablas (`odoo`, `postgres`), con `SET ROLE` a `zd_odoo_lectura` o `lector_zerodashboard`. Es la única forma de que vea los cambios no confirmados, y ejecuta con los privilegios de ese rol. Es el mismo desvío D-2 de `bitacora_odoo.md`. Estaba preregistrado.
- **D-3 — Tres corridas en una misma sesión en los estados modificados.** Por la misma razón, las tres corridas de cada estado modificado son de la misma sesión y la misma transacción. En los estados base son tres sesiones distintas. Estaba preregistrado.
- **D-4 — Roles sin solo lectura.** Medusa no tiene rol de solo lectura: la V2 corrió como `medusa`, con la transacción `READ ONLY` (`read_only = on`). En Odoo, el manual y las huellas corrieron como `odoo`, porque `zd_odoo_lectura` solo lee las vistas. Estaba preregistrado.

### Incidentes

- **I-1 — `docker cp` falló en el primer intento de Food Store (13:03).** Con `MSYS_NO_PATHCONV=1`, Git Bash no convirtió la ruta del host `/c/Users/…`, y `docker cp` respondió `GetFileAttributesEx C:\c: El sistema no puede encontrar el archivo especificado`. El script cortó en la preparación, **antes de cualquier `psql`**: no se ejecutó ninguna consulta. Se corrigió `scripts/lib.sh` para usar `pwd -W`, la ruta con forma Windows. El SHA-256 pasó de `420cdec6…040c` (preregistrado) a `c879491e…82eb`. El paso 3 de Food Store se corrió completo de nuevo.
- **I-2 — Extracción de los bloques esperados.** El primer intento de extraer con `awk` los bloques esperados del preregistro, para compararlos con `cmp`, usó `in` como nombre de variable, que es palabra reservada de `awk`. Dio error y archivos vacíos. Se reescribió el comando. No hay datos afectados: la comparación válida está en `salidas/esperado/cmp_odoo.txt`.
- **I-3 — Contenedores arrancados antes del preregistro.** `zd-odoo-db-1` (estaba `Exited (255)`) y `ch16-medusa-pg` (estaba `Exited (0)`) se arrancaron a las 12:56:08, para leer el catálogo antes de escribir el preregistro. Al terminar, se detuvieron: Medusa a las 13:04:21 y Odoo a las 13:06:22, los dos en `Exited (0)`. El arranque puede haber hecho la recuperación normal de PostgreSQL al iniciar. Las huellas muestran que los datos no cambiaron entre las lecturas.
- **I-4 — Etiqueta de la huella en `p4_foodstore/comparacion.md`.** Ahí, "huella antes = huella despues" compara la lectura previa con la huella tomada **dentro** de la transacción, antes del `UPDATE`. La comparación con la huella posterior al `ROLLBACK` está en la sección "Reversion" del mismo archivo.

---

## 7. Fechas y horas

Horas del host en −03:00. Entre paréntesis, la hora del servidor en UTC, cuando se registró.

| Hora | Evento |
|---|---|
| 12:56:08 | Arranque de `zd-odoo-db-1` y `ch16-medusa-pg`. Rama `experimento/desempate` creada desde `experimento/odoo` (`c3ee7b4`) |
| 12:56–13:03 | Lectura del catálogo, `EXPLAIN` de los manuales y las huellas, escritura de la V2 y de los scripts |
| 13:03:31 | Commit del preregistro `5c00e1c` |
| 13:03 | Primer intento del paso 3 en Food Store, abortado en `docker cp` (I-1) |
| 13:03:49–13:03:53 | Paso 3, Food Store: huella, V2 ×3 (16:03:51.153 / .580 / 52.093), manual (16:03:52.688), huella |
| 13:04:08–13:04:11 | Paso 3, Medusa: V2 ×3 (16:04:09.530 / 10.090 / 10.588), manual (16:04:11.181) |
| 13:04:21 | `docker stop ch16-medusa-pg` |
| 13:04:24–13:04:28 | Paso 3, Odoo: V2 ×3 (16:04:26.206 / .654 / 27.114), manual (16:04:27.588) |
| 13:04:41–13:04:44 | Paso 4, Odoo: estado previo (16:04:42.034), transacción con `ROLLBACK` (16:04:42.659), verificación (16:04:43.430 y 16:04:44.072) |
| 13:05:12 | Paso 4, Food Store: lectura del estado previo (16:05:12.799) |
| 13:05:42 | Commit `0443104` con `ESPERADO_FOODSTORE.md` |
| 13:05:49–13:05:50 | Paso 4, Food Store: transacción con `ROLLBACK` (16:05:50.232) y verificación (16:05:50.745) |
| 13:06:22 | `docker stop zd-odoo-db-1` |

El hash del commit que contiene esta bitácora se anota en un commit posterior, porque un commit no puede contener su propio hash.

## Commits

| Commit | Contenido |
|---|---|
| `5c00e1c581e7e06ae2a013df4cdd6dcafde4563f` | Preregistro: V2, manuales, huellas, scripts, criterios |
| `0443104` | Corridas base (paso 3), modificación de Odoo, corrección I-1 y `ESPERADO_FOODSTORE.md` |
| `748e64a` | Modificación de Food Store, comparaciones con lo esperado y esta bitácora |
