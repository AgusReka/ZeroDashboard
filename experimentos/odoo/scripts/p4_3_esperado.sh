#!/usr/bin/env bash
# Paso 4.3: efectos esperados de cancelar el pedido elegido, calculados desde "antes" + pedido + lineas,
# comparados con "despues" en el dia elegido; los demas dias deben quedar iguales. "rollback" (sesion
# nueva) comparado con "antes" y con la corrida 4.1 (sesion B).
set -euo pipefail
cd "$(dirname "$0")/.."
DIAS=$(cat salidas/p4_dias.txt)
cd salidas/p4_3_reporte
T=$(mktemp -d)
IFS='|' read -r DIA _ _ _ _ < seleccion.txt
IFS='|' read -r _ _ st tot _ < pedido.txt
A=antes/${DIA}; D=despues/${DIA}
# ventas esperadas: -1 pedido, -total; promedio recalculado
awk -F'|' -v t="$tot" '{n=$1-1; s=$2-t; printf "%d|%.3f|%.2f\n", n, s, (n? s/n : 0)}' ${A}_c1_ventas.txt > $T/e1
awk -F'|' '{printf "%d|%.3f|%.2f\n",$1,$2,$3}' ${D}_c1_ventas.txt > $T/d1
# ranking esperado: cada producto del pedido pierde sus unidades y su monto; sale si queda en 0 unidades
awk -F'|' 'NR==FNR{q[$1]+=$2; m[$1]+=$2*$3; next} {u=$3-q[$1]; a=$4-m[$1]; if(u>0) printf "%s|%s|%.3f|%.3f\n",$1,$2,u,a}' lineas.txt ${A}_c2_ranking.txt | sort > $T/e2
awk -F'|' '{printf "%s|%s|%.3f|%.3f\n",$1,$2,$3,$4}' ${D}_c2_ranking.txt | sort > $T/d2
# estados esperados: el estado del pedido -1, cancelado +1
awk -F'|' -v st="$st" '{c[$1]=$2} END{c[st]--; c["cancelado"]++; for(k in c) if(c[k]>0) printf "%s|%d\n",k,c[k]}' ${A}_c3_estados.txt | sort > $T/e3
sort ${D}_c3_estados.txt > $T/d3
echo "Día elegido: $DIA. Pedido: $(cat pedido.txt)"
echo
echo "| Bloque ($DIA) | Filas esperadas | Filas después | Solo esperado | Solo después |"
echo "|---|---|---|---|---|"
for b in 1:ventas 2:ranking 3:estados; do k=${b%%:*}
  echo "| ${b#*:} | $(wc -l < $T/e$k) | $(wc -l < $T/d$k) | $(comm -23 $T/e$k $T/d$k | wc -l) | $(comm -13 $T/e$k $T/d$k | wc -l) |"
done
echo
dist=0; iguales=0
for d in $DIAS; do [ "$d" = "$DIA" ] && continue
  for q in c1_ventas c2_ranking c3_estados; do
    if cmp -s antes/${d}_$q.txt despues/${d}_$q.txt; then iguales=$((iguales+1)); else dist=$((dist+1)); echo "cambió: $d $q"; fi
  done
done
echo "Demás días: $iguales salidas iguales antes/después, $dist distintas."
echo
r1=0; r2=0; n=0
for d in $DIAS; do for q in c1_ventas c2_ranking c3_estados; do n=$((n+1))
  cmp -s rollback/${d}_$q.txt antes/${d}_$q.txt || { r1=$((r1+1)); echo "rollback != antes: $d $q"; }
  cmp -s rollback/${d}_$q.txt ../p4_reporte/B/${d}_$q.txt || { r2=$((r2+1)); echo "rollback != corrida 4.1 B: $d $q"; }
done; done
echo "Sesión nueva tras ROLLBACK: $n salidas; distintas de 'antes': $r1; distintas de la corrida 4.1 (B): $r2."
rm -rf $T
