-- Anexo C, 4.1, texto literal; solo el rango de fechas pasa a :'desde' / :'hasta'.
SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= :'desde'
  AND p.created_at <  :'hasta';
