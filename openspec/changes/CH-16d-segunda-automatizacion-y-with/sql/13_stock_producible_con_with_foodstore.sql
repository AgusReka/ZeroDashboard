-- ============================================================
-- DEC-31: composición con WITH. Las definiciones de v_producto,
-- v_insumo y v_receta_componente se copian de 03_vistas_foodstore.sql
-- (sin CREATE VIEW ni SET search_path) y se anteponen, sin
-- tocar su texto, a 04_consulta_canonica.sql.
-- ============================================================
WITH
v_producto AS (
SELECT
  p.id::text                AS id,
  p.name                    AS nombre,
  p.stock_quantity          AS "stockDisponible",  -- declarado, crudo
  NULL::text                AS sku,                -- SIN ORIGEN en Food Store
  p.available                AS activo
FROM product p
WHERE p.deleted_at IS NULL
),
v_insumo AS (
SELECT
  i.id::text                AS id,
  i.name                    AS nombre,
  i.stock_quantity          AS "stockDisponible",
  NULL::text                AS "unidadMedida",     -- SIN ORIGEN en Food Store
  NULL::text                AS codigo              -- SIN ORIGEN en Food Store
FROM ingredient i
WHERE i.deleted_at IS NULL
),
v_receta_componente AS (
SELECT
  pi.product_id::text       AS "productoId",
  pi.ingredient_id::text    AS "insumoId",
  pi.quantity               AS "cantidadPorUnidad"
FROM product_ingredient pi
JOIN product p    ON p.id = pi.product_id  AND p.deleted_at IS NULL
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL
)
-- ============================================================
-- CONSULTA CANÓNICA: stock producible con insumo limitante.
-- Escrita UNA sola vez, contra las vistas canónicas.
-- No menciona ninguna tabla nativa de ninguna plataforma.
-- Debe correr sin modificarse sobre cualquier esquema que
-- satisfaga el contrato.
-- ============================================================
SELECT
    pr.id,
    pr.nombre,
    FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS stock_producible,
    (ARRAY_AGG(ins.nombre
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS insumo_limitante,
    (ARRAY_AGG(ins."stockDisponible"
       ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1] AS stock_insumo_limitante
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
ORDER BY stock_producible ASC;
