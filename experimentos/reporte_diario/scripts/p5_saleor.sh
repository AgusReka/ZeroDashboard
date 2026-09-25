#!/usr/bin/env bash
# Paso 5.1: canonicas contra calculo manual en Saleor.
# Sesion A (saleor, REPEATABLE READ READ ONLY): manuales y canonicas en la misma instantanea.
# Sesion B (zd_ch16c_lectura, rol de solo lectura): canonicas otra vez, para mostrar que corren sin permisos sobre las tablas.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
C=saleor-platform-db-1
RES=salidas/p5_1_saleor
DIAS="2026-09-24 2026-09-23"   # unico dia con pedidos + un dia vacio
docker exec $C rm -rf /tmp/rd && docker exec $C mkdir -p /tmp/rd/outA /tmp/rd/outB && docker exec $C chmod 777 /tmp/rd/outA /tmp/rd/outB
docker cp sql/. $C:/tmp/rd/
gen() { # $1 = A|B
  echo "SET TIME ZONE 'America/Argentina/Buenos_Aires';"
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  echo "SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, current_user, pg_backend_pid() AS pid;"
  echo "\pset format unaligned"; echo "\pset tuples_only on"; echo "\pset fieldsep '|'"
  for d in $DIAS; do
    h=$(date -d "$d +1 day" +%F)
    echo "\set desde $d"; echo "\set hasta $h"
    [ "$1" = A ] && for q in m1_ventas m2_ranking m3_estados; do echo "\o /tmp/rd/out$1/${d}_${q}.txt"; echo "\i /tmp/rd/manual_saleor/$q.sql"; done
    for q in c1_ventas c2_ranking c2_ranking_top5 c3_estados; do echo "\o /tmp/rd/out$1/${d}_${q}.txt"; echo "\i /tmp/rd/$q.sql"; done
  done
  echo "\o"; echo "ROLLBACK;"
}
gen A > salidas/p5_1_saleor_A_input.sql
gen B > salidas/p5_1_saleor_B_input.sql
{ date -Iseconds; docker exec -i $C psql -U saleor -d saleor -v ON_ERROR_STOP=1 -e < salidas/p5_1_saleor_A_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p5_1_saleor_A_output.txt 2>&1
{ date -Iseconds; docker exec -i $C psql -U zd_ch16c_lectura -d saleor -v ON_ERROR_STOP=1 -e < salidas/p5_1_saleor_B_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p5_1_saleor_B_output.txt 2>&1
rm -rf $RES && mkdir -p $RES/A $RES/B && docker cp $C:/tmp/rd/outA/. $RES/A/ && docker cp $C:/tmp/rd/outB/. $RES/B/
