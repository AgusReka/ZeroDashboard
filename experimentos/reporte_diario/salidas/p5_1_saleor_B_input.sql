SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\set desde 2026-09-24
\set hasta 2026-09-25
\o /tmp/rd/outB/2026-09-24_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/outB/2026-09-24_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/outB/2026-09-24_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/outB/2026-09-24_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-23
\set hasta 2026-09-24
\o /tmp/rd/outB/2026-09-23_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/outB/2026-09-23_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/outB/2026-09-23_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/outB/2026-09-23_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
ROLLBACK;
