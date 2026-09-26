#!/usr/bin/env bash
# Diferencia simetrica sobre (producto, stock_producible, insumo_limitante).
# Manual: el minimo de los cocientes por producto, calculado aca con awk (no con ARRAY_AGG);
# si dos componentes empatan en el minimo, se listan todos los nombres (el empate queda a la vista).
set -euo pipefail
D=${1:-salidas/p3_stock}; M=${2:-$D/A/manual.txt}; CA=${3:-$D/A/canonica.txt}; CB=${4:-$D/B/canonica.txt}
cd "$(dirname "$0")/.."
T=$(mktemp -d)
awk -F'|' '{p=$1; c=$6+0; if(!(p in min) || c<min[p]-1e-9){min[p]=c; lim[p]=$2} else if (c<=min[p]+1e-9) lim[p]=lim[p] " / " $2}
  END{for(p in min){f=int(min[p]+1e-9); if(min[p]<0 && f!=min[p]) f=f-1; printf "%s|%d|%s\n", p, f, lim[p]}}' $M | sort > $T/m
awk -F'|' '{printf "%s|%d|%s\n",$1,$3,$4}' $CA | sort > $T/ca
awk -F'|' '{printf "%s|%d|%s\n",$1,$3,$4}' $CB | sort > $T/cb
echo "| Comparación | Filas izq. | Filas der. | Solo izq. | Solo der. |"
echo "|---|---|---|---|---|"
echo "| manual (A) / canónica zd_odoo_lectura (B) | $(wc -l < $T/m) | $(wc -l < $T/cb) | $(comm -23 $T/m $T/cb | wc -l) | $(comm -13 $T/m $T/cb | wc -l) |"
echo "| canónica odoo (A) / canónica zd_odoo_lectura (B) | $(wc -l < $T/ca) | $(wc -l < $T/cb) | $(comm -23 $T/ca $T/cb | wc -l) | $(comm -13 $T/ca $T/cb | wc -l) |"
echo; echo "Solo manual:"; comm -23 $T/m $T/cb; echo "Solo canónica B:"; comm -13 $T/m $T/cb
rm -rf $T
