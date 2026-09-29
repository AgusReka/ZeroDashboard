-- Calculo manual de stock producible e insumo limitante sobre las tablas nativas de Food Store, sin vistas.
-- Replica los filtros de las vistas de CH-16b (deleted_at IS NULL) y de la consulta (available = true, quantity > 0).
-- Cociente de cada componente = n / d, con n = existencia y d = cantidad por unidad (d > 0).
-- Comparacion exacta, sin dividir: a/b < c/e  <=>  a*e < c*b  (b, e > 0).
-- Salida: producto | stock_producible | insumo_limitante_id | empatados (ids por orden de texto) | cantidad de empatados | limitante con COLLATE "C"
WITH comp AS (
  SELECT p.id::text               AS producto,
         i.id::text               AS insumo,
         i.stock_quantity::numeric AS n,
         pi.quantity::numeric      AS d
  FROM product p
  JOIN product_ingredient pi ON pi.product_id = p.id
  JOIN ingredient i          ON i.id = pi.ingredient_id
  WHERE p.deleted_at IS NULL AND i.deleted_at IS NULL
    AND p.available = true
    AND pi.quantity > 0
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
