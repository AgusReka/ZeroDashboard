#!/usr/bin/env bash
# Paso 7: canonicas via vistas creadas contra canonicas con WITH, por dia, en una sola transaccion READ ONLY.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
C=foodstore-backend-fastapi-db-1
RES=salidas/p7_foodstore
DIAS=$(for i in $(seq 0 30); do date -d "2026-08-18 +$i day" +%F; done)
docker exec $C rm -rf /tmp/rd && docker exec $C mkdir -p /tmp/rd/out
docker cp sql/. $C:/tmp/rd/
{
  echo "SET TIME ZONE 'America/Argentina/Buenos_Aires';"
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  echo "SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, pg_backend_pid() AS pid;"
  echo "\pset format unaligned"; echo "\pset tuples_only on"; echo "\pset fieldsep '|'"
  for d in $DIAS; do
    echo "\set desde $d"; echo "\set hasta $(date -d "$d +1 day" +%F)"
    for q in c1_ventas c2_ranking c3_estados; do
      echo "\o /tmp/rd/out/${d}_v_${q}.txt"; echo "\i /tmp/rd/$q.sql"
      echo "\o /tmp/rd/out/${d}_w_${q}.txt"; echo "\i /tmp/rd/with_foodstore/w_$q.sql"
    done
  done
  echo "\o"; echo "ROLLBACK;"
} > salidas/p7_foodstore_input.sql
{ date -Iseconds; docker exec -i $C psql -U postgres -d food_store -v ON_ERROR_STOP=1 -e < salidas/p7_foodstore_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p7_foodstore_output.txt 2>&1
rm -rf $RES && mkdir -p $RES && docker cp $C:/tmp/rd/out/. $RES/
iguales=0; distintos=0
for f in $RES/*_v_*.txt; do w=${f/_v_/_w_}; if cmp -s "$f" "$w"; then iguales=$((iguales+1)); else distintos=$((distintos+1)); echo "DISTINTO: $f"; fi; done
echo "pares dia x consulta: iguales=$iguales distintos=$distintos"
# y contra la corrida del paso 4
p4=0; for f in $RES/*_v_*.txt; do b=$(basename $f); cmp -s "$f" salidas/p4_2_foodstore/${b/_v_/_} || { p4=$((p4+1)); echo "DIFIERE DE P4: $b"; }; done
echo "diferencias contra paso 4: $p4"
