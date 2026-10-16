SET search_path TO medusa;
-- Vistas canónicas de CH-16, transcriptas TAL CUAL de la bitácora.
CREATE OR REPLACE VIEW v_producto AS
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
GROUP BY pv.id, p.title, pv.title, pv.sku, p.status;

CREATE OR REPLACE VIEW v_insumo AS
SELECT ii.id AS id, ii.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       ii.unit_of_measure AS "unidadMedida", ii.sku AS codigo
FROM inventory_item ii
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku;

CREATE OR REPLACE VIEW v_receta_componente AS
SELECT pvi.variant_id AS "productoId", pvi.inventory_item_id AS "insumoId",
       pvi.required_quantity AS "cantidadPorUnidad"
FROM product_variant_inventory_item pvi;
