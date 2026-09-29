#!/usr/bin/env bash
# Paso 4, Odoo: la modificacion de experimentos/odoo/ESPERADO_P3_4.md (linea 6 de mrp_bom_line de 4 a 12;
# stock_quant de 7 para Bolt, product_id 57, en la ubicacion 5). Una transaccion terminada en ROLLBACK.
# Dentro: el calculo manual y la V2 tres veces, con SET ROLE zd_odoo_lectura (privilegios del rol de
# solo lectura, y ve los cambios no confirmados). Despues, verificacion desde sesiones nuevas.
source "$(dirname "$0")/lib.sh"
S=$EXP/salidas/p4_odoo
rm -rf "$S"; mkdir -p "$S/datos"
C=$(contenedor odoo)
preparar odoo > "$S/hashes.txt"

cat > "$S/estado_previo_input.sql" <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;
SELECT id, bom_id, product_id, product_qty FROM mrp_bom_line WHERE id = 6;
SELECT count(*) AS quants_57_internos FROM stock_quant q JOIN stock_location l ON l.id = q.location_id WHERE q.product_id = 57 AND l.usage = 'internal';
SELECT id, usage FROM stock_location WHERE id = 5;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/huella_antes.txt
\i /tmp/zd/huella.sql
\o
ROLLBACK;
SQL

{
cat <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid;
UPDATE mrp_bom_line SET product_qty = 12 WHERE id = 6 AND product_qty = 4;
INSERT INTO stock_quant (product_id, location_id, company_id, quantity, reserved_quantity, in_date)
VALUES (57, 5, 1, 7, 0, now() AT TIME ZONE 'UTC');
-- guarda no constante: aborta si alguno de los dos cambios no aplico
SELECT CASE WHEN (SELECT product_qty FROM mrp_bom_line WHERE id = 6) = 12
             AND (SELECT sum(quantity - reserved_quantity) FROM stock_quant q JOIN stock_location l ON l.id = q.location_id
                  WHERE q.product_id = 57 AND l.usage = 'internal') = 7
            THEN 'ok' ELSE (1 / (length(current_user) * 0))::text END AS guarda;
SQL
volcar /tmp/zd/out/manual.txt /tmp/zd/manual.sql
echo "SET ROLE zd_odoo_lectura;"
echo "SELECT current_user AS rol_de_la_v2;"
for n in 1 2 3; do volcar /tmp/zd/out/v2_corrida$n.txt /tmp/zd/v2.sql; done
echo "RESET ROLE;"
echo "ROLLBACK;"
} > "$S/modificacion_input.sql"

cat > "$S/verificacion_input.sql" <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;
SELECT id, bom_id, product_id, product_qty FROM mrp_bom_line WHERE id = 6;
SELECT count(*) AS quants_57_internos FROM stock_quant q JOIN stock_location l ON l.id = q.location_id WHERE q.product_id = 57 AND l.usage = 'internal';
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/huella_despues.txt
\i /tmp/zd/huella.sql
\o
ROLLBACK;
SQL
{ echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;";
  echo "SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;";
  volcar /tmp/zd/out/v2_rollback.txt /tmp/zd/v2.sql; echo "ROLLBACK;"; } > "$S/verificacion_v2_input.sql"

ejecutar odoo admin "$S/estado_previo_input.sql" "$S/estado_previo_output.txt"
ejecutar odoo admin "$S/modificacion_input.sql" "$S/modificacion_output.txt"
ejecutar odoo admin "$S/verificacion_input.sql" "$S/verificacion_output.txt"
ejecutar odoo lectura "$S/verificacion_v2_input.sql" "$S/verificacion_v2_output.txt"

docker cp "$C":/tmp/zd/out/. "$S/datos/"
bash "$EXP/scripts/comparar.sh" "$S/datos" > "$S/comparacion.md"
{ echo; echo "## Reversion"; echo; echo '```';
  if cmp "$S/datos/v2_rollback.txt" "$EXP/salidas/p3_odoo/datos/v2_corrida1.txt"; then echo "V2 despues del ROLLBACK = V2 base (p3_odoo, corrida 1)"; else echo "V2 despues del ROLLBACK != V2 base"; fi
  if cmp "$S/datos/huella_despues.txt" "$EXP/salidas/p3_odoo/datos/huella_antes.txt"; then echo "huella despues del ROLLBACK = huella base (p3_odoo)"; else echo "huella despues del ROLLBACK != huella base"; fi
  echo '```'; } >> "$S/comparacion.md"
cat "$S/comparacion.md"
