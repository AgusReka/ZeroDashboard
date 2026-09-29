-- Huella del estado de las tablas nativas que determinan el stock producible.
-- Una fila por tabla: cantidad de filas y md5 de todas sus filas como texto, ordenadas (COLLATE "C").
SELECT 'product' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product t
UNION ALL
SELECT 'ingredient' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM ingredient t
UNION ALL
SELECT 'product_ingredient' AS tabla, count(*) AS filas, md5(COALESCE(string_agg(t::text, E'\n' ORDER BY t::text COLLATE "C"), '')) AS huella FROM product_ingredient t
ORDER BY 1;
