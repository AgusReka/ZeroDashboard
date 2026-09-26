#!/usr/bin/env bash
# Paso 4.1-4.2 y 4.4: canonicas C1-C3 contra calculo manual, por dia con pedidos y un dia vacio.
# Sesion A (odoo, REPEATABLE READ READ ONLY): manuales y canonicas en la misma instantanea.
# Sesion B (zd_odoo_lectura): canonicas.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
source .env
RD=../reporte_diario/sql
sha256sum $RD/c1_ventas.sql $RD/c2_ranking.sql $RD/c2_ranking_top5.sql $RD/c3_estados.sql > salidas/p4_hash.txt
C=$(docker compose ps -q db)
L="docker exec -i -e PGPASSWORD=$ZD_LECTURA_PASSWORD $C psql -h localhost -U zd_odoo_lectura -d odoo -v ON_ERROR_STOP=1"
# Dias con pedidos en v_pedido (rol de solo lectura) y dia vacio (regla 3 del preregistro)
cat > salidas/p4_dias_input.sql <<'SQL'
SET TIME ZONE 'America/Argentina/Buenos_Aires';
SELECT now() AS hora_servidor, current_user;
SELECT "fechaCreacion"::date AS dia, count(*) AS pedidos, count(*) FILTER (WHERE estado <> 'cancelado') AS no_cancelados,
       count(DISTINCT moneda) AS monedas, string_agg(DISTINCT moneda, ',') AS cuales
FROM v_pedido GROUP BY 1 ORDER BY 1;
SELECT min("fechaCreacion")::date - 1 AS dia_vacio_candidato,
       (SELECT count(*) FROM v_pedido WHERE "fechaCreacion"::date = (SELECT min("fechaCreacion")::date - 1 FROM v_pedido)) AS pedidos_ese_dia
FROM v_pedido;
SQL
{ date -Iseconds; $L -e < salidas/p4_dias_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p4_dias_output.txt 2>&1
DIAS=$(printf 'SET TIME ZONE %s;\nSELECT DISTINCT "fechaCreacion"::date FROM v_pedido ORDER BY 1;\n' "'America/Argentina/Buenos_Aires'" | $L -At | grep -E '^[0-9-]{10}$')
VACIO=$(printf 'SET TIME ZONE %s;\nSELECT min("fechaCreacion")::date - 1 FROM v_pedido;\n' "'America/Argentina/Buenos_Aires'" | $L -At | grep -E '^[0-9-]{10}$')
echo "$DIAS $VACIO" | tr ' ' '\n' > salidas/p4_dias.txt
docker exec $C rm -rf /tmp/rd && docker exec $C mkdir -p /tmp/rd/outA /tmp/rd/outB /tmp/rd/manual && docker exec $C chmod -R 777 /tmp/rd
for f in c1_ventas c2_ranking c2_ranking_top5 c3_estados; do docker cp $RD/$f.sql $C:/tmp/rd/; done
docker cp sql/manual/. $C:/tmp/rd/manual/
docker exec $C sh -c 'cd /tmp/rd && sha256sum c1_ventas.sql c2_ranking.sql c2_ranking_top5.sql c3_estados.sql' >> salidas/p4_hash.txt
gen() {
  echo "SET TIME ZONE 'America/Argentina/Buenos_Aires';"
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  echo "SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;"
  echo "\pset format unaligned"; echo "\pset tuples_only on"; echo "\pset fieldsep '|'"
  for d in $(cat salidas/p4_dias.txt); do
    h=$(date -d "$d +1 day" +%F)
    echo "\set desde $d"; echo "\set hasta $h"
    [ "$1" = A ] && for q in m1_ventas m2_ranking m3_estados; do echo "\o /tmp/rd/out$1/${d}_${q}.txt"; echo "\i /tmp/rd/manual/$q.sql"; done
    for q in c1_ventas c2_ranking c2_ranking_top5 c3_estados; do echo "\o /tmp/rd/out$1/${d}_${q}.txt"; echo "\i /tmp/rd/$q.sql"; done
  done
  echo "\o"; echo "ROLLBACK;"
}
gen A > salidas/p4_reporte_A_input.sql; gen B > salidas/p4_reporte_B_input.sql
{ date -Iseconds; docker exec -i $C psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e < salidas/p4_reporte_A_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p4_reporte_A_output.txt 2>&1
{ date -Iseconds; $L -e < salidas/p4_reporte_B_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p4_reporte_B_output.txt 2>&1
rm -rf salidas/p4_reporte && mkdir -p salidas/p4_reporte/A salidas/p4_reporte/B
docker cp $C:/tmp/rd/outA/. salidas/p4_reporte/A/; docker cp $C:/tmp/rd/outB/. salidas/p4_reporte/B/
