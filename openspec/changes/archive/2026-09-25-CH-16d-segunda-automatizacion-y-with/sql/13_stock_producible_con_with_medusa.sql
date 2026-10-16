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
