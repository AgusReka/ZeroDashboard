-- 07_inventario_esquema_saleor.sql
-- Relevamiento del esquema de Saleor para la afirmación de límite (H2).
-- SOLO LECTURA. Ejecutar con psql contra la base de Saleor y guardar la salida completa:
--   psql -h localhost -p <puerto> -U <usuario> -d <base> -f 07_inventario_esquema_saleor.sql > salida_07_<fecha>.txt
-- Registrar en la bitácora: fecha, versión de Saleor, commit o imagen usada.

\echo '== 0. Versión del motor y fecha de ejecución'
SELECT version(), now();

\echo '== 1. Tablas cuyo nombre sugiere composición (insumo, receta, componente, kit, BOM, ensamble)'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ~* '(component|bundle|bom|bill|recipe|ingredient|kit|assembl|material|supply|insumo|receta)'
ORDER BY table_name;

\echo '== 2. Columnas cuyo nombre sugiere cantidad requerida por unidad'
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~* '(required_quantity|quantity_per|per_unit|component)'
ORDER BY table_name, column_name;

\echo '== 3. Toda clave foránea que apunte a la tabla de variantes'
--    Si existiera una relación variante -> variante (composición), aparecería acá.
SELECT tc.table_name AS tabla_origen, kcu.column_name AS columna, ccu.table_name AS tabla_destino
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'product_productvariant'
ORDER BY tabla_origen, columna;

\echo '== 4. Estructura de la existencia: stock por variante y depósito'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'warehouse_stock'
ORDER BY ordinal_position;

\echo '== 5. Mecanismo genérico que podría aproximar composición por convención:'
\echo '==    valores de atributo que referencian variantes (sin cantidad por vínculo)'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attribute_attributevalue'
ORDER BY ordinal_position;

SELECT count(*) AS valores_que_referencian_variantes
FROM attribute_attributevalue
WHERE reference_variant_id IS NOT NULL;

\echo '== 6. Tamaño de los datos de demostración'
SELECT
  (SELECT count(*) FROM product_product)        AS productos,
  (SELECT count(*) FROM product_productvariant) AS variantes,
  (SELECT count(*) FROM warehouse_warehouse)    AS depositos,
  (SELECT count(*) FROM warehouse_stock)        AS filas_stock;
