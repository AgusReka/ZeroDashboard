#!/usr/bin/env bash
# Paso 4, Food Store: empate forzado dentro de una transaccion terminada en ROLLBACK.
# Uso: p4_foodstore.sh <ingredient_id> <existencia_actual> <existencia_nueva>
# Los tres valores salen de ESPERADO_FOODSTORE.md (regla 5.2 del preregistro), commiteado antes de correr esto.
# Dentro de la transaccion: huella (debe coincidir con la del estado previo), UPDATE con guarda, y con
# SET ROLE lector_zerodashboard el calculo manual y la V2 tres veces. Despues, verificacion desde sesiones nuevas.
source "$(dirname "$0")/lib.sh"
ING=$1; ANTES=$2; NUEVA=$3
case "$ING$ANTES$NUEVA" in *[!0-9]*) echo "argumentos no numericos" >&2; exit 2 ;; esac
S=$EXP/salidas/p4_foodstore
C=$(contenedor foodstore)
preparar foodstore > "$S/hashes.txt"

{
echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;"
echo "SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;"
volcar /tmp/zd/out/huella_tx.txt /tmp/zd/huella.sql
echo "UPDATE ingredient SET stock_quantity = $NUEVA WHERE id = $ING AND stock_quantity = $ANTES AND deleted_at IS NULL;"
echo "-- guarda no constante: aborta si el cambio no aplico"
echo "SELECT CASE WHEN (SELECT stock_quantity FROM ingredient WHERE id = $ING) = $NUEVA THEN 'ok' ELSE (1 / (length(current_user) * 0))::text END AS guarda;"
echo "SET ROLE lector_zerodashboard;"
echo "SELECT current_user AS rol_de_la_v2;"
volcar /tmp/zd/out/manual.txt /tmp/zd/manual.sql
for n in 1 2 3; do volcar /tmp/zd/out/v2_corrida$n.txt /tmp/zd/v2.sql; done
echo "RESET ROLE;"
echo "ROLLBACK;"
} > "$S/modificacion_input.sql"

{
echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
echo "SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;"
echo "SELECT id, name, stock_quantity FROM ingredient WHERE id = $ING;"
volcar /tmp/zd/out/huella_despues.txt /tmp/zd/huella.sql
volcar /tmp/zd/out/v2_rollback.txt /tmp/zd/v2.sql
echo "ROLLBACK;"
} > "$S/verificacion_input.sql"

ejecutar foodstore admin "$S/modificacion_input.sql" "$S/modificacion_output.txt"
ejecutar foodstore lectura "$S/verificacion_input.sql" "$S/verificacion_output.txt"

docker cp "$C":/tmp/zd/out/. "$S/datos/"
bash "$EXP/scripts/comparar.sh" "$S/datos" v2_corrida manual.txt huella_previa.txt huella_tx.txt > "$S/comparacion.md"
{ echo; echo "## Reversion"; echo; echo '```';
  if cmp "$S/datos/v2_rollback.txt" "$EXP/salidas/p3_foodstore/datos/v2_corrida1.txt"; then echo "V2 despues del ROLLBACK = V2 base (p3_foodstore, corrida 1)"; else echo "V2 despues del ROLLBACK != V2 base"; fi
  if cmp "$S/datos/huella_despues.txt" "$S/datos/huella_previa.txt"; then echo "huella despues del ROLLBACK = huella del estado previo"; else echo "huella despues del ROLLBACK != huella del estado previo"; fi
  echo '```'; } >> "$S/comparacion.md"
cat "$S/comparacion.md"
