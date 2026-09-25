-- Anexo C, 4.2, texto literal sin LIMIT 5; solo el rango de fechas pasa a :'desde' / :'hasta'.
SELECT
    dp.producto_nombre,
    SUM(dp.cantidad) AS unidades_vendidas,
    SUM(dp.subtotal) AS total_generado
FROM detalle_pedido dp
JOIN pedido p ON p.id = dp.pedido_id
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE dp.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= :'desde'
  AND p.created_at <  :'hasta'
GROUP BY dp.producto_nombre
ORDER BY unidades_vendidas DESC;
