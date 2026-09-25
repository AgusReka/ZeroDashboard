SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona;
SELECT count(*) AS pedidos_total, count(*) FILTER (WHERE status <> 'draft') AS pedidos_no_borrador FROM order_order;
SELECT (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia,
       count(*) FILTER (WHERE status <> 'draft') AS no_borrador,
       count(*) AS total
FROM order_order GROUP BY 1 ORDER BY 1;
SELECT status, count(*) FROM order_order GROUP BY 1 ORDER BY 1;
ROLLBACK;
