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
