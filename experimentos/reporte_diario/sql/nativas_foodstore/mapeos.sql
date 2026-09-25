-- Mapeos para cruzar la nativa con la canonica (no son parte del reporte).
SELECT DISTINCT producto_nombre, producto_id::text FROM detalle_pedido ORDER BY 1;
