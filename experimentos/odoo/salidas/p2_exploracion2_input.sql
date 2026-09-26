SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor;
SELECT count(*) AS variantes, count(*) FILTER (WHERE pp.active AND pt.active) AS activas,
       count(*) FILTER (WHERE pt.sale_ok) AS sale_ok, count(*) FILTER (WHERE pt.is_published) AS publicadas,
       count(*) FILTER (WHERE pt.type='service') AS servicios, count(*) FILTER (WHERE pt.type='combo') AS combos
FROM product_product pp JOIN product_template pt ON pt.id = pp.product_tmpl_id;
SELECT count(*) AS variantes_con_atributos FROM (SELECT DISTINCT product_product_id FROM product_variant_combination) x;
SELECT pp.id, pp.active, pt.active AS t_act, pt.sale_ok, pt.is_published, pt.type FROM product_product pp JOIN product_template pt ON pt.id=pp.product_tmpl_id
WHERE pp.id IN (8,39,54,55,62,63,64,31,32,33,55,56,57,58,59,60,61,65,66) ORDER BY pp.id;
-- lineas de pedido
SELECT sol.display_type, sol.is_delivery, sol.is_downpayment, count(*),
       count(*) FILTER (WHERE sol.product_id IS NULL) AS sin_producto,
       count(*) FILTER (WHERE sol.product_uom_id <> pt.uom_id) AS uom_distinta,
       count(*) FILTER (WHERE sol.discount <> 0) AS con_descuento,
       count(*) FILTER (WHERE sol.combo_item_id IS NOT NULL OR sol.linked_line_id IS NOT NULL) AS combo_o_ligada
FROM sale_order_line sol LEFT JOIN product_product pp ON pp.id = sol.product_id LEFT JOIN product_template pt ON pt.id = pp.product_tmpl_id
GROUP BY 1,2,3;
SELECT c.name, so.state, count(*) FROM sale_order so JOIN res_currency c ON c.id = so.currency_id GROUP BY 1,2 ORDER BY 1,2;
SELECT count(*) FILTER (WHERE abs(so.amount_total - s.t) > 0.001) AS total_no_cuadra_con_lineas FROM sale_order so
JOIN (SELECT order_id, sum(price_total) t FROM sale_order_line GROUP BY 1) s ON s.order_id = so.id;
SELECT so.company_id, count(*) FROM sale_order so GROUP BY 1;
ROLLBACK;
