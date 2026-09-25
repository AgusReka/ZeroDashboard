BEGIN;
SELECT now() AS instante, current_setting('transaction_read_only') AS solo_lectura;
SELECT id, name, stock_quantity FROM product WHERE id = 8;
UPDATE product SET stock_quantity = 8 WHERE id = 8 AND stock_quantity = 200;
-- guarda: si el UPDATE no dejó el stock en 8, la división por cero corta el script y la transacción se descarta
SELECT id, name, stock_quantity, CASE WHEN stock_quantity = 8 THEN 'ok' ELSE (1/0)::text END AS guarda FROM product WHERE id = 8;
-- (a) original de WF-01a (sección 4.2), con umbral, texto literal
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND p.stock_quantity <= 20
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
-- (b) 11_consulta_canonica_stock_fisico.sql, texto sin modificar
-- ============================================================
-- CONSULTA CANÓNICA: stock físico (WF-01a), productos sin receta.
-- Versión canónica de la consulta de la sección 4.2 de
-- docs/bitacora/estudio_previo/bitacora_WF-01.md.
-- Solo usa v_producto y v_receta_componente. Umbral: <= 20.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
-- (c) diferencia simétrica por id
WITH o AS (
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND p.stock_quantity <= 20
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC
), c AS (
-- ============================================================
-- CONSULTA CANÓNICA: stock físico (WF-01a), productos sin receta.
-- Versión canónica de la consulta de la sección 4.2 de
-- docs/bitacora/estudio_previo/bitacora_WF-01.md.
-- Solo usa v_producto y v_receta_componente. Umbral: <= 20.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
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
ROLLBACK;
