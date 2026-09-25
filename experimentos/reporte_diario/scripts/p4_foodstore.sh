#!/usr/bin/env bash
# Paso 4.2: nativas del Anexo C contra canonicas, por dia, en una sola transaccion REPEATABLE READ READ ONLY.
# Las canonicas se ejecutan con \i sobre los archivos de sql/ sin modificar (copiados al contenedor).
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: no convertir /tmp/... a rutas de Windows
cd "$(dirname "$0")/.."
C=foodstore-backend-fastapi-db-1
IN=salidas/p4_2_foodstore_input.sql
OUT=salidas/p4_2_foodstore_output.txt
RES=salidas/p4_2_foodstore
DIAS=$(for i in $(seq 0 30); do date -d "2026-08-18 +$i day" +%F; done)   # 30 dias con pedidos + 2026-09-17 vacio

docker exec $C rm -rf /tmp/rd && docker exec $C mkdir -p /tmp/rd/out
docker cp sql/. $C:/tmp/rd/
{
  echo "SET TIME ZONE 'America/Argentina/Buenos_Aires';"
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  echo "SELECT now() AS hora_servidor, current_setting('TimeZone') AS zona, pg_backend_pid() AS pid;"
  echo "\pset format unaligned"; echo "\pset tuples_only on"; echo "\pset fieldsep '|'"
  echo "\o /tmp/rd/out/mapeo_productos.txt"; echo "\i /tmp/rd/nativas_foodstore/mapeos.sql"
  echo "\o /tmp/rd/out/mapeo_estados.txt";   echo "\i /tmp/rd/nativas_foodstore/mapeo_estados.sql"
  for d in $DIAS; do
    h=$(date -d "$d +1 day" +%F)
    echo "\set desde $d"; echo "\set hasta $h"
    for q in n1_ventas n2_ranking n3_estados; do echo "\o /tmp/rd/out/${d}_${q}.txt"; echo "\i /tmp/rd/nativas_foodstore/$q.sql"; done
    for q in c1_ventas c2_ranking c2_ranking_top5 c3_estados; do echo "\o /tmp/rd/out/${d}_${q}.txt"; echo "\i /tmp/rd/$q.sql"; done
  done
  echo "\o"
  echo "ROLLBACK;"
} > $IN
{ date -Iseconds; docker exec -i $C psql -U postgres -d food_store -v ON_ERROR_STOP=1 -e < $IN; echo "exit=$?"; date -Iseconds; } > $OUT 2>&1
rm -rf $RES && mkdir -p $RES && docker cp $C:/tmp/rd/out/. $RES/
