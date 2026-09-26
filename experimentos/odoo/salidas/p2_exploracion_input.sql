SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor;
-- Tablas de relacion de mrp_bom_line y de variantes
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND (table_name LIKE 'mrp_bom%rel' OR table_name LIKE 'product_variant_combination%'
   OR (table_name IN ('mrp_bom','mrp_bom_line','uom_uom','stock_location','stock_quant','sale_order','sale_order_line','product_template','res_currency','stock_warehouse') AND column_name LIKE '%\_id'))
ORDER BY 1,2;
-- Listas de materiales
SELECT b.id, b.type, b.sequence, b.product_tmpl_id, b.product_id, b.product_qty, b.product_uom_id, b.company_id, b.active,
       pt.name->>'en_US' AS plantilla, pt.type AS tipo_prod, pt.active AS tmpl_activo
FROM mrp_bom b JOIN product_template pt ON pt.id = b.product_tmpl_id ORDER BY b.id;
SELECT l.id, l.bom_id, l.product_id, l.product_qty, l.product_uom_id, pp.product_tmpl_id, pt.name->>'en_US' AS componente, pt.uom_id AS uom_prod
FROM mrp_bom_line l JOIN product_product pp ON pp.id = l.product_id JOIN product_template pt ON pt.id = pp.product_tmpl_id ORDER BY l.bom_id, l.id;
SELECT * FROM mrp_bom_line_product_template_attribute_value_rel;
-- Variantes por plantilla con lista
SELECT pp.id, pp.product_tmpl_id, pp.active, pp.combination_indices FROM product_product pp
WHERE pp.product_tmpl_id IN (SELECT product_tmpl_id FROM mrp_bom) ORDER BY pp.product_tmpl_id, pp.id;
SELECT id, name->>'en_US' AS name, relative_factor, relative_uom_id, factor FROM uom_uom ORDER BY id;
SELECT id, name, usage, company_id, active FROM stock_location WHERE usage='internal' ORDER BY id;
SELECT id, name, lot_stock_id, company_id FROM stock_warehouse ORDER BY id;
SELECT id, name FROM res_company ORDER BY id;
SELECT code, count(*) FROM res_lang WHERE active GROUP BY code;
ROLLBACK;
