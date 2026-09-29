#!/usr/bin/env bash
# Conexiones y utilidades comunes. Se incluye con `source`.
# Esquemas: foodstore, medusa, odoo. Roles:
#   lectura -> rol de solo lectura cuando existe (Food Store: lector_zerodashboard; Odoo: zd_odoo_lectura);
#              en Medusa no hay rol de solo lectura: medusa con la transaccion READ ONLY.
#   admin   -> dueno de las tablas (postgres, medusa, odoo): calculo manual en Odoo, huellas y modificaciones.
set -euo pipefail
export MSYS_NO_PATHCONV=1
RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
EXP=$RAIZ/experimentos/desempate
V2=$EXP/sql/04_consulta_canonica_v2.sql

contenedor() {
  case $1 in
    foodstore) echo foodstore-backend-fastapi-db-1 ;;
    medusa)    echo ch16-medusa-pg ;;
    odoo)      echo zd-odoo-db-1 ;;
  esac
}

# psql <esquema> <rol>: lee el script por stdin.
psql_en() {
  local C; C=$(contenedor "$1")
  case "$1:$2" in
    foodstore:lectura) docker exec -i "$C" psql -X -U lector_zerodashboard -d food_store -v ON_ERROR_STOP=1 -e ;;
    foodstore:admin)   docker exec -i "$C" psql -X -U postgres -d food_store -v ON_ERROR_STOP=1 -e ;;
    medusa:*)          docker exec -i "$C" psql -X -U medusa -d medusa_db -v ON_ERROR_STOP=1 -e ;;
    odoo:lectura)      docker exec -i -e PGPASSWORD="$ZD_LECTURA_PASSWORD" "$C" psql -X -h localhost -U zd_odoo_lectura -d odoo -v ON_ERROR_STOP=1 -e ;;
    odoo:admin)        docker exec -i "$C" psql -X -U odoo -d odoo -v ON_ERROR_STOP=1 -e ;;
  esac
}

# Rol con el que corre el calculo manual (necesita las tablas nativas).
rol_manual() { case $1 in odoo) echo admin ;; *) echo lectura ;; esac; }

# Nombre del rol de solo lectura para SET ROLE dentro de una transaccion de escritura.
rol_lectura_sql() { case $1 in foodstore) echo lector_zerodashboard ;; odoo) echo zd_odoo_lectura ;; esac; }

# ejecutar <esquema> <rol> <input.sql> <output.txt>: registra fecha y hora antes y despues, el texto
# exacto (psql -e) y el codigo de salida.
ejecutar() {
  local rc=0
  { echo "inicio $(date -Iseconds)"; psql_en "$1" "$2" < "$3" || rc=$?; echo "exit=$rc"; echo "fin $(date -Iseconds)"; } > "$4" 2>&1
  return $rc
}

# preparar <esquema>: copia al contenedor la V2, el manual y la huella; registra sus SHA-256 (host y contenedor).
preparar() {
  local C; C=$(contenedor "$1")
  docker exec "$C" rm -rf /tmp/zd
  docker exec "$C" mkdir -p /tmp/zd/out
  docker exec "$C" chmod -R 777 /tmp/zd
  docker cp "$V2" "$C":/tmp/zd/v2.sql
  docker cp "$EXP/sql/manual/m_$1.sql" "$C":/tmp/zd/manual.sql
  docker cp "$EXP/sql/estado/huella_$1.sql" "$C":/tmp/zd/huella.sql
  { echo "host $(date -Iseconds)"; (cd "$RAIZ" && sha256sum experimentos/desempate/sql/04_consulta_canonica_v2.sql \
      "experimentos/desempate/sql/manual/m_$1.sql" "experimentos/desempate/sql/estado/huella_$1.sql");
    echo "contenedor"; docker exec "$C" sha256sum /tmp/zd/v2.sql /tmp/zd/manual.sql /tmp/zd/huella.sql; }
}

# Bloque psql que escribe una consulta en un archivo de datos (sin encabezados, separador '|').
volcar() {
  echo "\\pset format unaligned"; echo "\\pset tuples_only on"; echo "\\pset fieldsep '|'"
  echo "\\o $1"; echo "\\i $2"; echo "\\o"
  echo "\\pset format aligned"; echo "\\pset tuples_only off"
}

if [ -f "$RAIZ/experimentos/odoo/.env" ]; then
  # shellcheck disable=SC1091
  source "$RAIZ/experimentos/odoo/.env"
fi
