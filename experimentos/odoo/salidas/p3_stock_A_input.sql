BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/outA/manual.txt
\i /tmp/zd/m_stock_producible.sql
\o /tmp/zd/outA/canonica.txt
\i /tmp/zd/04_consulta_canonica.sql
\o
ROLLBACK;
