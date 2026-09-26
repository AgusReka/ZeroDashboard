#!/usr/bin/env bash
# Paso 2: roles (creador de vistas y solo lectura, como CH-16c), creacion de vistas y GRANT.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
source .env
TABLAS="product_product, product_template, product_variant_combination, product_template_attribute_value, product_attribute_value, product_attribute, stock_quant, stock_location, uom_uom, mrp_bom, mrp_bom_line, mrp_bom_line_product_template_attribute_value_rel, sale_order, sale_order_line, res_currency"
# Las contrasenas no se escriben en las salidas: se pasan como variables de psql.
cat > salidas/p2_roles_input.sql <<SQL
SELECT now() AS hora_servidor, current_user;
CREATE ROLE zd_odoo_creador LOGIN PASSWORD :'pw_creador';
CREATE ROLE zd_odoo_lectura LOGIN PASSWORD :'pw_lectura';
GRANT CONNECT ON DATABASE odoo TO zd_odoo_creador, zd_odoo_lectura;
GRANT USAGE, CREATE ON SCHEMA public TO zd_odoo_creador;
GRANT USAGE ON SCHEMA public TO zd_odoo_lectura;
GRANT SELECT ON $TABLAS TO zd_odoo_creador;
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname LIKE 'zd_odoo_%' ORDER BY 1;
SQL
{ date -Iseconds; docker compose exec -T db psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e -v pw_creador="$ZD_CREADOR_PASSWORD" -v pw_lectura="$ZD_LECTURA_PASSWORD" < salidas/p2_roles_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p2_roles_output.txt 2>&1
{ date -Iseconds; docker compose exec -T -e PGPASSWORD="$ZD_CREADOR_PASSWORD" db psql -h localhost -U zd_odoo_creador -d odoo -v ON_ERROR_STOP=1 -e \
    -c "SELECT now() AS hora_servidor, current_user;" -f - < vistas/vistas_odoo.sql; echo "exit=$?"; date -Iseconds; } > salidas/p2_vistas_output.txt 2>&1
cat > salidas/p2_grant_input.sql <<'SQL'
SELECT now() AS hora_servidor, current_user;
GRANT SELECT ON v_producto, v_insumo, v_receta_componente, v_pedido, v_item_pedido TO zd_odoo_lectura;
SELECT c.relname, pg_get_userbyid(c.relowner) AS duenio FROM pg_class c WHERE c.relname IN ('v_producto','v_insumo','v_receta_componente','v_pedido','v_item_pedido','zd_nombre_variante','zd_disponible_variante') ORDER BY 1;
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'zd_odoo_lectura' ORDER BY 2, 3;
SQL
{ date -Iseconds; docker compose exec -T -e PGPASSWORD="$ZD_CREADOR_PASSWORD" db psql -h localhost -U zd_odoo_creador -d odoo -v ON_ERROR_STOP=1 -e < salidas/p2_grant_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p2_grant_output.txt 2>&1
# Controles con el rol de solo lectura: lee las vistas; no lee tablas base ni auxiliares; no escribe.
cat > salidas/p2_controles_input.sql <<'SQL'
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
SQL
{ date -Iseconds; docker compose exec -T -e PGPASSWORD="$ZD_LECTURA_PASSWORD" db psql -h localhost -U zd_odoo_lectura -d odoo -e < salidas/p2_controles_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p2_controles_output.txt 2>&1
