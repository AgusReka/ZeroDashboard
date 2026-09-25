SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, pg_backend_pid() AS pid;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/mapeo_productos.txt
\i /tmp/rd/nativas_foodstore/mapeos.sql
\o /tmp/rd/out/mapeo_estados.txt
\i /tmp/rd/nativas_foodstore/mapeo_estados.sql
\set desde 2026-08-18
\set hasta 2026-08-19
\o /tmp/rd/out/2026-08-18_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-18_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-18_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-18_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-18_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-18_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-18_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-19
\set hasta 2026-08-20
\o /tmp/rd/out/2026-08-19_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-19_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-19_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-19_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-19_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-19_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-19_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-20
\set hasta 2026-08-21
\o /tmp/rd/out/2026-08-20_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-20_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-20_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-20_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-20_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-20_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-20_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-21
\set hasta 2026-08-22
\o /tmp/rd/out/2026-08-21_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-21_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-21_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-21_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-21_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-21_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-21_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-22
\set hasta 2026-08-23
\o /tmp/rd/out/2026-08-22_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-22_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-22_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-22_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-22_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-22_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-22_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-23
\set hasta 2026-08-24
\o /tmp/rd/out/2026-08-23_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-23_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-23_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-23_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-23_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-23_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-23_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-24
\set hasta 2026-08-25
\o /tmp/rd/out/2026-08-24_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-24_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-24_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-24_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-24_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-24_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-24_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-25
\set hasta 2026-08-26
\o /tmp/rd/out/2026-08-25_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-25_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-25_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-25_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-25_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-25_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-25_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-26
\set hasta 2026-08-27
\o /tmp/rd/out/2026-08-26_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-26_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-26_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-26_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-26_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-26_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-26_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-27
\set hasta 2026-08-28
\o /tmp/rd/out/2026-08-27_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-27_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-27_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-27_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-27_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-27_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-27_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-28
\set hasta 2026-08-29
\o /tmp/rd/out/2026-08-28_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-28_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-28_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-28_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-28_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-28_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-28_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-29
\set hasta 2026-08-30
\o /tmp/rd/out/2026-08-29_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-29_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-29_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-29_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-29_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-29_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-29_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-30
\set hasta 2026-08-31
\o /tmp/rd/out/2026-08-30_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-30_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-30_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-30_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-30_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-30_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-30_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-08-31
\set hasta 2026-09-01
\o /tmp/rd/out/2026-08-31_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-08-31_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-08-31_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-08-31_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-31_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-31_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-08-31_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-01
\set hasta 2026-09-02
\o /tmp/rd/out/2026-09-01_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-01_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-01_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-01_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-01_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-01_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-01_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-02
\set hasta 2026-09-03
\o /tmp/rd/out/2026-09-02_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-02_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-02_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-02_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-02_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-02_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-02_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-03
\set hasta 2026-09-04
\o /tmp/rd/out/2026-09-03_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-03_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-03_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-03_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-03_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-03_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-03_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-04
\set hasta 2026-09-05
\o /tmp/rd/out/2026-09-04_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-04_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-04_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-04_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-04_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-04_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-04_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-05
\set hasta 2026-09-06
\o /tmp/rd/out/2026-09-05_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-05_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-05_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-05_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-05_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-05_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-05_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-06
\set hasta 2026-09-07
\o /tmp/rd/out/2026-09-06_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-06_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-06_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-06_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-06_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-06_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-06_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-07
\set hasta 2026-09-08
\o /tmp/rd/out/2026-09-07_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-07_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-07_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-07_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-07_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-07_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-07_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-08
\set hasta 2026-09-09
\o /tmp/rd/out/2026-09-08_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-08_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-08_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-08_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-08_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-08_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-08_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-09
\set hasta 2026-09-10
\o /tmp/rd/out/2026-09-09_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-09_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-09_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-09_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-09_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-09_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-09_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-10
\set hasta 2026-09-11
\o /tmp/rd/out/2026-09-10_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-10_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-10_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-10_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-10_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-10_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-10_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-11
\set hasta 2026-09-12
\o /tmp/rd/out/2026-09-11_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-11_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-11_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-11_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-11_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-11_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-11_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-12
\set hasta 2026-09-13
\o /tmp/rd/out/2026-09-12_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-12_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-12_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-12_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-12_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-12_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-12_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-13
\set hasta 2026-09-14
\o /tmp/rd/out/2026-09-13_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-13_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-13_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-13_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-13_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-13_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-13_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-14
\set hasta 2026-09-15
\o /tmp/rd/out/2026-09-14_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-14_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-14_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-14_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-14_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-14_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-14_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-15
\set hasta 2026-09-16
\o /tmp/rd/out/2026-09-15_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-15_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-15_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-15_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-15_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-15_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-15_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-16
\set hasta 2026-09-17
\o /tmp/rd/out/2026-09-16_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-16_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-16_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-16_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-16_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-16_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-16_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\set desde 2026-09-17
\set hasta 2026-09-18
\o /tmp/rd/out/2026-09-17_n1_ventas.txt
\i /tmp/rd/nativas_foodstore/n1_ventas.sql
\o /tmp/rd/out/2026-09-17_n2_ranking.txt
\i /tmp/rd/nativas_foodstore/n2_ranking.sql
\o /tmp/rd/out/2026-09-17_n3_estados.txt
\i /tmp/rd/nativas_foodstore/n3_estados.sql
\o /tmp/rd/out/2026-09-17_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-17_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-17_c2_ranking_top5.txt
\i /tmp/rd/c2_ranking_top5.sql
\o /tmp/rd/out/2026-09-17_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
ROLLBACK;
