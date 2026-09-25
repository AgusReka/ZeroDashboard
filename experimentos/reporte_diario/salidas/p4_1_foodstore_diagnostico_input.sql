SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona;
-- 4.1 nombres historicos distintos del nombre actual
SELECT count(*) AS lineas_con_nombre_distinto,
       count(DISTINCT dp.producto_id) AS productos_afectados
FROM detalle_pedido dp JOIN product pr ON pr.id = dp.producto_id
WHERE dp.producto_nombre <> pr.name;
SELECT dp.producto_id, dp.producto_nombre AS nombre_historico, pr.name AS nombre_actual,
       pr.deleted_at IS NOT NULL AS producto_borrado, count(*) AS lineas,
       count(*) FILTER (WHERE dp.deleted_at IS NULL) AS lineas_vivas
FROM detalle_pedido dp JOIN product pr ON pr.id = dp.producto_id
WHERE dp.producto_nombre <> pr.name
GROUP BY 1,2,3,4 ORDER BY 1,2;
-- ambiguedad del mapeo nombre -> id: nombres historicos con mas de un producto_id, e ids con mas de un nombre
SELECT producto_nombre, array_agg(DISTINCT producto_id ORDER BY producto_id) AS ids
FROM detalle_pedido GROUP BY 1 HAVING count(DISTINCT producto_id) > 1;
SELECT producto_id, array_agg(DISTINCT producto_nombre ORDER BY producto_nombre) AS nombres
FROM detalle_pedido GROUP BY 1 HAVING count(DISTINCT producto_nombre) > 1;
-- productos vendidos que ya no estan en v_producto (baja logica)
SELECT DISTINCT dp.producto_id FROM detalle_pedido dp JOIN product pr ON pr.id = dp.producto_id WHERE pr.deleted_at IS NOT NULL;
-- mapeo descripcion -> codigo
SELECT id, codigo, descripcion FROM estado_pedido ORDER BY orden;
-- dias con pedidos (fecha local de created_at, timestamp sin zona)
SELECT p.created_at::date AS dia, count(*) AS pedidos,
       count(*) FILTER (WHERE p.deleted_at IS NULL) AS pedidos_vivos,
       count(*) FILTER (WHERE ep.codigo = 'CANCELADO') AS cancelados
FROM pedido p JOIN estado_pedido ep ON ep.id = p.estado_id GROUP BY 1 ORDER BY 1;
-- bajas logicas
SELECT (SELECT count(*) FROM pedido WHERE deleted_at IS NOT NULL) AS pedidos_borrados,
       (SELECT count(*) FROM detalle_pedido WHERE deleted_at IS NOT NULL) AS detalles_borrados;
-- total vs subtotal + envio; subtotal de linea vs cantidad*precio
SELECT count(*) FILTER (WHERE total <> subtotal + COALESCE(costo_envio,0)) AS pedidos_total_distinto,
       count(*) FILTER (WHERE COALESCE(costo_envio,0) <> 0) AS pedidos_con_envio
FROM pedido;
SELECT count(*) FILTER (WHERE subtotal <> cantidad * producto_precio_unitario) AS lineas_subtotal_distinto FROM detalle_pedido;
SELECT min(created_at), max(created_at) FROM pedido;
ROLLBACK;
