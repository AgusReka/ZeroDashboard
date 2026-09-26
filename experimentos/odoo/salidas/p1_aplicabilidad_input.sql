SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, version();
-- A. Modulos instalados (catalogo de Odoo)
SELECT name, state, latest_version FROM ir_module_module WHERE state = 'installed' ORDER BY name;
-- B. Columnas de las tablas que se van a mapear
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('product_product','product_template','mrp_bom','mrp_bom_line','stock_quant','stock_location',
                     'uom_uom','sale_order','sale_order_line','res_currency')
ORDER BY table_name, ordinal_position;
-- C. Listas de materiales
SELECT (SELECT count(*) FROM mrp_bom) AS mrp_bom, (SELECT count(*) FROM mrp_bom_line) AS mrp_bom_line;
SELECT type, active, count(*) AS listas FROM mrp_bom GROUP BY type, active ORDER BY type, active;
-- D. Existencias en ubicaciones internas
SELECT l.usage, count(*) AS filas_stock_quant FROM stock_quant q JOIN stock_location l ON l.id = q.location_id GROUP BY l.usage ORDER BY l.usage;
-- E. Pedidos por estado y por dia (fecha date_order, UTC en la base, llevada a la zona de la sesion)
SELECT state, count(*) AS pedidos FROM sale_order GROUP BY state ORDER BY state;
SELECT (date_order AT TIME ZONE 'UTC')::date AS dia, state, count(*) AS pedidos
FROM sale_order GROUP BY 1, 2 ORDER BY 1, 2;
ROLLBACK;
