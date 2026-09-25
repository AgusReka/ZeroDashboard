#!/usr/bin/env bash
# Paso 5.2: modificacion controlada en Saleor. Una transaccion (lectura y escritura) terminada en ROLLBACK,
# y una verificacion en sesion nueva. Pedido elegido por regla fija: el de menor number entre los no
# cancelados ni borradores del 2026-09-24.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
C=saleor-platform-db-1
RES=salidas/p5_2_saleor
docker exec $C rm -rf /tmp/rd && docker exec $C mkdir -p /tmp/rd/out && docker exec $C chmod 777 /tmp/rd/out
docker cp sql/. $C:/tmp/rd/
cat > salidas/p5_2_modificacion_input.sql <<'SQL'
SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;
\set desde 2026-09-24
\set hasta 2026-09-25
SELECT o.id AS sel_id, o.number AS sel_number, o.status AS sel_status
FROM order_order o
WHERE o.status NOT IN ('draft', 'canceled')
  AND o.created_at >= :'desde' AND o.created_at < :'hasta'
ORDER BY o.number
LIMIT 1 \gset
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/antes_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/antes_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/antes_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o /tmp/rd/out/pedido.txt
SELECT o.id, o.number, o.status, o.total_gross_amount, o.currency FROM order_order o WHERE o.id = :'sel_id';
\o /tmp/rd/out/lineas.txt
SELECT ol.variant_id::text, ol.quantity, ol.unit_price_gross_amount FROM order_orderline ol WHERE ol.order_id = :'sel_id' ORDER BY 1;
\o
UPDATE order_order SET status = 'canceled' WHERE id = :'sel_id' AND status = :'sel_status';
-- guarda no constante (leccion I-2 de CH-16d): corta la transaccion si el UPDATE no aplico
SELECT CASE WHEN o.status = 'canceled' THEN 'ok' ELSE (1 / (length(o.status) * 0))::text END AS guarda
FROM order_order o WHERE o.id = :'sel_id';
\o /tmp/rd/out/despues_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/despues_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/despues_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
ROLLBACK;
SQL
cat > salidas/p5_2_verificacion_input.sql <<'SQL'
SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
\set desde 2026-09-24
\set hasta 2026-09-25
SELECT o.number, o.status FROM order_order o WHERE o.status = 'canceled' OR o.number = (SELECT min(number) FROM order_order WHERE created_at >= :'desde' AND created_at < :'hasta');
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/rollback_c1_ventas.txt
\i /tmp/rd/c1_ventas.sql
\o /tmp/rd/out/rollback_c2_ranking.txt
\i /tmp/rd/c2_ranking.sql
\o /tmp/rd/out/rollback_c3_estados.txt
\i /tmp/rd/c3_estados.sql
\o
ROLLBACK;
SQL
{ date -Iseconds; docker exec -i $C psql -U saleor -d saleor -v ON_ERROR_STOP=1 -e < salidas/p5_2_modificacion_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p5_2_modificacion_output.txt 2>&1
{ date -Iseconds; docker exec -i $C psql -U saleor -d saleor -v ON_ERROR_STOP=1 -e < salidas/p5_2_verificacion_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p5_2_verificacion_output.txt 2>&1
rm -rf $RES && mkdir -p $RES && docker cp $C:/tmp/rd/out/. $RES/
