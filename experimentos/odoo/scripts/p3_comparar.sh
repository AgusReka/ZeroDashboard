#!/usr/bin/env bash
# Diferencia simetrica sobre (producto, stock_producible, insumo_limitante).
# Manual: el minimo de los cocientes por producto, calculado aca con awk (no con ARRAY_AGG);
# si dos componentes empatan en el minimo, se listan todos los nombres (el empate queda a la vista).
# Uso: p3_comparar.sh [dir] [manual] [canonica_A] [canonica_B]
set -euo pipefail
cd "$(dirname "$0")/.."
D=${1:-salidas/p3_stock}; M=${2:-$D/A/manual.txt}; CA=${3:-$D/A/canonica.txt}; CB=${4:-$D/B/canonica.txt}
T=$(mktemp -d)
awk -F'|' '{p=$1; c=$6+0; if(!(p in min) || c<min[p]-1e-9){min[p]=c; lim[p]=$2} else if (c<=min[p]+1e-9) lim[p]=lim[p] " / " $2}
  END{for(p in min){f=int(min[p]+1e-9); if(min[p]<0 && f!=min[p]) f=f-1; printf "%s|%d|%s\n", p, f, lim[p]}}' $M | sort > $T/m
awk -F'|' '{printf "%s|%d|%s\n",$1,$3,$4}' $CA | sort > $T/ca
awk -F'|' '{printf "%s|%d|%s\n",$1,$3,$4}' $CB | sort > $T/cb
echo "| Comparación | Filas izq. | Filas der. | Solo izq. | Solo der. |"
echo "|---|---|---|---|---|"
echo "| manual / canónica (rol de solo lectura) | $(wc -l < $T/m) | $(wc -l < $T/cb) | $(comm -23 $T/m $T/cb | wc -l) | $(comm -13 $T/m $T/cb | wc -l) |"
echo "| canónica (odoo) / canónica (rol de solo lectura) | $(wc -l < $T/ca) | $(wc -l < $T/cb) | $(comm -23 $T/ca $T/cb | wc -l) | $(comm -13 $T/ca $T/cb | wc -l) |"
# Con empates: la fila canonica coincide si el stock es igual y su insumo limitante pertenece
# al conjunto de componentes empatados en el minimo segun el calculo manual.
awk -F'|' 'NR==FNR{n++; k=split($3,a," / "); for(i=1;i<=k;i++) ok[$1 "|" $2 "|" a[i]]=1; next}
  {t++; if(($1 "|" $2 "|" $3) in ok) c++}
  END{printf "\nCon empates (limitante canonico dentro del conjunto empatado del manual): %d de %d filas canonicas coinciden; filas manuales: %d\n", c, t, n}' $T/m $T/cb
echo; echo "Solo manual:"; comm -23 $T/m $T/cb; echo "Solo canonica (rol de solo lectura):"; comm -13 $T/m $T/cb
rm -rf $T
