BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/huella_tx.txt
\i /tmp/zd/huella.sql
\o
\pset format aligned
\pset tuples_only off
UPDATE ingredient SET stock_quantity = 50 WHERE id = 3 AND stock_quantity = 60 AND deleted_at IS NULL;
-- guarda no constante: aborta si el cambio no aplico
SELECT CASE WHEN (SELECT stock_quantity FROM ingredient WHERE id = 3) = 50 THEN 'ok' ELSE (1 / (length(current_user) * 0))::text END AS guarda;
SET ROLE lector_zerodashboard;
SELECT current_user AS rol_de_la_v2;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/manual.txt
\i /tmp/zd/manual.sql
\o
\pset format aligned
\pset tuples_only off
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/v2_corrida1.txt
\i /tmp/zd/v2.sql
\o
\pset format aligned
\pset tuples_only off
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/v2_corrida2.txt
\i /tmp/zd/v2.sql
\o
\pset format aligned
\pset tuples_only off
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/v2_corrida3.txt
\i /tmp/zd/v2.sql
\o
\pset format aligned
\pset tuples_only off
RESET ROLE;
ROLLBACK;
