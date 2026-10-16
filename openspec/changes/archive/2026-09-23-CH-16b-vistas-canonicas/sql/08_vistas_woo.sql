SET search_path TO woo;
-- v_producto SÍ se puede escribir, pero exige pivotar el modelo
-- clave-valor a columnas: un LEFT JOIN por cada campo canónico.
CREATE OR REPLACE VIEW v_producto AS
SELECT
  p.ID::text                                  AS id,
  p.post_title                                AS nombre,
  COALESCE(m_stock.meta_value::numeric, 0)::int AS "stockDisponible",
  m_sku.meta_value                            AS sku,
  (p.post_status = 'publish')                 AS activo
FROM wp_posts p
LEFT JOIN wp_postmeta m_stock ON m_stock.post_id = p.ID AND m_stock.meta_key = '_stock'
LEFT JOIN wp_postmeta m_sku   ON m_sku.post_id   = p.ID AND m_sku.meta_key   = '_sku'
WHERE p.post_type IN ('product','product_variation');
