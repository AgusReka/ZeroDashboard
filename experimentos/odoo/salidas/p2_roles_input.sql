SELECT now() AS hora_servidor, current_user;
CREATE ROLE zd_odoo_creador LOGIN PASSWORD :'pw_creador';
CREATE ROLE zd_odoo_lectura LOGIN PASSWORD :'pw_lectura';
GRANT CONNECT ON DATABASE odoo TO zd_odoo_creador, zd_odoo_lectura;
GRANT USAGE, CREATE ON SCHEMA public TO zd_odoo_creador;
GRANT USAGE ON SCHEMA public TO zd_odoo_lectura;
GRANT SELECT ON product_product, product_template, product_variant_combination, product_template_attribute_value, product_attribute_value, product_attribute, stock_quant, stock_location, uom_uom, mrp_bom, mrp_bom_line, mrp_bom_line_product_template_attribute_value_rel, sale_order, sale_order_line, res_currency TO zd_odoo_creador;
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname LIKE 'zd_odoo_%' ORDER BY 1;
