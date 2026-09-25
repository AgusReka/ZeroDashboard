#!/usr/bin/env bash
# Paso 5.2: efectos esperados de cancelar el pedido elegido, calculados desde "antes" + pedido + lineas,
# comparados con "despues"; y "rollback" (sesion nueva) comparado con "antes" y con la corrida 5.1.
set -euo pipefail
cd "$(dirname "$0")/../salidas/p5_2_saleor"
T=$(mktemp -d)
IFS='|' read -r _ _ st tot _ < pedido.txt
# ventas esperadas: -1 pedido, -total; promedio recalculado
awk -F'|' -v t="$tot" '{n=$1-1; s=$2-t; printf "%d|%.3f|%.2f\n", n, s, (n? s/n : 0)}' antes_c1_ventas.txt > $T/e1
awk -F'|' '{printf "%d|%.3f|%.2f\n",$1,$2,$3}' despues_c1_ventas.txt > $T/d1
# ranking esperado: cada variante del pedido pierde sus unidades y su monto; sale si queda en 0
awk -F'|' 'NR==FNR{q[$1]+=$2; m[$1]+=$2*$3; next} {u=$3-q[$1]; a=$4-m[$1]; if(u>0) printf "%s|%s|%d|%.3f\n",$1,$2,u,a}' lineas.txt antes_c2_ranking.txt | sort > $T/e2
awk -F'|' '{printf "%s|%s|%d|%.3f\n",$1,$2,$3,$4}' despues_c2_ranking.txt | sort > $T/d2
# estados esperados: el estado del pedido -1, cancelado +1
awk -F'|' -v st="$st" '{c[$1]=$2} END{c[st]--; c["cancelado"]++; for(k in c) if(c[k]>0) printf "%s|%d\n",k,c[k]}' antes_c3_estados.txt | sort > $T/e3
sort despues_c3_estados.txt > $T/d3
echo "| Bloque | Filas esperadas | Filas después | Solo esperado | Solo después |"
echo "|---|---|---|---|---|"
for b in 1:ventas 2:ranking 3:estados; do k=${b%%:*}
  echo "| ${b#*:} | $(wc -l < $T/e$k) | $(wc -l < $T/d$k) | $(comm -23 $T/e$k $T/d$k | wc -l) | $(comm -13 $T/e$k $T/d$k | wc -l) |"
done
echo
echo "| Bloque | rollback = antes | rollback = corrida 5.1 (A) |"
echo "|---|---|---|"
for q in c1_ventas c2_ranking c3_estados; do
  a=$(cmp -s rollback_$q.txt antes_$q.txt && echo sí || echo NO)
  b=$(cmp -s rollback_$q.txt ../p5_1_saleor/A/2026-09-24_$q.txt && echo sí || echo NO)
  echo "| $q | $a | $b |"
done
rm -rf $T
