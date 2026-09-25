SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona;
SELECT min(created_at), max(created_at) FROM order_order;
SELECT currency, status, count(*) AS pedidos, sum(total_gross_amount) AS total_bruto FROM order_order GROUP BY 1,2 ORDER BY 1,2;
SELECT c.slug, c.currency_code, count(o.*) AS pedidos FROM order_order o JOIN channel_channel c ON c.id = o.channel_id GROUP BY 1,2;
SELECT count(*) AS lineas, count(*) FILTER (WHERE variant_id IS NULL) AS lineas_sin_variante,
       count(DISTINCT variant_id) AS variantes_distintas,
       count(*) FILTER (WHERE currency <> (SELECT o.currency FROM order_order o WHERE o.id = ol.order_id)) AS lineas_moneda_distinta
FROM order_orderline ol;
SELECT count(*) FILTER (WHERE unit_discount_amount <> 0) AS lineas_con_descuento,
       count(*) FILTER (WHERE unit_price_gross_amount <> unit_price_net_amount) AS lineas_con_impuesto,
       count(*) FILTER (WHERE total_price_gross_amount <> quantity * unit_price_gross_amount) AS lineas_total_distinto_q_por_p
FROM order_orderline;
-- total del pedido vs suma de lineas + envio
SELECT count(*) AS pedidos,
       count(*) FILTER (WHERE o.total_gross_amount <> s.lineas + o.shipping_price_gross_amount) AS total_distinto_lineas_mas_envio,
       count(*) FILTER (WHERE o.shipping_price_gross_amount <> 0) AS con_envio
FROM order_order o
JOIN (SELECT order_id, sum(quantity * unit_price_gross_amount) AS lineas FROM order_orderline GROUP BY 1) s ON s.order_id = o.id;
SELECT count(*) AS pedidos_sin_lineas FROM order_order o WHERE NOT EXISTS (SELECT 1 FROM order_orderline ol WHERE ol.order_id = o.id);
-- lineas cuya variante no esta en v_producto
SELECT count(*) AS lineas_variante_fuera_de_v_producto FROM order_orderline ol WHERE ol.variant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_productvariant pv WHERE pv.id = ol.variant_id);
ROLLBACK;
