-- Vistas de pedido sobre Saleor 3.23 (base saleor, esquema public).
-- Nuevas: no reemplazan v_producto. Se crean con zd_ch16c_creador (los dos actores de 6.7.1),
-- despues de que saleor le otorgue SELECT sobre order_order y order_orderline.
-- estado: dominio minimo de la propuesta DEC-39 ('cancelado' en minuscula; el resto, status nativo).
-- productoId apunta a la variante, igual que v_producto.id (DEC-38 / DEC-27).

CREATE VIEW v_pedido AS
SELECT
  o.id::text                                    AS id,
  o.created_at                                  AS "fechaCreacion",   -- timestamp with time zone
  CASE WHEN o.status = 'canceled' THEN 'cancelado'
       ELSE o.status::text END                  AS estado,
  o.total_gross_amount                          AS total,             -- bruto: con impuestos y envio, neto de descuentos
  o.number                                      AS numero,
  o.currency::text                              AS moneda
FROM order_order o
WHERE o.status <> 'draft';                                            -- un borrador no es un pedido realizado

CREATE VIEW v_item_pedido AS
SELECT
  ol.id::text                                   AS id,
  ol.order_id::text                             AS "pedidoId",
  ol.variant_id::text                           AS "productoId",      -- NULL si la variante se borro (ON DELETE SET NULL)
  ol.quantity                                   AS cantidad,
  ol.unit_price_gross_amount                    AS "precioUnitario"   -- bruto: con impuestos, neto de descuentos
FROM order_orderline ol;
