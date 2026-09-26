-- Calculo manual de C1 sobre tablas nativas de Odoo, sin vistas.
-- date_order se guarda en UTC sin zona: se llevan los limites del rango a UTC (no la columna).
SELECT count(*)                                   AS cantidad_pedidos,
       coalesce(sum(so.amount_total), 0)          AS facturacion_total,
       coalesce(round(avg(so.amount_total), 2), 0) AS ticket_promedio
FROM sale_order so
WHERE so.state NOT IN ('draft', 'sent', 'cancel')
  AND so.date_order >= (:'desde'::timestamptz AT TIME ZONE 'UTC')
  AND so.date_order <  (:'hasta'::timestamptz AT TIME ZONE 'UTC');
