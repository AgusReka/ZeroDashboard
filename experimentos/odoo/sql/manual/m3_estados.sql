-- Calculo manual de C3 sobre tablas nativas de Odoo, sin vistas.
SELECT CASE so.state WHEN 'cancel' THEN 'cancelado' ELSE so.state END AS estado,
       count(*) AS cantidad
FROM sale_order so
WHERE so.state NOT IN ('draft', 'sent')
  AND so.date_order >= (:'desde'::timestamptz AT TIME ZONE 'UTC')
  AND so.date_order <  (:'hasta'::timestamptz AT TIME ZONE 'UTC')
GROUP BY 1;
