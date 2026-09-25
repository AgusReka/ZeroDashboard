BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura, current_setting('search_path') AS search_path;
-- (0) definiciones de las vistas creadas en la base
SELECT c.relname, pg_get_viewdef(c.oid, true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' AND c.relname IN ('v_producto','v_insumo','v_receta_componente') ORDER BY 1;
-- (1) versión con WITH: 13_stock_producible_con_with_medusa.sql
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
-- (2) versión con vistas: 04_consulta_canonica.sql
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
-- (3) diferencia simétrica por (id, stock_producible)
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
-- (4) EXPLAIN de la versión con WITH
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
-- (5) EXPLAIN de la versión con vistas
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
-- (6) prueba de ocultamiento: un WITH v_producto con una sola fila constante.
--     Si el nombre del WITH tapa a la vista, el plan no lee ninguna tabla y
--     la consulta devuelve la fila 'SOMBRA'; si leyera la vista, aparecerían
--     las filas reales.
EXPLAIN (VERBOSE, COSTS OFF)
WITH v_producto AS (SELECT 'SOMBRA'::text AS id, 'SOMBRA'::text AS nombre, 0 AS "stockDisponible", NULL::text AS sku, true AS activo)
SELECT * FROM v_producto;
WITH v_producto AS (SELECT 'SOMBRA'::text AS id, 'SOMBRA'::text AS nombre, 0 AS "stockDisponible", NULL::text AS sku, true AS activo)
SELECT * FROM v_producto;
ROLLBACK;
