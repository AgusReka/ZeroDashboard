BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
UPDATE mrp_bom_line SET product_qty = 12 WHERE id = 6 AND product_qty = 4;
INSERT INTO stock_quant (product_id, location_id, company_id, quantity, reserved_quantity, in_date)
VALUES (57, 5, 1, 7, 0, now() AT TIME ZONE 'UTC');
-- guarda no constante: aborta si alguno de los dos cambios no aplico
SELECT CASE WHEN (SELECT product_qty FROM mrp_bom_line WHERE id = 6) = 12
             AND (SELECT sum(quantity - reserved_quantity) FROM stock_quant q JOIN stock_location l ON l.id = q.location_id
                  WHERE q.product_id = 57 AND l.usage = 'internal') = 7
            THEN 'ok' ELSE (1 / (length(current_user) * 0))::text END AS guarda;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/manual.txt
\i /tmp/zd/manual.sql
\o
\pset format aligned
\pset tuples_only off
SET ROLE zd_odoo_lectura;
SELECT current_user AS rol_de_la_v2;
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
