#!/usr/bin/env bash
# Paso 3.1-3.2: canonica de stock producible (rol de solo lectura) y calculo manual (tablas nativas).
# Sesion A (odoo, REPEATABLE READ READ ONLY): manual + canonica en la misma instantanea.
# Sesion B (zd_odoo_lectura): canonica.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
source .env
RAIZ=../..
CANON=$RAIZ/openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql
sha256sum $CANON | tee salidas/p3_hash.txt
C=$(docker compose ps -q db)
docker exec $C rm -rf /tmp/zd && docker exec $C mkdir -p /tmp/zd/outA /tmp/zd/outB && docker exec $C chmod -R 777 /tmp/zd
docker cp $CANON $C:/tmp/zd/04_consulta_canonica.sql
docker cp sql/manual/m_stock_producible.sql $C:/tmp/zd/
docker exec $C sha256sum /tmp/zd/04_consulta_canonica.sql | tee -a salidas/p3_hash.txt
gen() {
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  echo "SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;"
  echo "\pset format unaligned"; echo "\pset tuples_only on"; echo "\pset fieldsep '|'"
  [ "$1" = A ] && { echo "\o /tmp/zd/out$1/manual.txt"; echo "\i /tmp/zd/m_stock_producible.sql"; }
  echo "\o /tmp/zd/out$1/canonica.txt"; echo "\i /tmp/zd/04_consulta_canonica.sql"
  echo "\o"; echo "ROLLBACK;"
}
gen A > salidas/p3_stock_A_input.sql; gen B > salidas/p3_stock_B_input.sql
{ date -Iseconds; docker exec -i $C psql -U odoo -d odoo -v ON_ERROR_STOP=1 -e < salidas/p3_stock_A_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p3_stock_A_output.txt 2>&1
{ date -Iseconds; docker exec -i -e PGPASSWORD="$ZD_LECTURA_PASSWORD" $C psql -h localhost -U zd_odoo_lectura -d odoo -v ON_ERROR_STOP=1 -e < salidas/p3_stock_B_input.sql; echo "exit=$?"; date -Iseconds; } > salidas/p3_stock_B_output.txt 2>&1
rm -rf salidas/p3_stock && mkdir -p salidas/p3_stock/A salidas/p3_stock/B
docker cp $C:/tmp/zd/outA/. salidas/p3_stock/A/; docker cp $C:/tmp/zd/outB/. salidas/p3_stock/B/
