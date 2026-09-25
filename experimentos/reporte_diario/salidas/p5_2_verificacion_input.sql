SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
\set desde 2026-09-24
\set hasta 2026-09-25
SELECT o.number, o.status FROM order_order o WHERE o.status = 'canceled' OR o.number = (SELECT min(number) FROM order_order WHERE created_at >= :'desde' AND created_at < :'hasta');
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/rollback_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
ROLLBACK;
