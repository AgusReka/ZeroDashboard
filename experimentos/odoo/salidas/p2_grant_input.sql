SELECT now() AS hora_servidor, current_user;
GRANT SELECT ON v_producto, v_insumo, v_receta_componente, v_pedido, v_item_pedido TO zd_odoo_lectura;
SELECT c.relname, pg_get_userbyid(c.relowner) AS duenio FROM pg_class c WHERE c.relname IN ('v_producto','v_insumo','v_receta_componente','v_pedido','v_item_pedido','zd_nombre_variante','zd_disponible_variante') ORDER BY 1;
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'zd_odoo_lectura' ORDER BY 2, 3;
