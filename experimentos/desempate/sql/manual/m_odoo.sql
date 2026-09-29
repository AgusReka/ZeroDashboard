-- Calculo manual de stock producible e insumo limitante sobre las tablas nativas de Odoo 19, sin vistas.
-- Parte de experimentos/odoo/sql/manual/m_stock_producible.sql (lista elegida, kit y fabricar, lineas con
-- valores de atributo descartadas, disponible en ubicaciones internas) y agrega la agregacion por producto.
-- El cociente de un componente es disp / por_unidad, con
--   por_unidad = SUM(qty * f_linea / f_comp) / (bom_qty * f_bom / f_prod).
-- Para compararlo sin dividir se lo escribe como n / d:
--   n = disp * bom_qty * f_bom * f_comp,   d = f_prod * SUM(qty * f_linea)   (factores > 0).
-- Comparacion exacta: a/b < c/e  <=>  a*e < c*b  (b, e > 0).
-- Salida: producto | stock_producible | insumo_limitante_id | empatados (ids por orden de texto) | cantidad de empatados | limitante con COLLATE "C"
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
         c.bom_qty * c.f_bom * uc.factor  AS mult_n,
         c.f_prod * SUM(l.product_qty * ul.factor) AS d
  FROM candidatas c
  JOIN mrp_bom_line l ON l.bom_id = c.bom
  JOIN uom_uom ul ON ul.id = l.product_uom_id
  JOIN product_product cp ON cp.id = l.product_id
  JOIN product_template ct ON ct.id = cp.product_tmpl_id
  JOIN uom_uom uc ON uc.id = ct.uom_id
  WHERE NOT EXISTS (SELECT 1 FROM mrp_bom_line_product_template_attribute_value_rel r WHERE r.mrp_bom_line_id = l.id)
  GROUP BY c.producto, l.product_id, c.bom_qty, c.f_bom, c.f_prod, uc.factor
),
comp AS (
  SELECT k.producto::text                    AS producto,
         k.componente::text                  AS insumo,
         COALESCE(d.disp, 0)::numeric * k.mult_n AS n,
         k.d::numeric                         AS d
  FROM consumo k
  LEFT JOIN disponible d ON d.product_id = k.componente
  WHERE k.d > 0
),
minimo AS (
  SELECT c.* FROM comp c
  WHERE NOT EXISTS (SELECT 1 FROM comp o WHERE o.producto = c.producto AND o.n * c.d < c.n * o.d)
)
SELECT producto,
       MIN(div(n, d) - CASE WHEN n < 0 AND mod(n, d) <> 0 THEN 1 ELSE 0 END) AS stock_producible,
       MIN(insumo)                                AS insumo_limitante_id,
       string_agg(insumo, ',' ORDER BY insumo)    AS empatados,
       count(*)                                   AS n_empatados,
       MIN(insumo COLLATE "C")                    AS limitante_colacion_c
FROM minimo
GROUP BY producto
ORDER BY producto;
