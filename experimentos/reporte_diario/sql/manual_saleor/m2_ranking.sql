-- Calculo manual de C2 sobre tablas nativas de Saleor, sin vistas.
SELECT ol.variant_id::text                                                   AS producto,
       CASE WHEN pv.name IS NULL OR pv.name = '' THEN pp.name
            ELSE pp.name || ' - ' || pv.name END                           AS nombre,
       sum(ol.quantity)                                                      AS unidades,
       sum(ol.quantity * ol.unit_price_gross_amount)                         AS monto
FROM order_orderline ol
JOIN order_order o ON o.id = ol.order_id
LEFT JOIN product_productvariant pv ON pv.id = ol.variant_id
LEFT JOIN product_product pp ON pp.id = pv.product_id
WHERE o.status NOT IN ('draft', 'canceled')
  AND o.created_at >= :'desde' AND o.created_at < :'hasta'
GROUP BY 1, 2;
