#!/usr/bin/env bash
# Paso 4.3: modificacion controlada del reporte diario (regla 4.2 del preregistro).
# Dia: el de mas pedidos no cancelados en v_pedido (empate: el mas antiguo). Pedido: menor sale_order.id
# no cancelado de ese dia. Una transaccion terminada en ROLLBACK; las canonicas corren dentro con
# SET ROLE zd_odoo_lectura, para todos los dias del paso 4 (antes y despues). Luego verificacion en sesion nueva.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
RD=../reporte_diario/sql
C=$(docker compose ps -q db)
DIAS=$(cat salidas/p4_dias.txt)
docker exec $C rm -rf /tmp/rd && docker exec $C mkdir -p /tmp/rd/out && docker exec $C chmod -R 777 /tmp/rd
for f in c1_ventas c2_ranking c3_estados; do docker cp $RD/$f.sql $C:/tmp/rd/; done
docker exec $C sh -c 'cd /tmp/rd && sha256sum c1_ventas.sql c2_ranking.sql c3_estados.sql' > salidas/p4_3_hash.txt

canonicas() { # $1 = prefijo de salida; corre C1-C3 para cada dia con el rol de solo lectura
  echo "SET ROLE zd_odoo_lectura;"
  for d in $DIAS; do
    echo "\set desde $d"; echo "\set hasta $(date -d "$d +1 day" +%F)"
    for q in c1_ventas c2_ranking c3_estados; do echo "\o /tmp/rd/out/$1/${d}_$q.txt"; echo "\i /tmp/rd/$q.sql"; done
  done
  echo "\o"; echo "RESET ROLE;"
}
docker exec $C mkdir -p /tmp/rd/out/antes /tmp/rd/out/despues /tmp/rd/out/rollback && docker exec $C chmod -R 777 /tmp/rd

{
cat <<'SQL'
SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;
SELECT "fechaCreacion"::date AS sel_dia, ("fechaCreacion"::date + 1) AS sel_hasta, count(*) AS sel_no_cancelados
FROM v_pedido WHERE estado <> 'cancelado' GROUP BY 1, 2 ORDER BY 3 DESC, 1 LIMIT 1 \gset
SELECT so.id AS sel_id, so.name AS sel_name, so.state AS sel_state FROM sale_order so
WHERE so.state NOT IN ('draft', 'sent', 'cancel')
  AND so.date_order >= (:'sel_dia'::timestamptz AT TIME ZONE 'UTC')
  AND so.date_order <  (:'sel_hasta'::timestamptz AT TIME ZONE 'UTC')
ORDER BY so.id LIMIT 1 \gset
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/rd/out/seleccion.txt
SELECT :'sel_dia', :'sel_no_cancelados', :'sel_id', :'sel_name', :'sel_state';
\o /tmp/rd/out/pedido.txt
SELECT so.id, so.name, so.state, so.amount_total, c.name FROM sale_order so JOIN res_currency c ON c.id = so.currency_id WHERE so.id = :sel_id;
\o /tmp/rd/out/lineas.txt
SELECT sol.product_id::text, sol.product_uom_qty, sol.price_reduce_taxinc FROM sale_order_line sol
WHERE sol.order_id = :sel_id AND sol.display_type IS NULL ORDER BY sol.id;
\o
SQL
canonicas antes
cat <<'SQL'
\pset format aligned
\pset tuples_only off
UPDATE sale_order SET state = 'cancel' WHERE id = :sel_id AND state = :'sel_state';
-- guarda no constante: corta la transaccion si el UPDATE no aplico
SELECT CASE WHEN so.state = 'cancel' THEN 'ok' ELSE (1 / (length(so.state) * 0))::text END AS guarda
FROM sale_order so WHERE so.id = :sel_id;
\pset format unaligned
\pset tuples_only on
SQL
canonicas despues
echo "ROLLBACK;"
} > salidas/p4_3_modificacion_input.sql

{
cat <<'SQL'
SET TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
SELECT state, count(*) FROM sale_order GROUP BY 1 ORDER BY 1;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SQL
canonicas rollback
echo "ROLLBACK;"
} > salidas/p4_3_verificacion_input.sql

{ date -Iseconds; docker exec -i $C psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e < salidas/p4_3_modificacion_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p4_3_modificacion_output.txt 2>&1
{ date -Iseconds; docker exec -i $C psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e < salidas/p4_3_verificacion_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p4_3_verificacion_output.txt 2>&1
rm -rf salidas/p4_3_reporte && mkdir -p salidas/p4_3_reporte && docker cp $C:/tmp/rd/out/. salidas/p4_3_reporte/
