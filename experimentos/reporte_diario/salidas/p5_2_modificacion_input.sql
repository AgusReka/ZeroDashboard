SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;
\set desde 2026-09-24
\set hasta 2026-09-25
SELECT o.id AS sel_id, o.number AS sel_number, o.status AS sel_status
FROM order_order o
WHERE o.status NOT IN ('draft', 'canceled')
  AND o.created_at >= :'desde' AND o.created_at < :'hasta'
ORDER BY o.number
LIMIT 1 \gset
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/antes_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/pedido.txt
SELECT o.id, o.number, o.status, o.total_gross_amount, o.currency FROM order_order o WHERE o.id = :'sel_id';
\o /tmp/rd/out/lineas.txt
SELECT ol.variant_id::text, ol.quantity, ol.unit_price_gross_amount FROM order_orderline ol WHERE ol.order_id = :'sel_id' ORDER BY 1;
\o
UPDATE order_order SET status = 'canceled' WHERE id = :'sel_id' AND status = :'sel_status';
-- guarda no constante (leccion I-2 de CH-16d): corta la transaccion si el UPDATE no aplico
SELECT CASE WHEN o.status = 'canceled' THEN 'ok' ELSE (1 / (length(o.status) * 0))::text END AS guarda
FROM order_order o WHERE o.id = :'sel_id';
\o /tmp/rd/out/despues_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
ROLLBACK;
