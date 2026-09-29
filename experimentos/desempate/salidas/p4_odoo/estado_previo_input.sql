BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;
SELECT id, bom_id, product_id, product_qty FROM mrp_bom_line WHERE id = 6;
SELECT count(*) AS quants_57_internos FROM stock_quant q JOIN stock_location l ON l.id = q.location_id WHERE q.product_id = 57 AND l.usage = 'internal';
SELECT id, usage FROM stock_location WHERE id = 5;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/huella_antes.txt
\i /tmp/zd/huella.sql
\o
ROLLBACK;
