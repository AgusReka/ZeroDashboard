BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura;
-- (a) original de WF-01a (sección 4.2) SIN la línea del umbral
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
-- (b) canónica sin umbral: 12_consulta_canonica_stock_fisico_sin_umbral.sql
-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
-- (c) diferencia simétrica por id
WITH o AS (
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC
), c AS (
-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC
)
SELECT COALESCE(o.id::text, c.id) AS id,
       CASE WHEN c.id IS NULL THEN 'solo_original'
            WHEN o.id IS NULL THEN 'solo_canonica'
            ELSE 'interseccion' END AS conjunto,
       o.name AS nombre_original, c.nombre AS nombre_canonica,
       o.stock_quantity AS stock_original, c."stockDisponible" AS stock_canonica
FROM o FULL JOIN c ON o.id::text = c.id
ORDER BY 2, 1;
WITH o AS (
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC
), c AS (
-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC
)
SELECT count(*) FILTER (WHERE c.id IS NULL) AS solo_original,
       count(*) FILTER (WHERE o.id IS NULL) AS solo_canonica,
       count(*) FILTER (WHERE o.id IS NOT NULL AND c.id IS NOT NULL) AS interseccion,
       count(*) FILTER (WHERE o.id IS NOT NULL AND c.id IS NOT NULL
                          AND (o.name IS DISTINCT FROM c.nombre OR o.stock_quantity IS DISTINCT FROM c."stockDisponible")) AS interseccion_con_valores_distintos
FROM o FULL JOIN c ON o.id::text = c.id;
ROLLBACK;
