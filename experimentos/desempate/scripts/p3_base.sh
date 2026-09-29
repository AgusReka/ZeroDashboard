#!/usr/bin/env bash
# Paso 3: V2 tres veces, en tres sesiones distintas (rol de solo lectura cuando existe), y calculo manual
# en una cuarta sesion. Huella del estado antes y despues, para mostrar que las cuatro sesiones leyeron
# el mismo estado. Todas las transacciones son REPEATABLE READ READ ONLY y terminan en ROLLBACK.
# Uso: p3_base.sh <foodstore|medusa|odoo>
source "$(dirname "$0")/lib.sh"
E=$1
S=$EXP/salidas/p3_$E
rm -rf "$S"; mkdir -p "$S/datos"
C=$(contenedor "$E")
preparar "$E" > "$S/hashes.txt"

cabecera() {
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  echo "SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;"
}

{ cabecera; volcar /tmp/zd/out/huella_antes.txt /tmp/zd/huella.sql; echo "ROLLBACK;"; } > "$S/huella_antes_input.sql"
for n in 1 2 3; do
  { cabecera; volcar /tmp/zd/out/v2_corrida$n.txt /tmp/zd/v2.sql; echo "ROLLBACK;"; } > "$S/v2_corrida${n}_input.sql"
done
{ cabecera; volcar /tmp/zd/out/manual.txt /tmp/zd/manual.sql; echo "ROLLBACK;"; } > "$S/manual_input.sql"
{ cabecera; volcar /tmp/zd/out/huella_despues.txt /tmp/zd/huella.sql; echo "ROLLBACK;"; } > "$S/huella_despues_input.sql"

ejecutar "$E" "$(rol_manual "$E")" "$S/huella_antes_input.sql" "$S/huella_antes_output.txt"
for n in 1 2 3; do
  ejecutar "$E" lectura "$S/v2_corrida${n}_input.sql" "$S/v2_corrida${n}_output.txt"
done
ejecutar "$E" "$(rol_manual "$E")" "$S/manual_input.sql" "$S/manual_output.txt"
ejecutar "$E" "$(rol_manual "$E")" "$S/huella_despues_input.sql" "$S/huella_despues_output.txt"

docker cp "$C":/tmp/zd/out/. "$S/datos/"
bash "$EXP/scripts/comparar.sh" "$S/datos" > "$S/comparacion.md"
cat "$S/comparacion.md"
