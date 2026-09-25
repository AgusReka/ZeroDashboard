-- Calculo manual de C1 sobre tablas nativas de Saleor, sin vistas.
SELECT count(*)                                        AS cantidad_pedidos,
       coalesce(sum(o.total_gross_amount), 0)          AS facturacion_total,
       coalesce(round(avg(o.total_gross_amount), 2), 0) AS ticket_promedio
FROM order_order o
WHERE o.status NOT IN ('draft', 'canceled')
  AND o.created_at >= :'desde' AND o.created_at < :'hasta';
