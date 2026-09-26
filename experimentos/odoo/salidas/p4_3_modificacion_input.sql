SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;
SELECT "fechaCreacion"::date AS sel_dia, ("fechaCreacion"::date + 1) AS sel_hasta, count(*) AS sel_no_cancelados
FROM v_pedido WHERE estado <> 'cancelado' GROUP BY 1, 2 ORDER BY 3 DESC, 1 LIMIT 1 \gset
SELECT so.id AS sel_id, so.name AS sel_name, so.state AS sel_state FROM sale_order so
WHERE so.state NOT IN ('draft', 'sent', 'cancel')
  AND so.date_order >= (:'sel_dia'::timestamptz AT TIME ZONE 'UTC')
  AND so.date_order <  (:'sel_hasta'::timestamptz AT TIME ZONE 'UTC')
ORDER BY so.id LIMIT 1 \gset
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/seleccion.txt
SELECT :'sel_dia', :'sel_no_cancelados', :'sel_id', :'sel_name', :'sel_state';
\o /tmp/rd/out/pedido.txt
SELECT so.id, so.name, so.state, so.amount_total, c.name FROM sale_order so JOIN res_currency c ON c.id = so.currency_id WHERE so.id = :sel_id;
\o /tmp/rd/out/lineas.txt
SELECT sol.product_id::text, sol.product_uom_qty, sol.price_reduce_taxinc FROM sale_order_line sol
WHERE sol.order_id = :sel_id AND sol.display_type IS NULL ORDER BY sol.id;
\o
SET ROLE zd_odoo_lectura;
\set desde 2026-08-22
\set hasta 2026-08-23
\o /tmp/rd/out/antes/2026-08-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-08-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-08-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-26
\set hasta 2026-08-27
\o /tmp/rd/out/antes/2026-08-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-08-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-08-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-29
\set hasta 2026-08-30
\o /tmp/rd/out/antes/2026-08-29_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-08-29_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-08-29_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-05
\set hasta 2026-09-06
\o /tmp/rd/out/antes/2026-09-05_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-05_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-05_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-12
\set hasta 2026-09-13
\o /tmp/rd/out/antes/2026-09-12_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-12_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-12_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-19
\set hasta 2026-09-20
\o /tmp/rd/out/antes/2026-09-19_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-19_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-19_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-20
\set hasta 2026-09-21
\o /tmp/rd/out/antes/2026-09-20_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-20_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-20_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-21
\set hasta 2026-09-22
\o /tmp/rd/out/antes/2026-09-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-22
\set hasta 2026-09-23
\o /tmp/rd/out/antes/2026-09-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-23
\set hasta 2026-09-24
\o /tmp/rd/out/antes/2026-09-23_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-23_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-23_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-24
\set hasta 2026-09-25
\o /tmp/rd/out/antes/2026-09-24_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-24_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-24_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-25
\set hasta 2026-09-26
\o /tmp/rd/out/antes/2026-09-25_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-25_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-25_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-26
\set hasta 2026-09-27
\o /tmp/rd/out/antes/2026-09-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-09-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-09-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-21
\set hasta 2026-08-22
\o /tmp/rd/out/antes/2026-08-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes/2026-08-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes/2026-08-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
RESET ROLE;
\pset format aligned
\pset tuples_only off
UPDATE sale_order SET state = 'cancel' WHERE id = :sel_id AND state = :'sel_state';
-- guarda no constante: corta la transaccion si el UPDATE no aplico
SELECT CASE WHEN so.state = 'cancel' THEN 'ok' ELSE (1 / (length(so.state) * 0))::text END AS guarda
FROM sale_order so WHERE so.id = :sel_id;
\pset format unaligned
\pset tuples_only on
SET ROLE zd_odoo_lectura;
\set desde 2026-08-22
\set hasta 2026-08-23
\o /tmp/rd/out/despues/2026-08-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-08-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-08-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-26
\set hasta 2026-08-27
\o /tmp/rd/out/despues/2026-08-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-08-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-08-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-29
\set hasta 2026-08-30
\o /tmp/rd/out/despues/2026-08-29_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-08-29_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-08-29_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-05
\set hasta 2026-09-06
\o /tmp/rd/out/despues/2026-09-05_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-05_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-05_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-12
\set hasta 2026-09-13
\o /tmp/rd/out/despues/2026-09-12_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-12_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-12_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-19
\set hasta 2026-09-20
\o /tmp/rd/out/despues/2026-09-19_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-19_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-19_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-20
\set hasta 2026-09-21
\o /tmp/rd/out/despues/2026-09-20_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-20_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-20_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-21
\set hasta 2026-09-22
\o /tmp/rd/out/despues/2026-09-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-22
\set hasta 2026-09-23
\o /tmp/rd/out/despues/2026-09-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-23
\set hasta 2026-09-24
\o /tmp/rd/out/despues/2026-09-23_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-23_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-23_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-24
\set hasta 2026-09-25
\o /tmp/rd/out/despues/2026-09-24_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-24_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-24_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-25
\set hasta 2026-09-26
\o /tmp/rd/out/despues/2026-09-25_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-25_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-25_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-26
\set hasta 2026-09-27
\o /tmp/rd/out/despues/2026-09-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-09-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-09-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-21
\set hasta 2026-08-22
\o /tmp/rd/out/despues/2026-08-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues/2026-08-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues/2026-08-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
RESET ROLE;
ROLLBACK;
