SET search_path TO foodstore;
-- Consulta ORIGINAL de WF-01c, tal como figura en el Anexo A, sin el HAVING
-- (se saca el umbral para poder comparar el universo completo)
SELECT
    p.id, p.name,
    FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) AS stock_producible,
    (ARRAY_AGG(i.name ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS ingrediente_critico
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL
WHERE p.deleted_at IS NULL AND p.available = true AND pi.quantity > 0
GROUP BY p.id, p.name
ORDER BY p.id;
