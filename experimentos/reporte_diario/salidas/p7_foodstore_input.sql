SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, pg_backend_pid() AS pid;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\set desde 2026-08-18
\set hasta 2026-08-19
\o /tmp/rd/out/2026-08-18_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-18_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-18_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-18_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-18_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-18_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-19
\set hasta 2026-08-20
\o /tmp/rd/out/2026-08-19_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-19_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-19_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-19_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-19_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-19_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-20
\set hasta 2026-08-21
\o /tmp/rd/out/2026-08-20_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-20_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-20_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-20_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-20_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-20_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-21
\set hasta 2026-08-22
\o /tmp/rd/out/2026-08-21_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-21_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-21_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-21_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-21_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-21_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-22
\set hasta 2026-08-23
\o /tmp/rd/out/2026-08-22_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-22_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-22_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-22_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-22_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-22_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-23
\set hasta 2026-08-24
\o /tmp/rd/out/2026-08-23_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-23_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-23_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-23_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-23_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-23_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-24
\set hasta 2026-08-25
\o /tmp/rd/out/2026-08-24_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-24_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-24_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-24_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-24_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-24_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-25
\set hasta 2026-08-26
\o /tmp/rd/out/2026-08-25_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-25_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-25_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-25_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-25_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-25_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-26
\set hasta 2026-08-27
\o /tmp/rd/out/2026-08-26_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-26_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-26_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-26_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-26_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-26_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-27
\set hasta 2026-08-28
\o /tmp/rd/out/2026-08-27_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-27_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-27_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-27_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-27_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-27_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-28
\set hasta 2026-08-29
\o /tmp/rd/out/2026-08-28_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-28_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-28_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-28_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-28_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-28_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-29
\set hasta 2026-08-30
\o /tmp/rd/out/2026-08-29_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-29_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-29_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-29_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-29_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-29_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-30
\set hasta 2026-08-31
\o /tmp/rd/out/2026-08-30_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-30_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-30_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-30_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-30_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-30_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-08-31
\set hasta 2026-09-01
\o /tmp/rd/out/2026-08-31_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-08-31_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-08-31_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-08-31_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-08-31_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-08-31_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-01
\set hasta 2026-09-02
\o /tmp/rd/out/2026-09-01_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-01_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-01_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-01_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-01_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-01_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-02
\set hasta 2026-09-03
\o /tmp/rd/out/2026-09-02_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-02_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-02_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-02_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-02_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-02_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-03
\set hasta 2026-09-04
\o /tmp/rd/out/2026-09-03_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-03_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-03_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-03_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-03_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-03_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-04
\set hasta 2026-09-05
\o /tmp/rd/out/2026-09-04_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-04_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-04_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-04_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-04_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-04_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-05
\set hasta 2026-09-06
\o /tmp/rd/out/2026-09-05_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-05_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-05_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-05_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-05_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-05_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-06
\set hasta 2026-09-07
\o /tmp/rd/out/2026-09-06_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-06_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-06_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-06_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-06_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-06_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-07
\set hasta 2026-09-08
\o /tmp/rd/out/2026-09-07_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-07_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-07_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-07_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-07_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-07_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-08
\set hasta 2026-09-09
\o /tmp/rd/out/2026-09-08_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-08_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-08_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-08_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-08_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-08_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-09
\set hasta 2026-09-10
\o /tmp/rd/out/2026-09-09_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-09_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-09_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-09_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-09_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-09_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-10
\set hasta 2026-09-11
\o /tmp/rd/out/2026-09-10_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-10_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-10_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-10_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-10_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-10_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-11
\set hasta 2026-09-12
\o /tmp/rd/out/2026-09-11_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-11_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-11_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-11_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-11_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-11_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-12
\set hasta 2026-09-13
\o /tmp/rd/out/2026-09-12_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-12_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-12_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-12_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-12_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-12_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-13
\set hasta 2026-09-14
\o /tmp/rd/out/2026-09-13_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-13_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-13_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-13_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-13_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-13_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-14
\set hasta 2026-09-15
\o /tmp/rd/out/2026-09-14_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-14_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-14_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-14_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-14_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-14_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-15
\set hasta 2026-09-16
\o /tmp/rd/out/2026-09-15_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-15_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-15_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-15_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-15_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-15_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-16
\set hasta 2026-09-17
\o /tmp/rd/out/2026-09-16_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-16_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-16_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-16_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-16_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-16_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\set desde 2026-09-17
\set hasta 2026-09-18
\o /tmp/rd/out/2026-09-17_v_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/2026-09-17_w_c1_ventas.txt
\i /tmp/rd/with_foodstore/w_c1_ventas.sql
\o /tmp/rd/out/2026-09-17_v_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/2026-09-17_w_c2_ranking.txt
\i /tmp/rd/with_foodstore/w_c2_ranking.sql
\o /tmp/rd/out/2026-09-17_v_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/2026-09-17_w_c3_estados.txt
\i /tmp/rd/with_foodstore/w_c3_estados.sql
\o
ROLLBACK;
