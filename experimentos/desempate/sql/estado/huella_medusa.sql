-- Huella del estado de las tablas nativas que determinan el stock producible.
-- Una fila por tabla: cantidad de filas y md5 de todas sus filas como texto, ordenadas (COLLATE "C").
SELECT 'product' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product t
UNION ALL
SELECT 'product_variant' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product_variant t
UNION ALL
SELECT 'product_variant_inventory_item' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product_variant_inventory_item t
UNION ALL
SELECT 'inventory_item' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM inventory_item t
UNION ALL
SELECT 'inventory_level' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM inventory_level t
ORDER BY 1;
