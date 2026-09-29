-- Calculo manual de stock producible e insumo limitante sobre las tablas nativas de Medusa, sin vistas.
-- Replica las decisiones de las vistas de CH-16: producto = variante (product_variant) de un producto
-- publicado; existencia del item = SUM(stocked_quantity - reserved_quantity), 0 si no tiene niveles;
-- cantidad por unidad = required_quantity (> 0). Sin filtros de deleted_at, igual que las vistas.
-- Comparacion exacta, sin dividir: a/b < c/e  <=>  a*e < c*b  (b, e > 0).
-- Salida: producto | stock_producible | insumo_limitante_id | empatados (ids por orden de texto) | cantidad de empatados | limitante con COLLATE "C"
WITH existencia AS (
  SELECT ii.id AS insumo, COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)::numeric AS n
  FROM inventory_item ii
  LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
  GROUP BY ii.id
),
comp AS (
  SELECT pv.id::text                     AS producto,
         e.insumo::text                  AS insumo,
         e.n                             AS n,
         pvi.required_quantity::numeric  AS d
  FROM product_variant pv
  JOIN product p                          ON p.id = pv.product_id
  JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
  JOIN existencia e                       ON e.insumo = pvi.inventory_item_id
  WHERE p.status = 'published'
    AND pvi.required_quantity > 0
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
