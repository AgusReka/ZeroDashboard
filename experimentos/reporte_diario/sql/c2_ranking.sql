-- C2. Productos mas vendidos (Anexo C, 4.2) sobre el contrato canonico, sin LIMIT.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    i."productoId",
    pr.nombre,
    SUM(i.cantidad) AS unidades_vendidas,
    COALESCE(SUM(i.cantidad * i."precioUnitario"), 0) AS total_generado
FROM v_item_pedido i
JOIN v_pedido p ON p.id = i."pedidoId"
LEFT JOIN v_producto pr ON pr.id = i."productoId"
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY i."productoId", pr.nombre
ORDER BY unidades_vendidas DESC, i."productoId";
