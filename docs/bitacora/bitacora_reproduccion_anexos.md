# Bitácora — Reproducción de las verificaciones de WF-01 y WF-03 sobre la base actual de Food Store

**Fecha:** 2026-09-24. Ejecución contra la base entre 16:45:11 y 16:46:33 UTC (13:45:11 a 13:46:33, hora -03:00). El contenedor de la base usa `TimeZone = UTC`.
**Encargo:** repetir sobre la base actual las verificaciones de las bitácoras de WF-01 y WF-03 (hechas en junio de 2026) o dejar constancia de que no son reproducibles. El motivo es que la base de Food Store se re-sembró el 17/09/2026.
**Base:** `food_store` (esquema `public`), contenedor `foodstore-backend-fastapi-db-1`, usuario `postgres`.
**Regla aplicada:** una sola modificación de datos, hecha en una única transacción. El estado previo se registró antes, el SQL se mostró al autor y se ejecutó recién con su confirmación. El cambio se revirtió con `ROLLBACK` y la reversión se verificó por consulta desde una sesión nueva.

---

## Resultado

| Verificación | Estado | Motivo |
|---|---|---|
| WF-01a — stock físico de un producto sin receta, forzado por debajo de 20 | **No reproducible** | Falta la consulta de stock físico del Anexo A (ver "Documentos de referencia faltantes"). |
| WF-01c — stock producible con un ingrediente forzado a 5 | **Reproducida** | Stock producible obtenido 2, cálculo manual 2. La reversión quedó verificada. Hay una salvedad sobre el `HAVING`. |
| WF-03 — asimetría de cancelados con las tres consultas del Anexo C | **No reproducible** | Faltan las tres consultas del Anexo C. No se buscó un día con pedidos ni se fabricaron datos. |

---

## Documentos de referencia faltantes

Antes de tocar la base se buscaron las bitácoras de WF-01 y WF-03 y los Anexos A y C. Se revisaron estos lugares:

- este repositorio y su historial de git, incluidos los archivos borrados (`git log --all -S "Anexo C"`, `git log --all --diff-filter=D`);
- los demás proyectos de `Documentos/Proyectos` (`FoodStore-Backend-FastAPI`, `El-Buen-Sabor-Front`, `ElBuenSabor-TP`, `saleor-platform`);
- la carpeta de usuario, hasta 4 niveles de profundidad.

| Documento | Hallazgo |
|---|---|
| Bitácora de WF-01 | No está. Solo aparece mencionada en `bitacora_CH-16b_tres_esquemas.md`, `mapa-historias.md` y en el `README_correr.md` de CH-16b. |
| Bitácora de WF-03 | No está y nada la menciona. |
| Anexo A, consulta de stock físico (WF-01a) | No está. `bitacora_CH-16b_tres_esquemas.md` (hallazgo 2) solo anota que esa rama "necesita su propia consulta canónica, con un `NOT EXISTS`". |
| Anexo A, consulta de WF-01c | Hay una copia parcial en `openspec/changes/CH-16b-vistas-canonicas/sql/02_query_original.sql`, **sin el `HAVING`**. |
| Anexo C (tres consultas de WF-03) | No hay ningún rastro. |

Por decisión del autor (2026-09-24), WF-01c se reprodujo con `02_query_original.sql`, y WF-01a y WF-03 se registran como no reproducibles. No se reconstruyó ninguna consulta de memoria.

Como las bitácoras de junio no están disponibles, **no se comparan los valores de hoy con los de junio**. Lo que sigue verifica el comportamiento sobre la base actual, no la identidad con lo registrado en junio.

---

## Evidencia de la re-siembra

Todas las filas de `ingredient` tienen `created_at` del 17/09/2026:

```
            min             |            max
----------------------------+----------------------------
 2026-09-17 13:07:31.605966 | 2026-09-17 13:07:31.635835
(1 row)
```

No hay triggers de usuario en la base (`SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal;` → `(0 rows)`), así que un `UPDATE` directo no toca `updated_at`.

---

## WF-01c

### Elección del ingrediente

Se buscaron ingredientes que alguna receta use con `quantity > 1`. Hay tres: Bacon (id 7, ×2 en BBQ Bacon), Carne vacuna (id 2, ×2 en Doble) y Queso cheddar (id 6, ×2 en Doble). Se eligió **Bacon (id 7)** porque solo aparece en la receta del producto 2 (Hamburguesa BBQ Bacon). Así, el efecto esperado se limita a un único producto.

Receta completa de la base (salida cruda):

```
 product_id |         name          | ingredient_id |      ing      | quantity | stock_quantity
------------+-----------------------+---------------+---------------+----------+----------------
          1 | Hamburguesa Clásica   |             1 | Pan brioche   |        1 |            120
          1 | Hamburguesa Clásica   |             2 | Carne vacuna  |        1 |             80
          1 | Hamburguesa Clásica   |             3 | Lechuga       |        1 |             60
          1 | Hamburguesa Clásica   |             4 | Tomate        |        1 |             50
          1 | Hamburguesa Clásica   |             5 | Cebolla       |        1 |             70
          1 | Hamburguesa Clásica   |             8 | Mayonesa      |        1 |            200
          2 | Hamburguesa BBQ Bacon |             1 | Pan brioche   |        1 |            120
          2 | Hamburguesa BBQ Bacon |             2 | Carne vacuna  |        1 |             80
          2 | Hamburguesa BBQ Bacon |             5 | Cebolla       |        1 |             70
          2 | Hamburguesa BBQ Bacon |             6 | Queso cheddar |        1 |             90
          2 | Hamburguesa BBQ Bacon |             7 | Bacon         |        2 |             40
          2 | Hamburguesa BBQ Bacon |            11 | Salsa BBQ     |        1 |            100
          3 | Hamburguesa Doble     |             1 | Pan brioche   |        1 |            120
          3 | Hamburguesa Doble     |             2 | Carne vacuna  |        2 |             80
          3 | Hamburguesa Doble     |             3 | Lechuga       |        1 |             60
          3 | Hamburguesa Doble     |             4 | Tomate        |        1 |             50
          3 | Hamburguesa Doble     |             6 | Queso cheddar |        2 |             90
          3 | Hamburguesa Doble     |             8 | Mayonesa      |        1 |            200
          4 | Hamburguesa Picante   |             1 | Pan brioche   |        1 |            120
          4 | Hamburguesa Picante   |             2 | Carne vacuna  |        1 |             80
          4 | Hamburguesa Picante   |             6 | Queso cheddar |        1 |             90
          4 | Hamburguesa Picante   |             8 | Mayonesa      |        1 |            200
          4 | Hamburguesa Picante   |            11 | Salsa BBQ     |        1 |            100
          4 | Hamburguesa Picante   |            12 | Jalapeños     |        2 |             30
          5 | Papas Fritas          |            13 | Papas         |        1 |            250
          6 | Aros de Cebolla       |             5 | Cebolla       |        1 |             70
(26 rows)
```

### Estado previo (registrado antes de la modificación)

```
 id | name  | stock_quantity |         updated_at         | deleted_at | is_active
----+-------+----------------+----------------------------+------------+-----------
  7 | Bacon |             40 | 2026-09-17 13:07:31.623998 |            | t
(1 row)
```

Línea base de la consulta de WF-01c (`02_query_original.sql` sin la línea `SET search_path TO foodstore;`, porque en la base real el esquema es `public`):

```
 id |         name          | stock_producible | ingrediente_critico
----+-----------------------+------------------+---------------------
  1 | Hamburguesa Clásica   |               50 | Tomate
  2 | Hamburguesa BBQ Bacon |               20 | Bacon
  3 | Hamburguesa Doble     |               40 | Carne vacuna
  4 | Hamburguesa Picante   |               15 | Jalapeños
  5 | Papas Fritas          |              250 | Papas
  6 | Aros de Cebolla       |               70 | Cebolla
(6 rows)
```

### Cálculo manual esperado (Bacon = 5)

Hamburguesa BBQ Bacon, `stock ÷ cantidad` por ingrediente:

| Ingrediente | Stock | Cantidad | Cociente |
|---|---|---|---|
| Pan brioche | 120 | 1 | 120 |
| Carne vacuna | 80 | 1 | 80 |
| Cebolla | 70 | 1 | 70 |
| Queso cheddar | 90 | 1 | 90 |
| Bacon | 5 | 2 | 2.5 |
| Salsa BBQ | 100 | 1 | 100 |

MIN = 2.5 y FLOOR(2.5) = **2**, con **Bacon** como ingrediente crítico. Los otros cinco productos no deberían cambiar.

### Ejecución (salida cruda, `psql -X -e`)

```
-- inicio:
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-24 16:46:26.708761+00
(1 row)

BEGIN;
BEGIN
SELECT id, name, stock_quantity FROM ingredient WHERE id = 7;
 id | name  | stock_quantity
----+-------+----------------
  7 | Bacon |             40
(1 row)

UPDATE ingredient SET stock_quantity = 5 WHERE id = 7 AND stock_quantity = 40;
UPDATE 1
SELECT id, name, stock_quantity FROM ingredient WHERE id = 7;
 id | name  | stock_quantity
----+-------+----------------
  7 | Bacon |              5
(1 row)

SELECT p.id, p.name,
       FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) AS stock_producible,
       (ARRAY_AGG(i.name ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS ingrediente_critico
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL
WHERE p.deleted_at IS NULL AND p.available = true AND pi.quantity > 0
GROUP BY p.id, p.name ORDER BY p.id;
 id |         name          | stock_producible | ingrediente_critico
----+-----------------------+------------------+---------------------
  1 | Hamburguesa Clásica   |               50 | Tomate
  2 | Hamburguesa BBQ Bacon |                2 | Bacon
  3 | Hamburguesa Doble     |               40 | Carne vacuna
  4 | Hamburguesa Picante   |               15 | Jalapeños
  5 | Papas Fritas          |              250 | Papas
  6 | Aros de Cebolla       |               70 | Cebolla
(6 rows)

ROLLBACK;
ROLLBACK
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-24 16:46:26.721978+00
(1 row)
```

**Resultado:** la consulta devolvió 2 para BBQ Bacon con Bacon como crítico, igual que el cálculo manual. Los demás productos quedaron sin cambios.

### Verificación de la reversión (sesión nueva)

```
SELECT clock_timestamp();
       clock_timestamp
------------------------------
 2026-09-24 16:46:33.28196+00
(1 row)

SELECT id, name, stock_quantity, updated_at, deleted_at, is_active FROM ingredient WHERE id = 7;
 id | name  | stock_quantity |         updated_at         | deleted_at | is_active
----+-------+----------------+----------------------------+------------+-----------
  7 | Bacon |             40 | 2026-09-17 13:07:31.623998 |            | t
(1 row)

 id |         name          | stock_producible | ingrediente_critico
----+-----------------------+------------------+---------------------
  1 | Hamburguesa Clásica   |               50 | Tomate
  2 | Hamburguesa BBQ Bacon |               20 | Bacon
  3 | Hamburguesa Doble     |               40 | Carne vacuna
  4 | Hamburguesa Picante   |               15 | Jalapeños
  5 | Papas Fritas          |              250 | Papas
  6 | Aros de Cebolla       |               70 | Cebolla
(6 rows)
```

**Resultado:** `stock_quantity` volvió a 40, `updated_at` no cambió y la consulta coincide fila por fila con la línea base.

### Salvedad

Se usó la consulta sin su `HAVING` original, porque el umbral del Anexo A no está disponible. Queda verificado el cálculo del stock producible y del ingrediente crítico. **No** queda verificado que BBQ Bacon aparezca en la salida filtrada de WF-01c, ya que eso depende del umbral.

---

## WF-01a — no reproducible

Falta la consulta de stock físico del Anexo A. No se escribió una consulta sustituta, porque eso ya no reproduciría el Anexo A. No se modificaron datos.

## WF-03 — no reproducible

Faltan las tres consultas del Anexo C. Por decisión del autor no se buscó un día con pedidos y cancelados, y no se fabricaron datos. No se modificaron datos.

---

## Para cerrar las dos pendientes

Hace falta incorporar al repositorio el Anexo A completo (con la consulta de stock físico y el `HAVING` de WF-01c) y el Anexo C, o las bitácoras de WF-01 y WF-03 que los contienen. Con eso, WF-01a y WF-03 se pueden repetir con el mismo procedimiento de esta bitácora.

---

## Segunda ronda

**Fecha:** 2026-09-25. Ejecución contra la base entre 02:03:13 y 02:05:04 UTC (2026-09-24, 23:03:13 a 23:05:04, hora -03:00).
**Motivo:** el autor agregó al repositorio las bitácoras originales: `docs/bitacora/estudio_previo/bitacora_WF-01.md` y `docs/bitacora/estudio_previo/bitacora_WF-03_reportes.md`. Contienen las consultas textuales que faltaban en la primera ronda: WF-01 en las secciones 4.2 y 5.2, y WF-03 en las secciones 4.1 a 4.3.
**Base:** la misma de la primera ronda: `food_store` (esquema `public`), contenedor `foodstore-backend-fastapi-db-1`, usuario `postgres`, `TimeZone = UTC`.
**Comando:** cada bloque se ejecutó con `docker exec -i foodstore-backend-fastapi-db-1 psql -X -e -U postgres -d food_store`, leyendo el SQL por la entrada estándar. Las transacciones agregan `-v ON_ERROR_STOP=1`.
**Regla aplicada:** hubo dos modificaciones de datos, cada una en su propia transacción. El estado previo se registró antes. El autor vio el SQL de las dos y las confirmó antes de ejecutarlas. Las dos terminan en `ROLLBACK`, y cada reversión se verificó por consulta desde una sesión nueva. No se fabricaron datos. Las consultas se ejecutaron tal cual figuran en las bitácoras de junio. La única alteración está en WF-03 con rango fijo y se detalla en su apartado.

### Resultado

| Verificación | Estado | Detalle |
|---|---|---|
| WF-01a: stock físico de un producto sin receta, forzado por debajo de 20 | **Reproducida** | La línea base da 0 filas. Con Agua Mineral 500ml (id 8) forzada a 8, aparece como única fila. La reversión quedó verificada. |
| WF-01c: consulta de la sección 5.2 con `HAVING <= 10` y Bacon forzado a 5 | **Reproducida** | La línea base da 0 filas. Con Bacon = 5, BBQ Bacon **sí** aparece en la salida filtrada: stock producible 2, crítico Bacon, stock del crítico 5. Coincide con la sección 5.5 de junio. La reversión quedó verificada. Se levanta la salvedad de la primera ronda. |
| WF-03: asimetría de cancelados con las tres consultas de las secciones 4.1 a 4.3 | **Reproducida** | Las tablas `pedido`, `estado_pedido` y `detalle_pedido` existen y las tres consultas corren sin error. El día 2026-09-14 tiene 3 pedidos: 2 entregados y 1 cancelado. Ventas cuenta 2 pedidos y el desglose por estado cuenta 3. La diferencia es exactamente el pedido cancelado. |

### Estado previo (registrado antes de las modificaciones)

```
SELECT p.id, p.name, p.stock_quantity, p.available, p.deleted_at, p.updated_at
FROM product p WHERE NOT EXISTS (SELECT 1 FROM product_ingredient pi WHERE pi.product_id = p.id) ORDER BY p.id;
 id |         name         | stock_quantity | available | deleted_at |         updated_at
----+----------------------+----------------+-----------+------------+----------------------------
  7 | Coca Cola 500ml      |            150 | t         |            | 2026-09-17 13:07:31.844501
  8 | Agua Mineral 500ml   |            200 | t         |            | 2026-09-17 13:07:31.866827
  9 | Brownie de Chocolate |             40 | t         |            | 2026-09-17 13:07:31.878598
(3 rows)

SELECT clock_timestamp();
       clock_timestamp
-----------------------------
 2026-09-25 02:03:39.5194+00
(1 row)

SELECT id, name, stock_quantity, available, deleted_at, updated_at FROM product WHERE id = 8;
 id |        name        | stock_quantity | available | deleted_at |         updated_at
----+--------------------+----------------+-----------+------------+----------------------------
  8 | Agua Mineral 500ml |            200 | t         |            | 2026-09-17 13:07:31.866827
(1 row)

SELECT id, name, stock_quantity, updated_at, deleted_at, is_active FROM ingredient WHERE id = 7;
 id | name  | stock_quantity |         updated_at         | deleted_at | is_active
----+-------+----------------+----------------------------+------------+-----------
  7 | Bacon |             40 | 2026-09-17 13:07:31.623998 |            | t
(1 row)

SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal;
 tgname | tgrelid
--------+---------
(0 rows)
```

---

### WF-01a

#### Línea base (consulta de la sección 4.2, tal cual)

El esquema actual tiene todas las columnas y tablas de la consulta, y la consulta corrió sin error.

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:03:13.558742+00
(1 row)

SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND p.stock_quantity <= 20
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
 id | name | stock_quantity | available
----+------+----------------+-----------
(0 rows)
```

Se eligió **Agua Mineral 500ml (id 8)** porque es el producto que forzó la sección 4.4 de junio, y con el mismo valor (8). El `UPDATE` lleva la guarda `AND stock_quantity = 200`.

#### Ejecución (salida cruda)

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:04:59.268345+00
(1 row)

BEGIN;
BEGIN
SELECT id, name, stock_quantity FROM product WHERE id = 8;
 id |        name        | stock_quantity
----+--------------------+----------------
  8 | Agua Mineral 500ml |            200
(1 row)

UPDATE product SET stock_quantity = 8 WHERE id = 8 AND stock_quantity = 200;
UPDATE 1
SELECT id, name, stock_quantity FROM product WHERE id = 8;
 id |        name        | stock_quantity
----+--------------------+----------------
  8 | Agua Mineral 500ml |              8
(1 row)

SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND p.stock_quantity <= 20
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
 id |        name        | stock_quantity | available
----+--------------------+----------------+-----------
  8 | Agua Mineral 500ml |              8 | t
(1 row)

ROLLBACK;
ROLLBACK
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:04:59.283483+00
(1 row)
```

**Resultado:** con `stock_quantity = 8`, Agua Mineral 500ml aparece en la salida. Es la única fila y los otros dos productos sin receta no aparecen.

#### Verificación de la reversión (sesión nueva)

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:04:59.652424+00
(1 row)

SELECT id, name, stock_quantity, available, deleted_at, updated_at FROM product WHERE id = 8;
 id |        name        | stock_quantity | available | deleted_at |         updated_at
----+--------------------+----------------+-----------+------------+----------------------------
  8 | Agua Mineral 500ml |            200 | t         |            | 2026-09-17 13:07:31.866827
(1 row)

SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND p.stock_quantity <= 20
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
 id | name | stock_quantity | available
----+------+----------------+-----------
(0 rows)
```

**Resultado:** `stock_quantity` volvió a 200, `updated_at` no cambió y la consulta vuelve a devolver 0 filas, igual que la línea base.

---

### WF-01c

#### Línea base (consulta de la sección 5.2, tal cual y con `HAVING <= 10`)

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:03:13.947495+00
(1 row)

SELECT
    p.id,
    p.name,
    FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) AS stock_producible,
    (ARRAY_AGG(i.name ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS ingrediente_critico,
    (ARRAY_AGG(i.stock_quantity ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS stock_ingrediente_critico
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i
       ON i.id = pi.ingredient_id
      AND i.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND pi.quantity > 0
GROUP BY p.id, p.name
HAVING FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) <= 10
ORDER BY stock_producible ASC;
 id | name | stock_producible | ingrediente_critico | stock_ingrediente_critico
----+------+------------------+---------------------+---------------------------
(0 rows)
```

#### Ejecución con Bacon forzado a 5 (salida cruda)

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:05:04.165941+00
(1 row)

BEGIN;
BEGIN
SELECT id, name, stock_quantity FROM ingredient WHERE id = 7;
 id | name  | stock_quantity
----+-------+----------------
  7 | Bacon |             40
(1 row)

UPDATE ingredient SET stock_quantity = 5 WHERE id = 7 AND stock_quantity = 40;
UPDATE 1
SELECT id, name, stock_quantity FROM ingredient WHERE id = 7;
 id | name  | stock_quantity
----+-------+----------------
  7 | Bacon |              5
(1 row)

SELECT
    p.id,
    p.name,
    FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) AS stock_producible,
    (ARRAY_AGG(i.name ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS ingrediente_critico,
    (ARRAY_AGG(i.stock_quantity ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS stock_ingrediente_critico
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i
       ON i.id = pi.ingredient_id
      AND i.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND pi.quantity > 0
GROUP BY p.id, p.name
HAVING FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) <= 10
ORDER BY stock_producible ASC;
 id |         name          | stock_producible | ingrediente_critico | stock_ingrediente_critico
----+-----------------------+------------------+---------------------+---------------------------
  2 | Hamburguesa BBQ Bacon |                2 | Bacon               |                         5
(1 row)

ROLLBACK;
ROLLBACK
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:05:04.177449+00
(1 row)
```

**Resultado:** BBQ Bacon **aparece** en la salida filtrada con stock producible 2, ingrediente crítico Bacon y stock del ingrediente crítico 5. Es la única fila.

#### Verificación de la reversión (sesión nueva)

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:05:04.558552+00
(1 row)

SELECT id, name, stock_quantity, updated_at, deleted_at, is_active FROM ingredient WHERE id = 7;
 id | name  | stock_quantity |         updated_at         | deleted_at | is_active
----+-------+----------------+----------------------------+------------+-----------
  7 | Bacon |             40 | 2026-09-17 13:07:31.623998 |            | t
(1 row)

SELECT
    p.id,
    p.name,
    FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) AS stock_producible,
    (ARRAY_AGG(i.name ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS ingrediente_critico,
    (ARRAY_AGG(i.stock_quantity ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS stock_ingrediente_critico
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i
       ON i.id = pi.ingredient_id
      AND i.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND pi.quantity > 0
GROUP BY p.id, p.name
HAVING FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) <= 10
ORDER BY stock_producible ASC;
 id | name | stock_producible | ingrediente_critico | stock_ingrediente_critico
----+------+------------------+---------------------+---------------------------
(0 rows)
```

**Resultado:** `stock_quantity` volvió a 40, `updated_at` no cambió y la consulta filtrada vuelve a devolver 0 filas, igual que la línea base.

#### Comparación con la sección 5.5 de la bitácora de junio

| | Junio (sección 5.5) | Hoy |
|---|---|---|
| Salida sin modificar | Ningún resultado. El mínimo es BBQ Bacon con 20, por encima del umbral de 10. | 0 filas. En la primera ronda, la consulta sin `HAVING` dio BBQ Bacon = 20 como mínimo. |
| Salida con Bacon = 5 | Una fila: Hamburguesa BBQ Bacon, stock producible 2, crítico Bacon, stock del crítico 5 | Una fila: id 2, Hamburguesa BBQ Bacon, stock producible 2, crítico Bacon, stock del crítico 5 |
| Reversión | "Bacon revertido posteriormente a 40" | `ROLLBACK`. Bacon quedó en 40 y se verificó en una sesión nueva. |

Coinciden fila por fila. Con esto queda cubierto lo que la primera ronda no pudo verificar: que BBQ Bacon aparezca en la salida filtrada de WF-01c.

---

### WF-03

#### Las tres consultas tal cual (rango dinámico, solo lectura)

Las tres consultas corrieron sin error. Las tablas `pedido`, `estado_pedido` y `detalle_pedido` existen en el esquema actual con las columnas que usan las consultas. El rango dinámico toma el día anterior a la ejecución (2026-09-24 UTC), que no tiene pedidos.

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:03:14.368243+00
(1 row)

SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND p.created_at <  CURRENT_DATE;
 cantidad_pedidos | facturacion_total | ticket_promedio
------------------+-------------------+-----------------
                0 |                 0 |               0
(1 row)

SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:03:14.789811+00
(1 row)

SELECT
    dp.producto_nombre,
    SUM(dp.cantidad) AS unidades_vendidas,
    SUM(dp.subtotal) AS total_generado
FROM detalle_pedido dp
JOIN pedido p ON p.id = dp.pedido_id
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE dp.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND p.created_at <  CURRENT_DATE
GROUP BY dp.producto_nombre
ORDER BY unidades_vendidas DESC
LIMIT 5;
 producto_nombre | unidades_vendidas | total_generado
-----------------+-------------------+----------------
(0 rows)

SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:03:15.237456+00
(1 row)

SELECT
    ep.descripcion AS estado,
    COUNT(*) AS cantidad
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND p.created_at <  CURRENT_DATE
GROUP BY ep.descripcion
ORDER BY cantidad DESC;
 estado | cantidad
--------+----------
(0 rows)
```

#### Búsqueda de un día con pedidos que incluya un cancelado (solo lectura)

```
SELECT p.created_at::date AS dia, COUNT(*) AS pedidos,
       COUNT(*) FILTER (WHERE ep.codigo = 'CANCELADO') AS cancelados
FROM pedido p JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
GROUP BY 1 ORDER BY 1;
    dia     | pedidos | cancelados
------------+---------+------------
 2026-08-18 |       2 |          1
 2026-08-19 |       2 |          0
 2026-08-20 |       3 |          0
 2026-08-21 |       2 |          0
 2026-08-22 |       5 |          1
 2026-08-23 |       3 |          1
 2026-08-24 |       3 |          0
 2026-08-25 |       4 |          0
 2026-08-26 |       3 |          0
 2026-08-27 |       2 |          0
 2026-08-28 |       3 |          1
 2026-08-29 |       6 |          1
 2026-08-30 |       4 |          0
 2026-08-31 |       4 |          0
 2026-09-01 |       4 |          0
 2026-09-02 |       4 |          0
 2026-09-03 |       3 |          0
 2026-09-04 |       2 |          0
 2026-09-05 |       4 |          0
 2026-09-06 |       5 |          0
 2026-09-07 |       2 |          0
 2026-09-08 |       4 |          0
 2026-09-09 |       2 |          0
 2026-09-10 |       2 |          0
 2026-09-11 |       3 |          0
 2026-09-12 |       5 |          0
 2026-09-13 |       5 |          2
 2026-09-14 |       3 |          1
 2026-09-15 |       3 |          0
 2026-09-16 |       2 |          0
(30 rows)

SELECT p.id, p.created_at, ep.codigo, p.total, p.deleted_at FROM pedido p JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.created_at >= '2026-09-14' AND p.created_at < '2026-09-15' ORDER BY p.id;
 id |         created_at         |  codigo   |  total   | deleted_at
----+----------------------------+-----------+----------+------------
 92 | 2026-09-14 13:07:31.934432 | ENTREGADO |  7200.00 |
 93 | 2026-09-14 13:07:31.934432 | CANCELADO | 15600.00 |
 94 | 2026-09-14 13:07:31.934432 | ENTREGADO |  3400.00 |
(3 rows)

SELECT dp.pedido_id, dp.producto_nombre, dp.cantidad, dp.subtotal, dp.deleted_at FROM detalle_pedido dp
WHERE dp.pedido_id IN (SELECT id FROM pedido WHERE created_at >= '2026-09-14' AND created_at < '2026-09-15') ORDER BY dp.pedido_id, dp.id;
 pedido_id |    producto_nombre    | cantidad | subtotal | deleted_at
-----------+-----------------------+----------+----------+------------
        92 | Hamburguesa Clásica   |        1 |  1500.00 |
        92 | Agua Mineral 500ml    |        3 |  1200.00 |
        92 | Hamburguesa BBQ Bacon |        2 |  4000.00 |
        93 | Hamburguesa Doble     |        3 |  6600.00 |
        93 | Hamburguesa BBQ Bacon |        2 |  4000.00 |
        93 | Hamburguesa Clásica   |        3 |  4500.00 |
        94 | Papas Fritas          |        1 |   800.00 |
        94 | Brownie de Chocolate  |        3 |  2100.00 |
(8 rows)
```

Hay 7 días con al menos un cancelado. Se tomó el más reciente, **2026-09-14**: 3 pedidos, uno de ellos cancelado.

#### Las tres consultas con rango fijo (2026-09-14)

Las bitácoras de junio indican (sección 4.3) que durante el desarrollo se usó un rango fijo en lugar del dinámico. Las únicas líneas cambiadas son las dos cotas de fecha de cada consulta. El resto es idéntico. Diff de la consulta 4.1 (las consultas 4.2 y 4.3 tienen el mismo reemplazo):

```
<   AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
<   AND p.created_at <  CURRENT_DATE;
---
>   AND p.created_at >= '2026-09-14'
>   AND p.created_at <  '2026-09-15';
```

```
SELECT clock_timestamp();
        clock_timestamp
-------------------------------
 2026-09-25 02:03:31.554151+00
(1 row)

SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= '2026-09-14'
  AND p.created_at <  '2026-09-15';
 cantidad_pedidos | facturacion_total | ticket_promedio
------------------+-------------------+-----------------
                2 |          10600.00 |         5300.00
(1 row)

SELECT
    dp.producto_nombre,
    SUM(dp.cantidad) AS unidades_vendidas,
    SUM(dp.subtotal) AS total_generado
FROM detalle_pedido dp
JOIN pedido p ON p.id = dp.pedido_id
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE dp.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= '2026-09-14'
  AND p.created_at <  '2026-09-15'
GROUP BY dp.producto_nombre
ORDER BY unidades_vendidas DESC
LIMIT 5;
    producto_nombre    | unidades_vendidas | total_generado
-----------------------+-------------------+----------------
 Agua Mineral 500ml    |                 3 |        1200.00
 Brownie de Chocolate  |                 3 |        2100.00
 Hamburguesa BBQ Bacon |                 2 |        4000.00
 Hamburguesa Clásica   |                 1 |        1500.00
 Papas Fritas          |                 1 |         800.00
(5 rows)

SELECT
    ep.descripcion AS estado,
    COUNT(*) AS cantidad
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND p.created_at >= '2026-09-14'
  AND p.created_at <  '2026-09-15'
GROUP BY ep.descripcion
ORDER BY cantidad DESC;
         estado         | cantidad
------------------------+----------
 Entregado exitosamente |        2
 Pedido cancelado       |        1
(2 rows)
```

**Resultado:** la asimetría de la decisión 2.4 se cumple sobre la base actual.

- Ventas (4.1) cuenta 2 pedidos y 10600.00, que es la suma de los pedidos 92 (7200.00) y 94 (3400.00). Excluye el pedido cancelado 93 (15600.00).
- El ranking (4.2) no incluye Hamburguesa Doble, que solo figura en el pedido cancelado 93. BBQ Bacon y Clásica suman únicamente sus unidades del pedido 92: 2 y 1, no 4 y 4.
- El desglose por estado (4.3) cuenta los 3 pedidos (2 entregados y 1 cancelado). La diferencia con ventas es exactamente el pedido cancelado.

**Observación:** el ranking (4.2) ordena solo por `unidades_vendidas`, así que no fija el orden entre empates (Agua Mineral y Brownie con 3; Clásica y Papas con 1). El orden de esas filas puede variar entre ejecuciones sin que cambien los datos.

No se comparan los montos con los del 21/06 de la sección 7 de junio porque son otros datos: la base se re-sembró el 17/09/2026. Se compara el comportamiento (la asimetría), no los valores.

---

### Estado final

La base terminó igual que antes de esta ronda. Agua Mineral (id 8) y Bacon (id 7) conservan `stock_quantity` y `updated_at` originales, y las dos consultas de WF-01 vuelven a su línea base de 0 filas. Las pendientes de la primera ronda (WF-01a, WF-03 y la salvedad del `HAVING` de WF-01c) quedan cerradas.
