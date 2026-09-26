#!/usr/bin/env bash
# Paso 3.4: modificacion controlada de stock producible (regla 4.1; valores en ESPERADO_P3_4.md).
# Una transaccion terminada en ROLLBACK. La canonica corre dentro con SET ROLE zd_odoo_lectura, para
# ejecutarse con los privilegios del rol de solo lectura y ver los cambios no confirmados.
# Despues, verificacion desde una sesion nueva.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
source .env
CANON=../../openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql
sha256sum $CANON > salidas/p3_4_hash.txt
C=$(docker compose ps -q db)
docker exec $C rm -rf /tmp/zd && docker exec $C mkdir -p /tmp/zd/out && docker exec $C chmod -R 777 /tmp/zd
docker cp $CANON $C:/tmp/zd/04_consulta_canonica.sql
docker cp sql/manual/m_stock_producible.sql $C:/tmp/zd/
docker exec $C sha256sum /tmp/zd/04_consulta_canonica.sql >> salidas/p3_4_hash.txt
cat > salidas/p3_4_modificacion_input.sql <<'SQL'
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
SQL
cat > salidas/p3_4_verificacion_input.sql <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
SELECT id, bom_id, product_id, product_qty FROM mrp_bom_line WHERE id = 6;
SELECT count(*) AS quants_57_internos FROM stock_quant q JOIN stock_location l ON l.id = q.location_id WHERE q.product_id = 57 AND l.usage = 'internal';
SELECT count(*) AS quants_totales, max(id) AS max_id FROM stock_quant;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SET ROLE zd_odoo_lectura;
\o /tmp/zd/out/rollback_canonica.txt
\i /tmp/zd/04_consulta_canonica.sql
\o
RESET ROLE;
ROLLBACK;
SQL
{ date -Iseconds; docker exec -i $C psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e < salidas/p3_4_modificacion_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p3_4_modificacion_output.txt 2>&1
{ date -Iseconds; docker exec -i $C psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e < salidas/p3_4_verificacion_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p3_4_verificacion_output.txt 2>&1
rm -rf salidas/p3_4_stock && mkdir -p salidas/p3_4_stock && docker cp $C:/tmp/zd/out/. salidas/p3_4_stock/
