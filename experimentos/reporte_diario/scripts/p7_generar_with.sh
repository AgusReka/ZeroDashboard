#!/usr/bin/env bash
# Paso 7: antepone las definiciones de las vistas de Food Store como WITH al texto canonico, sin tocarlo.
# v_pedido y v_item_pedido de vistas/v_pedido_foodstore.sql; v_producto de 03_vistas_foodstore.sql (CH-16b).
set -euo pipefail
cd "$(dirname "$0")/.."
cuerpos() { # extrae "nombre AS ( cuerpo )" de cada CREATE [OR REPLACE] VIEW, sin el ; final
  awk -v want="$2" '
    match($0, /^CREATE (OR REPLACE )?VIEW [a-z_]+ AS/) { split($0, w, " "); n = (w[2]=="OR") ? w[5] : w[3]; cap = (n == want); if (cap) print n " AS ("; next }
    cap { l = $0; if (l ~ /;[ \t]*$/) { sub(/;[ \t]*$/, "", l); print l; print ")"; cap = 0 } else print l }
  ' "$1"
}
PRE=$(mktemp)
{ echo "-- Paso 7: definiciones de las vistas de Food Store como WITH, seguidas del texto canonico sin modificar."
  echo "WITH"
  cuerpos vistas/v_pedido_foodstore.sql v_pedido; echo ","
  cuerpos vistas/v_pedido_foodstore.sql v_item_pedido; echo ","
  cuerpos ../../openspec/changes/CH-16b-vistas-canonicas/sql/03_vistas_foodstore.sql v_producto
} > $PRE
for q in c1_ventas c2_ranking c3_estados; do
  cat $PRE sql/$q.sql > sql/with_foodstore/w_$q.sql
  tail -c $(stat -c %s sql/$q.sql) sql/with_foodstore/w_$q.sql | cmp - sql/$q.sql && echo "w_$q: cola identica byte a byte a sql/$q.sql"
done
rm -f $PRE
