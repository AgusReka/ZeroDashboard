#!/usr/bin/env bash
# Paso 4, Food Store, lectura del estado previo (solo lectura): componentes de cada producto activo con
# receta, con existencia y cantidad por unidad, y la huella. Con esto se aplica a mano la regla 5.2 del
# preregistro y se escriben los valores esperados en ESPERADO_FOODSTORE.md antes de modificar nada.
source "$(dirname "$0")/lib.sh"
S=$EXP/salidas/p4_foodstore
rm -rf "$S"; mkdir -p "$S/datos"
C=$(contenedor foodstore)
preparar foodstore > "$S/hashes_estado.txt"
cat > "$S/estado_previo_input.sql" <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS hora_servidor, current_user, pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\o /tmp/zd/out/componentes.txt
SELECT p.id AS producto, p.name AS producto_nombre, i.id AS insumo, i.name AS insumo_nombre,
       i.stock_quantity AS existencia, pi.quantity AS cantidad_por_unidad
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i          ON i.id = pi.ingredient_id
WHERE p.deleted_at IS NULL AND i.deleted_at IS NULL AND p.available = true AND pi.quantity > 0
ORDER BY p.id, i.id;
\o /tmp/zd/out/huella_previa.txt
\i /tmp/zd/huella.sql
\o
ROLLBACK;
SQL
ejecutar foodstore lectura "$S/estado_previo_input.sql" "$S/estado_previo_output.txt"
docker cp "$C":/tmp/zd/out/. "$S/datos/"
cat "$S/datos/componentes.txt"
