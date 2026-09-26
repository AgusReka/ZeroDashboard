SELECT now() AS hora_servidor, current_user;
SELECT 'v_producto' AS vista, count(*) FROM v_producto UNION ALL SELECT 'v_insumo', count(*) FROM v_insumo
UNION ALL SELECT 'v_receta_componente', count(*) FROM v_receta_componente UNION ALL SELECT 'v_pedido', count(*) FROM v_pedido
UNION ALL SELECT 'v_item_pedido', count(*) FROM v_item_pedido;
SELECT count(*) FILTER (WHERE activo IS NULL) AS activo_nulo, count(*) FILTER (WHERE activo) AS activos, count(*) AS total FROM v_producto;
\set ON_ERROR_STOP 0
SELECT count(*) FROM sale_order;
SELECT count(*) FROM zd_nombre_variante;
CREATE TABLE zd_prueba (x int);
UPDATE sale_order SET state = state WHERE false;
