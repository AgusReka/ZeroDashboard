# Bitácora — CH-16d: segunda automatización (stock físico) y composición con `WITH`

**Fecha de la corrida:** 2026-09-25, entre 13:03 y 13:07 (hora local UTC-3).
**Instancias:**
- Food Store: contenedor `foodstore-backend-fastapi-db-1` (imagen `postgres:16-alpine`, PostgreSQL 16.15), base `food_store`, usuario `postgres`, esquema `public`.
- Medusa: contenedor `ch16-medusa-pg` (imagen `postgres:16-alpine`, PostgreSQL 16.15), base `medusa_db`, usuario `medusa`, esquema `public`.

**Alcance:**
- Todas las consultas corrieron en transacciones `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` que terminaron en `ROLLBACK`. La única excepción es la tarea 3.
- La tarea 3 fue una única transacción de lectura y escritura en Food Store, terminada en `ROLLBACK` y confirmada por el autor antes de ejecutarse. El resultado se verificó en una sesión nueva.
- No se crearon ni se modificaron vistas. No se modificó ningún archivo SQL existente. No se tocó Saleor.

**Archivos del change:** `openspec/changes/CH-16d-segunda-automatizacion-y-with/`
- `sql/11_consulta_canonica_stock_fisico.sql`: canónica de WF-01a, con umbral `<= 20`.
- `sql/12_consulta_canonica_stock_fisico_sin_umbral.sql`: la misma, sin la línea del umbral.
- `sql/13_stock_producible_con_with_foodstore.sql` y `sql/13_stock_producible_con_with_medusa.sql`: DEC-31 aplicado a `04_consulta_canonica.sql`.
- `salidas/`: entrada exacta (`*_input.sql`) y salida cruda completa (`*_output.txt`) de cada corrida. Las mismas salidas se transcriben en el Anexo.

---

## Resultados

| Tarea | Base | Comparación | Solo original / solo WITH | Solo canónica / solo vistas | Intersección | Valores distintos en la intersección |
|---|---|---|---|---|---|---|
| 2 | Food Store | Original 4.2 sin umbral contra `12_` | 0 | 0 | 3 (ids 7, 8, 9) | 0 (nombre y stock) |
| 3 | Food Store | Original 4.2 con umbral contra `11_`, con el id 8 forzado a stock 8 dentro de la transacción | 0 | 0 | 1 (id 8, stock 8) | 0 |
| 3 | Food Store | Verificación en sesión nueva después del `ROLLBACK` | — | — | id 8: `stock_quantity = 200` | — |
| 4 | Medusa | `11_` (con umbral) | 0 filas | — | — | — |
| 4 | Medusa | `12_` (sin umbral) | 0 filas | — | — | — |
| 4 | Medusa | Variantes en `v_producto` / con al menos una fila en `v_receta_componente` | 20 / 20 | — | — | — |
| 5 | Food Store | `13_..._foodstore` (WITH) contra `04_` (vistas) | 0 | 0 | 6 | 0 en `stock_producible` (y 0 en las demás columnas) |
| 5 | Medusa | `13_..._medusa` (WITH) contra `04_` (vistas) | 0 | 0 | 20 | 0 en `stock_producible` (y 0 en las demás columnas) |
| 5 | Ambas | EXPLAIN (VERBOSE) de la versión con WITH contra la versión con vistas | Planes idénticos, línea por línea | | | |
| 5 | Ambas | Prueba de ocultamiento: `WITH v_producto` constante | Plan `Result` sin lectura de tablas; devuelve la fila `SOMBRA` | | | |

---

## Incidentes

- **I-1 — Docker detenido.** Al empezar, el daemon de Docker no respondía (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`). Se arrancó Docker Desktop y después `docker start ch16-medusa-pg`. Al arrancar Docker se levantaron solos, por su política de reinicio, los contenedores `saleor-platform-*` (worker, dashboard, mailpit, jaeger, cache). No se los usó, no se los consultó y no se los detuvo.
- **I-2 — Primer intento de la tarea 3 cortado por la guarda.**
  - **Qué pasó.** La guarda `CASE WHEN stock_quantity = 8 THEN 'ok' ELSE (1/0)::text END` falló con `ERROR: division by zero` aunque el `UPDATE` había devuelto `UPDATE 1`.
  - **Causa.** `1/0` es una expresión constante y PostgreSQL la evalúa al planificar, sin importar qué rama del `CASE` se tome.
  - **Estado de la base.** Con `ON_ERROR_STOP=1`, `psql` salió sin `COMMIT` y la transacción se descartó. La verificación en una sesión nueva (pid 404) mostró el id 8 en `stock_quantity = 200`.
  - **Corrección.** La guarda pasó a `(1 / (stock_quantity * 0))::text`, que no es constante. El autor confirmó la corrección antes de volver a ejecutar.
  - **Registros.** El intento está en `salidas/t3_intento1_*` y en el Anexo (A.3.1). La corrida definitiva es la A.3.2.

---

## 1. Tarea 1 — Consulta canónica de stock físico

La consulta de la sección 4.2 de `docs/bitacora/estudio_previo/bitacora_WF-01.md` se reescribió contra el contrato, usando solo `v_producto` y `v_receta_componente`:

```sql
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
```

Correspondencia con la original:

| Original (4.2) | Canónica |
|---|---|
| `p.deleted_at IS NULL` | Lo aplica `v_producto` (`WHERE p.deleted_at IS NULL` en `03_vistas_foodstore.sql`) |
| `p.available = true` | `pr.activo = true` |
| `p.stock_quantity <= 20` | `pr."stockDisponible" <= 20` |
| `NOT EXISTS (… product_ingredient …)` | `NOT EXISTS (… v_receta_componente …)` |

Una diferencia que ya viene de la vista: `v_receta_componente` en Food Store hace `JOIN` con `product` e `ingredient` no borrados. La original, en cambio, mira `product_ingredient` completa. Con los datos actuales esa diferencia no cambia el resultado (ver tareas 2 y 3).

`12_…_sin_umbral.sql` es idéntica a `11_` salvo la línea `AND pr."stockDisponible" <= 20` y el comentario de cabecera.

---

## 2. Tarea 2 — Food Store: equivalencia sin umbral

**Entrada:** `salidas/t2_input.sql`.
- Se usó la original de 4.2 con la línea `AND p.stock_quantity <= 20` quitada, y el texto de `12_` sin cambios.
- Todo corrió dentro de una misma transacción `REPEATABLE READ READ ONLY`, así que ambas consultas leen la misma instantánea.
- La diferencia simétrica se calculó con un `FULL JOIN` por `o.id::text = c.id`: la original devuelve `integer` y `v_producto.id` es `text`. Para eso se envolvieron los dos textos como subconsultas, quitando solo el `;` final.

**Resultado:**

| id | Conjunto | Nombre | Stock original | Stock canónica |
|---|---|---|---|---|
| 7 | intersección | Coca Cola 500ml | 150 | 150 |
| 8 | intersección | Agua Mineral 500ml | 200 | 200 |
| 9 | intersección | Brownie de Chocolate | 40 | 40 |

Solo en la original: 0. Solo en la canónica: 0. Intersección: 3. Con valores distintos: 0.

---

## 3. Tarea 3 — Food Store: comportamiento con umbral (transacción revertida)

**Entrada:** `salidas/t3_input.sql`, confirmada por el autor antes de cada ejecución (ver I-2). La secuencia:
1. `BEGIN` (lectura y escritura).
2. Lectura del id 8 (`stock_quantity = 200`).
3. `UPDATE product SET stock_quantity = 8 WHERE id = 8 AND stock_quantity = 200;` devolvió `UPDATE 1`.
4. Guarda: `ok`, con stock 8.
5. Original de 4.2 con umbral, texto literal.
6. `11_` sin modificar.
7. Diferencia simétrica por id.
8. `ROLLBACK`.

**Resultado dentro de la transacción:**

| Consulta | Filas |
|---|---|
| Original 4.2 (con umbral) | 1: id 8, Agua Mineral 500ml, 8, `available = t` |
| `11_` canónica (con umbral) | 1: id 8, Agua Mineral 500ml, 8 |
| Diferencia simétrica | Solo original: 0. Solo canónica: 0. Intersección: 1 (id 8, stock 8 en ambas) |

**Verificación en sesión nueva** (`salidas/t3_verificacion_input.sql`, `READ ONLY`, pid 503, 16:06:58 UTC): id 8, Agua Mineral 500ml, `stock_quantity = 200`.

---

## 4. Tarea 4 — Medusa: `11_` y `12_` sin modificar

**Entrada:** `salidas/t4_input.sql`. Los textos de `11_` y `12_` se pasaron sin cambios y el `search_path` fue `"$user", public`.

| Consulta | Filas devueltas |
|---|---|
| `11_consulta_canonica_stock_fisico.sql` | 0 |
| `12_consulta_canonica_stock_fisico_sin_umbral.sql` | 0 |

| Conteo | Valor |
|---|---|
| Variantes en `v_producto` | 20 |
| Variantes con al menos una fila en `v_receta_componente` | 20 |
| Variantes sin filas en `v_receta_componente` | 0 |
| `productoId` distintos en `v_receta_componente` | 20 |
| Filas en `v_receta_componente` | 20 |

---

## 5. Tarea 5 — Composición con `WITH` (DEC-31)

### 5.1 Armado de `13_`

Como la cláusula `WITH` depende de la base, se armó un archivo por base en lugar de uno solo:
- `13_stock_producible_con_with_foodstore.sql` toma las definiciones de `03_vistas_foodstore.sql`.
- `13_stock_producible_con_with_medusa.sql` toma las de `06_vistas_medusa.sql`.

Cada archivo es un comentario de cabecera, `WITH`, tres CTE (`v_producto`, `v_insumo`, `v_receta_componente`) y el texto completo de `04_consulta_canonica.sql`.

- **Cómo se generaron.** Por script (`awk`), copiando el cuerpo de cada `CREATE OR REPLACE VIEW … AS` hasta su `;` y quitando solo el `CREATE OR REPLACE VIEW`, el `;` final y, en Medusa, el `SET search_path TO medusa;`. En Food Store tampoco se copió el comentario de cabecera de `03_`.
- **Verificación.** `tail -c <tamaño de 04> | cmp` dio igualdad byte a byte con `04_consulta_canonica.sql` para los dos archivos.

### 5.2 Definiciones de las vistas creadas en la base

`pg_get_viewdef` de las tres vistas en `public` coincide, en las dos bases, con el texto de `03_` y `06_`. Las únicas diferencias son las de normalización de PostgreSQL: casts explícitos (`0::numeric`, `::text`), paréntesis, y calificadores y alias implícitos. Salida completa en A.5.1 y A.5.2, bloque `(0)`.

### 5.3 Diferencia simétrica

Las dos versiones corrieron en la misma transacción `REPEATABLE READ READ ONLY`. La diferencia simétrica se calculó por `(id, stock_producible)` con `FULL JOIN` sobre `(13_ sin ;) w` y `(04_ sin ;) v`. Además se comparó si `nombre`, `insumo_limitante` y `stock_insumo_limitante` coinciden (columna `resto_de_columnas_igual`).

| Base | Filas WITH | Filas vistas | Solo WITH | Solo vistas | Intersección igual | Intersección con `stock_producible` distinto | Resto de columnas distinto |
|---|---|---|---|---|---|---|---|
| Food Store | 6 | 6 | 0 | 0 | 6 | 0 | 0 |
| Medusa | 20 | 20 | 0 | 0 | 20 | 0 | 0 |

- **Food Store:** ids 1–6, con `stock_producible` 50, 20, 40, 15, 250 y 70.
- **Medusa:** 20 variantes, todas con `stock_producible = 1000000`.

### 5.4 EXPLAIN: ¿la versión con WITH lee las vistas creadas?

- **Qué se hizo.** Se corrió `EXPLAIN (VERBOSE, COSTS OFF)` sobre las dos versiones. En cada base, los dos planes son idénticos línea por línea (46 líneas en Food Store, 68 en Medusa), comprobado con `diff`.
- **Límite de la evidencia.** Que los planes sean idénticos no confirma por sí solo el ocultamiento. PostgreSQL reescribe cada vista como una subconsulta con su definición antes de planificar, así que ningún nodo del plan nombra una vista. Como la definición de la vista creada y la del `WITH` coinciden (5.2), los dos caminos dan el mismo plan.
- **Prueba adicional.** Para distinguirlos se agregó una prueba de ocultamiento en la misma transacción de solo lectura: un `WITH v_producto` con una sola fila constante (`'SOMBRA'`), seguido de `SELECT * FROM v_producto`.
  - En las dos bases el plan es un único nodo `Result` con `Output: 'SOMBRA'::text, 'SOMBRA'::text, 0, NULL::text, true`, sin lectura de ninguna tabla.
  - La consulta devuelve una sola fila, `SOMBRA`, y no las filas de la vista `public.v_producto`.
- **Conclusión.** Dentro de una consulta con `WITH`, el nombre `v_producto` se resuelve a la CTE y no a la vista creada. Por esa regla, la versión `13_` no lee las vistas creadas.

---

## Anexo — comandos y salidas crudas completas

Comandos (Git Bash, desde `openspec/changes/CH-16d-segunda-automatizacion-y-with/`). Cada salida empieza con la hora local de `date -Iseconds` y termina con el código de salida de `psql`:

```bash
# Food Store (tareas 2, 3 y 5)
docker exec -i foodstore-backend-fastapi-db-1 psql -U postgres -d food_store -v ON_ERROR_STOP=1 -e < salidas/<tarea>_input.sql
# Medusa (tareas 4 y 5)
docker exec -i ch16-medusa-pg psql -U medusa -d medusa_db -v ON_ERROR_STOP=1 -e < salidas/<tarea>_input.sql
```

Con `-e`, `psql` repite cada sentencia antes de su resultado, así que cada salida cruda contiene también la entrada completa.

### A.2 — Tarea 2 (Food Store)

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t2_output.txt`

```text
2026-09-25T13:03:28-03:00
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
BEGIN
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura;
           instante            |   aislamiento   | solo_lectura 
-------------------------------+-----------------+--------------
 2026-09-25 16:03:29.093437+00 | repeatable read | on
(1 row)

SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
 id |         name         | stock_quantity | available 
----+----------------------+----------------+-----------
  9 | Brownie de Chocolate |             40 | t
  7 | Coca Cola 500ml      |            150 | t
  8 | Agua Mineral 500ml   |            200 | t
(3 rows)

SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
 id |        nombre        | stockDisponible 
----+----------------------+-----------------
 9  | Brownie de Chocolate |              40
 7  | Coca Cola 500ml      |             150
 8  | Agua Mineral 500ml   |             200
(3 rows)

WITH o AS (
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC
), c AS (
-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC
)
SELECT COALESCE(o.id::text, c.id) AS id,
       CASE WHEN c.id IS NULL THEN 'solo_original'
            WHEN o.id IS NULL THEN 'solo_canonica'
            ELSE 'interseccion' END AS conjunto,
       o.name AS nombre_original, c.nombre AS nombre_canonica,
       o.stock_quantity AS stock_original, c."stockDisponible" AS stock_canonica
FROM o FULL JOIN c ON o.id::text = c.id
ORDER BY 2, 1;
 id |   conjunto   |   nombre_original    |   nombre_canonica    | stock_original | stock_canonica 
----+--------------+----------------------+----------------------+----------------+----------------
 7  | interseccion | Coca Cola 500ml      | Coca Cola 500ml      |            150 |            150
 8  | interseccion | Agua Mineral 500ml   | Agua Mineral 500ml   |            200 |            200
 9  | interseccion | Brownie de Chocolate | Brownie de Chocolate |             40 |             40
(3 rows)

WITH o AS (
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC
), c AS (
-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC
)
SELECT count(*) FILTER (WHERE c.id IS NULL) AS solo_original,
       count(*) FILTER (WHERE o.id IS NULL) AS solo_canonica,
       count(*) FILTER (WHERE o.id IS NOT NULL AND c.id IS NOT NULL) AS interseccion,
       count(*) FILTER (WHERE o.id IS NOT NULL AND c.id IS NOT NULL
                          AND (o.name IS DISTINCT FROM c.nombre OR o.stock_quantity IS DISTINCT FROM c."stockDisponible")) AS interseccion_con_valores_distintos
FROM o FULL JOIN c ON o.id::text = c.id;
 solo_original | solo_canonica | interseccion | interseccion_con_valores_distintos 
---------------+---------------+--------------+------------------------------------
             0 |             0 |            3 |                                  0
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```

### A.3.1 — Tarea 3, intento 1 (cortado por la guarda, I-2)

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t3_intento1_output.txt`

```text
2026-09-25T13:05:59-03:00
BEGIN;
BEGIN
SELECT now() AS instante, current_setting('transaction_read_only') AS solo_lectura;
           instante            | solo_lectura 
-------------------------------+--------------
 2026-09-25 16:05:59.633637+00 | off
(1 row)

SELECT id, name, stock_quantity FROM product WHERE id = 8;
 id |        name        | stock_quantity 
----+--------------------+----------------
  8 | Agua Mineral 500ml |            200
(1 row)

UPDATE product SET stock_quantity = 8 WHERE id = 8 AND stock_quantity = 200;
UPDATE 1
SELECT id, name, stock_quantity, CASE WHEN stock_quantity = 8 THEN 'ok' ELSE (1/0)::text END AS guarda FROM product WHERE id = 8;
ERROR:  division by zero
exit=3
```

### A.3.1 bis — Tarea 3, intento 1: verificación en sesión nueva

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t3_intento1_verificacion_output.txt`

```text
2026-09-25T13:05:59-03:00
BEGIN TRANSACTION READ ONLY;
BEGIN
SELECT now() AS instante, pg_backend_pid() AS pid_sesion_nueva;
           instante            | pid_sesion_nueva 
-------------------------------+------------------
 2026-09-25 16:06:00.239308+00 |              404
(1 row)

SELECT id, name, stock_quantity FROM product WHERE id = 8;
 id |        name        | stock_quantity 
----+--------------------+----------------
  8 | Agua Mineral 500ml |            200
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```

### A.3.2 — Tarea 3, corrida definitiva (Food Store)

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t3_output.txt`

```text
2026-09-25T13:06:57-03:00
BEGIN;
BEGIN
SELECT now() AS instante, current_setting('transaction_read_only') AS solo_lectura;
           instante            | solo_lectura 
-------------------------------+--------------
 2026-09-25 16:06:58.010257+00 | off
(1 row)

SELECT id, name, stock_quantity FROM product WHERE id = 8;
 id |        name        | stock_quantity 
----+--------------------+----------------
  8 | Agua Mineral 500ml |            200
(1 row)

UPDATE product SET stock_quantity = 8 WHERE id = 8 AND stock_quantity = 200;
UPDATE 1
SELECT id, name, stock_quantity, CASE WHEN stock_quantity = 8 THEN 'ok' ELSE (1 / (stock_quantity * 0))::text END AS guarda FROM product WHERE id = 8;
 id |        name        | stock_quantity | guarda 
----+--------------------+----------------+--------
  8 | Agua Mineral 500ml |              8 | ok
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

SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
 id |       nombre       | stockDisponible 
----+--------------------+-----------------
 8  | Agua Mineral 500ml |               8
(1 row)

WITH o AS (
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
ORDER BY stock_quantity ASC
), c AS (
-- ============================================================
-- CONSULTA CANÓNICA: stock físico (WF-01a), productos sin receta.
-- Versión canónica de la consulta de la sección 4.2 de
-- docs/bitacora/estudio_previo/bitacora_WF-01.md.
-- Solo usa v_producto y v_receta_componente. Umbral: <= 20.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC
)
SELECT COALESCE(o.id::text, c.id) AS id,
       CASE WHEN c.id IS NULL THEN 'solo_original'
            WHEN o.id IS NULL THEN 'solo_canonica'
            ELSE 'interseccion' END AS conjunto,
       o.name AS nombre_original, c.nombre AS nombre_canonica,
       o.stock_quantity AS stock_original, c."stockDisponible" AS stock_canonica
FROM o FULL JOIN c ON o.id::text = c.id
ORDER BY 2, 1;
 id |   conjunto   |  nombre_original   |  nombre_canonica   | stock_original | stock_canonica 
----+--------------+--------------------+--------------------+----------------+----------------
 8  | interseccion | Agua Mineral 500ml | Agua Mineral 500ml |              8 |              8
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```

### A.3.2 bis — Tarea 3: verificación en sesión nueva

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t3_verificacion_output.txt`

```text
2026-09-25T13:06:58-03:00
BEGIN TRANSACTION READ ONLY;
BEGIN
SELECT now() AS instante, pg_backend_pid() AS pid_sesion_nueva;
           instante            | pid_sesion_nueva 
-------------------------------+------------------
 2026-09-25 16:06:58.314726+00 |              503
(1 row)

SELECT id, name, stock_quantity FROM product WHERE id = 8;
 id |        name        | stock_quantity 
----+--------------------+----------------
  8 | Agua Mineral 500ml |            200
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```

### A.4 — Tarea 4 (Medusa)

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t4_output.txt`

```text
2026-09-25T13:03:40-03:00
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
BEGIN
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura, current_setting('search_path') AS search_path;
           instante            |   aislamiento   | solo_lectura |   search_path   
-------------------------------+-----------------+--------------+-----------------
 2026-09-25 16:03:40.780964+00 | repeatable read | on           | "$user", public
(1 row)

SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
 id | nombre | stockDisponible 
----+--------+-----------------
(0 rows)

SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
 id | nombre | stockDisponible 
----+--------+-----------------
(0 rows)

SELECT (SELECT count(*) FROM v_producto) AS variantes_en_v_producto,
       (SELECT count(*) FROM v_producto pr WHERE EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)) AS variantes_con_al_menos_una_fila_en_v_receta_componente,
       (SELECT count(*) FROM v_producto pr WHERE NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)) AS variantes_sin_filas_en_v_receta_componente,
       (SELECT count(DISTINCT rc."productoId") FROM v_receta_componente rc) AS productoid_distintos_en_v_receta_componente,
       (SELECT count(*) FROM v_receta_componente) AS filas_v_receta_componente;
 variantes_en_v_producto | variantes_con_al_menos_una_fila_en_v_receta_componente | variantes_sin_filas_en_v_receta_componente | productoid_distintos_en_v_receta_componente | filas_v_receta_componente 
-------------------------+--------------------------------------------------------+--------------------------------------------+---------------------------------------------+---------------------------
                      20 |                                                     20 |                                          0 |                                          20 |                        20
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```

### A.5.1 — Tarea 5 (Food Store)

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t5_foodstore_output.txt`

```text
2026-09-25T13:04:20-03:00
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
BEGIN
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura, current_setting('search_path') AS search_path;
           instante            |   aislamiento   | solo_lectura |   search_path   
-------------------------------+-----------------+--------------+-----------------
 2026-09-25 16:04:21.319689+00 | repeatable read | on           | "$user", public
(1 row)

SELECT c.relname, pg_get_viewdef(c.oid, true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' AND c.relname IN ('v_producto','v_insumo','v_receta_componente') ORDER BY 1;
       relname       |                               pg_get_viewdef                                
---------------------+-----------------------------------------------------------------------------
 v_insumo            |  SELECT id::text AS id,                                                    +
                     |     name AS nombre,                                                        +
                     |     stock_quantity AS "stockDisponible",                                   +
                     |     NULL::text AS "unidadMedida",                                          +
                     |     NULL::text AS codigo                                                   +
                     |    FROM ingredient i                                                       +
                     |   WHERE deleted_at IS NULL;
 v_producto          |  SELECT id::text AS id,                                                    +
                     |     name AS nombre,                                                        +
                     |     stock_quantity AS "stockDisponible",                                   +
                     |     NULL::text AS sku,                                                     +
                     |     available AS activo                                                    +
                     |    FROM product p                                                          +
                     |   WHERE deleted_at IS NULL;
 v_receta_componente |  SELECT pi.product_id::text AS "productoId",                               +
                     |     pi.ingredient_id::text AS "insumoId",                                  +
                     |     pi.quantity AS "cantidadPorUnidad"                                     +
                     |    FROM product_ingredient pi                                              +
                     |      JOIN product p ON p.id = pi.product_id AND p.deleted_at IS NULL       +
                     |      JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL;
(3 rows)

WITH
v_producto AS (
SELECT
  p.id::text                AS id,
  p.name                    AS nombre,
  p.stock_quantity          AS "stockDisponible",  -- declarado, crudo
  NULL::text                AS sku,                -- SIN ORIGEN en Food Store
  p.available                AS activo
FROM product p
WHERE p.deleted_at IS NULL
),
v_insumo AS (
SELECT
  i.id::text                AS id,
  i.name                    AS nombre,
  i.stock_quantity          AS "stockDisponible",
  NULL::text                AS "unidadMedida",     -- SIN ORIGEN en Food Store
  NULL::text                AS codigo              -- SIN ORIGEN en Food Store
FROM ingredient i
WHERE i.deleted_at IS NULL
),
v_receta_componente AS (
SELECT
  pi.product_id::text       AS "productoId",
  pi.ingredient_id::text    AS "insumoId",
  pi.quantity               AS "cantidadPorUnidad"
FROM product_ingredient pi
JOIN product p    ON p.id = pi.product_id  AND p.deleted_at IS NULL
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL
)
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
 id |        nombre         | stock_producible | insumo_limitante | stock_insumo_limitante 
----+-----------------------+------------------+------------------+------------------------
 4  | Hamburguesa Picante   |               15 | Jalapeños        |                     30
 2  | Hamburguesa BBQ Bacon |               20 | Bacon            |                     40
 3  | Hamburguesa Doble     |               40 | Carne vacuna     |                     80
 1  | Hamburguesa Clásica   |               50 | Tomate           |                     50
 6  | Aros de Cebolla       |               70 | Cebolla          |                     70
 5  | Papas Fritas          |              250 | Papas            |                    250
(6 rows)

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
 id |        nombre         | stock_producible | insumo_limitante | stock_insumo_limitante 
----+-----------------------+------------------+------------------+------------------------
 4  | Hamburguesa Picante   |               15 | Jalapeños        |                     30
 2  | Hamburguesa BBQ Bacon |               20 | Bacon            |                     40
 3  | Hamburguesa Doble     |               40 | Carne vacuna     |                     80
 1  | Hamburguesa Clásica   |               50 | Tomate           |                     50
 6  | Aros de Cebolla       |               70 | Cebolla          |                     70
 5  | Papas Fritas          |              250 | Papas            |                    250
(6 rows)

SELECT COALESCE(w.id, v.id) AS id, w.stock_producible AS sp_with, v.stock_producible AS sp_vistas,
       CASE WHEN v.id IS NULL THEN 'solo_with' WHEN w.id IS NULL THEN 'solo_vistas'
            WHEN w.stock_producible IS DISTINCT FROM v.stock_producible THEN 'interseccion_valor_distinto' ELSE 'interseccion_igual' END AS conjunto,
       (w.insumo_limitante IS NOT DISTINCT FROM v.insumo_limitante AND w.stock_insumo_limitante IS NOT DISTINCT FROM v.stock_insumo_limitante AND w.nombre IS NOT DISTINCT FROM v.nombre) AS resto_de_columnas_igual
FROM (
-- ============================================================
-- DEC-31: composición con WITH. Las definiciones de v_producto,
-- v_insumo y v_receta_componente se copian de 03_vistas_foodstore.sql
-- (sin CREATE VIEW ni SET search_path) y se anteponen, sin
-- tocar su texto, a 04_consulta_canonica.sql.
-- ============================================================
WITH
v_producto AS (
SELECT
  p.id::text                AS id,
  p.name                    AS nombre,
  p.stock_quantity          AS "stockDisponible",  -- declarado, crudo
  NULL::text                AS sku,                -- SIN ORIGEN en Food Store
  p.available                AS activo
FROM product p
WHERE p.deleted_at IS NULL
),
v_insumo AS (
SELECT
  i.id::text                AS id,
  i.name                    AS nombre,
  i.stock_quantity          AS "stockDisponible",
  NULL::text                AS "unidadMedida",     -- SIN ORIGEN en Food Store
  NULL::text                AS codigo              -- SIN ORIGEN en Food Store
FROM ingredient i
WHERE i.deleted_at IS NULL
),
v_receta_componente AS (
SELECT
  pi.product_id::text       AS "productoId",
  pi.ingredient_id::text    AS "insumoId",
  pi.quantity               AS "cantidadPorUnidad"
FROM product_ingredient pi
JOIN product p    ON p.id = pi.product_id  AND p.deleted_at IS NULL
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL
)
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
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC
) w FULL JOIN (
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
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC
) v ON w.id = v.id
ORDER BY 4, 1;
 id | sp_with | sp_vistas |      conjunto      | resto_de_columnas_igual 
----+---------+-----------+--------------------+-------------------------
 1  |      50 |        50 | interseccion_igual | t
 2  |      20 |        20 | interseccion_igual | t
 3  |      40 |        40 | interseccion_igual | t
 4  |      15 |        15 | interseccion_igual | t
 5  |     250 |       250 | interseccion_igual | t
 6  |      70 |        70 | interseccion_igual | t
(6 rows)

EXPLAIN (VERBOSE, COSTS OFF)
-- ============================================================
-- DEC-31: composición con WITH. Las definiciones de v_producto,
-- v_insumo y v_receta_componente se copian de 03_vistas_foodstore.sql
-- (sin CREATE VIEW ni SET search_path) y se anteponen, sin
-- tocar su texto, a 04_consulta_canonica.sql.
-- ============================================================
WITH
v_producto AS (
SELECT
  p.id::text                AS id,
  p.name                    AS nombre,
  p.stock_quantity          AS "stockDisponible",  -- declarado, crudo
  NULL::text                AS sku,                -- SIN ORIGEN en Food Store
  p.available                AS activo
FROM product p
WHERE p.deleted_at IS NULL
),
v_insumo AS (
SELECT
  i.id::text                AS id,
  i.name                    AS nombre,
  i.stock_quantity          AS "stockDisponible",
  NULL::text                AS "unidadMedida",     -- SIN ORIGEN en Food Store
  NULL::text                AS codigo              -- SIN ORIGEN en Food Store
FROM ingredient i
WHERE i.deleted_at IS NULL
),
v_receta_componente AS (
SELECT
  pi.product_id::text       AS "productoId",
  pi.ingredient_id::text    AS "insumoId",
  pi.quantity               AS "cantidadPorUnidad"
FROM product_ingredient pi
JOIN product p    ON p.id = pi.product_id  AND p.deleted_at IS NULL
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL
)
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
                                                                                                                                                      QUERY PLAN                                                                                                                                                      
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort
   Output: ((p.id)::text), p.name, (floor(min((((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))), ((array_agg(i_1.name ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1]), ((array_agg(i_1.stock_quantity ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1])
   Sort Key: (floor(min((((i_1.stock_quantity)::numeric / (pi.quantity)::numeric)))))
   ->  GroupAggregate
         Output: ((p.id)::text), p.name, floor(min((((i_1.stock_quantity)::numeric / (pi.quantity)::numeric)))), (array_agg(i_1.name ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1], (array_agg(i_1.stock_quantity ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1]
         Group Key: ((p.id)::text), p.name
         ->  Incremental Sort
               Output: ((p.id)::text), p.name, i_1.stock_quantity, pi.quantity, i_1.name, (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))
               Sort Key: ((p.id)::text), p.name, (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))
               Presorted Key: ((p.id)::text)
               ->  Nested Loop
                     Output: (p.id)::text, p.name, i_1.stock_quantity, pi.quantity, i_1.name, ((i_1.stock_quantity)::numeric / (pi.quantity)::numeric)
                     Join Filter: ((pi.ingredient_id)::text = (i_1.id)::text)
                     ->  Nested Loop
                           Output: p.id, p.name, pi.quantity, pi.ingredient_id
                           Inner Unique: true
                           ->  Merge Join
                                 Output: p.id, p.name, pi.quantity, pi.ingredient_id
                                 Merge Cond: (((pi.product_id)::text) = ((p.id)::text))
                                 ->  Sort
                                       Output: pi.quantity, pi.product_id, pi.ingredient_id, ((pi.product_id)::text)
                                       Sort Key: ((pi.product_id)::text)
                                       ->  Nested Loop
                                             Output: pi.quantity, pi.product_id, pi.ingredient_id, (pi.product_id)::text
                                             ->  Seq Scan on public.product p_1
                                                   Output: p_1.id, p_1.name, p_1.description, p_1.base_price, p_1.image_urls, p_1.stock_quantity, p_1.prep_time_min, p_1.available, p_1.created_at, p_1.updated_at, p_1.deleted_at
                                                   Filter: (p_1.deleted_at IS NULL)
                                             ->  Bitmap Heap Scan on public.product_ingredient pi
                                                   Output: pi.product_id, pi.ingredient_id, pi.is_removable, pi.quantity, pi.created_at
                                                   Recheck Cond: (pi.product_id = p_1.id)
                                                   Filter: (pi.quantity > 0)
                                                   ->  Bitmap Index Scan on product_ingredient_pkey
                                                         Index Cond: (pi.product_id = p_1.id)
                                 ->  Sort
                                       Output: p.id, p.name, ((p.id)::text)
                                       Sort Key: ((p.id)::text)
                                       ->  Seq Scan on public.product p
                                             Output: p.id, p.name, (p.id)::text
                                             Filter: ((p.deleted_at IS NULL) AND p.available)
                           ->  Index Scan using ingredient_pkey on public.ingredient i
                                 Output: i.id, i.name, i.description, i.stock_quantity, i.is_allergen, i.is_active, i.created_at, i.updated_at, i.deleted_at
                                 Index Cond: (i.id = pi.ingredient_id)
                                 Filter: (i.deleted_at IS NULL)
                     ->  Seq Scan on public.ingredient i_1
                           Output: i_1.id, i_1.name, i_1.description, i_1.stock_quantity, i_1.is_allergen, i_1.is_active, i_1.created_at, i_1.updated_at, i_1.deleted_at
                           Filter: (i_1.deleted_at IS NULL)
(46 rows)

EXPLAIN (VERBOSE, COSTS OFF)
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
                                                                                                                                                      QUERY PLAN                                                                                                                                                      
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort
   Output: ((p.id)::text), p.name, (floor(min((((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))), ((array_agg(i_1.name ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1]), ((array_agg(i_1.stock_quantity ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1])
   Sort Key: (floor(min((((i_1.stock_quantity)::numeric / (pi.quantity)::numeric)))))
   ->  GroupAggregate
         Output: ((p.id)::text), p.name, floor(min((((i_1.stock_quantity)::numeric / (pi.quantity)::numeric)))), (array_agg(i_1.name ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1], (array_agg(i_1.stock_quantity ORDER BY (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))))[1]
         Group Key: ((p.id)::text), p.name
         ->  Incremental Sort
               Output: ((p.id)::text), p.name, i_1.stock_quantity, pi.quantity, i_1.name, (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))
               Sort Key: ((p.id)::text), p.name, (((i_1.stock_quantity)::numeric / (pi.quantity)::numeric))
               Presorted Key: ((p.id)::text)
               ->  Nested Loop
                     Output: (p.id)::text, p.name, i_1.stock_quantity, pi.quantity, i_1.name, ((i_1.stock_quantity)::numeric / (pi.quantity)::numeric)
                     Join Filter: ((pi.ingredient_id)::text = (i_1.id)::text)
                     ->  Nested Loop
                           Output: p.id, p.name, pi.quantity, pi.ingredient_id
                           Inner Unique: true
                           ->  Merge Join
                                 Output: p.id, p.name, pi.quantity, pi.ingredient_id
                                 Merge Cond: (((pi.product_id)::text) = ((p.id)::text))
                                 ->  Sort
                                       Output: pi.quantity, pi.product_id, pi.ingredient_id, ((pi.product_id)::text)
                                       Sort Key: ((pi.product_id)::text)
                                       ->  Nested Loop
                                             Output: pi.quantity, pi.product_id, pi.ingredient_id, (pi.product_id)::text
                                             ->  Seq Scan on public.product p_1
                                                   Output: p_1.id, p_1.name, p_1.description, p_1.base_price, p_1.image_urls, p_1.stock_quantity, p_1.prep_time_min, p_1.available, p_1.created_at, p_1.updated_at, p_1.deleted_at
                                                   Filter: (p_1.deleted_at IS NULL)
                                             ->  Bitmap Heap Scan on public.product_ingredient pi
                                                   Output: pi.product_id, pi.ingredient_id, pi.is_removable, pi.quantity, pi.created_at
                                                   Recheck Cond: (pi.product_id = p_1.id)
                                                   Filter: (pi.quantity > 0)
                                                   ->  Bitmap Index Scan on product_ingredient_pkey
                                                         Index Cond: (pi.product_id = p_1.id)
                                 ->  Sort
                                       Output: p.id, p.name, ((p.id)::text)
                                       Sort Key: ((p.id)::text)
                                       ->  Seq Scan on public.product p
                                             Output: p.id, p.name, (p.id)::text
                                             Filter: ((p.deleted_at IS NULL) AND p.available)
                           ->  Index Scan using ingredient_pkey on public.ingredient i
                                 Output: i.id, i.name, i.description, i.stock_quantity, i.is_allergen, i.is_active, i.created_at, i.updated_at, i.deleted_at
                                 Index Cond: (i.id = pi.ingredient_id)
                                 Filter: (i.deleted_at IS NULL)
                     ->  Seq Scan on public.ingredient i_1
                           Output: i_1.id, i_1.name, i_1.description, i_1.stock_quantity, i_1.is_allergen, i_1.is_active, i_1.created_at, i_1.updated_at, i_1.deleted_at
                           Filter: (i_1.deleted_at IS NULL)
(46 rows)

EXPLAIN (VERBOSE, COSTS OFF)
WITH v_producto AS (SELECT 'SOMBRA'::text AS id, 'SOMBRA'::text AS nombre, 0 AS "stockDisponible", NULL::text AS sku, true AS activo)
SELECT * FROM v_producto;
                          QUERY PLAN                           
---------------------------------------------------------------
 Result
   Output: 'SOMBRA'::text, 'SOMBRA'::text, 0, NULL::text, true
(2 rows)

WITH v_producto AS (SELECT 'SOMBRA'::text AS id, 'SOMBRA'::text AS nombre, 0 AS "stockDisponible", NULL::text AS sku, true AS activo)
SELECT * FROM v_producto;
   id   | nombre | stockDisponible | sku | activo 
--------+--------+-----------------+-----+--------
 SOMBRA | SOMBRA |               0 |     | t
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```

### A.5.2 — Tarea 5 (Medusa)

`openspec/changes/CH-16d-segunda-automatizacion-y-with/salidas/t5_medusa_output.txt`

```text
2026-09-25T13:04:21-03:00
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
BEGIN
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura, current_setting('search_path') AS search_path;
           instante            |   aislamiento   | solo_lectura |   search_path   
-------------------------------+-----------------+--------------+-----------------
 2026-09-25 16:04:21.871851+00 | repeatable read | on           | "$user", public
(1 row)

SELECT c.relname, pg_get_viewdef(c.oid, true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' AND c.relname IN ('v_producto','v_insumo','v_receta_componente') ORDER BY 1;
       relname       |                                         pg_get_viewdef                                          
---------------------+-------------------------------------------------------------------------------------------------
 v_insumo            |  SELECT ii.id,                                                                                 +
                     |     ii.title AS nombre,                                                                        +
                     |     COALESCE(sum(il.stocked_quantity - il.reserved_quantity), 0::numeric) AS "stockDisponible",+
                     |     ii.unit_of_measure AS "unidadMedida",                                                      +
                     |     ii.sku AS codigo                                                                           +
                     |    FROM inventory_item ii                                                                      +
                     |      LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id                              +
                     |   GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku;
 v_producto          |  SELECT pv.id,                                                                                 +
                     |     (p.title || ' - '::text) || pv.title AS nombre,                                            +
                     |     COALESCE(sum(il.stocked_quantity - il.reserved_quantity), 0::numeric) AS "stockDisponible",+
                     |     pv.sku,                                                                                    +
                     |     p.status = 'published'::text AS activo                                                     +
                     |    FROM product_variant pv                                                                     +
                     |      JOIN product p ON p.id = pv.product_id                                                    +
                     |      LEFT JOIN product_variant_inventory_item pvi ON pvi.variant_id::text = pv.id              +
                     |      LEFT JOIN inventory_item ii ON ii.id = pvi.inventory_item_id::text                        +
                     |      LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id                              +
                     |   GROUP BY pv.id, p.title, pv.title, pv.sku, p.status;
 v_receta_componente |  SELECT variant_id AS "productoId",                                                            +
                     |     inventory_item_id AS "insumoId",                                                           +
                     |     required_quantity AS "cantidadPorUnidad"                                                   +
                     |    FROM product_variant_inventory_item pvi;
(3 rows)

WITH
v_producto AS (
SELECT pv.id AS id,
       p.title || ' - ' || pv.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       pv.sku AS sku,
       (p.status = 'published') AS activo
FROM product_variant pv
JOIN product p ON p.id = pv.product_id
LEFT JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
LEFT JOIN inventory_item ii ON ii.id = pvi.inventory_item_id
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY pv.id, p.title, pv.title, pv.sku, p.status
),
v_insumo AS (
SELECT ii.id AS id, ii.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       ii.unit_of_measure AS "unidadMedida", ii.sku AS codigo
FROM inventory_item ii
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku
),
v_receta_componente AS (
SELECT pvi.variant_id AS "productoId", pvi.inventory_item_id AS "insumoId",
       pvi.required_quantity AS "cantidadPorUnidad"
FROM product_variant_inventory_item pvi
)
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
                 id                 |           nombre            | stock_producible | insumo_limitante | stock_insumo_limitante 
------------------------------------+-----------------------------+------------------+------------------+------------------------
 variant_01M2Y2W2W86H25DSB7KMSCC47J | Medusa T-Shirt - S / Black  |          1000000 | S / Black        |                1000000
 variant_01M2Y2W2W9EHVM9GA5NZYGQETN | Medusa T-Shirt - S / White  |          1000000 | S / White        |                1000000
 variant_01M2Y2W2WA2AB8KRVTSJP377F6 | Medusa T-Shirt - M / White  |          1000000 | M / White        |                1000000
 variant_01M2Y2W2WAEQN1WGVNMSQN5YWZ | Medusa T-Shirt - M / Black  |          1000000 | M / Black        |                1000000
 variant_01M2Y2W2WB4DRSJ5NPDZ3D641J | Medusa T-Shirt - L / Black  |          1000000 | L / Black        |                1000000
 variant_01M2Y2W2WBGWW1CSTJ7QJ0Q68N | Medusa T-Shirt - L / White  |          1000000 | L / White        |                1000000
 variant_01M2Y2W2WCF477K88QC0SK8RPA | Medusa T-Shirt - XL / Black |          1000000 | XL / Black       |                1000000
 variant_01M2Y2W2WCKNVJWQFM3XB9CHTC | Medusa T-Shirt - XL / White |          1000000 | XL / White       |                1000000
 variant_01M2Y2W2WCYPHE9EZZ1J9B5G57 | Medusa Sweatshirt - S       |          1000000 | S                |                1000000
 variant_01M2Y2W2WD56H2PC86FPSQGHEM | Medusa Sweatshirt - L       |          1000000 | L                |                1000000
 variant_01M2Y2W2WDCV1WWACMH64J7TZ7 | Medusa Sweatshirt - XL      |          1000000 | XL               |                1000000
 variant_01M2Y2W2WDJKYGCJRBMNCCH2XC | Medusa Sweatshirt - M       |          1000000 | M                |                1000000
 variant_01M2Y2W2WE7G7WPFFAS2A8MY34 | Medusa Shorts - S           |          1000000 | S                |                1000000
 variant_01M2Y2W2WE9FAGJK3QWSD464K5 | Medusa Sweatpants - XL      |          1000000 | XL               |                1000000
 variant_01M2Y2W2WE9VEJ2KZ2FW72508C | Medusa Sweatpants - S       |          1000000 | S                |                1000000
 variant_01M2Y2W2WEARDDAEYAM00YK86Z | Medusa Sweatpants - M       |          1000000 | M                |                1000000
 variant_01M2Y2W2WER1WC9P88B2G6X7X3 | Medusa Shorts - M           |          1000000 | M                |                1000000
 variant_01M2Y2W2WERKSASVJSAB4VR4NV | Medusa Sweatpants - L       |          1000000 | L                |                1000000
 variant_01M2Y2W2WF5T9YV3WJ166WZ37X | Medusa Shorts - XL          |          1000000 | XL               |                1000000
 variant_01M2Y2W2WFPSYCQ1T8MHWNWVD9 | Medusa Shorts - L           |          1000000 | L                |                1000000
(20 rows)

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
                 id                 |           nombre            | stock_producible | insumo_limitante | stock_insumo_limitante 
------------------------------------+-----------------------------+------------------+------------------+------------------------
 variant_01M2Y2W2W86H25DSB7KMSCC47J | Medusa T-Shirt - S / Black  |          1000000 | S / Black        |                1000000
 variant_01M2Y2W2W9EHVM9GA5NZYGQETN | Medusa T-Shirt - S / White  |          1000000 | S / White        |                1000000
 variant_01M2Y2W2WA2AB8KRVTSJP377F6 | Medusa T-Shirt - M / White  |          1000000 | M / White        |                1000000
 variant_01M2Y2W2WAEQN1WGVNMSQN5YWZ | Medusa T-Shirt - M / Black  |          1000000 | M / Black        |                1000000
 variant_01M2Y2W2WB4DRSJ5NPDZ3D641J | Medusa T-Shirt - L / Black  |          1000000 | L / Black        |                1000000
 variant_01M2Y2W2WBGWW1CSTJ7QJ0Q68N | Medusa T-Shirt - L / White  |          1000000 | L / White        |                1000000
 variant_01M2Y2W2WCF477K88QC0SK8RPA | Medusa T-Shirt - XL / Black |          1000000 | XL / Black       |                1000000
 variant_01M2Y2W2WCKNVJWQFM3XB9CHTC | Medusa T-Shirt - XL / White |          1000000 | XL / White       |                1000000
 variant_01M2Y2W2WCYPHE9EZZ1J9B5G57 | Medusa Sweatshirt - S       |          1000000 | S                |                1000000
 variant_01M2Y2W2WD56H2PC86FPSQGHEM | Medusa Sweatshirt - L       |          1000000 | L                |                1000000
 variant_01M2Y2W2WDCV1WWACMH64J7TZ7 | Medusa Sweatshirt - XL      |          1000000 | XL               |                1000000
 variant_01M2Y2W2WDJKYGCJRBMNCCH2XC | Medusa Sweatshirt - M       |          1000000 | M                |                1000000
 variant_01M2Y2W2WE7G7WPFFAS2A8MY34 | Medusa Shorts - S           |          1000000 | S                |                1000000
 variant_01M2Y2W2WE9FAGJK3QWSD464K5 | Medusa Sweatpants - XL      |          1000000 | XL               |                1000000
 variant_01M2Y2W2WE9VEJ2KZ2FW72508C | Medusa Sweatpants - S       |          1000000 | S                |                1000000
 variant_01M2Y2W2WEARDDAEYAM00YK86Z | Medusa Sweatpants - M       |          1000000 | M                |                1000000
 variant_01M2Y2W2WER1WC9P88B2G6X7X3 | Medusa Shorts - M           |          1000000 | M                |                1000000
 variant_01M2Y2W2WERKSASVJSAB4VR4NV | Medusa Sweatpants - L       |          1000000 | L                |                1000000
 variant_01M2Y2W2WF5T9YV3WJ166WZ37X | Medusa Shorts - XL          |          1000000 | XL               |                1000000
 variant_01M2Y2W2WFPSYCQ1T8MHWNWVD9 | Medusa Shorts - L           |          1000000 | L                |                1000000
(20 rows)

SELECT COALESCE(w.id, v.id) AS id, w.stock_producible AS sp_with, v.stock_producible AS sp_vistas,
       CASE WHEN v.id IS NULL THEN 'solo_with' WHEN w.id IS NULL THEN 'solo_vistas'
            WHEN w.stock_producible IS DISTINCT FROM v.stock_producible THEN 'interseccion_valor_distinto' ELSE 'interseccion_igual' END AS conjunto,
       (w.insumo_limitante IS NOT DISTINCT FROM v.insumo_limitante AND w.stock_insumo_limitante IS NOT DISTINCT FROM v.stock_insumo_limitante AND w.nombre IS NOT DISTINCT FROM v.nombre) AS resto_de_columnas_igual
FROM (
-- ============================================================
-- DEC-31: composición con WITH. Las definiciones de v_producto,
-- v_insumo y v_receta_componente se copian de 06_vistas_medusa.sql
-- (sin CREATE VIEW ni SET search_path) y se anteponen, sin
-- tocar su texto, a 04_consulta_canonica.sql.
-- ============================================================
WITH
v_producto AS (
SELECT pv.id AS id,
       p.title || ' - ' || pv.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       pv.sku AS sku,
       (p.status = 'published') AS activo
FROM product_variant pv
JOIN product p ON p.id = pv.product_id
LEFT JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
LEFT JOIN inventory_item ii ON ii.id = pvi.inventory_item_id
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY pv.id, p.title, pv.title, pv.sku, p.status
),
v_insumo AS (
SELECT ii.id AS id, ii.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       ii.unit_of_measure AS "unidadMedida", ii.sku AS codigo
FROM inventory_item ii
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku
),
v_receta_componente AS (
SELECT pvi.variant_id AS "productoId", pvi.inventory_item_id AS "insumoId",
       pvi.required_quantity AS "cantidadPorUnidad"
FROM product_variant_inventory_item pvi
)
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
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC
) w FULL JOIN (
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
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC
) v ON w.id = v.id
ORDER BY 4, 1;
                 id                 | sp_with | sp_vistas |      conjunto      | resto_de_columnas_igual 
------------------------------------+---------+-----------+--------------------+-------------------------
 variant_01M2Y2W2W86H25DSB7KMSCC47J | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2W9EHVM9GA5NZYGQETN | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WA2AB8KRVTSJP377F6 | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WAEQN1WGVNMSQN5YWZ | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WB4DRSJ5NPDZ3D641J | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WBGWW1CSTJ7QJ0Q68N | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WCF477K88QC0SK8RPA | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WCKNVJWQFM3XB9CHTC | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WCYPHE9EZZ1J9B5G57 | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WD56H2PC86FPSQGHEM | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WDCV1WWACMH64J7TZ7 | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WDJKYGCJRBMNCCH2XC | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WE7G7WPFFAS2A8MY34 | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WE9FAGJK3QWSD464K5 | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WE9VEJ2KZ2FW72508C | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WEARDDAEYAM00YK86Z | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WER1WC9P88B2G6X7X3 | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WERKSASVJSAB4VR4NV | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WF5T9YV3WJ166WZ37X | 1000000 |   1000000 | interseccion_igual | t
 variant_01M2Y2W2WFPSYCQ1T8MHWNWVD9 | 1000000 |   1000000 | interseccion_igual | t
(20 rows)

EXPLAIN (VERBOSE, COSTS OFF)
-- ============================================================
-- DEC-31: composición con WITH. Las definiciones de v_producto,
-- v_insumo y v_receta_componente se copian de 06_vistas_medusa.sql
-- (sin CREATE VIEW ni SET search_path) y se anteponen, sin
-- tocar su texto, a 04_consulta_canonica.sql.
-- ============================================================
WITH
v_producto AS (
SELECT pv.id AS id,
       p.title || ' - ' || pv.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       pv.sku AS sku,
       (p.status = 'published') AS activo
FROM product_variant pv
JOIN product p ON p.id = pv.product_id
LEFT JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
LEFT JOIN inventory_item ii ON ii.id = pvi.inventory_item_id
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY pv.id, p.title, pv.title, pv.sku, p.status
),
v_insumo AS (
SELECT ii.id AS id, ii.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       ii.unit_of_measure AS "unidadMedida", ii.sku AS codigo
FROM inventory_item ii
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku
),
v_receta_componente AS (
SELECT pvi.variant_id AS "productoId", pvi.inventory_item_id AS "insumoId",
       pvi.required_quantity AS "cantidadPorUnidad"
FROM product_variant_inventory_item pvi
)
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
                                                                                                                                                                                                                                                                  QUERY PLAN                                                                                                                                                                                                                                                                   
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort
   Output: pv.id, (((p.title || ' - '::text) || pv.title)), (floor(min((((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))), ((array_agg(ii.title ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1]), ((array_agg((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1])
   Sort Key: (floor(min((((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity)))))
   ->  GroupAggregate
         Output: pv.id, (((p.title || ' - '::text) || pv.title)), floor(min((((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity)))), (array_agg(ii.title ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1], (array_agg((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1]
         Group Key: pv.id, (((p.title || ' - '::text) || pv.title))
         ->  Sort
               Output: pv.id, (((p.title || ' - '::text) || pv.title)), (COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)), pvi.required_quantity, ii.title, (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))
               Sort Key: pv.id, (((p.title || ' - '::text) || pv.title)), (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))
               ->  Hash Join
                     Output: pv.id, (((p.title || ' - '::text) || pv.title)), (COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)), pvi.required_quantity, ii.title, ((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity)
                     Hash Cond: (ii.id = (pvi.inventory_item_id)::text)
                     ->  HashAggregate
                           Output: ii.id, ii.title, COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric), ii.unit_of_measure, ii.sku
                           Group Key: ii.id
                           ->  Hash Right Join
                                 Output: ii.id, ii.title, il.stocked_quantity, il.reserved_quantity, ii.unit_of_measure, ii.sku
                                 Inner Unique: true
                                 Hash Cond: (il.inventory_item_id = ii.id)
                                 ->  Seq Scan on public.inventory_level il
                                       Output: il.id, il.created_at, il.updated_at, il.deleted_at, il.inventory_item_id, il.location_id, il.stocked_quantity, il.reserved_quantity, il.incoming_quantity, il.metadata, il.raw_stocked_quantity, il.raw_reserved_quantity, il.raw_incoming_quantity
                                 ->  Hash
                                       Output: ii.id, ii.title, ii.unit_of_measure, ii.sku
                                       ->  Seq Scan on public.inventory_item ii
                                             Output: ii.id, ii.title, ii.unit_of_measure, ii.sku
                     ->  Hash
                           Output: pv.id, (((p.title || ' - '::text) || pv.title)), pvi.required_quantity, pvi.inventory_item_id
                           ->  Nested Loop
                                 Output: pv.id, (((p.title || ' - '::text) || pv.title)), pvi.required_quantity, pvi.inventory_item_id
                                 ->  GroupAggregate
                                       Output: pv.id, ((p.title || ' - '::text) || pv.title), NULL::numeric, pv.sku, NULL::boolean, p.title, pv.title, p.status
                                       Group Key: pv.id, p.title
                                       ->  Sort
                                             Output: pv.id, p.title, pv.title, pv.sku, p.status
                                             Sort Key: pv.id, p.title
                                             ->  Nested Loop Left Join
                                                   Output: pv.id, p.title, pv.title, pv.sku, p.status
                                                   ->  Hash Join
                                                         Output: pv.id, pv.title, pv.sku, p.title, p.status
                                                         Inner Unique: true
                                                         Hash Cond: (pv.product_id = p.id)
                                                         ->  Seq Scan on public.product_variant pv
                                                               Output: pv.id, pv.title, pv.sku, pv.barcode, pv.ean, pv.upc, pv.allow_backorder, pv.manage_inventory, pv.hs_code, pv.origin_country, pv.mid_code, pv.material, pv.weight, pv.length, pv.height, pv.width, pv.metadata, pv.variant_rank, pv.product_id, pv.created_at, pv.updated_at, pv.deleted_at, pv.thumbnail
                                                         ->  Hash
                                                               Output: p.title, p.status, p.id
                                                               ->  Seq Scan on public.product p
                                                                     Output: p.title, p.status, p.id
                                                                     Filter: (p.status = 'published'::text)
                                                   ->  Nested Loop Left Join
                                                         Output: pvi_1.variant_id
                                                         ->  Index Only Scan using product_variant_inventory_item_pkey on public.product_variant_inventory_item pvi_1
                                                               Output: pvi_1.variant_id, pvi_1.inventory_item_id
                                                               Index Cond: (pvi_1.variant_id = pv.id)
                                                         ->  Hash Right Join
                                                               Output: ii_1.id
                                                               Inner Unique: true
                                                               Hash Cond: (il_1.inventory_item_id = ii_1.id)
                                                               ->  Seq Scan on public.inventory_level il_1
                                                                     Output: il_1.id, il_1.created_at, il_1.updated_at, il_1.deleted_at, il_1.inventory_item_id, il_1.location_id, il_1.stocked_quantity, il_1.reserved_quantity, il_1.incoming_quantity, il_1.metadata, il_1.raw_stocked_quantity, il_1.raw_reserved_quantity, il_1.raw_incoming_quantity
                                                               ->  Hash
                                                                     Output: ii_1.id
                                                                     ->  Index Only Scan using inventory_item_pkey on public.inventory_item ii_1
                                                                           Output: ii_1.id
                                                                           Index Cond: (ii_1.id = (pvi_1.inventory_item_id)::text)
                                 ->  Index Scan using product_variant_inventory_item_pkey on public.product_variant_inventory_item pvi
                                       Output: pvi.variant_id, pvi.inventory_item_id, pvi.id, pvi.required_quantity, pvi.created_at, pvi.updated_at, pvi.deleted_at
                                       Index Cond: ((pvi.variant_id)::text = pv.id)
                                       Filter: (pvi.required_quantity > '0'::numeric)
(68 rows)

EXPLAIN (VERBOSE, COSTS OFF)
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
                                                                                                                                                                                                                                                                  QUERY PLAN                                                                                                                                                                                                                                                                   
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort
   Output: pv.id, (((p.title || ' - '::text) || pv.title)), (floor(min((((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))), ((array_agg(ii.title ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1]), ((array_agg((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1])
   Sort Key: (floor(min((((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity)))))
   ->  GroupAggregate
         Output: pv.id, (((p.title || ' - '::text) || pv.title)), floor(min((((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity)))), (array_agg(ii.title ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1], (array_agg((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) ORDER BY (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))))[1]
         Group Key: pv.id, (((p.title || ' - '::text) || pv.title))
         ->  Sort
               Output: pv.id, (((p.title || ' - '::text) || pv.title)), (COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)), pvi.required_quantity, ii.title, (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))
               Sort Key: pv.id, (((p.title || ' - '::text) || pv.title)), (((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity))
               ->  Hash Join
                     Output: pv.id, (((p.title || ' - '::text) || pv.title)), (COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)), pvi.required_quantity, ii.title, ((COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric)) / pvi.required_quantity)
                     Hash Cond: (ii.id = (pvi.inventory_item_id)::text)
                     ->  HashAggregate
                           Output: ii.id, ii.title, COALESCE(sum((il.stocked_quantity - il.reserved_quantity)), '0'::numeric), ii.unit_of_measure, ii.sku
                           Group Key: ii.id
                           ->  Hash Right Join
                                 Output: ii.id, ii.title, il.stocked_quantity, il.reserved_quantity, ii.unit_of_measure, ii.sku
                                 Inner Unique: true
                                 Hash Cond: (il.inventory_item_id = ii.id)
                                 ->  Seq Scan on public.inventory_level il
                                       Output: il.id, il.created_at, il.updated_at, il.deleted_at, il.inventory_item_id, il.location_id, il.stocked_quantity, il.reserved_quantity, il.incoming_quantity, il.metadata, il.raw_stocked_quantity, il.raw_reserved_quantity, il.raw_incoming_quantity
                                 ->  Hash
                                       Output: ii.id, ii.title, ii.unit_of_measure, ii.sku
                                       ->  Seq Scan on public.inventory_item ii
                                             Output: ii.id, ii.title, ii.unit_of_measure, ii.sku
                     ->  Hash
                           Output: pv.id, (((p.title || ' - '::text) || pv.title)), pvi.required_quantity, pvi.inventory_item_id
                           ->  Nested Loop
                                 Output: pv.id, (((p.title || ' - '::text) || pv.title)), pvi.required_quantity, pvi.inventory_item_id
                                 ->  GroupAggregate
                                       Output: pv.id, ((p.title || ' - '::text) || pv.title), NULL::numeric, pv.sku, NULL::boolean, p.title, pv.title, p.status
                                       Group Key: pv.id, p.title
                                       ->  Sort
                                             Output: pv.id, p.title, pv.title, pv.sku, p.status
                                             Sort Key: pv.id, p.title
                                             ->  Nested Loop Left Join
                                                   Output: pv.id, p.title, pv.title, pv.sku, p.status
                                                   ->  Hash Join
                                                         Output: pv.id, pv.title, pv.sku, p.title, p.status
                                                         Inner Unique: true
                                                         Hash Cond: (pv.product_id = p.id)
                                                         ->  Seq Scan on public.product_variant pv
                                                               Output: pv.id, pv.title, pv.sku, pv.barcode, pv.ean, pv.upc, pv.allow_backorder, pv.manage_inventory, pv.hs_code, pv.origin_country, pv.mid_code, pv.material, pv.weight, pv.length, pv.height, pv.width, pv.metadata, pv.variant_rank, pv.product_id, pv.created_at, pv.updated_at, pv.deleted_at, pv.thumbnail
                                                         ->  Hash
                                                               Output: p.title, p.status, p.id
                                                               ->  Seq Scan on public.product p
                                                                     Output: p.title, p.status, p.id
                                                                     Filter: (p.status = 'published'::text)
                                                   ->  Nested Loop Left Join
                                                         Output: pvi_1.variant_id
                                                         ->  Index Only Scan using product_variant_inventory_item_pkey on public.product_variant_inventory_item pvi_1
                                                               Output: pvi_1.variant_id, pvi_1.inventory_item_id
                                                               Index Cond: (pvi_1.variant_id = pv.id)
                                                         ->  Hash Right Join
                                                               Output: ii_1.id
                                                               Inner Unique: true
                                                               Hash Cond: (il_1.inventory_item_id = ii_1.id)
                                                               ->  Seq Scan on public.inventory_level il_1
                                                                     Output: il_1.id, il_1.created_at, il_1.updated_at, il_1.deleted_at, il_1.inventory_item_id, il_1.location_id, il_1.stocked_quantity, il_1.reserved_quantity, il_1.incoming_quantity, il_1.metadata, il_1.raw_stocked_quantity, il_1.raw_reserved_quantity, il_1.raw_incoming_quantity
                                                               ->  Hash
                                                                     Output: ii_1.id
                                                                     ->  Index Only Scan using inventory_item_pkey on public.inventory_item ii_1
                                                                           Output: ii_1.id
                                                                           Index Cond: (ii_1.id = (pvi_1.inventory_item_id)::text)
                                 ->  Index Scan using product_variant_inventory_item_pkey on public.product_variant_inventory_item pvi
                                       Output: pvi.variant_id, pvi.inventory_item_id, pvi.id, pvi.required_quantity, pvi.created_at, pvi.updated_at, pvi.deleted_at
                                       Index Cond: ((pvi.variant_id)::text = pv.id)
                                       Filter: (pvi.required_quantity > '0'::numeric)
(68 rows)

EXPLAIN (VERBOSE, COSTS OFF)
WITH v_producto AS (SELECT 'SOMBRA'::text AS id, 'SOMBRA'::text AS nombre, 0 AS "stockDisponible", NULL::text AS sku, true AS activo)
SELECT * FROM v_producto;
                          QUERY PLAN                           
---------------------------------------------------------------
 Result
   Output: 'SOMBRA'::text, 'SOMBRA'::text, 0, NULL::text, true
(2 rows)

WITH v_producto AS (SELECT 'SOMBRA'::text AS id, 'SOMBRA'::text AS nombre, 0 AS "stockDisponible", NULL::text AS sku, true AS activo)
SELECT * FROM v_producto;
   id   | nombre | stockDisponible | sku | activo 
--------+--------+-----------------+-----+--------
 SOMBRA | SOMBRA |               0 |     | t
(1 row)

ROLLBACK;
ROLLBACK
exit=0
```
