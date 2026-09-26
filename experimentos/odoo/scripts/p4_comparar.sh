#!/usr/bin/env bash
# Diferencia simetrica canonica/manual (sesion A) y canonica A/B, por dia y bloque. Montos a 3 decimales.
set -euo pipefail
cd "$(dirname "$0")/.."
DIAS=$(cat salidas/p4_dias.txt)
cd salidas/p4_reporte
T=$(mktemp -d)
n1() { awk -F'|' '{printf "%d|%.3f|%.3f\n",$1,$2,$3}' "$1" | sort; }
n2() { awk -F'|' '{printf "%s|%s|%.3f|%.3f\n",$1,$2,$3,$4}' "$1" | sort; }
n3() { awk -F'|' '{printf "%s|%d\n",$1,$2}' "$1" | sort; }
echo "| Día | Bloque | Filas manual | Filas canónica B | Solo manual | Solo canónica B | canónica A = B |"
echo "|---|---|---|---|---|---|---|"
for d in $DIAS; do
  for b in 1:ventas 2:ranking 3:estados; do
    k=${b%%:*}; n=${b#*:}
    m=$(ls A/${d}_m${k}_*.txt); c=$(ls A/${d}_c${k}_*.txt | grep -v top5); cb=B/$(basename $c)
    n$k $m > $T/m; n$k $c > $T/c; n$k $cb > $T/cb
    eq=$(cmp -s $T/c $T/cb && echo sí || echo NO)
    echo "| $d | $n | $(wc -l < $T/m) | $(wc -l < $T/cb) | $(comm -23 $T/m $T/cb | wc -l) | $(comm -13 $T/m $T/cb | wc -l) | $eq |"
  done
done
rm -rf $T
