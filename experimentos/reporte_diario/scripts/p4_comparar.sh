#!/usr/bin/env bash
# Paso 4.2: diferencia simetrica nativa/canonica por dia y bloque, sobre las salidas de p4_foodstore.sh.
# Normalizacion: montos a 2 decimales (numeric de ambos lados); ranking nativo nombre -> productoId
# por mapeo_productos.txt; estados nativos descripcion -> codigo canonico por mapeo_estados.txt.
set -euo pipefail
cd "$(dirname "$0")/../salidas/p4_2_foodstore"
T=$(mktemp -d)
echo "| Día | Bloque | Filas nativa | Filas canónica | Solo nativa | Solo canónica |"
echo "|---|---|---|---|---|---|"
for f in *_n1_ventas.txt; do
  d=${f%%_*}
  # ventas: una fila, tres valores
  awk -F'|' '{printf "%d|%.2f|%.2f\n",$1,$2,$3}' ${d}_n1_ventas.txt | sort > $T/n1
  awk -F'|' '{printf "%d|%.2f|%.2f\n",$1,$2,$3}' ${d}_c1_ventas.txt | sort > $T/c1
  # ranking: (productoId, unidades, monto)
  awk -F'|' 'NR==FNR{id[$1]=$2;next} {if(!($1 in id)){print "SIN_MAPEO:"$1 > "/dev/stderr"; exit 1}; printf "%s|%d|%.2f\n",id[$1],$2,$3}' mapeo_productos.txt ${d}_n2_ranking.txt | sort > $T/n2
  awk -F'|' '{printf "%s|%d|%.2f\n",$1,$3,$4}' ${d}_c2_ranking.txt | sort > $T/c2
  # estados: (estado, cantidad)
  awk -F'|' 'NR==FNR{m[$1]=$2;next} {if(!($1 in m)){print "SIN_MAPEO:"$1 > "/dev/stderr"; exit 1}; printf "%s|%d\n",m[$1],$2}' mapeo_estados.txt ${d}_n3_estados.txt | sort > $T/n3
  awk -F'|' '{printf "%s|%d\n",$1,$2}' ${d}_c3_estados.txt | sort > $T/c3
  for b in 1:ventas 2:ranking 3:estados; do
    k=${b%%:*}; n=${b#*:}
    echo "| $d | $n | $(wc -l < $T/n$k) | $(wc -l < $T/c$k) | $(comm -23 $T/n$k $T/c$k | wc -l) | $(comm -13 $T/n$k $T/c$k | wc -l) |"
  done
done
rm -rf $T
