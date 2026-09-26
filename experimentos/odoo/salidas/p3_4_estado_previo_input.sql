BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user;
-- Insumos compartidos entre recetas elegidas de productos activos (regla 4.1.1)
SELECT "insumoId", count(DISTINCT rc."productoId") AS productos, string_agg(rc."productoId", ',' ORDER BY rc."productoId"::int) AS cuales
FROM v_receta_componente rc JOIN v_producto p ON p.id = rc."productoId" WHERE p.activo
GROUP BY 1 HAVING count(DISTINCT rc."productoId") >= 2 ORDER BY "insumoId"::int;
-- Lineas de las listas elegidas con el componente 57 (regla 4.1.2)
SELECT l.id, l.bom_id, l.product_id, l.product_qty, l.product_uom_id FROM mrp_bom_line l WHERE l.product_id = 57 ORDER BY l.id;
-- Quants del insumo 57 en ubicaciones internas (regla 4.1.3)
SELECT q.id, q.location_id, q.quantity, q.reserved_quantity FROM stock_quant q JOIN stock_location l ON l.id=q.location_id
WHERE q.product_id = 57 AND l.usage='internal' ORDER BY q.id;
SELECT id, lot_stock_id, company_id FROM stock_warehouse ORDER BY id LIMIT 1;
SELECT count(*) AS quants_totales, max(id) AS max_id FROM stock_quant;
ROLLBACK;
