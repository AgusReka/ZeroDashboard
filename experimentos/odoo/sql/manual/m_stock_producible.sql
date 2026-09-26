-- Calculo manual de stock producible sobre tablas nativas de Odoo 19, sin vistas.
-- Una fila por (producto, componente) con su cociente; la agregacion final la hace m_stock_producible_resumen.
-- Replica las decisiones de significado de las vistas (lista elegida, kit y fabricar, unidades, disponible).
WITH candidatas AS (
  SELECT DISTINCT ON (pp.id) pp.id AS producto, b.id AS bom, b.product_qty AS bom_qty,
         ub.factor AS f_bom, up.factor AS f_prod
  FROM product_product pp
  JOIN product_template pt ON pt.id = pp.product_tmpl_id
  JOIN uom_uom up ON up.id = pt.uom_id
  JOIN mrp_bom b ON b.active AND b.type IN ('normal','phantom')
               AND (b.product_id = pp.id OR (b.product_id IS NULL AND b.product_tmpl_id = pt.id))
  JOIN uom_uom ub ON ub.id = b.product_uom_id
  WHERE pp.active AND pt.active AND pt.type <> 'service'
  ORDER BY pp.id, b.sequence, b.product_id IS NULL, b.id
),
disponible AS (
  SELECT q.product_id, SUM(q.quantity) - SUM(q.reserved_quantity) AS disp
  FROM stock_quant q
  WHERE q.location_id IN (SELECT id FROM stock_location WHERE usage = 'internal')
  GROUP BY q.product_id
),
consumo AS (
  SELECT c.producto, l.product_id AS componente,
         SUM(l.product_qty * ul.factor / uc.factor) / (c.bom_qty * c.f_bom / c.f_prod) AS por_unidad
  FROM candidatas c
  JOIN mrp_bom_line l ON l.bom_id = c.bom
  JOIN uom_uom ul ON ul.id = l.product_uom_id
  JOIN product_product cp ON cp.id = l.product_id
  JOIN product_template ct ON ct.id = cp.product_tmpl_id
  JOIN uom_uom uc ON uc.id = ct.uom_id
  WHERE NOT EXISTS (SELECT 1 FROM mrp_bom_line_product_template_attribute_value_rel r WHERE r.mrp_bom_line_id = l.id)
  GROUP BY c.producto, l.product_id, c.bom_qty, c.f_bom, c.f_prod
)
SELECT k.producto::text AS producto,
       ct.name->>'en_US' AS componente_nombre,
       k.componente::text AS componente_id,
       COALESCE(d.disp, 0) AS disponible,
       k.por_unidad,
       COALESCE(d.disp, 0) / k.por_unidad AS cociente
FROM consumo k
JOIN product_product cp ON cp.id = k.componente
JOIN product_template ct ON ct.id = cp.product_tmpl_id
LEFT JOIN disponible d ON d.product_id = k.componente
WHERE k.por_unidad > 0
ORDER BY 1, 6, 3;
