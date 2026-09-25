-- Anexo C, 4.3, texto literal; solo el rango de fechas pasa a :'desde' / :'hasta'.
SELECT
    ep.descripcion AS estado,
    COUNT(*) AS cantidad
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND p.created_at >= :'desde'
  AND p.created_at <  :'hasta'
GROUP BY ep.descripcion
ORDER BY cantidad DESC;
