BEGIN;
-- Vistas de pedido sobre Food Store (base food_store, esquema public).
-- Nuevas: no reemplazan ninguna vista existente. Se crean como postgres, igual que 03_vistas_foodstore.sql.
-- estado: dominio minimo de la propuesta DEC-39 ('cancelado' en minuscula; el resto, codigo nativo).

CREATE VIEW v_pedido AS
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
WHERE p.deleted_at IS NULL;

CREATE VIEW v_item_pedido AS
SELECT
  dp.id::text                                   AS id,
  dp.pedido_id::text                            AS "pedidoId",
  dp.producto_id::text                          AS "productoId",
  dp.cantidad                                   AS cantidad,
  dp.producto_precio_unitario                   AS "precioUnitario"   -- precio congelado al comprar
FROM detalle_pedido dp
WHERE dp.deleted_at IS NULL;
SELECT count(*) AS filas_v_pedido FROM v_pedido; SELECT count(*) AS filas_v_item_pedido FROM v_item_pedido;
COMMIT;
