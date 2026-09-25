SELECT descripcion, CASE WHEN codigo = 'CANCELADO' THEN 'cancelado' ELSE codigo::text END FROM estado_pedido ORDER BY 1;
