#!/usr/bin/env bash
# Compara las tres corridas de la V2 entre si (byte a byte, cmp) y cada una contra el calculo manual
# (diferencia simetrica en las dos direcciones sobre la tupla (producto, stock_producible, insumo_limitante_id)).
# Uso: comparar.sh <dir> [prefijo_v2] [manual] [huella_a] [huella_b]
#   <dir>/<prefijo_v2>1.txt, 2.txt, 3.txt: salidas de la V2 (6 campos separados por '|').
#   <dir>/<manual>: salida del manual (6 campos: producto|stock|limitante_id|empatados|n|limitante_C).
set -euo pipefail
D=$1; P=${2:-v2_corrida}; M=${3:-manual.txt}; HA=${4:-huella_antes.txt}; HB=${5:-huella_despues.txt}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

echo "## Corridas de la V2 entre si"
echo
echo '```'
for n in 1 2 3; do sha256sum "$D/$P$n.txt" | sed "s#$D/##"; done
for p in "1 2" "1 3" "2 3"; do
  set -- $p
  if cmp "$D/$P$1.txt" "$D/$P$2.txt"; then echo "cmp $P$1 $P$2: identicas"; else echo "cmp $P$1 $P$2: DIFIEREN"; fi
done
echo '```'
echo
echo "## Forma de las salidas"
echo
echo '```'
for f in "$P"1.txt "$P"2.txt "$P"3.txt; do
  awk -F'|' -v f="$f" '{ if (NF != 6) mal++ } END { printf "%s: %d filas, %d filas con un numero de campos distinto de 6\n", f, NR, mal+0 }' "$D/$f"
done
awk -F'|' -v f="$M" '{ if (NF != 6) mal++ } END { printf "%s: %d filas, %d filas con un numero de campos distinto de 6\n", f, NR, mal+0 }' "$D/$M"
echo '```'
echo
echo "## Diferencia simetrica contra el calculo manual: (producto, stock_producible, insumo_limitante_id)"
echo
awk -F'|' '{ print $1 "|" $2 "|" $3 }' "$D/$M" | LC_ALL=C sort > "$T/m"
echo "| Corrida | Filas V2 | Filas manual | Solo V2 | Solo manual |"
echo "|---|---|---|---|---|"
for n in 1 2 3; do
  awk -F'|' '{ print $1 "|" $3 "|" $6 }' "$D/$P$n.txt" | LC_ALL=C sort > "$T/v$n"
  echo "| $n | $(wc -l < "$T/v$n") | $(wc -l < "$T/m") | $(LC_ALL=C comm -23 "$T/v$n" "$T/m" | wc -l) | $(LC_ALL=C comm -13 "$T/v$n" "$T/m" | wc -l) |"
done
echo
echo '```'
echo "Solo V2 (corrida 1):"; LC_ALL=C comm -23 "$T/v1" "$T/m" || true
echo "Solo manual (contra corrida 1):"; LC_ALL=C comm -13 "$T/v1" "$T/m" || true
echo '```'
echo
echo "## Empates segun el calculo manual"
echo
echo '```'
awk -F'|' '$5 > 1 { printf "producto %s: empatados {%s}, limitante esperado %s (con COLLATE \"C\": %s)\n", $1, $4, $3, $6 }' "$D/$M"
awk -F'|' '$3 != $6 { d++ } END { printf "productos donde la colacion de la base y \"C\" eligen distinto: %d\n", d+0 }' "$D/$M"
echo '```'
if [ -f "$D/$HA" ] && [ -f "$D/$HB" ]; then
  echo
  echo "## Huella del estado"
  echo
  echo '```'
  if cmp "$D/$HA" "$D/$HB"; then echo "huella antes = huella despues"; else echo "huella antes != huella despues"; fi
  cat "$D/$HA"
  echo '```'
fi
