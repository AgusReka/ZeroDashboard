-- Huella del estado de las tablas nativas que determinan el stock producible.
-- Una fila por tabla: cantidad de filas y md5 de todas sus filas como texto, ordenadas (COLLATE "C").
SELECT 'product_product' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product_product t
UNION ALL
SELECT 'product_template' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product_template t
UNION ALL
SELECT 'mrp_bom' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM mrp_bom t
UNION ALL
SELECT 'mrp_bom_line' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM mrp_bom_line t
UNION ALL
SELECT 'mrp_bom_line_product_template_attribute_value_rel' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM mrp_bom_line_product_template_attribute_value_rel t
UNION ALL
SELECT 'stock_quant' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM stock_quant t
UNION ALL
SELECT 'stock_location' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM stock_location t
UNION ALL
SELECT 'uom_uom' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM uom_uom t
ORDER BY 1;
