-- Paso 7: definiciones de las vistas de Food Store como WITH, seguidas del texto canonico sin modificar.
WITH
v_pedido AS (
SELECT
  p.id::text                                    AS id,
  p.created_at                                  AS "fechaCreacion",   -- timestamp without time zone
  CASE WHEN ep.codigo = 'CANCELADO' THEN 'cancelado'
       ELSE ep.codigo::text END                 AS estado,
  p.total                                       AS total,             -- persistido; incluye costo_envio
  NULL::integer                                 AS numero,            -- SIN ORIGEN: no hay numero distinto del id
  NULL::text                                    AS moneda             -- SIN ORIGEN: tienda de una sola moneda
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
)
,
v_item_pedido AS (
SELECT
  dp.id::text                                   AS id,
  dp.pedido_id::text                            AS "pedidoId",
  dp.producto_id::text                          AS "productoId",
  dp.cantidad                                   AS cantidad,
  dp.producto_precio_unitario                   AS "precioUnitario"   -- precio congelado al comprar
FROM detalle_pedido dp
WHERE dp.deleted_at IS NULL
)
,
v_producto AS (
SELECT
  p.id::text                AS id,
  p.name                    AS nombre,
  p.stock_quantity          AS "stockDisponible",  -- declarado, crudo
  NULL::text                AS sku,                -- SIN ORIGEN en Food Store
  p.available                AS activo
FROM product p
WHERE p.deleted_at IS NULL
)
-- C2. Productos mas vendidos (Anexo C, 4.2) sobre el contrato canonico, sin LIMIT.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    i."productoId",
    pr.nombre,
    SUM(i.cantidad) AS unidades_vendidas,
    COALESCE(SUM(i.cantidad * i."precioUnitario"), 0) AS total_generado
FROM v_item_pedido i
JOIN v_pedido p ON p.id = i."pedidoId"
LEFT JOIN v_producto pr ON pr.id = i."productoId"
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY i."productoId", pr.nombre
ORDER BY unidades_vendidas DESC, i."productoId";
