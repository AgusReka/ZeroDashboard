-- Calculo manual de C2 sobre tablas nativas de Odoo, sin vistas.
SELECT sol.product_id::text AS producto,
       (pt.name->>'en_US') || coalesce(' (' || attr.valores || ')', '') AS nombre,
       sum(sol.product_uom_qty) AS unidades,
       sum(sol.product_uom_qty * sol.price_reduce_taxinc) AS monto
FROM sale_order_line sol
JOIN sale_order so ON so.id = sol.order_id
LEFT JOIN product_product pp ON pp.id = sol.product_id
LEFT JOIN product_template pt ON pt.id = pp.product_tmpl_id
LEFT JOIN LATERAL (
  SELECT string_agg(pav.name->>'en_US', ', ' ORDER BY ptav.id) AS valores
  FROM product_variant_combination pvc
  JOIN product_template_attribute_value ptav ON ptav.id = pvc.product_template_attribute_value_id
  JOIN product_attribute_value pav ON pav.id = ptav.product_attribute_value_id
  WHERE pvc.product_product_id = pp.id) attr ON true
WHERE sol.display_type IS NULL
  AND so.state NOT IN ('draft', 'sent', 'cancel')
  AND so.date_order >= (:'desde'::timestamptz AT TIME ZONE 'UTC')
  AND so.date_order <  (:'hasta'::timestamptz AT TIME ZONE 'UTC')
GROUP BY 1, 2;
