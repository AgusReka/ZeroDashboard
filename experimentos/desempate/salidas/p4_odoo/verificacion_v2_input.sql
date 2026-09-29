BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/v2_rollback.txt
\i /tmp/zd/v2.sql
\o
\pset format aligned
\pset tuples_only off
ROLLBACK;
