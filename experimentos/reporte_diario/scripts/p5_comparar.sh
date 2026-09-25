#!/usr/bin/env bash
# Paso 5.1: diferencia simetrica canonica/manual en Saleor (sesion A), y canonica A/B.
# Ranking: tupla completa (productoId, nombre, unidades, monto). Montos a 3 decimales.
set -euo pipefail
cd "$(dirname "$0")/../salidas/p5_1_saleor"
T=$(mktemp -d)
n1() { awk -F'|' '{printf "%d|%.3f|%.3f\n",$1,$2,$3}' "$1" | sort; }
n2() { awk -F'|' '{printf "%s|%s|%d|%.3f\n",$1,$2,$3,$4}' "$1" | sort; }
n3() { awk -F'|' '{printf "%s|%d\n",$1,$2}' "$1" | sort; }
echo "| Día | Bloque | Comparación | Filas izq. | Filas der. | Solo izq. | Solo der. |"
echo "|---|---|---|---|---|---|---|"
for d in 2026-09-24 2026-09-23; do
  for b in 1:ventas 2:ranking 3:estados; do
    k=${b%%:*}; n=${b#*:}
    m=$(ls A/${d}_m${k}_*.txt); c=$(ls A/${d}_c${k}_*.txt | grep -v top5); cb=B/$(basename $c)
    n$k $m > $T/m; n$k $c > $T/c; n$k $cb > $T/cb
    echo "| $d | $n | manual (A) / canónica (A) | $(wc -l < $T/m) | $(wc -l < $T/c) | $(comm -23 $T/m $T/c | wc -l) | $(comm -13 $T/m $T/c | wc -l) |"
    echo "| $d | $n | canónica saleor (A) / canónica zd_ch16c_lectura (B) | $(wc -l < $T/c) | $(wc -l < $T/cb) | $(comm -23 $T/c $T/cb | wc -l) | $(comm -13 $T/c $T/cb | wc -l) |"
  done
done
rm -rf $T
