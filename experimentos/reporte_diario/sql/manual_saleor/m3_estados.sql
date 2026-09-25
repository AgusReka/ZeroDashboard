-- Calculo manual de C3 sobre tablas nativas de Saleor, sin vistas.
SELECT CASE o.status WHEN 'canceled' THEN 'cancelado' ELSE o.status END AS estado,
       count(*) AS cantidad
FROM order_order o
WHERE o.status <> 'draft'
  AND o.created_at >= :'desde' AND o.created_at < :'hasta'
GROUP BY 1;
