BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
SELECT id, bom_id, product_id, product_qty FROM mrp_bom_line WHERE id = 6;
SELECT count(*) AS quants_57_internos FROM stock_quant q JOIN stock_location l ON l.id = q.location_id WHERE q.product_id = 57 AND l.usage = 'internal';
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SET ROLE zd_odoo_lectura;
\o /tmp/zd/out/antes_canonica.txt
\i /tmp/zd/04_consulta_canonica.sql
\o
RESET ROLE;
\pset format aligned
\pset tuples_only off
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
\o /tmp/zd/out/despues_manual.txt
\i /tmp/zd/m_stock_producible.sql
SET ROLE zd_odoo_lectura;
SELECT current_user AS rol_de_la_canonica;
\o /tmp/zd/out/despues_canonica.txt
\i /tmp/zd/04_consulta_canonica.sql
\o
RESET ROLE;
ROLLBACK;
