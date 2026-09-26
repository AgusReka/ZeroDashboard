SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
SELECT state, count(*) FROM sale_order GROUP BY 1 ORDER BY 1;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SET ROLE zd_odoo_lectura;
\set desde 2026-08-22
\set hasta 2026-08-23
\o /tmp/rd/out/rollback/2026-08-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-08-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-08-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-26
\set hasta 2026-08-27
\o /tmp/rd/out/rollback/2026-08-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-08-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-08-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-29
\set hasta 2026-08-30
\o /tmp/rd/out/rollback/2026-08-29_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-08-29_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-08-29_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-05
\set hasta 2026-09-06
\o /tmp/rd/out/rollback/2026-09-05_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-05_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-05_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-12
\set hasta 2026-09-13
\o /tmp/rd/out/rollback/2026-09-12_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-12_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-12_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-19
\set hasta 2026-09-20
\o /tmp/rd/out/rollback/2026-09-19_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-19_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-19_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-20
\set hasta 2026-09-21
\o /tmp/rd/out/rollback/2026-09-20_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-20_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-20_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-21
\set hasta 2026-09-22
\o /tmp/rd/out/rollback/2026-09-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-22
\set hasta 2026-09-23
\o /tmp/rd/out/rollback/2026-09-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-23
\set hasta 2026-09-24
\o /tmp/rd/out/rollback/2026-09-23_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-23_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-23_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-24
\set hasta 2026-09-25
\o /tmp/rd/out/rollback/2026-09-24_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-24_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-24_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-25
\set hasta 2026-09-26
\o /tmp/rd/out/rollback/2026-09-25_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-25_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-25_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-26
\set hasta 2026-09-27
\o /tmp/rd/out/rollback/2026-09-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-09-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-09-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-21
\set hasta 2026-08-22
\o /tmp/rd/out/rollback/2026-08-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback/2026-08-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback/2026-08-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
RESET ROLE;
ROLLBACK;
